# Upgrading

Back up the database, read release notes, install with the locked pnpm version, run `pnpm db:migrate:deploy`, regenerate Prisma, build, and smoke `/health`, `/ready`, storefront checkout and admin order detail. Migrations are forward-only; restore the pre-upgrade backup if rollback is required.
