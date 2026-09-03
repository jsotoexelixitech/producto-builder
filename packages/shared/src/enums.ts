export const ProductBranch = {
  AUTOMOVIL: 'AUTOMOVIL',
  SALUD: 'SALUD',
  VIDA: 'VIDA',
  PATRIMONIAL: 'PATRIMONIAL',
  INCLUSIVO: 'INCLUSIVO',
  RCV_OBLIGATORIO: 'RCV_OBLIGATORIO',
} as const;
export type ProductBranch = (typeof ProductBranch)[keyof typeof ProductBranch];

export const ContractCurrency = {
  VES: 'VES',
  USD: 'USD',
  EUR: 'EUR',
  INDEXADO: 'INDEXADO',
} as const;
export type ContractCurrency = (typeof ContractCurrency)[keyof typeof ContractCurrency];

export const PremiumCalculationType = {
  PRIMA_FIJA: 'PRIMA_FIJA',
  TASA_PORCENTUAL: 'TASA_PORCENTUAL',
} as const;
export type PremiumCalculationType =
  (typeof PremiumCalculationType)[keyof typeof PremiumCalculationType];

export const CoreSyncStatus = {
  PENDING: 'PENDING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
} as const;
export type CoreSyncStatus = (typeof CoreSyncStatus)[keyof typeof CoreSyncStatus];

export const EmissionType = {
  EMISION_GARANTIZADA: 'EMISION_GARANTIZADA',
  REQUIERE_DECLARACION_SALUD: 'REQUIERE_DECLARACION_SALUD',
  REQUIERE_INSPECCION: 'REQUIERE_INSPECCION',
} as const;
export type EmissionType = (typeof EmissionType)[keyof typeof EmissionType];

export const ProductStatus = {
  DRAFT: 'DRAFT',
  ACTUARIAL_REVIEW: 'ACTUARIAL_REVIEW',
  SUBMITTED_TO_SUDEASEG: 'SUBMITTED_TO_SUDEASEG',
  APPROVED_ACTIVE: 'APPROVED_ACTIVE',
  REJECTED: 'REJECTED',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const DeductibleType = {
  MONTO_FIJO: 'MONTO_FIJO',
  PORCENTAJE_SINIESTRO: 'PORCENTAJE_SINIESTRO',
  PORCENTAJE_SUMA_ASEGURADA: 'PORCENTAJE_SUMA_ASEGURADA',
} as const;
export type DeductibleType = (typeof DeductibleType)[keyof typeof DeductibleType];

export const UNIFORM_BRANCHES: ProductBranch[] = [
  ProductBranch.RCV_OBLIGATORIO,
  ProductBranch.INCLUSIVO,
];

export const RenewalFrequency = {
  ANUAL: 'ANUAL',
  SEMESTRAL: 'SEMESTRAL',
  TRIMESTRAL: 'TRIMESTRAL',
  MENSUAL: 'MENSUAL',
} as const;
export type RenewalFrequency = (typeof RenewalFrequency)[keyof typeof RenewalFrequency];

export const RenewalType = {
  NORMAL: 'NORMAL',
  TACITA: 'TACITA',
  CON_AVISO: 'CON_AVISO',
} as const;
export type RenewalType = (typeof RenewalType)[keyof typeof RenewalType];

export const IMMUTABLE_STATUSES: ProductStatus[] = [
  ProductStatus.SUBMITTED_TO_SUDEASEG,
  ProductStatus.APPROVED_ACTIVE,
];

export const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: [ProductStatus.ACTUARIAL_REVIEW],
  ACTUARIAL_REVIEW: [ProductStatus.SUBMITTED_TO_SUDEASEG, ProductStatus.DRAFT],
  SUBMITTED_TO_SUDEASEG: [ProductStatus.APPROVED_ACTIVE, ProductStatus.REJECTED],
  APPROVED_ACTIVE: [],
  REJECTED: [ProductStatus.DRAFT],
};
