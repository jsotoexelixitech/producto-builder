import { ProductBranch } from '../enums';

export interface SubmissionGuardrailContext {
  branch: ProductBranch;
  actuarySudeasegNumber: string | null | undefined;
  exclusions: Array<{ text: string; typographyHighlight: boolean }>;
  coverages: Array<{ isBasicMandatory: boolean }>;
  administrativeExpenses: number;
  commissions: number;
  profitMargin: number;
  commercialChannels: Array<{ name: string }>;
  hasSimplifiedTemplate: boolean;
}

export interface GuardrailViolation {
  code: string;
  message: string;
}

export function validateSubmissionGuardrails(
  ctx: SubmissionGuardrailContext,
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  if (!ctx.actuarySudeasegNumber?.trim()) {
    violations.push({
      code: 'ACTUARY_REQUIRED',
      message:
        'El producto debe tener un actuario con número de registro SUDEASEG válido asignado.',
    });
  }

  if (
    ctx.exclusions.length === 0 ||
    !ctx.exclusions.every((e) => e.typographyHighlight)
  ) {
    violations.push({
      code: 'EXCLUSIONS_HIGHLIGHT',
      message:
        'Debe registrar exclusiones y activar el resalte tipográfico obligatorio (Reglamento Art. 68).',
    });
  }

  if (!ctx.coverages.some((c) => c.isBasicMandatory)) {
    violations.push({
      code: 'MANDATORY_COVERAGE',
      message:
        'Debe existir al menos una cobertura con is_basic_mandatory = true.',
    });
  }

  const loadSum =
    ctx.administrativeExpenses + ctx.commissions + ctx.profitMargin;
  if (loadSum >= 100) {
    violations.push({
      code: 'LOAD_FACTOR_INVALID',
      message:
        'La suma de gastos administrativos + comisiones + margen de utilidad debe ser menor al 100%.',
    });
  }

  if (ctx.branch === ProductBranch.INCLUSIVO) {
    if (ctx.commercialChannels.length === 0) {
      violations.push({
        code: 'INCLUSIVO_CHANNEL',
        message:
          'Ramo INCLUSIVO: debe asociar al menos un canal alternativo de comercialización.',
      });
    }
    if (!ctx.hasSimplifiedTemplate) {
      violations.push({
        code: 'INCLUSIVO_TEMPLATE',
        message:
          'Ramo INCLUSIVO: la plantilla documental debe ser de tipo Simplificada.',
      });
    }
  }

  return violations;
}
