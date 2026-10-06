import { z } from 'zod';

export const dobDeclarationSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const providerSessionSchema = z.object({
  provider: z.enum(['STUB', 'YOTI', 'MANUAL_REVIEW']),
  returnUrl: z.string().url().optional(),
  postcode: z.string().min(2).max(12).optional(),
  testDateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const checkoutValidationSchema = z.object({
  deliveryPostcode: z.string().min(2).max(12),
});
