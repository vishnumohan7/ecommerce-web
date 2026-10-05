import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma, PromotionType } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
export function assertHfssEligible(
  type: PromotionType,
  products: Array<{ sku: string; hfssStatus: 'NOT_IN_SCOPE' | 'IN_SCOPE' }>,
): void {
  if (type === 'MULTIBUY') {
    const blocked = products.filter((product) => product.hfssStatus === 'IN_SCOPE');
    if (blocked.length > 0)
      throw new UnprocessableEntityException({
        code: 'HFSS_VOLUME_PROMOTION_FORBIDDEN',
        message: 'HFSS products cannot participate in volume promotions',
        details: { skus: blocked.map((product) => product.sku) },
      });
  }
}
@Injectable()
export class PromotionsService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  async create(input: {
    name: string;
    type: PromotionType;
    startsAt: Date;
    endsAt: Date;
    productIds: string[];
    conditions: Record<string, unknown>;
    effect: Record<string, unknown>;
  }) {
    const products = await this.db.client.product.findMany({
      where: { id: { in: input.productIds } },
      select: { id: true, sku: true, hfssStatus: true },
    });
    assertHfssEligible(input.type, products);
    const conditions = JSON.parse(JSON.stringify(input.conditions)) as Prisma.InputJsonObject;
    const effect = JSON.parse(JSON.stringify(input.effect)) as Prisma.InputJsonObject;
    return this.db.transaction(async (tx, tenantId) => {
      const promotion = await tx.promotion.create({
        data: {
          tenantId,
          name: input.name,
          type: input.type,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
      });
      await tx.promotionRule.create({
        data: { tenantId, promotionId: promotion.id, conditions, effect },
      });
      if (input.productIds.length > 0)
        await tx.promotionProduct.createMany({
          data: input.productIds.map((productId) => ({
            tenantId,
            promotionId: promotion.id,
            productId,
          })),
        });
      if (input.type === 'MULTIBUY')
        await tx.multibuyGroup.create({
          data: {
            tenantId,
            promotionId: promotion.id,
            productIds: input.productIds,
            buyQuantity: Number(input.conditions.buyQuantity ?? 3),
            payQuantity: Number(input.effect.payQuantity ?? 2),
          },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: 'USER',
          action: 'PROMOTION_CREATE',
          entity: 'Promotion',
          entityId: promotion.id,
          after: { name: input.name, type: input.type },
          requestId: TenantContext.get()?.requestId ?? promotion.id,
        },
      });
      return promotion;
    });
  }
}
