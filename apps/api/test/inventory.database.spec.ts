import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { InventoryService } from '../src/modules/inventory/inventory.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const service = new InventoryService(new TenantScopedPrismaService(prisma));
const suffix = randomUUID().slice(0, 8);
let inventoryId = '';
let productId = '';

describe('inventory PostgreSQL concurrency', () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId } });
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { tenantId } });
    const product = await prisma.product.create({ data: {
      tenantId, categoryId: category.id, sku: `RACE-${suffix}`, slug: `race-${suffix}`,
      name: 'Concurrency test product', description: 'Transient database concurrency fixture',
      status: 'ACTIVE', priceMinor: 100n, currency: 'GBP', vatRateBps: 0, pricingMode: 'UNIT',
      isAlcohol: false, ageRestriction: 0, restrictionReason: 'NONE', returnPolicy: 'STANDARD_14_DAY',
      unitPriceDisplay: 'each', hfssStatus: 'NOT_IN_SCOPE', dietaryTags: [], allergens: [],
      countryOfOrigin: 'GB', storageType: 'AMBIENT',
    } });
    productId = product.id;
    const inventory = await prisma.inventory.create({ data: { tenantId, productId, warehouseId: warehouse.id, onHand: 10, reserved: 0, lowStockThreshold: -1 } });
    inventoryId = inventory.id;
  }, 30_000);

  afterAll(async () => {
    if (inventoryId) {
      await prisma.inventoryTransaction.deleteMany({ where: { inventoryId } });
      await prisma.inventory.deleteMany({ where: { id: inventoryId } });
    }
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  }, 30_000);

  it('permits exactly 10 of 50 simultaneous reservations against stock 10', async () => {
    const attempts = await TenantContext.run({ tenantId, requestId: `race-${suffix}` }, () => Promise.allSettled(
      Array.from({ length: 50 }, (_, index) => service.reserve(inventoryId, 1, `race-${suffix}-${String(index)}`)),
    ));
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(10);
    const inventory = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } });
    expect(inventory.reserved).toBe(10);
    expect(await prisma.inventoryTransaction.count({ where: { inventoryId } })).toBe(10);
  }, 60_000);
});
