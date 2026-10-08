# Single-store database migration plan

Last audited: 2026-10-08

This deployment is a bespoke Denes Commerce installation. Runtime tenant selection, tenant administration, commercial licensing, reseller features and a driver application are outside scope.

## Live inventory

- The database contains 79 tables with a `tenantId` column.
- The primary store is `00000000-0000-4000-8000-000000000001` (`default`, Denes Commerce).
- One historical test store exists: `10000000-0000-4000-8000-000000000001` (`constraint-test`).
- Live catalogue, inventory, customers, orders, invoices, refunds, content and notification records are owned only by the primary store.
- Only `AuditLog`, `SearchSynonym` and `TaxRule` contain rows for both identifiers.
- The API does not accept a tenant identifier from a request. Middleware always resolves the configured primary store.
- The commercial licence tables and runtime module were removed by migration `20261007000200_remove_licensing`.
- Driver tables and roles were removed by migrations `20261006000900_remove_driver_functionality` and `20261006001100_remove_driver_role`.
- No tracked driver application source remains in the workspace.

## Safe migration sequence

1. Put catalogue and order administration into a short maintenance window.
2. Take a provider backup and a separate logical export of every row owned by both store identifiers.
3. Record row counts and checksums for products, variants, inventory, orders, order items, invoices, refunds, users and media.
4. Export the `constraint-test` rows from `AuditLog`, `SearchSynonym` and `TaxRule`, then remove only records whose `tenantId` exactly matches the test UUID.
5. Assert that every remaining non-null `tenantId` equals the primary-store UUID. Abort if any other identifier exists.
6. Replace `TenantSettings` with a singleton `StoreSettings` record and `Tenant`/branding ownership with singleton store configuration.
7. Remove tenant lookup middleware and change the request context to store/request identity only.
8. In dependency order, replace tenant compound uniqueness constraints with equivalent single-store constraints, then remove `tenantId` columns and tenant RLS policies.
9. Regenerate Prisma, compile the API, apply the migration to a restored copy first, and compare the recorded checksums.
10. Verify login, catalogue/media, inventory, basket pricing, checkout, orders, invoices, fulfilment, refunds, notification settings, audit logs and reports before applying to production.

## Rollback

- Do not apply the destructive schema phase without the provider backup and logical export.
- If any assertion or checksum differs, roll back the release and restore the pre-migration database snapshot.
- Keep the existing single-store discriminator until the restored-copy rehearsal passes. It is internal and cannot be selected by clients, so retaining it temporarily is safer than risking live commerce records.

## Acceptance gate

- Exactly one store configuration exists.
- No runtime API or UI accepts or exposes tenant selection.
- No `Tenant`, `TenantSettings`, `tenantId`, tenant RLS policy, licence or driver tables remain.
- All pre-migration business-record counts and monetary totals match after migration.
