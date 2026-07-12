# 07 Expected AI Findings Check

Summary: 9 of 12 expected findings were present in the downloaded Director JSON.

Present:

- `supplier_cost_up`
- `ad_spend_spike`
- `cash_gap`
- `overdue_dealer_receivables`
- `low_inventory_best_seller`
- `labor_overtime_high`
- `negative_margin_product_group`
- `slow_supplier_good_cost`
- `google_ads_mapping_gap`

Missing:

- `high_sales_late_payment_agent`
- `return_rate_above_policy`
- `inventory_movement_gap`

The missing signals exist in seeded local demo collections, but the current Director export does not surface matching aliases or sections for them.

