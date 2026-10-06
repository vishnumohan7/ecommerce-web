import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Coupon, Prisma } from '@prisma/client';
import { Money } from '@app/money';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import type { DeliveryIdentity } from '../delivery/delivery.service';
import { DeliveryService } from '../delivery/delivery.service';
import {
  calculatePricing,
  type PricingCalculationInput,
  type PricingLineInput,
} from './pricing.calculator';
import { couponCreateSchema, couponUpdateSchema, influencerCreateSchema } from './pricing.schemas';
import { TaxRuleService } from './tax-rule.service';

export type PricingIdentity = DeliveryIdentity;
type JsonRecord = Record<string, unknown>;

@Injectable()
export class PricingService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly delivery: DeliveryService,
    private readonly taxes: TaxRuleService,
  ) {}

  /** The sole entry point for arithmetic in the commerce API. */
  calculate(input: PricingCalculationInput) {
    return calculatePricing(input);
  }

  /** Unwinds the persisted line total, allocated discount and VAT exactly by unit. */
  calculateRefund(
    line: {
      quantity: number;
      lineTotalMinor: bigint;
      vatAmountMinor: bigint;
      discountMinor: bigint;
    },
    quantity: number,
    alreadyRefundedQuantity = 0,
  ) {
    if (
      quantity <= 0 ||
      alreadyRefundedQuantity < 0 ||
      alreadyRefundedQuantity + quantity > line.quantity
    )
      throw new UnprocessableEntityException({
        code: 'REFUND_QUANTITY_INVALID',
        message: 'Refund quantity exceeds the remaining item quantity',
      });
    const weights = Array.from({ length: line.quantity }, () => 1n);
    const amountShares = Money.of(line.lineTotalMinor).allocate(weights);
    const vatShares = Money.of(line.vatAmountMinor).allocate(weights);
    const discountShares = Money.of(line.discountMinor).allocate(weights);
    const start = alreadyRefundedQuantity;
    const end = start + quantity;
    return {
      quantity,
      amountMinor: amountShares.slice(start, end).reduce((sum, share) => sum + share.minor, 0n),
      vatPortionMinor: vatShares.slice(start, end).reduce((sum, share) => sum + share.minor, 0n),
      discountPortionMinor: discountShares
        .slice(start, end)
        .reduce((sum, share) => sum + share.minor, 0n),
    };
  }

  async quote(
    identity: PricingIdentity,
    input: { postcode?: string | undefined; couponCode?: string | undefined },
  ) {
    const cart = await this.cart(identity);
    const items = await this.db.client.cartItem.findMany({ where: { cartId: cart.id } });
    const products = await this.db.client.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        categoryId: true,
        brandId: true,
        taxCategory: true,
        isAlcohol: true,
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    const lines: PricingLineInput[] = items.flatMap((item) => {
      const product = productById.get(item.productId);
      return product
        ? [
            {
              id: item.id,
              productId: item.productId,
              categoryId: product.categoryId,
              brandId: product.brandId,
              quantity: item.quantity,
              unitPriceMinor: item.priceSnapshotMinor,
              taxCategory: product.taxCategory,
              isAlcohol: product.isAlcohol,
            },
          ]
        : [];
    });
    const promotionResult = await this.applyPromotions(lines);
    const code = (input.couponCode ?? cart.couponCode)?.toUpperCase();
    const subtotalAfterPromotions = lines.reduce(
      (sum, line) =>
        sum + line.unitPriceMinor * BigInt(line.quantity) - (line.promotionDiscountMinor ?? 0n),
      0n,
    );
    const coupon = code
      ? await this.validCoupon(code, identity, subtotalAfterPromotions)
      : undefined;
    const taxRates = await this.taxes.effectiveRates();
    const quotedDeliveryFeeMinor = input.postcode
      ? (await this.delivery.quote(identity, input.postcode)).deliveryFeeMinor
      : 0n;
    const deliveryFeeMinor = promotionResult.freeDelivery ? 0n : quotedDeliveryFeeMinor;
    const couponInput = coupon
      ? {
          type: coupon.type === 'PERCENTAGE' ? ('PERCENTAGE' as const) : ('FIXED' as const),
          valueBps: coupon.valueBps,
          valueMinor: coupon.valueMinor,
          maximumDiscountMinor: coupon.maximumDiscountMinor,
          appliesTo: coupon.appliesTo,
          productIds: coupon.productIds,
          categoryIds: coupon.categoryIds,
          brandIds: coupon.brandIds,
        }
      : undefined;
    const hasPromotionDiscount = lines.some((line) => (line.promotionDiscountMinor ?? 0n) > 0n);
    let result = this.calculate({
      currency: cart.currency,
      lines,
      taxRates,
      ...(couponInput && !(promotionResult.policy === 'NONE' && hasPromotionDiscount)
        ? { coupon: couponInput }
        : {}),
      deliveryFeeMinor,
    });
    if (couponInput && promotionResult.policy === 'BEST_ONLY' && hasPromotionDiscount) {
      const couponOnly = this.calculate({
        currency: cart.currency,
        lines: lines.map((line) => ({ ...line, promotionDiscountMinor: 0n })),
        taxRates,
        coupon: couponInput,
        deliveryFeeMinor,
      });
      const promotionOnly = this.calculate({
        currency: cart.currency,
        lines,
        taxRates,
        deliveryFeeMinor,
      });
      result = couponOnly.discountMinor > promotionOnly.discountMinor ? couponOnly : promotionOnly;
    }
    return { ...result, cartId: cart.id, couponCode: coupon?.code ?? null };
  }

  async validateCoupon(identity: PricingIdentity, code: string) {
    const quote = await this.quote(identity, { couponCode: code });
    return {
      valid: true,
      code: quote.couponCode,
      discountMinor: quote.couponDiscountMinor,
      currency: quote.currency,
    };
  }

  async redeem(
    identity: PricingIdentity,
    code: string,
    discountMinor: bigint,
    order: {
      orderId?: string;
      orderRevenueMinor?: bigint;
      orderTaxMinor?: bigint;
      deliveryFeeMinor?: bigint;
    } = {},
  ) {
    const tenantId = TenantContext.requireTenantId();
    const normalised = code.trim().toUpperCase();
    return this.db.transaction(async (tx) => {
      const rows = await tx.$queryRaw<Coupon[]>`
        SELECT * FROM "Coupon"
        WHERE "tenantId" = ${tenantId}::uuid AND "code" = ${normalised}
        FOR UPDATE`;
      const coupon = rows[0];
      if (!coupon || !coupon.active || coupon.startsAt > new Date() || coupon.endsAt < new Date())
        throw this.invalidCoupon();
      if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses)
        throw new ConflictException({
          code: 'COUPON_EXHAUSTED',
          message: 'Coupon usage limit reached',
        });
      const owner =
        'userId' in identity
          ? { userId: identity.userId, guestToken: null }
          : { userId: null, guestToken: identity.guestSessionId };
      if (coupon.perCustomerLimit !== null) {
        const count = await tx.couponRedemption.count({
          where: {
            tenantId,
            couponId: coupon.id,
            ...(owner.userId ? { userId: owner.userId } : { guestToken: owner.guestToken }),
          },
        });
        if (count >= coupon.perCustomerLimit)
          throw new ConflictException({
            code: 'COUPON_CUSTOMER_LIMIT',
            message: 'Customer coupon limit reached',
          });
      }
      await tx.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } });
      const redemption = await tx.couponRedemption.create({
        data: {
          tenantId,
          couponId: coupon.id,
          ...owner,
          ...(order.orderId ? { orderId: order.orderId } : {}),
          discountMinor,
        },
      });
      if (coupon.influencerId && order.orderId && order.orderRevenueMinor !== undefined) {
        const influencer = await tx.influencer.findFirst({
          where: { tenantId, id: coupon.influencerId, active: true },
        });
        if (influencer) {
          const deductions =
            coupon.commissionBasis === 'NET_EX_VAT_DELIVERY'
              ? (order.orderTaxMinor ?? 0n) + (order.deliveryFeeMinor ?? 0n)
              : 0n;
          const revenueMinor =
            order.orderRevenueMinor > deductions ? order.orderRevenueMinor - deductions : 0n;
          await tx.affiliateAttribution.create({
            data: {
              tenantId,
              influencerId: influencer.id,
              orderId: order.orderId,
              revenueMinor,
              commissionMinor: (revenueMinor * BigInt(influencer.commissionBps)) / 10_000n,
              currency: coupon.currency,
            },
          });
        }
      }
      return redemption;
    });
  }

  coupons() {
    return this.db.client.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createCoupon(raw: unknown) {
    const input = couponCreateSchema.parse(raw);
    const data: Prisma.CouponUncheckedCreateInput = {
      tenantId: TenantContext.requireTenantId(),
      ...input,
      valueBps: input.valueBps ?? null,
      valueMinor: input.valueMinor ?? null,
      minimumSpendMinor: input.minimumSpendMinor ?? null,
      maximumDiscountMinor: input.maximumDiscountMinor ?? null,
      maxUses: input.maxUses ?? null,
      perCustomerLimit: input.perCustomerLimit ?? null,
      influencerId: input.influencerId ?? null,
    };
    return this.db.transaction(async (tx, tenantId) => {
      const coupon = await tx.coupon.create({ data });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: 'USER',
          action: 'COUPON_CREATE',
          entity: 'Coupon',
          entityId: coupon.id,
          after: {
            code: coupon.code,
            couponClass: coupon.couponClass,
            appliesTo: coupon.appliesTo,
          },
          requestId: TenantContext.get()?.requestId ?? coupon.id,
        },
      });
      return coupon;
    });
  }

  async updateCoupon(id: string, raw: unknown) {
    const input = couponUpdateSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const before = await tx.coupon.findFirst({ where: { tenantId, id } });
      if (!before) throw new NotFoundException('Coupon not found');
      const coupon = await tx.coupon.update({
        where: { id },
        data: input as Prisma.CouponUncheckedUpdateInput,
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: 'USER',
          action: 'COUPON_UPDATE',
          entity: 'Coupon',
          entityId: coupon.id,
          before: { active: before.active, uses: before.uses, endsAt: before.endsAt.toISOString() },
          after: { active: coupon.active, uses: coupon.uses, endsAt: coupon.endsAt.toISOString() },
          requestId: TenantContext.get()?.requestId ?? coupon.id,
        },
      });
      return coupon;
    });
  }

  influencers() {
    return this.db.client.influencer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createInfluencer(raw: unknown) {
    return this.db.client.influencer.create({
      data: { tenantId: TenantContext.requireTenantId(), ...influencerCreateSchema.parse(raw) },
    });
  }

  async influencerReport(id: string) {
    const influencer = await this.db.client.influencer.findFirst({ where: { id } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    const totals = await this.db.client.affiliateAttribution.aggregate({
      where: { influencerId: id },
      _count: true,
      _sum: { revenueMinor: true, commissionMinor: true },
    });
    return { influencer, orders: totals._count, ...totals._sum, currency: 'GBP' };
  }

  taxRules() {
    return this.taxes.list();
  }

  createTaxRule(raw: unknown) {
    return this.taxes.create(raw);
  }

  private async cart(identity: PricingIdentity) {
    const cart = await this.db.client.cart.findFirst({
      where: {
        status: 'ACTIVE',
        ...('userId' in identity
          ? { userId: identity.userId }
          : { guestToken: identity.guestSessionId }),
      },
    });
    if (!cart)
      throw new NotFoundException({ code: 'CART_NOT_FOUND', message: 'Active cart not found' });
    return cart;
  }

  private async validCoupon(code: string, identity: PricingIdentity, subtotalMinor: bigint) {
    const now = new Date();
    const coupon = await this.db.client.coupon.findFirst({
      where: { code, active: true, startsAt: { lte: now }, endsAt: { gte: now } },
    });
    if (!coupon || (coupon.maxUses !== null && coupon.uses >= coupon.maxUses))
      throw this.invalidCoupon();
    if (coupon.lockedUserId && (!('userId' in identity) || identity.userId !== coupon.lockedUserId))
      throw this.invalidCoupon();
    if (coupon.minimumSpendMinor !== null && subtotalMinor < coupon.minimumSpendMinor)
      throw new UnprocessableEntityException({
        code: 'COUPON_MINIMUM_SPEND',
        message: 'Basket does not meet coupon minimum spend',
      });
    const ownerWhere =
      'userId' in identity ? { userId: identity.userId } : { guestToken: identity.guestSessionId };
    if (coupon.perCustomerLimit !== null) {
      const count = await this.db.client.couponRedemption.count({
        where: { couponId: coupon.id, ...ownerWhere },
      });
      if (count >= coupon.perCustomerLimit) throw this.invalidCoupon();
    }
    if (coupon.firstOrderOnly) {
      const prior =
        'userId' in identity
          ? await this.db.client.order.count({ where: { userId: identity.userId } })
          : await this.db.client.couponRedemption.count({
              where: { couponId: coupon.id, guestToken: identity.guestSessionId },
            });
      if (prior > 0) throw this.invalidCoupon();
    }
    return coupon;
  }

  private invalidCoupon() {
    return new UnprocessableEntityException({
      code: 'COUPON_INVALID',
      message: 'Coupon is unavailable, expired, or not eligible',
    });
  }

  private async applyPromotions(lines: PricingLineInput[]) {
    if (lines.length === 0) return { freeDelivery: false, policy: 'STACK' };
    const now = new Date();
    const promotions = await this.db.client.promotion.findMany({
      where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { priority: 'desc' },
    });
    const settings = await this.db.client.tenantSettings.findFirst();
    const pricing = ((settings?.settings as JsonRecord | null)?.pricing ?? {}) as JsonRecord;
    const policy =
      typeof pricing.couponStackingPolicy === 'string' ? pricing.couponStackingPolicy : 'STACK';
    let freeDelivery = false;
    for (const promotion of promotions) {
      const [links, rule, multibuy] = await Promise.all([
        this.db.client.promotionProduct.findMany({ where: { promotionId: promotion.id } }),
        this.db.client.promotionRule.findFirst({ where: { promotionId: promotion.id } }),
        promotion.type === 'MULTIBUY'
          ? this.db.client.multibuyGroup.findFirst({ where: { promotionId: promotion.id } })
          : null,
      ]);
      const ids = new Set(links.map((link) => link.productId));
      const conditions = (rule?.conditions ?? {}) as JsonRecord;
      const effect = (rule?.effect ?? {}) as JsonRecord;
      const eligible = lines.filter((candidate) => ids.size === 0 || ids.has(candidate.productId));
      const eligibleSubtotal = eligible.reduce(
        (sum, line) => sum + line.unitPriceMinor * BigInt(line.quantity),
        0n,
      );
      const thresholdValue = conditions.minimumSpendMinor ?? conditions.thresholdMinor;
      const threshold =
        typeof thresholdValue === 'string' || typeof thresholdValue === 'number'
          ? BigInt(thresholdValue)
          : 0n;
      if (eligibleSubtotal < threshold) continue;
      if (promotion.type === 'FREE_DELIVERY') {
        freeDelivery = true;
        continue;
      }
      if (promotion.type === 'FIXED' && eligible.length > 0) {
        const value = effect.valueMinor;
        const fixed = BigInt(typeof value === 'string' || typeof value === 'number' ? value : 0);
        const totalDiscount = fixed < eligibleSubtotal ? fixed : eligibleSubtotal;
        const shares = Money.of(totalDiscount).allocate(
          eligible.map((line) => line.unitPriceMinor * BigInt(line.quantity)),
        );
        eligible.forEach((line, index) => {
          this.applyPromotionDiscount(line, shares[index]?.minor ?? 0n, policy);
        });
        continue;
      }
      for (const line of eligible) {
        const gross = line.unitPriceMinor * BigInt(line.quantity);
        let discount = 0n;
        if (promotion.type === 'PERCENTAGE')
          discount = (gross * BigInt(Number(effect.valueBps ?? 0))) / 10_000n;
        if (promotion.type === 'MULTIBUY' && multibuy && line.quantity >= multibuy.buyQuantity)
          discount =
            line.unitPriceMinor *
            BigInt(
              Math.floor(line.quantity / multibuy.buyQuantity) *
                (multibuy.buyQuantity - multibuy.payQuantity),
            );
        this.applyPromotionDiscount(line, discount, policy);
      }
    }
    return { freeDelivery, policy };
  }

  private applyPromotionDiscount(line: PricingLineInput, discount: bigint, policy: string) {
    const current = line.promotionDiscountMinor ?? 0n;
    if (policy === 'NONE' && current > 0n) return;
    line.promotionDiscountMinor =
      policy === 'BEST_ONLY' ? (discount > current ? discount : current) : current + discount;
  }
}
