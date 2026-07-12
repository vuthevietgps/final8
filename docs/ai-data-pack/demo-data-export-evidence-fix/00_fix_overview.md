# Prompt 32 Fix Overview

Phase: `PR-DEMO-1B-FIX`

Status: `completed_12_of_12`

Prompt 32 fixed and documented the three Prompt 31 demo findings that were missing from the Director JSON export:

- `high_sales_late_payment_agent`
- `return_rate_above_policy`
- `inventory_movement_gap`

The rerun used only the local Docker demo MongoDB database:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

No production/server database was used. No OpenAI upload/API call, action import, approval workflow, ads dry-run/live execution, provider mutation, provider validateOnly, new provider adapter, or Phase 3 work was added.

## Result

The Director partial export completed, the artifact downloaded and parsed as JSON, and all expected demo findings were present.

| Metric | Result |
|---|---|
| Missing findings before Prompt 32 | `3` |
| Missing findings after Prompt 32 | `0` |
| Expected findings present | `12` |
| Expected findings total | `12` |
| Director export executed | `true` |
| Director JSON downloaded | `true` |
| Downloaded JSON parseable | `true` |

## Changed Areas

- Demo seed mapping: `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts`
- Director query surface: `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- Unit coverage: `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- Evidence and review docs under `docs/ai-data-pack/`

