import { z } from 'zod';
const abvSchema = z.string().regex(/^(?:100(?:\.0{1,2})?|\d{1,2}(?:\.\d{1,2})?)$/);
export const productInputSchema = z
  .object({
    categoryId: z.string().uuid(),
    brandId: z.string().uuid().nullable().optional(),
    sku: z.string().min(1).max(80),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().min(1).max(200),
    description: z.string().min(1),
    priceMinor: z.string().regex(/^\d+$/),
    currency: z.literal('GBP').default('GBP'),
    vatRateBps: z.number().int().min(0).max(10000),
    pricingMode: z.enum(['UNIT', 'WEIGHT_ESTIMATED']),
    pricePerKgMinor: z.string().regex(/^\d+$/).nullable().optional(),
    estimatedWeightGrams: z.number().int().positive().nullable().optional(),
    weightToleranceBps: z.number().int().min(0).max(10000).nullable().optional(),
    abv: abvSchema.nullable().optional(),
    alcoholType: z.enum(['BEER', 'WINE', 'SPIRITS', 'CIDER', 'OTHER']).nullable().optional(),
    weightGrams: z.number().int().positive().nullable().optional(),
    ageRestriction: z.number().int().min(0).max(100),
    restrictionReason: z.enum([
      'NONE',
      'ALCOHOL',
      'KNIFE',
      'TOBACCO',
      'VAPE',
      'SOLVENT',
      'ENERGY_DRINK',
      'LOTTERY',
      'RETAILER_POLICY',
    ]),
    returnPolicy: z.enum([
      'STANDARD_14_DAY',
      'PERISHABLE_EXEMPT',
      'AGE_RESTRICTED_RESTRICTED',
      'NON_RETURNABLE',
    ]),
    unitPriceDisplay: z.string().min(1),
    hfssStatus: z.enum(['NOT_IN_SCOPE', 'IN_SCOPE']),
    hfssCategory: z.string().nullable().optional(),
    dietaryTags: z.array(z.string()).default([]),
    allergens: z.array(z.string()).default([]),
    countryOfOrigin: z.string().length(2),
    storageType: z.enum(['AMBIENT', 'CHILLED', 'FROZEN']),
    shelfLifeDays: z.number().int().positive().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.pricingMode === 'WEIGHT_ESTIMATED' &&
      (!value.pricePerKgMinor ||
        !value.estimatedWeightGrams ||
        value.weightToleranceBps === null ||
        value.weightToleranceBps === undefined)
    )
      context.addIssue({
        code: 'custom',
        message: 'Variable-weight products require price, estimate, and tolerance',
      });
    if (value.restrictionReason === 'ALCOHOL' && value.ageRestriction < 18)
      context.addIssue({
        code: 'custom',
        message: 'Alcohol products require an age restriction of at least 18',
      });
  });
export type ProductInput = z.infer<typeof productInputSchema>;
export const variantInputSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  priceMinor: z.string().regex(/^\d+$/),
  currency: z.literal('GBP').default('GBP'),
  packSize: z.string().nullable().optional(),
  weightGrams: z.number().int().positive().nullable().optional(),
  abv: abvSchema.nullable().optional(),
  flavour: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.string()),
  warehouseId: z.string().uuid(),
  stockOnHand: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const categoryCreateSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
  position: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});
export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one category field is required');
export const brandCreateSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1).max(120),
});
export const brandUpdateSchema = brandCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one brand field is required');
export const attributeSetSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(120),
  definitions: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        label: z.string().trim().min(1).max(120),
        type: z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT']),
        required: z.boolean().default(false),
        options: z.array(z.string().min(1)).optional(),
      }),
    )
    .min(1),
});
export const attributeSetUpdateSchema = attributeSetSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one attribute-set field is required');
