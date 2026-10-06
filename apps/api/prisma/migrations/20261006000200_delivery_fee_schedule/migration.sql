ALTER TABLE "DeliveryZone"
  ADD COLUMN "feeSchedule" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "DeliveryZone"
  ADD CONSTRAINT "DeliveryZone_fee_schedule_array_check"
  CHECK (jsonb_typeof("feeSchedule") = 'array');
