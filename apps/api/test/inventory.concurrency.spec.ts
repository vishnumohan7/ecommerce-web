import { describe, expect, it } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { InventoryService } from '../src/modules/inventory/inventory.service';

const tenantId = '10000000-0000-4000-8000-000000000001';

describe('inventory concurrency', () => {
  it('allows exactly 10 of 50 serialized lock contenders against stock 10', async () => {
    const stock = { id: '10000000-0000-4000-8000-000000000002', onHand: 10, reserved: 0, lowStockThreshold: 2, version: 1 };
    let ledgerEntries = 0;
    let transactionQueue = Promise.resolve();
    const transactionClient = {
      $queryRaw: () => Promise.resolve([{ ...stock }]),
      inventory: { update: ({ data }: { data: { onHand: number; reserved: number } }) => { stock.onHand = data.onHand; stock.reserved = data.reserved; stock.version += 1; return Promise.resolve({ ...stock }); } },
      inventoryTransaction: { create: () => { ledgerEntries += 1; return Promise.resolve({}); } },
      outboxMessage: { create: () => Promise.resolve({}) },
      auditLog: { create: () => Promise.resolve({}) },
    };
    const database = {
      transaction(work: (tx: typeof transactionClient, scopedTenantId: string) => Promise<unknown>) {
        const result = transactionQueue.then(() => work(transactionClient, tenantId));
        transactionQueue = result.then(() => undefined, () => undefined);
        return result;
      },
    };
    const service = new InventoryService(database as never);
    const attempts = await TenantContext.run({ tenantId, requestId: 'inventory-race' }, () => Promise.allSettled(Array.from({ length: 50 }, (_, index) => service.reserve(stock.id, 1, `race-${String(index)}`))));
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(10);
    expect(stock.reserved).toBe(10);
    expect(ledgerEntries).toBe(10);
  });
});
