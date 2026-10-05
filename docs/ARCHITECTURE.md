# Architecture

This repository is a pnpm/Turborepo monorepo containing four deployable applications and shared packages. The REST API owns business authority. Browser applications consume versioned contracts and branding tokens.

## Non-goals

- This is not a warehouse management system; pick/pack is a lightweight workflow.
- This is not a route optimisation engine; routing is an adapter boundary.
- This is not an ERP or accounting system; invoices can be exported.
- This is not a marketplace; each tenant has one merchant.
- Alcohol duty is assumed to be included in supplier cost price and is not calculated.
