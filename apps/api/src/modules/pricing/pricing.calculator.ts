import { Money } from '@app/money';
import type { CouponAppliesTo, TaxCategory } from '@prisma/client';

export type PricingLineInput = {
  id: string;
  productId: string;
  categoryId: string;
  brandId: string | null;
  quantity: number;
  unitPriceMinor: bigint;
  taxCategory: TaxCategory;
  isAlcohol: boolean;
  promotionDiscountMinor?: bigint;
};

export type CouponInput = {
  type: 'PERCENTAGE' | 'FIXED';
  valueBps: number | null;
  valueMinor: bigint | null;
  maximumDiscountMinor: bigint | null;
  appliesTo: CouponAppliesTo;
  productIds: string[];
  categoryIds: string[];
  brandIds: string[];
};

export type PricingCalculationInput = {
  currency: string;
  lines: PricingLineInput[];
  taxRates: Record<TaxCategory, number>;
  coupon?: CouponInput;
  deliveryFeeMinor?: bigint;
};

const min = (left: bigint, right: bigint) => (left < right ? left : right);

function couponEligible(line: PricingLineInput, coupon: CouponInput): boolean {
  if (coupon.appliesTo === 'ALCOHOL' && !line.isAlcohol) return false;
  if (coupon.appliesTo === 'GROCERY' && line.isAlcohol) return false;
  if (coupon.productIds.length > 0 && !coupon.productIds.includes(line.productId)) return false;
  if (coupon.categoryIds.length > 0 && !coupon.categoryIds.includes(line.categoryId)) return false;
  if (coupon.brandIds.length > 0 && (!line.brandId || !coupon.brandIds.includes(line.brandId)))
    return false;
  return true;
}

/** Pure penny-safe implementation used only through PricingService.calculate. */
export function calculatePricing(input: PricingCalculationInput) {
  const prepared = input.lines.map((line) => {
    const baseMinor = line.unitPriceMinor * BigInt(line.quantity);
    const promotionDiscountMinor = min(line.promotionDiscountMinor ?? 0n, baseMinor);
    return {
      line,
      baseMinor,
      promotionDiscountMinor,
      afterPromotionMinor: baseMinor - promotionDiscountMinor,
    };
  });
  const eligible = input.coupon
    ? prepared.filter(({ line }) => couponEligible(line, input.coupon as CouponInput))
    : [];
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.afterPromotionMinor, 0n);
  let couponDiscountMinor = 0n;
  if (input.coupon && eligibleSubtotal > 0n) {
    couponDiscountMinor =
      input.coupon.type === 'PERCENTAGE'
        ? (eligibleSubtotal * BigInt(input.coupon.valueBps ?? 0)) / 10_000n
        : (input.coupon.valueMinor ?? 0n);
    couponDiscountMinor = min(couponDiscountMinor, eligibleSubtotal);
    if (input.coupon.maximumDiscountMinor !== null)
      couponDiscountMinor = min(couponDiscountMinor, input.coupon.maximumDiscountMinor);
  }
  const allocated =
    eligible.length > 0 && couponDiscountMinor > 0n
      ? Money.of(couponDiscountMinor, input.currency).allocate(
          eligible.map((line) => line.afterPromotionMinor),
        )
      : [];
  const allocations = new Map(
    eligible.map((line, index) => [line.line.id, allocated[index]?.minor ?? 0n]),
  );
  const lines = prepared.map(({ line, baseMinor, promotionDiscountMinor, afterPromotionMinor }) => {
    const lineCouponMinor = allocations.get(line.id) ?? 0n;
    const totalMinor = afterPromotionMinor - lineCouponMinor;
    const rateBps = input.taxRates[line.taxCategory];
    // UK retail prices are VAT-inclusive. Extract the VAT share from the discounted gross value.
    const vatMinor = rateBps === 0 ? 0n : (totalMinor * BigInt(rateBps)) / BigInt(10_000 + rateBps);
    return {
      id: line.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      baseMinor,
      promotionDiscountMinor,
      couponDiscountMinor: lineCouponMinor,
      discountMinor: promotionDiscountMinor + lineCouponMinor,
      taxCategory: line.taxCategory,
      taxRateBps: rateBps,
      vatMinor,
      totalMinor,
      isAlcohol: line.isAlcohol,
    };
  });
  const subtotalMinor = prepared.reduce((sum, line) => sum + line.baseMinor, 0n);
  const promotionDiscountMinor = prepared.reduce(
    (sum, line) => sum + line.promotionDiscountMinor,
    0n,
  );
  const taxMinor = lines.reduce((sum, line) => sum + line.vatMinor, 0n);
  const deliveryFeeMinor = input.deliveryFeeMinor ?? 0n;
  const grocerySubtotalMinor = lines
    .filter((line) => !line.isAlcohol)
    .reduce((sum, line) => sum + line.baseMinor, 0n);
  const alcoholSubtotalMinor = lines
    .filter((line) => line.isAlcohol)
    .reduce((sum, line) => sum + line.baseMinor, 0n);
  return {
    currency: input.currency,
    lines,
    subtotalMinor,
    grocerySubtotalMinor,
    alcoholSubtotalMinor,
    promotionDiscountMinor,
    couponDiscountMinor,
    discountMinor: promotionDiscountMinor + couponDiscountMinor,
    deliveryFeeMinor,
    taxMinor,
    totalMinor: subtotalMinor - promotionDiscountMinor - couponDiscountMinor + deliveryFeeMinor,
  };
}
