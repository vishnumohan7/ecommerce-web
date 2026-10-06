import { z } from 'zod';

const money = z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const optionalMoney = money.nullable().optional();
const feeTier = z.object({
  minimumSubtotalMinor: money,
  maximumSubtotalMinor: money.nullable().optional(),
  groceryFeeMinor: money,
  alcoholFeeMinor: money,
});

export const deliveryZoneSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_-]+$/),
  name: z.string().trim().min(2).max(120),
  postcodePatterns: z.array(z.string().trim().min(1).max(10)).min(1).max(100),
  postcodeIncludes: z.array(z.string().trim().min(2).max(10)).max(100).default([]),
  postcodeExcludes: z.array(z.string().trim().min(2).max(10)).max(100).default([]),
  groceryFeeMinor: money,
  alcoholFeeMinor: money,
  freeDeliveryThresholdMinor: optionalMoney,
  minimumOrderMinor: optionalMoney,
  maximumOrderMinor: optionalMoney,
  alcoholMinimumSubtotalMinor: optionalMoney,
  feeSchedule: z.array(feeTier).max(50).default([]),
  supportedStorageTypes: z.array(z.enum(['AMBIENT', 'CHILLED', 'FROZEN'])).min(1),
  currency: z.string().length(3).default('GBP'),
  alcoholDeliveryAllowed: z.boolean().default(true),
  active: z.boolean().default(true),
});

export const deliveryZoneUpdateSchema = deliveryZoneSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const deliverySlotSchema = z
  .object({
    zoneId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    capacity: z.number().int().positive().max(100_000),
    surchargeMinor: money.default(0),
    cutoffMinutes: z.number().int().nonnegative().max(10_080).default(120),
    allowsAgeRestricted: z.boolean().default(true),
    active: z.boolean().default(true),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: 'Slot end must be after its start',
    path: ['endsAt'],
  });

export const deliverySlotUpdateSchema = z
  .object({
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    capacity: z.number().int().positive().max(100_000).optional(),
    surchargeMinor: money.optional(),
    cutoffMinutes: z.number().int().nonnegative().max(10_080).optional(),
    allowsAgeRestricted: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const reserveSlotSchema = z.object({ postcode: z.string().trim().min(2).max(12) });
