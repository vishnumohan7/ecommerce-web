ALTER TABLE "NotificationPreference"
  ADD COLUMN "transactionalPush" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "marketingPush" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "NotificationTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "event" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en-GB',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "mjml" TEXT,
  "version" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationTemplate_tenantId_event_channel_locale_version_key"
  ON "NotificationTemplate"("tenantId", "event", "channel", "locale", "version");
CREATE INDEX "NotificationTemplate_tenantId_event_channel_locale_active_idx"
  ON "NotificationTemplate"("tenantId", "event", "channel", "locale", "active");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "sourceMessageId" UUID,
  "userId" UUID,
  "templateId" UUID,
  "event" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "transactional" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_status_check" CHECK ("status" IN ('QUEUED','PROCESSING','SENT','BLOCKED','DEAD_LETTER')),
  CONSTRAINT "NotificationDelivery_channel_check" CHECK ("channel" IN ('EMAIL','SMS','PUSH','WHATSAPP'))
);

CREATE UNIQUE INDEX "NotificationDelivery_tenantId_sourceMessageId_channel_recipient_key"
  ON "NotificationDelivery"("tenantId", "sourceMessageId", "channel", "recipient");
CREATE INDEX "NotificationDelivery_tenantId_status_availableAt_idx"
  ON "NotificationDelivery"("tenantId", "status", "availableAt");
CREATE INDEX "NotificationDelivery_tenantId_userId_createdAt_idx"
  ON "NotificationDelivery"("tenantId", "userId", "createdAt" DESC);

ALTER TABLE "NotificationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "NotificationTemplate_tenant_isolation" ON "NotificationTemplate"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY "NotificationDelivery_tenant_isolation" ON "NotificationDelivery"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);
