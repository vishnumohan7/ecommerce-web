import { z } from 'zod';

const ukPostcode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/, 'A valid UK postcode is required');

export const profileUpdateSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    phone: z.string().trim().min(7).max(30).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field is required');

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  line1: z.string().trim().min(2).max(160),
  line2: z.string().trim().max(160).nullable().optional(),
  city: z.string().trim().min(2).max(100),
  postcode: ukPostcode,
  country: z.string().trim().length(2).toUpperCase().default('GB'),
  isDefault: z.boolean().default(false),
});

export const addressUpdateSchema = addressSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one address field is required');

export const wishlistItemSchema = z.object({
  productId: z.string().uuid(),
});

export const moveWishlistItemSchema = z.object({
  quantity: z.number().int().positive().max(99).default(1),
});

export const reviewCreateSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  body: z.string().trim().min(3).max(4000),
  imageUrls: z.array(z.string().url()).max(5).default([]),
});

export const reviewUpdateSchema = reviewCreateSchema
  .omit({ productId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one review field is required');

export const reviewModerationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).nullable().optional(),
});
