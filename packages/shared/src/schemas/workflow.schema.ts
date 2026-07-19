import { z } from 'zod';
import { ProductStatus } from '../enums';

export const transitionStatusSchema = z.object({
  toStatus: z.enum([
    ProductStatus.ACTUARIAL_REVIEW,
    ProductStatus.SUBMITTED_TO_SUDEASEG,
    ProductStatus.APPROVED_ACTIVE,
    ProductStatus.REJECTED,
    ProductStatus.DRAFT,
  ]),
  comment: z.string().max(500).optional(),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
