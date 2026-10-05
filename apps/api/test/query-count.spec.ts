import { describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { SearchService } from '../src/modules/search/search.service';

describe('search endpoint query count', () => {
  it('stays at four database/provider operations, below the five-query cap', async () => {
    let count = 0;
    const provider = {
      search: vi.fn(() => {
        count += 2;
        return Promise.resolve({ items: [], nextCursor: null, facets: {}, resultCount: 0 });
      }),
    };
    const database = {
      client: {
        searchSynonym: {
          findMany: vi.fn(() => {
            count += 1;
            return Promise.resolve([]);
          }),
        },
        searchLog: {
          create: vi.fn(() => {
            count += 1;
            return Promise.resolve({});
          }),
        },
      },
    };
    const service = new SearchService(provider as never, database as never);
    await TenantContext.run(
      { tenantId: '00000000-0000-4000-8000-000000000001', requestId: 'query-count' },
      () => service.search({ q: 'apple' }, false),
    );
    expect(count).toBeLessThanOrEqual(5);
    expect(count).toBe(4);
  });
});
