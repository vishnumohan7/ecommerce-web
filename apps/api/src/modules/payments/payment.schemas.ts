import { z } from 'zod';

export const paymentIntentSchema = z.object({ checkoutSessionId: z.string().uuid() });
export const paymentCaptureSchema = z.object({
  recomputedAmountMinor: z.coerce.bigint().nonnegative(),
});
