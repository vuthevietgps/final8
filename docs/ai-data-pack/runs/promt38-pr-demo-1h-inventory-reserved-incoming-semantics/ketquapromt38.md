# Ket Qua Prompt 38

Status:

```text
inventory_semantics_spec_completed
```

Output root:

```text
docs/ai-data-pack/runs/promt38-pr-demo-1h-inventory-reserved-incoming-semantics
```

Target finding:

```text
low_inventory_best_seller
```

Reserved quantity decision:

```text
reserved_quantity_derivable_with_caution
```

Incoming stock decision:

```text
incoming_stock_derivable_with_caution
```

Available quantity recommended formula:

```text
available_quantity = max(0, inventorysummaries.onHand - reserved_quantity_candidate)
```

Days of cover recommended formula:

```text
days_of_cover = available_quantity / sales_velocity_per_day
```

Evidence upgrade decision:

```text
ready_for_partial_upgrade_only
```

Prompt 38 changed docs only. No code, DB migration, seed generation, OpenAI/API/provider/action path, export/download behavior, inventory mutation, or purchase/replenishment action was added.

