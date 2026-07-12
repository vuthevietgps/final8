STATUS: TEMPLATE_ONLY_NOT_EXECUTED
This file is not rollout evidence until completed by a human/operator and copied to docs/ai-data-pack/rollout-evidence/.

# Completed Smoke/UAT Results Template

Destination filename:

```text
docs/ai-data-pack/rollout-evidence/completed-smoke-uat-results.md
```

## Metadata

| Field | Value |
|---|---|
| Environment |  |
| Release/build identifier |  |
| Test window |  |
| Tester |  |
| Evidence folder |  |

## Test Results

| test_id | actor/cohort | endpoint | expected status | expected response safety | actual status | actual evidence link/path | audit/log reference | pass/fail | tester | timestamp | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| UAT-01 | Director/admin | `POST /ai-data-pack/exports` cached create |  |  |  |  |  |  |  |  |  |
| UAT-02 | Director/admin | `POST /ai-data-pack/exports` official create if allowed |  |  |  |  |  |  |  |  |  |
| UAT-03 | Manager | `POST /ai-data-pack/exports` cached/partial create |  |  |  |  |  |  |  |  |  |
| UAT-04 | Manager | Official create denied |  |  |  |  |  |  |  |  |  |
| UAT-05 | Investor status-only | Status/detail/sync-summary |  |  |  |  |  |  |  |  |  |
| UAT-06 | Unbound role | Any public export endpoint |  |  |  |  |  |  |  |  |  |
| UAT-07 | `system_internal_worker` | Any human public endpoint |  |  |  |  |  |  |  |  |  |
| UAT-08 | Unassigned reviewer | Status/detail/sync-summary |  |  |  |  |  |  |  |  |  |
| UAT-09 | Authorized reader | Status/detail redaction |  |  |  |  |  |  |  |  |  |
| UAT-10 | Authorized without audit read | Detail without audit escalation |  |  |  |  |  |  |  |  |  |
| UAT-11 | Director/admin vs manager/investor | Sync-summary privileged only |  |  |  |  |  |  |  |  |  |
| UAT-12 | Same actor | Idempotency duplicate |  |  |  |  |  |  |  |  |  |
| UAT-13 | Controlled test user | Rate-limit observable |  |  |  |  |  |  |  |  |  |
| UAT-14 | Any denied/jobless case | Denied/jobless audit |  |  |  |  |  |  |  |  |  |
| UAT-15 | Any allowed and denied request | Structured log emitted |  |  |  |  |  |  |  |  |  |

## Forbidden Surface Confirmation

Confirm no test required or observed:

```text
download=
artifact_bytes=
public_url_or_storage_path=
openai_upload=
action_import=
approval_dry_run_live=
provider_mutation=
provider_validate_only=
phase_3=
```

## Final Smoke/UAT Decision

```text
smoke_uat_passed=
failed_tests=
not_applicable_tests_with_owner_approval=
decision_owner=
decision_timestamp=
```
