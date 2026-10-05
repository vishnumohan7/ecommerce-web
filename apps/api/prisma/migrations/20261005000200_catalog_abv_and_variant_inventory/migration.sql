CREATE TYPE "AlcoholType" AS ENUM ('BEER', 'WINE', 'SPIRITS', 'CIDER', 'OTHER');

ALTER TABLE "Product"
  ADD COLUMN "abv" DECIMAL(4,2),
  ADD COLUMN "alcoholType" "AlcoholType",
  ADD COLUMN "weightGrams" INTEGER;
UPDATE "Product" SET "abv" = ROUND("abvBps"::numeric / 100, 2) WHERE "abvBps" IS NOT NULL;
ALTER TABLE "Product" DROP COLUMN "abvBps";

ALTER TABLE "OrderItem" ADD COLUMN "abv" DECIMAL(4,2);
UPDATE "OrderItem" SET "abv" = ROUND("abvBps"::numeric / 100, 2) WHERE "abvBps" IS NOT NULL;
ALTER TABLE "OrderItem" DROP COLUMN "abvBps";

ALTER TABLE "ProductVariant"
  ADD COLUMN "packSize" TEXT,
  ADD COLUMN "weightGrams" INTEGER,
  ADD COLUMN "abv" DECIMAL(4,2),
  ADD COLUMN "flavour" TEXT;

ALTER TABLE "Inventory" ADD COLUMN "variantId" UUID;
DROP INDEX "Inventory_tenantId_productId_warehouseId_key";
CREATE UNIQUE INDEX "Inventory_tenantId_productId_warehouseId_variantId_key"
  ON "Inventory"("tenantId", "productId", "warehouseId", "variantId");
CREATE UNIQUE INDEX "Inventory_product_default_warehouse_key"
  ON "Inventory"("tenantId", "productId", "warehouseId") WHERE "variantId" IS NULL;
CREATE INDEX "Inventory_tenantId_productId_variantId_idx"
  ON "Inventory"("tenantId", "productId", "variantId");
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
