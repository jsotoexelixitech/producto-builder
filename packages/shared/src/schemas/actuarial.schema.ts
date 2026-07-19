import { z } from 'zod';

export const ratingVariableSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(2).max(120),
  variableType: z.enum(['TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN']),
  required: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  options: z.array(z.string()).optional(),
});

export const actuarialDataSchema = z
  .object({
    purePremium: z.number().positive(),
    administrativeExpenses: z.number().min(0).max(99.99),
    commissions: z.number().min(0).max(99.99),
    profitMargin: z.number().min(0).max(99.99),
    actuaryName: z.string().min(3).max(150),
    actuaryCedula: z.string().min(5).max(20),
    actuarySudeasegNumber: z
      .string()
      .min(4)
      .regex(/^[A-Z0-9-]+$/, 'Número de registro SUDEASEG inválido'),
    technicalNoteUrl: z.string().url().optional().or(z.literal('')),
    ratingVariables: z.array(ratingVariableSchema).default([]),
  })
  .refine(
    (data) =>
      data.administrativeExpenses + data.commissions + data.profitMargin < 100,
    {
      message:
        'La suma de gastos administrativos + comisiones + utilidad debe ser menor al 100%',
      path: ['profitMargin'],
    },
  );

export function calculateCommercialPremium(
  purePremium: number,
  administrativeExpenses: number,
  commissions: number,
  profitMargin: number,
): number {
  const divisor = 1 - administrativeExpenses / 100 - commissions / 100 - profitMargin / 100;
  if (divisor <= 0) {
    throw new Error('Factor de recargo inválido: divisor <= 0');
  }
  return purePremium / divisor;
}

export type ActuarialDataInput = z.infer<typeof actuarialDataSchema>;
