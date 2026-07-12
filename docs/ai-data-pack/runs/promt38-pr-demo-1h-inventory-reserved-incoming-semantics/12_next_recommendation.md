# Next Recommendation

Next recommended prompt:

```text
Implement partial read-only upgrade for low_inventory_best_seller using derived reserved and incoming candidates.
```

Allowed next slice, if explicitly authorized:

- add `reserved_quantity_candidate` from active non-final/non-payment/non-return order rows
- add `incoming_stock_quantity_candidate` from ordered/partially received PO unreceived quantity
- recalculate immediate `available_quantity = max(0, onHand - reserved_quantity_candidate)`
- add separate projected fields with incoming stock
- keep `data_quality_status: partial`
- keep `confidence: medium` at most
- add negative tests for ambiguous statuses and excluded PO statuses

Keep parked:

- Action Draft Schema
- action import
- OpenAI API upload
- provider execution/mutation/validateOnly
- Phase 3
- inventory mutation
- purchase/replenishment action

