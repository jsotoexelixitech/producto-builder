export type PremiumCalculationType = 'PRIMA_FIJA' | 'TASA_PORCENTUAL';

export type CoreSyncStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface CoreSubBranch {
  code: string;
  name: string;
  coreRamoCode: string;
  branch: string;
}

export interface CoreCoverageCatalogItem {
  code: string;
  name: string;
  accountingCode?: string | null;
  subBranchCode?: string | null;
  branch: string;
  source?: string;
}

export interface CoreProductSummary {
  coreCode: string;
  commercialName: string;
  internalCode: string;
  branch: string;
  subBranchCode?: string | null;
  syncedAt?: string;
  source?: string;
  productId?: string | null;
}

export function currencySymbol(currency?: string | null): string {
  switch (currency) {
    case 'USD':
      return 'US$';
    case 'EUR':
      return '€';
    case 'INDEXADO':
      return 'Idx.';
    default:
      return 'Bs.';
  }
}

export function resolveCoveragePremium(coverage: {
  premiumCalculationType?: PremiumCalculationType | string;
  tariffPremium?: number;
  tariffRate?: number;
  insuredSumFixed?: number;
  insuredSumMin?: number;
  subLimitPercent?: number;
  dependsOnCoverageName?: string;
  parentSum?: number;
}): number {
  const sum =
    coverage.insuredSumFixed ??
    coverage.insuredSumMin ??
    (coverage.parentSum != null && coverage.subLimitPercent != null
      ? (coverage.parentSum * coverage.subLimitPercent) / 100
      : undefined);

  if (
    coverage.premiumCalculationType === 'TASA_PORCENTUAL' &&
    coverage.tariffRate != null &&
    sum != null
  ) {
    return (sum * coverage.tariffRate) / 100;
  }

  return Number(coverage.tariffPremium ?? 0);
}
