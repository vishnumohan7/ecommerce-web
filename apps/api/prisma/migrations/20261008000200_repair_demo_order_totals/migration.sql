-- Earlier demo seeding appended the same line every time it was run. Keep one
-- deterministic copy per demo order, then reconcile the immutable snapshots.
CREATE TEMPORARY TABLE "_demo_duplicate_order_items" ON COMMIT DROP AS
WITH ranked AS (
  SELECT oi."id", row_number() OVER (
    PARTITION BY oi."orderId", oi."productId", oi."sku", oi."unitPriceMinor", oi."quantity", oi."lineTotalMinor"
    ORDER BY oi."createdAt", oi."id"
  ) AS occurrence
  FROM "OrderItem" oi
  INNER JOIN "Order" o ON o."id" = oi."orderId"
  WHERE o."idempotencyKey" LIKE 'demo-order-%'
)
SELECT "id" FROM ranked WHERE occurrence > 1;

DELETE FROM "PickListItem" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "Substitution" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "WeightCapture" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "AlcoholDayBookEntry" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "RefundItem" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "ReturnRequestItem" WHERE "orderItemId" IN (SELECT "id" FROM "_demo_duplicate_order_items");
DELETE FROM "OrderItem" WHERE "id" IN (SELECT "id" FROM "_demo_duplicate_order_items");

WITH totals AS (
  SELECT
    oi."orderId",
    SUM(oi."unitPriceMinor" * oi."quantity") AS subtotal,
    SUM(oi."lineTotalMinor") AS net_items
  FROM "OrderItem" oi
  INNER JOIN "Order" o ON o."id" = oi."orderId"
  WHERE o."idempotencyKey" LIKE 'demo-order-%'
  GROUP BY oi."orderId"
)
UPDATE "Order" o
SET
  "subtotalMinor" = totals.subtotal,
  "totalMinor" = totals.net_items + o."deliveryFeeMinor",
  "updatedAt" = CURRENT_TIMESTAMP
FROM totals
WHERE o."id" = totals."orderId";

UPDATE "Invoice" i
SET
  "subtotalMinor" = o."subtotalMinor",
  "taxMinor" = o."taxMinor",
  "totalMinor" = o."totalMinor"
FROM "Order" o
WHERE i."orderId" = o."id" AND o."idempotencyKey" LIKE 'demo-order-%';
