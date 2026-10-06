ALTER TABLE "Order" ADD COLUMN "orderNumberYear" INTEGER;
UPDATE "Order" SET "orderNumberYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER;
ALTER TABLE "Order" ALTER COLUMN "orderNumberYear" SET NOT NULL;
DROP INDEX IF EXISTS "Order_tenantId_orderNumber_key";
CREATE UNIQUE INDEX "Order_tenantId_orderNumberYear_orderNumber_key"
  ON "Order"("tenantId", "orderNumberYear", "orderNumber");

ALTER TABLE "Invoice" ADD COLUMN "invoiceNumberYear" INTEGER;
UPDATE "Invoice" SET "invoiceNumberYear" = EXTRACT(YEAR FROM "issuedAt")::INTEGER;
ALTER TABLE "Invoice" ALTER COLUMN "invoiceNumberYear" SET NOT NULL;
DROP INDEX IF EXISTS "Invoice_tenantId_invoiceNumber_key";
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumberYear_invoiceNumber_key"
  ON "Invoice"("tenantId", "invoiceNumberYear", "invoiceNumber");

CREATE TABLE "CommerceNumberCounter" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "nextValue" BIGINT NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceNumberCounter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommerceNumberCounter_kind_check" CHECK ("kind" IN ('ORDER', 'INVOICE')),
  CONSTRAINT "CommerceNumberCounter_next_check" CHECK ("nextValue" > 0)
);
CREATE UNIQUE INDEX "CommerceNumberCounter_tenantId_year_kind_key"
  ON "CommerceNumberCounter"("tenantId", "year", "kind");
ALTER TABLE "CommerceNumberCounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "CommerceNumberCounter"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
