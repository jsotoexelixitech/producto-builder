/** Campos maproductos devueltos por GET /partner/products/list y detail. */
export const SIS2000_PRODUCT_FIELD_KEYS = [
  'cproducto',
  'cramo',
  'u_version',
  'xdescripcion_l',
  'xdescripcion_c',
  'xabreviatura',
  'iproductor',
  'icanal',
  'xform',
  'cprog',
  'ifuente',
  'bok',
  'cerror',
  'fingreso',
  'cusuario',
  'ccategoria',
  'cusuarioauto',
  'ccategoriaauto',
  'fultmod',
  'cusuariomod',
  'ccategoriamod',
  'ctiporamo',
  'xdescripcion_prod',
  'mmonto_inicial',
  'norden',
  'xfraccionamiento',
  'xurl_presentacion',
] as const;

export type Sis2000FieldKey = (typeof SIS2000_PRODUCT_FIELD_KEYS)[number];

function asBool(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function asOptionalString(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).trim();
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** Normaliza fila list/detail partner → objeto plano para API product-builder. */
export function normalizeSis2000Row(row: Record<string, unknown>) {
  return {
    cproducto: String(row.cproducto ?? '').trim(),
    cramo: asOptionalNumber(row.cramo),
    u_version: asOptionalString(row.u_version),
    xdescripcion_l: String(row.xdescripcion_l ?? '').trim(),
    xdescripcion_c: asOptionalString(row.xdescripcion_c),
    xabreviatura: String(row.xabreviatura ?? '').trim(),
    iproductor: asBool(row.iproductor),
    icanal: asBool(row.icanal),
    xform: String(row.xform ?? 'persons').trim(),
    cprog: asOptionalString(row.cprog),
    ifuente: asOptionalString(row.ifuente),
    bok: row.bok == null ? null : asBool(row.bok),
    cerror: asOptionalString(row.cerror),
    fingreso: asOptionalString(row.fingreso),
    cusuario: asOptionalNumber(row.cusuario),
    ccategoria: asOptionalNumber(row.ccategoria),
    cusuarioauto: asOptionalNumber(row.cusuarioauto),
    ccategoriaauto: asOptionalNumber(row.ccategoriaauto),
    fultmod: asOptionalString(row.fultmod),
    cusuariomod: asOptionalNumber(row.cusuariomod),
    ccategoriamod: asOptionalNumber(row.ccategoriamod),
    ctiporamo: asOptionalNumber(row.ctiporamo),
    xdescripcion_prod: asOptionalString(row.xdescripcion_prod),
    mmonto_inicial: asOptionalString(row.mmonto_inicial),
    norden: asOptionalNumber(row.norden),
    xfraccionamiento: asOptionalString(row.xfraccionamiento),
    xurl_presentacion: asOptionalString(row.xurl_presentacion),
  };
}

export function sis2000RowToPayload(
  row: ReturnType<typeof normalizeSis2000Row>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    cproducto: row.cproducto,
    xdescripcion_l: row.xdescripcion_l,
    xabreviatura: row.xabreviatura,
    xform: row.xform,
    iproductor: row.iproductor,
    icanal: row.icanal,
    cramo: row.cramo ?? 0,
    ctiporamo: row.ctiporamo ?? 0,
  };

  const optionalKeys: Sis2000FieldKey[] = [
    'u_version',
    'xdescripcion_c',
    'xdescripcion_prod',
    'mmonto_inicial',
    'xfraccionamiento',
    'xurl_presentacion',
    'norden',
    'cusuario',
    'ccategoria',
    'cusuarioauto',
    'ccategoriaauto',
    'cusuariomod',
    'ccategoriamod',
    'bok',
    'cerror',
    'cprog',
    'ifuente',
    'fingreso',
    'fultmod',
  ];

  for (const key of optionalKeys) {
    const value = row[key as keyof typeof row];
    if (value !== undefined && value !== '') {
      payload[key] = value;
    }
  }

  return payload;
}
