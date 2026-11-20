-- Attach historic guest orders to an active account when the checkout email matches.
-- Tombstoned guest users are retained because checkout sessions can still reference them.
UPDATE "Order" AS orders
SET "userId" = (
  SELECT account."id"
  FROM "User" AS account
  WHERE account."tenantId" = orders."tenantId"
    AND account."active" = TRUE
    AND account."tombstonedAt" IS NULL
    AND LOWER(account."email") = LOWER(orders."customerSnapshot" ->> 'email')
  ORDER BY account."createdAt" ASC
  LIMIT 1
)
FROM "User" AS guest_user
WHERE orders."userId" = guest_user."id"
  AND guest_user."tenantId" = orders."tenantId"
  AND guest_user."tombstonedAt" IS NOT NULL
  AND guest_user."email" LIKE 'guest+%@tombstone.invalid'
  AND COALESCE(orders."customerSnapshot" ->> 'email', '') <> ''
  AND EXISTS (
    SELECT 1
    FROM "User" AS account
    WHERE account."tenantId" = orders."tenantId"
      AND account."active" = TRUE
      AND account."tombstonedAt" IS NULL
      AND LOWER(account."email") = LOWER(orders."customerSnapshot" ->> 'email')
  );
