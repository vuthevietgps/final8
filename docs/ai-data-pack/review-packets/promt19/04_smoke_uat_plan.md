# Smoke And UAT Plan

Main document:

- `docs/ai-data-pack/rollout/public-create-status-smoke-uat-plan.md`

Smoke tests cover:

- Director cached create.
- Director official create in controlled environment.
- Manager cached/partial create.
- Manager official create denied.
- Investor status-only behavior.
- Unbound role denied.
- System worker denied.
- Unassigned reviewer denied/no job leak.
- Status response redacted and manifest-only.
- Detail response redacted with no audit escalation unless permitted.
- Sync-summary privileged only.
- Idempotency duplicate returns same summary.
- Rate-limit threshold observable.
- Audit record for denied/jobless/rate-limited attempt.
- Structured log emitted.

Each smoke test defines:

- Precondition.
- Request.
- Expected status.
- Expected safe response.
- Expected audit/log evidence.
- Pass/fail note.

No smoke test requires download, artifact bytes, action import, live execution, provider mutation, provider validateOnly, OpenAI upload, or Phase 3 behavior.
