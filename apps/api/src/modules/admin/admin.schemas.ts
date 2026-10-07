import { z } from 'zod';

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
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
