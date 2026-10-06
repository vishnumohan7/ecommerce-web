import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { StubPaymentProvider } from '../../src/modules/payments/payment.providers';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { ReturnService } from '../../src/modules/returns/return.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const userId = randomUUID();
const orderId = randomUUID();
let alcoholItemId: string;
let groceryItemId: string;
let returns: ReturnService;

describe('refund E2E', () => {
  beforeAll(async () => {
    const [grocery, alcohol] = await Promise.all([
      prisma.product.findFirstOrThrow({ where: { tenantId, status: 'ACTIVE', isAlcohol: false } }),
      prisma.product.findFirstOrThrow({ where: { tenantId, status: 'ACTIVE', isAlcohol: true } }),
    ]);
    groceryItemId = randomUUID();
    alcoholItemId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: `refund-${userId}@example.test`,
        passwordHash: 'test',
        firstName: 'Refund',
        lastName: 'Customer',
      },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        tenantId,
        userId,
        orderNumber: BigInt(7_000_000 + Math.floor(Math.random() * 999_999)),
        orderNumberYear: 2097,
        idempotencyKey: `refund-e2e-${orderId}`,
        basketType: 'MIXED',
        currency: 'GBP',
        subtotalMinor: 4200n,
        discountMinor: 1000n,
        taxMinor: 533n,
        deliveryFeeMinor: 0n,
        totalMinor: 3200n,
        paymentStatus: 'CAPTURED',
        fulfilmentStatus: 'DELIVERED',
        ageVerificationStatus: 'PASSED',
        deliveryAgeCheckStatus: 'PASSED',
        deliveryAddress: { postcode: 'SE1 1AA' },
        customerSnapshot: { firstName: 'Refund', lastName: 'Customer' },
      },
    });
    await prisma.orderItem.createMany({
      data: [
        {
          id: groceryItemId,
          tenantId,
          orderId,
          productId: grocery.id,
          productName: grocery.name,
          sku: grocery.sku,
          quantity: 20,
          unitPriceMinor: 100n,
          vatRateBps: 2000,
          vatAmountMinor: 333n,
          discountMinor: 0n,
          lineTotalMinor: 2000n,
          orderCategory: 'GROCERY',
          isAlcohol: false,
          ageRestriction: 0,
          pricingMode: 'UNIT',
          unitPriceDisplay: 'each',
          hfssStatus: 'NOT_IN_SCOPE',
          returnPolicy: 'STANDARD_14_DAY',
          substitutionPreference: 'SIMILAR',
        },
        {
          id: alcoholItemId,
          tenantId,
          orderId,
          productId: alcohol.id,
          productName: alcohol.name,
          sku: alcohol.sku,
          quantity: 1,
          unitPriceMinor: 2200n,
          vatRateBps: 2000,
          vatAmountMinor: 200n,
          discountMinor: 1000n,
          lineTotalMinor: 1200n,
          orderCategory: 'ALCOHOL',
          isAlcohol: true,
          ageRestriction: 18,
          pricingMode: 'UNIT',
          unitPriceDisplay: 'each',
          hfssStatus: 'NOT_IN_SCOPE',
          returnPolicy: 'AGE_RESTRICTED_RESTRICTED',
          substitutionPreference: 'SIMILAR',
        },
      ],
    });
    await prisma.payment.create({
      data: {
        tenantId,
        orderId,
        provider: 'stripe',
        providerPaymentIntentId: `pi_refund_${orderId.replaceAll('-', '')}`,
        status: 'CAPTURED',
        authorisedAmountMinor: 2200n,
        capturedAmountMinor: 2200n,
        currency: 'GBP',
        manualCapture: false,
      },
    });
    returns = new ReturnService(
      new TenantScopedPrismaService(prisma),
      new PricingService({} as never, {} as never, {} as never),
      new StubPaymentProvider(),
    );
  }, 30_000);

  afterAll(async () => {
    await prisma.coupon.deleteMany({
      where: { returnRequestId: { not: null }, lockedUserId: userId },
    });
    const refunds = await prisma.refund.findMany({ where: { orderId }, select: { id: true } });
    await prisma.refundItem.deleteMany({
      where: { refundId: { in: refunds.map((item) => item.id) } },
    });
    await prisma.refund.deleteMany({ where: { orderId } });
    const requests = await prisma.returnRequest.findMany({
      where: { orderId },
      select: { id: true },
    });
    await prisma.returnRequestItem.deleteMany({
      where: { returnRequestId: { in: requests.map((item) => item.id) } },
    });
    await prisma.returnRequest.deleteMany({ where: { orderId } });
    await prisma.payment.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }, 30_000);

  it('runs the audited return workflow and keeps a mixed order as one order', async () => {
    await context(async () => {
      const request = await returns.createReturn({
        orderId,
        reason: 'DAMAGED',
        items: [{ orderItemId: alcoholItemId, quantity: 1 }],
      });
      await returns.updateReturn(request.id, { status: 'APPROVED', disposition: 'WRITE_OFF' });
      const refund = await returns.createRefund({
        orderId,
        returnRequestId: request.id,
        idempotencyKey: `alcohol-${orderId}`,
        reason: 'Damaged bottle',
        items: [{ orderItemId: alcoholItemId, quantity: 1 }],
      });
      expect(refund.amountMinor).toBe(1200n);
      expect(refund.items[0]?.vatPortionMinor).toBe(200n);
      expect(await prisma.order.count({ where: { id: orderId } })).toBe(1);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).refundStatus).toBe(
        'PARTIAL',
      );
      expect(
        await prisma.auditLog.count({ where: { entityId: request.id } }),
      ).toBeGreaterThanOrEqual(2);
    });
  }, 30_000);

  it('serializes 20 racers so reservations never exceed the captured amount', async () => {
    await context(async () => {
      const attempts = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          returns.createRefund({
            orderId,
            idempotencyKey: `race-${orderId}-${String(index)}`,
            reason: 'Concurrent guard test',
            items: [{ orderItemId: groceryItemId, quantity: 1 }],
          }),
        ),
      );
      const succeeded = attempts.filter((attempt) => attempt.status === 'fulfilled').length;
      expect(succeeded).toBeGreaterThan(0);
      expect(succeeded).toBeLessThanOrEqual(10);
      const aggregate = await prisma.refund.aggregate({
        where: { orderId, status: { not: 'FAILED' } },
        _sum: { amountMinor: true },
      });
      expect(aggregate._sum.amountMinor ?? 0n).toBeLessThanOrEqual(2200n);
    });
  }, 60_000);
});

function context<T>(work: () => T): T {
  return TenantContext.run({ tenantId, userId, requestId: `refund-${orderId}` }, work);
}
