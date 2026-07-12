# Prompt 39 - PR-DEMO-1I

Status: `implemented_partial_read_only_upgrade`

This run implements the approved partial read-only upgrade for the existing `low_inventory_best_seller` Director JSON evidence row.

Output root:

```text
docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade/
```

Implemented:

- `reserved_quantity_candidate`
- `incoming_stock_quantity_candidate`
- `available_quantity = max(0, onHand - reserved_quantity_candidate)`
- `projected_available_quantity`
- `projected_days_of_cover`
- status inclusion/exclusion evidence
- data-quality notes that keep the row partial/advisory-only

No Action Draft Schema, action import, OpenAI API call, provider execution/mutation/validateOnly, DB migration, inventory mutation, purchase/replenishment action, or new export/download behavior was added.

