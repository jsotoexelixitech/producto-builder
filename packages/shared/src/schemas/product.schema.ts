import { z } from 'zod';
import {
  ContractCurrency,
  EmissionType,
  ProductBranch,
  ProductStatus,
  RenewalFrequency,
  RenewalType,
} from '../enums';

const branchEnum = z.enum([
  ProductBranch.AUTOMOVIL,
  ProductBranch.SALUD,
  ProductBranch.VIDA,
  ProductBranch.PATRIMONIAL,
  ProductBranch.INCLUSIVO,
  ProductBranch.RCV_OBLIGATORIO,
]);

const currencyEnum = z.enum([
  ContractCurrency.VES,
  ContractCurrency.USD,
  ContractCurrency.INDEXADO,
]);

const emissionEnum = z.enum([
  EmissionType.EMISION_GARANTIZADA,
  EmissionType.REQUIERE_DECLARACION_SALUD,
  EmissionType.REQUIERE_INSPECCION,
]);

const renewalFrequencyEnum = z.enum([
  RenewalFrequency.ANUAL,
  RenewalFrequency.SEMESTRAL,
  RenewalFrequency.TRIMESTRAL,
  RenewalFrequency.MENSUAL,
]);

const renewalTypeEnum = z.enum([
  RenewalType.NORMAL,
  RenewalType.TACITA,
  RenewalType.CON_AVISO,
]);

const planFieldsSchema = z.object({
  subPlanCode: z.string().max(50).optional(),
  vigenciaInicio: z.string().date().optional(),
  vigenciaFin: z.string().date().optional(),
  allowsQuickEmission: z.boolean().optional(),
  renewalFrequency: renewalFrequencyEnum.optional(),
  renewalType: renewalTypeEnum.optional(),
  premiumGuaranteeDays: z.number().int().min(0).max(365).optional(),
  annualClosingMonth: z.number().int().min(1).max(12).optional(),
});

export const createProductSchema = z
  .object({
    commercialName: z.string().min(3, 'Mínimo 3 caracteres').max(200),
    internalCode: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(50)
      .regex(/^[A-Z0-9_-]+$/, 'Solo mayúsculas, números, guiones y guiones bajos'),
    branch: branchEnum,
    currency: currencyEnum,
    emissionType: emissionEnum,
  })
  .merge(planFieldsSchema)
  .refine(
    (data) => {
      if (data.vigenciaInicio && data.vigenciaFin) {
        return data.vigenciaInicio <= data.vigenciaFin;
      }
      return true;
    },
    { message: 'La vigencia de inicio no puede ser posterior a la de fin' },
  );

const productBaseSchema = z
  .object({
    commercialName: z.string().min(3, 'Mínimo 3 caracteres').max(200),
    internalCode: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(50)
      .regex(/^[A-Z0-9_-]+$/, 'Solo mayúsculas, números, guiones y guiones bajos'),
    branch: branchEnum,
    currency: currencyEnum,
    emissionType: emissionEnum,
  })
  .merge(planFieldsSchema);

export const updateProductSchema = productBaseSchema.partial();

export const approveProductSchema = z.object({
  numeroProvidenciaSudeaseg: z
    .string()
    .min(5)
    .regex(/^[A-Z0-9/-]+$/, 'Formato de providencia SUDEASEG inválido'),
  fechaGacetaAprobacion: z.string().datetime().or(z.string().date()),
});

export const productStatusEnum = z.enum([
  ProductStatus.DRAFT,
  ProductStatus.ACTUARIAL_REVIEW,
  ProductStatus.SUBMITTED_TO_SUDEASEG,
  ProductStatus.APPROVED_ACTIVE,
  ProductStatus.REJECTED,
]);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ApproveProductInput = z.infer<typeof approveProductSchema>;
