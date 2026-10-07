import { Injectable } from '@nestjs/common';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';
import { TenantContext } from '../tenancy/tenant-context';
import type { StorageProvider } from './storage.provider';

@Injectable()
export class DatabaseStorageProvider implements StorageProvider {
  constructor(private readonly db: TenantScopedPrismaService) {}

  async put(key: string, body: Buffer, contentType: string): Promise<{ key: string; url: string }> {
    if (!contentType.startsWith('image/')) throw new Error('Only image media can be stored');
    const tenantId = TenantContext.requireTenantId();
    const bytes = Uint8Array.from(body);
    const asset = await this.db.client.mediaAsset.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { body: bytes, contentType },
      create: { tenantId, key, body: bytes, contentType },
      select: { id: true },
    });
    const baseUrl = (
      process.env.STORAGE_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3000/api/v1/media'
    ).replace(/\/$/, '');
    return { key, url: `${baseUrl}/${asset.id}` };
  }

  async delete(key: string): Promise<void> {
    await this.db.client.mediaAsset.deleteMany({ where: { key } });
  }
}
