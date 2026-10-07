CREATE TABLE "PrivacyConsent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacyConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyRequest" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "adminNote" TEXT,
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "reviewedById" UUID,
  "reviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivacyRequest_type_check" CHECK ("type" IN ('EXPORT', 'ERASURE')),
  CONSTRAINT "PrivacyRequest_status_check" CHECK ("status" IN ('PENDING', 'IN_REVIEW', 'COMPLETED', 'REJECTED'))
);

CREATE INDEX "PrivacyConsent_tenantId_userId_category_createdAt_idx" ON "PrivacyConsent"("tenantId", "userId", "category", "createdAt" DESC);
CREATE INDEX "PrivacyRequest_tenantId_userId_createdAt_idx" ON "PrivacyRequest"("tenantId", "userId", "createdAt" DESC);
CREATE INDEX "PrivacyRequest_tenantId_status_deadlineAt_idx" ON "PrivacyRequest"("tenantId", "status", "deadlineAt");
ALTER TABLE "PrivacyConsent" ADD CONSTRAINT "PrivacyConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

ALTER TABLE "PrivacyConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrivacyRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "PrivacyConsent" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_policy ON "PrivacyRequest" USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
