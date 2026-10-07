CREATE TABLE "MediaAsset" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "body" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_tenantId_key_key" ON "MediaAsset"("tenantId", "key");
CREATE INDEX "MediaAsset_tenantId_createdAt_idx" ON "MediaAsset"("tenantId", "createdAt" DESC);
