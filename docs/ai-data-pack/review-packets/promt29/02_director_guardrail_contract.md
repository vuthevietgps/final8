# Director Guardrail Contract Review

Spec file: `docs/ai-data-pack/ads-guardrail-action-draft/01_director_guardrail_contract.md`.

Completed fields:

- `guardrail_snapshot_id`
- `created_at`
- `valid_from`
- `valid_to`
- `finance_mode`
- `budget_cap.daily_total_max`
- `budget_cap.weekly_total_max`
- `budget_cap.monthly_total_max`
- `budget_cap.per_campaign_increase_max_pct_without_approval`
- `budget_cap.per_campaign_decrease_max_pct_without_approval`
- `budget_cap.max_budget_share_per_product_group_pct`
- `risk_thresholds.min_roas`
- `risk_thresholds.min_gross_margin_pct`
- `risk_thresholds.max_return_rate_pct`
- `risk_thresholds.max_cancel_rate_pct`
- `risk_thresholds.max_cash_lag_days`
- `risk_thresholds.max_debt_overdue_days`
- `product_guardrails[]`
- `supplier_guardrails[]`
- `campaign_guardrails[]`
- `data_maturity`

Data maturity includes:

- `revenue_data_ready`
- `profit_data_ready`
- `cash_lag_data_ready`
- `ads_attribution_ready`
- `return_cancel_data_ready`
- `overall_status = ready | partial_ready | not_ready`

Decision: complete for PR-2.4A.
