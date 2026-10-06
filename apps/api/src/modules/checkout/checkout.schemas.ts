import { z } from 'zod';

export const addressSchema = z.object({
  line1: z.string().trim().min(1).max(160),
  line2: z.string().trim().max(160).optional(),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(2).max(12),
  country: z.literal('GB').default('GB'),
});

export const guestDetailsSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().email(),
  phone: z.string().trim().min(7).max(30),
});

export const checkoutValidateSchema = z
  .object({
    deliveryPostcode: z.string().trim().min(2).max(12).optional(),
    deliveryAddress: addressSchema.optional(),
    deliverySlotId: z.string().uuid().optional(),
    couponCode: z.string().trim().min(1).max(80).optional(),
  })
  .transform((value) => ({
    ...value,
    deliveryAddress: value.deliveryAddress ?? {
      line1: 'Address supplied later',
      city: 'Unknown',
      postcode: value.deliveryPostcode as string,
      country: 'GB' as const,
    },
  }))
  .refine((value) => Boolean(value.deliveryAddress.postcode), {
    message: 'A delivery address or deliveryPostcode is required',
  });

export const checkoutSessionCreateSchema = z.object({
  deliveryAddress: addressSchema,
  deliverySlotId: z.string().uuid(),
  couponCode: z.string().trim().min(1).max(80).optional(),
  guest: guestDetailsSchema.optional(),
});
