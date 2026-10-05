import { z } from 'zod';

const optionalList = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
      : value,
  z.array(z.string().min(1)).optional(),
);
const optionalBoolean = z.preprocess(
  (value) => (value === undefined ? undefined : value === true || value === 'true'),
  z.boolean().optional(),
);
const optionalBigInt = z.preprocess(
  (value) =>
    value === undefined
      ? undefined
      : typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
        ? BigInt(value)
        : value,
  z.bigint().nonnegative().optional(),
);
const optionalDecimal = z
  .string()
  .regex(/^\d{1,3}(?:\.\d{1,2})?$/)
  .optional();

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  cursor: z.string().optional(),
  sort: z
    .enum(['relevance', 'price-asc', 'price-desc', 'name-asc', 'rating-desc'])
    .default('relevance'),
  category: optionalList,
  subcategory: optionalList,
  brand: optionalList,
  minPriceMinor: optionalBigInt,
  maxPriceMinor: optionalBigInt,
  inStock: optionalBoolean,
  dietary: optionalList,
  allergenFree: optionalList,
  alcohol: optionalBoolean,
  minAbv: optionalDecimal,
  maxAbv: optionalDecimal,
  storage: optionalList,
  minRatingBps: z.coerce.number().int().min(0).max(500).optional(),
  onOffer: optionalBoolean,
});

export const synonymSchema = z
  .object({
    terms: z
      .array(z.string().trim().min(1).max(80))
      .min(2)
      .max(10)
      .transform((terms) => [...new Set(terms.map((term) => term.toLowerCase()))]),
    enabled: z.boolean().default(true),
  })
  .refine((value) => value.terms.length >= 2, 'At least two distinct terms are required');
