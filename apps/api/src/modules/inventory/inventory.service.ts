import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InventoryReason } from '@prisma/client';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';
interface LockedInventory { id: string; onHand: number; reserved: number; lowStockThreshold: number; }
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
  async list() {
    const records = await this.db.client.inventory.findMany({ orderBy: [{ stockAvailable: 'asc' }, { updatedAt: 'desc' }], take: 250 });
    const products = await this.db.client.product.findMany({ where: { id: { in: records.map((record) => record.productId) } }, select: { id: true, name: true, sku: true } });
    const names = new Map(products.map((product) => [product.id, product]));
    return records.map((record) => ({ ...record, product: names.get(record.productId) ?? null }));
  }
  reserve(inventoryId: string, quantity: number, reference?: string) { if (!Number.isInteger(quantity) || quantity <= 0) throw new ConflictException('Reservation quantity must be positive'); return this.mutate(inventoryId, 'RESERVATION', quantity, reference); }
  release(inventoryId: string, quantity: number, reference?: string) { if (!Number.isInteger(quantity) || quantity <= 0) throw new ConflictException('Release quantity must be positive'); return this.mutate(inventoryId, 'RELEASE', quantity, reference); }
  adjust(inventoryId: string, quantity: number, reason: Exclude<InventoryReason, 'RESERVATION' | 'RELEASE'>, reference?: string) { if (!Number.isInteger(quantity) || quantity === 0) throw new ConflictException('Adjustment quantity cannot be zero'); return this.mutate(inventoryId, reason, quantity, reference); }
  private async mutate(inventoryId: string, reason: InventoryReason, quantity: number, reference?: string) {
    return this.db.transaction(async (tx, tenantId) => {
      const rows = await tx.$queryRaw<LockedInventory[]>`SELECT "id", "onHand", "reserved", "lowStockThreshold" FROM "Inventory" WHERE "id" = ${inventoryId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const current = rows[0]; if (!current) throw new NotFoundException('Inventory record not found');
      let onHand = current.onHand; let reserved = current.reserved;
      if (reason === 'RESERVATION') { if (onHand - reserved < quantity) throw new ConflictException('Insufficient available stock'); reserved += quantity; }
      else if (reason === 'RELEASE') { if (reserved < quantity) throw new ConflictException('Release exceeds reserved stock'); reserved -= quantity; }
      else { onHand += quantity; if (onHand < 0 || onHand < reserved) throw new ConflictException('Stock mutation would make availability negative'); }
      const updated = await tx.inventory.update({ where: { id: inventoryId, tenantId }, data: { onHand, reserved, version: { increment: 1 } } });
      await tx.inventoryTransaction.create({ data: { tenantId, inventoryId, reason, quantity, ...(reference ? { reference } : {}), actorId: TenantContext.get()?.userId ?? null } });
      if (onHand - reserved <= current.lowStockThreshold) await tx.outboxMessage.create({ data: { tenantId, topic: 'inventory.low-stock', payload: { inventoryId, available: onHand - reserved } } });
      await tx.auditLog.create({ data: { tenantId, actorId: TenantContext.get()?.userId ?? null, actorType: TenantContext.get()?.userId ? 'USER' : 'SYSTEM', action: `INVENTORY_${reason}`, entity: 'Inventory', entityId: inventoryId, before: { onHand: current.onHand, reserved: current.reserved }, after: { onHand, reserved }, requestId: TenantContext.get()?.requestId ?? 'inventory-system' } });
      return updated;
    });
  }
}
