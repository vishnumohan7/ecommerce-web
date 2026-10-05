import { describe, expect, it } from 'vitest';
import { TenantContext } from '../src/common/tenancy/tenant-context';
import { OwnedResourceRepository } from '../src/common/database/owned-resource.repository';
class Repository extends OwnedResourceRepository<{ id: string }> { protected override findScoped(where: { id: string; tenantId: string; userId: string }) { return Promise.resolve(where.id === 'owned' && where.userId === 'user-a' ? { id: where.id } : null); } }
describe('IDOR repository', () => {
  it('returns 404 for a cross-user identifier', async () => TenantContext.run({ tenantId: '00000000-0000-4000-8000-000000000001', requestId: 'test' }, async () => expect(new Repository().findOwnedById('owned', 'user-b')).rejects.toMatchObject({ status: 404 })));
});
