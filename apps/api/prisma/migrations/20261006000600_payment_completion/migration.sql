ALTER TABLE "CheckoutPaymentIntent"
  ADD COLUMN "checkoutTotalMinor" BIGINT;
UPDATE "CheckoutPaymentIntent" SET "checkoutTotalMinor" = "amountMinor";
ALTER TABLE "CheckoutPaymentIntent"
  ALTER COLUMN "checkoutTotalMinor" SET NOT NULL,
  ADD CONSTRAINT "CheckoutPaymentIntent_checkout_total_check" CHECK ("checkoutTotalMinor" >= 0);

ALTER TABLE "Payment"
  ADD COLUMN "refundsFrozen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disputedAt" TIMESTAMP(3);

CREATE TABLE "OrderFulfilmentGroup" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "category" "OrderCategory" NOT NULL,
  "status" "FulfilmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderFulfilmentGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderFulfilmentGroup_tenantId_orderId_category_key"
  ON "OrderFulfilmentGroup"("tenantId", "orderId", "category");
CREATE INDEX "OrderFulfilmentGroup_tenantId_status_createdAt_idx"
  ON "OrderFulfilmentGroup"("tenantId", "status", "createdAt" DESC);
ALTER TABLE "OrderFulfilmentGroup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "OrderFulfilmentGroup"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE "AdminTask" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "orderId" UUID,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminTask_tenantId_status_createdAt_idx"
  ON "AdminTask"("tenantId", "status", "createdAt" DESC);
CREATE INDEX "AdminTask_tenantId_orderId_idx" ON "AdminTask"("tenantId", "orderId");
ALTER TABLE "AdminTask" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "AdminTask"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
