import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from '../src/modules/inventory/inventory.service';

describe('inventory variant catalogue details', () => {
  it('returns the variant name and SKU and searches by variant identity', async () => {
    const inventoryRecord = {
      id: '20000000-0000-4000-8000-000000000001',
      tenantId: '20000000-0000-4000-8000-000000000002',
      productId: '20000000-0000-4000-8000-000000000003',
      variantId: '20000000-0000-4000-8000-000000000004',
      warehouseId: '20000000-0000-4000-8000-000000000005',
      onHand: 12,
      reserved: 2,
      stockAvailable: 10,
      lowStockThreshold: 3,
      version: 1,
      updatedAt: new Date('2026-10-12T00:00:00.000Z'),
    };
    const inventoryFindMany = vi.fn().mockResolvedValue([inventoryRecord]);
    const productFindMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: inventoryRecord.productId, name: 'Sparkling Water', sku: 'WATER' },
      ]);
    const variantFindMany = vi
      .fn()
      .mockResolvedValueOnce([{ id: inventoryRecord.variantId }])
      .mockResolvedValueOnce([
        {
          id: inventoryRecord.variantId,
          productId: inventoryRecord.productId,
          name: 'Case of 12',
          sku: 'WATER-12',
        },
      ]);
    const database = {
      client: {
        inventory: { count: vi.fn().mockResolvedValue(1), findMany: inventoryFindMany },
        product: { findMany: productFindMany },
        productVariant: { findMany: variantFindMany },
      },
    };

    const result = await new InventoryService(database as never).page({
      page: 1,
      pageSize: 25,
      query: 'WATER-12',
    });

    expect(result.items[0]).toMatchObject({
      product: { name: 'Sparkling Water', sku: 'WATER' },
      variant: { name: 'Case of 12', sku: 'WATER-12' },
    });
    expect(inventoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ productId: { in: [] } }, { variantId: { in: [inventoryRecord.variantId] } }],
        },
      }),
    );
  });
});
