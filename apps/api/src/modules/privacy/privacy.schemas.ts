import { z } from 'zod';

export const consentUpdateSchema = z.object({
  version: z.string().trim().min(1).max(100),
  source: z.enum(['WEB', 'ADMIN', 'IMPORT']).default('WEB'),
  consents: z.array(z.object({ category: z.enum(['ESSENTIAL', 'ANALYTICS', 'MARKETING', 'PERSONALISATION']), granted: z.boolean() })).min(1).max(10),
});

export const privacyReviewSchema = z.object({
  status: z.enum(['IN_REVIEW', 'COMPLETED', 'REJECTED']),
  adminNote: z.string().trim().max(2000).nullable().optional(),
});
