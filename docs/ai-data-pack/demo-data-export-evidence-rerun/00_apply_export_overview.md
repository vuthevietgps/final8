# 00 Apply Export Overview

Phase: `PR-DEMO-1B-RERUN`

Status: `completed_with_expected_finding_gaps`

This rerun used local Docker MongoDB demo data only. The real/server database was not used. No production DB, provider API, OpenAI API, action import, approval workflow, dry-run/live ads execution, provider mutation, or provider validateOnly path was added or executed.

Completed sequence:

1. Safe DB check.
2. Dry-run baseline with profile `small`.
3. Apply profile `medium` to local Docker demo DB.
4. Run the same apply command again for idempotency.
5. Export Director JSON through export-job lifecycle.
6. Download and parse the JSON artifact.
7. Check 12 expected AI findings against the parsed JSON.

Final Director export job:

| Field | Value |
|---|---|
| job_id | `AIDP-20260614042421-7ac17e6d` |
| export_mode | `partial_export` |
| sync_policy | `sync_if_stale` |
| status | `completed` |
| artifact_id | `e01a501d836577c026075f9937ef81ff` |
| redaction_profile | `director_redacted` |
| artifact_class | `downloadable_redacted_artifact` |
| download_ready | `true` |
| provider_sync_attempted | `false` |
| live_execution | `false` |

Expected findings result: 9 of 12 present.

