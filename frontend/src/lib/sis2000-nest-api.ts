/** Filas genéricas devueltas por nest-api sis2000-catalog (passthrough). */
export type Sis2000NestRow = Record<string, unknown>;

/** Usuario Sis2000 de la integración Exelixi (el mismo de las emisiones nest-api). */
export const SIS2000_DEFAULT_CUSUARIO = 20364172;
/** Solo para el filtro de consulta de planes por productor (no se usa al crear planes). */
export const SIS2000_DEFAULT_PRODUCTOR = 80080;
export const SIS2000_DEFAULT_CENTIDAD = 'P';
export const SIS2000_DEFAULT_CITEM = '80080';

export type Sis2000PlanType = 'personas' | 'cosas';

export interface DefaultPlanOptions {
  type?: Sis2000PlanType;
  cramo?: number;
  cproducto?: string;
  cplan?: string;
  cproductor?: number;
  ccobertura?: number;
  ctarifa?: number;
  ctablatar?: string;
}

export interface Sis2000CreatePlanPayload {
  type: Sis2000PlanType | string;
  operation: string;
  cusuario: number;
  cplan: string;
  xplan: string;
  fdesde: string;
  fhasta: string;
  cramo: number;
  cmoneda: string;
  cproducto: string;
  idevolucion: string;
  itiporen: string;
  coberturas: Array<Record<string, unknown>>;
  frecuencias: Array<{ ifrecuencia: string; xfrecuencia: string; ndias?: number }>;
  xplan_c?: string;
  iestado?: string;
  xobservacion?: string;
  ctipo?: unknown;
  cbeneficiario?: unknown;
  ctenedor?: unknown;
  bnacional?: boolean;
  all_productor?: boolean;
  all_canal?: boolean;
  productores?: Array<{ cproductor: number }>;
  canales?: Array<{ ccanalalt: number }>;
}

export function sis2000PlanMasterId(cramo: number | string, cplan: string): string {
  return `${cramo}-${String(cplan).trim()}`;
}

function normalizeParentescoRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    cparen: Number(row.cparen ?? 1),
    csexo: String(row.csexo ?? 'A'),
    ctablatar: String(row.ctablatar ?? '').trim(),
    nedad_min: Number(row.nedad_min ?? 0),
    nedad_max: Number(row.nedad_max ?? 99),
    msuma: Number(row.msuma ?? 0),
    msumamax: Number(row.msumamax ?? 0),
    mprima: Number(row.mprima ?? 0),
  };
}

function normalizePlanCobertura(
  cob: Record<string, unknown>,
  planType: Sis2000PlanType,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...cob };
  if (out.ccobertura != null && out.ccobertura !== '') {
    out.ccobertura = Number(out.ccobertura);
  }
  if (out.ctarifa != null && out.ctarifa !== '') {
    out.ctarifa = Number(out.ctarifa);
  }
  if (planType === 'personas') {
    out.bobligatoria = out.bobligatoria ?? true;
    const parentescos = out.parentescos;
    if (Array.isArray(parentescos) && parentescos.length > 0) {
      out.parentescos = parentescos.map((p) =>
        normalizeParentescoRow(p as Record<string, unknown>),
      );
    } else {
      out.parentescos = [normalizeParentescoRow({})];
    }
  } else {
    if (out.msumamax != null) out.msumamax = Number(out.msumamax);
    if (out.msumamin != null) out.msumamin = Number(out.msumamin);
    if (out.mprima != null) out.mprima = Number(out.mprima);
  }
  return out;
}

export function inferPlanType(payload: Record<string, unknown>): Sis2000PlanType {
  const t = String(payload.type ?? '').toLowerCase();
  if (t === 'personas' || t === 'cosas') return t;
  const coberturas = payload.coberturas;
  if (Array.isArray(coberturas) && coberturas.length > 0) {
    const first = coberturas[0] as Record<string, unknown>;
    if (Array.isArray(first.parentescos) && first.parentescos.length > 0) {
      return 'personas';
    }
  }
  return 'cosas';
}

/**
 * Plantilla create alineada con CreatePlanDto (spMantPlanes). Sin valores de prueba: producto, ramo,
 * cobertura, tarifa, tabla de edades y productores quedan vacíos y validatePlanPayload exige llenarlos.
 */
export function defaultPlanPayload(options: DefaultPlanOptions = {}): Sis2000CreatePlanPayload {
  const type = options.type ?? 'personas';

  const base: Sis2000CreatePlanPayload = {
    type,
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cplan: options.cplan ?? '',
    xplan: '',
    fdesde: new Date().toISOString().slice(0, 10),
    fhasta: '2099-12-31',
    cramo: options.cramo ?? 0,
    cmoneda: '$',
    cproducto: options.cproducto ?? '',
    itiporen: 'A',
    idevolucion: 'N',
    iestado: 'V',
    all_productor: false,
    all_canal: false,
    productores: options.cproductor ? [{ cproductor: options.cproductor }] : [],
    frecuencias: [{ ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: 365 }],
    coberturas: [],
  };

  const cobertura: Record<string, unknown> = {
    ccobertura: options.ccobertura ?? '',
    ctarifa: options.ctarifa ?? 1,
  };
  base.coberturas = [
    type === 'personas'
      ? { ...cobertura, bobligatoria: true, parentescos: [normalizeParentescoRow({ ctablatar: options.ctablatar ?? '' })] }
      : { ...cobertura, msumamin: 0, msumamax: 0, mprima: 0 },
  ];

  return base;
}

/**
 * Errores que impedirían crear un plan útil en Sis2000 (vacío = se puede guardar).
 * En cosas la prima sale de maplantar.mprima: spMantPlanes no recibe tasa por cobertura.
 */
export function validatePlanPayload(payload: Record<string, unknown>): string[] {
  const errores: string[] = [];
  const type = inferPlanType(payload);
  if (!(Number(payload.cramo) > 0)) errores.push('Falta el ramo (cramo).');
  if (!String(payload.cproducto ?? '').trim()) errores.push('Falta el producto (cproducto).');
  const cplan = String(payload.cplan ?? '').trim();
  if (!cplan || cplan.length > 6) errores.push('El código del plan (cplan) es obligatorio, máx. 6 caracteres.');
  if (!String(payload.xplan ?? '').trim()) errores.push('Falta el nombre del plan (xplan).');

  const productores = Array.isArray(payload.productores) ? payload.productores : [];
  if (payload.all_productor !== true && productores.length === 0) {
    errores.push('Indica al menos un productor o marca all_productor: true.');
  }
  const frecuencias = Array.isArray(payload.frecuencias) ? payload.frecuencias : [];
  if (frecuencias.length === 0) errores.push('Agrega al menos una frecuencia de pago.');

  const coberturas = Array.isArray(payload.coberturas) ? (payload.coberturas as Record<string, unknown>[]) : [];
  if (coberturas.length === 0) errores.push('Agrega al menos una cobertura.');
  coberturas.forEach((c, i) => {
    const n = `Cobertura ${i + 1}`;
    if (!String(c.ccobertura ?? '').trim()) errores.push(`${n}: falta ccobertura.`);
    if (!String(c.ctarifa ?? '').trim()) errores.push(`${n}: falta ctarifa.`);
    if (type === 'cosas') {
      if (!(Number(c.msumamax) > 0)) errores.push(`${n}: msumamax debe ser mayor a 0.`);
      if (!(Number(c.mprima) > 0)) errores.push(`${n}: mprima debe ser mayor a 0 (es la prima que cotiza el plan).`);
    } else {
      const parentescos = Array.isArray(c.parentescos) ? (c.parentescos as Record<string, unknown>[]) : [];
      if (parentescos.length === 0) errores.push(`${n}: agrega al menos un parentesco.`);
      parentescos.forEach((p, j) => {
        if (!String(p.ctablatar ?? '').trim()) errores.push(`${n}, parentesco ${j + 1}: falta la tabla de tasas (ctablatar).`);
      });
    }
  });
  return errores;
}

/** Normaliza JSON del formulario antes de POST/PUT partner/starter/plan. */
export function normalizePlanPayloadForApi(
  payload: Record<string, unknown>,
  mode: 'create' | 'update',
): Record<string, unknown> {
  const planType = inferPlanType(payload);
  const out: Record<string, unknown> = {
    ...payload,
    type: planType,
    operation: mode === 'create' ? 'C' : 'U',
    cusuario: Number(payload.cusuario ?? SIS2000_DEFAULT_CUSUARIO),
    cramo: Number(payload.cramo),
    cproducto: String(payload.cproducto ?? '').trim(),
    cplan: String(payload.cplan ?? '').trim(),
    xplan: String(payload.xplan ?? '').trim(),
  };

  if (out.all_productor !== true) {
    out.all_productor = Boolean(out.all_productor);
    out.all_canal = Boolean(out.all_canal);
    out.productores = Array.isArray(out.productores)
      ? (out.productores as Record<string, unknown>[]).map((p) => ({
          cproductor: Number(p.cproductor),
        }))
      : [];
  }

  if (Array.isArray(out.coberturas)) {
    out.coberturas = (out.coberturas as Record<string, unknown>[]).map((c) =>
      normalizePlanCobertura(c, planType),
    );
  }

  if (Array.isArray(out.frecuencias)) {
    out.frecuencias = (out.frecuencias as Record<string, unknown>[]).map((f) => ({
      ...f,
      ifrecuencia: String(f.ifrecuencia ?? 'A'),
      xfrecuencia: String(f.xfrecuencia ?? 'Anual'),
      ndias: f.ndias != null ? Number(f.ndias) : undefined,
    }));
  }

  return out;
}

export function normalizeCatalogCreatePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  const op = String(out.operation ?? 'C').toUpperCase();
  out.operation = op === 'U' || op === 'D' ? op : 'C';
  out.cusuario = Number(out.cusuario ?? SIS2000_DEFAULT_CUSUARIO);
  if (out.cramo != null) out.cramo = Number(out.cramo);
  if (out.ccobertura != null && out.ccobertura !== '') {
    out.ccobertura = String(out.ccobertura).trim();
  }
  if (out.ctarifa != null && out.ctarifa !== '') {
    out.ctarifa = String(out.ctarifa).trim();
  }
  return out;
}

/** Descripción visible de matarifa (campo real: xtarifam). */
export function formatTarifaDescripcion(row: Sis2000NestRow): string {
  const raw =
    row.xtarifam ?? row.xtarifa ?? row.xdescripcion_l ?? row.xplan ?? row.xobserva;
  return formatNestRowValue(raw);
}

function resolveCcober(
  payload: Record<string, unknown>,
  fallbackCobertura?: string,
): string {
  const fromCcober = String(payload.ccober ?? '').trim();
  if (fromCcober) return fromCcober;
  const fromCobertura = String(payload.ccobertura ?? fallbackCobertura ?? '').trim();
  return fromCobertura;
}

/** POST/PUT matarifa — API exige ccober + xtarifam (no ccobertura / xdescripcion_l). */
export function normalizeTarifaPayloadForApi(
  payload: Record<string, unknown>,
  fallbackCobertura?: string,
): Record<string, unknown> {
  const out = normalizeCatalogCreatePayload(payload);
  const ccober = resolveCcober(out, fallbackCobertura);
  if (!ccober) {
    throw new Error('Falta ccober (código cobertura, máx. 4 caracteres).');
  }
  out.ccober = ccober;
  delete out.ccobertura;

  const xtarifam = String(out.xtarifam ?? out.xdescripcion_l ?? out.xtarifa ?? '').trim();
  if (!xtarifam) {
    throw new Error('Falta xtarifam (descripción tarifa, máx. 15 caracteres).');
  }
  out.xtarifam = xtarifam.slice(0, 15);
  delete out.xdescripcion_l;
  delete out.xtarifa;

  return out;
}

/** POST matarifa_d — API exige ccober (no ccobertura). */
export function normalizeTarifaDetallePayloadForApi(
  payload: Record<string, unknown>,
  fallbackCobertura?: string,
): Record<string, unknown> {
  const out = normalizeCatalogCreatePayload(payload);
  const ccober = resolveCcober(out, fallbackCobertura);
  if (!ccober) {
    throw new Error('Falta ccober para el detalle de tarifa.');
  }
  out.ccober = ccober;
  delete out.ccobertura;
  if (out.pprima != null && out.pprima !== '') out.pprima = Number(out.pprima);
  if (out.mprima != null && out.mprima !== '') out.mprima = Number(out.mprima);
  return out;
}

/** Toma el detalle vigente (iestado A) o el más reciente. */
export function pickVigenteTarifaDetalle(
  rows: Sis2000NestRow[],
): Sis2000NestRow | null {
  if (!rows.length) return null;
  const vigente = rows.find((r) => String(r.iestado ?? '').trim().toUpperCase() === 'A');
  return vigente ?? rows[0] ?? null;
}

export function normalizeCatalogUpdatePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return normalizeCatalogCreatePayload({ ...payload, operation: 'U' });
}

export function defaultCoberturaPayload(cramo: number): Record<string, unknown> {
  return {
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cramo,
    ccobertura: '',
    xcobertura: '',
    xdescripcion_l: '',
    iestado: 'V',
    cmoneda: '$',
  };
}

export function defaultTarifaPayload(cramo: number, ccobertura: string): Record<string, unknown> {
  return {
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cramo,
    ccober: String(ccobertura).trim(),
    ctarifa: '1',
    xtarifam: '',
    iestado: 'V',
  };
}

export function defaultTarifaDetallePayload(
  cramo: number,
  ccobertura: string,
  ctarifa: string,
): Record<string, unknown> {
  return {
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cramo,
    ccober: String(ccobertura).trim(),
    ctarifa: String(ctarifa).trim(),
    fdesde: new Date().toISOString().slice(0, 10),
    fhasta: '2099-12-31',
    msumamin: 0,
    msumamax: 0,
    mprima: 0,
    pprima: 0,
    iestado: 'V',
  };
}

export function formatNestRowValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

/** Muestra las claves más útiles de una fila macoberturas/matarifa. */
export function pickNestRowPreview(row: Sis2000NestRow, max = 8): [string, string][] {
  const priority = [
    'ccobertura',
    'ccober',
    'ctarifa',
    'xtarifam',
    'xtarifa',
    'xdescripcion_l',
    'xcobertura',
    'cmoneda',
    'iestado',
    'ctablatar',
    'msumamax',
    'msumamin',
    'mprima',
    'pprima',
    'cramo',
    'cplan',
  ];
  const keys = [
    ...priority.filter((k) => k in row),
    ...Object.keys(row).filter((k) => !priority.includes(k)),
  ].slice(0, max);
  return keys.map((k) => [k, formatNestRowValue(row[k])]);
}
