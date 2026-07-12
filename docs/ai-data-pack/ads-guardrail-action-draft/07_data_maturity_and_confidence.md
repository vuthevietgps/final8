# Data Maturity And Confidence

Data maturity controls whether ChatGPT Web may make firm numeric recommendations.

## Required Data Maturity Fields

```json
{
  "revenue_data_ready": true,
  "profit_data_ready": true,
  "cash_lag_data_ready": true,
  "ads_attribution_ready": true,
  "return_cancel_data_ready": true,
  "overall_status": "ready"
}
```

Allowed `overall_status` values:

- `ready`
- `partial_ready`
- `not_ready`

## Readiness Rules

| Field | Ready means | Not ready means |
| --- | --- | --- |
| `revenue_data_ready` | Revenue/GMV and source are current and mapped. | Do not claim revenue impact strongly. |
| `profit_data_ready` | Gross/estimated/realized profit has source and mapping. | Do not scale based only on spend/revenue. |
| `cash_lag_data_ready` | Cash realization or supplier commission lag is available. | Do not claim scale is cash-safe. |
| `ads_attribution_ready` | Campaign/adset/adgroup/ad maps to leads/orders/profit with sufficient confidence. | Avoid entity-level budget changes; request mapping fix. |
| `return_cancel_data_ready` | Return/cancel rates and reason quality are sufficient. | Do not blame product/supplier strongly; avoid scale. |

## Confidence Rules

High confidence requires:

- Data maturity `ready`.
- Guardrail snapshot valid.
- Ads data fresh.
- Mapping confidence above threshold.
- Profit and cash-lag evidence available.
- Return/cancel evidence available.
- Sample size sufficient.

Medium confidence applies when:

- Data maturity is `partial_ready`.
- Some missing fields exist but core performance and guardrails are usable.
- Sample size is moderate.
- Recommendation is cautious or investigative.

Low confidence applies when:

- Data maturity is `not_ready`.
- Guardrail snapshot is missing/expired.
- Attribution, profit, cash-lag, or return/cancel data is missing.
- Data is stale.
- Sample size is too small for budget change.

## Recommendation Restrictions By Maturity

| Overall status | Allowed recommendation posture |
| --- | --- |
| `ready` | Numeric budget draft allowed when caps and risk thresholds pass. |
| `partial_ready` | Small test/keep/investigate preferred; numeric scale often approval-required. |
| `not_ready` | Request missing data/investigate; no firm budget increase. |

## Missing Data Format

```json
{
  "missing_data": [
    {
      "field": "cash_lag_days",
      "impact": "Cannot confirm if scale is cash-safe.",
      "recommended_fix": "Refresh supplier settlement and cashflow mapping."
    }
  ]
}
```
