# BUILD STATE

## Session log

| #   | Name                                   | Status      | Gate    | Commit    | Notes                                                                                                             |
| --- | -------------------------------------- | ----------- | ------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | Foundation                             | IN PROGRESS | BLOCKED | —         | Code gate green; Docker runtime gate unavailable on host                                                          |
| 2   | Database schema                        | COMPLETE    | PASS    | `a277793` | Two migrations, seeds, and live constraint tests verified on Supabase PostgreSQL                                  |
| 3   | Backend core                           | IN PROGRESS | BLOCKED | —         | Static/unit/Swagger gates green; auth E2E requires PostgreSQL and Redis                                           |
| 4   | Catalog, inventory, bulk import        | COMPLETE    | PASS    | `main`    | Build/lint/typecheck green; live catalog, 50-way stock race, multipart import, and 10,000-row rollback gates pass |
| 5   | Search, filtering, listing performance | COMPLETE    | PASS    | `main`    | Live PostgreSQL/provider/filter/cursor/query-count/HTTP gates and warm p95 benchmark pass                         |
| 6   | Combined cart                          | COMPLETE    | PASS    | `main`    | Signed guest cart, DB owner constraints, revalidation, merge caps, and 8/8 live Supabase E2E gates pass           |
| 7   | Age gate and purchase verification     | COMPLETE    | PASS    | `main`    | Middleware gate, provider boundary, postcode rules, checkout guard, accessibility, and 13/13 age tests pass       |
| 8   | Delivery zones, slots, and charges     | COMPLETE    | PASS    | `main`    | Basket-aware zone/slot rules, four fee strategies, CRUD, and 30-way capacity-five race pass                       |
| 9   | Pricing, VAT, coupons, promotions      | COMPLETE    | PASS    | `main`    | Authoritative cart pricing, 60 golden baskets, live 20-way coupon race, and 145-test regression pass              |
| 10  | Checkout orchestration                 | COMPLETE    | PASS    | `main`    | Hashed snapshots, ordered validation, guest tombstones, stock TTL/reservation release, and 25 focused tests       |
| 11  | Stripe payments and webhooks           | COMPLETE    | PASS    | `main`    | One intent, signed durable webhooks, atomic order promotion, buffered/capped manual capture, and 5/5 live E2E     |
| 17  | Admin dashboard (parallel preview)     | IN PROGRESS | PASS    | `main`    | Read-only Larkon-inspired shell, live catalogue/search/health views, production build, and HTTP smoke pass        |

## Implemented modules

- foundation/toolchain — COMPLETE (runtime verification blocked by missing Docker)
- packages/money — COMPLETE
- packages/ports — COMPLETE (interface and contract-suite foundation)
- api/health — COMPLETE
- api/database-schema — COMPLETE (deployed and verified on Supabase PostgreSQL)
- api/backend-core — COMPLETE (database-backed E2E verification blocked by missing services)
- api/catalog — COMPLETE (product/category/brand/attribute-set CRUD, variants with their own stock, exact decimal ABV, secure responsive images, locking ledger, low-stock outbox, CSV/XLSX import, and HFSS checks verified)
- api/search — COMPLETE (PostgreSQL and Meilisearch providers, outbox sync, synonyms, filters/facets, age-gated listings, cursor pagination, logs, and performance cache verified)
- api/cart — COMPLETE (signed guest/authenticated identity, immutable server snapshots, live revalidation, grouped totals, coupons, substitution preferences, merge, and abandonment)
- api/age-verification — COMPLETE (session-bound browsing gate, three provider adapters, private DOB handling, jurisdiction policy, and authoritative checkout guard)
- api/delivery — COMPLETE (postcode zones, tiered fees, basket rules, filtered slots, transactional reservations, and admin CRUD)
- api/pricing — COMPLETE (authoritative cart pipeline, effective tax rules, scoped coupons, promotion stacking, influencer attribution, and live concurrency proof)
- api/checkout — COMPLETE (full authoritative summary, hashed session snapshots, transactional stock TTL, guest tombstones, and mutation invalidation)
- api/payments — COMPLETE (Stripe PaymentIntents, server-only totals, durable signed webhooks, atomic one-order promotion, manual capture caps, dispute freeze, and expiry cancellation)
- admin/dashboard — IN PROGRESS (catalogue, delivery, pricing, and VAT operations are wired; secure interactive login and later milestone workflows remain)

## Known deviations from BUILD_CONTRACT.md

- Session 1 Docker runtime gate cannot run until a container engine with external-drive storage is available on the host.
- PostgreSQL gates use the Supabase transaction/session poolers instead of a local container, avoiding internal-SSD usage.
- Prisma migration history is authoritative for drift because the SQL migrations intentionally include database-native foreign keys, triggers, RLS, expression/partial indexes, and generated defaults not fully represented in the relation-light Prisma datamodel.

## Open TODOs carried forward

- None.

## Deferred-with-adapter (integration boundary built, live provider not wired)

| Capability           | Interface                 | Dev impl             | Live impl      | Blocked on                                                                                                      |
| -------------------- | ------------------------- | -------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| Digital proof of age | `AgeVerificationProvider` | Stub + manual review | Yoti adapter   | Merchant Yoti credentials and confirmation that the selected service is registered for alcohol proof-of-age use |
| Card payments        | `PaymentProvider`         | Deterministic stub   | Stripe adapter | Merchant Stripe test/live keys, webhook secret, and alcohol-category onboarding disclosure                      |
