import { z } from 'zod';

export const exclusionSchema = z.object({
  text: z.string().min(10).max(2000),
  sortOrder: z.number().int().min(0).default(0),
  typographyHighlight: z.boolean().default(true),
});

export const exclusionListSchema = z
  .array(exclusionSchema)
  .min(1, 'Debe registrar al menos una exclusión contractual');

export const legalDocumentSchema = z.object({
  documentType: z.enum([
    'CONDICIONES_GENERALES',
    'CONDICIONES_PARTICULARES',
    'NOTA_TECNICA_ACTUARIAL',
    'POLIZA',
    'CUADRO_RECIBO',
  ]),
  title: z.string().min(3).max(200),
  content: z.string().min(10),
  isLocked: z.boolean().default(false),
  isSimplifiedTemplate: z.boolean().default(false),
});

export const commercialChannelSchema = z.object({
  name: z.string().min(2).max(120),
  channelType: z.string().min(2).max(80),
});

export const formFieldSchema = z.object({
  label: z.string().min(2).max(150),
  fieldType: z.enum(['TEXT', 'NUMBER', 'SELECT', 'DATE', 'BOOLEAN']),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const requiredDocumentSchema = z.object({
  documentKey: z.string().min(2).max(60),
  label: z.string().min(2).max(120),
  required: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type ExclusionInput = z.infer<typeof exclusionSchema>;
export type LegalDocumentInput = z.infer<typeof legalDocumentSchema>;
export type RequiredDocumentInput = z.infer<typeof requiredDocumentSchema>;
