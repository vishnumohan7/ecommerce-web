-- Older fixture orders recorded CAPTURED/REFUNDED on Order without creating the
-- matching Payment aggregate required by the guarded refund workflow.
INSERT INTO "Payment" (
  "id",
  "tenantId",
  "orderId",
  "provider",
  "providerPaymentIntentId",
  "status",
  "authorisedAmountMinor",
  "capturedAmountMinor",
  "refundedAmountMinor",
  "currency",
  "manualCapture",
  "refundsFrozen",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  orders."tenantId",
  orders."id",
  'STUB',
  'pi_seed_' || replace(orders."id"::text, '-', ''),
  orders."paymentStatus",
  orders."totalMinor",
  orders."totalMinor",
  CASE WHEN orders."paymentStatus" = 'REFUNDED' THEN orders."totalMinor" ELSE 0 END,
  orders."currency",
  false,
  false,
  orders."createdAt",
  now()
FROM "Order" orders
LEFT JOIN "Payment" payments ON payments."orderId" = orders."id"
WHERE payments."id" IS NULL
  AND orders."idempotencyKey" LIKE 'demo-order-%'
  AND orders."paymentStatus" IN ('CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED');
