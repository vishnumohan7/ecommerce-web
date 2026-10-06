import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppConfigService } from '../../src/common/config/app-config.service';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { ForbiddenFieldsPipe } from '../../src/common/pipes/forbidden-fields.pipe';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { CartController } from '../../src/modules/cart/cart.controller';
import { CartService } from '../../src/modules/cart/cart.service';
import { PricingService } from '../../src/modules/pricing/pricing.service';
import { TaxRuleService } from '../../src/modules/pricing/tax-rule.service';
import { GuestCartTokenService } from '../../src/modules/cart/guest-cart-token.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
let app: INestApplication;
const productIds: string[] = [];
const userIds: string[] = [];
const cartIds = new Set<string>();
let mergeProductId = '';
let priceProductId = '';
let alcoholProductId = '';
let mergeUserId = '';
let uniqueUserId = '';
interface CartBody {
  id: string;
  groups: Array<{
    category: string;
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      priceSnapshotMinor: string;
      substitutionPreference: string;
    }>;
  }>;
  changes: Array<{
    type: string;
    productId?: string;
    requested?: number;
    applied?: number;
    from?: string;
    to?: string;
  }>;
  requiresAgeVerification: boolean;
  couponCode?: string | null;
}
function cookieOf(response: request.Response): string {
  cartIds.add((response.body as CartBody).id);
  const header: unknown = response.headers['set-cookie'];
  const value =
    Array.isArray(header) && typeof header[0] === 'string'
      ? header[0]
      : typeof header === 'string'
        ? header
        : undefined;
  if (!value) throw new Error('Guest cart cookie was not set');
  return value.split(';')[0] ?? value;
}
function item(body: CartBody, productId: string) {
  return body.groups.flatMap((group) => group.items).find((entry) => entry.productId === productId);
}

describe('combined cart HTTP E2E', () => {
  beforeAll(async () => {
    const [category, warehouse] = await Promise.all([
      prisma.category.findFirstOrThrow({ where: { tenantId, active: true } }),
      prisma.warehouse.findFirstOrThrow({ where: { tenantId, active: true } }),
    ]);
    const suffix = Date.now().toString(36);
    const base = {
      tenantId,
      categoryId: category.id,
      description: 'Transient cart E2E fixture',
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
    const mergeProduct = await prisma.product.create({
      data: {
        ...base,
        sku: `CART-MERGE-${suffix}`,
        slug: `cart-merge-${suffix}`,
        name: 'Cart Merge Product',
        priceMinor: 500n,
        isAlcohol: false,
        ageRestriction: 0,
        restrictionReason: 'NONE',
      },
    });
    const priceProduct = await prisma.product.create({
      data: {
        ...base,
        sku: `CART-PRICE-${suffix}`,
        slug: `cart-price-${suffix}`,
        name: 'Cart Price Product',
        priceMinor: 700n,
        isAlcohol: false,
        ageRestriction: 0,
        restrictionReason: 'NONE',
      },
    });
    const alcoholProduct = await prisma.product.create({
      data: {
        ...base,
        sku: `CART-ALCOHOL-${suffix}`,
        slug: `cart-alcohol-${suffix}`,
        name: 'Cart Alcohol Product',
        priceMinor: 900n,
        isAlcohol: true,
        ageRestriction: 18,
        restrictionReason: 'ALCOHOL',
        returnPolicy: 'AGE_RESTRICTED_RESTRICTED',
        abv: '4.50',
      },
    });
    productIds.push(mergeProduct.id, priceProduct.id, alcoholProduct.id);
    mergeProductId = mergeProduct.id;
    priceProductId = priceProduct.id;
    alcoholProductId = alcoholProduct.id;
    await prisma.inventory.createMany({
      data: [
        { tenantId, productId: mergeProduct.id, warehouseId: warehouse.id, onHand: 3 },
        { tenantId, productId: priceProduct.id, warehouseId: warehouse.id, onHand: 5 },
        { tenantId, productId: alcoholProduct.id, warehouseId: warehouse.id, onHand: 5 },
      ],
    });
    const users = await Promise.all(
      ['merge', 'unique'].map((label) =>
        prisma.user.create({
          data: {
            tenantId,
            email: `cart-${label}-${suffix}@example.test`,
            passwordHash: 'test-only',
            firstName: 'Cart',
            lastName: label,
            role: 'CUSTOMER',
          },
        }),
      ),
    );
    const [mergeUser, uniqueUser] = users;
    if (!mergeUser || !uniqueUser) throw new Error('Cart test users were not created');
    mergeUserId = mergeUser.id;
    uniqueUserId = uniqueUser.id;
    userIds.push(...users.map((user) => user.id));
    const scoped = new TenantScopedPrismaService(prisma);
    const pricing = new PricingService(scoped, {} as never, new TaxRuleService(scoped));
    const config = new AppConfigService();
    const moduleRef = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: new CartService(scoped, pricing) },
        { provide: GuestCartTokenService, useValue: new GuestCartTokenService(config) },
        { provide: AppConfigService, useValue: config },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.use((req: Request, _res: Response, next: NextFunction) =>
      TenantContext.run(
        {
          tenantId,
          ...(req.header('x-test-user') ? { userId: req.header('x-test-user') as string } : {}),
          requestId: 'cart-e2e',
        },
        next,
      ),
    );
    app.useGlobalPipes(new ForbiddenFieldsPipe());
    await app.init();
  }, 60_000);

  afterAll(async () => {
    const testCarts = await prisma.cart.findMany({
      where: { tenantId, OR: [{ id: { in: [...cartIds] } }, { userId: { in: userIds } }] },
      select: { id: true },
    });
    await prisma.cartItem.deleteMany({
      where: { tenantId, cartId: { in: testCarts.map((cart) => cart.id) } },
    });
    await prisma.cart.deleteMany({
      where: { tenantId, id: { in: testCarts.map((cart) => cart.id) } },
    });
    await prisma.inventory.deleteMany({ where: { tenantId, productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { tenantId, id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { tenantId, id: { in: userIds } } });
    if (app) await app.close();
    await prisma.$disconnect();
  }, 60_000);

  it('rejects a second ACTIVE cart for the same user (DB constraint)', async () => {
    const first = await prisma.cart.create({ data: { tenantId, userId: uniqueUserId } });
    await expect(
      prisma.cart.create({ data: { tenantId, userId: uniqueUserId } }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await prisma.cart.delete({ where: { id: first.id } });
  }, 30_000);

  it('requires exactly one user or guest owner at the database boundary', async () => {
    await expect(prisma.cart.create({ data: { tenantId } })).rejects.toThrow(
      /Cart_exactly_one_owner_check/,
    );
    await expect(
      prisma.cart.create({
        data: { tenantId, userId: uniqueUserId, guestToken: 'not-allowed-together' },
      }),
    ).rejects.toThrow(/Cart_exactly_one_owner_check/);
  }, 30_000);

  it('ignores client-supplied orderCategory / isAlcohol / price (INV-4 → 400)', async () => {
    const response = await request(app.getHttpServer() as unknown as Parameters<typeof request>[0])
      .post('/api/v1/cart/items')
      .send({
        productId: mergeProductId,
        quantity: 1,
        orderCategory: 'ALCOHOL',
        isAlcohol: true,
        priceMinor: '1',
      })
      .expect(400);
    expect((response.body as { code?: unknown }).code).toBe('CLIENT_SUPPLIED_SERVER_FIELD');
  }, 30_000);

  it('guest→user merge sums quantities and caps at stock', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const cookie = cookieOf(await request(server).get('/api/v1/cart').expect(200));
    await request(server)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ productId: mergeProductId, quantity: 2 })
      .expect(201);
    await request(server)
      .post('/api/v1/cart/items')
      .set('x-test-user', mergeUserId)
      .send({ productId: mergeProductId, quantity: 2 })
      .expect(201);
    const merged = await request(server)
      .post('/api/v1/cart/merge')
      .set('x-test-user', mergeUserId)
      .set('Cookie', cookie)
      .expect(201);
    const body = merged.body as CartBody;
    expect(item(body, mergeProductId)?.quantity).toBe(3);
    expect(body.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'QUANTITY_CAPPED',
          productId: mergeProductId,
          requested: 4,
          applied: 3,
        }),
      ]),
    );
  }, 30_000);

  it('price change between add and read surfaces in changes[] and does not auto-apply', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const cookie = cookieOf(await request(server).get('/api/v1/cart').expect(200));
    const added = await request(server)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ productId: priceProductId, quantity: 1 })
      .expect(201);
    const cartItemId = item(added.body as CartBody, priceProductId)?.id as string;
    await prisma.product.update({ where: { id: priceProductId }, data: { priceMinor: 850n } });
    const read = await request(server).get('/api/v1/cart').set('Cookie', cookie).expect(200);
    const body = read.body as CartBody;
    expect(item(body, priceProductId)?.priceSnapshotMinor).toBe('700');
    expect(body.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PRICE_CHANGED',
          productId: priceProductId,
          from: '700',
          to: '850',
        }),
      ]),
    );
    const substituted = await request(server)
      .post(`/api/v1/cart/items/${cartItemId}/substitution-preference`)
      .set('Cookie', cookie)
      .send({ preference: 'NO_SUB' })
      .expect(201);
    expect(item(substituted.body as CartBody, priceProductId)?.substitutionPreference).toBe(
      'NO_SUB',
    );
  }, 30_000);

  it('deactivated product is removed with a change entry', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const cookie = cookieOf(await request(server).get('/api/v1/cart').expect(200));
    await request(server)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ productId: alcoholProductId, quantity: 1 })
      .expect(201);
    const before = await request(server).get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect((before.body as CartBody).requiresAgeVerification).toBe(true);
    await prisma.product.update({ where: { id: alcoholProductId }, data: { status: 'INACTIVE' } });
    const read = await request(server).get('/api/v1/cart').set('Cookie', cookie).expect(200);
    const body = read.body as CartBody;
    expect(item(body, alcoholProductId)).toBeUndefined();
    expect(body.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'PRODUCT_REMOVED', productId: alcoholProductId }),
      ]),
    );
    expect(await prisma.cartItem.count({ where: { tenantId, productId: alcoholProductId } })).toBe(
      0,
    );
  }, 30_000);

  it('attaches and removes an active coupon without calculating discounts client-side', async () => {
    const server = app.getHttpServer() as unknown as Parameters<typeof request>[0];
    const cookie = cookieOf(await request(server).get('/api/v1/cart').expect(200));
    const applied = await request(server)
      .post('/api/v1/cart/coupon')
      .set('Cookie', cookie)
      .send({ code: 'demo10' })
      .expect(201);
    expect((applied.body as CartBody).couponCode).toBe('DEMO10');
    const removed = await request(server)
      .delete('/api/v1/cart/coupon')
      .set('Cookie', cookie)
      .expect(200);
    expect((removed.body as CartBody).couponCode).toBeNull();
  }, 30_000);

  it('records an abandonment timestamp for inactive active carts', async () => {
    const cart = await prisma.cart.create({
      data: { tenantId, userId: uniqueUserId, updatedAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    cartIds.add(cart.id);
    const service = new CartService(new TenantScopedPrismaService(prisma), {} as never);
    await TenantContext.run({ tenantId, requestId: 'cart-abandonment' }, async () => {
      await service.abandonInactive(new Date('2021-01-01T00:00:00.000Z'));
    });
    const abandoned = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    expect(abandoned.status).toBe('ABANDONED');
    expect(abandoned.abandonedAt).toBeInstanceOf(Date);
  }, 30_000);
});
