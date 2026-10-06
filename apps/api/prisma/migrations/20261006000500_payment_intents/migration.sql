CREATE TABLE "CheckoutPaymentIntent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "checkoutSessionId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentIntentId" TEXT NOT NULL,
  "clientSecret" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL,
  "manualCapture" BOOLEAN NOT NULL,
  "reservedOrderNumber" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutPaymentIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutPaymentIntent_amount_check" CHECK ("amountMinor" >= 0)
);
CREATE UNIQUE INDEX "CheckoutPaymentIntent_providerPaymentIntentId_key" ON "CheckoutPaymentIntent"("providerPaymentIntentId");
CREATE UNIQUE INDEX "CheckoutPaymentIntent_tenantId_checkoutSessionId_key" ON "CheckoutPaymentIntent"("tenantId", "checkoutSessionId");
CREATE INDEX "CheckoutPaymentIntent_tenantId_status_idx" ON "CheckoutPaymentIntent"("tenantId", "status");
ALTER TABLE "CheckoutPaymentIntent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "CheckoutPaymentIntent"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE SEQUENCE IF NOT EXISTS commerce_order_number_seq START WITH 100001;
CREATE SEQUENCE IF NOT EXISTS commerce_invoice_number_seq START WITH 100001;
