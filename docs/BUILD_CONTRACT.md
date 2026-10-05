# PART 1 — WHAT IS BEING BUILT

## 1.1 Product

A UK-market online **grocery + alcohol** commerce platform, delivered as a **licensable commercial software product**, not a bespoke one-client build. Deployable by a buyer to their own infrastructure, brandable without touching source, upgradable across versions.

Deliverables:

| # | Deliverable | Stack |
|---|---|---|
| 1 | Customer storefront | Next.js 15 App Router, React 19, TypeScript, Tailwind 4 |
| 2 | Admin console | Next.js 15, TypeScript, Tailwind 4, TanStack Table/Query |
| 3 | REST API | NestJS 11, TypeScript, Prisma 6, PostgreSQL 17 |
| 4 | Driver web app (installable PWA) | Next.js 15, mobile-first, offline queue — carries the delivery age check |
| 5 | Infrastructure | Docker Compose (dev), Dockerfiles + Helm values (prod), GitHub Actions |
| 6 | Documentation set | Developer docs + **buyer/operator docs** (see 2.6) |

**Out of scope for this edition: native mobile apps.** Do not create `apps/mobile`. The API must be *mobile-ready* so a Flutter/React Native edition can be added later without backend changes: OpenAPI is the published contract, versioned under `/api/v1`, breaking changes are blocked in CI (Session 18), auth is token-based, and push subscriptions are a first-class endpoint.

Market: United Kingdom. Currency: GBP. Timezone: Europe/London (store UTC, convert at presentation and at business-rule boundaries — licensing hour checks are business-rule boundaries and **must** use Europe/London wall-clock). Language: en-GB, with i18n scaffolding from day one (see 2.3).

---

## 1.2 Scope boundary — what this is NOT

Write these into `/docs/ARCHITECTURE.md` as explicit non-goals so scope creep is auditable:

- Not a warehouse management system. Pick/pack is a lightweight workflow, not a WMS.
- Not a route optimisation engine. Delivery slots and zones only; routing is an adapter.
- Not an ERP or accounting system. Invoices export; ledgers live elsewhere.
- Not a marketplace. Single merchant per tenant.
- No alcohol duty calculation. Duty is assumed baked into supplier cost price. (Document this loudly — it is a common buyer assumption.)

---

# PART 2 — COMMERCIAL PRODUCT REQUIREMENTS (the "sellable individually" part)

This entire part is absent from most specs and is the difference between a client project and a product. Treat it as first-class scope.

## 2.1 Tenancy decision — LOCKED

**Single-tenant deployable, multi-tenant-ready schema.**

- Every tenant-scoped table carries `tenantId UUID NOT NULL`, indexed, with a composite unique on `(tenantId, <natural key>)`.
- A default tenant is seeded. Single-tenant deployments run with exactly one row in `Tenant` and `TENANCY_MODE=single`.
- All Prisma access goes through a `TenantScopedPrismaService` that injects `tenantId` from request context. **Direct `prisma.*` calls from feature services are a lint error** — enforce with an ESLint rule (`no-restricted-imports` on `PrismaService` outside `src/common/database`).
- PostgreSQL Row-Level Security policies on all tenant-scoped tables as defence in depth. RLS is enabled from day one even in single-tenant mode.

Rationale to record in `/docs/ARCHITECTURE_DECISIONS.md`: retrofitting `tenantId` after launch is a multi-week migration; shipping it inert costs ~2 days.

## 2.2 White-labelling

No buyer should edit source to rebrand. All of the following are database-or-env driven and editable from Admin → Settings → Branding:

- Brand name, legal entity name, company number, VAT number, registered address
- Logo (light/dark/favicon/app icon/email header), uploaded via storage adapter
- Colour tokens: primary, secondary, accent, success, warning, danger, surface, on-surface — emitted as CSS custom properties, consumed by Tailwind via `@theme` with `var()` references. **No hard-coded hex values anywhere in `apps/web` or `apps/admin`.** Enforce with a lint rule.
- Typography: font family pair (heading/body) from a curated list plus a custom `@font-face` upload slot
- Email template branding (logo, colours, footer legal block, unsubscribe address)
- Branding is served by `GET /api/v1/public/branding` (cached, ETag'd) so web, admin, driver app and any future client consume the same theme
- Legal page content (Terms, Privacy, Cookie, Returns, Alcohol Policy, Delivery Policy) is CMS-managed, seeded with placeholder text clearly marked `[BUYER MUST REPLACE — NOT LEGAL ADVICE]`

## 2.3 Extensibility axes (build the seam, ship one implementation)

| Axis | Seam | v1 ships |
|---|---|---|
| Currency | `Money` value object (minor units `bigint` + ISO 4217 code), never `float`. All display via `Intl.NumberFormat`. | GBP only |
| Locale | `next-intl` on web, admin and driver apps. Zero hard-coded user-facing strings — enforce with `eslint-plugin-i18next` / a `no-literal-string` rule. | en-GB only |
| Payment | `PaymentProvider` port | Stripe |
| Age verification | `AgeVerificationProvider` port | Stub (dev) + Yoti (live) |
| Email / SMS / Push | Three separate ports | Resend / Twilio / FCM |
| Storage | `StorageProvider` port | S3-compatible (MinIO dev, R2/S3 prod) |
| Search | `SearchProvider` port | Postgres FTS+trigram; Meilisearch adapter also shipped |
| Delivery dispatch | `DispatchProvider` port | Internal-fleet impl + Stuart adapter |

A "port" means: a TypeScript `interface` in `packages/ports`, a NestJS injection token, at least two implementations (one dev/fake, one real), a factory selecting by env var, and a shared contract test suite that **every** implementation must pass.

## 2.4 Licensing & entitlements

- Ship under a commercial EULA (`LICENSE-COMMERCIAL.md`), not MIT/Apache. Include a placeholder the buyer's solicitor completes.
- `LicenseService` validates a signed JWT licence key (Ed25519, public key compiled in, private key never in repo) carrying: `licenseId`, `tenantId`, `edition` (`STANDARD` | `PRO`), `seats`, `expiresAt`, `features[]`.
- Grace behaviour on expiry: **read-only admin, storefront fully operational, prominent admin banner.** Never break a live merchant's checkout over a licence issue — that is how products get sued.
- Feature flags gate PRO-only modules (influencer analytics, advanced reporting, multi-warehouse). Flags resolve from: licence entitlements ∩ tenant settings ∩ env overrides.
- Offline validation only. No phone-home. (Document this as a selling point.)

## 2.5 Install, upgrade, and dependency hygiene

- `pnpm run setup` — interactive first-run wizard: checks Node/Docker versions, generates `.env` from `.env.example` with secure random secrets, runs migrations, prompts for admin email/password, seeds a minimal (non-demo) dataset, verifies connectivity to configured providers, prints a checklist of what still needs buyer credentials.
- `pnpm run seed:demo` — separate, loud, refuses to run when `NODE_ENV=production` without `--force`.
- Semantic versioning. `CHANGELOG.md` maintained per session (Keep a Changelog format).
- `UPGRADING.md` with a section per minor version. Every breaking migration ships with a documented rollback.
- **Dependency licence audit is a CI gate.** `license-checker` (JS, all workspaces) must fail the build on `GPL-*`, `AGPL-*`, `SSPL`, or `unknown`. Generate `docs/THIRD_PARTY_LICENSES.md` automatically. *This is non-negotiable for a resellable product — a single AGPL transitive dependency makes the product unsellable.*

## 2.6 Two documentation sets

**Developer set** (`/docs`): `ARCHITECTURE.md`, `ARCHITECTURE_DECISIONS.md`, `DATABASE.md`, `API.md`, `SECURITY.md`, `TESTING.md`, `ENVIRONMENT.md`, `DEPLOYMENT.md`, `DRIVER_APP.md`, `INTEGRATIONS.md`, `BUILD_STATE.md`, `UPGRADING.md`, `THIRD_PARTY_LICENSES.md`.

**Buyer/operator set** (`/docs/buyer`): `GETTING_STARTED.md`, `ADMIN_GUIDE.md` (screenshot-annotated, task-oriented), `STORE_SETUP_CHECKLIST.md`, `ALCOHOL_COMPLIANCE_CHECKLIST.md`, `INTEGRATION_CREDENTIALS.md` (exactly which accounts to open and which keys to paste where), `TROUBLESHOOTING.md`, `SUPPORT.md`, `DATA_PROTECTION_NOTES.md`.

`ALCOHOL_COMPLIANCE_CHECKLIST.md` must open with: *"This software provides technical controls. It does not make you compliant. You must hold the appropriate premises licence and take your own legal advice."*

## 2.7 Demo & sales assets

- `docker compose -f docker-compose.demo.yml up` → fully seeded, self-resetting demo (cron truncates and reseeds nightly), banner watermark, payments forced to Stripe test mode, outbound email/SMS forced to a capture inbox.
- Seeded demo credentials documented for every RBAC role.
- `docs/buyer/FEATURE_MATRIX.md` — STANDARD vs PRO, machine-generated from the feature-flag registry so it cannot drift.

---

# PART 3 — NON-NEGOTIABLE ARCHITECTURAL INVARIANTS

These are invariants, not preferences. Each one has an automated test that must exist and pass. If an invariant and any other instruction conflict, the invariant wins.

## INV-1 — One cart

Exactly one `Cart` per authenticated customer, and exactly one per guest session. Enforced by a partial unique index:
```sql
CREATE UNIQUE INDEX cart_one_per_user ON "Cart"("tenantId","userId") WHERE "userId" IS NOT NULL AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX cart_one_per_guest ON "Cart"("tenantId","guestToken") WHERE "guestToken" IS NOT NULL AND "status" = 'ACTIVE';
```
There is no `GroceryCart`, no `AlcoholCart`, and no `cartType` discriminator on `Cart`. Grocery/alcohol is a property of `CartItem`, derived from `Product`.

## INV-2 — One checkout, one PaymentIntent, one order, one invoice

A single checkout produces exactly one `Order`, one `Payment`, one Stripe PaymentIntent, one `Invoice`. Enforced by DB constraints:
```sql
ALTER TABLE "Payment" ADD CONSTRAINT payment_intent_unique UNIQUE ("providerPaymentIntentId");
ALTER TABLE "Payment" ADD CONSTRAINT payment_one_per_order UNIQUE ("orderId");
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_one_per_order UNIQUE ("orderId");
ALTER TABLE "Order"   ADD CONSTRAINT order_idem_unique UNIQUE ("tenantId","idempotencyKey");
```

## INV-3 — Visual separation ≠ transactional separation

Grocery and alcohol are separated in: UI grouping, invoice sections, fulfilment handling, delivery rules, tax treatment, refund policy, reporting dimensions. They are **never** separated into distinct carts, checkouts, payments, orders, order numbers, or invoices.

Reporting corollary: an order containing £30 grocery + £20 alcohol is `orders = 1`, `groceryRevenue = 30`, `alcoholRevenue = 20`, `totalRevenue = 50`, `basketType = MIXED`. A test must assert this exact case.

## INV-4 — The backend is the only authority

The client sends **identifiers and quantities only**. Never money, never tax, never eligibility, never flags. The server rejects any request body containing `price`, `subtotal`, `discount`, `tax`, `total`, `deliveryFee`, `isAlcohol`, `ageVerified`, or `stock`. Implement as a global `ForbiddenFieldsPipe` that hard-fails with `400 CLIENT_SUPPLIED_SERVER_FIELD` — do not silently strip, because silent stripping hides attacks.

## INV-5 — Two distinct age mechanisms

| | Category Age Gate | Purchase Age Verification |
|---|---|---|
| Question | "Are you over 18?" | "Prove you are over 18" |
| Purpose | UX friction, browsing | Legal eligibility to buy |
| Layer | Client + middleware-rendered interstitial | Backend, authoritative |
| Storage | Signed, httpOnly, short-lived cookie | `AgeVerification` record |
| Bypassable | Yes, and that is acceptable | No |

Passing the gate **never** sets any purchase-eligibility state. A test must assert that forging the gate cookie/state and POSTing to checkout with alcohol in the cart returns `403 AGE_VERIFICATION_REQUIRED`.

## INV-6 — Money is integers

All monetary values are `BigInt` minor units (pence) in the database and `bigint`/`string` on the wire. `Float`/`Number`/`double` for money anywhere is a build failure. Enforce via a custom ESLint rule and a Prisma schema lint script that greps for `Float` on money-named columns.

Rounding: compute VAT per line at the configured rate, round **half-up to the nearest penny per line**, then sum. Document this in `docs/TAX.md` and assert with a golden-file test containing at least 40 rounding edge cases.

## INV-7 — Payment safety

An `Order` transitions to `PAID` **only** via a signature-verified Stripe webhook whose `payment_intent.amount_received` equals the server-recomputed authoritative total in the same currency. Client-reported success updates UI optimistically and nothing else. A test must assert that `POST /checkout/complete` with a forged success payload creates no order.

## INV-8 — No fake functionality

Every interactive control performs its real function against the real backend. Forbidden in shipped code: `TODO`, `FIXME`, `coming soon`, `not implemented`, `mock` (outside `*.spec.ts`/`*.test.ts`/`__mocks__`), `lorem ipsum`, `placeholder` (outside `placeholder=` HTML attributes and intentional skeleton components). CI greps for these and fails.

If an external provider genuinely cannot be reached in dev, the **port + dev implementation + contract tests** must all exist, and it is recorded in the `BUILD_STATE.md` deferred table. That is the only acceptable form of "not live."

## INV-9 — Grocery reality: variable weight and substitution

This invariant does not appear in most specs and breaks the payment model if retrofitted.

- `Product.pricingMode ∈ { UNIT, WEIGHT_ESTIMATED }`. `WEIGHT_ESTIMATED` items carry `pricePerKg`, `estimatedWeightGrams`, and `weightToleranceBps`.
- Checkout authorises an amount that includes a configurable **variance buffer** (`SETTINGS.payment.weightVarianceBufferBps`, default 1000 = 10%) over the estimated basket.
- Stripe PaymentIntent uses `capture_method: 'manual'` when the basket contains any `WEIGHT_ESTIMATED` item **or** when `SETTINGS.fulfilment.substitutionsEnabled` is true. Otherwise `automatic`.
- At pick completion the server recomputes the actual total from picked weights and accepted substitutions, then **captures ≤ the authorised amount**. Never capture more; if the recomputed total exceeds the authorisation, cap the capture at the authorised amount and write a `PriceCapEvent` to the audit log for the merchant to resolve.
- Customer receives an "amount may vary" disclosure pre-payment and a final-amount email post-capture. Both are mandatory.
- Substitutions: customer sets per-line preference (`NO_SUB` | `SIMILAR` | `ANY`); picker proposes; server validates the substitute has equal-or-stricter age restriction (**an alcohol item may never be substituted by a picker onto an order that has not passed alcohol verification, and an alcohol item may only be substituted by another alcohol item**); customer may reject within a configurable window, triggering a partial refund of that line.

## INV-10 — Audit everything that matters

Append-only `AuditLog` (no UPDATE/DELETE grants on the table for the app role) recording actor, action, entity, entityId, before, after, requestId, ip, userAgent, timestamp. Mandatory for: price changes, stock adjustments, order status transitions, refunds, coupon create/edit, role changes, **every age-verification and delivery-age-check decision**, GDPR request handling, and settings changes. Age-verification audit entries have a legally-motivated retention of 3 years minimum, configurable, and are excluded from GDPR erasure (see 5.6).

---

# PART 4 — UK COMPLIANCE REQUIREMENTS

> The agent must implement these as configurable, enforced, tested controls. Write `docs/COMPLIANCE.md` describing exactly what the software enforces and what remains the merchant's legal responsibility.

## 4.1 Alcohol — the legal frame

- Licensing Act 2003 (England & Wales): selling alcohol to under-18s is an offence; licensed premises must operate an age verification policy as a mandatory licence condition. Challenge 25 is the industry-standard implementation, not itself a statutory requirement in England & Wales.
- Scotland: the mandatory age verification condition on premises licences is set at a **minimum age of 25** (Alcohol etc. (Scotland) Act 2010, s.6). Per Argyll & Bute Council's guidance, that Schedule 3 condition does not itself extend to remote sales, but the licensee remains liable for due diligence on underage sales. Therefore: default the Scottish `challengeAge` to 25 for delivery, as an admin-editable policy, and have the merchant's solicitor confirm.
- "Alcohol" is defined at **above 0.5% ABV**. Products at or below 0.5% are not legally alcohol. The product model must distinguish `abv` from `isAgeRestricted`, because merchants routinely age-restrict 0.0% products by policy. **Do not derive age restriction from ABV alone.**
- Age-restricted categories beyond alcohol exist (knives, tobacco/vapes, solvents, some energy drinks by retailer policy, lottery). Model `ageRestriction` as an integer minimum age plus a `restrictionReason` enum — **not** a boolean `isAlcohol`. `isAlcohol` remains a separate flag for duty/reporting/licensing-hours purposes.

## 4.2 Scotland-specific rules — implement as a configurable jurisdiction ruleset

Scotland's rules differ enough to break a UK-wide hard-coded implementation:

- **Off-sales permitted hours: 10:00–22:00 daily, statutory maximum.** The *sale* — i.e. acceptance of the order — must occur within licensed hours. An individual premises licence may be narrower; it may never be wider.
- **Delivery between 00:00 and 06:00 is an offence** (s.120, other than to licensed premises).
- **s.119 record-keeping:** a day book recording the order must be kept at the despatch premises, and a delivery book or invoice must be carried by the delivering person, recording quantity, description and price of the alcohol plus the name and address of the recipient. Implement as a generated, exportable, immutable **Alcohol Despatch Day Book** and a **Driver Delivery Manifest** (PDF + CSV), both retained and downloadable from admin.
- Northern Ireland has a distinct regime again; model it as a jurisdiction with its own ruleset rather than assuming GB rules.

**Implementation:** `JurisdictionRuleService` resolves a ruleset from the **delivery postcode**, not the merchant address. Ruleset fields: `permittedSaleWindow`, `prohibitedDeliveryWindow`, `challengeAge`, `requiresDayBook`, `requiresDriverManifest`, `allowsDigitalProofOfAge`. Seed `ENGLAND_WALES`, `SCOTLAND`, `NORTHERN_IRELAND`, all admin-editable. All window checks evaluate in Europe/London wall-clock.

Checkout must **block** alcohol purchase outside the permitted sale window for the resolved jurisdiction, with a clear message and the time the window reopens. Slot selection must **hide or disable** delivery slots that fall in a prohibited delivery window for alcohol-containing baskets.

## 4.3 Digital proof of age — a real integration target

As of 2026, the Licensing Act 2003 (Mandatory Licensing Conditions) (Amendment) Order 2026 enables retailers in England & Wales to accept digital proof of age, provided it comes through a **certified Digital Verification Service on the statutory GOV.UK register** and meeting the UK digital verification services trust framework. Certified providers in the market include Yoti, Luciditi and Post Office EasyID. Businesses are not required to adopt it and may continue with physical ID. Confirm commencement status and the current register with the client's solicitor before enabling.

Implement accordingly:
- `AgeVerificationProvider` port with methods `initiate(userId, context)`, `getResult(sessionId)`, `handleWebhook(payload, signature)`.
- Implementations: `StubAgeVerificationProvider` (dev, deterministic by test DOB), `YotiAgeVerificationProvider` (live), `ManualReviewAgeVerificationProvider` (admin reviews an uploaded document — for merchants without a DVS account).
- `Settings.alcohol.acceptDigitalProofOfAge` boolean, default **false**, with admin help text stating the merchant must confirm their provider is on the statutory register.
- Store only: provider, sessionId, `outcome`, `verifiedAgeOver` (integer, e.g. `18`), `method`, timestamp, and a provider reference. **Never store the document image, document number, or full DOB from a DVS response.** Where DOB is collected directly at checkout, store the DOB but expose only a derived `isOver18` to all downstream consumers.

## 4.4 Delivery age check

Order-level `deliveryAgeCheckStatus ∈ { NOT_REQUIRED, PENDING, PASSED, FAILED, REFUSED }`, set to `PENDING` automatically when any line has `ageRestriction > 0`.

Driver web app captures: outcome, challenge age applied (25 in Scotland, configurable elsewhere), ID type category (`PASSPORT` | `DRIVING_LICENCE` | `PASS_CARD` | `DIGITAL_DVS` | `OTHER` — **category only, never the number**), recipient-was-present boolean, refusal reason, free-text note, timestamp, GPS (if consented and configured), and optionally a photo of the doorstep handover — **never a photo of the ID document**. Make that a hard rule in code and in `docs/SECURITY.md`; storing ID images creates a data-protection liability the merchant almost certainly has not assessed.

**Age-restricted orders may never be left in a safe place, with a neighbour, or in an unattended location.** Enforce in code: the driver app cannot select "left safe" for an order with `deliveryAgeCheckStatus != NOT_REQUIRED`. Refusal triggers: return-to-depot, automatic full refund of restricted lines (configurable: full order vs restricted lines only), customer notification, and an audit entry.

## 4.5 Payments & SCA

UK card payments require Strong Customer Authentication. Use Stripe PaymentIntents with `automatic_payment_methods` and handle `requires_action` / 3DS challenge flows on web (Stripe Payment Element). A checkout that assumes one-step confirmation will fail in UK production — test the 3DS-required card explicitly (`4000 0027 6000 3184`).

Also note in `docs/INTEGRATIONS.md`: alcohol is a restricted/regulated category for most PSPs. The buyer must disclose it during Stripe onboarding. Do not implement BNPL methods (Klarna/Clearpay) for baskets containing alcohol — gate BNPL availability on basket composition.

## 4.6 Data protection

- UK GDPR + PECR. Cookie consent before any non-essential cookie fires, with **granular** categories (necessary / functional / analytics / marketing), a reject-all button of equal prominence, and a consent version + timestamp audit trail.
- Analytics and marketing tags load only after consent — implement via a consent-gated tag loader, not by hoping.
- DSAR endpoints: export (machine-readable JSON + human-readable PDF) and erasure. Erasure **anonymises** rather than deletes where retention is legally required: order records, invoices, payment records and age-verification audit entries are retained; personal identifiers are replaced with `REDACTED-{hash}` and the `User` row is tombstoned. Document the retention basis for each retained category in `docs/buyer/DATA_PROTECTION_NOTES.md`.
- Data minimisation on alcohol: collect DOB or a verification outcome, not both where avoidable; never persist ID document images.

## 4.7 Accessibility & consumer law

- Target **WCAG 2.2 Level AA** on storefront, and AA on admin for all primary task flows. Automated axe-core checks in CI on a defined page set (fail on any violation of impact `serious` or `critical`), plus a manual keyboard-only walkthrough checklist in `docs/TESTING.md`.
- The age gate modal is a focus-trapped, labelled, escape-handled dialog with `role="alertdialog"`. An inaccessible age gate blocks screen-reader users from a whole category.
- Consumer Contracts Regulations: 14-day cancellation right with the standard exemptions (perishables and, typically, opened alcohol). Model `Product.returnPolicy ∈ { STANDARD_14_DAY, PERISHABLE_EXEMPT, AGE_RESTRICTED_RESTRICTED, NON_RETURNABLE }` and drive the returns engine from it rather than hard-coding "alcohol can't be returned."
- Price display: VAT-inclusive prices to consumers. Unit pricing (price per kg/litre/100g) is required for most grocery — implement `unitPriceDisplay` on the product model and render it in listings, PDP, cart and invoice.
- HFSS: England restricts the placement and promotion of less-healthy food and drink online, including on homepages, category landing pages, checkout pages and "favourites"/basket-upsell surfaces, and restricts volume-price promotions on in-scope products. Model `Product.hfssStatus ∈ { NOT_IN_SCOPE, IN_SCOPE }` and `Product.hfssCategory`, and have the merchandising engine refuse to place `IN_SCOPE` products into a restricted surface and refuse to apply multibuy promotions to them. Make the enforcement toggleable per jurisdiction, and put a clear disclaimer in the buyer docs that classification is the merchant's responsibility. **Verify the current rules and commencement dates with the client's legal adviser before launch — this area has moved repeatedly.**

---

# PART 5 — THIRD-PARTY INTEGRATION REGISTER

Every row is a **port** as defined in 2.3. Ship the interface, the dev implementation, the named live implementation, the config, the contract tests, and a section in `docs/INTEGRATIONS.md` documenting: what account the buyer must open, which env vars, which webhooks to register, what it costs, and what happens if it is not configured.

| # | Capability | Port | Dev impl | Live impl (ship) | Alt adapters (document only) | Env |
|---|---|---|---|---|---|---|
| 1 | Card payments | `PaymentProvider` | `StripeTestProvider` | **Stripe** (PaymentIntents, manual capture, Connect-ready) | Adyen, Checkout.com, Worldpay | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| 2 | Wallets | via #1 | — | Apple Pay + Google Pay via Stripe Payment Element | — | domain verification file |
| 3 | Age verification | `AgeVerificationProvider` | `StubAgeVerificationProvider` | **Yoti** | Luciditi, Post Office EasyID, OneID, VerifyMy | `AGE_VERIFY_PROVIDER`, `YOTI_CLIENT_SDK_ID`, `YOTI_KEY_FILE_PATH`, `YOTI_WEBHOOK_SECRET` |
| 4 | Address lookup | `AddressLookupProvider` | `StaticPostcodeProvider` (fixture set) | **getAddress.io** | Loqate, Ideal Postcodes, Royal Mail PAF | `ADDRESS_PROVIDER`, `GETADDRESS_API_KEY` |
| 5 | Transactional email | `EmailProvider` | `MailpitProvider` (SMTP → local UI) | **Resend** | Postmark, SendGrid, SES | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |
| 6 | SMS / OTP | `SmsProvider` | `ConsoleSmsProvider` (logs code, dev-only) | **Twilio** (Verify for OTP) | Vonage, MessageBird, Sinch | `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| 7 | Push | `PushProvider` | `NoopPushProvider` | **Web Push (VAPID)** — storefront + driver PWA | FCM, OneSignal (for a future native edition) | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| 8 | WhatsApp (optional, PRO) | `WhatsAppProvider` | `NoopWhatsAppProvider` | **Meta WhatsApp Cloud API** | Twilio WA, 360dialog | `WHATSAPP_ENABLED`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` |
| 9 | Object storage | `StorageProvider` | **MinIO** in compose | **S3-compatible** (AWS S3 / Cloudflare R2) | GCS, Azure Blob | `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_PUBLIC_BASE_URL` |
| 10 | Image optimisation | `ImageProvider` | `SharpLocalProvider` | Next/Image + Cloudflare Images | imgix, Cloudinary | `IMAGE_PROVIDER`, `CF_IMAGES_TOKEN` |
| 11 | Search | `SearchProvider` | `PostgresSearchProvider` | **Postgres FTS + pg_trgm** *and* **Meilisearch** (both shipped) | Typesense, OpenSearch, Algolia | `SEARCH_PROVIDER`, `MEILI_HOST`, `MEILI_MASTER_KEY` |
| 12 | Cache / queue | — | **Redis** in compose | Redis + **BullMQ** | — | `REDIS_URL` |
| 13 | Delivery dispatch | `DispatchProvider` | `InternalFleetProvider` | **Stuart** (UK on-demand, supports age-verified deliveries) | Gophr, DPD Local, Royal Mail Click&Drop, Shutl | `DISPATCH_PROVIDER`, `STUART_CLIENT_ID`, `STUART_CLIENT_SECRET` |
| 14 | Maps / geocoding | `GeoProvider` | `FixtureGeoProvider` | **Mapbox** | Google Maps, OS Places | `GEO_PROVIDER`, `MAPBOX_TOKEN` |
| 15 | Error monitoring | — | console | **Sentry** (api + web + admin + driver) | Rollbar, Bugsnag | `SENTRY_DSN`, `SENTRY_ENVIRONMENT` |
| 16 | Tracing / metrics | — | OTel → console | **OpenTelemetry** → OTLP collector; Prometheus `/metrics` | Datadog, New Relic | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| 17 | Product analytics | `AnalyticsProvider` (consent-gated) | `NoopAnalyticsProvider` | **PostHog** (self-hostable — a selling point) | GA4 w/ consent mode, Matomo | `ANALYTICS_PROVIDER`, `POSTHOG_KEY`, `POSTHOG_HOST` |
| 18 | Feature flags | `FlagProvider` | `EnvFlagProvider` | **Flagsmith** (self-hostable) | Unleash, LaunchDarkly | `FLAG_PROVIDER`, `FLAGSMITH_KEY` |
| 19 | PDF generation | `PdfProvider` | `PuppeteerPdfProvider` | Puppeteer/Chromium in a worker container | Gotenberg, PDFMonkey | `PDF_RENDERER` |
| 20 | Accounting export | `AccountingProvider` | `CsvAccountingProvider` | **Xero** (PRO) | QuickBooks, Sage | `ACCOUNTING_PROVIDER`, `XERO_*` |
| 21 | Bot / abuse protection | — | disabled | **Cloudflare Turnstile** on register/OTP/password-reset/guest-checkout | hCaptcha, reCAPTCHA Enterprise | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` |
| 22 | Secrets | — | `.env` | Doppler / AWS Secrets Manager (documented) | Vault, SOPS | — |
| 23 | Reviews integrity (PRO) | `ReviewSyndicationProvider` | noop | Trustpilot | Feefo, REVIEWS.io | `TRUSTPILOT_*` |
| 24 | Live chat / support (optional) | `SupportWidgetProvider` | noop | Crisp | Intercom, Zendesk | `SUPPORT_WIDGET_*` |

**Contract test rule.** For every port, `packages/ports/<name>/contract.spec.ts` exports a suite parameterised by implementation. Both the dev and live implementations import and run it (the live one behind `INTEGRATION_TESTS=1` with recorded fixtures via `nock`/`msw`). A port with only one implementation passing its contract suite fails the Definition of Done.

**Webhook rule.** Every inbound webhook (Stripe, Yoti, Twilio status, Stuart job updates, WhatsApp) goes through one shared pipeline: raw-body capture → signature verification → persist to `WebhookEvent` (unique on `provider + providerEventId`) → enqueue for async processing → respond `200` fast. Processing is idempotent and retried with backoff. Never process a webhook inline in the HTTP handler, and never trust an unverified one.

---
