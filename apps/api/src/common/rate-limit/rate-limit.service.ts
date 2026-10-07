import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

interface LocalCounter { count: number; expiresAt: number; }

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly redis: Redis;
  private readonly localCounters = new Map<string, LocalCounter>();
  private redisUnavailableUntil = 0;

  constructor(config: AppConfigService) {
    this.redis = new Redis(config.values.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, retryStrategy: () => null });
    this.redis.on('error', () => undefined);
  }

  async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    if (Date.now() >= this.redisUnavailableUntil) {
      try {
        if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
        const count = await this.redis.incr(`rate:${key}`);
        if (count === 1) await this.redis.expire(`rate:${key}`, windowSeconds);
        this.enforce(count, limit);
        return;
      } catch {
        this.redisUnavailableUntil = Date.now() + 60_000;
        this.logger.warn('Redis is unavailable; using instance-local rate limiting temporarily');
      }
    }

    this.consumeLocally(key, limit, windowSeconds);
  }

  private consumeLocally(key: string, limit: number, windowSeconds: number): void {
    const now = Date.now();
    const current = this.localCounters.get(key);
    const next = !current || current.expiresAt <= now
      ? { count: 1, expiresAt: now + windowSeconds * 1000 }
      : { ...current, count: current.count + 1 };
    this.localCounters.set(key, next);
    this.enforce(next.count, limit);
  }

  private enforce(count: number, limit: number): void {
    if (count > limit) throw new HttpException({ code: 'RATE_LIMITED', message: 'Rate limit exceeded' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}
