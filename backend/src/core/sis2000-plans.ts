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

function trimStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function toNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCoverage(row: Record<string, unknown>): Sis2000PlanCoverage {
  return {
    ccobertura: trimStr(row.ccobertura) ?? '',
    xcobertura: trimStr(row.xcobertura) ?? '',
    msumamin: toNum(row.msumamin),
    msumamax: toNum(row.msumamax),
    mprima: toNum(row.mprima),
    pprima: toNum(row.pprima),
  };
}

export function normalizeSis2000Plan(row: Record<string, unknown>): Sis2000Plan {
  const coberturasRaw = Array.isArray(row.coberturas) ? row.coberturas : [];
  const parentescosRaw = Array.isArray(row.parentescos) ? row.parentescos : [];

  return {
    cplan: trimStr(row.cplan) ?? '',
    xplan: trimStr(row.xplan) ?? '',
    xplan_c: trimStr(row.xplan_c),
    cramo: toNum(row.cramo) ?? 0,
    cproducto: trimStr(row.cproducto),
    cproductor: toNum(row.cproductor),
    cmoneda: trimStr(row.cmoneda),
    iestado: trimStr(row.iestado),
    msumaasegext: toNum(row.msumaasegext),
    coberturas: coberturasRaw.map((c) =>
      normalizeCoverage(c as Record<string, unknown>),
    ),
    parentescos: parentescosRaw as Record<string, unknown>[],
  };
}

export function normalizeSis2000PlanList(rows: unknown[]): Sis2000Plan[] {
  return rows
    .filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
    .map((row) => normalizeSis2000Plan(row));
}
