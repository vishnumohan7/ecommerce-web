import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';
@Injectable()
export class RateLimitService {
  private readonly redis: Redis;
  constructor(config: AppConfigService) { this.redis = new Redis(config.values.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }); }
  async consume(key: string, limit: number, windowSeconds: number): Promise<void> { if (this.redis.status === 'wait') await this.redis.connect(); const count = await this.redis.incr(`rate:${key}`); if (count === 1) await this.redis.expire(`rate:${key}`, windowSeconds); if (count > limit) throw new HttpException({ code: 'RATE_LIMITED', message: 'Rate limit exceeded' }, HttpStatus.TOO_MANY_REQUESTS); }
}
