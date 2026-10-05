import { config } from 'dotenv';
import { z } from 'zod';
config();
const schema = z.object({ NODE_ENV: z.enum(['development', 'test', 'production']).default('development'), PORT: z.coerce.number().int().positive().default(3000), DATABASE_URL: z.string().url(), REDIS_URL: z.string().url(), STORAGE_ENDPOINT: z.string().url(), STORAGE_BUCKET: z.string().min(1), STORAGE_ACCESS_KEY: z.string().min(1), STORAGE_SECRET_KEY: z.string().min(8) });
const result = schema.safeParse(process.env);
if (!result.success) { console.error('Environment validation failed:\n' + result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`).join('\n')); process.exit(1); }
console.log('Environment is valid.');
