import { describe, expect, it } from 'vitest';
import { calculatePricing } from '../src/modules/pricing/pricing.calculator';

describe('pricing calculator', () => {
  it('allocates £10 exactly across three equal lines', () => {
    const result = calculatePricing({
      currency: 'GBP',
      taxRates: { STANDARD_20: 2000, REDUCED_5: 500, ZERO: 0, EXEMPT: 0 },
      lines: [1, 2, 3].map((number) => ({
        id: String(number),
        productId: String(number),
        categoryId: 'category',
        brandId: null,
        quantity: 1,
        unitPriceMinor: 1000n,
        taxCategory: 'ZERO' as const,
        isAlcohol: false,
      })),
      coupon: {
        type: 'FIXED',
        valueBps: null,
        valueMinor: 1000n,
        maximumDiscountMinor: null,
        appliesTo: 'BOTH',
        productIds: [],
        categoryIds: [],
        brandIds: [],
      },
    });
    expect(result.lines.map((line) => line.couponDiscountMinor)).toEqual([334n, 333n, 333n]);
    expect(result.couponDiscountMinor).toBe(1000n);
  });

  it('only discounts eligible grocery lines', () => {
    const result = calculatePricing({
      currency: 'GBP',
      taxRates: { STANDARD_20: 2000, REDUCED_5: 500, ZERO: 0, EXEMPT: 0 },
      lines: [
        {
          id: 'g',
          productId: 'g',
          categoryId: 'food',
          brandId: null,
          quantity: 1,
          unitPriceMinor: 1000n,
          taxCategory: 'ZERO',
          isAlcohol: false,
        },
        {
          id: 'a',
          productId: 'a',
          categoryId: 'wine',
          brandId: null,
          quantity: 1,
          unitPriceMinor: 1000n,
          taxCategory: 'STANDARD_20',
          isAlcohol: true,
        },
      ],
      coupon: {
        type: 'PERCENTAGE',
        valueBps: 1000,
        valueMinor: null,
        maximumDiscountMinor: null,
        appliesTo: 'GROCERY',
        productIds: [],
        categoryIds: [],
        brandIds: [],
      },
    });
    expect(result.lines.map((line) => line.couponDiscountMinor)).toEqual([100n, 0n]);
  });
});
