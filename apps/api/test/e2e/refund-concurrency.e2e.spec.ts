import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';

const prisma = new PrismaService();
const tenantId = '00000000-0000-4000-8000-000000000001';
const orderId = randomUUID();
const paymentId = randomUUID();
const refundIds: string[] = [];

describe('refund captured-amount guard E2E', () => {
  beforeAll(async () => {
    const product = await prisma.product.findFirstOrThrow({
      where: { tenantId, status: 'ACTIVE' },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        tenantId,
        orderNumber: 1n,
        orderNumberYear: 2998,
        idempotencyKey: `refund-race-${orderId}`,
        basketType: product.isAlcohol ? 'ALCOHOL' : 'GROCERY',
        subtotalMinor: 1000n,
        discountMinor: 0n,
        taxMinor: 0n,
        deliveryFeeMinor: 0n,
        totalMinor: 1000n,
        paymentStatus: 'CAPTURED',
        fulfilmentStatus: 'DELIVERED',
        deliveryAddress: { postcode: 'SE1 1AA' },
        customerSnapshot: { test: true },
      },
    });
    await prisma.payment.create({
      data: {
        id: paymentId,
        tenantId,
        orderId,
        provider: 'stripe',
        providerPaymentIntentId: `pi_refund_race_${orderId}`,
        status: 'CAPTURED',
        authorisedAmountMinor: 1000n,
        capturedAmountMinor: 1000n,
        currency: 'GBP',
        manualCapture: false,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma.refund.deleteMany({ where: { id: { in: refundIds } } });
    await prisma.payment.deleteMany({ where: { id: paymentId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.$disconnect();
  }, 60_000);

  it('serializes 20 racers so aggregate reservations never exceed capture', async () => {
    const attempts = Array.from({ length: 20 }, (_, index) => {
      const id = randomUUID();
      refundIds.push(id);
      return prisma.refund.create({
        data: {
          id,
          tenantId,
          orderId,
          paymentId,
          idempotencyKey: `refund-race-${orderId}-${String(index)}`,
          requestHash: `hash-${String(index)}`,
          method: 'CARD',
          amountMinor: 100n,
          currency: 'GBP',
          status: 'PENDING',
          reason: 'concurrency gate',
        },
      });
    });
    const settled = await Promise.allSettled(attempts);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(10);
    expect(
      await prisma.refund.aggregate({
        where: { paymentId, status: { not: 'FAILED' } },
        _sum: { amountMinor: true },
      }),
    ).toMatchObject({ _sum: { amountMinor: 1000n } });
  }, 120_000);
});
