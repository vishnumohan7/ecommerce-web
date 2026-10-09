import { z } from 'zod';

const itemSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const createReturnSchema = z.object({
  orderId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toUpperCase()),
  customerNote: z.string().trim().max(1000).optional(),
  items: z.array(itemSchema).min(1).max(100),
});

export const updateReturnSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED']),
    adminNote: z.string().trim().max(1000).optional(),
    disposition: z.enum(['RESTOCK', 'WRITE_OFF']).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === 'APPROVED' && !value.disposition)
      context.addIssue({
        code: 'custom',
        path: ['disposition'],
        message: 'Disposition is required for approval',
      });
  });

export const createRefundSchema = z
  .object({
    orderId: z.string().uuid(),
    returnRequestId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(8).max(200),
    reason: z.string().trim().min(1).max(300),
    method: z.enum(['CARD', 'STORE_CREDIT']).default('CARD'),
    items: z.array(itemSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const item of value.items) {
      if (seen.has(item.orderItemId))
        context.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate order item' });
      seen.add(item.orderItemId);
    }
  });

export const returnListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'REFUND_PENDING', 'COMPLETED']).optional(),
  orderId: z.string().uuid().optional(),
});
