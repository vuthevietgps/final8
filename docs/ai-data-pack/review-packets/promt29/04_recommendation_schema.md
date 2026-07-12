# Recommendation Schema Review

Spec file: `docs/ai-data-pack/ads-guardrail-action-draft/04_chatgpt_web_recommendation_schema.md`.

Required schema shape is included with:

- `recommendation_batch_id`
- `guardrail_snapshot_id`
- `scope=advisory_only`
- `platform_recommendations[]`
- `recommended_action = increase | decrease | keep | pause | investigate | test`
- `current_daily_budget`
- `recommended_daily_budget`
- `budget_delta`
- `budget_delta_pct`
- `guardrail_check`
- `approval_required`
- `approval_reason`
- `confidence = high | medium | low`
- `missing_data[]`

Mandatory notices:

```text
This is not executable.
This is not import-ready.
This is not provider mutation.
```

Decision: complete for PR-2.4A.
