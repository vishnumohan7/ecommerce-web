UPDATE "DeliveryZone"
SET
  "postcodePatterns" = ARRAY[
    'E*', 'EC*', 'N*', 'NW*', 'SE*', 'SW*', 'W*', 'WC*',
    'BR*', 'CR*', 'DA*', 'EN*', 'HA*', 'IG*', 'KT*', 'RM*',
    'SM*', 'TW*', 'UB*', 'WD*'
  ],
  "deliveryFeeMinor" = 399,
  "groceryFeeMinor" = 399,
  "alcoholFeeMinor" = 399,
  "active" = TRUE,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'LONDON';

UPDATE "DeliveryZone"
SET "active" = FALSE, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('EDINBURGH', 'BELFAST');

UPDATE "TenantSettings"
SET
  "settings" = COALESCE("settings"::jsonb, '{}'::jsonb) ||
    jsonb_build_object(
      'delivery',
      COALESCE("settings"::jsonb -> 'delivery', '{}'::jsonb) ||
        jsonb_build_object('saturdaySurchargeMinor', 150)
    ),
  "version" = "version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP;
