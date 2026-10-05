import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics/metrics.controller';
import { OutboxService } from './outbox/outbox.service';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';
import { TurnstileGuard } from './security/turnstile.guard';
import { TurnstileService } from './security/turnstile.service';
@Global()
@Module({ controllers: [MetricsController], providers: [RateLimitService, RateLimitGuard, TurnstileService, TurnstileGuard, OutboxService], exports: [RateLimitService, RateLimitGuard, TurnstileService, TurnstileGuard, OutboxService] })
export class CoreModule {}
