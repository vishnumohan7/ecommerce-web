# Storefront API readiness

Audited: 2026-10-19

## Current release position

The customer/storefront HTTP surface is implemented for catalogue browsing, search, age gating,
guest and authenticated baskets, authoritative pricing, delivery selection, COD checkout, customer
accounts, orders, invoices, returns, notifications and privacy requests.

COD is the supported payment route for the current test release. Stripe endpoints exist but are not
a production-ready payment journey until client-owned Stripe keys, webhook signing, Payment Element
UI and live Stripe test-mode acceptance scenarios are completed.

The protected production deployment returned `{"status":"ok"}` from `/health` during this audit.
`/ready` returned HTTP 503 because at least one declared dependency (Redis or the configured storage
health endpoint) was unavailable. Production readiness remains blocked until this check is green or
the dependency contract is deliberately revised to match the deployed database-backed media design.

## Production blockers outside route implementation

- Configure Stripe and verify success, decline, 3DS, cancellation and webhook replay scenarios, or
  formally launch COD-only with card payment hidden.
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

The collection deliberately excludes admin/staff endpoints, Stripe and age-provider webhooks, and
notification scheduler endpoints. Destructive requests such as account erasure are clearly labelled
and should only be run with a disposable tester account.
