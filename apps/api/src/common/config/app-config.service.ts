import { Injectable } from '@nestjs/common';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STORAGE_ENDPOINT: z.string().url(),
  DEFAULT_TENANT_ID: z.string().uuid().default('00000000-0000-4000-8000-000000000001'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('denes-commerce'),
  AGE_GATE_SECRET: z.string().min(32).optional(),
  GUEST_CART_SECRET: z.string().min(32).optional(),
  AGE_VERIFY_PROVIDER: z.enum(['stub', 'yoti', 'manual']).default('stub'),
  AGE_VERIFICATION_TTL_DAYS: z.coerce.number().int().positive().default(365),
  CHECKOUT_RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  PAYMENT_WEIGHT_VARIANCE_BUFFER_BPS: z.coerce.number().int().min(0).max(10_000).default(1000),
  YOTI_API_BASE_URL: z.string().url().default('https://api.yoti.com'),
  YOTI_CLIENT_SDK_ID: z.string().optional(),
  YOTI_KEY_FILE_PATH: z.string().optional(),
  YOTI_WEBHOOK_SECRET: z.string().min(32).optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3001,http://localhost:3002,http://localhost:3003'),
  STOREFRONT_BASE_URL: z.string().url().default('http://localhost:3001'),
  TURNSTILE_SECRET: z.string().optional(),
  SEARCH_PROVIDER: z.enum(['postgres', 'meilisearch']).default('postgres'),
  MEILI_HOST: z.string().url().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});
export type AppConfig = z.infer<typeof schema>;
@Injectable()
export class AppConfigService {
  readonly values: AppConfig;
  constructor() {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success)
      throw new Error(
        `Configuration validation failed:\n${parsed.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n')}`,
      );
    this.values = parsed.data;
  }
  get port(): number {
    return this.values.PORT;
  }
  get defaultTenantId(): string {
    return this.values.DEFAULT_TENANT_ID;
  }
  get corsOrigins(): string[] {
    return this.values.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
}
