import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { CatalogService } from '../src/modules/catalog/catalog.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const catalog = new CatalogService(new TenantScopedPrismaService(prisma));
const suffix = randomUUID().slice(0, 8);
let productId = '';
let variantId = '';
let inventoryId = '';
let warehouseId = '';

describe('catalog variant persistence', () => {
  beforeAll(async () => {
    const category = await prisma.category.findFirstOrThrow({ where: { tenantId } });
    warehouseId = (await prisma.warehouse.findFirstOrThrow({ where: { tenantId } })).id;
    productId = (await prisma.product.create({ data: {
      tenantId, categoryId: category.id, sku: `VARIANT-${suffix}`, slug: `variant-${suffix}`,
      name: 'Variant persistence product', description: 'Transient variant persistence fixture',
      status: 'ACTIVE', priceMinor: 299n, currency: 'GBP', vatRateBps: 2000, pricingMode: 'UNIT',
      isAlcohol: true, abv: '4.50', alcoholType: 'BEER', ageRestriction: 18, restrictionReason: 'ALCOHOL',
      returnPolicy: 'AGE_RESTRICTED_RESTRICTED', unitPriceDisplay: 'each', hfssStatus: 'NOT_IN_SCOPE',
      dietaryTags: [], allergens: ['BARLEY'], countryOfOrigin: 'GB', storageType: 'AMBIENT',
    } })).id;
  });

  afterAll(async () => {
    if (inventoryId) await prisma.inventory.deleteMany({ where: { id: inventoryId } });
    if (variantId) await prisma.productVariant.deleteMany({ where: { id: variantId } });
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.$disconnect();
  });

  it('creates a variant with exact ABV and its own stock record atomically', async () => {
    const result = await TenantContext.run({ tenantId, requestId: `variant-${suffix}` }, () => catalog.addVariant(productId, {
      sku: `VARIANT-${suffix}-6`, name: 'Six pack', priceMinor: '1599', currency: 'GBP',
      packSize: '6 x 330ml', weightGrams: 2100, abv: '4.50', flavour: 'malt',
      attributes: { container: 'bottle' }, warehouseId, stockOnHand: 12, lowStockThreshold: 3,
    }));
    variantId = result.variant.id;
    inventoryId = result.inventory.id;
    expect(result.variant.abv?.toFixed(2)).toBe('4.50');
    expect(result.inventory.variantId).toBe(variantId);
    expect(result.inventory.onHand).toBe(12);
  });
});
