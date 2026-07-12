# Prompt 32 Result - PR-DEMO-1B-FIX

Status: `completed_12_of_12`

Prompt 32 fixed the three missing demo findings from Prompt 31 and reran the local demo export evidence branch. Only the local Docker demo MongoDB database was used:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

No production/server DB, OpenAI API upload, action import, approval workflow, ads dry-run/live execution, provider mutation, provider validateOnly, new provider adapter, or Phase 3 work was added or executed.

## Fix Summary

Root causes:

- `high_sales_late_payment_agent`: seed data existed in `agentstatements`, but Director export did not surface agent-statement operational risk aliases.
- `return_rate_above_policy`: seed data existed in `returnrequests`, but Director export did not surface return operational risk aliases.
- `inventory_movement_gap`: expected seed link was wrong. Inventory movement rows existed, but all referenced existing purchase orders, so `inventory_movement_without_matching_purchase_order` could not be proven.

Changes:

- Added deterministic demo inventory transactions with dangling purchase-order references and exact expected finding note.
- Added operational risk finding rows to `OperationsCapacityQuery` so Director section `16_operation_capacity` surfaces:
  - `high_sales_late_payment_agent`
  - `return_rate_above_policy_for_single_offer`
  - `inventory_movement_without_matching_purchase_order`
- Added unit coverage for those three operational demo findings.

## Rerun Evidence

- Seed dry-run small: passed.
- Seed apply medium: passed.
- Seed apply medium second run: passed, idempotent reset/reinsert confirmed.
- Director export: passed.
- JSON download and parse: passed.
- Expected findings: 12 of 12 present.

Final export:

| Field | Value |
|---|---|
| job_id | `AIDP-20260614045658-a295d333` |
| export_mode | `partial_export` |
| sync_policy | `sync_if_stale` |
| status | `completed` |
| artifact_id | `6d031b1144ed79478d451ae63a339351` |
| artifact_class | `downloadable_redacted_artifact` |
| artifact_rendering | `rendered` |
| redaction_runtime | `pre_rendered` |
| download_ready | `true` |
| provider_sync_attempted | `false` |
| live_execution | `false` |

## Tests

- `npm test -- --runTestsByPath src/ai-data-pack/demo-seed/director-demo-seed.spec.ts --runInBand`: passed, 5 tests.
- `npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand`: passed, 19 tests.
- `npm run build`: passed.

