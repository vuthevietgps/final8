# Schema Guard Inventory

Target collection: `operational_risk_findings`

Targeted findings:

- `low_inventory_best_seller`
- `supplier_cost_up`
- `overdue_dealer_receivables`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Canonical fields guarded on every targeted emitted row:

- `finding_key`
- `finding_label`
- `evidence_strength`
- `source_domain`
- `source_collections_or_modules`
- `time_window`
- `affected_entity_type`
- `affected_entity_id`
- `affected_entity_name_or_alias`
- `metric_name`
- `metric_value`
- `threshold_value`
- `calculation_method`
- `sample_size`
- `data_quality_status`
- `confidence`
- `recommended_advisory_language`
- `not_allowed_actions`

The guard asserts each canonical field exists and has a non-null, non-empty evidence value.

Finding-specific minimum evidence groups:

- `low_inventory_best_seller`: product identity, inventory/on-hand, sales velocity or bestseller rank, available/projected stock context.
- `supplier_cost_up`: supplier identity, product identity, current supplier cost, prior supplier cost, increase/growth metric.
- `overdue_dealer_receivables`: dealer/agent identity, due date, days overdue or aging bucket, overdue/outstanding balance.
- `labor_overtime_high`: labor group identity, current overtime, prior overtime, revenue growth, labor/overtime growth.
- `slow_supplier_good_cost`: supplier id, product id, current supplier cost, peer comparison, cost advantage, delay signal.
