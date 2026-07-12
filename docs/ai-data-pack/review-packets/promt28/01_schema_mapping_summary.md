# Schema Mapping Summary

Detailed mapping: `docs/ai-data-pack/demo-data/01_schema_mapping.md`.

High-level domains covered:

- Suppliers and dealer/agent quotes.
- Product groups, products, stock, and purchase orders.
- Sales orders, customers, returns, COD/deposit, supplier and agent payment state.
- Inventory movement and inventory summaries.
- Finance cashflow, fund snapshots, budget buckets, loans, repayments, finance alerts, and settings.
- Labor entries and labor statements.
- Legacy ad account/ad group cost rows.
- Read-only Google Ads campaigns, ad groups, keywords, ads, daily metrics, and sync run rows.
- Marketing leads and lead funnel rows.

Marker strategy:

- Deterministic ObjectIds derived from collection name and index.
- `DEMO_AIDP28` prefix on names, emails, SKUs, codes, references, notes, or setting keys where available.
- Redacted non-secret placeholders in token-like fields required by existing schemas.

The seed does not depend on tenant fields because the inspected schemas do not expose a consistent tenant id across the covered collections.
