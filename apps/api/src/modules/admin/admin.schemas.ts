import { z } from 'zod';

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const reportFilterSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  couponId: z.string().uuid().optional(),
  basketType: z.enum(['GROCERY', 'ALCOHOL', 'MIXED']).optional(),
  paymentStatus: z
    .enum([
      'PENDING',
      'REQUIRES_ACTION',
      'AUTHORISED',
      'CAPTURED',
      'FAILED',
      'CANCELLED',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ])
    .optional(),
  fulfilmentStatus: z
    .enum([
      'PENDING',
      'CONFIRMED',
      'PICKING',
      'PICKED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'REFUSED',
      'CANCELLED',
    ])
    .optional(),
});

export const customerUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional(),
});

export const rolePermissionUpdateSchema = z.object({
  permissionKeys: z.array(z.string().trim().min(1)).max(100),
});

export const userRoleUpdateSchema = z.object({
  roleKeys: z.array(z.string().trim().min(1)).max(20),
});

export const settingsUpdateSchema = z.object({
  settings: z.record(z.string(), z.unknown()).optional(),
  integrations: z
    .object({
      email: z.object({
        provider: z.enum(['LOG', 'RESEND', 'SMTP']),
        fromName: z.string().trim().min(1).max(120),
        fromEmail: z.string().trim().email(),
        replyTo: z.string().trim().email().nullable().optional(),
        resendApiKey: z.string().trim().max(500).optional(),
        smtpHost: z.string().trim().max(255).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpSecure: z.boolean().default(true),
        smtpUsername: z.string().trim().max(255).optional(),
        smtpPassword: z.string().trim().max(500).optional(),
      }),
      socialLogin: z.object({
        googleEnabled: z.boolean().default(false),
        googleClientId: z.string().trim().max(500).optional(),
        googleClientSecret: z.string().trim().max(500).optional(),
        appleEnabled: z.boolean().default(false),
        appleClientId: z.string().trim().max(500).optional(),
        appleTeamId: z.string().trim().max(100).optional(),
        appleKeyId: z.string().trim().max(100).optional(),
        applePrivateKey: z.string().trim().max(10_000).optional(),
      }),
    })
    .optional(),
  branding: z
    .object({
      brandName: z.string().trim().min(1).max(160),
      legalEntityName: z.string().trim().min(1).max(200),
      companyNumber: z.string().trim().max(40).nullable().optional(),
      vatNumber: z.string().trim().max(40).nullable().optional(),
      registeredAddress: z.record(z.string(), z.unknown()),
      assets: z.record(z.string(), z.unknown()),
      colours: z.record(z.string(), z.unknown()),
      typography: z.record(z.string(), z.unknown()),
      emailBranding: z.record(z.string(), z.unknown()),
    })
    .optional(),
});

const optionalDate = z.preprocess((value) => value === '' || value == null ? null : value, z.coerce.date().nullable());
export const bannerCreateSchema = z.object({
  title: z.string().trim().min(1).max(160), subtitle: z.string().trim().max(300).nullable().optional(),
  imageUrl: z.string().url(), mobileImageUrl: z.string().url().nullable().optional(), linkUrl: z.string().url().nullable().optional(),
  position: z.number().int().nonnegative().default(0), startsAt: optionalDate.optional(), endsAt: optionalDate.optional(), active: z.boolean().default(true),
});
export const contentBlockCreateSchema = z.object({
  type: z.enum(['FEATURED_PRODUCTS','CATEGORY_TILES','PROMO_BLOCK']), title: z.string().trim().max(160).nullable().optional(),
  content: z.record(z.string(), z.unknown()), position: z.number().int().nonnegative().default(0), startsAt: optionalDate.optional(), endsAt: optionalDate.optional(), active: z.boolean().default(true),
});
export const cmsPageUpsertSchema = z.object({
  type: z.enum(['TERMS','PRIVACY','COOKIE','RETURNS','ALCOHOL_POLICY','DELIVERY_POLICY']), locale: z.string().min(2).max(20).default('en-GB'),
  title: z.string().trim().min(1).max(200), content: z.string().min(1).max(250_000), published: z.boolean().default(false),
});
