import 'dotenv/config';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { SearchProvider } from '@app/ports';
import { AppConfigService } from '../src/common/config/app-config.service';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { MeilisearchProvider } from '../src/modules/search/meilisearch.provider';
import { PostgresSearchProvider } from '../src/modules/search/postgres-search.provider';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();

function contract(
  name: string,
  factory: () => SearchProvider,
  run: <T>(work: () => Promise<T>) => Promise<T>,
): void {
  describe(name, () => {
    it('supports health, search, autocomplete, upsert, and delete', async () =>
      run(async () => {
        const provider = factory();
        expect(await provider.health()).toEqual({ ok: true });
        const result = await provider.search({
          tenantId,
          query: 'apple',
          limit: 2,
          sort: 'relevance',
          allowAlcohol: false,
        });
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(result.facets).toBeTypeOf('object');
        expect(
          Array.isArray(
            await provider.autocomplete({ tenantId, query: 'app', limit: 3, allowAlcohol: false }),
          ),
        ).toBe(true);
        if (result.items[0]) await provider.upsert(result.items[0]);
        await provider.remove(tenantId, '00000000-0000-4000-8000-000000000099');
      }));
  });
}

contract(
  'PostgresSearchProvider contract',
  () => new PostgresSearchProvider(new TenantScopedPrismaService(prisma)),
  (work) => TenantContext.run({ tenantId, requestId: 'search-contract' }, work),
);

describe('MeilisearchProvider contract', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  afterAll(() => prisma.$disconnect());
  it('supports the same operations over the HTTP adapter', async () => {
    global.fetch = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/health'))
        return Promise.resolve(
          new Response(JSON.stringify({ status: 'available' }), { status: 200 }),
        );
      if (url.endsWith('/search'))
        return Promise.resolve(
          new Response(JSON.stringify({ hits: [], estimatedTotalHits: 0, facetDistribution: {} }), {
            status: 200,
          }),
        );
      if (init?.method === 'DELETE' || init?.method === 'POST')
        return Promise.resolve(new Response(JSON.stringify({ taskUid: 1 }), { status: 202 }));
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const provider = new MeilisearchProvider(new AppConfigService());
    expect(await provider.health()).toEqual({ ok: true });
    expect(
      (
        await provider.search({
          tenantId,
          query: 'apple',
          limit: 2,
          sort: 'relevance',
          allowAlcohol: false,
        })
      ).items,
    ).toEqual([]);
    expect(
      await provider.autocomplete({ tenantId, query: 'app', limit: 3, allowAlcohol: false }),
    ).toEqual([]);
    await provider.remove(tenantId, '00000000-0000-4000-8000-000000000099');
  });
});
