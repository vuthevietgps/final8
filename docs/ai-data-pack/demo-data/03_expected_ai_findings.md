# Expected AI Findings

The demo seed intentionally creates patterns that a Director AI Data Pack reviewer should be able to reason about. These are synthetic and deterministic, not real business findings.

Expected finding labels:

1. `supplier_cost_up_15_percent_without_matching_dealer_price_update`
2. `ad_spend_spike_with_lower_lead_volume`
3. `cash_gap_next_7_days_from_agent_receivable_delay`
4. `overdue_dealer_receivables_for_high_revenue_agent`
5. `best_selling_product_low_inventory`
6. `labor_overtime_high_without_matching_revenue_growth`
7. `negative_margin_product_group`
8. `slow_reliability_supplier_with_good_cost`
9. `high_sales_late_payment_agent`
10. `return_rate_above_policy_for_single_offer`
11. `google_ads_cost_present_without_campaign_name_mapping`
12. `inventory_movement_without_matching_purchase_order`

## Coverage

- Supplier performance: supplier quotes, payables, statements, purchase order delay patterns.
- Dealer/agent performance: quotes, agent statements, order volume, late receivables.
- Product profitability: product cost, order revenue, shipping, packaging, ad cost, returns.
- Inventory: inbound/outbound movements, low-stock best sellers, summaries.
- Labor: payroll and overtime rows tied to production/order signals.
- Finance: cashflow entries, fund snapshots, loans, repayments, finance alert events.
- Marketing: legacy ad costs, read-only Google Ads metrics, campaigns, ad groups, keywords, ads, sync run freshness.
- Customer and lead funnel: marketing leads, customers, repurchase timing.

## Non-Goals

- No Performance Max, Shopping, Display, YouTube, or auto-publish fixture.
- No campaign/ad group deletion actions.
- No action execution, approval, provider validation, or Google Ads mutate call.
- No upload to ChatGPT/OpenAI.
