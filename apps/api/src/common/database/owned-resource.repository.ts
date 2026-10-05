import { NotFoundException } from '@nestjs/common';
import { TenantContext } from '../tenancy/tenant-context';
export abstract class OwnedResourceRepository<T> {
  protected abstract findScoped(where: { id: string; tenantId: string; userId: string }): Promise<T | null>;
  async findOwnedById(id: string, userId: string): Promise<T> { const resource = await this.findScoped({ id, tenantId: TenantContext.requireTenantId(), userId }); if (!resource) throw new NotFoundException('Resource not found'); return resource; }
}
