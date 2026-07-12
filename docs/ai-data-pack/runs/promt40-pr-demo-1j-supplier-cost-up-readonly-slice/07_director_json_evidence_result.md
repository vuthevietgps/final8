# Director JSON Evidence Result

Implemented evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

The row shape includes:

```json
{
  "status": "risk_signal",
  "finding_key": "supplier_cost_up",
  "finding_label": "supplier_cost_up_15_percent_without_matching_dealer_price_update",
  "source_domain": "supplier_pricing",
  "source_collections_or_modules": "supplierquotes, products, quotes",
  "affected_entity_type": "product_supplier_pair",
  "metric_name": "cost_increase_percent",
  "threshold_value": "15_percent",
  "data_quality_status": "partial",
  "not_allowed_actions": "do_not_change_prices; do_not_create_supplier_actions; do_not_mutate_dealer_prices; do_not_create_purchase_order; do_not_execute_ads_actions"
}
```

Test-proven sample facts:

- `current_supplier_cost_or_quote: 120`
- `prior_supplier_cost_or_quote: 100`
- `cost_increase_percent: 20`
- `dealer_price_current_or_latest: 150`
- `dealer_price_prior_or_effective: 140`
- `dealer_price_update_lag_days: 21`
- `dealer_price_history_status: older_than_supplier_cost_increase`
- `confidence: medium`

No action payloads are present. The row is advisory-only evidence for Director/ChatGPT Web reading.

