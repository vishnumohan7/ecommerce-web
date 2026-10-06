CREATE TYPE "CheckoutSessionStatus" AS ENUM ('ACTIVE', 'INVALIDATED', 'EXPIRED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "CheckoutSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "userId" UUID,
  "guestToken" TEXT,
  "guestUserId" UUID,
  "deliverySlotId" UUID,
  "snapshot" JSONB NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "totalMinor" BIGINT NOT NULL,
  "status" "CheckoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CheckoutSession_owner_check" CHECK (num_nonnulls("userId", "guestToken") = 1),
  CONSTRAINT "CheckoutSession_total_check" CHECK ("totalMinor" >= 0),
  CONSTRAINT "CheckoutSession_expiry_check" CHECK ("expiresAt" > "createdAt")
);
CREATE INDEX "CheckoutSession_tenantId_cartId_status_idx" ON "CheckoutSession"("tenantId", "cartId", "status");
CREATE INDEX "CheckoutSession_tenantId_userId_status_idx" ON "CheckoutSession"("tenantId", "userId", "status");
CREATE INDEX "CheckoutSession_tenantId_guestToken_status_idx" ON "CheckoutSession"("tenantId", "guestToken", "status");
CREATE INDEX "CheckoutSession_tenantId_status_expiresAt_idx" ON "CheckoutSession"("tenantId", "status", "expiresAt");

CREATE TABLE "StockReservation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "checkoutSessionId" UUID NOT NULL,
  "inventoryId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockReservation_quantity_check" CHECK ("quantity" > 0)
);
CREATE UNIQUE INDEX "StockReservation_tenantId_checkoutSessionId_productId_inventoryId_key" ON "StockReservation"("tenantId", "checkoutSessionId", "productId", "inventoryId");
CREATE INDEX "StockReservation_tenantId_checkoutSessionId_releasedAt_idx" ON "StockReservation"("tenantId", "checkoutSessionId", "releasedAt");
CREATE INDEX "StockReservation_tenantId_expiresAt_releasedAt_idx" ON "StockReservation"("tenantId", "expiresAt", "releasedAt");

ALTER TABLE "CheckoutSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockReservation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "CheckoutSession"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "StockReservation"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
