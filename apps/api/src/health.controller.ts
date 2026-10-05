import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { Client } from 'pg';
import { Public } from './common/auth/auth.decorators';

@ApiTags('System')
@Controller()
export class HealthController {
  @Public() @Get('health') @ApiOperation({ summary: 'Liveness check' }) health(): { status: string } { return { status: 'ok' }; }
  @Public() @Get('ready') @ApiOperation({ summary: 'Dependency readiness check' }) async ready(): Promise<{ status: string; checks: string[] }> {
    const checks: string[] = [];
    try {
      const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect(); await db.query('SELECT 1'); await db.end(); checks.push('database');
      const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: true, maxRetriesPerRequest: 1 }); await redis.connect(); await redis.ping(); redis.disconnect(); checks.push('redis');
      const endpoint = process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000'; const response = await fetch(`${endpoint}/minio/health/live`); if (!response.ok) throw new Error('storage unhealthy'); checks.push('storage');
      return { status: 'ready', checks };
    } catch (error) { throw new ServiceUnavailableException({ status: 'not-ready', reason: error instanceof Error ? error.message : 'unknown' }); }
  }
}
