CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REFUND_PENDING', 'COMPLETED');

ALTER TABLE "Refund"
  ADD COLUMN "returnRequestId" UUID,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "requestHash" TEXT,
  ADD COLUMN "method" TEXT NOT NULL DEFAULT 'CARD';
UPDATE "Refund" SET "idempotencyKey" = "id"::text, "requestHash" = md5("id"::text);
ALTER TABLE "Refund"
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "requestHash" SET NOT NULL,
  ADD CONSTRAINT "Refund_amount_positive_check" CHECK ("amountMinor" > 0);
CREATE UNIQUE INDEX "Refund_tenantId_idempotencyKey_key" ON "Refund"("tenantId", "idempotencyKey");

CREATE TABLE "RefundItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL,
  "refundId" UUID NOT NULL, "orderItemId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "amountMinor" BIGINT NOT NULL, "vatPortionMinor" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundItem_quantity_positive_check" CHECK ("quantity" > 0),
  CONSTRAINT "RefundItem_amount_nonnegative_check" CHECK ("amountMinor" >= 0),
  CONSTRAINT "RefundItem_vat_nonnegative_check" CHECK ("vatPortionMinor" >= 0)
);
CREATE UNIQUE INDEX "RefundItem_tenantId_refundId_orderItemId_key" ON "RefundItem"("tenantId", "refundId", "orderItemId");
CREATE INDEX "RefundItem_tenantId_orderItemId_idx" ON "RefundItem"("tenantId", "orderItemId");

CREATE TABLE "ReturnRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL, "userId" UUID NOT NULL,
  "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED', "reason" TEXT NOT NULL,
  "customerNote" TEXT, "adminNote" TEXT, "disposition" TEXT, "policySnapshot" JSONB NOT NULL,
  "reviewedById" UUID, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReturnRequest_tenantId_userId_createdAt_idx" ON "ReturnRequest"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "ReturnRequest_tenantId_status_createdAt_idx" ON "ReturnRequest"("tenantId", "status", "createdAt" DESC);
CREATE INDEX "ReturnRequest_tenantId_orderId_idx" ON "ReturnRequest"("tenantId", "orderId");

CREATE TABLE "ReturnRequestItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "tenantId" UUID NOT NULL,
  "returnRequestId" UUID NOT NULL, "orderItemId" UUID NOT NULL, "quantity" INTEGER NOT NULL,
  "policySnapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequestItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnRequestItem_quantity_positive_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "ReturnRequestItem_tenantId_returnRequestId_orderItemId_key" ON "ReturnRequestItem"("tenantId", "returnRequestId", "orderItemId");
CREATE INDEX "ReturnRequestItem_tenantId_orderItemId_idx" ON "ReturnRequestItem"("tenantId", "orderItemId");

ALTER TABLE "Coupon" ADD COLUMN "lockedUserId" UUID, ADD COLUMN "returnRequestId" UUID;
CREATE INDEX "Coupon_tenantId_lockedUserId_idx" ON "Coupon"("tenantId", "lockedUserId");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE CASCADE;
ALTER TABLE "RefundItem" ADD CONSTRAINT "RefundItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE;
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT;

ALTER TABLE "RefundItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReturnRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReturnRequestItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "RefundItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "ReturnRequest" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "ReturnRequestItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE OR REPLACE FUNCTION enforce_refund_captured_limit() RETURNS trigger AS $$
DECLARE captured BIGINT; frozen BOOLEAN; already_reserved BIGINT;
BEGIN
  SELECT "capturedAmountMinor", "refundsFrozen" INTO captured, frozen FROM "Payment"
    WHERE "id" = NEW."paymentId" AND "tenantId" = NEW."tenantId" FOR UPDATE;
  IF captured IS NULL THEN RAISE EXCEPTION 'REFUND_PAYMENT_NOT_FOUND'; END IF;
  IF frozen THEN RAISE EXCEPTION 'REFUNDS_FROZEN'; END IF;
  SELECT COALESCE(SUM("amountMinor"), 0) INTO already_reserved FROM "Refund"
    WHERE "paymentId" = NEW."paymentId" AND "tenantId" = NEW."tenantId"
      AND "status" <> 'FAILED' AND "id" <> NEW."id";
  IF already_reserved + NEW."amountMinor" > captured THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER refund_captured_limit_guard BEFORE INSERT OR UPDATE OF "amountMinor", "status", "paymentId" ON "Refund"
FOR EACH ROW WHEN (NEW."status" <> 'FAILED') EXECUTE FUNCTION enforce_refund_captured_limit();

UPDATE "TenantSettings" SET "settings" = "settings" || jsonb_build_object('returns', jsonb_build_object(
  'GROCERY', jsonb_build_object('windowDays', 14, 'eligibleReasons', jsonb_build_array('DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE', 'UNWANTED'), 'disposition', 'RESTOCK_OR_WRITE_OFF', 'approvalRole', 'STORE_MANAGER'),
  'ALCOHOL', jsonb_build_object('windowDays', 14, 'eligibleReasons', jsonb_build_array('DAMAGED', 'WRONG_ITEM', 'QUALITY_ISSUE'), 'disposition', 'WRITE_OFF', 'approvalRole', 'STORE_MANAGER')
)) WHERE NOT ("settings" ? 'returns');
