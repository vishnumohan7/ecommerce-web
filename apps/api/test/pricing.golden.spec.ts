import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CouponAppliesTo, TaxCategory } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { calculatePricing } from '../src/modules/pricing/pricing.calculator';

type Fixture = {
  name: string;
  input: {
    currency: string;
    taxRates: Record<TaxCategory, number>;
    lines: Array<{
      id: string;
      productId: string;
      categoryId: string;
      brandId: string | null;
      quantity: number;
      unitPriceMinor: string;
      promotionDiscountMinor?: string;
      taxCategory: TaxCategory;
      isAlcohol: boolean;
    }>;
    coupon: {
      type: 'PERCENTAGE' | 'FIXED';
      valueBps: number | null;
      valueMinor: string | null;
      maximumDiscountMinor: string | null;
      appliesTo: CouponAppliesTo;
      productIds: string[];
      categoryIds: string[];
      brandIds: string[];
    };
    deliveryFeeMinor: string;
  };
  expected: {
    subtotalMinor: string;
    promotionDiscountMinor: string;
    couponDiscountMinor: string;
    deliveryFeeMinor: string;
    taxMinor: string;
    totalMinor: string;
    lineCouponDiscounts: string[];
    lineTotals: string[];
  };
};

const directory = resolve(process.cwd(), '../../fixtures/pricing');
const files = readdirSync(directory)
  .filter((file) => file.endsWith('.json'))
  .sort();

describe('pricing golden files', () => {
  it('contains at least 60 independently stored baskets', () =>
    expect(files.length).toBeGreaterThanOrEqual(60));
  for (const file of files) {
    const fixture = JSON.parse(readFileSync(resolve(directory, file), 'utf8')) as Fixture;
    it(fixture.name, () => {
      const result = calculatePricing({
        ...fixture.input,
        deliveryFeeMinor: BigInt(fixture.input.deliveryFeeMinor),
        lines: fixture.input.lines.map(({ promotionDiscountMinor, ...line }) => ({
          ...line,
          unitPriceMinor: BigInt(line.unitPriceMinor),
          ...(promotionDiscountMinor === undefined
            ? {}
            : { promotionDiscountMinor: BigInt(promotionDiscountMinor) }),
        })),
        coupon: {
          ...fixture.input.coupon,
          valueMinor:
            fixture.input.coupon.valueMinor === null
              ? null
              : BigInt(fixture.input.coupon.valueMinor),
          maximumDiscountMinor:
            fixture.input.coupon.maximumDiscountMinor === null
              ? null
              : BigInt(fixture.input.coupon.maximumDiscountMinor),
        },
      });
      expect({
        subtotalMinor: result.subtotalMinor.toString(),
        promotionDiscountMinor: result.promotionDiscountMinor.toString(),
        couponDiscountMinor: result.couponDiscountMinor.toString(),
        deliveryFeeMinor: result.deliveryFeeMinor.toString(),
        taxMinor: result.taxMinor.toString(),
        totalMinor: result.totalMinor.toString(),
        lineCouponDiscounts: result.lines.map((line) => line.couponDiscountMinor.toString()),
        lineTotals: result.lines.map((line) => line.totalMinor.toString()),
      }).toEqual(fixture.expected);
    });
  }
});
