import { SetMetadata } from '@nestjs/common';
export const RATE_LIMITS = 'rate-limits';
export interface RateLimitPolicy { name: string; limit: number; windowSeconds: number; key: 'ip' | 'email' | 'phone' | 'challenge'; }
export const RateLimits = (...policies: RateLimitPolicy[]) => SetMetadata(RATE_LIMITS, policies);
