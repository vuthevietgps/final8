# Director JSON Evidence Result

Implementation result:

```text
evidence_row_present: true
director_section: 16_operation_capacity
```

The evidence row is produced by `OperationsCapacityQuery.get()` and included in:

- `operation_capacity`
- `operational_risk_findings`

`DirectorDataPackService` maps `operations.operation_capacity` into Director JSON section:

```text
16_operation_capacity
```

Representative evidence row shape from the passing test:

```json
{
  "status": "risk_signal",
  "finding_key": "low_inventory_best_seller",
  "finding_label": "best_selling_product_low_inventory",
  "evidence_strength": "medium",
  "source_domain": "inventory",
  "source_collections_or_modules": "inventorysummaries, products, ordertest2",
  "affected_entity_type": "product_or_sku",
  "affected_entity_id": "product-1",
  "sku": "BS-001",
  "bestseller_rank": 1,
  "current_inventory_quantity": 6,
  "reserved_quantity": null,
  "available_quantity": 6,
  "reorder_threshold": 10,
  "incoming_stock_quantity": null,
  "recent_order_count": 5,
  "recent_order_quantity": 50,
  "sales_velocity_per_day": 10,
  "days_of_cover": 0.6,
  "metric_name": "days_of_cover",
  "data_quality_status": "partial",
  "confidence": "medium",
  "not_allowed_actions": "do_not_create_purchase_order; do_not_mutate_inventory; do_not_execute_replenishment"
}
```

No action payload is present.

No provider payload is present.

No purchase/replenishment command is present.

