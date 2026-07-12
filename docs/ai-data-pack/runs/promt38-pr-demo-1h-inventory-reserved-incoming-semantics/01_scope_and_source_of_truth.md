# Scope And Source Of Truth

Prompt 38 only defines inventory semantics for the existing `low_inventory_best_seller` read-only evidence slice.

Immediate source of truth:

```text
docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice/
```

Prompt 37 accepted facts preserved:

- `phase`: `PR-DEMO-1G`
- `status`: `implemented_read_only_slice`
- target finding: `low_inventory_best_seller`
- Director section: `16_operation_capacity`
- evidence row present: true
- `data_quality_status`: `partial`
- `confidence`: `medium`
- tests/build/static checks passed
- no Action Draft Schema
- no action import
- no OpenAI API
- no provider mutation/validateOnly/live path
- no Phase 3
- no production DB
- no DB migration
- no inventory or purchase mutation

Prompt 37 blockers carried forward:

- `reserved_quantity` is not mapped
- `incoming_stock_quantity` is not mapped
- `available_quantity` is provisional because it uses `inventorysummaries.onHand`
- `inventorybatches.quantityRemaining` exists but was not used because incoming-stock semantics were not established

Prompt 38 output is a BA/data contract. It authorizes no code implementation.

