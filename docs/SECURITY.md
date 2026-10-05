# Security

## Trust boundaries

The API is authoritative for price, tax, discounts, eligibility, stock, totals, and age status. A global pipe rejects server-owned fields rather than silently discarding them. Every tenant-owned query goes through the tenant-scoped database boundary and PostgreSQL RLS supplies defence in depth.

Authentication uses Argon2id with at least 19,456 KiB memory, two iterations, and one lane. Access tokens expire after 15 minutes. Refresh tokens are random, stored only as SHA-256 digests, rotate on use, and belong to a family. Reuse revokes the whole family and creates an audit record. Email verification and password-reset tokens are single-use; password-reset tokens expire after 30 minutes.

Identity-document images and document numbers must never be stored. Age-verification records contain outcomes and provider references only. Driver handover images must depict the handover location, never an identity document.

## HTTP controls

- Helmet security headers and an explicit CORS allowlist are applied globally.
- Authentication, OTP, password reset, registration, and guest-checkout routes use Redis rate limits and Turnstile where declared.
- Cookies use `httpOnly`, `secure`, `sameSite=lax`, and the `__Host-` prefix when issued in production.
- Error responses use stable codes and never include stack traces, SQL, or driver errors.
- Every response has a request identifier.

## Logging

Structured logs include request, tenant, user, route, duration, and status. Serialiser-level redaction covers passwords, tokens, OTPs, authorisation and cookie headers, card data, date of birth, document numbers, and provider client secrets.

## Secrets

Secrets are supplied through environment variables or a documented secrets manager. Licence validation is offline Ed25519 verification; no private licence-signing key belongs in this repository.
