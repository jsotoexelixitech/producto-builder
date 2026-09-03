import { z } from 'zod';
import { DeductibleType, PremiumCalculationType } from '../enums';

const premiumCalcEnum = z.enum([
  PremiumCalculationType.PRIMA_FIJA,
  PremiumCalculationType.TASA_PORCENTUAL,
]);

const deductibleEnum = z.enum([
  DeductibleType.MONTO_FIJO,
  DeductibleType.PORCENTAJE_SINIESTRO,
  DeductibleType.PORCENTAJE_SUMA_ASEGURADA,
]);

export const coverageSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().min(0).default(0),
    isBasicMandatory: z.boolean().default(false),
    insuredSumMin: z.number().positive().optional(),
    insuredSumMax: z.number().positive().optional(),
    insuredSumFixed: z.number().positive().optional(),
    deductibleType: deductibleEnum.optional(),
    deductibleValue: z.number().nonnegative().optional(),
    waitingPeriodDays: z.number().int().min(0).default(0),
    premiumCalculationType: premiumCalcEnum.default(PremiumCalculationType.PRIMA_FIJA),
    tariffPremium: z.number().nonnegative().optional(),
    tariffRate: z.number().min(0).max(100).optional(),
    subLimitPercent: z.number().min(0).max(100).optional(),
    accountingCode: z.string().max(30).optional(),
    vigenciaDesde: z.string().date().optional(),
    vigenciaHasta: z.string().date().optional(),
    dependsOnCoverageName: z.string().max(150).optional(),
    coberturaInternaCode: z.string().max(20).optional(),
    tarifaInternaCode: z.string().max(20).optional(),
    treatmentType: z.string().max(50).optional(),
    calculationService: z.string().max(50).optional(),
    reinsuranceContractCode: z.string().max(20).optional(),
    reinsuranceContractName: z.string().max(150).optional(),
    reinsuranceBranchCode: z.string().max(20).optional(),
  })
  .refine(
    (data) => {
      if (data.insuredSumMin != null && data.insuredSumMax != null) {
        return data.insuredSumMin <= data.insuredSumMax;
      }
      return true;
    },
    { message: 'La suma mínima no puede superar la máxima' },
  )
  .refine(
    (data) => {
      if (data.vigenciaDesde && data.vigenciaHasta) {
        return data.vigenciaDesde <= data.vigenciaHasta;
      }
      return true;
    },
    { message: 'La vigencia de cobertura inicio no puede ser posterior a fin' },
  );

export const coverageListSchema = z.array(coverageSchema).min(1);

export type CoverageInput = z.infer<typeof coverageSchema>;
