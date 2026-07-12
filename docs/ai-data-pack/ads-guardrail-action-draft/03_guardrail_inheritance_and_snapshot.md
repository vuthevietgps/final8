# Guardrail Inheritance And Snapshot

Guardrails flow from Director Pack to Marketer Pack as an immutable snapshot.

## Inheritance Flow

```text
Director Pack source data
-> finance/risk/data maturity calculation
-> Director Guardrail Snapshot
-> Marketer Pack includes guardrail_snapshot_id
-> ChatGPT Web uses snapshot to produce advisory draft
-> ERP future validation gate checks snapshot id and caps
```

## Snapshot Rules

- `guardrail_snapshot_id` is required in Marketer Pack and recommendation output.
- Snapshot must include `created_at`, `valid_from`, and `valid_to`.
- Recommendations created after `valid_to` must be downgraded to low confidence and require fresh export.
- A recommendation batch must not mix multiple guardrail snapshots unless it is explicitly split into separate batches.
- Snapshot values must be copied into the recommendation context as evidence, not reinterpreted from free text.

## Override Precedence

Most restrictive rule wins:

```text
campaign_guardrail
-> product_guardrail
-> supplier_guardrail
-> budget_cap
-> risk_thresholds
-> finance_mode default posture
```

Examples:

- If finance mode is `growth` but a product guardrail blocks scale, ChatGPT Web must not recommend scale for that product without approval/investigation.
- If campaign cap allows increase but daily total cap is exceeded, approval is required.
- If product market is strong but supplier is flagged, recommendation should prefer supplier sourcing/allocation review over killing the product.

## Snapshot Integrity Fields

Recommended future validation fields:

```json
{
  "guardrail_snapshot_id": "",
  "snapshot_checksum": "",
  "snapshot_source_export_job_id": "",
  "created_at": "",
  "valid_from": "",
  "valid_to": "",
  "source_pack_type": "director",
  "source_pack_version": "",
  "data_maturity_overall_status": "ready"
}
```

## Data Maturity Inheritance

Data maturity must be inherited into recommendation reasoning:

- `ready`: budget recommendations may include exact numbers when budget/risk rules pass.
- `partial_ready`: recommendations may include limited numbers but should record missing data and often require approval.
- `not_ready`: recommendation should be investigate/request missing data. Budget increase should be blocked or approval-required.

## Stale Or Missing Snapshot Behavior

| Condition | Expected ChatGPT Web behavior | Future ERP validation behavior |
| --- | --- | --- |
| Snapshot id missing | Low confidence, advisory-only, no numeric scale. | Reject if import ever exists. |
| Snapshot expired | Request fresh export. | Reject if import ever exists. |
| Snapshot checksum mismatch | Do not trust guardrail context. | Reject if import ever exists. |
| Snapshot data maturity `not_ready` | Investigate/request missing data. | Reject budget increase if import ever exists. |
| Snapshot has risk flags | Explain flags and require approval where applicable. | Validate approval flag and reason if import ever exists. |
