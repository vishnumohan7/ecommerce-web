ALTER TABLE "PickListItem"
  ADD COLUMN "outcome" TEXT,
  ADD COLUMN "substituteProductId" UUID;

CREATE TABLE "DeliveryAgeCheck" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "outcome" TEXT NOT NULL,
  "challengeAge" INTEGER NOT NULL,
  "idType" TEXT,
  "recipientPresent" BOOLEAN NOT NULL,
  "refusalReason" TEXT,
  "note" TEXT,
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "doorstepPhotoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryAgeCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryAgeCheck_challenge_age_check" CHECK ("challengeAge" BETWEEN 18 AND 100),
  CONSTRAINT "DeliveryAgeCheck_outcome_check" CHECK ("outcome" IN ('PASSED', 'FAILED', 'REFUSED')),
  CONSTRAINT "DeliveryAgeCheck_id_type_check" CHECK ("idType" IS NULL OR "idType" IN ('PASSPORT', 'DRIVING_LICENCE', 'PASS_CARD', 'DIGITAL_DVS', 'OTHER'))
);
CREATE INDEX "DeliveryAgeCheck_tenantId_orderId_createdAt_idx"
  ON "DeliveryAgeCheck"("tenantId", "orderId", "createdAt" DESC);
ALTER TABLE "DeliveryAgeCheck" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON "DeliveryAgeCheck"
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true)::uuid);

CREATE OR REPLACE FUNCTION prevent_compliance_record_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'compliance records are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS alcohol_day_book_immutable ON "AlcoholDayBookEntry";
CREATE TRIGGER alcohol_day_book_immutable
BEFORE UPDATE OR DELETE ON "AlcoholDayBookEntry"
FOR EACH ROW EXECUTE FUNCTION prevent_compliance_record_mutation();
