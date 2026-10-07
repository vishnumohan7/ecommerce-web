import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { TenantScopedPrismaService } from '../database/tenant-scoped.service';

@Controller('api/v1/media')
export class MediaController {
  constructor(private readonly db: TenantScopedPrismaService) {}

  @Public()
  @Get(':id')
  async get(@Param('id') id: string, @Res() response: Response) {
    const asset = await this.db.client.mediaAsset.findFirst({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');
    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Length', String(asset.body.byteLength));
    response.send(Buffer.from(asset.body));
  }
}
