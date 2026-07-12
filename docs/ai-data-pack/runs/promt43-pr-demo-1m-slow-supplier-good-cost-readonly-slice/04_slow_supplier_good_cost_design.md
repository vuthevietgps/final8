# Slow Supplier Good Cost Design

Finding key: `slow_supplier_good_cost`

Director row model:

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
- `comparison_period`
- `calculation_method`
- `sample_size`
- `data_quality_status`
- `confidence`
- `blocking_reason_if_any`
- `recommended_advisory_language`
- `not_allowed_actions`

Domain fields emitted when supportable:

- `supplier_id`
- `supplier_alias`
- `good_or_product_id`
- `good_or_product_alias`
- `sku_or_variant_if_available`
- `current_supplier_cost`
- `prior_supplier_cost`
- `supplier_cost_growth_percent`
- `supplier_cost_advantage_percent`
- `peer_supplier_median_cost`
- `peer_supplier_quote_count`
- `currency`
- `current_lead_time_days_if_available`
- `prior_lead_time_days_if_available`
- `lead_time_growth_percent_if_available`
- `current_delay_days_if_available`
- `prior_delay_days_if_available`
- `delay_growth_percent_if_available`
- `fulfilled_purchase_order_count`
- `delayed_purchase_order_count`
- `stock_on_hand_if_available`
- `inventory_avg_cost_if_available`
- `incoming_quantity_if_available`
- `reserved_quantity_if_available`
- `current_sales_or_usage_if_available`
- `prior_sales_or_usage_if_available`
- `margin_or_cogs_impact_if_available`
- `slow_supplier_threshold_source`
- `supplier_cost_threshold_source`
- `comparison_period`

Row creation logic:

1. Build adjacent 30-day current/prior windows ending at report/as-of date.
2. Group `supplierquotes` by product and supplier.
3. Use the latest supplier quote as current supplier cost.
4. Compare current supplier cost against peer latest quote median for the same product and currency.
5. Require current supplier cost to be at least 5 percent below peer median.
6. Map supplier to product through existing quote/product/purchase order fields.
7. Build fulfilled PO stats from `purchaseorders` where supplier/product matches and `receivedDate` falls inside the current window.
8. Require at least one fulfilled PO with `receivedDate` later than `expectedDeliveryDate`.
9. Use `products.estimatedDeliveryDays` when available to strengthen the slow signal; missing threshold downgrades confidence.
10. Emit advisory-only row with explicit missing/weak fields.

Action safety:

`not_allowed_actions = do_not_create_purchase_order; do_not_change_supplier_order; do_not_mutate_inventory; do_not_mutate_stock; do_not_mutate_supplier_cost; do_not_mutate_price; do_not_mutate_cogs; do_not_mutate_orders_or_revenue; do_not_mutate_cashflow; do_not_execute_ads_actions`

