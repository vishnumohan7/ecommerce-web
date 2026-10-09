import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
import {
  ProductInput,
  productInputSchema,
  variantInputSchema,
  variantUpdateSchema,
} from './catalog.schemas';
@Injectable()
export class CatalogService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  async adminList(input: {
    page: number;
    pageSize: number;
    query?: string;
    status?: string;
    sort?: string;
  }) {
    const status = ['DRAFT', 'ACTIVE', 'INACTIVE'].includes(input.status ?? '')
      ? (input.status as 'DRAFT' | 'ACTIVE' | 'INACTIVE')
      : undefined;
    const where: Prisma.ProductWhereInput = {
      ...(status ? { status } : {}),
      ...(input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: 'insensitive' } },
              { sku: { contains: input.query, mode: 'insensitive' } },
              { description: { contains: input.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      input.sort === 'name-asc'
        ? { name: 'asc' }
        : input.sort === 'name-desc'
          ? { name: 'desc' }
          : input.sort === 'price-asc'
            ? { priceMinor: 'asc' }
            : input.sort === 'price-desc'
              ? { priceMinor: 'desc' }
              : { updatedAt: 'desc' };
    const total = await this.db.client.product.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, pageCount);
    const products = await this.db.client.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
    });
    const images = products.length
      ? await this.db.client.productImage.findMany({
          where: { productId: { in: products.map((product) => product.id) } },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        })
      : [];
    const imagesByProduct = new Map<string, typeof images>();
    images.forEach((image) => {
      const current = imagesByProduct.get(image.productId) ?? [];
      current.push(image);
      imagesByProduct.set(image.productId, current);
    });
    return {
      items: products.map((product) => ({
        ...product,
        images: imagesByProduct.get(product.id) ?? [],
      })),
      page,
      pageSize: input.pageSize,
      total,
      pageCount,
    };
  }
  async list(input: { categoryId?: string; alcohol?: boolean; take?: number; cursor?: string }) {
    const products = await this.db.client.product.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input.alcohol === undefined ? {} : { isAlcohol: input.alcohol }),
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: Math.min(input.take ?? 24, 100),
    });
    if (!products.length) return products;
    const images = await this.db.client.productImage.findMany({
      where: { productId: { in: products.map((product) => product.id) } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    const imagesByProduct = new Map<string, typeof images>();
    images.forEach((image) => {
      const productImages = imagesByProduct.get(image.productId) ?? [];
      productImages.push(image);
      imagesByProduct.set(image.productId, productImages);
    });
    return products.map((product) => ({
      ...product,
      images: imagesByProduct.get(product.id) ?? [],
    }));
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
    await this.ensureProductIdentityIsAvailable(input.sku, input.slug);
    return this.db.transaction(async (tx, tenantId) => {
      const product = await tx.product.create({ data: this.data(input) });
      await tx.outboxMessage.create({
        data: { tenantId, topic: 'search.product.upsert', payload: { productId: product.id } },
      });
      return product;
    });
  }
  async update(id: string, raw: ProductInput) {
    const current = await this.byId(id);
    const input = productInputSchema.parse(raw);
    if (input.sku !== current.sku || input.slug !== current.slug)
      await this.ensureProductIdentityIsAvailable(input.sku, input.slug, id);
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
  async updateVariant(productId: string, variantId: string, raw: unknown) {
    await this.byId(productId);
    const current = await this.db.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!current) throw new NotFoundException('Product variant not found');
    const input = variantUpdateSchema.parse(raw);
    if (input.sku && input.sku !== current.sku) {
      const duplicate = await this.db.client.productVariant.findFirst({
        where: { sku: input.sku, id: { not: variantId } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('A variant with this SKU already exists');
    }
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId, tenantId },
        data: {
          ...(input.sku === undefined ? {} : { sku: input.sku }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.priceMinor === undefined ? {} : { priceMinor: BigInt(input.priceMinor) }),
          ...(input.currency === undefined ? {} : { currency: input.currency }),
          ...(input.packSize === undefined ? {} : { packSize: input.packSize }),
          ...(input.weightGrams === undefined ? {} : { weightGrams: input.weightGrams }),
          ...(input.abv === undefined
            ? {}
            : { abv: input.abv ? new Prisma.Decimal(input.abv) : null }),
          ...(input.flavour === undefined ? {} : { flavour: input.flavour }),
          ...(input.attributes === undefined ? {} : { attributes: input.attributes }),
          ...(input.active === undefined ? {} : { active: input.active }),
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: 'PRODUCT_VARIANT_UPDATED',
          entity: 'ProductVariant',
          entityId: variantId,
          before: { sku: current.sku, name: current.name, active: current.active },
          after: { sku: updated.sku, name: updated.name, active: updated.active },
          requestId: TenantContext.get()?.requestId ?? variantId,
        },
      });
      return updated;
    });
  }
  async removeVariant(productId: string, variantId: string) {
    await this.byId(productId);
    const current = await this.db.client.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!current) throw new NotFoundException('Product variant not found');
    const inventories = await this.db.client.inventory.findMany({
      where: { productId, variantId },
      select: { id: true, onHand: true, reserved: true },
    });
    const inventoryIds = inventories.map((item) => item.id);
    const transactionCount = inventoryIds.length
      ? await this.db.client.inventoryTransaction.count({
          where: { inventoryId: { in: inventoryIds } },
        })
      : 0;
    const retainHistory =
      transactionCount > 0 || inventories.some((item) => item.onHand !== 0 || item.reserved !== 0);
    return this.db.transaction(async (tx, tenantId) => {
      if (retainHistory) {
        await tx.productVariant.update({
          where: { id: variantId, tenantId },
          data: { active: false },
        });
      } else {
        await tx.inventory.deleteMany({ where: { tenantId, variantId } });
        await tx.productImage.deleteMany({ where: { tenantId, variantId } });
        await tx.productVariant.delete({ where: { id: variantId, tenantId } });
      }
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: retainHistory ? 'PRODUCT_VARIANT_DEACTIVATED' : 'PRODUCT_VARIANT_DELETED',
          entity: 'ProductVariant',
          entityId: variantId,
          before: { sku: current.sku, active: current.active },
          after: retainHistory ? { active: false } : { deleted: true },
          requestId: TenantContext.get()?.requestId ?? variantId,
        },
      });
      return { id: variantId, deleted: !retainHistory, deactivated: retainHistory };
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
  private async ensureProductIdentityIsAvailable(
    sku: string,
    slug: string,
    excludingId?: string,
  ) {
    const existing = await this.db.client.product.findFirst({
      where: {
        ...(excludingId ? { id: { not: excludingId } } : {}),
        OR: [{ sku }, { slug }],
      },
      select: { id: true, sku: true, slug: true },
    });
    if (!existing) return;
    const duplicateField = existing.sku === sku ? 'SKU' : 'URL slug';
    throw new ConflictException({
      code: 'PRODUCT_IDENTITY_EXISTS',
      message: `A product with this ${duplicateField} already exists. Choose a unique ${duplicateField}.`,
      details: { existingProductId: existing.id, field: duplicateField },
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
