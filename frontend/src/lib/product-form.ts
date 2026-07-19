import { createProductSchema } from '@ipb/shared';
import type { ProductBranch } from '@/types/product';

export type CoreFormInput = {
  commercialName: string;
  internalCode: string;
  branch: ProductBranch;
  currency: 'VES' | 'USD' | 'INDEXADO';
  emissionType:
    | 'EMISION_GARANTIZADA'
    | 'REQUIERE_DECLARACION_SALUD'
    | 'REQUIERE_INSPECCION';
  subPlanCode: string;
  vigenciaInicio: string;
  vigenciaFin: string;
  allowsQuickEmission: boolean;
  renewalFrequency: 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' | 'MENSUAL';
  renewalType: 'NORMAL' | 'TACITA' | 'CON_AVISO';
  premiumGuaranteeDays: number;
  annualClosingMonth: number;
};

export function generateDefaultInternalCode(): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `PROD-${stamp}`;
}

export function normalizeInternalCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 50);
}

export function normalizeCommercialName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

const FIELD_LABELS: Record<string, string> = {
  commercialName: 'Nombre comercial',
  internalCode: 'Código interno',
  branch: 'Ramo',
  currency: 'Moneda',
  emissionType: 'Tipo de emisión',
};

export function validateCoreForm(data: CoreFormInput): {
  valid: boolean;
  fieldErrors: Partial<Record<keyof CoreFormInput, string>>;
  message?: string;
} {
  const payload = {
    commercialName: normalizeCommercialName(data.commercialName),
    internalCode: normalizeInternalCode(data.internalCode),
    branch: data.branch,
    currency: data.currency,
    emissionType: data.emissionType,
    subPlanCode: data.subPlanCode || undefined,
    vigenciaInicio: data.vigenciaInicio || undefined,
    vigenciaFin: data.vigenciaFin || undefined,
    allowsQuickEmission: data.allowsQuickEmission,
    renewalFrequency: data.renewalFrequency,
    renewalType: data.renewalType,
    premiumGuaranteeDays: data.premiumGuaranteeDays,
    annualClosingMonth: data.annualClosingMonth,
  };

  const result = createProductSchema.safeParse(payload);
  if (result.success) {
    return { valid: true, fieldErrors: {} };
  }

  const fieldErrors: Partial<Record<keyof CoreFormInput, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof CoreFormInput;
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  const message = result.error.issues
    .map((issue) => {
      const field = FIELD_LABELS[String(issue.path[0])] ?? String(issue.path[0]);
      return `${field}: ${issue.message}`;
    })
    .join('. ');

  return { valid: false, fieldErrors, message };
}

export function prepareCoreFormForSubmit(data: CoreFormInput): CoreFormInput {
  return {
    ...data,
    commercialName: normalizeCommercialName(data.commercialName),
    internalCode: normalizeInternalCode(data.internalCode),
  };
}
