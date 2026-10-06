CREATE TYPE "TaxCategory" AS ENUM ('STANDARD_20', 'REDUCED_5', 'ZERO', 'EXEMPT');
CREATE TYPE "CouponClass" AS ENUM ('CUSTOMER_CREDIT', 'SITE_WIDE', 'INFLUENCER');
CREATE TYPE "CouponAppliesTo" AS ENUM ('GROCERY', 'ALCOHOL', 'BOTH');

ALTER TABLE "Product" ADD COLUMN "taxCategory" "TaxCategory" NOT NULL DEFAULT 'ZERO';
UPDATE "Product"
SET "taxCategory" = CASE
  WHEN "vatRateBps" = 0 THEN 'ZERO'::"TaxCategory"
  WHEN "vatRateBps" = 500 THEN 'REDUCED_5'::"TaxCategory"
  ELSE 'STANDARD_20'::"TaxCategory"
END;

ALTER TABLE "Coupon"
  ADD COLUMN "maximumDiscountMinor" BIGINT,
  ADD COLUMN "couponClass" "CouponClass" NOT NULL DEFAULT 'SITE_WIDE',
  ADD COLUMN "appliesTo" "CouponAppliesTo" NOT NULL DEFAULT 'BOTH',
  ADD COLUMN "perCustomerLimit" INTEGER,
  ADD COLUMN "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "productIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "categoryIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "brandIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN "influencerId" UUID,
  ADD COLUMN "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "commissionBasis" TEXT NOT NULL DEFAULT 'NET_EX_VAT_DELIVERY',
  ADD CONSTRAINT "Coupon_limits_check" CHECK (
    ("valueBps" IS NULL OR ("valueBps" >= 0 AND "valueBps" <= 10000))
    AND ("valueMinor" IS NULL OR "valueMinor" >= 0)
    AND ("maximumDiscountMinor" IS NULL OR "maximumDiscountMinor" >= 0)
    AND ("minimumSpendMinor" IS NULL OR "minimumSpendMinor" >= 0)
    AND ("maxUses" IS NULL OR "maxUses" > 0)
    AND ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0)
    AND "attributionWindowDays" >= 0
  );

CREATE TABLE "CouponRedemption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "couponId" UUID NOT NULL,
  "userId" UUID,
  "guestToken" TEXT,
  "orderId" UUID,
  "discountMinor" BIGINT NOT NULL,
  "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CouponRedemption_owner_check" CHECK (num_nonnulls("userId", "guestToken") = 1),
  CONSTRAINT "CouponRedemption_discount_check" CHECK ("discountMinor" >= 0)
);
CREATE INDEX "CouponRedemption_tenantId_couponId_createdAt_idx" ON "CouponRedemption"("tenantId", "couponId", "createdAt");
CREATE INDEX "CouponRedemption_tenantId_userId_couponId_idx" ON "CouponRedemption"("tenantId", "userId", "couponId");
CREATE INDEX "CouponRedemption_tenantId_guestToken_couponId_idx" ON "CouponRedemption"("tenantId", "guestToken", "couponId");

CREATE TABLE "TaxRule" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "taxCategory" "TaxCategory" NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxRule_rate_check" CHECK ("rateBps" >= 0 AND "rateBps" <= 10000),
  CONSTRAINT "TaxRule_window_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);
CREATE UNIQUE INDEX "TaxRule_tenantId_taxCategory_effectiveFrom_key" ON "TaxRule"("tenantId", "taxCategory", "effectiveFrom");
CREATE INDEX "TaxRule_tenantId_taxCategory_active_effectiveFrom_idx" ON "TaxRule"("tenantId", "taxCategory", "active", "effectiveFrom");

INSERT INTO "TaxRule" ("tenantId", "taxCategory", "rateBps", "effectiveFrom")
SELECT "id", category, rate, TIMESTAMP '2026-01-01 00:00:00'
FROM "Tenant"
CROSS JOIN (VALUES
  ('STANDARD_20'::"TaxCategory", 2000),
  ('REDUCED_5'::"TaxCategory", 500),
  ('ZERO'::"TaxCategory", 0),
  ('EXEMPT'::"TaxCategory", 0)
) AS defaults(category, rate);

ALTER TABLE "CouponRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaxRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "CouponRedemption"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "TaxRule"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

UPDATE "TenantSettings"
SET "settings" = jsonb_set(
  "settings",
  '{pricing}',
  COALESCE("settings"->'pricing', '{}'::jsonb) || '{"couponStackingPolicy":"STACK","pricesIncludeVat":true}'::jsonb,
  true
);
