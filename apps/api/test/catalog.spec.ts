import { describe, expect, it } from 'vitest';
import { productInputSchema, variantInputSchema } from '../src/modules/catalog/catalog.schemas';

const product = {
  categoryId: '10000000-0000-4000-8000-000000000001',
  sku: 'ALE-001', slug: 'british-ale', name: 'British Ale', description: 'Bottle-conditioned ale',
  priceMinor: '299', currency: 'GBP' as const, vatRateBps: 1667, pricingMode: 'UNIT' as const,
  ageRestriction: 18, restrictionReason: 'ALCOHOL' as const, abv: '4.50',
  returnPolicy: 'AGE_RESTRICTED_RESTRICTED' as const, unitPriceDisplay: '£2.99 each',
  hfssStatus: 'NOT_IN_SCOPE' as const, dietaryTags: ['vegan'], allergens: ['barley'],
  countryOfOrigin: 'GB', storageType: 'AMBIENT' as const,
};

describe('catalog validation', () => {
  it('keeps age restriction independent of ABV', () => {
    expect(productInputSchema.parse({ ...product, abv: '0.00' }).ageRestriction).toBe(18);
    expect(productInputSchema.safeParse({ ...product, ageRestriction: 0 }).success).toBe(false);
  });

  it('requires every variable-weight pricing input', () => {
    expect(productInputSchema.safeParse({ ...product, pricingMode: 'WEIGHT_ESTIMATED' }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...product, pricingMode: 'WEIGHT_ESTIMATED', pricePerKgMinor: '550', estimatedWeightGrams: 500, weightToleranceBps: 1000 }).success).toBe(true);
  });

  it('validates variant SKU, price and attributes', () => {
    expect(variantInputSchema.parse({ sku: 'ALE-001-6', name: 'Six pack', priceMinor: '1599', packSize: '6 x 330ml', abv: '4.50', flavour: 'malt', attributes: { packSize: '6', flavour: 'malt' }, warehouseId: '10000000-0000-4000-8000-000000000002', stockOnHand: 20 }).sku).toBe('ALE-001-6');
  });
});
