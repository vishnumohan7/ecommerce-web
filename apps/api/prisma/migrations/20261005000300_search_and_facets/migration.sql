ALTER TABLE "Product"
  ADD COLUMN "ratingAverageBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "searchDocument" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("sku", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_ratingAverageBps_check" CHECK ("ratingAverageBps" BETWEEN 0 AND 500),
  ADD CONSTRAINT "Product_ratingCount_check" CHECK ("ratingCount" >= 0);

CREATE INDEX "Product_searchDocument_idx" ON "Product" USING GIN ("searchDocument");
CREATE INDEX "Product_description_trgm_idx" ON "Product" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Category_name_trgm_idx" ON "Category" USING GIN ("name" gin_trgm_ops);

CREATE TABLE "SearchSynonym" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "terms" TEXT[] NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SearchSynonym_terms_check" CHECK (cardinality("terms") >= 2)
);

CREATE INDEX "SearchSynonym_tenantId_enabled_idx" ON "SearchSynonym"("tenantId", "enabled");
ALTER TABLE "SearchSynonym" ADD CONSTRAINT "SearchSynonym_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;

CREATE TABLE "SearchLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID,
  "query" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "resultCount" INTEGER NOT NULL,
  "responseTimeMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchLog_tenantId_query_createdAt_idx" ON "SearchLog"("tenantId", "query", "createdAt" DESC);
CREATE INDEX "SearchLog_tenantId_resultCount_createdAt_idx" ON "SearchLog"("tenantId", "resultCount", "createdAt" DESC);
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "SearchLog" ADD CONSTRAINT "SearchLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE TABLE "PromotionProduct" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "promotionId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromotionProduct_tenantId_promotionId_productId_key" ON "PromotionProduct"("tenantId", "promotionId", "productId");
CREATE INDEX "PromotionProduct_tenantId_productId_promotionId_idx" ON "PromotionProduct"("tenantId", "productId", "promotionId");
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE;
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;

ALTER TABLE "SearchSynonym" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_searchsynonym ON "SearchSynonym"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "SearchLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_searchlog ON "SearchLog"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
ALTER TABLE "PromotionProduct" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_promotionproduct ON "PromotionProduct"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

INSERT INTO "SearchSynonym" ("tenantId", "terms", "updatedAt")
SELECT "id", ARRAY['aubergine', 'eggplant'], CURRENT_TIMESTAMP FROM "Tenant";
INSERT INTO "SearchSynonym" ("tenantId", "terms", "updatedAt")
SELECT "id", ARRAY['coriander', 'cilantro'], CURRENT_TIMESTAMP FROM "Tenant";
