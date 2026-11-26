ALTER TABLE "Product"
ADD COLUMN "costPriceMinor" BIGINT;

ALTER TABLE "ProductVariant"
ADD COLUMN "costPriceMinor" BIGINT;

ALTER TABLE "OrderItem"
ADD COLUMN "unitCostMinor" BIGINT;
