import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../../src/common/database/tenant-scoped.service';
import { TenantContext } from '../../src/common/tenancy/tenant-context';
import { CatalogService } from '../../src/modules/catalog/catalog.service';
import { TaxonomyService } from '../../src/modules/catalog/taxonomy.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const createdIds: string[] = [];
const createdOutboxIds: string[] = [];
let taxonomy: TaxonomyService;
let catalog: CatalogService;
let suffix = '';

describe('catalog taxonomy CRUD E2E', () => {
  beforeAll(() => {
    const scoped = new TenantScopedPrismaService(prisma);
    taxonomy = new TaxonomyService(scoped);
    catalog = new CatalogService(scoped);
    suffix = Date.now().toString(36);
  });

  afterAll(async () => {
    await prisma.productAttribute.deleteMany({
      where: { tenantId, attributeSetId: { in: createdIds } },
    });
    await prisma.product.deleteMany({ where: { tenantId, id: { in: createdIds } } });
    await prisma.attributeSet.deleteMany({ where: { tenantId, id: { in: createdIds } } });
    await prisma.category.deleteMany({ where: { tenantId, id: { in: createdIds } } });
    await prisma.brand.deleteMany({ where: { tenantId, id: { in: createdIds } } });
    // Audit records are deliberately append-only, including records produced by tests.
    await prisma.outboxMessage.deleteMany({ where: { tenantId, id: { in: createdOutboxIds } } });
    await prisma.$disconnect();
  }, 60_000);

  it('category CRUD maintains descendant materialised paths and prevents cycles', async () => {
    await inTenant(async () => {
      const parent = await taxonomy.createCategory({ slug: `parent-${suffix}`, name: 'Parent' });
      const child = await taxonomy.createCategory({
        parentId: parent.id,
        slug: `child-${suffix}`,
        name: 'Child',
      });
      createdIds.push(parent.id, child.id);
      expect(child.path).toBe(`/${parent.slug}/${child.slug}`);
      const renamed = await taxonomy.updateCategory(parent.id, { slug: `renamed-${suffix}` });
      const movedChild = await prisma.category.findUniqueOrThrow({ where: { id: child.id } });
      expect(renamed.path).toBe(`/${renamed.slug}`);
      expect(movedChild.path).toBe(`/${renamed.slug}/${child.slug}`);
      await expect(
        taxonomy.updateCategory(parent.id, { parentId: child.id }),
      ).rejects.toMatchObject({ response: { code: 'CATEGORY_CYCLE' } });
      await expect(taxonomy.deleteCategory(parent.id)).rejects.toMatchObject({
        response: { code: 'CATEGORY_IN_USE' },
      });
      await taxonomy.deleteCategory(child.id);
      await expect(taxonomy.category(child.id)).rejects.toThrow('Category not found');
      await taxonomy.deleteCategory(parent.id);
    });
  }, 30_000);

  it('brand CRUD refuses deletion while a product uses the brand', async () => {
    await inTenant(async () => {
      const category = await taxonomy.createCategory({
        slug: `brand-category-${suffix}`,
        name: 'Brand Category',
      });
      const brand = await taxonomy.createBrand({ slug: `brand-${suffix}`, name: 'Original Brand' });
      createdIds.push(category.id, brand.id);
      const updated = await taxonomy.updateBrand(brand.id, { name: 'Updated Brand' });
      expect(updated.name).toBe('Updated Brand');
      const product = await createProduct(category.id, brand.id, `BRAND-${suffix}`);
      createdIds.push(product.id);
      await expect(taxonomy.deleteBrand(brand.id)).rejects.toMatchObject({
        response: { code: 'BRAND_IN_USE' },
      });
      await prisma.product.delete({ where: { id: product.id } });
      await expect(taxonomy.deleteBrand(brand.id)).resolves.toEqual({
        deleted: true,
        id: brand.id,
      });
      await taxonomy.deleteCategory(category.id);
    });
  }, 30_000);

  it('attribute-set CRUD persists validated definitions and blocks in-use deletion', async () => {
    await inTenant(async () => {
      const attributeSet = await taxonomy.createAttributeSet({
        key: `details_${suffix}`,
        name: 'Details',
        definitions: [{ key: 'colour', label: 'Colour', type: 'TEXT', required: true }],
      });
      createdIds.push(attributeSet.id);
      const updated = await taxonomy.updateAttributeSet(attributeSet.id, {
        name: 'Product details',
      });
      expect(updated.name).toBe('Product details');
      const category = await taxonomy.createCategory({
        slug: `attribute-category-${suffix}`,
        name: 'Attribute Category',
      });
      const product = await createProduct(category.id, null, `ATTR-${suffix}`);
      createdIds.push(category.id, product.id);
      await prisma.productAttribute.create({
        data: {
          tenantId,
          productId: product.id,
          attributeSetId: attributeSet.id,
          values: { colour: 'green' },
        },
      });
      await expect(taxonomy.deleteAttributeSet(attributeSet.id)).rejects.toMatchObject({
        response: { code: 'ATTRIBUTE_SET_IN_USE' },
      });
      await prisma.productAttribute.deleteMany({ where: { tenantId, productId: product.id } });
      await taxonomy.deleteAttributeSet(attributeSet.id);
      await prisma.product.delete({ where: { id: product.id } });
      await taxonomy.deleteCategory(category.id);
    });
  }, 30_000);

  it('deletes an unused product and emits a search-removal outbox event', async () => {
    await inTenant(async () => {
      const category = await taxonomy.createCategory({
        slug: `archive-category-${suffix}`,
        name: 'Archive Category',
      });
      const product = await createProduct(category.id, null, `ARCHIVE-${suffix}`);
      createdIds.push(category.id, product.id);
      await expect(catalog.remove(product.id)).resolves.toMatchObject({
        deleted: true,
        retainedHistory: false,
      });
      expect(await prisma.product.findUnique({ where: { id: product.id } })).toBeNull();
      const outbox = await prisma.outboxMessage.findFirstOrThrow({
        where: {
          tenantId,
          topic: 'search.product.remove',
          payload: { equals: { productId: product.id } },
        },
      });
      createdOutboxIds.push(outbox.id);
      await prisma.product.delete({ where: { id: product.id } });
      await taxonomy.deleteCategory(category.id);
    });
  }, 30_000);
});

function inTenant<T>(work: () => T): T {
  return TenantContext.run({ tenantId, requestId: 'taxonomy-e2e' }, work);
}

function createProduct(categoryId: string, brandId: string | null, sku: string) {
  return prisma.product.create({
    data: {
      tenantId,
      categoryId,
      brandId,
      sku,
      slug: sku.toLowerCase(),
      name: sku,
      description: 'Transient taxonomy fixture',
      status: 'ACTIVE',
      priceMinor: 100n,
      currency: 'GBP',
      vatRateBps: 0,
      pricingMode: 'UNIT',
      isAlcohol: false,
      ageRestriction: 0,
      restrictionReason: 'NONE',
      returnPolicy: 'STANDARD_14_DAY',
      unitPriceDisplay: 'each',
      hfssStatus: 'NOT_IN_SCOPE',
      dietaryTags: [],
      allergens: [],
      countryOfOrigin: 'GB',
      storageType: 'AMBIENT',
    },
  });
}
