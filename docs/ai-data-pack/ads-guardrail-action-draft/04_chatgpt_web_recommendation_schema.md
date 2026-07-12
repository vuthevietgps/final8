# ChatGPT Web Recommendation Schema

This schema is for advisory drafting only.

Mandatory statement:

```text
This is not executable.
This is not import-ready.
This is not provider mutation.
```

## JSON-Like Output

```json
{
  "recommendation_batch_id": "",
  "guardrail_snapshot_id": "",
  "scope": "advisory_only",
  "non_executable_notice": "This is not executable. This is not import-ready. This is not provider mutation.",
  "created_at": "",
  "source_pack_ids": {
    "director_pack_id": "",
    "marketer_pack_id": ""
  },
  "platform_recommendations": [
    {
      "platform": "facebook",
      "campaign_id": "",
      "campaign_name": "",
      "adset_or_adgroup_id": "",
      "ad_id": "",
      "product_group_id": "",
      "product_variant_ids": [],
      "current_daily_budget": 0,
      "recommended_action": "increase",
      "recommended_daily_budget": 0,
      "budget_delta": 0,
      "budget_delta_pct": 0,
      "reason": "",
      "evidence": {
        "spend": 0,
        "revenue": 0,
        "gross_profit": 0,
        "roas": 0,
        "cpl": 0,
        "cpo": 0,
        "return_rate_pct": 0,
        "cancel_rate_pct": 0,
        "cash_lag_days": 0,
        "data_window": ""
      },
      "guardrail_check": {
        "within_total_budget_cap": true,
        "within_campaign_change_limit": true,
        "risk_threshold_passed": true,
        "data_maturity_ok": true,
        "cash_lag_ok": true,
        "return_cancel_ok": true
      },
      "approval_required": false,
      "approval_reason": "",
      "confidence": "high",
      "missing_data": []
    }
  ],
  "batch_level_warnings": [],
  "forbidden_execution_fields_present": false
}
```

Allowed `recommended_action` values:

```text
increase
decrease
keep
pause
investigate
test
```

Allowed `confidence` values:

```text
high
medium
low
```

## Required Reasoning Rules

- State the data used for each recommendation.
- State budget cap impact.
- State risk threshold result.
- State data maturity status.
- State missing data.
- State approval requirement and reason.
- Avoid exact budget increase if data maturity is `not_ready`.
- Avoid treating GMV as realized cash.
- Avoid provider-specific mutate payloads.
- Avoid delete actions.

## Forbidden Fields

Recommendation output must not include:

- Provider credentials or tokens.
- OpenAI upload metadata.
- `execute`, `dryRun`, `liveExecution`, `validateOnly`, `providerMutation`.
- Provider mutate resource payloads.
- Approval workflow commands.
- ERP import instructions.
- Delete campaign/ad group/ad actions.

## Suggested Human-Readable Sections

ChatGPT Web should include:

1. Executive summary.
2. Data maturity and missing data.
3. Guardrail snapshot summary.
4. Platform recommendations.
5. Approval-required items.
6. Investigations and missing data requests.
7. Non-executable notice.
