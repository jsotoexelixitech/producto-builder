// Filas de la cotización de prueba del configurador (nest-api POST configurador/planes/:cramo/:cplan/cotizar).

const texto = (v: unknown) => String(v ?? '').trim();

/**
 * `data` de nest-api → filas por cobertura con la forma que ya usa el front (ccober, xcobertura, msumaasegext,
 * mprimaext, mcomisionext). spCalculoPer (personas) trae ccobertura y no trae comisión; spCalculoRiesgoGeneral (cosas)
 * trae ccober. Cada fila lleva ptasamon y cmoneda usados (de mamonedas) para mostrarlos.
 */
export function filasCotizacion(data: unknown): Record<string, unknown>[] {
  const d = (data ?? {}) as { detalle?: unknown; ptasamon?: unknown; cmoneda?: unknown; familia?: unknown };
  const detalle = Array.isArray(d.detalle) ? (d.detalle as Record<string, unknown>[]) : [];
  return detalle.map((f) => ({
    ...f,
    ccober: texto(f.ccober ?? f.ccobertura),
    xcobertura: texto(f.xcobertura ?? f.xdescripcion_l),
    msumaasegext: Number(f.msumaasegext ?? 0),
    mprimaext: Number(f.mprimaext ?? 0),
    mcomisionext: Number(f.mcomisionext ?? 0),
    ptasamon: Number(d.ptasamon ?? 0),
    cmoneda: texto(d.cmoneda),
    familia: texto(d.familia),
  }));
}

/** Lista `clave` de un objeto leído de nest-api (p. ej. { contratos, ramos } de configurador/reaseguro); [] si no está. */
export function listaDe(data: unknown, clave: string): Record<string, unknown>[] {
  const v = (data as Record<string, unknown> | null)?.[clave];
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
}
