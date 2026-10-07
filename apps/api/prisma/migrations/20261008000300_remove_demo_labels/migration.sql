UPDATE "Tenant" SET "name" = 'Denes Commerce' WHERE "name" ILIKE '%demo%';

UPDATE "Brand"
SET "name" = replace("name", 'Demo ', ''),
    "slug" = regexp_replace("slug", '^demo-', '')
WHERE "name" ILIKE '%demo%' OR "slug" ILIKE '%demo%';

UPDATE "Product"
SET "name" = regexp_replace("name", '^Demo ', ''),
    "sku" = regexp_replace("sku", '^DEMO-', ''),
    "slug" = regexp_replace("slug", '^demo-', ''),
    "description" = CASE WHEN "isAlcohol" THEN 'Age-restricted beverage supplied for the Denes catalogue.' ELSE 'Quality grocery product supplied for the Denes catalogue.' END
WHERE "name" ILIKE '%demo%' OR "sku" ILIKE '%demo%' OR "slug" ILIKE '%demo%' OR "description" ILIKE '%demonstration%';

UPDATE "ProductImage" pi
SET "altText" = regexp_replace(pi."altText", '^Demo ', '')
WHERE pi."altText" ILIKE '%demo%';

UPDATE "Warehouse"
SET "code" = CASE WHEN "code" = 'DEMO-LON' THEN 'LON-01' ELSE replace("code", 'DEMO-', '') END,
    "name" = replace("name", 'Demo ', ''),
    "address" = replace("address"::text, 'Demo Way', 'Market Way')::jsonb
WHERE "code" ILIKE '%demo%' OR "name" ILIKE '%demo%' OR "address"::text ILIKE '%demo%';

UPDATE "User"
SET "firstName" = 'Customer', "lastName" = regexp_replace("lastName", '^Customer ', '')
WHERE "firstName" = 'Demo';

UPDATE "DeliveryZone" SET "name" = replace("name", 'Demo ', '') WHERE "name" ILIKE '%demo%';
UPDATE "Coupon" SET "code" = CASE "code" WHEN 'DEMO10' THEN 'WELCOME10' WHEN 'DEMO5GBP' THEN 'SAVE5GBP' WHEN 'DEMO-DELIVERY' THEN 'FREE-DELIVERY' ELSE replace("code", 'DEMO-', '') END WHERE "code" ILIKE '%demo%';
UPDATE "Influencer" SET "code" = replace("code", 'DEMO-', ''), "displayName" = replace("displayName", 'Demo ', '') WHERE "code" ILIKE '%demo%' OR "displayName" ILIKE '%demo%';

UPDATE "Order"
SET "deliveryAddress" = replace("deliveryAddress"::text, 'Demo Street', 'High Street')::jsonb,
    "customerSnapshot" = replace("customerSnapshot"::text, 'Demo Customer', 'Customer')::jsonb
WHERE "deliveryAddress"::text ILIKE '%demo%' OR "customerSnapshot"::text ILIKE '%demo%';

UPDATE "BrandingProfile"
SET "brandName" = 'Denes Commerce',
    "legalEntityName" = 'Denes Commerce Limited',
    "emailBranding" = replace("emailBranding"::text, 'Demo Merchant Limited', 'Denes Commerce Limited')::jsonb
WHERE "brandName" ILIKE '%demo%' OR "legalEntityName" ILIKE '%demo%' OR "emailBranding"::text ILIKE '%demo%';
