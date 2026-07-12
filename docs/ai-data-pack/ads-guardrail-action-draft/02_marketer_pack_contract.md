# Marketer Pack Contract

The Marketer Pack Contract is the evidence layer for ads recommendation drafts. It inherits a Director Guardrail Snapshot by `guardrail_snapshot_id`.

## Supported Platforms

```text
google
facebook/meta
tiktok
other
```

Platform support in this phase is schema/spec support only. No provider API mutation is allowed.

## Required Entities

| Entity | Required evidence |
| --- | --- |
| `platform` | Platform id, account id/name, data freshness, source confidence. |
| `campaign` | Campaign id/name/status/current budget/spend/revenue/profit/guardrail mapping. |
| `adset/adgroup` | Platform child entity id/name/status/budget/spend/performance/mapping. |
| `ad` | Ad id/status/creative linkage/performance where available. |
| `creative` | Creative group, asset id/name, message/offer version, product group mapping. |
| `product_group` | Product group id/name, margin, return/cancel, cash lag, budget share. |
| `product_variant` | Variant id/name, cost, price, margin, supplier pool, return/cancel, cash lag. |
| `lead` | Lead count, qualified lead count, stage movement, CPL, source mapping. |
| `order` | Order count, revenue, COD/deposit, status, cancel, return, fulfillment lag. |
| `profit` | Gross profit, estimated net profit, realized net profit, confidence. |
| `return/cancel` | Return count/rate, cancel count/rate, reason quality, refund/error cost. |
| `cash_lag` | Days to supplier confirmation, commission receipt, COD/cash realization. |
| `current_budget` | Current daily budget and schedule source. |
| `spend` | Spend by period and freshness. |
| `revenue` | Revenue/GMV with source and whether estimated/realized. |
| `gross_profit` | Gross profit by campaign/adset/product where mapping supports it. |
| `roas` | ROAS by platform entity where revenue mapping supports it. |
| `cpa/cpl/cpo` | CPA, CPL, CPO if available. |
| `guardrail_snapshot_id` | Required id linking to Director Guardrail Contract. |

## Canonical JSON Shape

```json
{
  "marketer_pack_id": "",
  "created_at": "",
  "report_window": {
    "from": "",
    "to": ""
  },
  "guardrail_snapshot_id": "",
  "platforms": [
    {
      "platform": "google",
      "account_id": "",
      "account_name": "",
      "data_freshness": {
        "last_successful_sync_at": "",
        "freshness_status": "fresh",
        "can_use_for_decision": true
      },
      "campaigns": []
    }
  ],
  "product_groups": [],
  "product_variants": [],
  "lead_funnel": [],
  "orders": [],
  "profitability": [],
  "returns_cancels": [],
  "cash_lag": [],
  "mapping_quality": {},
  "data_quality": {}
}
```

## Campaign Evidence Shape

```json
{
  "platform": "facebook",
  "campaign_id": "",
  "campaign_name": "",
  "adset_or_adgroup_id": "",
  "ad_id": "",
  "creative_id": "",
  "product_group_id": "",
  "product_variant_ids": [],
  "current_daily_budget": 0,
  "spend": 0,
  "revenue": 0,
  "gross_profit": 0,
  "estimated_net_profit": 0,
  "realized_net_profit": 0,
  "roas": 0,
  "cpl": 0,
  "cpa": 0,
  "cpo": 0,
  "lead_count": 0,
  "qualified_lead_count": 0,
  "order_count": 0,
  "return_rate_pct": 0,
  "cancel_rate_pct": 0,
  "cash_lag_days": 0,
  "mapping_confidence": 0,
  "data_maturity_status": "ready"
}
```

## Contract Rules

- Do not treat GMV as cash available.
- Distinguish estimated profit from realized profit.
- Distinguish expected, confirmed, and received supplier commission when present.
- Do not recommend scale when ads attribution or profit mapping is weak unless the action is explicitly marked investigate/test with low or medium confidence.
- If a creative group maps to multiple product variants, variant economics must be evaluated separately before scale.
- Recommendations must be advisory only and must not contain provider mutate payloads.
