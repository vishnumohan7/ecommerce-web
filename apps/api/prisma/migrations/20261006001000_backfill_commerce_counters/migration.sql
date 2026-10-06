INSERT INTO "CommerceNumberCounter" ("tenantId", "year", "kind", "nextValue", "updatedAt")
SELECT "tenantId", "orderNumberYear", 'ORDER', MAX("orderNumber") + 1, CURRENT_TIMESTAMP
FROM "Order"
GROUP BY "tenantId", "orderNumberYear"
ON CONFLICT ("tenantId", "year", "kind") DO UPDATE
SET "nextValue" = GREATEST("CommerceNumberCounter"."nextValue", EXCLUDED."nextValue"),
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CommerceNumberCounter" ("tenantId", "year", "kind", "nextValue", "updatedAt")
SELECT "tenantId", "invoiceNumberYear", 'INVOICE', MAX("invoiceNumber") + 1, CURRENT_TIMESTAMP
FROM "Invoice"
GROUP BY "tenantId", "invoiceNumberYear"
ON CONFLICT ("tenantId", "year", "kind") DO UPDATE
SET "nextValue" = GREATEST("CommerceNumberCounter"."nextValue", EXCLUDED."nextValue"),
    "updatedAt" = CURRENT_TIMESTAMP;
