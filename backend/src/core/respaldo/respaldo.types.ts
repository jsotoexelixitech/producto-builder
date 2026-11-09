// Respaldo y versiones de lo que el configurador escribe en Sis2000. Se guarda en la Postgres del configurador.

export type EntidadRespaldo = 'PRODUCTO' | 'COBERTURA' | 'TARIFA' | 'PLAN' | 'PLAN_PROVEEDORES';
export type TipoVersion = 'CREACION' | 'CAMBIO' | 'ELIMINACION' | 'RESTAURACION';
export type ResultadoVersion = 'PENDIENTE' | 'APLICADA' | 'FALLIDA';

export const ENTIDADES_RESPALDO: EntidadRespaldo[] = ['PRODUCTO', 'COBERTURA', 'TARIFA', 'PLAN', 'PLAN_PROVEEDORES'];

export const NOMBRE_ENTIDAD: Record<EntidadRespaldo, string> = {
  PRODUCTO: 'el producto',
  COBERTURA: 'la cobertura',
  TARIFA: 'la tarifa',
  PLAN: 'el plan',
  PLAN_PROVEEDORES: 'los proveedores del plan',
};

/** Quién hizo el cambio (usuario del configurador). */
export interface UsuarioCambio {
  id?: string;
  email?: string;
  nombre?: string;
}

/** Contexto de una escritura: quién y por qué. */
export interface ContextoCambio {
  usuario?: UsuarioCambio;
  motivo?: string;
}

export interface Cambio {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface RespaldoRow {
  id: string;
  entidad: EntidadRespaldo;
  clave: string;
  existia: boolean;
  original: unknown;
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  createdAt: Date;
}

export interface VersionRow {
  id: string;
  respaldoId: string;
  numero: number;
  tipo: TipoVersion;
  resultado: ResultadoVersion;
  anterior: unknown;
  estado: unknown;
  payload: unknown;
  cambios: unknown;
  motivo: string | null;
  restauradaDesde: string | null;
  error: string | null;
  usuarioId: string | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  createdAt: Date;
  terminadaEn: Date | null;
}

/** Almacenamiento del respaldo (Prisma en producción, memoria en pruebas). */
export interface RespaldoRepo {
  buscar(entidad: EntidadRespaldo, clave: string): Promise<RespaldoRow | null>;
  /** Crea la copia original si no existe; si ya existe la devuelve sin tocarla (nunca se sobreescribe). */
  asegurarOriginal(d: {
    entidad: EntidadRespaldo;
    clave: string;
    existia: boolean;
    original: unknown;
    usuario?: UsuarioCambio;
  }): Promise<RespaldoRow>;
  /** Guarda lo que había antes de escribir (versión PENDIENTE con el número siguiente). */
  abrirVersion(
    respaldoId: string,
    d: {
      tipo: TipoVersion;
      anterior: unknown;
      payload: unknown;
      motivo?: string;
      restauradaDesde?: string;
      usuario?: UsuarioCambio;
    },
  ): Promise<VersionRow>;
  /** Cierra la versión una sola vez con lo que quedó en Sis2000. */
  cerrarVersion(
    id: string,
    d: { resultado: 'APLICADA' | 'FALLIDA'; estado?: unknown; cambios?: Cambio[]; error?: string },
  ): Promise<VersionRow>;
  versiones(respaldoId: string): Promise<VersionRow[]>;
  version(id: string): Promise<VersionRow | null>;
}

export const RESPALDO_REPO = Symbol('RESPALDO_REPO');
