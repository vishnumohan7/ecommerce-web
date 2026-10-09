import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InventoryReason } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
interface LockedInventory {
  id: string;
  onHand: number;
  reserved: number;
  lowStockThreshold: number;
}
@Injectable()
export class InventoryService {
  constructor(private readonly db: TenantScopedPrismaService) {}
  warehouses() {
    return this.db.client.warehouse.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, active: true },
    });
  }
  async list(productId?: string) {
    const records = await this.db.client.inventory.findMany({
      where: productId ? { productId } : {},
      orderBy: [{ stockAvailable: 'asc' }, { updatedAt: 'desc' }],
      take: 250,
    });
    const products = await this.db.client.product.findMany({
      where: { id: { in: records.map((record) => record.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const names = new Map(products.map((product) => [product.id, product]));
    return records.map((record) => ({ ...record, product: names.get(record.productId) ?? null }));
  }
  async page(input: { page: number; pageSize: number; query?: string }) {
    const productWhere: Prisma.ProductWhereInput | undefined = input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: 'insensitive' } },
            { sku: { contains: input.query, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const matchingProducts = productWhere
      ? await this.db.client.product.findMany({ where: productWhere, select: { id: true } })
      : null;
    const where: Prisma.InventoryWhereInput = matchingProducts
      ? { productId: { in: matchingProducts.map((product) => product.id) } }
      : {};
    const total = await this.db.client.inventory.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
    const page = Math.min(input.page, pageCount);
    const records = await this.db.client.inventory.findMany({
      where,
      orderBy: [{ stockAvailable: 'asc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * input.pageSize,
      take: input.pageSize,
    });
    const products = await this.db.client.product.findMany({
      where: { id: { in: records.map((record) => record.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const names = new Map(products.map((product) => [product.id, product]));
    return {
      items: records.map((record) => ({ ...record, product: names.get(record.productId) ?? null })),
      page,
      pageSize: input.pageSize,
      total,
      pageCount,
    };
  }
  async create(input: {
    productId: string;
    warehouseId: string;
    onHand: number;
    lowStockThreshold: number;
  }) {
    if (!Number.isInteger(input.onHand) || input.onHand < 0)
      throw new ConflictException('On-hand stock must be zero or greater');
    if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)
      throw new ConflictException('Low-stock threshold must be zero or greater');
    const [product, warehouse, existing] = await Promise.all([
      this.db.client.product.findFirst({ where: { id: input.productId } }),
      this.db.client.warehouse.findFirst({ where: { id: input.warehouseId, active: true } }),
      this.db.client.inventory.findFirst({
        where: { productId: input.productId, warehouseId: input.warehouseId, variantId: null },
      }),
    ]);
    if (!product) throw new NotFoundException('Product not found');
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (existing) throw new ConflictException('Stock already exists for this warehouse');
    return this.db.transaction(async (tx, tenantId) => {
      const inventory = await tx.inventory.create({
        data: {
          tenantId,
          productId: input.productId,
          warehouseId: input.warehouseId,
          onHand: input.onHand,
          lowStockThreshold: input.lowStockThreshold,
        },
      });
      if (input.onHand > 0)
        await tx.inventoryTransaction.create({
          data: {
            tenantId,
            inventoryId: inventory.id,
            reason: 'PURCHASE',
            quantity: input.onHand,
            reference: 'Opening stock',
            actorId: TenantContext.get()?.userId ?? null,
          },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: 'INVENTORY_CREATED',
          entity: 'Inventory',
          entityId: inventory.id,
          after: {
            productId: input.productId,
            warehouseId: input.warehouseId,
            onHand: input.onHand,
            lowStockThreshold: input.lowStockThreshold,
          },
          requestId: TenantContext.get()?.requestId ?? inventory.id,
        },
      });
      return inventory;
    });
  }
  async update(id: string, input: { lowStockThreshold: number }) {
    if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)
      throw new ConflictException('Low-stock threshold must be zero or greater');
    const current = await this.db.client.inventory.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Inventory record not found');
    return this.db.transaction(async (tx, tenantId) => {
      const updated = await tx.inventory.update({
        where: { id, tenantId },
        data: { lowStockThreshold: input.lowStockThreshold },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: 'INVENTORY_SETTINGS_UPDATED',
          entity: 'Inventory',
          entityId: id,
          before: { lowStockThreshold: current.lowStockThreshold },
          after: { lowStockThreshold: input.lowStockThreshold },
          requestId: TenantContext.get()?.requestId ?? id,
        },
      });
      return updated;
    });
  }
  async remove(id: string) {
    const current = await this.db.client.inventory.findFirst({ where: { id } });
    if (!current) throw new NotFoundException('Inventory record not found');
    if (current.onHand !== 0 || current.reserved !== 0)
      throw new ConflictException('Stock must be zero before this record can be deleted');
    const transactions = await this.db.client.inventoryTransaction.count({
      where: { inventoryId: id },
    });
    if (transactions > 0)
      throw new ConflictException('Stock with transaction history cannot be deleted');
    return this.db.transaction(async (tx, tenantId) => {
      await tx.inventory.delete({ where: { id, tenantId } });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: 'INVENTORY_DELETED',
          entity: 'Inventory',
          entityId: id,
          before: { productId: current.productId, warehouseId: current.warehouseId },
          requestId: TenantContext.get()?.requestId ?? id,
        },
      });
      return { deleted: true, id };
    });
  }
  reserve(inventoryId: string, quantity: number, reference?: string) {
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new ConflictException('Reservation quantity must be positive');
    return this.mutate(inventoryId, 'RESERVATION', quantity, reference);
  }
  release(inventoryId: string, quantity: number, reference?: string) {
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new ConflictException('Release quantity must be positive');
    return this.mutate(inventoryId, 'RELEASE', quantity, reference);
  }
  adjust(
    inventoryId: string,
    quantity: number,
    reason: Exclude<InventoryReason, 'RESERVATION' | 'RELEASE'>,
    reference?: string,
  ) {
    if (!Number.isInteger(quantity) || quantity === 0)
      throw new ConflictException('Adjustment quantity cannot be zero');
    return this.mutate(inventoryId, reason, quantity, reference);
  }
  private async mutate(
    inventoryId: string,
    reason: InventoryReason,
    quantity: number,
    reference?: string,
  ) {
    return this.db.transaction(async (tx, tenantId) => {
      const rows = await tx.$queryRaw<
        LockedInventory[]
      >`SELECT "id", "onHand", "reserved", "lowStockThreshold" FROM "Inventory" WHERE "id" = ${inventoryId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const current = rows[0];
      if (!current) throw new NotFoundException('Inventory record not found');
      let onHand = current.onHand;
      let reserved = current.reserved;
      if (reason === 'RESERVATION') {
        if (onHand - reserved < quantity)
          throw new ConflictException('Insufficient available stock');
        reserved += quantity;
      } else if (reason === 'RELEASE') {
        if (reserved < quantity) throw new ConflictException('Release exceeds reserved stock');
        reserved -= quantity;
      } else {
        onHand += quantity;
        if (onHand < 0 || onHand < reserved)
          throw new ConflictException('Stock mutation would make availability negative');
      }
      const updated = await tx.inventory.update({
        where: { id: inventoryId, tenantId },
        data: { onHand, reserved, version: { increment: 1 } },
      });
      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          inventoryId,
          reason,
          quantity,
          ...(reference ? { reference } : {}),
          actorId: TenantContext.get()?.userId ?? null,
        },
      });
      if (onHand - reserved <= current.lowStockThreshold)
        await tx.outboxMessage.create({
          data: {
            tenantId,
            topic: 'inventory.low-stock',
            payload: { inventoryId, available: onHand - reserved },
          },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: TenantContext.get()?.userId ?? null,
          actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM',
          action: `INVENTORY_${reason}`,
          entity: 'Inventory',
          entityId: inventoryId,
          before: { onHand: current.onHand, reserved: current.reserved },
          after: { onHand, reserved },
          requestId: TenantContext.get()?.requestId ?? 'inventory-system',
        },
      });
      return updated;
    });
  }
}
