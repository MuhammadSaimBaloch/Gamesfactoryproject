# Database and inventory

## Tables

| Table                | Purpose                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| products             | Product metadata, platform/category, publish/demo/featured flags and SEO                                                              |
| product_variants     | Separate SKU, name, attributes, integer PKR prices and availability                                                                   |
| product_images       | R2 key, product/optional variant association, alt text and image metadata                                                             |
| categories           | Unique category slugs and active state                                                                                                |
| branches             | Known branch names with initially blank owner-confirmed details                                                                       |
| inventory            | Available quantity per unique variant/branch pair                                                                                     |
| orders               | Unique server number, idempotency key/hash, customer snapshot, fulfillment, monetary totals, status and WhatsApp destination snapshot |
| order_items          | Immutable product/variant/SKU/price/quantity/total snapshots                                                                          |
| order_status_history | Actor, transition, time and internal notes                                                                                            |
| stock_allocations    | Order-to-branch-stock allocation ledger                                                                                               |
| shipping_rates       | Named location rules, integer fee, active state                                                                                       |
| homepage_sections    | Section title/subtitle/order/enabled flags                                                                                            |
| site_settings        | Editable owner-approved public business content                                                                                       |
| admin_audit_logs     | Who changed which entity; no customer data in audit metadata                                                                          |
| rate_limits          | Short-lived hashed-IP rate counters                                                                                                   |
| product_search       | FTS5 index synchronized with product changes                                                                                          |

Foreign keys protect relationships. Product/variant identifiers in order items are snapshots rather than mutable joins, so historical orders survive catalogue changes. Orders cascade deletion to their items, history and allocation records. Only completed/cancelled orders are deletable through administration.

## Invariants

- Currency is PKR, integer whole rupees. No floating-point currency calculation.
- Variant prices and shipping fees cannot be negative.
- Inventory cannot become negative; variant/branch pairs are unique.
- Every item has positive quantity and `line_total = unit_price × quantity`.
- `order_total = subtotal + shipping`.
- Order numbers and request keys are unique.
- Catalogue indexes cover active/category/platform and variant product lookup; order indexes cover status/date and item order ID.

## Inventory policy

The public request checks current availability but does not reserve stock. For pickup, all lines must be available at the chosen enabled branch. For delivery, each individual line must be fulfillable from one active branch; different lines may use different branches. This intentionally avoids splitting one line across branches.

On `CONTACTED → CONFIRMED`, a SQLite trigger checks active product/variant/branch records, selects a qualifying branch for each line, creates allocation records and decrements inventory in the same statement transaction. Concurrent confirmations cannot oversell. Any failure rolls back the complete confirmation. On cancellation from a stock-allocated state, the trigger restores quantities and deletes allocations once. Dispatched orders cannot be cancelled through this first-release flow; returns need staff handling outside the order machine.

## Status machine

```text
AWAITING_WHATSAPP_MESSAGE → CONTACTED → CONFIRMED → PAYMENT_PENDING → PAID → DISPATCHED → COMPLETED
                                      └────────────→ PAID ──────────────────→ COMPLETED
```

Cancellation is allowed before dispatch/completion. Terminal states cannot be reopened. Both service validation and a database trigger reject invalid transitions. Opening WhatsApp never changes status automatically.

## Migrations

`0000_superb_pyro.sql` is generated by Drizzle. `0001_order_stock_guards.sql` contains reviewed stock/state triggers. `0002_store_defaults_and_search.sql` inserts only verified branch names, empty settings and FTS structures. Keep custom migrations when generating schema changes; inspect generated SQL before applying it.

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The last command is development-only. Production receives migrations, never demo seed data. Back up before remote migrations. See DEPLOYMENT.md for D1 export/restore procedures and independent environment configuration.

## Storefront expansion (18 October 2026)

Migrations 0004–0007 add customers, hashed one-use tokens and sessions, owned addresses, explicit customer-order associations, product details and quote-only pricing, contact/pre-order inquiries, newsletter consent/confirmation state, scheduled promotions and encrypted digital deliveries. Runtime access for these tables uses prepared D1 statements; relationships and deletion behavior are enforced by the migration SQL. Digital fulfillment extends the existing atomic inventory trigger. See PRODUCTION_SETUP.md for ownership boundaries, secret configuration, retention and deliberate owner-data/catalogue imports.
