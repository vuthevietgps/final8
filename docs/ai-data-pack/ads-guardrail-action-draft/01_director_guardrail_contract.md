# Director Guardrail Contract

The Director Guardrail Contract is a read-only snapshot exported from Director Pack context. Marketer Pack and ChatGPT Web may reference it, but must not mutate it.

## Required Fields

```json
{
  "guardrail_snapshot_id": "grs_20260614_001",
  "created_at": "2026-06-14T00:00:00.000Z",
  "valid_from": "2026-06-14T00:00:00.000Z",
  "valid_to": "2026-06-15T00:00:00.000Z",
  "finance_mode": "cash_preserve",
  "budget_cap": {
    "daily_total_max": 0,
    "weekly_total_max": 0,
    "monthly_total_max": 0,
    "per_campaign_increase_max_pct_without_approval": 0,
    "per_campaign_decrease_max_pct_without_approval": 0,
    "max_budget_share_per_product_group_pct": 0
  },
  "risk_thresholds": {
    "min_roas": 0,
    "min_gross_margin_pct": 0,
    "max_return_rate_pct": 0,
    "max_cancel_rate_pct": 0,
    "max_cash_lag_days": 0,
    "max_debt_overdue_days": 0
  },
  "product_guardrails": [],
  "supplier_guardrails": [],
  "campaign_guardrails": [],
  "data_maturity": {}
}
```

## Finance Mode

Allowed values:

- `cash_preserve`: protect cash. Default action bias is keep, decrease, pause, or investigate. Any increase usually requires approval.
- `balanced`: allow limited increases inside caps and risk thresholds.
- `growth`: allow controlled increases when profit, cash lag, and return/cancel data are ready.
- `aggressive`: allow larger advisory increases, but still require explicit approval when caps or risk flags trigger.

Finance mode is advisory context, not execution permission.

## Budget Cap Semantics

| Field | Meaning | Approval trigger |
| --- | --- | --- |
| `daily_total_max` | Maximum total daily ads budget after proposed changes. | Required if recommendation exceeds the cap. |
| `weekly_total_max` | Maximum total weekly budget after proposed changes. | Required if weekly projection exceeds the cap. |
| `monthly_total_max` | Maximum total monthly budget after proposed changes. | Required if monthly projection exceeds the cap. |
| `per_campaign_increase_max_pct_without_approval` | Maximum per-campaign increase allowed without director approval. | Required if increase delta percent is higher. |
| `per_campaign_decrease_max_pct_without_approval` | Maximum per-campaign decrease allowed without director approval when the campaign is material. | Required if decrease could materially harm revenue/profit. |
| `max_budget_share_per_product_group_pct` | Maximum share of total budget allocated to one product group. | Required if product group concentration exceeds cap. |

## Risk Threshold Semantics

| Field | Meaning |
| --- | --- |
| `min_roas` | Minimum acceptable ROAS for scale recommendations. |
| `min_gross_margin_pct` | Minimum gross margin needed before budget increase. |
| `max_return_rate_pct` | Maximum return rate before scale is blocked or approval-required. |
| `max_cancel_rate_pct` | Maximum cancel rate before scale is blocked or approval-required. |
| `max_cash_lag_days` | Maximum days between ad spend/order and realized cash/commission. |
| `max_debt_overdue_days` | Maximum overdue debt pressure before finance mode should become cautious/cash-preserve. |

## Product Guardrails

```json
{
  "product_group_id": "",
  "product_variant_id": "",
  "name": "",
  "protected": false,
  "scale_allowed": true,
  "pause_allowed_without_approval": false,
  "max_daily_budget": 0,
  "max_budget_share_pct": 0,
  "min_margin_pct": 0,
  "max_return_rate_pct": 0,
  "max_cash_lag_days": 0,
  "risk_flags": [],
  "notes": ""
}
```

Product guardrails must distinguish product group and product variant. A shared creative group can contain variants with different cost, margin, and cash-lag behavior.

## Supplier Guardrails

```json
{
  "supplier_id": "",
  "supplier_name": "",
  "affected_product_group_ids": [],
  "allocation_allowed": true,
  "scale_allowed": true,
  "max_allocation_pct": 0,
  "max_payout_delay_days": 0,
  "max_return_rate_pct": 0,
  "settlement_quality_status": "ready",
  "risk_flags": [],
  "notes": ""
}
```

Weak supplier performance should not automatically kill a product market. The correct recommendation may be supplier sourcing, supplier allocation reduction, or supplier replacement test.

## Campaign Guardrails

```json
{
  "platform": "google",
  "campaign_id": "",
  "campaign_name": "",
  "protected": false,
  "pause_allowed_without_approval": false,
  "scale_allowed": true,
  "max_daily_budget": 0,
  "max_increase_pct_without_approval": 0,
  "max_decrease_pct_without_approval": 0,
  "mapped_product_group_ids": [],
  "risk_flags": [],
  "notes": ""
}
```

Campaign-level guardrails override generic budget caps when stricter.

## Data Maturity

Required shape:

```json
{
  "revenue_data_ready": true,
  "profit_data_ready": true,
  "cash_lag_data_ready": true,
  "ads_attribution_ready": true,
  "return_cancel_data_ready": true,
  "overall_status": "ready",
  "blocking_reasons": [],
  "warnings": [],
  "source_freshness": []
}
```

Allowed `overall_status` values:

- `ready`: recommendations may include specific budget numbers if risk and finance rules also pass.
- `partial_ready`: recommendations may include cautious numbers, lower confidence, or approval requirements.
- `not_ready`: recommendations must avoid firm budget change claims and prefer investigate/request missing data.

## Contract Rules

- Snapshot ids are immutable for one recommendation batch.
- Expired snapshots must not be used for new recommendation batches.
- Missing guardrail snapshot means recommendation confidence is low and ERP future validation must reject import if import ever exists.
- Guardrails restrict recommendations; they do not grant execution authority.
