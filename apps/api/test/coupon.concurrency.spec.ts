import { describe, expect, it } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { PricingService } from '../src/modules/pricing/pricing.service';

const tenantId = '10000000-0000-4000-8000-000000000001';

describe('coupon concurrency', () => {
  it('allows exactly one of 20 racers to redeem a single-use coupon', async () => {
    const coupon = {
      id: '10000000-0000-4000-8000-000000000099',
      tenantId,
      code: 'ONLYONCE',
      active: true,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60_000),
      maxUses: 1,
      uses: 0,
      perCustomerLimit: null,
    };
    const redemptions: unknown[] = [];
    let transactionQueue = Promise.resolve();
    const transactionClient = {
      $queryRaw: () => Promise.resolve([{ ...coupon }]),
      couponRedemption: {
        count: () => Promise.resolve(0),
        create: ({ data }: { data: unknown }) => {
          redemptions.push(data);
          return Promise.resolve(data);
        },
      },
      coupon: {
        update: () => {
          coupon.uses += 1;
          return Promise.resolve({ ...coupon });
        },
      },
    };
    const database = {
      transaction(
        work: (tx: typeof transactionClient, scopedTenantId: string) => Promise<unknown>,
      ) {
        const result = transactionQueue.then(() => work(transactionClient, tenantId));
        transactionQueue = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    };
    const service = new PricingService(database as never, {} as never, {} as never);
    const attempts = await TenantContext.run({ tenantId, requestId: 'coupon-race' }, () =>
      Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          service.redeem({ guestSessionId: `guest-${String(index)}` }, 'ONLYONCE', 100n),
        ),
      ),
    );
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(redemptions).toHaveLength(1);
    expect(coupon.uses).toBe(1);
  });
});
