import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const prisma = new PrismaClient();
const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';

describe('schema constraints', () => {
  beforeAll(async () => {
    await prisma.tenant.upsert({ where: { id: tenantId }, update: {}, create: { id: tenantId, slug: 'constraint-test', name: 'Constraint Test' } });
    await prisma.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, tenantId, email: 'schema@example.test', passwordHash: 'test-only-hash', firstName: 'Schema', lastName: 'Test' } });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe('DELETE FROM "Payment" WHERE "tenantId" = $1::uuid', tenantId);
    await prisma.$executeRawUnsafe('DELETE FROM "Invoice" WHERE "tenantId" = $1::uuid', tenantId);
    await prisma.$executeRawUnsafe('DELETE FROM "Order" WHERE "tenantId" = $1::uuid', tenantId);
    await prisma.$executeRawUnsafe('DELETE FROM "Cart" WHERE "tenantId" = $1::uuid', tenantId);
    await prisma.$executeRawUnsafe('DELETE FROM "AuditLog" WHERE "tenantId" = $1::uuid', tenantId).catch(() => undefined);
    await prisma.$executeRawUnsafe('DELETE FROM "User" WHERE "tenantId" = $1::uuid', tenantId);
    await prisma.$disconnect();
  });

  it('rejects a second ACTIVE cart for the same user', async () => {
    await prisma.cart.create({ data: { tenantId, userId } });
    await expect(prisma.cart.create({ data: { tenantId, userId } })).rejects.toThrow();
  });

  it('rejects a second Payment for an Order', async () => {
    const order = await createOrder('payment-order', 1n);
    await prisma.payment.create({ data: { tenantId, orderId: order.id, provider: 'stripe', providerPaymentIntentId: 'pi_constraint_1', status: 'PENDING', authorisedAmountMinor: 1000n, currency: 'GBP', manualCapture: false } });
    await expect(prisma.payment.create({ data: { tenantId, orderId: order.id, provider: 'stripe', providerPaymentIntentId: 'pi_constraint_2', status: 'PENDING', authorisedAmountMinor: 1000n, currency: 'GBP', manualCapture: false } })).rejects.toThrow();
  });

  it('rejects a duplicate paymentIntentId', async () => {
    const first = await createOrder('intent-order-1', 2n);
    const second = await createOrder('intent-order-2', 3n);
    await prisma.payment.create({ data: { tenantId, orderId: first.id, provider: 'stripe', providerPaymentIntentId: 'pi_duplicate', status: 'PENDING', authorisedAmountMinor: 1000n, currency: 'GBP', manualCapture: false } });
    await expect(prisma.payment.create({ data: { tenantId, orderId: second.id, provider: 'stripe', providerPaymentIntentId: 'pi_duplicate', status: 'PENDING', authorisedAmountMinor: 1000n, currency: 'GBP', manualCapture: false } })).rejects.toThrow();
  });

  it('rejects UPDATE on AuditLog', async () => {
    const audit = await prisma.auditLog.create({ data: { tenantId, actorType: 'SYSTEM', action: 'SCHEMA_TEST', entity: 'Schema', entityId: tenantId, requestId: 'schema-test' } });
    await expect(prisma.auditLog.update({ where: { id: audit.id }, data: { action: 'MUTATED' } })).rejects.toThrow('append-only');
  });
});

async function createOrder(idempotencyKey: string, orderNumber: bigint) {
  return prisma.order.create({ data: { tenantId, userId, orderNumber, idempotencyKey, basketType: 'GROCERY', subtotalMinor: 1000n, discountMinor: 0n, taxMinor: 0n, deliveryFeeMinor: 0n, totalMinor: 1000n, deliveryAddress: { postcode: 'SE1 1AA' }, customerSnapshot: { email: 'schema@example.test' } } });
}
