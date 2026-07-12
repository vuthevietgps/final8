# Review Summary

Prompt 38 status:

```text
inventory_semantics_spec_completed
```

Core decisions:

- reserved quantity: `reserved_quantity_derivable_with_caution`
- incoming stock: `incoming_stock_derivable_with_caution`
- evidence upgrade: `ready_for_partial_upgrade_only`

Recommended future formula:

```text
available_quantity = max(0, onHand - reserved_quantity_candidate)
days_of_cover = available_quantity / sales_velocity_per_day
```

No code or DB/API/action changes were made.

