CREATE TYPE "AgeVerificationMethod" AS ENUM ('DOB_DECLARATION', 'DVS', 'MANUAL_REVIEW');

ALTER TABLE "Jurisdiction"
  ADD COLUMN "postcodeAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Jurisdiction"
SET "postcodeAreas" = CASE "code"
  WHEN 'SCOTLAND' THEN ARRAY['AB','DD','DG','EH','FK','G','HS','IV','KA','KW','KY','ML','PA','PH','TD','ZE']::TEXT[]
  WHEN 'NORTHERN_IRELAND' THEN ARRAY['BT']::TEXT[]
  ELSE ARRAY[]::TEXT[]
END;

ALTER TABLE "AgeVerification" RENAME COLUMN "outcome" TO "status";
ALTER TABLE "AgeVerification" RENAME COLUMN "providerReference" TO "providerRef";
ALTER TABLE "AgeVerification" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "AgeVerification" ADD COLUMN "declaredDateOfBirth" DATE;

ALTER TABLE "AgeVerification" ALTER COLUMN "method" DROP DEFAULT;
UPDATE "AgeVerification"
SET "method" = CASE
  WHEN "method" = 'DOB_DECLARATION' THEN 'DOB_DECLARATION'
  WHEN "method" = 'MANUAL_REVIEW' THEN 'MANUAL_REVIEW'
  ELSE 'DVS'
END
WHERE "method" IS NULL OR "method" NOT IN ('DOB_DECLARATION', 'MANUAL_REVIEW', 'DVS');
ALTER TABLE "AgeVerification"
  ALTER COLUMN "method" TYPE "AgeVerificationMethod" USING "method"::"AgeVerificationMethod",
  ALTER COLUMN "method" SET NOT NULL;

ALTER TABLE "AgeVerification"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AgeVerificationStatus"
    USING (CASE WHEN "status"::text = 'CANCELLED' THEN 'FAILED' ELSE "status"::text END)::"AgeVerificationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

UPDATE "AgeVerification"
SET "verifiedAt" = "updatedAt"
WHERE "status" = 'PASSED' AND "verifiedAt" IS NULL;

DROP INDEX IF EXISTS "AgeVerification_tenantId_userId_outcome_idx";
DROP INDEX IF EXISTS "AgeVerification_tenantId_guestToken_outcome_idx";
CREATE INDEX "AgeVerification_tenantId_userId_status_expiresAt_idx"
  ON "AgeVerification"("tenantId", "userId", "status", "expiresAt");
CREATE INDEX "AgeVerification_tenantId_guestToken_status_expiresAt_idx"
  ON "AgeVerification"("tenantId", "guestToken", "status", "expiresAt");

ALTER TABLE "AgeVerification"
  ADD CONSTRAINT "AgeVerification_exactly_one_owner_check"
  CHECK (num_nonnulls("userId", "guestToken") = 1) NOT VALID;
ALTER TABLE "AgeVerification" VALIDATE CONSTRAINT "AgeVerification_exactly_one_owner_check";

ALTER TABLE "AgeVerification"
  ADD CONSTRAINT "AgeVerification_passed_fields_check"
  CHECK (
    "status" <> 'PASSED'
    OR ("verifiedAgeOver" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "expiresAt" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "AgeVerification" VALIDATE CONSTRAINT "AgeVerification_passed_fields_check";
