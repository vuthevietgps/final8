# 06 Expected AI Findings Check

The downloaded Director JSON was parsed and searched for the Prompt 28 expected synthetic finding aliases.

Summary: 9 of 12 present.

| Key | Status | Matched pattern |
|---|---|---|
| supplier_cost_up | present | `supplier_cost_up_15_percent_without_matching_dealer_price_update` |
| ad_spend_spike | present | `ad_spend_spike_with_lower_lead_volume` |
| cash_gap | present | `cash_gap_next_7_days_from_agent_receivable_delay` |
| overdue_dealer_receivables | present | `overdue_dealer_receivables_for_high_revenue_agent` |
| low_inventory_best_seller | present | `best_selling_product_low_inventory` |
| labor_overtime_high | present | `labor_overtime_high_without_matching_revenue_growth` |
| negative_margin_product_group | present | `negative_margin_product_group` |
| slow_supplier_good_cost | present | `slow_reliability_supplier_with_good_cost` |
| high_sales_late_payment_agent | missing | none |
| return_rate_above_policy | missing | none |
| google_ads_mapping_gap | present | `ads_account_to_campaign` |
| inventory_movement_gap | missing | none |

Notes:

- The missing three signals exist in seeded local demo collections.
- The current Director JSON export does not surface matching aliases/sections for those three signals.
- No missing finding was marked present without JSON evidence.

