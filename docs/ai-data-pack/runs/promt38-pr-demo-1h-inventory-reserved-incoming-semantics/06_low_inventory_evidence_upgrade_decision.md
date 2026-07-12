# Low Inventory Evidence Upgrade Decision

Decision:

```text
ready_for_partial_upgrade_only
```

Reason:

- Reserved quantity can be derived with caution from active non-final/non-payment/non-return orders.
- Incoming stock can be derived with caution from unreceived quantities on `ordered` and `partially_received` purchase orders.
- Neither is canonical enough for a strong replenishment conclusion.

What can be upgraded next:

- add `reserved_quantity_candidate`
- add `reserved_quantity_source`
- add `incoming_stock_quantity_candidate`
- add `incoming_stock_source`
- replace immediate `available_quantity` formula with `onHand - reserved_quantity_candidate`
- add separate `projected_available_quantity`
- add separate `projected_days_of_cover`
- add status/data-quality warnings for ambiguous order and PO statuses

What must not be upgraded yet:

- evidence strength to `strong`
- automatic purchase/replenishment recommendation
- action draft generation
- inventory mutation
- purchase order mutation
- provider/action/live execution

Required confidence:

```text
data_quality_status: partial
confidence: medium at most
```

The next prompt may implement this as a read-only partial upgrade only.

