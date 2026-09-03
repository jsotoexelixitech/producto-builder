/** Límites alineados con packages/shared y DTOs del backend. */
export const FIELD_LIMITS = {
  product: {
    commercialName: 200,
    internalCode: 50,
    subPlanCode: 50,
    premiumGuaranteeDays: 365,
    percentMax: 99.99,
  },
  coverage: {
    name: 150,
    description: 500,
    reinsuranceContractCode: 20,
    reinsuranceContractName: 150,
    reinsuranceBranchCode: 20,
    waitingPeriodDays: 365,
  },
  actuarial: {
    actuaryName: 150,
    actuaryCedula: 20,
    actuarySudeasegNumber: 50,
    percentMax: 99.99,
  },
  plan: {
    name: 120,
    badge: 40,
    description: 300,
    assignedChannelName: 200,
  },
  legal: {
    exclusionText: 2000,
  },
  emission: {
    flowStepLabel: 120,
    flowStepShortLabel: 40,
    flowStepDescription: 300,
    formFieldLabel: 150,
  },
  dashboard: {
    search: 200,
  },
} as const;

export function clampText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

export function clampPercent(value: number, max = FIELD_LIMITS.actuarial.percentMax): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

export function clampInt(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(Math.trunc(value), min), max);
}
