import { z } from 'zod';

export const sisipConfigSchema = z.object({
  ramoInternoCode: z.string().max(20).optional(),
  ramoInternoName: z.string().max(150).optional(),
  branchAlias1: z.string().max(50).optional(),
  branchAlias2: z.string().max(50).optional(),
  producerCode: z.string().max(50).optional(),
  producerName: z.string().max(150).optional(),
  assignToAllProducers: z.boolean().default(false),
  counterCotizacion: z.string().max(30).default('COTIZACION'),
  counterPoliza: z.string().max(30).default('POLIZA'),
  counterRecibo: z.string().max(30).default('RECIBO'),
  counterSiniestro: z.string().max(30).default('SINIESTRO'),
  maskPoliza: z.string().max(200).optional(),
  maskRecibo: z.string().max(200).optional(),
  maskSiniestro: z.string().max(200).optional(),
});

export type SisipConfigInput = z.infer<typeof sisipConfigSchema>;
