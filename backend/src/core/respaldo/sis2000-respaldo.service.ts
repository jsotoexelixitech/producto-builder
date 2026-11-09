import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  Cambio,
  EntidadRespaldo,
  NOMBRE_ENTIDAD,
  RESPALDO_REPO,
  RespaldoRepo,
  TipoVersion,
  UsuarioCambio,
  VersionRow,
} from './respaldo.types';

const mensaje = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Valor comparable: textos sin espacios a los lados y fechas en ISO. */
function normal(v: unknown): unknown {
  if (typeof v === 'string') return v.trim();
  if (v instanceof Date) return v.toISOString();
  return v === undefined ? null : v;
}

/** Objeto anidado → mapa ruta → valor ("coberturas[0].msumamax"). */
export function aplanar(v: unknown, ruta = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (v === null || v === undefined || typeof v !== 'object' || v instanceof Date) {
    out.set(ruta || '(valor)', normal(v));
    return out;
  }
  if (Array.isArray(v)) {
    if (!v.length) out.set(ruta || '(valor)', '[]');
    v.forEach((x, i) => aplanar(x, `${ruta}[${i}]`, out));
    return out;
  }
  const entradas = Object.entries(v as Record<string, unknown>);
  if (!entradas.length) out.set(ruta || '(valor)', '{}');
  for (const [k, x] of entradas) aplanar(x, ruta ? `${ruta}.${k}` : k, out);
  return out;
}

/** Qué cambió entre dos estados (máx. `max` campos). */
export function diferencias(antes: unknown, despues: unknown, max = 150): Cambio[] {
  if (antes == null && despues == null) return [];
  if (antes == null) return [{ campo: '(registro)', antes: null, despues: 'creado' }];
  if (despues == null) return [{ campo: '(registro)', antes: 'existía', despues: null }];
  const a = aplanar(antes);
  const b = aplanar(despues);
  const campos = [...new Set([...a.keys(), ...b.keys()])];
  return campos
    .filter((c) => JSON.stringify(a.get(c) ?? null) !== JSON.stringify(b.get(c) ?? null))
    .slice(0, max)
    .map((campo) => ({ campo, antes: a.get(campo) ?? null, despues: b.get(campo) ?? null }));
}

/** Una escritura en Sis2000 con respaldo previo. */
export interface OperacionRespaldada<T> {
  entidad: EntidadRespaldo;
  clave: string;
  /** Estado actual en Sis2000: null = no existe; si lanza error, no se escribe. */
  leer: () => Promise<unknown | null>;
  /** Escritura por nest-api; recibe lo que había (ya respaldado). */
  escribir: (anterior: unknown | null) => Promise<T>;
  /** CREACION / CAMBIO se deducen de si existía; ELIMINACION y RESTAURACION se indican. */
  tipo?: TipoVersion;
  /** Lo que se envía a nest-api (auditoría; en planes también sirve para restaurar). */
  payload?: unknown;
  /** Para modificar o borrar: si no existe, no se escribe. */
  exigirExistente?: boolean;
  /** Qué parte del estado se compara para «qué cambió» (por defecto, todo). */
  comparable?: (estado: unknown) => unknown;
  motivo?: string;
  usuario?: UsuarioCambio;
  restauradaDesde?: string;
}

/**
 * Antes de cualquier escritura del configurador en Sis2000:
 *  1. lee lo que hay (si la lectura falla, no se escribe: no se modifica sin respaldo);
 *  2. guarda la copia original la primera vez (nunca se sobreescribe) y abre una versión con lo que había;
 *  3. escribe por nest-api; 4. vuelve a leer y cierra la versión con lo que quedó y qué cambió.
 */
@Injectable()
export class Sis2000RespaldoService {
  private readonly logger = new Logger(Sis2000RespaldoService.name);

  constructor(@Inject(RESPALDO_REPO) private readonly repo: RespaldoRepo) {}

  async escribir<T>(op: OperacionRespaldada<T>): Promise<{ resultado: T; version: VersionRow }> {
    const etiqueta = `${NOMBRE_ENTIDAD[op.entidad]} ${op.clave}`;

    let anterior: unknown | null;
    try {
      anterior = (await op.leer()) ?? null;
    } catch (err) {
      throw new ServiceUnavailableException(
        `No se pudo leer ${etiqueta} en Sis2000 antes de modificarlo; no se escribe sin respaldo. Detalle: ${mensaje(err)}`,
      );
    }
    if (op.exigirExistente && anterior == null) {
      throw new NotFoundException(`No existe ${etiqueta} en Sis2000.`);
    }
    const tipo: TipoVersion = op.tipo ?? (anterior == null ? 'CREACION' : 'CAMBIO');
    const motivo = op.motivo?.trim() || undefined;

    let version: VersionRow;
    try {
      const respaldo = await this.repo.asegurarOriginal({
        entidad: op.entidad,
        clave: op.clave,
        existia: anterior != null,
        original: anterior,
        usuario: op.usuario,
      });
      version = await this.repo.abrirVersion(respaldo.id, {
        tipo,
        anterior,
        payload: op.payload ?? null,
        motivo,
        restauradaDesde: op.restauradaDesde,
        usuario: op.usuario,
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `No se pudo guardar el respaldo de ${etiqueta}; no se modificó Sis2000. Detalle: ${mensaje(err)}`,
      );
    }

    let resultado: T;
    try {
      resultado = await op.escribir(anterior);
    } catch (err) {
      version = await this.cerrar(version, { resultado: 'FALLIDA', error: mensaje(err).slice(0, 1000) });
      throw err;
    }

    let estado: unknown | null = null;
    let aviso: string | undefined;
    try {
      estado = (await op.leer()) ?? null;
    } catch (err) {
      aviso = `Se escribió en Sis2000 pero no se pudo leer cómo quedó: ${mensaje(err)}`.slice(0, 1000);
      this.logger.warn(`${etiqueta}: ${aviso}`);
    }
    const comparar = op.comparable ?? ((x: unknown) => x);
    const cambios = aviso ? [] : diferencias(comparar(anterior), comparar(estado));
    version = await this.cerrar(version, { resultado: 'APLICADA', estado, cambios, error: aviso });
    return { resultado, version };
  }

  /** Cerrar la versión no debe tumbar una escritura que ya se hizo en Sis2000. */
  private async cerrar(
    version: VersionRow,
    d: { resultado: 'APLICADA' | 'FALLIDA'; estado?: unknown; cambios?: Cambio[]; error?: string },
  ): Promise<VersionRow> {
    try {
      return await this.repo.cerrarVersion(version.id, d);
    } catch (err) {
      this.logger.error(`No se pudo cerrar la versión ${version.numero} (${version.id}): ${mensaje(err)}`);
      return { ...version, resultado: d.resultado };
    }
  }
}
