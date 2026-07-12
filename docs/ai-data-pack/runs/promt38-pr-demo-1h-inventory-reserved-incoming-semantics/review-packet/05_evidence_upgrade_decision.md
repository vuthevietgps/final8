# Evidence Upgrade Decision

Decision:

```text
ready_for_partial_upgrade_only
```

Allowed in a later prompt:

- derive `reserved_quantity_candidate`
- derive `incoming_stock_quantity_candidate`
- calculate `available_quantity = max(0, onHand - reserved_quantity_candidate)`
- calculate `projected_available_quantity = max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)`
- keep `data_quality_status: partial`
- keep confidence medium at most

Not allowed:

- evidence strength strong
- action payload
- purchase/replenishment action
- inventory mutation
- provider mutation

