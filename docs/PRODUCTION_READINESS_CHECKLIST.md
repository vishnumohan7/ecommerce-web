# Production Readiness Milestone Checklist

Last audited: 2026-10-09

This is the authoritative go-live checklist for the bespoke single-client UK grocery and alcohol commerce platform. It supersedes optimistic completion labels in historical milestone notes, while retaining those notes as implementation evidence.

## Locked scope decisions

- [x] One combined cart, one checkout, one payment, one order and one invoice.
- [x] Grocery and alcohol remain visually and operationally separated inside the order.
- [x] Customer web, admin panel and shared backend are in the current release.
- [x] Flutter is being delivered separately and is excluded from this release gate.
- [x] No standalone driver application or driver workflow is required.
- [x] This is a single-client bespoke deployment, not a multitenant or licensed product.
- [ ] Remove remaining multitenant identifiers, services, schema fields and seed assumptions without breaking live data.
- [x] Remove any remaining driver package/artifacts and confirm they are excluded from builds.
- [x] Confirm there are no licence, entitlement, reseller or tenant-management screens or APIs.

## Status summary

| Milestone | Gate                                     | Current status       |
| --------- | ---------------------------------------- | -------------------- |
| 0         | Scope and architecture cleanup           | In progress          |
| 1         | Production infrastructure and data       | In progress          |
| 2         | Authentication and customer accounts     | In progress          |
| 3         | Transactional email and notifications    | Not production-ready |
| 4         | Catalogue, media and inventory           | In progress          |
| 5         | Customer storefront                      | In progress          |
| 6         | Checkout, Stripe and order finalisation  | Not production-ready |
| 7         | Orders, fulfilment, invoices and refunds | In progress          |
| 8         | Admin operations and reporting           | In progress          |
| 9         | Security, privacy and compliance         | In progress          |
| 10        | Reliability, monitoring and performance  | Not verified         |
| 11        | UAT and go-live                          | Not started          |

---

## Milestone 0 - Scope and single-client architecture

- [x] Record the combined-cart decision as authoritative.
- [x] Exclude Flutter from the current web/admin release.
- [x] Exclude a standalone driver application and driver-facing UI.
- [x] Remove licence navigation and screens from the admin panel.
- [x] Produce a live-schema inventory of every remaining `tenantId` dependency.
- [x] Create a reversible migration plan that preserves all existing production records.
- [ ] Remove tenant middleware, tenant settings ownership and tenant-specific compound keys.
- [ ] Convert business settings, branding, counters, permissions and audit ownership to single-store records.
- [x] Remove `apps/driver` and all driver build/deployment references.
- [ ] Verify storefront, admin, API, invoices, uploads and reporting after cleanup.

Exit gate: no user-facing or database behaviour depends on tenant selection, licence state or a driver application.

## Milestone 1 - Production infrastructure and live data

- [x] Supabase PostgreSQL is connected and serving live data.
- [x] API, admin and storefront are deployed to Vercel.
- [x] Deployments are connected to the GitHub `main` branch.
- [x] Storefront production `API_BASE_URL` points to the live API.
- [x] Database access uses portable Prisma/PostgreSQL and media uses an S3-compatible storage port; migration to AWS RDS/Aurora and S3 is not blocked by a Supabase SDK dependency.
- [ ] Define and verify production, preview and local environment-variable matrices.
- [ ] Configure custom domains, HTTPS redirects and final CORS origins.
- [ ] Rotate the exposed Supabase database password and update every deployment safely.
- [ ] Rotate production JWT/admin credentials before launch.
- [ ] Remove development/example customer and administrator credentials.
- [ ] Replace/remove seeded fixture media and non-client catalogue records.
- [ ] Verify every migration is applied and capture a schema checksum.
- [ ] Run and document a Supabase backup-and-restore drill.
- [ ] Configure scheduled processing for reservations and retention jobs. Notification events process immediately and have a secured daily retry sweep on Vercel Hobby; use a shorter EventBridge interval after AWS migration.

Exit gate: a clean production deployment can be recreated from Git, migrations and documented secrets, and restored from backup.

## Milestone 2 - Authentication and customer accounts

- [x] Customer registration, login, JWT and refresh-token foundations exist.
- [x] Admin login uses permission-bearing API tokens stored in secure HTTP-only cookies.
- [x] Email-verification and password-reset token models exist.
- [x] Queue and attempt a branded verification email immediately after registration.
- [x] Add a customer-facing verification route and success/expired/resend states.
- [x] Do not expose verification tokens in production API responses.
- [x] Queue and attempt password-reset emails with single-use expiring links.
- [x] Implement refresh-token rotation in the storefront and admin sessions.
- [x] Move storefront authentication away from browser `localStorage` to secure HTTP-only session cookies, with refresh rotation and server-side logout revocation.
- [ ] Configure a real OTP/SMS provider if OTP login remains enabled.
- [ ] Implement the required email fallback when SMS OTP delivery fails.
- [ ] Either wire Google/Apple login end-to-end or hide their settings until credentials are supplied.
- [ ] Verify block/unblock, logout, expiry, replay prevention and account enumeration controls.

Exit gate: a new customer can register, verify, log in, reset a password and maintain a secure session using real messages.

## Milestone 3 - Transactional email and notifications

- [x] Notification templates, queue records, retries, dead-letter states and invoice attachment rendering exist.
- [x] Admin settings support SMTP and Resend credentials.
- [ ] Configure and verify one real production provider: SMTP or Resend.
- [ ] Configure authenticated sender domain, SPF, DKIM and DMARC.
- [x] Replace the development `LOG` provider with a fail-closed production configuration.
- [x] Automatically process notification outbox records after authentication, payment and fulfilment events, with a secured scheduled retry endpoint.
- [x] Generate and queue registration verification and password-reset messages.
- [ ] Send exactly one order confirmation after successful payment finalisation.
- [ ] Attach the generated PDF invoice to the order confirmation.
- [ ] Send packed, dispatched/out-for-delivery, delivered, payment-failed, refund and return updates.
- [ ] Ensure provider failure retries and dead-letters without affecting order completion.
- [ ] Provide searchable delivery logs and a controlled resend action in admin.
- [ ] Complete a real-mailbox deliverability test for each transactional template.

Exit gate: the complete lifecycle reaches a real mailbox automatically and is traceable in the admin delivery log.

## Milestone 4 - Catalogue, media and inventory

- [x] Product, category, brand, variant, inventory and bulk-import APIs exist.
- [x] Featured and gallery image upload APIs exist.
- [x] Product listings can display uploaded live media.
- [x] Variant-owned inventory and inventory ledgers exist.
- [x] Fix and verify Add Product from the deployed admin panel; successful creation persists product, gallery media and opening stock, while duplicate SKU/slug submissions return a visible conflict message.
- [x] Implement edit-product featured/gallery media upload, replacement ordering and deletion controls.
- [x] Implement variant create, edit and safe delete/deactivate controls with independent SKU and price; stock remains variant-owned.
- [ ] Verify initial stock and subsequent stock adjustments from product edit and inventory screens.
- [ ] Replace archive wording/actions with the agreed delete/deactivate behaviour and safe dependency errors.
- [ ] Finish separate category and brand pages with image upload/edit/delete.
- [ ] Add server-side pagination, search, sorting and filters to every catalogue table.
- [x] Add authenticated server-side pagination, search, sorting and status filters to the product catalogue table.
- [x] Add authenticated server-side pagination and search to the inventory table.
- [ ] Verify CSV/XLSX dry-run, error report, atomic import and image handling from the UI.
- [ ] Remove remaining fixture/demo catalogue values and broken relative image URLs.

Exit gate: an administrator can create a complete product with media, variants and stock, and it appears correctly on the storefront without database intervention.

## Milestone 5 - Customer storefront

- [x] Storefront is deployed and connected to the live API.
- [x] Home page currently renders live categories, products, prices and uploaded media.
- [x] Core home, listing, product, basket, checkout, account and confirmation routes exist.
- [ ] Complete the supplied Angadi/Figma visual treatment consistently at desktop, tablet and mobile sizes.
- [ ] Verify search, autocomplete, category, brand, price, dietary, stock, offer and alcohol filters.
- [ ] Verify product gallery, variants, stock state, reviews and related products.
- [ ] Verify basket add/update/remove, saved-for-later, coupons and authoritative totals.
- [ ] Complete authenticated and guest checkout journeys with address and delivery-slot selection.
- [ ] Implement complete loading, empty, validation, provider-error and retry states.
- [ ] Verify account profile, addresses, wishlist, reviews, orders, tracking, returns and invoice downloads.
- [ ] Complete SEO metadata, canonical links, structured data, sitemap and age-gated indexing rules.
- [ ] Pass responsive, keyboard, screen-reader and zero serious/critical accessibility checks.

Exit gate: every customer journey works against production-like data with no mock copy, dead action or broken responsive layout.

## Milestone 6 - Checkout, Stripe and order finalisation

- [x] Server-authoritative pricing, delivery, coupons, VAT and stock reservations exist.
- [x] Payment-intent, webhook, idempotency and order-finalisation services exist.
- [ ] Configure production/test Stripe keys and webhook signing secret in Vercel.
- [ ] Replace the current payment-intent-only button with Stripe Payment Element/Checkout UI.
- [ ] Complete 3D Secure, processing, failure, cancellation and retry experiences.
- [ ] Do not show “order confirmed” until a signed webhook finalises the order.
- [ ] Automatically process persisted Stripe webhook jobs.
- [ ] Verify one cart creates exactly one payment, one order and one invoice.
- [ ] Reconcile displayed basket, checkout, captured payment, order and invoice totals to the penny.
- [ ] Verify Apple Pay/Google Pay only if enabled and supported by the configured Stripe account.
- [ ] Test duplicate webhooks, amount mismatch, stale basket, insufficient stock and reservation expiry.
- [ ] Run real Stripe test-mode journeys for successful card, declined card and 3DS card.

Exit gate: a real Stripe test payment completes end-to-end and produces one correct live order and invoice.

## Milestone 7 - Orders, fulfilment, invoices, returns and refunds

- [x] Order, grouped fulfilment, invoice, returns and refund domain services exist.
- [x] Admin order detail can display grocery and alcohol sections.
- [x] PDF invoice generation and download endpoints exist.
- [ ] Verify administrators can move each fulfilment group through every legal status transition.
- [ ] Prevent and clearly explain every illegal transition.
- [ ] Verify customer order tracking mirrors the administrator’s saved status.
- [ ] Verify invoice customer, merchant, line, VAT, discount, delivery and total data against the order.
- [ ] Verify invoice download and emailed attachment are byte-valid PDFs.
- [ ] Verify partial/full card refund and store-credit flows against Stripe test mode.
- [ ] Verify return approval, rejection, restock and write-off inventory effects.
- [ ] Confirm age-restricted delivery/refusal behaviour without introducing a driver application.

Exit gate: one paid order can be fulfilled, invoiced, returned/refunded and audited completely from the admin and customer interfaces.

## Milestone 8 - Admin operations and reporting

- [x] Admin shell and core operational modules are deployed.
- [x] Products, categories, brands, inventory, promotions, orders, returns, delivery, pricing, customers, reviews, content, reports, roles, settings and audit routes exist.
- [ ] Resolve all create/edit/delete form refreshes, server exceptions and `[object Object]` error messages.
- [ ] Add consistent server-side pagination to every long table.
- [ ] Verify promotions can be created, scheduled, edited, enabled and disabled.
- [ ] Verify coupons, delivery zones/slots/charges, VAT rules and return policies affect runtime behaviour.
- [ ] Complete product-wise, customer-wise, date-wise, category-wise, coupon-wise and order-status reporting.
- [ ] Add CSV export for operational reports where required.
- [ ] Verify customer block/unblock, order history and privacy requests.
- [ ] Verify notification templates, provider settings, delivery logs and resends.
- [ ] Enforce RBAC in both navigation and every API endpoint.
- [ ] Complete keyboard/accessibility and visual regression review at common desktop sizes.

Exit gate: a permitted staff user can run every daily store operation without database or API tooling.

## Milestone 9 - Security, privacy and UK compliance

- [x] Integer money, server-controlled totals, age-gating foundations and audit logging exist.
- [x] Cookie consent, privacy requests and audit APIs exist.
- [ ] Complete an authentication, authorisation and IDOR review across customer and admin APIs.
- [ ] Verify upload validation, stored media headers and malicious-file rejection.
- [ ] Verify Stripe webhook forgery and replay protection in the deployed environment.
- [ ] Apply production CSP, HSTS, secure-cookie and security-header policy to all applications.
- [ ] Complete dependency, secret and vulnerable-package scans with no unresolved high severity issue.
- [ ] Verify GDPR consent, export, deletion/anonymisation and retention automation.
- [ ] Remove or anonymise development personal data before launch.
- [ ] Obtain client/legal approval for alcohol, Challenge 25, returns, privacy, cookies and terms copy.
- [ ] Record client responsibility for premises, alcohol and delivery licensing.

Exit gate: security and compliance reviews are documented, remediated and approved by the responsible client stakeholders.

## Milestone 10 - Reliability, monitoring and performance

- [x] Health, readiness, structured logging and metrics foundations exist.
- [ ] Configure production error monitoring and alert recipients.
- [ ] Configure uptime checks for API, storefront, admin, database and media endpoints.
- [ ] Alert on failed payments, dead-letter notifications, webhook backlog and low stock.
- [ ] Verify Redis failover/degradation behaviour and database connection-pool limits.
- [ ] Verify queue jobs are idempotent across retries and concurrent serverless invocations.
- [ ] Run production-like browse, search, cart and checkout load tests.
- [ ] Establish and meet response-time and error-rate budgets.
- [ ] Rehearse database backup restoration and incident rollback.
- [ ] Document operational runbooks for payment, email, database and deployment incidents.

Exit gate: failures are detected, recoverable and documented before customers report them.

## Milestone 11 - UAT, release and go-live

- [ ] Freeze the OpenAPI contract and regenerate/verify all client types.
- [ ] Pass focused unit, integration, security and end-to-end release suites.
- [ ] Pass storefront and admin accessibility checks.
- [ ] Complete a clean production build from a fresh Git checkout.
- [ ] Complete client UAT for grocery-only, alcohol-only and combined baskets.
- [ ] Complete client UAT for registration, verification, login and password reset.
- [ ] Complete client UAT for payment, order confirmation email, invoice and tracking.
- [ ] Complete client UAT for catalogue, inventory, promotion, fulfilment, return, refund and reporting workflows.
- [ ] Obtain client approval for production data, branding, delivery rules, VAT and legal content.
- [ ] Create a release tag, rollback point and signed go-live record.
- [ ] Perform post-deployment smoke tests and monitor the first live transactions.

Exit gate: every checkbox in this document is complete and the client has signed the UAT record.

## Client/provider inputs required before go-live

- [ ] Final domain and DNS access.
- [ ] Verified sender domain plus SMTP or Resend credentials.
- [ ] Stripe account, API keys and webhook endpoint ownership.
- [ ] SMS provider credentials if OTP/SMS remains in scope.
- [ ] Final logo, store contact details, company number, VAT number and registered address.
- [ ] Final delivery zones, charges, free-delivery thresholds and slot rules.
- [ ] Final return/refund policies and alcohol-specific customer messaging.
- [ ] Named administrator accounts and role assignments.
- [ ] Legal review/approval of terms, privacy, cookies and alcohol compliance content.

## Milestone completion report format

After each milestone, record:

1. Completed checklist items.
2. Files, migrations and deployment identifiers changed.
3. Focused validation performed and results.
4. Live URLs or evidence checked.
5. Outstanding risks, client inputs and rollback notes.
