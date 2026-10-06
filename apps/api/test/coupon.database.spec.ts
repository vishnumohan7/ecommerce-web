import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { PricingService } from '../src/modules/pricing/pricing.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const service = new PricingService(new TenantScopedPrismaService(prisma), {} as never, {} as never);
const code = `RACE-${randomUUID().slice(0, 8).toUpperCase()}`;
let couponId = '';

describe('coupon PostgreSQL concurrency', () => {
  beforeAll(async () => {
    couponId = (
      await prisma.coupon.create({
        data: {
          tenantId,
          code,
          type: 'FIXED',
          valueMinor: 100n,
          startsAt: new Date(Date.now() - 60_000),
          endsAt: new Date(Date.now() + 600_000),
          maxUses: 1,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (couponId) {
      await prisma.couponRedemption.deleteMany({ where: { couponId } });
      await prisma.coupon.deleteMany({ where: { id: couponId } });
    }
    await prisma.$disconnect();
  });

  it('persists exactly one redemption from 20 simultaneous racers', async () => {
    const attempts = await TenantContext.run({ tenantId, requestId: `coupon-${code}` }, () =>
      Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          service.redeem({ guestSessionId: `${code}-${String(index)}` }, code, 100n),
        ),
      ),
    );
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.couponRedemption.count({ where: { couponId } })).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } })).uses).toBe(1);
  }, 60_000);
});
