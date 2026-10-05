ALTER TABLE "Cart"
  ADD COLUMN "couponCode" TEXT,
  ADD COLUMN "abandonedAt" TIMESTAMP(3);

ALTER TABLE "CartItem" RENAME COLUMN "acknowledgedPriceMinor" TO "priceSnapshotMinor";
ALTER TABLE "CartItem"
  ADD COLUMN "orderCategory" "OrderCategory" NOT NULL DEFAULT 'GROCERY',
  ADD COLUMN "snapshotAgeRestriction" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "snapshotStaleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "CartItem" item
SET "orderCategory" = CASE WHEN product."isAlcohol" THEN 'ALCOHOL'::"OrderCategory" ELSE 'GROCERY'::"OrderCategory" END,
    "snapshotAgeRestriction" = product."ageRestriction"
FROM "Product" product
WHERE product."id" = item."productId";

ALTER TABLE "CartItem" ALTER COLUMN "orderCategory" DROP DEFAULT;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" > 0),
  ADD CONSTRAINT "CartItem_snapshotAgeRestriction_check" CHECK ("snapshotAgeRestriction" >= 0);

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_coupon_fkey"
  FOREIGN KEY ("tenantId", "couponCode") REFERENCES "Coupon"("tenantId", "code") ON DELETE SET NULL;

CREATE INDEX "Cart_tenantId_abandonedAt_idx" ON "Cart"("tenantId", "abandonedAt") WHERE "abandonedAt" IS NOT NULL;
