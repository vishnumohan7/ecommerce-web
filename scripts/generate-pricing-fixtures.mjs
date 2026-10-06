import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const output = join(process.cwd(), 'fixtures/pricing');
mkdirSync(output, { recursive: true });

const allocate = (amount, ratios) => {
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  const shares = ratios.map((ratio) => Math.floor((amount * ratio) / total));
  for (
    let index = 0, remainder = amount - shares.reduce((sum, share) => sum + share, 0);
    remainder > 0;
    index = (index + 1) % shares.length, remainder -= 1
  )
    shares[index] += 1;
  return shares;
};

for (let index = 1; index <= 60; index += 1) {
  const standard = 199 + index * 7;
  const zero = 83 + index * 3;
  const fixed = index === 4 ? 1000 : index === 5 ? 999999 : index % 4 === 0 ? 250 : null;
  const percent = fixed === null ? (index === 6 ? 10000 : ((index % 5) + 1) * 500) : null;
  const bases = [standard * 2, zero * 3];
  const promotionDiscounts = [index === 11 ? standard : index === 12 ? 100 : 0, 0];
  const afterPromotions = bases.map((base, line) => base - promotionDiscounts[line]);
  const discount = Math.min(
    afterPromotions[0] + afterPromotions[1],
    fixed ?? Math.floor(((afterPromotions[0] + afterPromotions[1]) * percent) / 10000),
  );
  const shares = discount > 0 ? allocate(discount, afterPromotions) : [0, 0];
  const totals = afterPromotions.map((base, line) => base - shares[line]);
  const vat = Math.floor((totals[0] * 2000) / 12000);
  const deliveryFee =
    index === 7 ? 499 : index === 8 || index === 9 ? 0 : index % 3 === 0 ? 299 : 0;
  const name =
    index === 1
      ? 'mixed-zero-and-standard'
      : index === 4
        ? 'ten-pounds-across-two-lines'
        : index === 5
          ? 'discount-exceeds-subtotal'
          : index === 6
            ? 'one-hundred-percent-discount'
            : index === 7
              ? 'free-delivery-one-penny-under'
              : index === 8
                ? 'free-delivery-exact-threshold'
                : index === 9
                  ? 'free-delivery-one-penny-over'
                  : index === 10
                    ? 'variable-weight-estimate'
                    : `basket-${String(index).padStart(2, '0')}`;
  const fixture = {
    name,
    metadata: {
      couponClass: ['CUSTOMER_CREDIT', 'SITE_WIDE', 'INFLUENCER'][index % 3],
      variableWeightEstimate: index === 10,
      promotion: index === 11 ? 'MULTIBUY' : index === 12 ? 'THRESHOLD' : null,
    },
    input: {
      currency: 'GBP',
      taxRates: { STANDARD_20: 2000, REDUCED_5: 500, ZERO: 0, EXEMPT: 0 },
      lines: [
        {
          id: 'standard',
          productId: 'p-standard',
          categoryId: 'c-1',
          brandId: 'b-1',
          quantity: 2,
          unitPriceMinor: String(standard),
          promotionDiscountMinor: String(promotionDiscounts[0]),
          taxCategory: 'STANDARD_20',
          isAlcohol: index % 2 === 0,
        },
        {
          id: 'zero',
          productId: 'p-zero',
          categoryId: 'c-2',
          brandId: null,
          quantity: 3,
          unitPriceMinor: String(zero),
          taxCategory: 'ZERO',
          isAlcohol: false,
        },
      ],
      coupon: {
        type: fixed === null ? 'PERCENTAGE' : 'FIXED',
        valueBps: percent,
        valueMinor: fixed === null ? null : String(fixed),
        maximumDiscountMinor: null,
        appliesTo: 'BOTH',
        productIds: [],
        categoryIds: [],
        brandIds: [],
      },
      deliveryFeeMinor: String(deliveryFee),
    },
    expected: {
      subtotalMinor: String(bases[0] + bases[1]),
      couponDiscountMinor: String(discount),
      promotionDiscountMinor: String(promotionDiscounts[0] + promotionDiscounts[1]),
      deliveryFeeMinor: String(deliveryFee),
      taxMinor: String(vat),
      totalMinor: String(totals[0] + totals[1] + deliveryFee),
      lineCouponDiscounts: shares.map(String),
      lineTotals: totals.map(String),
    },
  };
  writeFileSync(
    join(output, `${String(index).padStart(2, '0')}-${name}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
  );
}
