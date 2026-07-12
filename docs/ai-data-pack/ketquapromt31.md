# Prompt 31 Result - PR-DEMO-1B-RERUN

Status: `completed_with_expected_finding_gaps`

Prompt 31 was rerun against a local Docker MongoDB demo database only. The repo `.env` MongoDB target was inspected without printing secrets and rejected for this run because the database name was `htxbachgia`, which is not a throwaway/dev/test/demo name. The applied target was `mongodb://127.0.0.1:27018/aidp_demo_20260614` on local Docker container `erpdropshiping-mongodb-test`.

## Completed

- Safe DB check passed for local Docker demo DB.
- Dry-run baseline passed with profile `small`.
- Medium seed apply executed against local demo DB.
- Medium apply was run a second time; deterministic delete-and-reinsert behavior was confirmed and counts did not double.
- Director JSON export was executed through the existing export job lifecycle using `partial_export`, `sync_if_stale`, `director_redacted`.
- Direct authenticated artifact download succeeded.
- Downloaded JSON parsed successfully.
- Response leak checks passed: no storage path, public URL, or download token was exposed in public export responses.
- Downloaded JSON checks passed for raw provider payload and credential/token absence.
- Expected AI findings were checked against the parsed downloaded JSON.

## Key Evidence

- Export job: `AIDP-20260614042421-7ac17e6d`
- Export mode: `partial_export`
- Status: `completed`
- Artifact: `e01a501d836577c026075f9937ef81ff`
- Artifact class: `downloadable_redacted_artifact`
- Redaction runtime: `pre_rendered`
- Artifact rendering: `rendered`
- Download ready: `true`
- Provider sync attempted: `false`
- Live execution: `false`

## Expected Findings

9 of 12 expected synthetic findings were present in the downloaded Director JSON.

Missing from the downloaded Director JSON:

- `high_sales_late_payment_agent`
- `return_rate_above_policy`
- `inventory_movement_gap`

These signals exist in seeded demo collections, but the current Director export surface does not expose matching aliases/sections for them.

## Files

Detailed evidence is under:

- `docs/ai-data-pack/demo-data-export-evidence-rerun/`
- `docs/ai-data-pack/review-packets/promt31/`
- `docs/ai-data-pack/ketquapromt31.json`

