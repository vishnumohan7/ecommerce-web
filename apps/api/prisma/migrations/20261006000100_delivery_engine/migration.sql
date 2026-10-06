ALTER TABLE "DeliveryZone"
  ADD COLUMN "postcodeIncludes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "postcodeExcludes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "groceryFeeMinor" BIGINT,
  ADD COLUMN "alcoholFeeMinor" BIGINT,
  ADD COLUMN "freeDeliveryThresholdMinor" BIGINT,
  ADD COLUMN "minimumOrderMinor" BIGINT,
  ADD COLUMN "maximumOrderMinor" BIGINT,
  ADD COLUMN "alcoholMinimumSubtotalMinor" BIGINT,
  ADD COLUMN "supportedStorageTypes" "StorageType"[] NOT NULL DEFAULT ARRAY['AMBIENT','CHILLED','FROZEN']::"StorageType"[];

UPDATE "DeliveryZone"
SET "groceryFeeMinor" = "deliveryFeeMinor", "alcoholFeeMinor" = "deliveryFeeMinor";

ALTER TABLE "DeliveryZone"
  ALTER COLUMN "groceryFeeMinor" SET NOT NULL,
  ALTER COLUMN "alcoholFeeMinor" SET NOT NULL,
  ADD CONSTRAINT "DeliveryZone_amounts_check" CHECK (
    "deliveryFeeMinor" >= 0 AND "groceryFeeMinor" >= 0 AND "alcoholFeeMinor" >= 0
    AND ("freeDeliveryThresholdMinor" IS NULL OR "freeDeliveryThresholdMinor" >= 0)
    AND ("minimumOrderMinor" IS NULL OR "minimumOrderMinor" >= 0)
    AND ("maximumOrderMinor" IS NULL OR "maximumOrderMinor" >= COALESCE("minimumOrderMinor", 0))
    AND ("alcoholMinimumSubtotalMinor" IS NULL OR "alcoholMinimumSubtotalMinor" >= 0)
  );

ALTER TABLE "DeliverySlot"
  ADD COLUMN "surchargeMinor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "cutoffMinutes" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "allowsAgeRestricted" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "DeliverySlot_capacity_check" CHECK ("capacity" > 0 AND "reserved" >= 0 AND "reserved" <= "capacity"),
  ADD CONSTRAINT "DeliverySlot_window_check" CHECK ("endsAt" > "startsAt"),
  ADD CONSTRAINT "DeliverySlot_surcharge_cutoff_check" CHECK ("surchargeMinor" >= 0 AND "cutoffMinutes" >= 0);

CREATE TABLE "DeliverySlotReservation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "slotId" UUID NOT NULL,
  "cartId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverySlotReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliverySlotReservation_tenantId_cartId_key"
  ON "DeliverySlotReservation"("tenantId", "cartId");
CREATE INDEX "DeliverySlotReservation_tenantId_slotId_idx"
  ON "DeliverySlotReservation"("tenantId", "slotId");

ALTER TABLE "DeliverySlotReservation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "DeliverySlotReservation"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

UPDATE "TenantSettings"
SET "settings" = jsonb_set(
  "settings",
  '{delivery}',
  COALESCE("settings"->'delivery', '{}'::jsonb) || '{"combinationStrategy":"MAX","combinationSurchargeMinor":0,"showBreakdown":false}'::jsonb,
  true
);
