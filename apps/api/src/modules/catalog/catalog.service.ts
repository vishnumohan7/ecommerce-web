import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import { ProductInput, productInputSchema, variantInputSchema } from './catalog.schemas';
@Injectable()
export class CatalogService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  list(input: { categoryId?: string; alcohol?: boolean; take?: number; cursor?: string }) { return this.db.client.product.findMany({ where: { status: 'ACTIVE', ...(input.categoryId ? { categoryId: input.categoryId } : {}), ...(input.alcohol === undefined ? {} : { isAlcohol: input.alcohol }), ...(input.cursor ? { id: { gt: input.cursor } } : {}) }, orderBy: { id: 'asc' }, take: Math.min(input.take ?? 24, 100) }); }
  async byId(id: string) { const product = await this.db.client.product.findFirst({ where: { id } }); if (!product) throw new NotFoundException('Product not found'); return product; }
  async create(raw: ProductInput) { const input = productInputSchema.parse(raw); return this.db.client.product.create({ data: this.data(input) }); }
  async update(id: string, raw: ProductInput) { await this.byId(id); const input = productInputSchema.parse(raw); return this.db.client.product.update({ where: { id }, data: this.data(input) }); }
  async addVariant(productId: string, raw: unknown) { await this.byId(productId); const input = variantInputSchema.parse(raw); return this.db.transaction(async (tx, tenantId) => { const variant = await tx.productVariant.create({ data: { tenantId, productId, sku: input.sku, name: input.name, priceMinor: BigInt(input.priceMinor), currency: input.currency, packSize: input.packSize ?? null, weightGrams: input.weightGrams ?? null, abv: input.abv ? new Prisma.Decimal(input.abv) : null, flavour: input.flavour ?? null, attributes: input.attributes } }); const inventory = await tx.inventory.create({ data: { tenantId, productId, variantId: variant.id, warehouseId: input.warehouseId, onHand: input.stockOnHand, lowStockThreshold: input.lowStockThreshold } }); return { variant, inventory }; }); }
  private data(input: ProductInput) { return { tenantId: TenantContext.requireTenantId(), ...input, isAlcohol: input.restrictionReason === 'ALCOHOL', priceMinor: BigInt(input.priceMinor), pricePerKgMinor: input.pricePerKgMinor ? BigInt(input.pricePerKgMinor) : null, brandId: input.brandId ?? null, abv: input.abv ? new Prisma.Decimal(input.abv) : null, alcoholType: input.alcoholType ?? null, weightGrams: input.weightGrams ?? null, estimatedWeightGrams: input.estimatedWeightGrams ?? null, weightToleranceBps: input.weightToleranceBps ?? null, hfssCategory: input.hfssCategory ?? null, shelfLifeDays: input.shelfLifeDays ?? null, status: 'ACTIVE' as const }; }
}
