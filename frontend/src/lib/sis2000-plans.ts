export interface Sis2000PlanCoverage {
  ccobertura: string;
  xcobertura: string;
  msumamin: number | null;
  msumamax: number | null;
  mprima: number | null;
  pprima: number | null;
}

export interface Sis2000PlanParentesco {
  cparen: string;
  xparentesco: string;
  min_edad: number | null;
  max_edad: number | null;
}

export interface Sis2000Plan {
  cplan: string;
  xplan: string;
  xplan_c: string | null;
  cramo: number;
  cproducto: string | null;
  cproductor: number | null;
  cbeneficiario: number | null;
  ctenedor: number | null;
  cmoneda: string | null;
  iestado: string | null;
  msumaasegext: number | null;
  msumaaseg: number | null;
  itarifa: string | null;
  nmax_dep: number | null;
  ctipo: number | null;
  bnacional: number | null;
  itiporen: string | null;
  coberturas: Sis2000PlanCoverage[];
  parentescos: Sis2000PlanParentesco[];
}

export interface Sis2000ProductPlansResponse {
  cproducto: string;
  centidad: string;
  citem: string;
  mensaje: string;
  plans: Sis2000Plan[];
}

export const SIS2000_PLAN_SCALAR_FIELDS: Array<{
  key: keyof Sis2000Plan;
  label: string;
}> = [
  { key: 'cplan', label: 'Código plan (cplan)' },
  { key: 'xplan', label: 'Nombre (xplan)' },
  { key: 'xplan_c', label: 'Nombre corto (xplan_c)' },
  { key: 'cramo', label: 'Ramo (cramo)' },
  { key: 'cproducto', label: 'Producto plan (cproducto)' },
  { key: 'cproductor', label: 'Productor (cproductor)' },
  { key: 'cbeneficiario', label: 'Beneficiario (cbeneficiario)' },
  { key: 'ctenedor', label: 'Tenedor (ctenedor)' },
  { key: 'cmoneda', label: 'Moneda (cmoneda)' },
  { key: 'iestado', label: 'Estado (iestado)' },
  { key: 'msumaasegext', label: 'Suma aseg. ext. (msumaasegext)' },
  { key: 'msumaaseg', label: 'Suma asegurada (msumaaseg)' },
  { key: 'itarifa', label: 'Tipo tarifa (itarifa)' },
  { key: 'nmax_dep', label: 'Máx. dependientes (nmax_dep)' },
  { key: 'ctipo', label: 'Tipo vehículo (ctipo)' },
  { key: 'bnacional', label: 'Nacional (bnacional)' },
  { key: 'itiporen', label: 'Tipo renovación (itiporen)' },
];

export function formatPlanMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return String(value);
}

export function formatPlanScalar(value: unknown): string {
  if (value == null || value === '') return '—';
  return String(value);
}

/** Planes cosas/patrimonial: campos de auto/personas que suelen venir null. */
export const SIS2000_PLAN_HIDE_WHEN_EMPTY: ReadonlySet<keyof Sis2000Plan> = new Set([
  'cproductor',
  'cbeneficiario',
  'ctenedor',
  'itarifa',
  'nmax_dep',
  'ctipo',
  'bnacional',
  'msumaasegext',
]);

export function shouldShowPlanScalarField(
  plan: Sis2000Plan,
  key: keyof Sis2000Plan,
): boolean {
  if (!SIS2000_PLAN_HIDE_WHEN_EMPTY.has(key)) return true;
  const value = plan[key];
  return value != null && value !== '';
}

export function formatPlanSumaDisplay(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value === 0) return '0 (dinámica / matarifa)';
  return String(value);
}

export function formatPlanCoverageMoney(
  planValue: number | null | undefined,
  maestroValue: number | null | undefined,
): string {
  const plan = planValue ?? null;
  const maestro = maestroValue ?? null;
  if (plan != null && plan !== 0) return String(plan);
  if (maestro != null && maestro !== 0) return `${maestro} (matarifa_d)`;
  if (plan === 0 || maestro === 0) return '0';
  return '—';
}
