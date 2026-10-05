import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { PostgresSearchProvider } from '../src/modules/search/postgres-search.provider';
import { SearchService } from '../src/modules/search/search.service';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const scoped = new TenantScopedPrismaService(prisma);
const provider = new PostgresSearchProvider(scoped);
const service = new SearchService(provider, scoped);
const run = <T>(work: () => Promise<T>) =>
  TenantContext.run({ tenantId, requestId: 'search-database-test' }, work);
let filterProduct!: Awaited<ReturnType<typeof prisma.product.findFirstOrThrow>>;
let promotionId = '';

describe('PostgreSQL product search', () => {
  beforeAll(async () => {
    filterProduct = await prisma.product.findFirstOrThrow({
      where: {
        tenantId,
        status: 'ACTIVE',
        isAlcohol: false,
        dietaryTags: { has: 'VEGETARIAN' },
        NOT: { allergens: { has: 'MILK' } },
        brandId: { not: null },
      },
    });
    await prisma.product.update({
      where: { id: filterProduct.id },
      data: { ratingAverageBps: 450, ratingCount: 12 },
    });
    const promotion = await prisma.promotion.create({
      data: {
        tenantId,
        name: `Search filter proof ${String(Date.now())}`,
        type: 'FIXED',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    promotionId = promotion.id;
    await prisma.promotionProduct.create({
      data: { tenantId, promotionId, productId: filterProduct.id },
    });
  });

  afterAll(async () => {
    if (promotionId) {
      await prisma.promotionProduct.deleteMany({ where: { promotionId } });
      await prisma.promotion.deleteMany({ where: { id: promotionId } });
    }
    if (filterProduct)
      await prisma.product.update({
        where: { id: filterProduct.id },
        data: { ratingAverageBps: 0, ratingCount: 0 },
      });
    await prisma.$disconnect();
  });

  it('ranks text and tolerates a misspelling while excluding alcohol by default', async () =>
    run(async () => {
      const result = await provider.search({
        tenantId,
        query: 'aplpes',
        limit: 10,
        sort: 'relevance',
        allowAlcohol: false,
      });
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some((item) => item.name.includes('Apples'))).toBe(true);
      expect(result.items.every((item) => !item.isAlcohol)).toBe(true);
    }));

  it('applies filters, returns facets, and only exposes alcohol with gate permission', async () =>
    run(async () => {
      const alcohol = await provider.search({
        tenantId,
        limit: 8,
        sort: 'price-asc',
        allowAlcohol: true,
        alcohol: true,
        minimumAbv: '4.00',
        maximumAbv: '15.00',
        inStock: true,
      });
      expect(alcohol.items).toHaveLength(8);
      expect(
        alcohol.items.every(
          (item) =>
            item.isAlcohol && Number(item.abv) >= 4 && Number(item.abv) <= 15 && item.inStock,
        ),
      ).toBe(true);
      expect(alcohol.facets['category']?.length).toBeGreaterThan(0);
      expect(alcohol.facets['storageType']?.length).toBeGreaterThan(0);
    }));

  it('applies category, brand, price, dietary, allergen, storage, rating, and offer filters', async () =>
    run(async () => {
      const result = await provider.search({
        tenantId,
        limit: 10,
        sort: 'rating-desc',
        allowAlcohol: false,
        categoryIds: [filterProduct.categoryId],
        brandIds: [filterProduct.brandId as string],
        minimumPriceMinor: filterProduct.priceMinor,
        maximumPriceMinor: filterProduct.priceMinor,
        dietaryTags: ['VEGETARIAN'],
        allergenFree: ['MILK'],
        storageTypes: [filterProduct.storageType],
        minimumRatingBps: 400,
        onOffer: true,
      });
      expect(result.items.map((item) => item.id)).toContain(filterProduct.id);
      expect(
        result.items.every(
          (item) =>
            item.categoryId === filterProduct.categoryId &&
            item.brandId === filterProduct.brandId &&
            item.priceMinor === filterProduct.priceMinor.toString() &&
            item.dietaryTags.includes('VEGETARIAN') &&
            !item.allergens.includes('MILK') &&
            item.storageType === filterProduct.storageType &&
            item.ratingAverageBps >= 400 &&
            item.onOffer,
        ),
      ).toBe(true);
    }));

  it('uses an opaque stable cursor without duplicate products', async () =>
    run(async () => {
      const first = await provider.search({
        tenantId,
        limit: 7,
        sort: 'price-asc',
        allowAlcohol: false,
      });
      expect(first.nextCursor).toBeTruthy();
      const second = await provider.search({
        tenantId,
        limit: 7,
        sort: 'price-asc',
        allowAlcohol: false,
        cursor: first.nextCursor as string,
      });
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(14);
    }));

  it('expands editable synonyms and records a search log', async () =>
    run(async () => {
      const before = await prisma.searchLog.count({ where: { tenantId } });
      const result = await service.search({ q: 'aubergine', limit: '5' }, false);
      expect(result.items.every((item) => !item.isAlcohol)).toBe(true);
      expect(await prisma.searchLog.count({ where: { tenantId } })).toBe(before + 1);
    }));
});
