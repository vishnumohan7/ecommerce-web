import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../tenancy/tenant-context';
import { PrismaService } from './prisma.service';

const tenantExtension = Prisma.defineExtension((client) => client.$extends({ name: 'tenant-scope', query: { $allModels: { async $allOperations({ operation, args, query }) {
  const tenantId = TenantContext.requireTenantId();
  const input = args as { where?: Record<string, unknown>; data?: Record<string, unknown> | Record<string, unknown>[] };
  if (['findFirst', 'findMany', 'findUnique', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy'].includes(operation)) input.where = { ...input.where, tenantId };
  if (operation === 'create' && input.data && !Array.isArray(input.data)) input.data = { ...input.data, tenantId };
  if (operation === 'createMany' && input.data) input.data = Array.isArray(input.data) ? input.data.map((data) => ({ ...data, tenantId })) : { ...input.data, tenantId };
  if (operation === 'upsert') { const upsert = args as unknown as { where: Record<string, unknown>; create: Record<string, unknown> }; upsert.where = { ...upsert.where, tenantId }; upsert.create = { ...upsert.create, tenantId }; }
  return query(args);
} } } }));

@Injectable()
export class TenantScopedPrismaService {
  constructor(private readonly root: PrismaService) {}
  get client() { return this.root.$extends(tenantExtension); }
  async transaction<T>(work: (client: Prisma.TransactionClient, tenantId: string) => Promise<T>): Promise<T> {
    const tenantId = TenantContext.requireTenantId();
    return this.root.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`; return work(tx, tenantId); });
  }
}
