/** Filas genéricas devueltas por nest-api sis2000-catalog (passthrough). */
export type Sis2000NestRow = Record<string, unknown>;

export interface Sis2000CreatePlanPayload {
  type: string;
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
  coberturas: Array<{ ccobertura: string; ctarifa: string; [key: string]: unknown }>;
  frecuencias: Array<{ ifrecuencia: string; xfrecuencia: string; ndias?: number }>;
  xplan_c?: string;
  iestado?: string;
  xobservacion?: string;
  ctipo?: unknown;
  cbeneficiario?: unknown;
  ctenedor?: unknown;
  bnacional?: unknown;
}

export function sis2000PlanMasterId(cramo: number | string, cplan: string): string {
  return `${cramo}-${String(cplan).trim()}`;
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
