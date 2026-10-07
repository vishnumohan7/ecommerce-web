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
