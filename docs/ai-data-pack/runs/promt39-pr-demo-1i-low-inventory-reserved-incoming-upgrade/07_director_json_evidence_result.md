# Director JSON Evidence Result

Director surface:

```text
16_operation_capacity
```

Query output paths:

- `operation_capacity`
- `operational_risk_findings`

Representative evidence row:

```json
{
  "finding_key": "low_inventory_best_seller",
  "finding_label": "best_selling_product_low_inventory",
  "evidence_strength": "medium",
  "source_collections_or_modules": "inventorysummaries, products, ordertest2, purchaseorders, deliverystatuses",
  "affected_entity_id": "product-1",
  "sku": "BS-001",
  "current_inventory_quantity": 12,
  "reserved_quantity_candidate": 4,
  "incoming_stock_quantity_candidate": 12,
  "available_quantity": 8,
  "projected_available_quantity": 20,
  "sales_velocity_per_day": 2.4,
  "days_of_cover": 3.33,
  "projected_days_of_cover": 8.33,
  "data_quality_status": "partial",
  "confidence": "medium",
  "not_allowed_actions": "do_not_create_purchase_order; do_not_mutate_inventory; do_not_execute_replenishment"
}
```

The row does not include:

- action id
- action payload
- provider operation
- approval state transition
- dry-run/live field
- mutation command
- purchase order command
- inventory command

