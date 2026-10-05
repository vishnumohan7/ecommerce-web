import { z } from 'zod';

export const addCartItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(999),
});
export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().positive().max(999),
});
export const substitutionSchema = z.object({ preference: z.enum(['NO_SUB', 'SIMILAR', 'ANY']) });
export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toUpperCase()),
});
