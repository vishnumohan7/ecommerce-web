import { z } from 'zod';

export const fulfilmentTransitionSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PICKING',
    'PICKED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'REFUSED',
    'CANCELLED',
  ]),
});

export const orderListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  basketType: z.enum(['GROCERY', 'ALCOHOL', 'MIXED']).optional(),
  paymentStatus: z.string().optional(),
  fulfilmentStatus: z.string().optional(),
  ageVerificationStatus: z.string().optional(),
  deliveryAgeCheckStatus: z.string().optional(),
  search: z.string().trim().max(120).optional(),
});

export const deliveryAgeCheckSchema = z.object({
  orderId: z.string().uuid(),
  outcome: z.enum(['PASSED', 'FAILED', 'REFUSED']),
  challengeAge: z.number().int().min(18).max(100).default(25),
  idType: z.enum(['PASSPORT', 'DRIVING_LICENCE', 'PASS_CARD', 'DIGITAL_DVS', 'OTHER']).optional(),
  recipientPresent: z.boolean(),
  refusalReason: z.string().trim().max(300).optional(),
  note: z.string().trim().max(1000).optional(),
  latitude: z
    .string()
    .regex(/^-?\d{1,2}(?:\.\d{1,6})?$/)
    .optional(),
  longitude: z
    .string()
    .regex(/^-?(?:1[0-7]\d|\d{1,2})(?:\.\d{1,6})?$/)
    .optional(),
  doorstepPhotoUrl: z.string().url().optional(),
});

export const pickItemSchema = z.object({
  outcome: z.enum(['PICKED', 'SHORT', 'SUBSTITUTED']),
  picked: z.number().int().nonnegative(),
  substituteProductId: z.string().uuid().optional(),
  actualWeightGrams: z.number().int().positive().optional(),
});
