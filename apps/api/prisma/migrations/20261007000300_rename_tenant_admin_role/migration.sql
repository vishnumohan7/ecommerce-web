ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TYPE "UserRole" RENAME TO "UserRole_legacy";
CREATE TYPE "UserRole" AS ENUM (
  'SUPER_ADMIN',
  'ADMINISTRATOR',
  'STORE_MANAGER',
  'CATALOG_MANAGER',
  'FULFILMENT_STAFF',
  'CUSTOMER'
);
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE
      WHEN "role"::text = 'TENANT_ADMIN' THEN 'ADMINISTRATOR'
      ELSE "role"::text
    END
  )::"UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
DROP TYPE "UserRole_legacy";

UPDATE "Role"
SET "key" = 'ADMINISTRATOR',
    "name" = 'ADMINISTRATOR',
    "description" = 'System role ADMINISTRATOR',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'TENANT_ADMIN';
