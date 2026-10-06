import { z } from 'zod';

export const pricingQuoteSchema = z.object({
  postcode: z.string().trim().min(2).max(12).optional(),
  couponCode: z.string().trim().min(1).max(80).optional(),
});

export const couponValidateSchema = z.object({ code: z.string().trim().min(1).max(80) });

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .transform((value) => value.toUpperCase()),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    valueBps: z.number().int().min(1).max(10_000).nullable().optional(),
    valueMinor: z.coerce.bigint().positive().nullable().optional(),
    currency: z.string().length(3).default('GBP'),
    minimumSpendMinor: z.coerce.bigint().nonnegative().nullable().optional(),
    maximumDiscountMinor: z.coerce.bigint().positive().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    maxUses: z.number().int().positive().nullable().optional(),
    couponClass: z.enum(['CUSTOMER_CREDIT', 'SITE_WIDE', 'INFLUENCER']).default('SITE_WIDE'),
    appliesTo: z.enum(['GROCERY', 'ALCOHOL', 'BOTH']).default('BOTH'),
    perCustomerLimit: z.number().int().positive().nullable().optional(),
    firstOrderOnly: z.boolean().default(false),
    productIds: z.array(z.string().uuid()).default([]),
    categoryIds: z.array(z.string().uuid()).default([]),
    brandIds: z.array(z.string().uuid()).default([]),
    influencerId: z.string().uuid().nullable().optional(),
    attributionWindowDays: z.number().int().min(1).max(365).default(30),
  })
  .superRefine((value, context) => {
    if (value.endsAt <= value.startsAt)
      context.addIssue({
        code: 'custom',
        message: 'endsAt must be after startsAt',
        path: ['endsAt'],
      });
    if (value.type === 'PERCENTAGE' && value.valueBps == null)
      context.addIssue({ code: 'custom', message: 'valueBps is required', path: ['valueBps'] });
    if (value.type === 'FIXED' && value.valueMinor == null)
      context.addIssue({ code: 'custom', message: 'valueMinor is required', path: ['valueMinor'] });
  });

export const couponUpdateSchema = z.object({
  type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  valueBps: z.number().int().min(1).max(10_000).nullable().optional(),
  valueMinor: z.coerce.bigint().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  minimumSpendMinor: z.coerce.bigint().nonnegative().nullable().optional(),
  maximumDiscountMinor: z.coerce.bigint().positive().nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  couponClass: z.enum(['CUSTOMER_CREDIT', 'SITE_WIDE', 'INFLUENCER']).optional(),
  appliesTo: z.enum(['GROCERY', 'ALCOHOL', 'BOTH']).optional(),
  perCustomerLimit: z.number().int().positive().nullable().optional(),
  firstOrderOnly: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  brandIds: z.array(z.string().uuid()).optional(),
  influencerId: z.string().uuid().nullable().optional(),
  attributionWindowDays: z.number().int().min(1).max(365).optional(),
  active: z.boolean().optional(),
});

export const couponRedeemSchema = z.object({
  code: z.string().trim().min(1).max(80),
  discountMinor: z.coerce.bigint().nonnegative(),
  orderId: z.string().uuid().optional(),
  orderRevenueMinor: z.coerce.bigint().nonnegative().optional(),
  orderTaxMinor: z.coerce.bigint().nonnegative().optional(),
  deliveryFeeMinor: z.coerce.bigint().nonnegative().optional(),
});

export const influencerCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toUpperCase()),
  displayName: z.string().trim().min(1).max(160),
  commissionBps: z.number().int().min(0).max(10_000),
  active: z.boolean().default(true),
});

export const taxRuleCreateSchema = z.object({
  taxCategory: z.enum(['STANDARD_20', 'REDUCED_5', 'ZERO', 'EXEMPT']),
  rateBps: z.number().int().min(0).max(10_000),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
  active: z.boolean().default(true),
});
