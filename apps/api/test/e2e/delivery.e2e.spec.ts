import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import {
  JurisdictionRuleService,
  PostcodeJurisdictionResolver,
} from '../../src/modules/age-verification/jurisdiction-rule.service';
import { DeliveryService } from '../../src/modules/delivery/delivery.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const productIds: string[] = [];
const cartIds: string[] = [];
const zoneIds: string[] = [];
const slotIds: string[] = [];
let delivery: DeliveryService;
let groceryId = '';
let alcoholId = '';
let mixedSession = '';
let grocerySession = '';
let suffix = '';

describe('delivery engine E2E', () => {
  beforeAll(async () => {
    suffix = Date.now().toString(36);
    const scoped = new TenantScopedPrismaService(prisma);
    delivery = new DeliveryService(
      scoped,
      new JurisdictionRuleService(new PostcodeJurisdictionResolver(scoped)),
    );
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId, active: true } });
    const base = {
      tenantId,
      categoryId: category.id,
      description: 'Transient delivery fixture',
      status: 'ACTIVE' as const,
      currency: 'GBP',
      vatRateBps: 0,
      pricingMode: 'UNIT' as const,
      returnPolicy: 'STANDARD_14_DAY' as const,
      unitPriceDisplay: 'each',
      hfssStatus: 'NOT_IN_SCOPE' as const,
      dietaryTags: [] as string[],
      allergens: [] as string[],
      countryOfOrigin: 'GB',
      storageType: 'AMBIENT' as const,
    };
    const [grocery, alcohol] = await Promise.all([
      prisma.product.create({
        data: {
          ...base,
          sku: `DEL-G-${suffix}`,
          slug: `delivery-grocery-${suffix}`,
          name: 'Delivery Grocery',
          priceMinor: 1500n,
          isAlcohol: false,
          ageRestriction: 0,
          restrictionReason: 'NONE',
        },
      }),
      prisma.product.create({
        data: {
          ...base,
          sku: `DEL-A-${suffix}`,
          slug: `delivery-alcohol-${suffix}`,
          name: 'Delivery Alcohol',
          priceMinor: 1000n,
          isAlcohol: true,
          abv: '12.00',
          ageRestriction: 18,
          restrictionReason: 'ALCOHOL',
          returnPolicy: 'AGE_RESTRICTED_RESTRICTED',
        },
      }),
    ]);
    groceryId = grocery.id;
    alcoholId = alcohol.id;
    productIds.push(grocery.id, alcohol.id);

    const zone = await inTenant(() =>
      delivery.createZone({
        code: `DELIVERY_${suffix.toUpperCase()}`,
        name: 'Delivery test zone',
        postcodePatterns: ['ZZ*'],
        postcodeIncludes: ['ZZ9 9ZZ'],
        postcodeExcludes: ['ZZ8 8ZZ'],
        groceryFeeMinor: 300,
        alcoholFeeMinor: 500,
        freeDeliveryThresholdMinor: 2000,
        minimumOrderMinor: 500,
        maximumOrderMinor: 20_000,
        alcoholMinimumSubtotalMinor: 900,
        feeSchedule: [
          {
            minimumSubtotalMinor: 2000,
            maximumSubtotalMinor: 5000,
            groceryFeeMinor: 275,
            alcoholFeeMinor: 450,
          },
        ],
        supportedStorageTypes: ['AMBIENT'],
        alcoholDeliveryAllowed: true,
      }),
    );
    const blocked = await inTenant(() =>
      delivery.createZone({
        code: `BLOCKED_${suffix.toUpperCase()}`,
        name: 'No alcohol zone',
        postcodePatterns: ['ZY*'],
        groceryFeeMinor: 250,
        alcoholFeeMinor: 500,
        supportedStorageTypes: ['AMBIENT'],
        alcoholDeliveryAllowed: false,
      }),
    );
    zoneIds.push(zone.id, blocked.id);
    const updated = await inTenant(() =>
      delivery.updateZone(zone.id, { name: 'Updated delivery zone' }),
    );
    expect(updated.name).toBe('Updated delivery zone');

    mixedSession = crypto.randomUUID();
    grocerySession = crypto.randomUUID();
    await createCart(mixedSession, [
      { productId: groceryId, quantity: 1, category: 'GROCERY', price: 1500n, age: 0 },
      { productId: alcoholId, quantity: 1, category: 'ALCOHOL', price: 1000n, age: 18 },
    ]);
    await createCart(grocerySession, [
      { productId: groceryId, quantity: 2, category: 'GROCERY', price: 1500n, age: 0 },
    ]);
  }, 60_000);

  afterAll(async () => {
    await prisma.deliverySlotReservation.deleteMany({
      where: { tenantId, slotId: { in: slotIds } },
    });
    await prisma.deliverySlot.deleteMany({ where: { tenantId, id: { in: slotIds } } });
    await prisma.cartItem.deleteMany({ where: { tenantId, cartId: { in: cartIds } } });
    await prisma.cart.deleteMany({ where: { tenantId, id: { in: cartIds } } });
    await prisma.product.deleteMany({ where: { tenantId, id: { in: productIds } } });
    await prisma.deliveryZone.deleteMany({ where: { tenantId, id: { in: zoneIds } } });
    await prisma.$disconnect();
  }, 60_000);

  it('mixed basket returns exactly one deliveryFeeMinor plus an internal breakdown', async () => {
    const quote = await inTenant(() => delivery.quote({ guestSessionId: mixedSession }, 'ZZ1 1ZZ'));
    expect(quote.deliveryFeeMinor).toBe(450n);
    expect(quote.breakdown).toMatchObject({
      strategy: 'MAX',
      groceryFeeMinor: 275n,
      alcoholFeeMinor: 450n,
    });
  });

  it('free-delivery threshold is applied to the grocery-only subtotal', async () => {
    const quote = await inTenant(() =>
      delivery.quote({ guestSessionId: grocerySession }, 'ZZ1 1ZZ'),
    );
    expect(quote.deliveryFeeMinor).toBe(0n);
    expect(quote.breakdown.grocerySubtotalMinor).toBe(3000n);
  });

  it('alcohol basket plus a restricted zone returns a clear 422 code', async () => {
    await expect(
      inTenant(() => delivery.quote({ guestSessionId: mixedSession }, 'ZY1 1ZZ')),
    ).rejects.toMatchObject({ response: { code: 'ALCOHOL_DELIVERY_NOT_ALLOWED' } });
  });

  it('explicit postcode exclusions override a matching outward pattern', async () => {
    await expect(
      inTenant(() => delivery.quote({ guestSessionId: grocerySession }, 'ZZ8 8ZZ')),
    ).rejects.toMatchObject({ response: { code: 'ADDRESS_NOT_DELIVERABLE' } });
  });

  it('slot endpoint filtering enforces cutoff, age compatibility, and capacity', async () => {
    const zoneId = zoneIds[0] as string;
    const now = new Date();
    const valid = await inTenant(() =>
      delivery.createSlot({
        zoneId,
        startsAt: new Date(now.getTime() + 4 * 60 * 60_000),
        endsAt: new Date(now.getTime() + 6 * 60 * 60_000),
        capacity: 5,
        cutoffMinutes: 60,
        surchargeMinor: 75,
        allowsAgeRestricted: true,
      }),
    );
    const incompatible = await inTenant(() =>
      delivery.createSlot({
        zoneId,
        startsAt: new Date(now.getTime() + 7 * 60 * 60_000),
        endsAt: new Date(now.getTime() + 9 * 60 * 60_000),
        capacity: 5,
        allowsAgeRestricted: false,
      }),
    );
    slotIds.push(valid.id, incompatible.id);
    const response = await inTenant(() =>
      delivery.availableSlots({ guestSessionId: mixedSession }, 'ZZ1 1ZZ', now),
    );
    expect(response.slots.map((slot) => slot.id)).toContain(valid.id);
    expect(response.slots.map((slot) => slot.id)).not.toContain(incompatible.id);
    expect(response.slots.find((slot) => slot.id === valid.id)?.deliveryFeeMinor).toBe(525n);
  });

  it('30 racers cannot oversell a slot with capacity 5', async () => {
    const zoneId = zoneIds[0] as string;
    const slot = await prisma.deliverySlot.create({
      data: {
        tenantId,
        zoneId,
        startsAt: new Date(Date.now() + 24 * 60 * 60_000),
        endsAt: new Date(Date.now() + 26 * 60 * 60_000),
        capacity: 5,
      },
    });
    slotIds.push(slot.id);
    const racerTokens = Array.from(
      { length: 30 },
      (_, index) => `delivery-racer-${suffix}-${String(index)}`,
    );
    await prisma.cart.createMany({
      data: racerTokens.map((guestToken) => ({ tenantId, guestToken })),
    });
    const racers = await prisma.cart.findMany({
      where: { tenantId, guestToken: { in: racerTokens } },
      select: { id: true },
    });
    cartIds.push(...racers.map((cart) => cart.id));
    const outcomes = await inTenant(() =>
      Promise.allSettled(racers.map((cart) => delivery.reserveCapacity(cart.id, slot.id))),
    );
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(5);
    expect((await prisma.deliverySlot.findUniqueOrThrow({ where: { id: slot.id } })).reserved).toBe(
      5,
    );
    expect(
      await prisma.deliverySlotReservation.count({ where: { tenantId, slotId: slot.id } }),
    ).toBe(5);
  }, 60_000);
});

async function createCart(
  guestToken: string,
  lines: Array<{
    productId: string;
    quantity: number;
    category: 'GROCERY' | 'ALCOHOL';
    price: bigint;
    age: number;
  }>,
) {
  const cart = await prisma.cart.create({ data: { tenantId, guestToken } });
  cartIds.push(cart.id);
  await prisma.cartItem.createMany({
    data: lines.map((line) => ({
      tenantId,
      cartId: cart.id,
      productId: line.productId,
      quantity: line.quantity,
      orderCategory: line.category,
      priceSnapshotMinor: line.price,
      snapshotAgeRestriction: line.age,
      snapshotStaleAt: new Date(Date.now() + 15 * 60_000),
    })),
  });
}

function inTenant<T>(work: () => T): T {
  return TenantContext.run({ tenantId, requestId: 'delivery-e2e' }, work);
}
