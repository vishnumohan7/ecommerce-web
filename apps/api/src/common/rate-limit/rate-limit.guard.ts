import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMITS, RateLimitPolicy } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly limits: RateLimitService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> { const policies = this.reflector.getAllAndOverride<RateLimitPolicy[]>(RATE_LIMITS, [context.getHandler(), context.getClass()]) ?? []; if (policies.length === 0) return true; const request = context.switchToHttp().getRequest<Request>(); const body = typeof request.body === 'object' && request.body !== null ? request.body as Record<string, unknown> : {}; for (const policy of policies) { const candidate = policy.key === 'ip' ? request.ip : body[policy.key === 'challenge' ? 'challengeId' : policy.key]; const key = typeof candidate === 'string' ? candidate.toLowerCase() : 'missing'; await this.limits.consume(`${policy.name}:${key}`, policy.limit, policy.windowSeconds); } return true; }
}
