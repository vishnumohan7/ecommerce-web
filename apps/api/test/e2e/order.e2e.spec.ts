import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { OrderService } from '../../src/modules/orders/order.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const userId = randomUUID();
const orderId = randomUUID();
let orders: OrderService;
let groceryProductId: string;
let alcoholProductId: string;

describe('order surface E2E', () => {
  beforeAll(async () => {
    const [groceryProduct, alcoholProduct] = await Promise.all([
      prisma.product.findFirstOrThrow({ where: { tenantId, status: 'ACTIVE', isAlcohol: false } }),
      prisma.product.findFirstOrThrow({ where: { tenantId, status: 'ACTIVE', isAlcohol: true } }),
    ]);
    groceryProductId = groceryProduct.id;
    alcoholProductId = alcoholProduct.id;
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: `order-${userId}@example.test`,
        passwordHash: 'test',
        firstName: 'Order',
        lastName: 'Customer',
      },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        tenantId,
        userId,
        orderNumber: 900001n,
        orderNumberYear: 2099,
        idempotencyKey: `order-e2e-${orderId}`,
        basketType: 'MIXED',
        subtotalMinor: 1350n,
        discountMinor: 0n,
        taxMinor: 200n,
        deliveryFeeMinor: 299n,
        totalMinor: 1649n,
        paymentStatus: 'CAPTURED',
        ageVerificationStatus: 'PASSED',
        deliveryAgeCheckStatus: 'PENDING',
        deliveryAddress: { line1: '1 Test Street', city: 'London', postcode: 'SE1 1AA' },
        customerSnapshot: { firstName: 'Order', lastName: 'Customer' },
      },
    });
    await prisma.orderItem.createMany({
      data: [
        line(groceryProductId, 'Milk', 'GROCERY', false, 150n, 0),
        line(alcoholProductId, 'Wine', 'ALCOHOL', true, 1200n, 2000),
      ],
    });
    await prisma.orderFulfilmentGroup.createMany({
      data: [
        { tenantId, orderId, category: 'GROCERY' },
        { tenantId, orderId, category: 'ALCOHOL' },
      ],
    });
    await prisma.invoice.create({
      data: {
        tenantId,
        orderId,
        invoiceNumber: 900001n,
        invoiceNumberYear: 2099,
        subtotalMinor: 1350n,
        taxMinor: 200n,
        totalMinor: 1649n,
        currency: 'GBP',
      },
    });
    orders = new OrderService(new TenantScopedPrismaService(prisma), {} as never, {} as never);
  }, 30_000);

  afterAll(async () => {
    await prisma.invoice.deleteMany({ where: { orderId } });
    await prisma.orderFulfilmentGroup.deleteMany({ where: { orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }, 30_000);

  it('returns one mixed order entry, grouped detail, tracking and one two-section invoice', async () => {
    await inContext(async () => {
      const history = await orders.customerList();
      const entry = history.find((item) => item.id === orderId);
      expect(entry?.label).toBe('Grocery (1) · Alcohol (1)');
      const detail = await orders.customerDetail(orderId);
      expect(detail.sections.grocery).toHaveLength(1);
      expect(detail.sections.alcohol).toHaveLength(1);
      expect(detail.fulfilmentGroups).toHaveLength(2);
      const tracking = await orders.tracking(orderId);
      expect(tracking.steps.some((step) => step.key === 'DELIVERY_AGE_CHECK')).toBe(true);
      const invoice = await orders.invoice(orderId);
      const text = invoice.pdf.toString('utf8');
      expect(text).toContain('GROCERY ITEMS');
      expect(text).toContain('ALCOHOL ITEMS \\(18+\\)');
      await expect(
        orders.deliveryAgeCheck({
          orderId,
          outcome: 'PASSED',
          challengeAge: 25,
          idType: 'PASSPORT',
          recipientPresent: false,
        }),
      ).rejects.toMatchObject({ response: { code: 'AGE_RESTRICTED_UNATTENDED' } });
      expect(await prisma.deliveryAgeCheck.count({ where: { orderId } })).toBe(0);
    });
  }, 30_000);
});

function line(
  productId: string,
  productName: string,
  orderCategory: 'GROCERY' | 'ALCOHOL',
  isAlcohol: boolean,
  lineTotalMinor: bigint,
  vatRateBps: number,
) {
  return {
    tenantId,
    orderId,
    productId,
    productName,
    sku: `SKU-${productName}`,
    quantity: 1,
    unitPriceMinor: lineTotalMinor,
    currency: 'GBP',
    vatRateBps,
    vatAmountMinor: isAlcohol ? 200n : 0n,
    discountMinor: 0n,
    lineTotalMinor,
    orderCategory,
    isAlcohol,
    ageRestriction: isAlcohol ? 18 : 0,
    pricingMode: 'UNIT' as const,
    unitPriceDisplay: 'each',
    hfssStatus: 'NOT_IN_SCOPE' as const,
    returnPolicy: isAlcohol ? ('AGE_RESTRICTED_RESTRICTED' as const) : ('STANDARD_14_DAY' as const),
    substitutionPreference: 'SIMILAR' as const,
  };
}

function inContext<T>(work: () => T): T {
  return TenantContext.run({ tenantId, userId, requestId: `order-${orderId}` }, work);
}
