import { describe, expect, it } from 'vitest';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { StubPaymentProvider } from '../src/modules/payments/payment.providers';

describe('returns and refunds', () => {
  it('unwinds allocated basket discount and VAT to the penny across partial quantities', () => {
    const pricing = new PricingService({} as never, {} as never, {} as never);
    const first = pricing.calculateRefund(
      { quantity: 3, lineTotalMinor: 787n, vatAmountMinor: 131n, discountMinor: 213n },
      1,
    );
    const remainder = pricing.calculateRefund(
      { quantity: 3, lineTotalMinor: 787n, vatAmountMinor: 131n, discountMinor: 213n },
      2,
      1,
    );
    expect(first).toMatchObject({
      amountMinor: 263n,
      vatPortionMinor: 44n,
      discountPortionMinor: 71n,
    });
    expect(first.amountMinor + remainder.amountMinor).toBe(787n);
    expect(first.vatPortionMinor + remainder.vatPortionMinor).toBe(131n);
    expect(first.discountPortionMinor + remainder.discountPortionMinor).toBe(213n);
  });

  it('rejects refund quantities beyond the remaining ordered quantity', () => {
    const pricing = new PricingService({} as never, {} as never, {} as never);
    expect(() =>
      pricing.calculateRefund(
        { quantity: 2, lineTotalMinor: 500n, vatAmountMinor: 83n, discountMinor: 0n },
        2,
        1,
      ),
    ).toThrow('Refund quantity exceeds');
  });

  it('provides an idempotency-compatible partial-refund provider adapter', async () => {
    const provider = new StubPaymentProvider();
    const result = await provider.refundIntent('pi_test', 499n, 'refund-key');
    expect(result).toMatchObject({ status: 'succeeded', amountMinor: 499n });
    expect(provider.refundCalls).toBe(1);
  });
});
