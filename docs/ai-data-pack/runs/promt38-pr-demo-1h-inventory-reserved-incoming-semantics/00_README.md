# Prompt 38 - PR-DEMO-1H

Status: `inventory_semantics_spec_completed`

This run defines read-only inventory semantics for the existing `low_inventory_best_seller` evidence slice.

Output root:

```text
docs/ai-data-pack/runs/promt38-pr-demo-1h-inventory-reserved-incoming-semantics/
```

Mode:

```text
no-code semantics/spec only
```

Scope:

- `reserved_quantity`
- `incoming_stock_quantity`
- `available_quantity`
- `days_of_cover` confidence upgrade/downgrade

Implementation decision for the next prompt:

```text
ready_for_partial_upgrade_only
```

No backend source code, query implementation, seed data, DB migration, export behavior, provider path, action workflow, or inventory/purchase mutation was added in Prompt 38.

