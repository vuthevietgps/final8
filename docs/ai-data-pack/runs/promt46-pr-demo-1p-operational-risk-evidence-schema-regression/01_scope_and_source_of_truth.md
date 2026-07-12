# Scope And Source Of Truth

Phase: PR-DEMO-1P

Source of truth used:

- Current repository state.
- Prompt45 test guard already present in `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`.
- Current metadata enum contract in `backend/src/ai-data-pack/contracts/metadata.contract.ts`.
- Current operational evidence implementation in `backend/src/ai-data-pack/queries/operations-capacity.query.ts`.
- Prior run folders through Prompt45 under `docs/ai-data-pack/runs/`.

Hard scope honored:

- Code change limited to the ai-data-pack test/contract area.
- No changes to provider adapters, Google Ads modules, approval workflow, action import, or execution services.
- No changes to business query logic.
- No local or server database operation was needed; the guard uses fake in-memory arrays only.

Explicitly out of scope:

- Action Draft Schema.
- Action import or approval.
- OpenAI calls.
- Provider validateOnly or live execution.
- Dry-run/live execution additions.
- DB migrations or production DB usage.
- Export/download endpoint additions.
