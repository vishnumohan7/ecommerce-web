# Milestone Checklists

This file records evidence, not optimistic status. A milestone is complete only when every required gate is green.

## Milestone 1 — Foundation

- [x] pnpm/Turborepo workspace and strict TypeScript configuration
- [x] API, web, admin, and driver applications build locally
- [x] Money package tests pass with 100% branch coverage
- [x] Lint, typecheck, build, CI, environment validation, and dependency audit configured
- [x] Dependency stores and caches reside inside the external-drive project
- [ ] Docker services and `/ready` gate verified (no external-drive-compatible container runtime available)

Status: IN PROGRESS — runtime gate outstanding.

## Milestone 2 — Database schema

- [x] Prisma schema and initial SQL migration created
- [x] Invariant constraints, RLS policies, audit immutability trigger, indexes, and seeders implemented
- [x] Prisma static validation and generation pass
- [x] Both migrations deployed to Supabase PostgreSQL
- [x] Minimal and demo seeds executed (360 products, 6 customers, and 40 orders)
- [x] Live constraint suite passes (4/4) and migration history reports the database up to date

Status: COMPLETE — live Supabase gate verified on 2026-10-05.

## Milestone 3 — Backend core

- [x] Typed configuration, structured/redacted logging, error envelope, metrics, and security middleware
- [x] Password/JWT/refresh-token authentication and reuse detection
- [x] Email verification, password reset, OTP attempt controls, RBAC, IDOR protection, audit, and outbox foundation
- [x] Unit/static route-coverage gate passes
- [x] Swagger, health, and metrics runtime smoke verified
- [ ] PostgreSQL-backed authentication E2E passes
- [ ] Redis-backed OTP/rate-limit/outbox E2E passes

Status: IN PROGRESS — external PostgreSQL and Redis services required.

## Milestone 4 — Catalog, inventory, and bulk import

- [x] Product create/read/update/archive APIs implemented
- [x] Category CRUD maintains materialised descendant paths, blocks hierarchy cycles, and prevents archiving in-use parents
- [x] Brand CRUD and attribute-set CRUD prevent deletion while referenced by products
- [x] Variant APIs and variant-owned inventory implemented
- [x] Age restriction is modelled independently from alcohol flag and ABV
- [x] Secure image magic-byte validation, limits, EXIF-stripping re-encode, WebP/AVIF variants, and deterministic names
- [x] Transactional inventory mutation uses `SELECT ... FOR UPDATE`, an immutable ledger, and low-stock outbox alerts
- [x] CSV/XLSX validation, dry run, duplicate policies, atomic apply, and row-keyed error reports
- [x] 10,000-row deliberate-error test proves zero product writes
- [x] 50 contenders against stock 10 produce exactly 10 successful reservations in the focused concurrency test
- [x] API build, lint, strict typecheck, and focused unit/integration suites pass
- [x] Catalog/variant migration and demo seed changes execute against Supabase PostgreSQL
- [x] Real PostgreSQL concurrency test passes: exactly 10 of 50 contenders reserve stock 10
- [x] Multipart HTTP import E2E passes against PostgreSQL
- [x] Live 10,000-row HTTP import with one invalid row produces zero product writes
- [x] JPEG-magic polyglot payload is rejected before image decoding or storage

Status: COMPLETE — local and live Supabase gates verified on 2026-10-05.

## Milestone 5 — Search, filtering, and listing performance

- [x] `SearchProvider` port has PostgreSQL and Meilisearch implementations
- [x] PostgreSQL uses indexed weighted full text plus word-level `pg_trgm` typo ranking across name, SKU, description, brand, category, and tags
- [x] Meilisearch document updates/deletes are driven by transactional outbox messages
- [x] Autocomplete, English stopwords, and admin-editable synonym groups are implemented
- [x] Default aubergine/eggplant and coriander/cilantro synonym groups are seeded idempotently
- [x] Category/subcategory, brand, price, stock, dietary, allergen-free, alcohol, ABV, storage, rating, and on-offer filters pass live tests
- [x] Category, brand, storage, alcohol, and on-offer facet counts are returned with results
- [x] Alcohol is excluded from search and product listings without a valid signed session-bound age-gate token
- [x] Opaque keyset cursors produce stable pages without duplicate products
- [x] Search logs capture terms, filters, result counts, and response time
- [x] Search endpoint uses four operations, below the five-query cap
- [x] PostgreSQL and mocked Meilisearch provider contract suites pass
- [x] Live HTTP smoke passes for search, autocomplete, facets, cursor, and ungated alcohol exclusion
- [x] Warm application p95 on the 360-product demo dataset is below 150 ms search and 50 ms autocomplete
- [x] API build, lint, strict typecheck, migration, seed, and focused suites pass

Status: COMPLETE — live Supabase and HTTP gates verified on 2026-10-05. Cold cross-region database latency is tracked separately from the required warm application benchmark.

## Milestone 6 — Combined cart

- [x] One active cart per authenticated user or signed guest session is enforced in PostgreSQL
- [x] Guest cart identity uses a tamper-resistant, HTTP-only 30-day cookie without exposing the database identifier
- [x] Every cart has exactly one owner; zero-owner and dual-owner writes are rejected by a database constraint
- [x] Product category, price, currency, and age restriction snapshots are derived exclusively on the server
- [x] Cart reads revalidate availability, stock, price, and age restriction without silently accepting price changes
- [x] Add, quantity update, remove, substitution-preference, coupon attach/remove, and guest-to-user merge routes are implemented
- [x] Guest-to-user merge sums matching quantities, caps them to available stock, and records the adjustment
- [x] Responses separate grocery and alcohol groups, calculate snapshot totals, and expose whether age verification is required
- [x] Alcohol can be held in a guest cart while storefront visibility remains protected by the age gate
- [x] Inactive carts can be marked abandoned with an auditable timestamp
- [x] Live Supabase E2E covers uniqueness, owner constraints, forbidden fields, merge caps, price changes, deactivation, coupons, and abandonment (8/8)
- [x] API build, lint, strict typecheck, migration status, route coverage, and focused suites pass

Status: COMPLETE — live Supabase cart and database-constraint gates verified on 2026-10-05.

## Milestone 7 — Age gate and purchase verification

- [x] Next.js middleware gates direct, refreshed, nested, shared, product, and alcohol-filtered URLs
- [x] Browsing token is HMAC-signed, session-bound, HTTP-only, SameSite Lax, and expires after 30 days
- [x] Decline and Escape return home with a dismissible notice; keyboard focus is trapped in the accessible alert dialog
- [x] axe-core reports zero serious or critical violations on the alcohol gate
- [x] Stub, Yoti, and manual-review implementations satisfy the `AgeVerificationProvider` contract
- [x] Purchase verification has exactly one user or guest owner, a configurable expiry, and a separate status from the browsing gate
- [x] Direct DOB is stored privately but omitted from public results and audit payloads; DVS document data is never persisted
- [x] Scottish and Northern Irish postcode areas are seeded in admin-editable jurisdiction rules
- [x] Checkout independently enforces purchase verification, jurisdiction sale hours, and prohibited delivery windows
- [x] Forged and valid browsing cookies alone cannot bypass purchase verification
- [x] The required Scotland 22:30/02:00, 0.4% ABV, and policy-restricted 0.0% assertions pass against Supabase
- [x] API/web lint, strict typecheck, builds, unit/contract/live E2E suites, route coverage, and migration status pass

Status: COMPLETE — middleware/browser/accessibility and live Supabase security gates verified on 2026-10-06. Live Yoti activation remains a credential/configuration task behind the verified provider adapter.

## Milestone 8 — Delivery zones, slots, and charges

- [x] Zones support outward-code patterns plus explicit postcode inclusions and exclusions
- [x] Zone rules enforce order minimum/maximum, supported storage types, alcohol availability, and alcohol subtotal minimum
- [x] Per-zone tiered fee schedules and grocery free-delivery thresholds are admin-editable
- [x] `MAX`, `SUM`, `GROCERY_ONLY`, and `HIGHEST_PLUS_SURCHARGE` strategies return one customer-facing fee plus an internal breakdown
- [x] Slots carry capacity, surcharge, cutoff, and age-restriction compatibility controls
- [x] Slot availability is filtered server-side for zone, basket, storage, cutoff, capacity, age compatibility, and jurisdiction windows
- [x] Slot reservations lock the row, are cart-idempotent, and cannot exceed capacity
- [x] Delivery zone and slot admin list/create/update routes are permission-protected and audited
- [x] Mixed-basket fee, grocery-only threshold, and alcohol-restricted-zone assertions pass against Supabase
- [x] Thirty concurrent racers against capacity five produce exactly five reservations
- [x] API lint, strict typecheck, build, full regression suite, route coverage, and eight-migration status pass

Status: COMPLETE — live Supabase rule, CRUD, and 30-way capacity gates verified on 2026-10-06.

## Milestone 9 — Pricing, VAT, coupons, and promotions

- [x] `PricingService.calculate` is the single pricing arithmetic entry point and an ESLint rule prevents direct helper imports elsewhere
- [x] Cart totals now consume the same authoritative pricing breakdown instead of recomputing money
- [x] The pipeline is fixed as base → promotions → allocated coupon → delivery → line VAT → totals
- [x] Basket discounts use `Money.allocate`; the £10 across three equal lines assertion yields £3.34, £3.33, and £3.33
- [x] Products have an explicit tax category and effective-dated, admin-editable VAT rules
- [x] VAT is extracted from inclusive discounted line totals without hard-coded decimal rates
- [x] Customer-credit, site-wide, and influencer coupons share fixed/percentage, spend, cap, expiry, usage, customer, first-order, catalogue, and grocery/alcohol scope rules
- [x] `NONE`, `BEST_ONLY`, and `STACK` policies are tenant-configurable
- [x] Multibuy, threshold, fixed, percentage, and free-delivery promotion evaluation is implemented
- [x] Coupon create/edit operations are audited and redemption uses a row lock before incrementing usage
- [x] Influencer coupon redemptions can attribute an order and calculate commission on the configured basis
- [x] Sixty independent golden JSON baskets match their expected penny-level breakdowns
- [x] Twenty simultaneous contenders against a one-use coupon persist exactly one redemption in Supabase
- [x] Nine migrations are deployed and Supabase reports the schema up to date
- [x] API lint, strict typecheck, production build, route boot smoke, and full 31-file/145-test regression pass

Status: COMPLETE — live Supabase pricing/concurrency gates and the complete regression suite verified on 2026-10-06.

## Milestone 10 — Checkout orchestration

- [x] One side-effect-free validation summary groups grocery/alcohol lines and returns one authoritative total
- [x] Validation orders cart, product, stock, price, address/zone, slot, coupon, age, jurisdiction window, and recomputed-total checks
- [x] Client-supplied price, subtotal, discount, tax, total, stock, category, and alcohol fields are rejected
- [x] Short-lived checkout sessions persist a deterministic SHA-256 snapshot hash
- [x] Basket version, live catalogue price/status, pricing, coupon, selected slot, and age state are revalidated before reuse
- [x] Basket mutation invalidates the snapshot and releases reserved inventory
- [x] Session creation locks inventory rows and reserves stock atomically for a configurable 20-minute TTL
- [x] The scheduled expiry path and explicit cancellation both release stock transactionally
- [x] Variable-weight baskets set `requiresManualCapture=true`
- [x] Eligible guest checkout creates a disabled, non-login tombstone user
- [x] Guest alcohol checkout without purchase verification returns `AGE_VERIFICATION_REQUIRED` and creates no session
- [x] Checkout/age/security focused suite passes 25/25; API lint, strict typecheck, build, and ten-migration status pass

Status: COMPLETE — focused functionality and live Supabase reservation gates verified on 2026-10-06. Full regression intentionally deferred per user request.

## Milestone 17 — Admin dashboard (parallel preview)

- [x] Responsive Larkon-inspired admin shell and navigation implemented without copying vendor source or assets
- [x] Dashboard reads live health, catalogue, and search APIs and handles unavailable/empty states
- [x] Product catalogue/search, system health, and honest feature-status screens implemented
- [x] Write actions remain disabled until secure admin authentication and role checks are available
- [x] Admin lint, strict typecheck, tests, production build, and four-route HTTP smoke pass
- [ ] Secure admin authentication and RBAC session flow
- [ ] Product, inventory, promotion, order, refund, customer, settings, and audit management workflows
- [ ] Milestone 17 reporting APIs and final browser accessibility/visual regression gate

Status: IN PROGRESS — useful read-only preview is live; this is not full Milestone 17 completion.
