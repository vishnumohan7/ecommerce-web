# Storefront API readiness

Audited: 2026-11-02

## Current release position

The customer/storefront HTTP surface is implemented for catalogue browsing, search, age gating,
guest and authenticated baskets, authoritative pricing, delivery selection, Stripe checkout, customer
accounts, orders, invoices, returns, notifications and privacy requests.

Stripe is the confirmed production payment route. The Payment Element, signed webhook finalisation,
order creation and processing state are implemented. Launch still requires client-owned keys and
live Stripe test-mode acceptance scenarios. COD remains a safe configuration fallback until all
three Stripe keys are installed together.

The readiness contract now checks PostgreSQL, the database-backed media table and Redis. It no longer
requires an obsolete MinIO endpoint. The updated `/ready` response must be verified after deployment;
a failure then identifies a real database/schema or queue dependency problem.

## Production blockers outside route implementation

- Configure Stripe keys and verify success, decline, 3DS, cancellation and webhook replay scenarios.
- Verify registration, password-reset, order-confirmation/invoice, fulfilment, return and refund email
  templates against a real mailbox, including provider retry and dead-letter handling.
- Configure a production age-verification provider if alcohol checkout requires digital verification;
  the `STUB` provider must not be used for a production decision.
- Complete deployed guest and authenticated end-to-end checkout tests, including stale stock,
  insufficient stock, expired reservations and duplicate submissions.
- Complete customer/admin IDOR, accessibility, security-header and responsive acceptance checks.
- Rotate exposed or shared production credentials and remove disposable test accounts before launch.

## Postman assets

- `docs/postman/Denes_Storefront_API.postman_collection.json`
- `docs/postman/Denes_Storefront_Production.postman_environment.json`

Import both files, select the storefront environment, replace the tester credentials, and run folders
in numeric order. Postman retains the guest basket and age-gate cookies in its cookie jar. Requests
that require a customer session use the access token captured by **Customer login**.

The API currently has Vercel Deployment Protection enabled. Set `vercelProtectionBypass` in the
Postman environment to a valid project bypass token, or disable protection for the production API.
Without this, Postman receives a Vercel HTML authentication page instead of API JSON.

The collection deliberately excludes admin/staff endpoints, Stripe and age-provider webhooks, and
notification scheduler endpoints. Destructive requests such as account erasure are clearly labelled
and should only be run with a disposable tester account.
