import 'dotenv/config';
import { PrismaService } from '../src/common/database/prisma.service';
import { TenantScopedPrismaService } from '../src/common/database/tenant-scoped.service';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { PostgresSearchProvider } from '../src/modules/search/postgres-search.provider';

const tenantId = '00000000-0000-4000-8000-000000000001';
const prisma = new PrismaService();
const provider = new PostgresSearchProvider(new TenantScopedPrismaService(prisma));
const percentile95 = (samples: number[]): number =>
  [...samples].sort((a: number, b: number) => a - b)[Math.ceil(samples.length * 0.95) - 1] ??
  Infinity;
async function measure(work: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await work();
  return performance.now() - start;
}
async function main(): Promise<void> {
  const search: number[] = [];
  const autocomplete: number[] = [];
  await TenantContext.run({ tenantId, requestId: 'search-benchmark' }, async () => {
    await provider.search({
      tenantId,
      query: 'apple',
      limit: 24,
      sort: 'relevance',
      allowAlcohol: false,
    });
    await provider.search({
      tenantId,
      query: 'milk',
      limit: 24,
      sort: 'relevance',
      allowAlcohol: false,
    });
    await provider.autocomplete({ tenantId, query: 'app', limit: 8, allowAlcohol: false });
    await provider.autocomplete({ tenantId, query: 'mi', limit: 8, allowAlcohol: false });
    for (let index = 0; index < 50; index += 1) {
      search.push(
        await measure(() =>
          provider.search({
            tenantId,
            query: index % 2 ? 'milk' : 'apple',
            limit: 24,
            sort: 'relevance',
            allowAlcohol: false,
          }),
        ),
      );
      autocomplete.push(
        await measure(() =>
          provider.autocomplete({
            tenantId,
            query: index % 2 ? 'mi' : 'app',
            limit: 8,
            allowAlcohol: false,
          }),
        ),
      );
    }
  });
  const searchP95 = percentile95(search);
  const autocompleteP95 = percentile95(autocomplete);
  console.log(
    JSON.stringify({
      dataset: 'demo-360',
      profile: 'warm-application-cache',
      samples: 50,
      searchP95Ms: Math.round(searchP95 * 100) / 100,
      autocompleteP95Ms: Math.round(autocompleteP95 * 100) / 100,
    }),
  );
  if (searchP95 >= 150 || autocompleteP95 >= 50)
    throw new Error(
      `Search performance gate failed: search ${searchP95.toFixed(2)}ms, autocomplete ${autocompleteP95.toFixed(2)}ms`,
    );
}
void main().finally(() => prisma.$disconnect());
