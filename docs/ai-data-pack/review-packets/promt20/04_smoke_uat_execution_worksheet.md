# Smoke/UAT Execution Worksheet

Main document:

- `docs/ai-data-pack/rollout-execution/public-create-status-smoke-uat-execution-worksheet.md`

Required test cases included:

- Director cached create.
- Director official create if allowed in controlled environment.
- Manager cached/partial create.
- Manager official create denied.
- Investor status-only.
- Unbound denied.
- System worker denied.
- Unassigned reviewer denied/no leak.
- Redacted status/detail.
- Privileged sync-summary.
- Idempotency duplicate.
- Rate-limit observable.
- Jobless denied audit.
- Structured log emitted.

Each test case has fillable fields:

- `test_id`
- actor/cohort
- endpoint
- precondition
- request summary
- expected status
- expected response safety
- expected audit/log evidence
- actual status
- actual evidence link/path
- pass/fail
- tester
- timestamp
- notes

No test case requires download, artifact bytes, public URL, OpenAI upload, action import, dry-run/live, provider mutation, or provider validateOnly.
