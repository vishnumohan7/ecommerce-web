# API Manual Testing Guide

Generated from the NestJS controllers and `docs/openapi-v1.json` on 2026-10-07.

## Environments and Postman setup

- Local base URL: `http://localhost:3000`
- Current Vercel deployment: `https://api-theta-jade-1ftquke8hz.vercel.app`
- Swagger UI: `{{baseUrl}}/api/docs`
- OpenAPI JSON: `{{baseUrl}}/api/docs-json`

Create these Postman environment variables. All IDs and credentials below are placeholders, never production secrets.

| Variable | Example |
|---|---|
| `baseUrl` | `http://localhost:3000` |
| `accessToken` | `<CUSTOMER_OR_ADMIN_ACCESS_TOKEN>` |
| `productId`, `categoryId`, `brandId`, `variantId`, `inventoryId` | `<UUID_FROM_A_CREATE_OR_LIST_RESPONSE>` |
| `cartItemId`, `slotId`, `checkoutSessionId`, `paymentId`, `orderId` | `<UUID_FROM_PRIOR_RESPONSE>` |
| `returnId`, `refundId`, `customerId`, `roleId`, `privacyRequestId` | `<UUID_FROM_PRIOR_RESPONSE>` |

For protected routes send `Authorization: Bearer {{accessToken}}`. Send `Content-Type: application/json` except for image/catalog imports. The API selects the configured default tenant; if multi-tenant mode is enabled, also send `x-tenant-id: <TENANT_UUID>`. Keep Postman's cookie jar enabled: guest cart, age-gate, checkout, delivery, and payment requests depend on the same signed guest cookie.

### Authentication notation

- `Public`: no bearer token. Some public shopping endpoints still use the guest cookie.
- `Bearer — permission`: token required with the named RBAC permission.
- `Provider signature`: webhook signature header required, not a bearer token.

Typical status expectations: `200` for reads, updates, deletes, and action results; `201` for most successful `POST` create/action routes; `400` invalid JSON/query/state; `401` missing/invalid token; `403` missing permission; `404` unknown or non-owned resource; `409` duplicate/state/capacity/stock conflict; `422` business-rule rejection; `429` rate limit. Exact error bodies use the common envelope shown below.

## Reusable request and response examples

Use these as representative bodies for the `Example` references in the endpoint tables. Replace angle-bracket values with IDs returned by earlier calls.

### Authentication (`A`)

```json
// A1 register
{"email":"tester@example.test","password":"<STRONG_TEST_PASSWORD>","firstName":"Manual","lastName":"Tester"}
// A2 login
{"email":"tester@example.test","password":"<TEST_PASSWORD>"}
// A3 token operation
{"refreshToken":"<REFRESH_TOKEN>"}
// A4 OTP
{"phone":"+447700900123"}
// A5 OTP verify
{"challengeId":"<CHALLENGE_UUID>","code":"<OTP_FROM_TEST_PROVIDER>"}
// A6 email/password token
{"token":"<SINGLE_USE_TOKEN>","password":"<NEW_STRONG_PASSWORD>"}
```

### Catalog, inventory, and promotions (`C`)

```json
// C1 product
{"categoryId":"<CATEGORY_UUID>","brandId":"<BRAND_UUID>","sku":"TEST-001","slug":"manual-test-product","name":"Manual Test Product","description":"A test product","priceMinor":"499","currency":"GBP","vatRateBps":2000,"taxCategory":"STANDARD_20","pricingMode":"UNIT","ageRestriction":0,"restrictionReason":"NONE","returnPolicy":"STANDARD_14_DAY","unitPriceDisplay":"£4.99 each","hfssStatus":"NOT_IN_SCOPE","dietaryTags":[],"allergens":[],"countryOfOrigin":"GB","storageType":"AMBIENT"}
// C2 variant
{"sku":"TEST-001-1","name":"Single","priceMinor":"499","currency":"GBP","attributes":{"size":"single"},"warehouseId":"<WAREHOUSE_UUID>","stockOnHand":20,"lowStockThreshold":5}
// C3 category / C4 brand
{"slug":"manual-test-category","name":"Manual Test Category","position":99,"active":true}
{"slug":"manual-test-brand","name":"Manual Test Brand"}
// C5 attribute set
{"key":"pack_details","name":"Pack details","definitions":[{"key":"size","label":"Size","type":"TEXT","required":true}]}
// C6 stock operation
{"quantity":2,"reference":"POSTMAN-MANUAL-TEST"}
// C7 adjustment
{"quantity":5,"reason":"CORRECTION","reference":"POSTMAN-MANUAL-TEST"}
// C8 promotion
{"name":"Manual Test 10%","type":"PERCENTAGE","startsAt":"2026-10-01T00:00:00.000Z","endsAt":"2026-12-31T23:59:59.000Z","productIds":["<PRODUCT_UUID>"],"conditions":{},"effect":{"percentageBps":1000}}
```

Image upload is `multipart/form-data` with `file=<PNG/JPEG/WEBP under 10 MB>` and `altText=Manual test image`. Catalog import is `multipart/form-data` with `file=<CSV/XLSX under 25 MB>`.

### Cart, pricing, delivery, age and checkout (`S`)

```json
// S1 add/update cart
{"productId":"<PRODUCT_UUID>","quantity":2}
{"quantity":3}
// S2 substitution / coupon
{"preference":"SIMILAR"}
{"code":"TEST10"}
// S3 price quote / redeem
{"postcode":"SW1A 1AA","couponCode":"TEST10"}
{"code":"TEST10","discountMinor":"100","orderId":"<ORDER_UUID>","orderRevenueMinor":"1500","orderTaxMinor":"250","deliveryFeeMinor":"299"}
// S4 reserve slot / age DOB / provider session
{"postcode":"SW1A 1AA"}
{"dateOfBirth":"1990-01-01"}
{"provider":"STUB","returnUrl":"https://example.test/age-result","postcode":"SW1A 1AA","testDateOfBirth":"1990-01-01"}
// S5 checkout validate
{"deliveryPostcode":"SW1A 1AA","deliverySlotId":"<SLOT_UUID>","couponCode":"TEST10"}
// S6 checkout session
{"deliveryAddress":{"line1":"10 Test Street","city":"London","postcode":"SW1A 1AA","country":"GB"},"deliverySlotId":"<SLOT_UUID>","couponCode":"TEST10","guest":{"firstName":"Manual","lastName":"Tester","email":"tester@example.test","phone":"+447700900123"}}
// S7 payment
{"checkoutSessionId":"<CHECKOUT_SESSION_UUID>"}
```

### Customer, orders, returns and notifications (`O`)

```json
// O1 profile / address
{"firstName":"Manual","lastName":"Tester","phone":"+447700900123"}
{"label":"Home","line1":"10 Test Street","city":"London","postcode":"SW1A 1AA","country":"GB","isDefault":true}
// O2 review / moderation
{"productId":"<PRODUCT_UUID>","rating":5,"title":"Manual test","body":"Product was as expected.","imageUrls":[]}
{"status":"APPROVED","reason":"Verified purchase and acceptable content"}
// O3 fulfilment / pick / delivery age check
{"status":"PICKING"}
{"outcome":"PICKED","picked":1,"actualWeightGrams":500}
{"orderId":"<ORDER_UUID>","outcome":"PASSED","challengeAge":25,"idType":"PASSPORT","recipientPresent":true,"note":"No ID number retained"}
// O4 return / review / refund
{"orderId":"<ORDER_UUID>","reason":"DAMAGED","customerNote":"Damaged on arrival","items":[{"orderItemId":"<ORDER_ITEM_UUID>","quantity":1}]}
{"status":"APPROVED","adminNote":"Evidence checked","disposition":"WRITE_OFF"}
{"orderId":"<ORDER_UUID>","returnRequestId":"<RETURN_UUID>","idempotencyKey":"postman-refund-0001","reason":"Approved damaged item","method":"CARD","items":[{"orderItemId":"<ORDER_ITEM_UUID>","quantity":1}]}
// O5 notification preference / device / template
{"marketingEmail":false,"marketingSms":false,"marketingPush":true,"consentVersion":"2026-10"}
{"endpoint":"https://push.example.test/subscription","keys":{"p256dh":"<PUBLIC_KEY>","auth":"<AUTH_VALUE>"}}
{"event":"ORDER_CONFIRMED","channel":"EMAIL","locale":"en-GB","subject":"Order {{orderNumber}} confirmed","body":"Hello {{firstName}}"}
```

### Admin, privacy and licensing (`M`)

```json
// M1 customer / RBAC
{"active":true,"phone":"+447700900123"}
{"permissionKeys":["catalog.read","orders.read"]}
{"roleKeys":["customer-support"]}
// M2 settings
{"settings":{"minimumOrderMinor":2000,"supportEmail":"support@example.test"}}
// M3 consent / privacy review
{"version":"2026-10","source":"WEB","consents":[{"category":"ANALYTICS","granted":false},{"category":"MARKETING","granted":false}]}
{"status":"IN_REVIEW","adminNote":"Identity check started"}
// M4 licence validation
{"license":"<SIGNED_LICENCE_STRING>"}
```

### Representative responses

```json
// R1 object/create/update
{"id":"<UUID>","createdAt":"2026-10-07T10:00:00.000Z","updatedAt":"2026-10-07T10:00:00.000Z"}
// R2 collection
{"items":[{"id":"<UUID>","name":"Example"}],"nextCursor":null}
// R3 auth
{"accessToken":"<ACCESS_TOKEN>","refreshToken":"<REFRESH_TOKEN>","expiresIn":900}
// R4 action
{"success":true}
// R5 error
{"error":{"code":"VALIDATION_ERROR","message":"Request failed","requestId":"<REQUEST_UUID>"},"path":"/api/v1/example","timestamp":"2026-10-07T10:00:00.000Z"}
```

Response objects contain domain-specific fields in addition to these representative shapes. Treat the running Swagger document and actual JSON keys as authoritative.

## Complete endpoint checklist

Every row below is implemented. Tick the final column during the manual test run. `:id`/`{id}` values are UUIDs unless the note says otherwise.

### System, documentation and licensing (7)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /health` | Public | Liveness; no input | `200 {"status":"ok"}` |
| [ ] | `GET /ready` | Public | Checks PostgreSQL, Redis and object storage | `200` ready or `503` with failed dependency |
| [ ] | `GET /metrics` | Public | Prometheus text metrics; excluded from OpenAPI | `200 text/plain` |
| [ ] | `GET /api/docs` | Public | Swagger UI; excluded from OpenAPI | `200 text/html` |
| [ ] | `GET /api/docs-json` | Public | Current OpenAPI JSON; excluded from OpenAPI paths | `200 application/json` |
| [ ] | `GET /api/v1/admin/license` | Bearer — `settings.read` | Current licence and feature state | `200 R1` |
| [ ] | `POST /api/v1/admin/license/validate` | Bearer — `settings.write` | Validate/apply licence; `M4` | `201/200 R1`; invalid signature `400` |

### Authentication (10)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `POST /api/v1/auth/register` | Public, rate-limited | Create customer; `A1` | `201 R1`; duplicate `409` |
| [ ] | `POST /api/v1/auth/verify-email` | Public | Body `{"token":"<EMAIL_TOKEN>"}` | `201/200 R4` |
| [ ] | `POST /api/v1/auth/login` | Public, rate-limited | `A2` | `201/200 R3`; bad credentials `401` |
| [ ] | `POST /api/v1/auth/refresh` | Public | Rotate token family; `A3` | `201/200 R3` |
| [ ] | `POST /api/v1/auth/logout` | Public | Revoke token family; `A3` | `201/200 R4` |
| [ ] | `POST /api/v1/auth/otp/request` | Public, rate-limited | `A4` | `201`; may require configured SMS provider |
| [ ] | `POST /api/v1/auth/otp/verify` | Public, rate-limited | `A5` | `201/200 R3`; wrong/expired `400` |
| [ ] | `POST /api/v1/auth/password/forgot` | Public, rate-limited | `{"email":"tester@example.test"}` | `201 {"accepted":true}` even if undisclosed account |
| [ ] | `POST /api/v1/auth/password/reset` | Public | `A6` with both fields | `201/200 R4` |
| [ ] | `GET /api/v1/auth/me` | Bearer — `catalog.read` | Current tenant/user/permissions | `200 R1` |

### Catalog, taxonomy, images and imports (27)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/products` | Public | Query `categoryId`, `alcohol=true`, `cursor`; alcohol also requires valid age-gate cookie/token | `200 R2` |
| [ ] | `POST /api/v1/products` | Bearer — `catalog.write` | Create; `C1` | `201 R1` |
| [ ] | `GET /api/v1/products/{id}` | Public | Product ID | `200 R1`; missing `404` |
| [ ] | `PATCH /api/v1/products/{id}` | Bearer — `catalog.write` | Full validated product body `C1` | `200 R1` |
| [ ] | `DELETE /api/v1/products/{id}` | Bearer — `catalog.write` | Archive, not hard-delete | `200 R1` |
| [ ] | `POST /api/v1/products/{id}/variants` | Bearer — `catalog.write` | Product ID; `C2` | `201 R1` |
| [ ] | `POST /api/v1/products/{id}/images` | Bearer — `catalog.write` | Product ID; multipart image + alt text | `201 R1`; bad file `400` |
| [ ] | `GET /api/v1/categories` | Public | Query `cursor`, `limit` | `200 R2` |
| [ ] | `POST /api/v1/categories` | Bearer — `catalog.write` | `C3` | `201 R1` |
| [ ] | `GET /api/v1/categories/{id}` | Public | Category ID | `200 R1` |
| [ ] | `PATCH /api/v1/categories/{id}` | Bearer — `catalog.write` | Any changed fields from `C3` | `200 R1` |
| [ ] | `DELETE /api/v1/categories/{id}` | Bearer — `catalog.write` | Archive category | `200 R1` |
| [ ] | `GET /api/v1/brands` | Public | Query `cursor`, `limit` | `200 R2` |
| [ ] | `POST /api/v1/brands` | Bearer — `catalog.write` | `C4` | `201 R1` |
| [ ] | `GET /api/v1/brands/{id}` | Public | Brand ID | `200 R1` |
| [ ] | `PATCH /api/v1/brands/{id}` | Bearer — `catalog.write` | Any changed fields from `C4` | `200 R1` |
| [ ] | `DELETE /api/v1/brands/{id}` | Bearer — `catalog.write` | Remove/archive brand | `200 R1` |
| [ ] | `GET /api/v1/attribute-sets` | Bearer — `catalog.read` | Query `cursor`, `limit` | `200 R2` |
| [ ] | `POST /api/v1/attribute-sets` | Bearer — `catalog.write` | `C5` | `201 R1` |
| [ ] | `GET /api/v1/attribute-sets/{id}` | Bearer — `catalog.read` | Attribute-set ID | `200 R1` |
| [ ] | `PATCH /api/v1/attribute-sets/{id}` | Bearer — `catalog.write` | Any changed fields from `C5` | `200 R1` |
| [ ] | `DELETE /api/v1/attribute-sets/{id}` | Bearer — `catalog.write` | Delete attribute set | `200 R1` |
| [ ] | `POST /api/v1/catalog/imports` | Bearer — `catalog.write` | Multipart file; query `duplicatePolicy=skip|update|fail`, `dryRun=true|false` | `201`; validation summary |
| [ ] | `GET /api/v1/catalog/imports/{id}/errors.csv` | Bearer — `catalog.write` | Import ID | `200 text/csv` |
| [ ] | `GET /api/v1/promotions` | Bearer — `catalog.read` | List promotions | `200 R2` |
| [ ] | `POST /api/v1/promotions` | Bearer — `catalog.write` | `C8`; HFSS rules apply | `201 R1`; forbidden multibuy `422` |
| [ ] | `PATCH /api/v1/promotions/{id}` | Bearer — `catalog.write` | `{"active":true,"priority":10}` or dates | `200 R1` |

### Search (6)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/search` | Public | Query `q`, filters, sort, cursor, limit; age gate controls alcohol | `200` items/facets |
| [ ] | `GET /api/v1/search/autocomplete` | Public | Query `q=milk&limit=8` | `200 R2` |
| [ ] | `GET /api/v1/search/synonyms` | Bearer — `catalog.write` | List synonym rules | `200 R2` |
| [ ] | `POST /api/v1/search/synonyms` | Bearer — `catalog.write` | `{"term":"soda","synonyms":["pop","fizzy drink"]}` | `201 R1` |
| [ ] | `PATCH /api/v1/search/synonyms/{id}` | Bearer — `catalog.write` | `{"synonyms":["soft drink"]}` | `200 R1` |
| [ ] | `DELETE /api/v1/search/synonyms/{id}` | Bearer — `catalog.write` | Synonym ID | `200 R1` |

### Inventory (4)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/inventory` | Bearer — `inventory.read` | Inventory with product details | `200 R2` |
| [ ] | `POST /api/v1/inventory/{id}/reservations` | Bearer — `inventory.write` | Inventory ID; `C6` | `201/200 R1`; insufficient stock `409` |
| [ ] | `POST /api/v1/inventory/{id}/releases` | Bearer — `inventory.write` | Inventory ID; `C6` | `201/200 R1` |
| [ ] | `POST /api/v1/inventory/{id}/adjustments` | Bearer — `inventory.write` | Inventory ID; `C7` | `201/200 R1` |

### Cart (8)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/cart` | Public + guest cookie | Read/revalidate cart | `200` cart/totals |
| [ ] | `POST /api/v1/cart/items` | Public + guest cookie | First body in `S1` | `201` cart |
| [ ] | `PATCH /api/v1/cart/items/{id}` | Public + same cookie | Cart-item ID; second body in `S1` | `200` cart |
| [ ] | `DELETE /api/v1/cart/items/{id}` | Public + same cookie | Cart-item ID | `200` cart |
| [ ] | `POST /api/v1/cart/items/{id}/substitution-preference` | Public + same cookie | Cart-item ID; first body in `S2` | `201/200` item |
| [ ] | `POST /api/v1/cart/coupon` | Public + same cookie | Second body in `S2` | `201/200` cart |
| [ ] | `DELETE /api/v1/cart/coupon` | Public + same cookie | Remove coupon | `200` cart |
| [ ] | `POST /api/v1/cart/merge` | Bearer — `catalog.read` + guest cookie | Merge guest cart into signed-in user's cart | `201/200` cart |

### Pricing, coupons, influencers and tax (11)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `POST /api/v1/pricing/quote` | Public + cart cookie | First body in `S3` | `201/200` VAT-inclusive quote |
| [ ] | `POST /api/v1/coupons/validate` | Public + cart cookie | `{"code":"TEST10"}` | `201/200` eligibility result |
| [ ] | `POST /api/v1/coupons/redeem` | Public + cart cookie | Second body in `S3` | `201/200`; repeat/conflict test |
| [ ] | `GET /api/v1/admin/coupons` | Bearer — `catalog.read` | List coupons | `200 R2` |
| [ ] | `POST /api/v1/admin/coupons` | Bearer — `catalog.write` | `{"code":"TEST10","type":"PERCENTAGE","valueBps":1000,"startsAt":"2026-10-01T00:00:00Z","endsAt":"2026-12-31T23:59:59Z"}` | `201 R1` |
| [ ] | `PATCH /api/v1/admin/coupons/{id}` | Bearer — `catalog.write` | `{"active":false}` | `200 R1` |
| [ ] | `GET /api/v1/admin/influencers` | Bearer — `catalog.read` | List influencers | `200 R2` |
| [ ] | `POST /api/v1/admin/influencers` | Bearer — `catalog.write` | `{"code":"CREATOR10","displayName":"Test Creator","commissionBps":500,"active":true}` | `201 R1` |
| [ ] | `GET /api/v1/admin/influencers/{id}/report` | Bearer — `catalog.read` | Influencer ID | `200` attribution/revenue report |
| [ ] | `GET /api/v1/admin/tax-rules` | Bearer — `catalog.read` | List tax rules | `200 R2` |
| [ ] | `POST /api/v1/admin/tax-rules` | Bearer — `catalog.write` | `{"taxCategory":"STANDARD_20","rateBps":2000,"effectiveFrom":"2026-10-01T00:00:00Z","active":true}` | `201 R1` |

### Delivery (9)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/delivery/zones/resolve` | Public + cart cookie | Query `postcode=SW1A%201AA` | `200` zone/fee or unavailable result |
| [ ] | `GET /api/v1/delivery/slots` | Public + cart cookie | Query `postcode=SW1A%201AA` | `200 R2` |
| [ ] | `POST /api/v1/delivery/slots/{id}/reserve` | Public + same cookie | Slot ID; first body in `S4` | `201`; full/cutoff `409/422` |
| [ ] | `GET /api/v1/admin/delivery/zones` | Bearer — `delivery.read` | List zones | `200 R2` |
| [ ] | `POST /api/v1/admin/delivery/zones` | Bearer — `delivery.write` | `{"code":"LONDON_1","name":"Central London","postcodePatterns":["SW1*"],"postcodeIncludes":[],"postcodeExcludes":[],"groceryFeeMinor":299,"alcoholFeeMinor":399,"supportedStorageTypes":["AMBIENT","CHILLED"],"currency":"GBP","alcoholDeliveryAllowed":true,"active":true}` | `201 R1` |
| [ ] | `PATCH /api/v1/admin/delivery/zones/{id}` | Bearer — `delivery.write` | `{"active":true,"groceryFeeMinor":349}` | `200 R1` |
| [ ] | `GET /api/v1/admin/delivery/slots` | Bearer — `delivery.read` | List slots | `200 R2` |
| [ ] | `POST /api/v1/admin/delivery/slots` | Bearer — `delivery.write` | `{"zoneId":"<ZONE_UUID>","startsAt":"2026-10-10T10:00:00Z","endsAt":"2026-10-10T12:00:00Z","capacity":20,"surchargeMinor":0,"cutoffMinutes":120,"allowsAgeRestricted":true,"active":true}` | `201 R1` |
| [ ] | `PATCH /api/v1/admin/delivery/slots/{id}` | Bearer — `delivery.write` | `{"capacity":25,"active":true}` | `200 R1`; below reserved capacity rejected |

### Age gate and purchase verification (7)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `POST /api/v1/age-gate/confirm` | Public | No body; sets signed cookies | `201 {"confirmed":true,...}` |
| [ ] | `POST /api/v1/age-gate/decline` | Public | No body; clears cookie | `201 {"confirmed":false,"redirectTo":"/"}` |
| [ ] | `GET /api/v1/age-verification` | Public + guest cookie | Reusable verification status | `200 R1` |
| [ ] | `POST /api/v1/age-verification/dob` | Public + same cookie | Second body in `S4` | `201/200` status; underage rejected |
| [ ] | `POST /api/v1/age-verification/provider-session` | Public + same cookie | Third body in `S4` | `201` session/redirect |
| [ ] | `GET /api/v1/age-verification/provider-session/{provider}/{sessionId}` | Public + same cookie | Provider `STUB|YOTI|MANUAL_REVIEW`; provider session ID | `200` status |
| [ ] | `POST /api/v1/age-verification/provider-webhook/{provider}` | Provider signature | Raw provider payload; Yoti uses `x-yoti-signature` | `201/200`; bad signature `401/400` |

### Checkout and payments (9)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `POST /api/v1/checkout/validate` | Public + cart cookie | `S5` | `201/200` authoritative summary; no side effects |
| [ ] | `POST /api/v1/checkout/session` | Public + cart cookie | `S6` | `201` snapshot/reservations |
| [ ] | `GET /api/v1/checkout/session/{id}` | Public + same cookie | Checkout session ID | `200` revalidated session |
| [ ] | `DELETE /api/v1/checkout/session/{id}` | Public + same cookie | Cancel/release stock | `200 R4` |
| [ ] | `POST /api/v1/checkout/payment-intent` | Public + same cookie | `S7` | `201` payment/client-secret metadata |
| [ ] | `POST /api/v1/payments/intent` | Public + same cookie | Alias; `S7` | `201`; idempotent with primary route |
| [ ] | `GET /api/v1/payments/{id}` | Public + same cookie | Owned payment ID | `200 R1`; other owner `404` |
| [ ] | `POST /api/v1/webhooks/stripe` | Stripe signature | Raw body plus `stripe-signature`; use Stripe CLI, not fabricated signature | `201/200`; duplicate remains idempotent |
| [ ] | `POST /api/v1/admin/payments/{orderId}/capture` | Bearer — `orders.write` | Order ID; `{"recomputedAmountMinor":"1499"}` | `201/200`; over-authorisation rejected |

### Orders, fulfilment and compliance (15)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/orders` | Bearer — `orders.read` | Customer order list | `200 R2` |
| [ ] | `GET /api/v1/orders/{id}` | Bearer — `orders.read` | Owned order ID | `200 R1` |
| [ ] | `GET /api/v1/orders/{id}/tracking` | Bearer — `orders.read` | Owned order ID | `200` fulfilment timeline |
| [ ] | `GET /api/v1/orders/{id}/invoice` | Bearer — `orders.read` | Owned order ID | `200 application/pdf` |
| [ ] | `POST /api/v1/orders/{id}/reorder` | Bearer — `orders.read` | Owned order ID | `201/200` cart + unavailable items |
| [ ] | `GET /api/v1/admin/orders` | Bearer — `orders.read` | Optional query `basketType`, `paymentStatus`, `fulfilmentStatus`, `ageVerificationStatus`, `deliveryAgeCheckStatus`, `search` | `200 R2` |
| [ ] | `GET /api/v1/admin/orders/{id}` | Bearer — `orders.read` | Any tenant order ID | `200 R1` |
| [ ] | `GET /api/v1/admin/orders/{id}/invoice` | Bearer — `orders.read` | Order ID | `200 application/pdf` |
| [ ] | `PATCH /api/v1/admin/orders/{id}/fulfilment-groups/{groupId}` | Bearer — `orders.write` | Order/group IDs; first body in `O3` | `200`; illegal transition `409` |
| [ ] | `POST /api/v1/admin/orders/{id}/pick-list` | Bearer — `orders.write` | Order ID | `201` pick list |
| [ ] | `GET /api/v1/admin/orders/{id}/pick-list` | Bearer — `orders.read` | Order ID | `200` pick list |
| [ ] | `PATCH /api/v1/admin/orders/{id}/pick-list/items/{itemId}` | Bearer — `orders.write` | IDs; second body in `O3` | `200` item/totals |
| [ ] | `POST /api/v1/admin/orders/{id}/pick-list/complete` | Bearer — `orders.write` | Order ID | `201/200` recomputed totals |
| [ ] | `GET /api/v1/admin/compliance/alcohol-day-book` | Bearer — `orders.read` | Query `date=2026-10-07`, optional `format=csv|pdf` | `200` JSON/CSV/PDF |
| [ ] | `POST /api/v1/delivery-age-check` | Bearer — `delivery.write` | Third body in `O3`; deliberately no ID number | `201 R1` |

### Returns and refunds (9)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `POST /api/v1/returns` | Bearer — `orders.read` | First body in `O4` | `201 R1` |
| [ ] | `GET /api/v1/returns` | Bearer — `orders.read` | Customer's returns | `200 R2` |
| [ ] | `POST /api/v1/orders/{orderId}/returns` | Bearer — `orders.read` | Order ID; `O4` without `orderId` | `201 R1` |
| [ ] | `GET /api/v1/returns/{id}` | Bearer — `orders.read` | Owned return ID | `200 R1` |
| [ ] | `GET /api/v1/admin/returns` | Bearer — `orders.read` | Query `status`, `orderId` | `200 R2` |
| [ ] | `PATCH /api/v1/admin/returns/{id}` | Bearer — `orders.write` | Second body in `O4` | `200 R1` |
| [ ] | `POST /api/v1/admin/refunds` | Bearer — `orders.write` | Third body in `O4` | `201 R1`; same idempotency key must not duplicate |
| [ ] | `POST /api/v1/admin/orders/{orderId}/refunds` | Bearer — `orders.write` | Order ID; refund body without `orderId` | `201 R1` |
| [ ] | `GET /api/v1/admin/refunds/{id}` | Bearer — `orders.read` | Refund ID | `200 R1` |

### Customer profile, addresses, wishlist, reviews and content (18)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/profile` | Bearer — `catalog.read` | Customer profile | `200 R1` |
| [ ] | `PATCH /api/v1/profile` | Bearer — `catalog.read` | First body in `O1` | `200 R1` |
| [ ] | `GET /api/v1/addresses` | Bearer — `catalog.read` | Address book | `200 R2` |
| [ ] | `POST /api/v1/addresses` | Bearer — `catalog.read` | Second body in `O1` | `201 R1` |
| [ ] | `PATCH /api/v1/addresses/{id}` | Bearer — `catalog.read` | Any address fields | `200 R1` |
| [ ] | `DELETE /api/v1/addresses/{id}` | Bearer — `catalog.read` | Address ID | `200 R1` |
| [ ] | `GET /api/v1/wishlist` | Bearer — `catalog.read` | Wishlist | `200 R2` |
| [ ] | `POST /api/v1/wishlist/items` | Bearer — `catalog.read` | `{"productId":"<PRODUCT_UUID>"}` | `201 R1` |
| [ ] | `DELETE /api/v1/wishlist/items/{productId}` | Bearer — `catalog.read` | Product ID | `200 R1` |
| [ ] | `POST /api/v1/wishlist/items/{productId}/move-to-cart` | Bearer — `catalog.read` | Product ID; `{"quantity":1}` | `201/200` cart |
| [ ] | `GET /api/v1/reviews` | Public | Query required `productId=<UUID>` | `200 R2` approved only |
| [ ] | `POST /api/v1/reviews` | Bearer — `catalog.read` | First body in `O2`; verified purchase required | `201 R1` |
| [ ] | `GET /api/v1/reviews/mine` | Bearer — `catalog.read` | Current customer's reviews | `200 R2` |
| [ ] | `PATCH /api/v1/reviews/{id}` | Bearer — `catalog.read` | Any rating/title/body/image fields | `200 R1` |
| [ ] | `DELETE /api/v1/reviews/{id}` | Bearer — `catalog.read` | Owned review ID | `200 R1` |
| [ ] | `PATCH /api/v1/admin/reviews/{id}/moderation` | Bearer — `catalog.write` | Second body in `O2` | `200 R1` |
| [ ] | `GET /api/v1/content/home` | Public | Published home banners/content | `200` content object |
| [ ] | `GET /api/v1/content/legal/{type}` | Public | Type such as `privacy`; optional `locale=en-GB` | `200` published legal document |

### Notifications (16)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/notification-preferences` | Bearer — `orders.read` | Customer preferences | `200 R1` |
| [ ] | `PATCH /api/v1/notification-preferences` | Bearer — `orders.read` | First body in `O5` | `200 R1` |
| [ ] | `GET /api/v1/notification-devices` | Bearer — `orders.read` | Push subscriptions | `200 R2` |
| [ ] | `POST /api/v1/notification-devices` | Bearer — `orders.read` | Second body in `O5` | `201 R1` |
| [ ] | `POST /api/v1/devices` | Bearer — `orders.read` | Alias; second body in `O5` | `201 R1` |
| [ ] | `DELETE /api/v1/notification-devices/{id}` | Bearer — `orders.read` | Device ID | `200 R1` |
| [ ] | `DELETE /api/v1/devices/{id}` | Bearer — `orders.read` | Alias; device ID | `200 R1` |
| [ ] | `GET /api/v1/notifications` | Bearer — `orders.read` | Customer notification history | `200 R2` |
| [ ] | `GET /api/v1/admin/notification-templates` | Bearer — `settings.read` | Template list | `200 R2` |
| [ ] | `POST /api/v1/admin/notification-templates` | Bearer — `settings.write` | Third body in `O5` | `201 R1` |
| [ ] | `PATCH /api/v1/admin/notification-templates/{id}` | Bearer — `settings.write` | Full template body | `200 R1` |
| [ ] | `POST /api/v1/admin/notification-templates/preview` | Bearer — `settings.read` | `{"subject":"Hello {{name}}","body":"Welcome {{name}}","data":{"name":"Tester"}}` | `201/200` rendered preview |
| [ ] | `POST /api/v1/admin/notification-templates/{id}/test-send` | Bearer — `settings.write` | `{"recipient":"tester@example.test","data":{"firstName":"Manual"}}` | `201`; provider-dependent |
| [ ] | `POST /api/v1/admin/notification-templates/{id}/test` | Bearer — `settings.write` | Alias; same test-send body | `201` |
| [ ] | `GET /api/v1/admin/notification-deliveries` | Bearer — `settings.read` | Optional query `status` | `200 R2` |
| [ ] | `POST /api/v1/admin/notifications/process` | Bearer — `settings.write` | No body; process queued notifications | `201/200` counts |

### Admin operations and reporting (18)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/admin/dashboard` | Bearer — `reports.read` | Optional ISO query `from`, `to` | `200` KPIs |
| [ ] | `GET /api/v1/admin/reports/sales` | Bearer — `reports.read` | Optional `from`, `to` | `200` sales series |
| [ ] | `GET /api/v1/admin/reports/customers` | Bearer — `reports.read` | Optional `from`, `to` | `200` customer metrics |
| [ ] | `GET /api/v1/admin/reports/products` | Bearer — `reports.read` | Optional `from`, `to` | `200` product metrics |
| [ ] | `GET /api/v1/admin/reports/coupons` | Bearer — `reports.read` | Optional `from`, `to` | `200` coupon metrics |
| [ ] | `GET /api/v1/admin/customers` | Bearer — `users.read` | Optional query `q` | `200 R2` |
| [ ] | `GET /api/v1/admin/customers/{id}` | Bearer — `users.read` | Customer ID | `200 R1` |
| [ ] | `PATCH /api/v1/admin/customers/{id}` | Bearer — `users.write` | First body in `M1` | `200 R1` |
| [ ] | `GET /api/v1/admin/inventory` | Bearer — `inventory.read` | Admin inventory projection | `200 R2` |
| [ ] | `GET /api/v1/admin/reviews` | Bearer — `catalog.read` | Optional query `status` | `200 R2` |
| [ ] | `GET /api/v1/admin/promotions` | Bearer — `catalog.read` | Admin promotion projection | `200 R2` |
| [ ] | `GET /api/v1/admin/content` | Bearer — `settings.read` | CMS/legal content projection | `200 R2` |
| [ ] | `GET /api/v1/admin/rbac` | Bearer — `users.read` | Roles, permissions and assignments | `200` RBAC object |
| [ ] | `PATCH /api/v1/admin/rbac/roles/{id}` | Bearer — `users.write` | Role ID; second body in `M1` | `200 R1` |
| [ ] | `PATCH /api/v1/admin/rbac/users/{id}` | Bearer — `users.write` | User ID; third body in `M1` | `200 R1` |
| [ ] | `GET /api/v1/admin/settings` | Bearer — `settings.read` | Tenant settings/branding | `200 R1` |
| [ ] | `PATCH /api/v1/admin/settings` | Bearer — `settings.write` | `M2` or complete branding object | `200 R1` |
| [ ] | `GET /api/v1/admin/audit-log` | Bearer — `audit.read` | Optional query `entity`, `action`, `actorId` | `200 R2` |

### Privacy and GDPR (8)

| Done | Method and path | Auth / permission | Purpose, inputs, example | Expect |
|---|---|---|---|---|
| [ ] | `GET /api/v1/privacy/consents` | Bearer — `orders.read` | Current consent state/history | `200 R2` |
| [ ] | `PATCH /api/v1/privacy/consents` | Bearer — `orders.read` | First body in `M3` | `200 R1`; essential cannot be disabled where enforced |
| [ ] | `GET /api/v1/privacy/requests` | Bearer — `orders.read` | Customer's privacy requests | `200 R2` |
| [ ] | `POST /api/v1/privacy/export-requests` | Bearer — `orders.read` | No body | `201 R1` |
| [ ] | `GET /api/v1/privacy/export-requests/{id}` | Bearer — `orders.read` | Export request ID; query `format=json|pdf` | `200` attachment or pending/not-ready response |
| [ ] | `POST /api/v1/privacy/deletion-requests` | Bearer — `orders.read` | No body | `201 R1` |
| [ ] | `GET /api/v1/admin/privacy/requests` | Bearer — `users.read` | Optional query `status` | `200 R2` |
| [ ] | `PATCH /api/v1/admin/privacy/requests/{id}` | Bearer — `users.write` | Privacy request ID; second body in `M3` | `200 R1` |

## Recommended manual run order

1. Check `/health`, `/ready`, Swagger, then register/login or obtain a dedicated test-user token.
2. With an admin token, create category, brand, product, variant and stock; save every returned ID.
3. In one Postman cookie jar, exercise age gate, search, cart, quote, delivery slot, checkout and payment flow.
4. Exercise customer profile, address, wishlist, review and notification preferences with a customer token.
5. Exercise order/picking/return/refund/admin/report/privacy flows with appropriately scoped admin tokens.
6. Run negative checks for validation, missing authentication, missing permission, cross-user ownership, stock/capacity conflicts and repeat idempotency keys.

## Known environment-dependent checks

- `/ready` requires reachable PostgreSQL, Redis and object storage; one missing dependency correctly produces `503`.
- Registration/login/OTP rate limiting requires reachable Redis. OTP, email, push, SMS and WhatsApp delivery need their configured providers.
- Product image upload needs writable/configured object storage; serverless local disk is not persistent.
- Stripe payment/webhook tests require Stripe test credentials and a correctly signed raw webhook payload.
- Yoti webhook/session tests require Yoti test credentials; `STUB` is the appropriate local manual-test provider when enabled.
- PDF/CSV routes should be checked using Postman's **Send and Download**, not JSON preview.

## Coverage statement

This guide lists all **179 operations** present in `docs/openapi-v1.json`, plus the three intentionally OpenAPI-excluded/reachable endpoints (`/metrics`, `/api/docs`, `/api/docs-json`): **182 HTTP endpoints total**. No driver application or driver API is included because driver functionality is out of scope.
