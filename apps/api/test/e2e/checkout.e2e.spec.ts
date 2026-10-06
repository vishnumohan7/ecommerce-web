import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../src/common/config/app-config.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { CheckoutAgeGuardService } from '../../src/modules/age-verification/checkout-age-guard.service';
import {
  JurisdictionRuleService,
  PostcodeJurisdictionResolver,
} from '../../src/modules/age-verification/jurisdiction-rule.service';
import { CheckoutService } from '../../src/modules/checkout/checkout.service';
import { DeliveryService } from '../../src/modules/delivery/delivery.service';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { TaxRuleService } from '../../src/modules/pricing/tax-rule.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const suffix = randomUUID().slice(0, 8);
const userId = randomUUID();
const guestToken = randomUUID();
const groceryGuestToken = randomUUID();
let categoryId = '';
let warehouseId = '';
let zoneId = '';
let slotId = '';
let productId = '';
let alcoholProductId = '';
let inventoryId = '';
let alcoholInventoryId = '';
let cartId = '';
let guestCartId = '';
let groceryGuestCartId = '';
let guestUserId = '';
const sessionIds: string[] = [];
let checkout: CheckoutService;

const address = {
  line1: '1 Checkout Way',
  city: 'London',
  postcode: 'ZX1 1AA',
  country: 'GB' as const,
};

describe('checkout orchestration E2E', () => {
  beforeAll(async () => {
    categoryId = (await prisma.category.findFirstOrThrow({ where: { tenantId, active: true } })).id;
    warehouseId = (await prisma.warehouse.findFirstOrThrow({ where: { tenantId, active: true } }))
      .id;
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: `checkout-${suffix}@example.test`,
        passwordHash: 'test',
        firstName: 'Checkout',
        lastName: 'Tester',
      },
    });
    const products = await Promise.all([
      prisma.product.create({
        data: productData(`CHECKOUT-${suffix}`, `checkout-${suffix}`, false),
      }),
      prisma.product.create({
        data: {
          ...productData(`CHECKOUT-A-${suffix}`, `checkout-alcohol-${suffix}`, true),
          taxCategory: 'STANDARD_20',
          vatRateBps: 2000,
          ageRestriction: 18,
          restrictionReason: 'ALCOHOL',
          returnPolicy: 'AGE_RESTRICTED_RESTRICTED',
        },
      }),
    ]);
    productId = products[0].id;
    alcoholProductId = products[1].id;
    const inventories = await Promise.all([
      prisma.inventory.create({ data: { tenantId, productId, warehouseId, onHand: 10 } }),
      prisma.inventory.create({
        data: { tenantId, productId: alcoholProductId, warehouseId, onHand: 10 },
      }),
    ]);
    inventoryId = inventories[0].id;
    alcoholInventoryId = inventories[1].id;
    cartId = (await prisma.cart.create({ data: { tenantId, userId } })).id;
    guestCartId = (
      await prisma.cart.create({
        data: { tenantId, guestToken, expiresAt: new Date(Date.now() + 86_400_000) },
      })
    ).id;
    groceryGuestCartId = (
      await prisma.cart.create({
        data: {
          tenantId,
          guestToken: groceryGuestToken,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      })
    ).id;
    await Promise.all([
      prisma.cartItem.create({
        data: {
          tenantId,
          cartId,
          productId,
          quantity: 2,
          orderCategory: 'GROCERY',
          priceSnapshotMinor: 500n,
          snapshotAgeRestriction: 0,
          snapshotStaleAt: new Date(Date.now() + 900_000),
        },
      }),
      prisma.cartItem.create({
        data: {
          tenantId,
          cartId: guestCartId,
          productId: alcoholProductId,
          quantity: 1,
          orderCategory: 'ALCOHOL',
          priceSnapshotMinor: 500n,
          snapshotAgeRestriction: 18,
          snapshotStaleAt: new Date(Date.now() + 900_000),
        },
      }),
      prisma.cartItem.create({
        data: {
          tenantId,
          cartId: groceryGuestCartId,
          productId,
          quantity: 1,
          orderCategory: 'GROCERY',
          priceSnapshotMinor: 500n,
          snapshotAgeRestriction: 0,
          snapshotStaleAt: new Date(Date.now() + 900_000),
        },
      }),
    ]);
    zoneId = (
      await prisma.deliveryZone.create({
        data: {
          tenantId,
          code: `ZX-${suffix}`,
          name: 'Checkout Test Zone',
          postcodePatterns: ['ZX*'],
          deliveryFeeMinor: 299n,
          groceryFeeMinor: 299n,
          alcoholFeeMinor: 399n,
        },
      })
    ).id;
    slotId = (
      await prisma.deliverySlot.create({
        data: {
          tenantId,
          zoneId,
          startsAt: new Date(Date.now() + 7_200_000),
          endsAt: new Date(Date.now() + 10_800_000),
          capacity: 20,
          cutoffMinutes: 0,
        },
      })
    ).id;
    const scoped = new TenantScopedPrismaService(prisma);
    const jurisdictions = new JurisdictionRuleService(new PostcodeJurisdictionResolver(scoped));
    const delivery = new DeliveryService(scoped, jurisdictions);
    const pricing = new PricingService(scoped, delivery, new TaxRuleService(scoped));
    checkout = new CheckoutService(
      scoped,
      pricing,
      delivery,
      new CheckoutAgeGuardService(scoped, jurisdictions),
      new AppConfigService(),
    );
  }, 60_000);

  afterAll(async () => {
    await prisma.stockReservation.deleteMany({ where: { checkoutSessionId: { in: sessionIds } } });
    await prisma.checkoutSession.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.inventoryTransaction.deleteMany({
      where: { inventoryId: { in: [inventoryId, alcoholInventoryId] } },
    });
    await prisma.cartItem.deleteMany({
      where: { cartId: { in: [cartId, guestCartId, groceryGuestCartId] } },
    });
    await prisma.cart.deleteMany({
      where: { id: { in: [cartId, guestCartId, groceryGuestCartId] } },
    });
    await prisma.deliverySlot.deleteMany({ where: { id: slotId } });
    await prisma.deliveryZone.deleteMany({ where: { id: zoneId } });
    await prisma.inventory.deleteMany({ where: { id: { in: [inventoryId, alcoholInventoryId] } } });
    await prisma.product.deleteMany({ where: { id: { in: [productId, alcoholProductId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    if (guestUserId) await prisma.user.deleteMany({ where: { id: guestUserId } });
    await prisma.$disconnect();
  }, 60_000);

  it('returns one authoritative variable-weight summary and creates an expiring stock reservation', async () => {
    const summary = await inTenant(() =>
      checkout.validate({ userId }, { deliveryAddress: address, deliverySlotId: slotId }),
    );
    expect(summary).toMatchObject({
      valid: true,
      requiresManualCapture: true,
      blockers: [],
      totalMinor: 1299n,
    });
    expect(summary.groups).toHaveLength(2);
    const session = await inTenant(() =>
      checkout.create({ userId }, { deliveryAddress: address, deliverySlotId: slotId }),
    );
    sessionIds.push(session.id);
    expect(session.status).toBe('ACTIVE');
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).reserved,
    ).toBe(2);
  }, 30_000);

  it('invalidates and releases stock when the basket version changes', async () => {
    const active = await prisma.checkoutSession.findFirstOrThrow({
      where: { cartId, status: 'ACTIVE' },
    });
    await prisma.cart.update({ where: { id: cartId }, data: { version: { increment: 1 } } });
    await expect(inTenant(() => checkout.get({ userId }, active.id))).rejects.toMatchObject({
      response: { code: 'CHECKOUT_SNAPSHOT_CHANGED' },
    });
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).reserved,
    ).toBe(0);
  }, 30_000);

  it('releases reservations through the expiry job', async () => {
    const session = await inTenant(() =>
      checkout.create({ userId }, { deliveryAddress: address, deliverySlotId: slotId }),
    );
    sessionIds.push(session.id);
    await inTenant(() => checkout.releaseExpired(new Date(session.expiresAt.getTime() + 1000)));
    expect(
      (await prisma.checkoutSession.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe('EXPIRED');
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).reserved,
    ).toBe(0);
  }, 30_000);

  it('blocks guest alcohol checkout without purchase verification and creates no session', async () => {
    const before = await prisma.checkoutSession.count({ where: { cartId: guestCartId } });
    await expect(
      inTenant(() =>
        checkout.create(
          { guestSessionId: guestToken },
          {
            deliveryAddress: address,
            deliverySlotId: slotId,
            guest: {
              firstName: 'Guest',
              lastName: 'Buyer',
              email: 'guest@example.test',
              phone: '07123456789',
            },
          },
        ),
      ),
    ).rejects.toMatchObject({ response: { code: 'AGE_VERIFICATION_REQUIRED' } });
    expect(await prisma.checkoutSession.count({ where: { cartId: guestCartId } })).toBe(before);
  }, 30_000);

  it('creates a non-login tombstone user for an eligible guest checkout', async () => {
    const session = await inTenant(() =>
      checkout.create(
        { guestSessionId: groceryGuestToken },
        {
          deliveryAddress: address,
          deliverySlotId: slotId,
          guest: {
            firstName: 'Guest',
            lastName: 'Grocery',
            email: 'buyer@example.test',
            phone: '07123456789',
          },
        },
      ),
    );
    sessionIds.push(session.id);
    const record = await prisma.checkoutSession.findUniqueOrThrow({ where: { id: session.id } });
    guestUserId = record.guestUserId ?? '';
    const tombstone = await prisma.user.findUniqueOrThrow({ where: { id: guestUserId } });
    expect(tombstone.active).toBe(false);
    expect(tombstone.tombstonedAt).toBeInstanceOf(Date);
    await inTenant(() => checkout.cancel({ guestSessionId: groceryGuestToken }, session.id));
  }, 30_000);
});

function productData(sku: string, slug: string, alcohol: boolean) {
  return {
    tenantId,
    categoryId,
    sku,
    slug,
    name: sku,
    description: 'Checkout fixture',
    status: 'ACTIVE' as const,
    priceMinor: 500n,
    currency: 'GBP',
    vatRateBps: 0,
    taxCategory: 'ZERO' as const,
    pricingMode: 'WEIGHT_ESTIMATED' as const,
    pricePerKgMinor: 1000n,
    estimatedWeightGrams: 500,
    weightToleranceBps: 1000,
    isAlcohol: alcohol,
    ageRestriction: 0,
    restrictionReason: 'NONE' as const,
    returnPolicy: 'STANDARD_14_DAY' as const,
    unitPriceDisplay: 'per kg',
    hfssStatus: 'NOT_IN_SCOPE' as const,
    dietaryTags: [] as string[],
    allergens: [] as string[],
    countryOfOrigin: 'GB',
    storageType: 'AMBIENT' as const,
  };
}

function inTenant<T>(work: () => T): T {
  return TenantContext.run({ tenantId, requestId: `checkout-${suffix}` }, work);
}
