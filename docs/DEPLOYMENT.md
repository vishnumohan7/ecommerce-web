# Deployment

1. Copy `.env.example`, configure unique secrets and Supabase transaction/session pooler URLs.
2. Run `pnpm install --frozen-lockfile && pnpm setup`.
3. Deploy API, storefront and admin behind HTTPS; restrict admin network access where practical.
4. Configure Stripe, email, SMS, storage, Turnstile, Sentry and DNS secrets in the platform secret manager.
5. Freeze OpenAPI with `pnpm openapi:freeze`, smoke health/storefront/admin, then run backup/restore and k6 against staging.

Dependencies remain on the external project volume; no global installation is required.
