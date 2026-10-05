# Architecture decisions

## ADR-0001: Combined-cart architecture

Accepted. Grocery and alcohol share one cart, checkout, payment, order and invoice. Category separation is presentational and operational, never transactional.

## ADR-0002: Single-tenant deployable, multi-tenant-ready

Accepted. Production deployments may have one tenant, while every tenant-owned record carries an indexed tenant identifier and data access is tenant-scoped from inception.

## ADR-0003: Integer minor-unit money

Accepted. Money uses `bigint` minor units and an ISO 4217 currency. Floating-point types are forbidden for monetary values.

## ADR-0004: Materialised-path category hierarchy

Accepted. Categories use a canonical materialised `path` plus `parentId`. Product listing and breadcrumb queries can resolve a whole subtree with a prefix query while writes remain simple and auditable. Category moves must update the moved node and descendants in one transaction.

## ADR-0005: Exact decimal ABV

Accepted. Alcohol by volume is not money and is stored as PostgreSQL `DECIMAL(4,2)`. API write DTOs accept ABV as a decimal string, avoiding JavaScript binary floating-point ambiguity. Age restriction remains an independent integer policy field and is never inferred from ABV.
