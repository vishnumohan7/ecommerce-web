-- Orders created by pre-production/demo tooling predate atomic invoice creation.
-- Allocate deterministic per-tenant/year invoice numbers without changing order totals.
WITH existing_max AS (
  SELECT "tenantId", "invoiceNumberYear", MAX("invoiceNumber") AS max_number
  FROM "Invoice"
  GROUP BY "tenantId", "invoiceNumberYear"
),
missing AS (
  SELECT
    o."tenantId",
    o."id" AS "orderId",
    o."orderNumberYear" AS invoice_year,
    o."subtotalMinor",
    o."taxMinor",
    o."totalMinor",
    o."currency",
    o."createdAt",
    COALESCE(m.max_number, 0) + ROW_NUMBER() OVER (
      PARTITION BY o."tenantId", o."orderNumberYear"
      ORDER BY o."createdAt", o."id"
    ) AS invoice_number
  FROM "Order" o
  LEFT JOIN "Invoice" i ON i."orderId" = o."id"
  LEFT JOIN existing_max m
    ON m."tenantId" = o."tenantId"
   AND m."invoiceNumberYear" = o."orderNumberYear"
  WHERE i."id" IS NULL
)
INSERT INTO "Invoice" (
  "id", "tenantId", "orderId", "invoiceNumber", "invoiceNumberYear",
  "subtotalMinor", "taxMinor", "totalMinor", "currency", "issuedAt"
)
SELECT
  gen_random_uuid(), "tenantId", "orderId", invoice_number, invoice_year,
  "subtotalMinor", "taxMinor", "totalMinor", "currency", "createdAt"
FROM missing;

INSERT INTO "CommerceNumberCounter" ("tenantId", "year", "kind", "nextValue", "updatedAt")
SELECT "tenantId", "invoiceNumberYear", 'INVOICE', MAX("invoiceNumber") + 1, CURRENT_TIMESTAMP
FROM "Invoice"
GROUP BY "tenantId", "invoiceNumberYear"
ON CONFLICT ("tenantId", "year", "kind") DO UPDATE
SET "nextValue" = GREATEST("CommerceNumberCounter"."nextValue", EXCLUDED."nextValue"),
    "updatedAt" = CURRENT_TIMESTAMP;
