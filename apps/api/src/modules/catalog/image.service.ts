import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { STORAGE_PROVIDER, StorageProvider } from '../../common/storage/storage.provider';
import { TenantScopedPrismaService } from '../../common/database/tenant-scoped.service';
import { TenantContext } from '../../common/tenancy/tenant-context';

type AllowedImage = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
@Injectable()
export class ImageService {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider, private readonly db: TenantScopedPrismaService) {}
  async upload(productId: string, bytes: Buffer, altText: string): Promise<{ primaryUrl: string; assets: string[] }> {
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new BadRequestException('Image size is invalid');
    const mime = this.detect(bytes); if (!mime) throw new BadRequestException('Unsupported image payload');
    const suspicious = bytes.toString('utf8').toLowerCase(); if (['<script', '<svg', '<?php', '%pdf-', 'pk\u0003\u0004'].some((marker) => suspicious.includes(marker))) throw new BadRequestException('Polyglot image payload rejected');
    const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: 64_000_000 }); const metadata = await decoder.metadata(); if (!metadata.width || !metadata.height || metadata.width > 8000 || metadata.height > 8000) throw new BadRequestException('Image dimensions are invalid');
    const digest = createHash('sha256').update(bytes).digest('hex'); const assets: string[] = [];
    for (const width of [320, 640, 1200]) { const widthKey = String(width); const webp = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(); const avif = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).avif({ quality: 55 }).toBuffer(); assets.push((await this.storage.put(`products/${digest}-${widthKey}.webp`, webp, 'image/webp')).url, (await this.storage.put(`products/${digest}-${widthKey}.avif`, avif, 'image/avif')).url); }
    const primaryUrl = assets[4] ?? assets[0]; if (!primaryUrl) throw new BadRequestException('Image processing failed'); const position = await this.db.client.productImage.count({ where: { productId, variantId: null } }); await this.db.client.productImage.create({ data: { tenantId: TenantContext.requireTenantId(), productId, url: primaryUrl, altText, position } }); return { primaryUrl, assets };
  }
  detect(bytes: Buffer): AllowedImage | undefined { if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'; if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'; if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'; if (bytes.subarray(4, 8).toString('ascii') === 'ftyp' && ['avif', 'avis', 'mif1'].includes(bytes.subarray(8, 12).toString('ascii'))) return 'image/avif'; return undefined; }
}
