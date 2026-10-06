# UK VAT and pricing

The commerce API displays consumer prices inclusive of VAT and stores money as integer minor units. `PricingService.calculate` is the sole arithmetic entry point. Its fixed order is:

1. line base values;
2. promotion discounts, including multibuy and minimum-spend thresholds;
3. basket coupon allocation with `Money.allocate` so remainder pennies are never lost;
4. one delivery charge;
5. VAT extraction per discounted line;
6. basket totals.

VAT is extracted from the discounted VAT-inclusive amount with the effective rate assigned to the product's tax category. Rates come from effective-dated `TaxRule` records and are never embedded as a decimal constant in application code. The supported categories are `STANDARD_20`, `REDUCED_5`, `ZERO`, and `EXEMPT`; administrators can schedule a replacement rule without rewriting historical pricing.

UK guidance says that most food is zero-rated, while alcoholic drinks, confectionery, and supplies of hot food are ordinarily standard-rated. Some goods and services use the reduced rate or are exempt. Product classification remains the merchant's responsibility and must be reviewed by a qualified adviser when facts are unclear.

Authoritative references:

- [VAT rates on different goods and services](https://www.gov.uk/guidance/vat-rates-on-different-goods-and-services)
- [VAT rates](https://www.gov.uk/vat-rates)

Coupon rules share one engine for customer credit, site-wide, and influencer coupons. They support fixed or percentage value, minimum spend, maximum discount, validity windows, global and per-customer limits, first-order restriction, product/category/brand scopes, and grocery/alcohol/both scope. The tenant setting `pricing.couponStackingPolicy` accepts `NONE`, `BEST_ONLY`, or `STACK`.

Coupon redemption locks its database row before testing and incrementing the global usage count. Influencer coupons link the coupon, redemption, optional order, revenue basis, and commission attribution. The default commission basis is order revenue net of VAT and delivery.
