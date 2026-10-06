import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import type { AgeIdentity } from './age-verification.service';
import { JurisdictionRuleService } from './jurisdiction-rule.service';

@Injectable()
export class CheckoutAgeGuardService {
  constructor(
    private readonly db: TenantScopedPrismaService,
    private readonly jurisdictions: JurisdictionRuleService,
  ) {}

  async validate(identity: AgeIdentity, deliveryPostcode: string, now = new Date()) {
    const owner =
      'userId' in identity ? { userId: identity.userId } : { guestToken: identity.guestSessionId };
    const cart = await this.db.client.cart.findFirst({ where: { ...owner, status: 'ACTIVE' } });
    if (!cart)
      throw new BadRequestException({ code: 'CART_EMPTY', message: 'An active cart is required' });
    const items = await this.db.client.cartItem.findMany({ where: { cartId: cart.id } });
    if (items.length === 0)
      throw new BadRequestException({ code: 'CART_EMPTY', message: 'The cart is empty' });
    const products = await this.db.client.product.findMany({
      where: { id: { in: items.map((item) => item.productId) }, status: 'ACTIVE' },
      select: { id: true, ageRestriction: true, isAlcohol: true },
    });
    const requiredAge = products.reduce(
      (maximum, product) => Math.max(maximum, product.ageRestriction),
      0,
    );
    if (requiredAge > 0) {
      const verification = await this.db.client.ageVerification.findFirst({
        where: {
          ...('userId' in identity
            ? { userId: identity.userId }
            : { guestToken: identity.guestSessionId }),
          status: 'PASSED',
          verifiedAgeOver: { gte: requiredAge },
          expiresAt: { gt: now },
        },
        orderBy: { verifiedAt: 'desc' },
      });
      if (!verification)
        throw new ForbiddenException({
          code: 'AGE_VERIFICATION_REQUIRED',
          message: `Age verification for age ${String(requiredAge)} or over is required`,
          details: { nextStep: '/api/v1/age-verification' },
        });
    }
    const alcoholBasket = products.some((product) => product.isAlcohol);
    const sale = await this.jurisdictions.saleDecision(deliveryPostcode, now);
    if (alcoholBasket && !sale.allowed)
      throw new ForbiddenException({
        code: 'OUTSIDE_PERMITTED_SALE_HOURS',
        message: 'Alcohol cannot be purchased at this time for the delivery jurisdiction',
        details: { jurisdiction: sale.jurisdiction.code, reopensAt: sale.reopensAt },
      });
    return {
      valid: true,
      requiresAgeVerification: requiredAge > 0,
      requiredAge,
      jurisdiction: sale.jurisdiction.code,
      challengeAge: sale.rules.challengeAge,
    };
  }
}
