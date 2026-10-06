import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { CheckoutAgeGuardService } from '../age-verification/checkout-age-guard.service';
import type { PricingIdentity } from '../pricing/pricing.service';
import { PricingService } from '../pricing/pricing.service';
import { DeliveryService } from '../delivery/delivery.service';
import { checkoutSessionCreateSchema, checkoutValidateSchema } from './checkout.schemas';

type Identity = PricingIdentity;
type LockedInventory = { id: string; productId: string; onHand: number; reserved: number };

@Injectable()
export class CheckoutService implements OnModuleInit, OnModuleDestroy {
  private expiryTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly pricing: PricingService,
    private readonly delivery: DeliveryService,
    private readonly age: CheckoutAgeGuardService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    this.expiryTimer = setInterval(() => {
      void TenantContext.run(
        { tenantId: this.config.defaultTenantId, requestId: 'checkout-expiry-job' },
        () => this.releaseExpired(),
      );
    }, 60_000);
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async validate(identity: Identity, raw: unknown) {
    const input = checkoutValidateSchema.parse(raw);
    const owner = this.owner(identity);
    const cart = await this.db.client.cart.findFirst({ where: { ...owner, status: 'ACTIVE' } });
    if (!cart)
      throw new BadRequestException({ code: 'CART_EMPTY', message: 'An active cart is required' });
    const items = await this.db.client.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
    });
    if (items.length === 0)
      throw new BadRequestException({ code: 'CART_EMPTY', message: 'The cart is empty' });

    const products = await this.db.client.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const unavailable = items.find((item) => productById.get(item.productId)?.status !== 'ACTIVE');
    if (unavailable)
      throw new ConflictException({
        code: 'PRODUCT_UNAVAILABLE',
        message: 'A cart product is no longer active',
        details: { productId: unavailable.productId },
      });

    for (const item of items) {
      const available = await this.db.client.inventory.aggregate({
        where: { productId: item.productId },
        _sum: { stockAvailable: true },
      });
      if ((available._sum.stockAvailable ?? 0) < item.quantity)
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'A cart item no longer has sufficient stock',
          details: { productId: item.productId },
        });
    }
    const repriced = items.find(
      (item) => productById.get(item.productId)?.priceMinor !== item.priceSnapshotMinor,
    );
    if (repriced)
      throw new ConflictException({
        code: 'PRICE_CHANGED',
        message: 'A cart price changed; review the cart before checkout',
        details: { productId: repriced.productId },
      });

    const postcode = input.deliveryAddress.postcode;
    const [deliveryQuote, deliveryOptions, price] = await Promise.all([
      this.delivery.quote(identity, postcode),
      this.delivery.availableSlots(identity, postcode),
      this.pricing.quote(identity, {
        postcode,
        ...(input.couponCode ? { couponCode: input.couponCode } : {}),
      }),
    ]);
    if (
      input.deliverySlotId &&
      !deliveryOptions.slots.some((option) => option.id === input.deliverySlotId)
    )
      throw new ConflictException({
        code: 'DELIVERY_SLOT_UNAVAILABLE',
        message: 'The selected delivery slot is unavailable or past cutoff',
      });

    const age = await this.age.validate(identity, postcode);
    const requiresManualCapture = products.some(
      (product) => product.pricingMode === 'WEIGHT_ESTIMATED',
    );
    const lines = price.lines.map((line) => {
      const product = productById.get(line.productId);
      return {
        ...line,
        name: product?.name ?? 'Unavailable product',
        sku: product?.sku ?? '',
        orderCategory: line.isAlcohol ? 'ALCOHOL' : 'GROCERY',
      };
    });
    return {
      valid: true,
      cartId: cart.id,
      cartVersion: cart.version,
      currency: price.currency,
      groups: [
        {
          category: 'GROCERY',
          lines: lines.filter((line) => !line.isAlcohol),
          subtotalMinor: price.grocerySubtotalMinor,
        },
        {
          category: 'ALCOHOL',
          lines: lines.filter((line) => line.isAlcohol),
          subtotalMinor: price.alcoholSubtotalMinor,
        },
      ],
      appliedCoupon: price.couponCode,
      promotionDiscountMinor: price.promotionDiscountMinor,
      couponDiscountMinor: price.couponDiscountMinor,
      delivery: { ...deliveryQuote, options: deliveryOptions.slots },
      vatMinor: price.taxMinor,
      subtotalMinor: price.subtotalMinor,
      discountMinor: price.discountMinor,
      totalMinor: price.totalMinor,
      requiresAgeVerification: age.requiresAgeVerification,
      requiredAge: age.requiredAge,
      requiresManualCapture,
      blockers: [],
      deliveryAddress: input.deliveryAddress,
      deliverySlotId: input.deliverySlotId ?? null,
    };
  }

  async create(identity: Identity, raw: unknown) {
    const input = checkoutSessionCreateSchema.parse(raw);
    if ('guestSessionId' in identity && !input.guest)
      throw new BadRequestException({
        code: 'GUEST_DETAILS_REQUIRED',
        message: 'Guest name, email, phone, and address are required',
      });
    const summary = await this.validate(identity, input);
    const snapshot = normalise({ summary, request: input });
    const snapshotHash = hash(snapshot);
    const stale = await this.db.client.checkoutSession.findMany({
      where: {
        cartId: summary.cartId,
        status: 'ACTIVE',
        OR: [{ snapshotHash: { not: snapshotHash } }, { expiresAt: { lte: new Date() } }],
      },
      select: { id: true },
    });
    for (const session of stale) await this.release(session.id, 'INVALIDATED');
    const existing = await this.db.client.checkoutSession.findFirst({
      where: {
        cartId: summary.cartId,
        status: 'ACTIVE',
        snapshotHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) return this.publicSession(existing);
    const expiresAt = new Date(
      Date.now() + this.config.values.CHECKOUT_RESERVATION_TTL_MINUTES * 60_000,
    );
    return this.db.transaction(async (tx, tenantId) => {
      const lockedCart = await tx.$queryRaw<Array<{ id: string; version: number }>>`
        SELECT "id", "version" FROM "Cart"
        WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${summary.cartId}::uuid AND "status" = 'ACTIVE'
        FOR UPDATE`;
      if (lockedCart[0]?.version !== summary.cartVersion)
        throw new ConflictException({
          code: 'CHECKOUT_SNAPSHOT_CHANGED',
          message: 'Basket changed while checkout was created',
        });
      let guestUserId: string | null = null;
      if ('guestSessionId' in identity && input.guest) {
        const guest = await tx.user.create({
          data: {
            tenantId,
            email: `guest+${randomUUID()}@tombstone.invalid`,
            passwordHash: 'GUEST_CHECKOUT_NO_LOGIN',
            firstName: input.guest.firstName,
            lastName: input.guest.lastName,
            phone: input.guest.phone,
            active: false,
            tombstonedAt: new Date(),
          },
        });
        guestUserId = guest.id;
      }
      const session = await tx.checkoutSession.create({
        data: {
          tenantId,
          cartId: summary.cartId,
          ...this.owner(identity),
          guestUserId,
          deliverySlotId: input.deliverySlotId,
          snapshot: snapshot as Prisma.InputJsonValue,
          snapshotHash,
          currency: summary.currency,
          totalMinor: summary.totalMinor,
          expiresAt,
        },
      });
      const cartItems = await tx.cartItem.findMany({ where: { tenantId, cartId: summary.cartId } });
      for (const item of cartItems) {
        const rows = await tx.$queryRaw<LockedInventory[]>`
          SELECT "id", "productId", "onHand", "reserved" FROM "Inventory"
          WHERE "tenantId" = ${tenantId}::uuid AND "productId" = ${item.productId}::uuid
          ORDER BY ("onHand" - "reserved") DESC FOR UPDATE`;
        const inventory = rows.find((row) => row.onHand - row.reserved >= item.quantity);
        if (!inventory)
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: 'Stock changed while checkout was created',
          });
        await tx.inventory.update({
          where: { id: inventory.id },
          data: { reserved: inventory.reserved + item.quantity, version: { increment: 1 } },
        });
        await tx.stockReservation.create({
          data: {
            tenantId,
            checkoutSessionId: session.id,
            inventoryId: inventory.id,
            productId: item.productId,
            quantity: item.quantity,
            expiresAt,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            inventoryId: inventory.id,
            reason: 'RESERVATION',
            quantity: item.quantity,
            reference: `checkout:${session.id}`,
            actorId: TenantContext.get()?.userId ?? null,
          },
        });
      }
      return this.publicSession(session);
    });
  }

  async get(identity: Identity, id: string) {
    const session = await this.owned(identity, id);
    if (session.status !== 'ACTIVE') return this.publicSession(session);
    if (session.expiresAt <= new Date()) {
      await this.release(id, 'EXPIRED');
      throw new ConflictException({
        code: 'CHECKOUT_SESSION_EXPIRED',
        message: 'Checkout session expired',
      });
    }
    const snapshot = session.snapshot as {
      summary?: {
        cartVersion?: number;
        totalMinor?: string;
        discountMinor?: string;
        vatMinor?: string;
      };
      request?: {
        deliveryAddress?: { postcode?: string };
        deliverySlotId?: string;
        couponCode?: string;
      };
    };
    let current = false;
    try {
      const cart = await this.db.client.cart.findFirst({ where: { id: session.cartId } });
      if (cart && cart.version === snapshot.summary?.cartVersion) {
        const items = await this.db.client.cartItem.findMany({ where: { cartId: cart.id } });
        const products = await this.db.client.product.findMany({
          where: { id: { in: items.map((item) => item.productId) } },
        });
        const byId = new Map(products.map((product) => [product.id, product]));
        const catalogueCurrent = items.every((item) => {
          const product = byId.get(item.productId);
          return product?.status === 'ACTIVE' && product.priceMinor === item.priceSnapshotMinor;
        });
        const postcode = snapshot.request?.deliveryAddress?.postcode;
        if (catalogueCurrent && postcode) {
          const price = await this.pricing.quote(identity, {
            postcode,
            ...(snapshot.request?.couponCode ? { couponCode: snapshot.request.couponCode } : {}),
          });
          const slots = await this.delivery.availableSlots(identity, postcode);
          await this.age.validate(identity, postcode);
          current =
            price.totalMinor.toString() === snapshot.summary?.totalMinor &&
            price.discountMinor.toString() === snapshot.summary?.discountMinor &&
            price.taxMinor.toString() === snapshot.summary?.vatMinor &&
            (!snapshot.request?.deliverySlotId ||
              slots.slots.some((slot) => slot.id === snapshot.request?.deliverySlotId));
        }
      }
    } catch {
      current = false;
    }
    if (!current) {
      await this.release(id, 'INVALIDATED');
      throw new ConflictException({
        code: 'CHECKOUT_SNAPSHOT_CHANGED',
        message: 'Basket changed; payment intent must be invalidated',
      });
    }
    return this.publicSession(session);
  }

  async cancel(identity: Identity, id: string) {
    await this.owned(identity, id);
    await this.release(id, 'CANCELLED');
    return { cancelled: true, id };
  }

  async releaseExpired(now = new Date()) {
    const sessions = await this.db.client.checkoutSession.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      select: { id: true },
    });
    for (const session of sessions) await this.release(session.id, 'EXPIRED');
    return { released: sessions.length };
  }

  private async release(id: string, status: 'EXPIRED' | 'INVALIDATED' | 'CANCELLED') {
    return this.db.transaction(async (tx, tenantId) => {
      const reservations = await tx.stockReservation.findMany({
        where: { tenantId, checkoutSessionId: id, releasedAt: null },
      });
      for (const reservation of reservations) {
        const rows = await tx.$queryRaw<
          LockedInventory[]
        >`SELECT "id", "productId", "onHand", "reserved" FROM "Inventory" WHERE "tenantId" = ${tenantId}::uuid AND "id" = ${reservation.inventoryId}::uuid FOR UPDATE`;
        const inventory = rows[0];
        if (inventory) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reserved: Math.max(0, inventory.reserved - reservation.quantity),
              version: { increment: 1 },
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              tenantId,
              inventoryId: inventory.id,
              reason: 'RELEASE',
              quantity: reservation.quantity,
              reference: `checkout:${id}`,
            },
          });
        }
        await tx.stockReservation.update({
          where: { id: reservation.id },
          data: { releasedAt: new Date() },
        });
      }
      return tx.checkoutSession.update({ where: { id }, data: { status } });
    });
  }

  private owned(identity: Identity, id: string) {
    return this.db.client.checkoutSession
      .findFirst({ where: { id, ...this.owner(identity) } })
      .then((session) => {
        if (!session) throw new NotFoundException('Checkout session not found');
        return session;
      });
  }

  private owner(identity: Identity) {
    return 'userId' in identity
      ? { userId: identity.userId }
      : { guestToken: identity.guestSessionId };
  }

  private publicSession(session: {
    id: string;
    snapshotHash: string;
    currency: string;
    totalMinor: bigint;
    status: string;
    expiresAt: Date;
  }) {
    return {
      id: session.id,
      snapshotHash: session.snapshotHash,
      currency: session.currency,
      totalMinor: session.totalMinor,
      status: session.status,
      expiresAt: session.expiresAt,
    };
  }
}

function normalise(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalise(child)]),
    );
  return value;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
