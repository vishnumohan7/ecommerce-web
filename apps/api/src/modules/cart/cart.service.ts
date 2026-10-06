import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Cart, CartItem, OrderCategory, Prisma, Product } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { PricingService } from '../pricing/pricing.service';
import {
  addCartItemSchema,
  couponSchema,
  substitutionSchema,
  updateCartItemSchema,
} from './cart.schemas';

export type CartIdentity = { userId: string } | { guestSessionId: string; expiresAt: Date };
interface CartChange {
  type: string;
  itemId?: string;
  productId?: string;
  from?: string | number;
  to?: string | number;
  requested?: number;
  applied?: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly pricing: PricingService,
  ) {}

  async read(identity: CartIdentity) {
    const cart = await this.getOrCreate(identity);
    return this.view(cart, identity);
  }

  async add(identity: CartIdentity, raw: unknown) {
    const input = addCartItemSchema.parse(raw);
    const cart = await this.getOrCreate(identity);
    const product = await this.activeProduct(input.productId);
    const available = await this.availableStock(product.id);
    const existing = await this.db.client.cartItem.findFirst({
      where: { cartId: cart.id, productId: product.id },
    });
    const requested = (existing?.quantity ?? 0) + input.quantity;
    if (requested > available)
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Requested quantity exceeds available stock',
        details: { available },
      });
    const snapshot = this.snapshot(product);
    if (existing)
      await this.db.client.cartItem.update({
        where: { id: existing.id },
        data: { quantity: requested, ...snapshot },
      });
    else
      await this.db.client.cartItem.create({
        data: {
          tenantId: TenantContext.requireTenantId(),
          cartId: cart.id,
          productId: product.id,
          quantity: input.quantity,
          substitutionPreference: 'SIMILAR',
          ...snapshot,
        },
      });
    await this.bump(cart.id);
    return this.view(cart, identity);
  }

  async update(identity: CartIdentity, itemId: string, raw: unknown) {
    const input = updateCartItemSchema.parse(raw);
    const { cart, item } = await this.ownedItem(identity, itemId);
    const product = await this.activeProduct(item.productId);
    const available = await this.availableStock(product.id);
    if (input.quantity > available)
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Requested quantity exceeds available stock',
        details: { available },
      });
    await this.db.client.cartItem.update({
      where: { id: item.id },
      data: { quantity: input.quantity },
    });
    await this.bump(cart.id);
    return this.view(cart, identity);
  }

  async remove(identity: CartIdentity, itemId: string) {
    const { cart, item } = await this.ownedItem(identity, itemId);
    await this.db.client.cartItem.delete({ where: { id: item.id } });
    await this.bump(cart.id);
    return this.view(cart, identity);
  }

  async substitution(identity: CartIdentity, itemId: string, raw: unknown) {
    const input = substitutionSchema.parse(raw);
    const { cart, item } = await this.ownedItem(identity, itemId);
    await this.db.client.cartItem.update({
      where: { id: item.id },
      data: { substitutionPreference: input.preference },
    });
    await this.bump(cart.id);
    return this.view(cart, identity);
  }

  async applyCoupon(identity: CartIdentity, raw: unknown) {
    const input = couponSchema.parse(raw);
    const cart = await this.getOrCreate(identity);
    const now = new Date();
    const coupon = await this.db.client.coupon.findFirst({
      where: { code: input.code, active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    });
    if (!coupon || (coupon.maxUses !== null && coupon.uses >= coupon.maxUses))
      throw new UnprocessableEntityException({
        code: 'COUPON_INVALID',
        message: 'Coupon is unavailable or expired',
      });
    await this.db.client.cart.update({
      where: { id: cart.id },
      data: { couponCode: coupon.code, version: { increment: 1 } },
    });
    return this.view({ ...cart, couponCode: coupon.code }, identity);
  }

  async removeCoupon(identity: CartIdentity) {
    const cart = await this.getOrCreate(identity);
    await this.db.client.cart.update({
      where: { id: cart.id },
      data: { couponCode: null, version: { increment: 1 } },
    });
    return this.view({ ...cart, couponCode: null }, identity);
  }

  async merge(userId: string, guestSessionId?: string) {
    if (!guestSessionId) return this.read({ userId });
    const tenantId = TenantContext.requireTenantId();
    const conflicts: CartChange[] = [];
    const targetId = await this.db.transaction(async (tx) => {
      const carts = await tx.$queryRaw<
        Cart[]
      >`SELECT * FROM "Cart" WHERE "tenantId" = ${tenantId}::uuid AND "status" = 'ACTIVE' AND ("userId" = ${userId}::uuid OR "guestToken" = ${guestSessionId}) FOR UPDATE`;
      const guest = carts.find((cart) => cart.guestToken === guestSessionId);
      let target = carts.find((cart) => cart.userId === userId);
      if (!target) target = await tx.cart.create({ data: { tenantId, userId, expiresAt: null } });
      if (!guest || guest.id === target.id) return target.id;
      const guestItems = await tx.cartItem.findMany({ where: { tenantId, cartId: guest.id } });
      for (const source of guestItems) {
        const product = await tx.product.findFirst({
          where: { tenantId, id: source.productId, status: 'ACTIVE' },
        });
        if (!product) {
          conflicts.push({
            type: 'PRODUCT_REMOVED',
            itemId: source.id,
            productId: source.productId,
          });
          continue;
        }
        const inventory = await tx.inventory.aggregate({
          where: { tenantId, productId: source.productId },
          _sum: { stockAvailable: true },
        });
        const available = inventory._sum.stockAvailable ?? 0;
        const existing = await tx.cartItem.findFirst({
          where: { tenantId, cartId: target.id, productId: source.productId },
        });
        const requested = (existing?.quantity ?? 0) + source.quantity;
        const applied = Math.min(requested, available);
        if (applied < requested)
          conflicts.push({
            type: 'QUANTITY_CAPPED',
            productId: source.productId,
            requested,
            applied,
          });
        if (applied > 0) {
          const snapshot = this.snapshot(product);
          if (existing)
            await tx.cartItem.update({
              where: { id: existing.id },
              data: { quantity: applied, ...snapshot },
            });
          else
            await tx.cartItem.create({
              data: {
                tenantId,
                cartId: target.id,
                productId: product.id,
                quantity: applied,
                substitutionPreference: source.substitutionPreference,
                ...snapshot,
              },
            });
        }
      }
      await tx.cart.update({
        where: { id: guest.id },
        data: { status: 'CONVERTED', expiresAt: new Date(), version: { increment: 1 } },
      });
      await tx.cart.update({ where: { id: target.id }, data: { version: { increment: 1 } } });
      return target.id;
    });
    const cart = await this.db.client.cart.findFirstOrThrow({ where: { id: targetId } });
    const view = await this.view(cart, { userId });
    return { ...view, changes: [...conflicts, ...view.changes] };
  }

  abandonInactive(before: Date) {
    return this.db.client.cart.updateMany({
      where: { status: 'ACTIVE', updatedAt: { lt: before } },
      data: { status: 'ABANDONED', abandonedAt: new Date() },
    });
  }

  private async view(cart: Cart, identity: CartIdentity) {
    const items = await this.db.client.cartItem.findMany({
      where: { cartId: cart.id },
      orderBy: { createdAt: 'asc' },
    });
    const productIds = items.map((item) => item.productId);
    const [products, inventory] = await Promise.all([
      this.db.client.product.findMany({ where: { id: { in: productIds } } }),
      this.db.client.inventory.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _sum: { stockAvailable: true },
      }),
    ]);
    const productById = new Map(products.map((product) => [product.id, product]));
    const stockById = new Map(
      inventory.map((entry) => [entry.productId, entry._sum.stockAvailable ?? 0]),
    );
    const changes: CartChange[] = [];
    const removeIds: string[] = [];
    const grouped: Record<OrderCategory, Array<Record<string, unknown>>> = {
      GROCERY: [],
      ALCOHOL: [],
    };
    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product || product.status !== 'ACTIVE') {
        changes.push({ type: 'PRODUCT_REMOVED', itemId: item.id, productId: item.productId });
        removeIds.push(item.id);
        continue;
      }
      if (product.priceMinor !== item.priceSnapshotMinor)
        changes.push({
          type: 'PRICE_CHANGED',
          itemId: item.id,
          productId: item.productId,
          from: item.priceSnapshotMinor.toString(),
          to: product.priceMinor.toString(),
        });
      if (product.ageRestriction !== item.snapshotAgeRestriction)
        changes.push({
          type: 'AGE_RESTRICTION_CHANGED',
          itemId: item.id,
          productId: item.productId,
          from: item.snapshotAgeRestriction,
          to: product.ageRestriction,
        });
      const available = stockById.get(item.productId) ?? 0;
      if (item.quantity > available)
        changes.push({
          type: 'STOCK_CHANGED',
          itemId: item.id,
          productId: item.productId,
          requested: item.quantity,
          applied: available,
        });
      if (item.snapshotStaleAt <= new Date())
        changes.push({ type: 'SNAPSHOT_STALE', itemId: item.id, productId: item.productId });
      grouped[item.orderCategory].push({
        id: item.id,
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: item.quantity,
        orderCategory: item.orderCategory,
        substitutionPreference: item.substitutionPreference,
        priceSnapshotMinor: item.priceSnapshotMinor.toString(),
        currentPriceMinor: product.priceMinor.toString(),
        availableStock: available,
        ageRestriction: product.ageRestriction,
        isAlcohol: product.isAlcohol,
      });
    }
    if (removeIds.length > 0)
      await this.db.client.cartItem.deleteMany({ where: { id: { in: removeIds } } });
    const breakdown = await this.pricing.quote(identity, {});
    const pricedLineById = new Map(breakdown.lines.map((line) => [line.id, line]));
    for (const item of [...grouped.GROCERY, ...grouped.ALCOHOL]) {
      const priced = pricedLineById.get(String(item['id']));
      item['lineSubtotalMinor'] = priced?.baseMinor.toString() ?? '0';
      item['lineDiscountMinor'] = priced?.discountMinor.toString() ?? '0';
      item['lineTotalMinor'] = priced?.totalMinor.toString() ?? '0';
      item['vatMinor'] = priced?.vatMinor.toString() ?? '0';
    }
    const makeGroup = (category: OrderCategory) => {
      const categoryItems = grouped[category];
      const subtotal =
        category === 'GROCERY' ? breakdown.grocerySubtotalMinor : breakdown.alcoholSubtotalMinor;
      return { category, items: categoryItems, subtotalMinor: subtotal.toString() };
    };
    const groups = [makeGroup('GROCERY'), makeGroup('ALCOHOL')];
    return {
      id: cart.id,
      status: cart.status,
      currency: cart.currency,
      version: cart.version,
      couponCode: cart.couponCode,
      groups,
      totals: {
        subtotalMinor: breakdown.subtotalMinor.toString(),
        discountMinor: breakdown.discountMinor.toString(),
        taxMinor: breakdown.taxMinor.toString(),
        grandTotalMinor: breakdown.totalMinor.toString(),
      },
      requiresAgeVerification: grouped.ALCOHOL.some((item) => Number(item['ageRestriction']) > 0),
      changes,
    };
  }

  private async getOrCreate(identity: CartIdentity): Promise<Cart> {
    const where =
      'userId' in identity
        ? { userId: identity.userId, status: 'ACTIVE' as const }
        : { guestToken: identity.guestSessionId, status: 'ACTIVE' as const };
    const found = await this.db.client.cart.findFirst({ where });
    if (found) return found;
    try {
      return await this.db.client.cart.create({
        data: {
          tenantId: TenantContext.requireTenantId(),
          ...('userId' in identity
            ? { userId: identity.userId }
            : { guestToken: identity.guestSessionId, expiresAt: identity.expiresAt }),
        },
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      return this.db.client.cart.findFirstOrThrow({ where });
    }
  }
  private async activeProduct(id: string): Promise<Product> {
    const product = await this.db.client.product.findFirst({ where: { id, status: 'ACTIVE' } });
    if (!product) throw new NotFoundException('Product is unavailable');
    return product;
  }
  private async availableStock(productId: string): Promise<number> {
    const result = await this.db.client.inventory.aggregate({
      where: { productId },
      _sum: { stockAvailable: true },
    });
    return result._sum.stockAvailable ?? 0;
  }
  private snapshot(
    product: Product,
  ): Pick<
    Prisma.CartItemUncheckedCreateInput,
    | 'orderCategory'
    | 'priceSnapshotMinor'
    | 'snapshotAgeRestriction'
    | 'snapshotStaleAt'
    | 'currency'
  > {
    return {
      orderCategory: product.isAlcohol ? 'ALCOHOL' : 'GROCERY',
      priceSnapshotMinor: product.priceMinor,
      snapshotAgeRestriction: product.ageRestriction,
      snapshotStaleAt: new Date(Date.now() + 15 * 60 * 1000),
      currency: product.currency,
    };
  }
  private async ownedItem(
    identity: CartIdentity,
    itemId: string,
  ): Promise<{ cart: Cart; item: CartItem }> {
    const cart = await this.getOrCreate(identity);
    const item = await this.db.client.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    return { cart, item };
  }
  private bump(cartId: string) {
    return this.db.client.cart.update({
      where: { id: cartId },
      data: { version: { increment: 1 } },
    });
  }
}
