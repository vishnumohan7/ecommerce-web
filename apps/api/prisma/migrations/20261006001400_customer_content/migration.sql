CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ContentBlockType" AS ENUM ('FEATURED_PRODUCTS', 'CATEGORY_TILES', 'PROMO_BLOCK');

CREATE TABLE "Banner" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "subtitle" TEXT,
  "imageUrl" TEXT NOT NULL,
  "mobileImageUrl" TEXT,
  "linkUrl" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Banner_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Banner_schedule_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "CmsContentBlock" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "type" "ContentBlockType" NOT NULL,
  "title" TEXT,
  "content" JSONB NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsContentBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CmsContentBlock_schedule_check" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "Wishlist" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wishlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WishlistItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "wishlistId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "imageUrls" TEXT[] NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "moderationReason" TEXT,
  "moderatedById" UUID,
  "moderatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "Wishlist_tenantId_userId_key" ON "Wishlist"("tenantId", "userId");
CREATE INDEX "Wishlist_tenantId_userId_idx" ON "Wishlist"("tenantId", "userId");
CREATE UNIQUE INDEX "WishlistItem_tenantId_wishlistId_productId_key" ON "WishlistItem"("tenantId", "wishlistId", "productId");
CREATE INDEX "WishlistItem_tenantId_wishlistId_createdAt_idx" ON "WishlistItem"("tenantId", "wishlistId", "createdAt" DESC);
CREATE INDEX "WishlistItem_tenantId_productId_idx" ON "WishlistItem"("tenantId", "productId");
CREATE UNIQUE INDEX "Review_tenantId_userId_productId_key" ON "Review"("tenantId", "userId", "productId");
CREATE INDEX "Review_tenantId_productId_status_createdAt_idx" ON "Review"("tenantId", "productId", "status", "createdAt" DESC);
CREATE INDEX "Review_tenantId_userId_createdAt_idx" ON "Review"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "Banner_tenantId_active_position_idx" ON "Banner"("tenantId", "active", "position");
CREATE INDEX "CmsContentBlock_tenantId_active_type_position_idx" ON "CmsContentBlock"("tenantId", "active", "type", "position");

ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_wishlistId_fkey" FOREIGN KEY ("wishlistId") REFERENCES "Wishlist"("id") ON DELETE CASCADE;
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT;

ALTER TABLE "Banner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CmsContentBlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wishlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WishlistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "Banner" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "CmsContentBlock" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "Wishlist" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "WishlistItem" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "Review" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
