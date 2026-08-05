export type ProductStatus =
  | 'DRAFT'
  | 'ACTUARIAL_REVIEW'
  | 'SUBMITTED_TO_SUDEASEG'
  | 'APPROVED_ACTIVE'
  | 'REJECTED';

export type ProductBranch =
  | 'AUTOMOVIL'
  | 'SALUD'
  | 'VIDA'
  | 'PATRIMONIAL'
  | 'INCLUSIVO'
  | 'RCV_OBLIGATORIO';

export type RenewalFrequency = 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' | 'MENSUAL';
export type RenewalType = 'NORMAL' | 'TACITA' | 'CON_AVISO';

export interface Product {
  id: string;
  commercialName: string;
  internalCode: string;
  branch: ProductBranch;
  currency: string;
  emissionType: string;
  status: ProductStatus;
  simplifiedContract: boolean;
  uniformConditions: boolean;
  lockedGeneralConditions: boolean;
  numeroProvidenciaSudeaseg?: string | null;
  fechaGacetaAprobacion?: string | null;
  isImmutable: boolean;
  /** false = desactivado: no aparece en el catálogo de emisión (se puede reactivar). */
  catalogVisible?: boolean;
  subPlanCode?: string | null;
  vigenciaInicio?: string | null;
  vigenciaFin?: string | null;
  allowsQuickEmission?: boolean;
  renewalFrequency?: RenewalFrequency | null;
  renewalType?: RenewalType | null;
  premiumGuaranteeDays?: number | null;
  annualClosingMonth?: number | null;
  coverages?: Coverage[];
  actuarialData?: ActuarialData | null;
  exclusions?: Exclusion[];
  legalDocuments?: LegalDocument[];
  commercialChannels?: CommercialChannel[];
  formFields?: FormField[];
  requiredDocuments?: RequiredDocument[];
  productPlans?: ProductPlan[];
  flowStepConfigs?: FlowStepConfig[];
  stateHistory?: StateHistory[];
  sisipConfig?: SisipConfig | null;
  _count?: { exclusions: number; stateHistory: number };
}

export interface Coverage {
  id?: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isBasicMandatory: boolean;
  insuredSumMin?: number;
  insuredSumMax?: number;
  insuredSumFixed?: number;
  deductibleType?: string;
  deductibleValue?: number;
  waitingPeriodDays?: number;
  tariffPremium?: number;
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  dependsOnCoverageName?: string;
  coberturaInternaCode?: string;
  tarifaInternaCode?: string;
  treatmentType?: string;
  calculationService?: string;
  reinsuranceContractCode?: string;
  reinsuranceContractName?: string;
  reinsuranceBranchCode?: string;
}

export interface SisipConfig {
  ramoInternoCode?: string | null;
  ramoInternoName?: string | null;
  branchAlias1?: string | null;
  branchAlias2?: string | null;
  producerCode?: string | null;
  producerName?: string | null;
  assignToAllProducers?: boolean;
  counterCotizacion?: string;
  counterPoliza?: string;
  counterRecibo?: string;
  counterSiniestro?: string;
  maskPoliza?: string | null;
  maskRecibo?: string | null;
  maskSiniestro?: string | null;
}

export interface ActuarialData {
  purePremium: number;
  administrativeExpenses: number;
  commissions: number;
  profitMargin: number;
  commercialPremium: number;
  actuaryName: string;
  actuaryCedula: string;
  actuarySudeasegNumber: string;
  technicalNoteUrl?: string;
  ratingVariables?: RatingVariable[];
}

export type ActuarialInput = Omit<ActuarialData, 'commercialPremium'>;

export interface RatingVariable {
  name: string;
  label: string;
  variableType: string;
  required?: boolean;
  sortOrder?: number;
  options?: string[];
}

export interface Exclusion {
  text: string;
  sortOrder?: number;
  typographyHighlight: boolean;
}

export interface LegalDocument {
  documentType: string;
  title: string;
  content: string;
  isLocked?: boolean;
  isSimplifiedTemplate?: boolean;
}

export interface CommercialChannel {
  name: string;
  channelType: string;
}

export interface FormField {
  label: string;
  fieldType: string;
  required?: boolean;
  options?: string[];
  sortOrder?: number;
  stepKey?: string;
}

export interface FlowStepConfig {
  stepKey: string;
  label: string;
  shortLabel?: string | null;
  description?: string | null;
  enabled?: boolean;
  formEnabled?: boolean;
  sortOrder?: number;
}

export interface ProductPlan {
  name: string;
  description?: string | null;
  badge?: string | null;
  priceFactor?: number;
  isRecommended?: boolean;
  coverageIds?: string[] | null;
  coverageLabels?: string[] | null;
  sortOrder?: number;
  /** Tarifa por cobertura en este plan (id → prima). Si falta, usa la prima del paso Coberturas. */
  coverageTariffs?: Record<string, number>;
  /** false = plan visible en wizard pero no ofrecido al cliente */
  isActive?: boolean;
}

export interface RequiredDocument {
  documentKey: string;
  label: string;
  required?: boolean;
  sortOrder?: number;
}

export interface StateHistory {
  fromStatus?: ProductStatus | null;
  toStatus: ProductStatus;
  comment?: string | null;
  changedAt: string;
}

export interface GuardrailViolation {
  code: string;
  message: string;
}
