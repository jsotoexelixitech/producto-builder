export interface Sis2000PlanCoverage {
  ccobertura: string;
  xcobertura: string;
  msumamin: number | null;
  msumamax: number | null;
  mprima: number | null;
  pprima: number | null;
}

export interface Sis2000Plan {
  cplan: string;
  xplan: string;
  xplan_c: string | null;
  cramo: number;
  cproducto: string | null;
  cproductor: number | null;
  cmoneda: string | null;
  iestado: string | null;
  msumaasegext: number | null;
  coberturas: Sis2000PlanCoverage[];
  parentescos: Record<string, unknown>[];
}

export interface Sis2000ProductPlansResponse {
  cproducto: string;
  centidad: string;
  citem: string;
  mensaje: string;
  plans: Sis2000Plan[];
}

export function formatPlanMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(value);
}
