import type { Coverage, Product, ProductPlan } from '@/types/product';

export function planCoverageTariff(
  plan: ProductPlan,
  coverage: Coverage,
): number {
  const id = coverage.id;
  if (id && plan.coverageTariffs?.[id] != null) {
    return Number(plan.coverageTariffs[id]);
  }
  return Number(coverage.tariffPremium ?? 0);
}

export function calculatePlanPremiumTotal(plan: ProductPlan, coverages: Coverage[] = []): number {
  const idSet = new Set(plan.coverageIds ?? []);
  return coverages
    .filter((c) => c.id && idSet.has(c.id))
    .reduce((sum, c) => sum + planCoverageTariff(plan, c), 0);
}

export function resolvePlanDisplayPrice(
  plan: ProductPlan,
  product: Product,
): number {
  const fromCoverages = calculatePlanPremiumTotal(plan, product.coverages ?? []);
  if (fromCoverages > 0) return fromCoverages;

  const base = product.actuarialData?.commercialPremium
    ? Number(product.actuarialData.commercialPremium)
    : 0;
  const factor = Number(plan.priceFactor ?? 1);
  if (base > 0 && factor > 0 && factor <= 5) {
    return base * factor;
  }
  return factor > 0 ? factor : base;
}

export function plansWithCalculatedPremiums(
  plans: ProductPlan[],
  coverages: Coverage[],
): ProductPlan[] {
  return plans.map((plan) => ({
    ...plan,
    priceFactor: calculatePlanPremiumTotal(plan, coverages),
  }));
}

export function resolvePlanCoverageLabels(
  plan: ProductPlan,
  coverages: Coverage[] = [],
): string[] {
  if (plan.coverageLabels?.length) return plan.coverageLabels;
  if (!plan.coverageIds?.length) return [];
  const byId = new Map(coverages.filter((c) => c.id).map((c) => [c.id!, c.name]));
  return plan.coverageIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
}

/** Re-vincula planes a coberturas actuales (p. ej. tras re-guardar coberturas con nuevos IDs). */
export function syncPlansWithCoverages(
  plans: ProductPlan[],
  coverages: Coverage[],
): ProductPlan[] {
  const byId = new Map(coverages.filter((c) => c.id).map((c) => [c.id!, c]));
  const byName = new Map(
    coverages.filter((c) => c.id && c.name).map((c) => [c.name, c.id!]),
  );

  return plans.map((plan) => {
    const remapped = new Set<string>();

    for (const id of plan.coverageIds ?? []) {
      if (byId.has(id)) remapped.add(id);
    }

    for (const label of plan.coverageLabels ?? []) {
      const id = byName.get(label);
      if (id) remapped.add(id);
    }

    const coverageIds = [...remapped];
    return {
      ...plan,
      coverageIds,
      coverageLabels: coverageIds
        .map((id) => byId.get(id)?.name)
        .filter((n): n is string => !!n),
    };
  });
}

const PLAN_INACTIVE_PREFIX = '__INACTIVE__';

export function decodePlanFromApi(plan: ProductPlan): ProductPlan {
  const desc = plan.description ?? '';
  if (desc.startsWith(PLAN_INACTIVE_PREFIX)) {
    return {
      ...plan,
      isActive: false,
      description: desc.slice(PLAN_INACTIVE_PREFIX.length) || null,
    };
  }
  return { ...plan, isActive: plan.isActive ?? true };
}

export function encodePlanDescription(plan: ProductPlan): string | undefined {
  const base = (plan.description ?? '').replace(/^__INACTIVE__/, '');
  if (plan.isActive === false) {
    return `${PLAN_INACTIVE_PREFIX}${base}`;
  }
  return base || undefined;
}

export function sanitizePlansForSave(
  plans: ProductPlan[],
  coverages: Coverage[],
): ProductPlan[] {
  const validIds = new Set(coverages.filter((c) => c.id).map((c) => c.id!));
  return syncPlansWithCoverages(plans, coverages).map((plan) => ({
    ...plan,
    coverageIds: (plan.coverageIds ?? []).filter((id) => validIds.has(id)),
    coverageLabels: (plan.coverageIds ?? [])
      .filter((id) => validIds.has(id))
      .map((id) => coverages.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n),
  }));
}
export function enrichPlansWithCoverages(
  plans: ProductPlan[],
  product: Product,
): ProductPlan[] {
  const coverages = product.coverages ?? [];
  return plans.map((plan) => ({
    ...plan,
    coverageLabels: resolvePlanCoverageLabels(plan, coverages),
  }));
}
