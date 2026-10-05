# API Implementation Checklist

Last audited: 2026-10-05. This checklist distinguishes **route implemented** from **milestone fully verified**. The live OpenAPI document is available while the API is running at `http://localhost:3000/api/docs` and `http://localhost:3000/api/docs-json`.

## Implemented routes

### System and observability

- [x] `GET /health` — process liveness
- [x] `GET /ready` — PostgreSQL, Redis, and object-storage readiness (route exists; Redis and object storage are not currently provisioned)
- [x] `GET /metrics` — Prometheus metrics
- [x] `GET /api/docs` — Swagger UI
- [x] `GET /api/docs-json` — OpenAPI JSON

### Authentication and account security

- [x] `POST /api/v1/auth/register` — email/password registration
- [x] `POST /api/v1/auth/verify-email` — single-use email verification token
- [x] `POST /api/v1/auth/login` — access and refresh token pair
- [x] `POST /api/v1/auth/refresh` — rotating refresh token
- [x] `POST /api/v1/auth/logout` — revoke refresh-token family
- [x] `POST /api/v1/auth/otp/request` — create OTP challenge (provider delivery/fallback still pending full integration)
- [x] `POST /api/v1/auth/otp/verify` — verify OTP with attempt lockout
- [x] `POST /api/v1/auth/password/forgot` — create password-reset request
- [x] `POST /api/v1/auth/password/reset` — consume reset token and change password
- [x] `GET /api/v1/auth/me` — authenticated request context

### Catalog and merchandising

- [x] `GET /api/v1/products` — cursor-style active product listing
- [x] `GET /api/v1/products/:id` — product detail
- [x] `POST /api/v1/products` — permission-protected product creation
- [x] `PATCH /api/v1/products/:id` — permission-protected product update
- [x] `POST /api/v1/products/:id/variants` — create variant and its inventory record
- [x] `POST /api/v1/products/:id/images` — secure image upload and responsive re-encode
- [x] `POST /api/v1/promotions` — create promotion with HFSS multibuy blocking

### Inventory

- [x] `POST /api/v1/inventory/:id/reservations` — transactional reservation
- [x] `POST /api/v1/inventory/:id/releases` — transactional reservation release
- [x] `POST /api/v1/inventory/:id/adjustments` — reason-coded stock adjustment

### Bulk catalog import

- [x] `POST /api/v1/catalog/imports?duplicatePolicy=skip|update|fail&dryRun=true|false` — CSV/XLSX import or dry run
- [x] `GET /api/v1/catalog/imports/:id/errors.csv` — row-keyed error report

## Pending routes by milestone

The exact request/response DTOs are finalized when each milestone is implemented. Paths below are the planned stable API surface; any path change will be recorded here and in OpenAPI.

### Milestone 5 — Search and filtering

- [x] `GET /api/v1/search` — ranked, typo-tolerant search, filtering, facets, cursor pagination
- [x] `GET /api/v1/search/autocomplete` — low-latency suggestions
- [x] `GET /api/v1/search/synonyms` — admin synonym list
- [x] `POST /api/v1/search/synonyms` — admin synonym creation
- [x] `PATCH /api/v1/search/synonyms/:id` — admin synonym update
- [x] `DELETE /api/v1/search/synonyms/:id` — admin synonym removal

### Milestone 6 — Combined cart

- [x] `GET /api/v1/cart` — create/read and revalidate the combined guest or customer cart
- [x] `POST /api/v1/cart/items` — add with server-derived category, price, and age snapshots
- [x] `PATCH /api/v1/cart/items/:id` — update quantity with live stock enforcement
- [x] `DELETE /api/v1/cart/items/:id` — remove an item
- [x] `POST /api/v1/cart/items/:id/substitution-preference` — update fulfilment substitution preference
- [x] `POST /api/v1/cart/coupon` — attach an active coupon for later authoritative pricing
- [x] `DELETE /api/v1/cart/coupon` — remove the attached coupon
- [x] `POST /api/v1/cart/merge` — merge a signed guest cart into the authenticated cart

### Milestone 7 — Age gate and purchase verification

- [ ] `POST /api/v1/age-gate/confirm`
- [ ] `POST /api/v1/age-gate/decline`
- [ ] `GET /api/v1/age-verification`
- [ ] `POST /api/v1/age-verification/dob`
- [ ] `POST /api/v1/age-verification/provider-session`
- [ ] `POST /api/v1/age-verification/provider-webhook`

### Milestone 8 — Delivery zones, slots, and charges

- [ ] `GET /api/v1/delivery/zones/resolve`
- [ ] `GET /api/v1/delivery/slots`
- [ ] `POST /api/v1/delivery/slots/:id/reserve`
- [ ] `GET /api/v1/admin/delivery/zones`
- [ ] `POST /api/v1/admin/delivery/zones`
- [ ] `PATCH /api/v1/admin/delivery/zones/:id`
- [ ] `GET /api/v1/admin/delivery/slots`
- [ ] `POST /api/v1/admin/delivery/slots`
- [ ] `PATCH /api/v1/admin/delivery/slots/:id`

### Milestone 9 — Pricing, VAT, coupons, and promotion evaluation

- [ ] `POST /api/v1/pricing/quote`
- [ ] `POST /api/v1/coupons/validate`
- [ ] `GET /api/v1/admin/coupons`
- [ ] `POST /api/v1/admin/coupons`
- [ ] `PATCH /api/v1/admin/coupons/:id`
- [ ] `GET /api/v1/admin/influencers`
- [ ] `POST /api/v1/admin/influencers`
- [ ] `GET /api/v1/admin/influencers/:id/report`

### Milestone 10 — Checkout orchestration

- [ ] `POST /api/v1/checkout/validate`
- [ ] `POST /api/v1/checkout/session`
- [ ] `GET /api/v1/checkout/session/:id`
- [ ] `DELETE /api/v1/checkout/session/:id`

### Milestone 11 — Payments and Stripe webhooks

- [ ] `POST /api/v1/payments/intent`
- [ ] `GET /api/v1/payments/:id`
- [ ] `POST /api/v1/webhooks/stripe`

### Milestone 12 — Orders, fulfilment, invoices, and tracking

- [ ] `GET /api/v1/orders`
- [ ] `GET /api/v1/orders/:id`
- [ ] `GET /api/v1/orders/:id/tracking`
- [ ] `GET /api/v1/orders/:id/invoice`
- [ ] `POST /api/v1/orders/:id/reorder`
- [ ] `GET /api/v1/admin/orders`
- [ ] `GET /api/v1/admin/orders/:id`
- [ ] `PATCH /api/v1/admin/orders/:id/fulfilment-groups/:groupId`
- [ ] `POST /api/v1/delivery-age-check`

### Milestone 13 — Returns and refunds

- [ ] `POST /api/v1/orders/:id/returns`
- [ ] `GET /api/v1/returns`
- [ ] `GET /api/v1/returns/:id`
- [ ] `GET /api/v1/admin/returns`
- [ ] `PATCH /api/v1/admin/returns/:id`
- [ ] `POST /api/v1/admin/orders/:id/refunds`
- [ ] `GET /api/v1/admin/refunds/:id`

### Milestone 14 — Picking, substitutions, and variable weight

- [ ] `GET /api/v1/admin/pick-lists`
- [ ] `GET /api/v1/admin/pick-lists/:id`
- [ ] `PATCH /api/v1/admin/pick-lists/:id/items/:itemId`
- [ ] `POST /api/v1/admin/pick-lists/:id/items/:itemId/substitution`
- [ ] `POST /api/v1/admin/pick-lists/:id/items/:itemId/weight`
- [ ] `POST /api/v1/admin/pick-lists/:id/complete`

### Milestone 15 — Notifications and customer communications

- [ ] `POST /api/v1/devices`
- [ ] `DELETE /api/v1/devices/:id`
- [ ] `GET /api/v1/notification-preferences`
- [ ] `PATCH /api/v1/notification-preferences`
- [ ] `GET /api/v1/notifications`
- [ ] `GET /api/v1/admin/notification-templates`
- [ ] `PATCH /api/v1/admin/notification-templates/:id`
- [ ] `POST /api/v1/admin/notification-templates/:id/test`

### Milestone 16 — Customer storefront support APIs

- [ ] `GET /api/v1/profile`
- [ ] `PATCH /api/v1/profile`
- [ ] Address book CRUD under `/api/v1/addresses`
- [ ] Wishlist CRUD and move-to-cart under `/api/v1/wishlist`
- [ ] Reviews CRUD under `/api/v1/reviews`
- [ ] Public banners/CMS/legal content under `/api/v1/content`

### Milestone 17 — Admin dashboard and reporting APIs

- [ ] `GET /api/v1/admin/dashboard`
- [ ] `GET /api/v1/admin/reports/sales`
- [ ] `GET /api/v1/admin/reports/customers`
- [ ] `GET /api/v1/admin/reports/products`
- [ ] `GET /api/v1/admin/reports/coupons`
- [ ] Customer administration under `/api/v1/admin/customers`
- [ ] Roles and permissions administration under `/api/v1/admin/rbac`
- [ ] Settings administration under `/api/v1/admin/settings`
- [ ] Audit log queries under `/api/v1/admin/audit-log`

### Milestone 18 — Compliance, GDPR, deployment, and sign-off

- [ ] `GET /api/v1/privacy/consents`
- [ ] `PATCH /api/v1/privacy/consents`
- [ ] `POST /api/v1/privacy/export-requests`
- [ ] `POST /api/v1/privacy/deletion-requests`
- [ ] `GET /api/v1/admin/privacy/requests`
- [ ] `PATCH /api/v1/admin/privacy/requests/:id`
- [ ] Operational backup/restore, traceability, security-review, and deployment verification endpoints/scripts

## Counts

- Implemented HTTP routes: **41** (including health, metrics, and OpenAPI endpoints)
- Pending route groups: **Milestones 7–18**
- Fully completed API milestones: **Milestones 4–6**
