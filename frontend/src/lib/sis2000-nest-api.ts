/** Filas genéricas devueltas por nest-api sis2000-catalog (passthrough). */
export type Sis2000NestRow = Record<string, unknown>;

export const SIS2000_DEFAULT_CUSUARIO = 4;
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
    ctablatar: String(row.ctablatar ?? 'PRUEB'),
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

/** Plantilla create alineada con CreatePlanDto + visibilidad productor (valrep). */
export function defaultPlanPayload(options: DefaultPlanOptions = {}): Sis2000CreatePlanPayload {
  const type = options.type ?? 'personas';
  const cramo = options.cramo ?? 8;
  const cproducto = options.cproducto ?? 'TST908';
  const cproductor = options.cproductor ?? SIS2000_DEFAULT_PRODUCTOR;
  const ccobertura = options.ccobertura ?? 908;
  const ctarifa = options.ctarifa ?? 1;
  const ctablatar = options.ctablatar ?? 'PRUEB';

  const base: Sis2000CreatePlanPayload = {
    type,
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cplan: options.cplan ?? '',
    xplan: '',
    fdesde: '2020-01-01',
    fhasta: '2099-12-31',
    cramo,
    cmoneda: 'USD',
    cproducto,
    itiporen: 'N',
    idevolucion: 'N',
    iestado: 'V',
    all_productor: false,
    all_canal: false,
    productores: [{ cproductor }],
    frecuencias: [{ ifrecuencia: 'A', xfrecuencia: 'Anual', ndias: 365 }],
    coberturas: [],
  };

  if (type === 'personas') {
    base.coberturas = [
      normalizePlanCobertura(
        {
          ccobertura,
          ctarifa,
          bobligatoria: true,
          parentescos: [{ ctablatar }],
        },
        'personas',
      ),
    ];
  } else {
    base.coberturas = [
      normalizePlanCobertura(
        {
          ccobertura,
          ctarifa,
          msumamax: 2000,
          msumamin: 2000,
          mprima: 15,
        },
        'cosas',
      ),
    ];
  }

  return base;
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
    if (!Array.isArray(out.productores) || out.productores.length === 0) {
      out.productores = [{ cproductor: SIS2000_DEFAULT_PRODUCTOR }];
    } else {
      out.productores = (out.productores as Record<string, unknown>[]).map((p) => ({
        cproductor: Number(p.cproductor),
      }));
    }
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
    iestado: 'A',
    cmoneda: 'USD',
  };
}

export function defaultTarifaPayload(cramo: number, ccobertura: string): Record<string, unknown> {
  return {
    operation: 'C',
    cusuario: SIS2000_DEFAULT_CUSUARIO,
    cramo,
    ccobertura: String(ccobertura).trim(),
    ctarifa: '1',
    xdescripcion_l: '',
    iestado: 'A',
    cmoneda: 'USD',
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
    ccobertura: String(ccobertura).trim(),
    ctarifa: String(ctarifa).trim(),
    fdesde: '2020-01-01',
    fhasta: '2099-12-31',
    ctablatar: 'PRUEB',
    mprima: 0,
    pprima: 0,
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
    'ctarifa',
    'xdescripcion_l',
    'xcobertura',
    'cmoneda',
    'iestado',
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
