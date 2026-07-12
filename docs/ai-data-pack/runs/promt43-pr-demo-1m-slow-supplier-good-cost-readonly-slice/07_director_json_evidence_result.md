# Director JSON Evidence Result

Implemented: yes

Evidence surface:

- Section: `16_operation_capacity`
- Paths:
  - `operation_capacity`
  - `operational_risk_findings`

Evidence row key:

- `slow_supplier_good_cost`

Representative row fields verified by test:

- `finding_label: supplier_has_good_cost_but_slow_reliability`
- `source_collections_or_modules: supplierquotes, purchaseorders, products, inventorysummaries, users`
- `affected_entity_type: product_supplier_pair`
- `supplier_id`
- `supplier_alias`
- `good_or_product_id`
- `good_or_product_alias`
- `current_supplier_cost`
- `prior_supplier_cost`
- `supplier_cost_growth_percent`
- `supplier_cost_advantage_percent`
- `peer_supplier_median_cost`
- `current_lead_time_days_if_available`
- `current_delay_days_if_available`
- `fulfilled_purchase_order_count`
- `delayed_purchase_order_count`
- `stock_on_hand_if_available`
- `data_quality_status`
- `confidence`
- `not_allowed_actions`

Evidence row contains no action payloads:

- No `action_id`
- No provider operation
- No `execute_live`
- No `dry_run`
- No mutation instructions

