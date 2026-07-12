# Scope And Source Of Truth

Prompt 39 targets only the existing read-only evidence row:

```text
low_inventory_best_seller
```

Immediate source of truth:

```text
docs/ai-data-pack/runs/promt38-pr-demo-1h-inventory-reserved-incoming-semantics/
```

Prompt 38 facts preserved:

- `status`: `inventory_semantics_spec_completed`
- `reserved_quantity_decision`: `reserved_quantity_derivable_with_caution`
- `incoming_stock_decision`: `incoming_stock_derivable_with_caution`
- `available_quantity` formula: `max(0, onHand - reserved_quantity_candidate)`
- `projected_available_quantity` formula: `max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)`
- `evidence_upgrade_decision`: `ready_for_partial_upgrade_only`
- Action Draft Schema, provider execution/mutation, OpenAI API upload, and Phase 3 remain parked

Prompt 37 baseline preserved:

- `low_inventory_best_seller` read-only evidence row exists
- Director section: `16_operation_capacity`
- evidence remains `data_quality_status: partial`
- confidence remains `medium`

Prompt 39 only changes read-only evidence generation and focused tests.

