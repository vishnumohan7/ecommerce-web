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

- [x] Product/category/brand/attribute and variant APIs implemented
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
