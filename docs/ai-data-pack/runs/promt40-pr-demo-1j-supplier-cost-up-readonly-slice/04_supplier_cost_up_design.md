# Supplier Cost Up Design

Director JSON evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

Collection inputs:

- `supplierquotes`
- `products`
- `quotes`

Canonical fields implemented where applicable:

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

Domain fields implemented:

- `supplier_id_or_alias`
- `product_id`
- `sku`
- `current_supplier_cost_or_quote`
- `prior_supplier_cost_or_quote`
- `cost_increase_percent`
- `cost_threshold_percent`
- `dealer_price_current_or_latest`
- `dealer_price_prior_or_effective`
- `dealer_price_update_lag_days`
- `supplier_quote_effective_date`
- `product_cost_effective_date`
- `dealer_price_effective_date`
- `supplier_quote_approval_status`
- `dealer_price_approval_status`

Row creation logic:

1. Group supplier quotes by `productId::supplierId`.
2. Require mapped product, current quote, prior quote, positive prices, and supplier quote effective dates.
3. Calculate `(current - prior) / prior * 100`.
4. Emit a row only when cost increase is greater than `15%`.
5. Join dealer quotes by product.
6. Treat the dealer update as unmatched when latest dealer quote date is missing or older than the current supplier quote date.
7. Skip row when a dealer quote effective date is current/newer than supplier cost increase.
8. Downgrade confidence when dealer price history, effective dates, or approval status is missing.

Action safety:

```text
not_allowed_actions = do_not_change_prices; do_not_create_supplier_actions; do_not_mutate_dealer_prices; do_not_create_purchase_order; do_not_execute_ads_actions
```

