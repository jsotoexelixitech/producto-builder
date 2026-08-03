import { actuarialDataSchema, createProductSchema } from '@ipb/shared';
import type { ProductBranch, RatingVariable } from '@/types/product';
import { validateCedulaField, normalizeCedula } from '@/lib/cedula';
import { clampText, FIELD_LIMITS } from '@/lib/field-limits';

export type ActuarialFormInput = {
  purePremium: number;
  administrativeExpenses: number;
  commissions: number;
  profitMargin: number;
  actuaryName: string;
  actuaryCedula: string;
  actuarySudeasegNumber: string;
  technicalNoteUrl: string;
  ratingVariables: RatingVariable[];
};

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

export function normalizeActuarySudeasegNumber(value: string): string {
  return clampText(
    value
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '-')
      .replace(/[^A-Z0-9-]/g, ''),
    FIELD_LIMITS.actuarial.actuarySudeasegNumber,
  );
}

const ACTUARIAL_FIELD_LABELS: Record<string, string> = {
  purePremium: 'Prima pura',
  administrativeExpenses: 'Gastos administrativos',
  commissions: 'Comisiones',
  profitMargin: 'Utilidad',
  actuaryName: 'Nombre del actuario',
  actuaryCedula: 'Cédula del actuario',
  actuarySudeasegNumber: 'Registro SUDEASEG',
  technicalNoteUrl: 'URL nota técnica',
};

function actuarialIssueMessage(issue: { path: (string | number)[]; message: string }): string {
  const key = String(issue.path[0] ?? '');
  if (key === 'actuaryName' && issue.message.includes('3')) {
    return 'Debe tener al menos 3 caracteres.';
  }
  if (key === 'actuaryCedula' && issue.message.includes('5')) {
    return 'Debe tener al menos 5 caracteres.';
  }
  if (key === 'actuaryCedula') {
    return 'Formato: V-12345678 (letra V, E, J, G o P, guion y 6 a 9 dígitos).';
  }
  if (key === 'actuarySudeasegNumber') {
    return 'Solo mayúsculas, números y guiones (ej. ACT-2024-001).';
  }
  if (issue.message.includes('divisor') || issue.message.includes('100%')) {
    return 'La suma de gastos + comisiones + utilidad debe ser menor al 100%.';
  }
  return issue.message;
}

export function validateActuarialForm(data: ActuarialFormInput): {
  valid: boolean;
  fieldErrors: Partial<Record<keyof ActuarialFormInput, string>>;
  message?: string;
} {
  const variables = data.ratingVariables ?? [];
  const payload = {
    purePremium: Number(data.purePremium),
    administrativeExpenses: Number(data.administrativeExpenses),
    commissions: Number(data.commissions),
    profitMargin: Number(data.profitMargin),
    actuaryName: normalizeCommercialName(data.actuaryName),
    actuaryCedula: normalizeCedula(data.actuaryCedula.trim()),
    actuarySudeasegNumber: normalizeActuarySudeasegNumber(data.actuarySudeasegNumber),
    technicalNoteUrl: data.technicalNoteUrl.trim() || undefined,
    ratingVariables: variables.map((v, i) => ({
      name: v.name,
      label: v.label,
      variableType: v.variableType,
      required: v.required ?? true,
      sortOrder: v.sortOrder ?? i,
      options: v.options,
    })),
  };

  const result = actuarialDataSchema.safeParse(payload);
  if (result.success) {
    const cedulaError = validateCedulaField(data.actuaryCedula);
    if (cedulaError) {
      return {
        valid: false,
        fieldErrors: { actuaryCedula: cedulaError },
        message: `Cédula del actuario: ${cedulaError}`,
      };
    }
    return { valid: true, fieldErrors: {} };
  }

  const fieldErrors: Partial<Record<keyof ActuarialFormInput, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ActuarialFormInput;
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = actuarialIssueMessage(issue);
    }
  }

  const message = result.error.issues
    .map((issue) => {
      const field = ACTUARIAL_FIELD_LABELS[String(issue.path[0])] ?? String(issue.path[0]);
      return `${field}: ${actuarialIssueMessage(issue)}`;
    })
    .join('. ');

  return { valid: false, fieldErrors, message };
}

export function prepareActuarialForSubmit(data: ActuarialFormInput): ActuarialFormInput {
  return {
    ...data,
    actuaryName: normalizeCommercialName(data.actuaryName),
    actuaryCedula: normalizeCedula(data.actuaryCedula.trim()),
    actuarySudeasegNumber: normalizeActuarySudeasegNumber(data.actuarySudeasegNumber),
    technicalNoteUrl: data.technicalNoteUrl.trim(),
    ratingVariables: data.ratingVariables ?? [],
  };
}
