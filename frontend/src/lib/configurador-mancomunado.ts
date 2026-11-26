// Productores mancomunados por plan (macatvalores PLAN_MANCOMUNADO, .antigravity/CONTRATO-AUTO-CONFIGURABLE.md).
// Reglas iguales a las de nest-api: ≥ 2 productores, sin repetir, % > 0 con hasta 4 decimales y suma exactamente 100.

type Obj = Record<string, unknown>;

export const MIN_PRODUCTORES = 2;
const DECIMALES = 4;
const ESCALA = 10 ** DECIMALES;

export interface FilaMancomunado {
  cproductor: number;
  xproductor?: string;
  /** Texto del campo (admite coma decimal). */
  ppart: string;
}

const numero = (v: string) => (String(v ?? '').trim() === '' ? NaN : Number(String(v).trim().replace(',', '.')));

/** Filas del JSON guardado (`config.productores`); vacío si no hay. */
export function filasDeConfig(config: Obj | null): FilaMancomunado[] {
  const l = config?.productores;
  if (!Array.isArray(l)) return [];
  return l
    .map((p) => p as Obj)
    .map((p) => ({ cproductor: Number(p.cproductor), ppart: p.ppart == null ? '' : String(p.ppart) }))
    .filter((p) => Number.isInteger(p.cproductor) && p.cproductor > 0);
}

/** Suma de los % (en diezmilésimas enteras, sin error de coma flotante); las filas no numéricas no suman. */
export function sumaPorcentajes(filas: FilaMancomunado[]): number {
  return filas.reduce((s, f) => s + (Number.isFinite(numero(f.ppart)) ? Math.round(numero(f.ppart) * ESCALA) : 0), 0) / ESCALA;
}

/** Texto de la suma para mostrar en vivo (hasta 4 decimales, sin ceros sobrantes). */
export const textoSuma = (filas: FilaMancomunado[]) => String(sumaPorcentajes(filas));

export interface ErroresMancomunado {
  general?: string;
  porProductor: Record<number, string>;
}

export function validarMancomunado(filas: FilaMancomunado[]): ErroresMancomunado {
  const e: ErroresMancomunado = { porProductor: {} };
  if (filas.length < MIN_PRODUCTORES) e.general = `Un mancomunado necesita al menos ${MIN_PRODUCTORES} productores.`;
  const vistos = new Set<number>();
  for (const f of filas) {
    if (vistos.has(f.cproductor)) e.porProductor[f.cproductor] = 'Productor repetido.';
    vistos.add(f.cproductor);
    const n = numero(f.ppart);
    if (!Number.isFinite(n) || n <= 0) e.porProductor[f.cproductor] ??= 'Indica un % mayor que 0.';
    else if (n > 100) e.porProductor[f.cproductor] ??= 'No puede pasar de 100.';
    else if (Math.abs(n * ESCALA - Math.round(n * ESCALA)) > 1e-6) e.porProductor[f.cproductor] ??= `Máximo ${DECIMALES} decimales.`;
  }
  if (!e.general && Object.keys(e.porProductor).length === 0 && Math.round(sumaPorcentajes(filas) * ESCALA) !== 100 * ESCALA) {
    e.general = `Los porcentajes suman ${textoSuma(filas)} y deben sumar exactamente 100.`;
  }
  return e;
}

export const mancomunadoValido = (e: ErroresMancomunado) => !e.general && Object.keys(e.porProductor).length === 0;

/** Cuerpo del PUT: solo cproductor y ppart numéricos. */
export const cuerpoMancomunado = (filas: FilaMancomunado[]) => ({
  productores: filas.map((f) => ({ cproductor: f.cproductor, ppart: numero(f.ppart) })),
});

// ── Mancomunado pendiente (paso «Datos del plan» del Combo): se guarda con el plan ──────────────────────────────

/** Lo elegido antes de crear el plan: interruptor y productores con su %. */
export interface PendienteMancomunado {
  activo: boolean;
  filas: FilaMancomunado[];
}

export const PENDIENTE_MANC_VACIO: PendienteMancomunado = { activo: false, filas: [] };

export const MSG_SIN_DOMINIO_MANCOMUNADO =
  'Sis2000 aún no tiene el catálogo PLAN_MANCOMUNADO: falta el script del DBA. El plan quedó creado; lo elegido sigue aquí para guardarlo cuando el catálogo exista.';

/** Primer problema del mancomunado pendiente (null si está bien o si no se activó). */
export function errorPendienteMancomunado(p: PendienteMancomunado): string | null {
  if (!p.activo) return null;
  const e = validarMancomunado(p.filas);
  return e.general ?? Object.values(e.porProductor)[0] ?? null;
}

/** Texto para el resumen «Antes de guardar». */
export function resumenMancomunado(p: PendienteMancomunado): string {
  if (!p.activo || !p.filas.length) return 'No';
  return p.filas.map((f) => `${f.xproductor ? `${f.cproductor} · ${f.xproductor}` : f.cproductor} ${f.ppart.trim() || '—'} %`).join(', ');
}

/** Mismo contenido (para saber si el usuario cambió algo frente a lo guardado en Sis2000). */
export const mismoMancomunado = (a: PendienteMancomunado, b: PendienteMancomunado) =>
  a.activo === b.activo && JSON.stringify(a.filas.map((f) => [f.cproductor, f.ppart])) === JSON.stringify(b.filas.map((f) => [f.cproductor, f.ppart]));

export interface ResultadoMancomunado {
  estado: 'sin-cambios' | 'guardado' | 'desactivado' | 'fallo';
  aviso?: string;
}

/**
 * Aplica el mancomunado pendiente DESPUÉS de crear (o actualizar) el plan: PUT si está activo, DELETE si se apagó lo que había.
 * Si falla (p. ej. 409 por dominio no creado) no lanza: devuelve el aviso para mostrarlo; el plan ya existe.
 */
export async function aplicarMancomunadoPendiente(
  pendiente: PendienteMancomunado,
  original: PendienteMancomunado,
  io: { guardar: (cuerpo: ReturnType<typeof cuerpoMancomunado>) => Promise<unknown>; desactivar: () => Promise<unknown> },
): Promise<ResultadoMancomunado> {
  if (mismoMancomunado(pendiente, original)) return { estado: 'sin-cambios' };
  if (!pendiente.activo && !original.activo) return { estado: 'sin-cambios' };
  try {
    if (pendiente.activo) {
      await io.guardar(cuerpoMancomunado(pendiente.filas));
      return { estado: 'guardado' };
    }
    await io.desactivar();
    return { estado: 'desactivado' };
  } catch (e) {
    const status = (e as { status?: number } | null)?.status;
    if (status === 409) return { estado: 'fallo', aviso: MSG_SIN_DOMINIO_MANCOMUNADO };
    const msg = e instanceof Error && e.message ? e.message : 'error desconocido';
    return { estado: 'fallo', aviso: `El plan quedó creado, pero no se pudo guardar el mancomunado: ${msg}. Lo elegido sigue aquí; reinténtalo.` };
  }
}
