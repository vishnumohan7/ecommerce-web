import { describe, expect, it } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { CatalogImportService } from '../src/modules/import/catalog-import.service';

const tenantId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';

describe('catalog import', () => {
  it('performs zero product writes when one of 10,000 rows is invalid', async () => {
    let productWrites = 0;
    let errorWrites = 0;
    const transactionClient = {
      importError: { createMany: ({ data }: { data: unknown[] }) => { errorWrites += data.length; return Promise.resolve({ count: data.length }); } },
      importJob: { update: () => Promise.resolve({}) },
      product: { upsert: () => { productWrites += 1; return Promise.resolve({}); } },
      auditLog: { create: () => Promise.resolve({}) },
    };
    const database = {
      client: {
        importJob: { create: () => Promise.resolve({ id: '10000000-0000-4000-8000-000000000003' }) },
        category: { findMany: () => Promise.resolve([{ id: '10000000-0000-4000-8000-000000000004', slug: 'grocery' }]) },
        product: { findMany: () => Promise.resolve([]) },
      },
      transaction: (work: (tx: typeof transactionClient, scopedTenantId: string) => Promise<unknown>) => work(transactionClient, tenantId),
    };
    const header = 'sku,slug,name,description,categorySlug,priceMinor,vatRateBps,restrictionReason,ageRestriction,abv';
    const rows = Array.from({ length: 10_000 }, (_, index) => index === 9_999
      ? `SKU-${String(index)},product-${String(index)},Product ${String(index)},Description,grocery,invalid,0,NONE,0,`
      : `SKU-${String(index)},product-${String(index)},Product ${String(index)},Description,grocery,199,0,NONE,0,`);
    const service = new CatalogImportService(database as never);
    const result = await TenantContext.run({ tenantId, userId, requestId: 'import-test' }, () => service.execute(Buffer.from([header, ...rows].join('\n')), 'catalog.csv', 'fail', false, userId));
    expect(result.applied).toBe(0);
    expect(productWrites).toBe(0);
    expect(errorWrites).toBeGreaterThan(0);
  }, 30_000);
});
