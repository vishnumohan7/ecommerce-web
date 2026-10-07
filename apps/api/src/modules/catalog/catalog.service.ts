import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { ProductInput, productInputSchema, variantInputSchema } from './catalog.schemas';
@Injectable()
export class CatalogService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  list(input: { categoryId?: string; alcohol?: boolean; take?: number; cursor?: string }) {
    return this.db.client.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.alcohol === undefined ? {} : { isAlcohol: input.alcohol }),
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: Math.min(input.take ?? 24, 100),
    });
  }
  async byId(id: string) {
    const product = await this.db.client.product.findFirst({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const [variants, images] = await Promise.all([
      this.db.client.productVariant.findMany({ where: { productId: id }, orderBy: { createdAt: 'asc' } }),
      this.db.client.productImage.findMany({ where: { productId: id }, orderBy: { position: 'asc' } }),
    ]);
    return { ...product, variants, images };
  }
  async create(raw: ProductInput) {
    const input = productInputSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const product = await tx.product.create({ data: this.data(input) });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'search.product.upsert', payload: { productId: product.id } },
      });
      return product;
    });
  }
  async update(id: string, raw: ProductInput) {
    await this.byId(id);
    const input = productInputSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const product = await tx.product.update({ where: { id, tenantId }, data: this.data(input) });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'search.product.upsert', payload: { productId: product.id } },
      });
      return product;
    });
  }
  async addVariant(productId: string, raw: unknown) {
    await this.byId(productId);
    const input = variantInputSchema.parse(raw);
    return this.db.transaction(async (tx, tenantId) => {
      const variant = await tx.productVariant.create({
        data: {
          tenantId,
          productId,
          sku: input.sku,
          name: input.name,
          priceMinor: BigInt(input.priceMinor),
          currency: input.currency,
          packSize: input.packSize ?? null,
          weightGrams: input.weightGrams ?? null,
          abv: input.abv ? new Prisma.Decimal(input.abv) : null,
          flavour: input.flavour ?? null,
          attributes: input.attributes,
        },
      });
      const inventory = await tx.inventory.create({
        data: {
          tenantId,
          productId,
          variantId: variant.id,
          warehouseId: input.warehouseId,
          onHand: input.stockOnHand,
          lowStockThreshold: input.lowStockThreshold,
        },
      });
      return { variant, inventory };
    });
  }
  async remove(id: string) {
    const current = await this.byId(id);
    return this.db.transaction(async (tx, tenantId) => {
      const [orderReferences, substitutionReferences, reviews] = await Promise.all([
        tx.orderItem.count({ where: { tenantId, productId: id } }),
        tx.substitution.count({ where: { tenantId, substituteProductId: id } }),
        tx.review.count({ where: { tenantId, productId: id } }),
      ]);
      const retainHistory = orderReferences > 0 || substitutionReferences > 0 || reviews > 0;
      if (retainHistory) {
        await tx.product.update({ where: { id, tenantId }, data: { status: 'INACTIVE' } });
      } else {
        const inventory = await tx.inventory.findMany({
          where: { tenantId, productId: id },
          select: { id: true },
        });
        const inventoryIds = inventory.map((item) => item.id);
        if (inventoryIds.length)
          await tx.inventoryTransaction.deleteMany({ where: { tenantId, inventoryId: { in: inventoryIds } } });
        await Promise.all([
          tx.stockReservation.deleteMany({ where: { tenantId, productId: id } }),
          tx.cartItem.deleteMany({ where: { tenantId, productId: id } }),
        ]);
        await tx.inventory.deleteMany({ where: { tenantId, productId: id } });
        await tx.product.delete({ where: { id, tenantId } });
      }
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'search.product.remove', payload: { productId: id } },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: retainHistory ? 'PRODUCT_REMOVED_HISTORY_RETAINED' : 'PRODUCT_DELETED',
          entity: 'Product',
          entityId: id,
          before: { status: current.status },
          after: retainHistory ? { status: 'INACTIVE' } : { deleted: true },
          requestId: TenantContext.get()?.requestId ?? id,
        },
      });
      return {
        deleted: !retainHistory,
        retainedHistory: retainHistory,
        id,
        status: retainHistory ? 'INACTIVE' : null,
      };
    });
  }
  private data(input: ProductInput) {
    return {
      tenantId: TenantContext.requireTenantId(),
      ...input,
      isAlcohol: input.restrictionReason === 'ALCOHOL',
      priceMinor: BigInt(input.priceMinor),
      pricePerKgMinor: input.pricePerKgMinor ? BigInt(input.pricePerKgMinor) : null,
      brandId: input.brandId ?? null,
      abv: input.abv ? new Prisma.Decimal(input.abv) : null,
      alcoholType: input.alcoholType ?? null,
      weightGrams: input.weightGrams ?? null,
      estimatedWeightGrams: input.estimatedWeightGrams ?? null,
      weightToleranceBps: input.weightToleranceBps ?? null,
      hfssCategory: input.hfssCategory ?? null,
      shelfLifeDays: input.shelfLifeDays ?? null,
      status: 'ACTIVE' as const,
    };
  }
}
