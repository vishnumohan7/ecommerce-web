import { z } from 'zod';

export const channelSchema = z.enum(['EMAIL', 'SMS', 'PUSH', 'WHATSAPP']);
export const templateSchema = z.object({
  event: z.string().trim().min(2).max(100),
  channel: channelSchema,
  locale: z.string().trim().min(2).max(20).default('en-GB'),
  subject: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(100_000),
  mjml: z.string().max(250_000).nullable().optional(),
});
export const previewSchema = z.object({
  subject: z.string().max(300).nullable().optional(),
  body: z.string().min(1).max(100_000),
  data: z.record(z.string(), z.unknown()).default({}),
});
export const preferenceSchema = z.object({
  transactionalEmail: z.literal(true).optional(),
  transactionalSms: z.literal(true).optional(),
  transactionalPush: z.literal(true).optional(),
  marketingEmail: z.boolean().optional(),
  marketingSms: z.boolean().optional(),
  marketingPush: z.boolean().optional(),
  consentVersion: z.string().max(100).nullable().optional(),
});
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.record(z.string(), z.string()),
});
export const testSendSchema = z.object({
  recipient: z.string().min(3).max(2048),
  data: z.record(z.string(), z.unknown()).default({}),
});
