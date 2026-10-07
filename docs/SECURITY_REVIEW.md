# Security review

Reviewed 2026-10-06. Controls present: Argon2id passwords, short access tokens, rotating hashed refresh tokens, server-side RBAC, tenant scoping plus PostgreSQL RLS, mass-assignment rejection, signed age-gate state, verified Stripe webhooks, upload size/type controls, rate limits, structured redaction, Ed25519 licence validation, HttpOnly admin session cookies, and immutable audit events.

No card data or identity-document images are stored. URL-bearing CMS fields must remain restricted to trusted administrators and an allow-list should be configured before remote image ingestion. Production must use unique secrets, HTTPS/HSTS, a strict CORS allow-list, Turnstile, provider webhook secrets, dependency/secret scanning, and restricted Supabase credentials.

Residual deployment checks: external penetration test, CSP report-only observation before enforcement, restore drill against an isolated database, and provider-specific webhook replay testing.
