import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Client } from 'pg';
import { Public } from './common/auth/auth.decorators';

@ApiTags('System')
@Controller()
export class HealthController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Dependency readiness check' })
  async ready(): Promise<{ status: string; checks: string[] }> {
    const checks: string[] = [];
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
    });

    try {
      await db.connect();
      await db.query('SELECT 1');
      checks.push('database');

      // Media is persisted by DatabaseStorageProvider, so the table is the storage dependency.
      await db.query('SELECT 1 FROM "MediaAsset" LIMIT 1');
      checks.push('media-storage');

      await redis.connect();
      await redis.ping();
      checks.push('redis');

      return { status: 'ready', checks };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        reason: error instanceof Error ? error.message : 'unknown',
      });
    } finally {
      await db.end().catch(() => undefined);
      redis.disconnect();
    }
  }
}
