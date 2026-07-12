# Public Create/Status Smoke/UAT Execution Worksheet

Phase: `PR-2.3B-4I`

No test case may require download, artifact bytes, public URL, OpenAI upload, action import, dry-run/live execution, provider mutation, or provider validateOnly.

## Execution Metadata

| Field | Value |
|---|---|
| Environment |  |
| Release candidate identifier |  |
| Test window |  |
| Tester |  |
| Evidence folder/link |  |

## Test Cases

| test_id | actor/cohort | endpoint | precondition | request summary | expected status | expected response safety | expected audit/log evidence | actual status | actual evidence link/path | pass/fail | tester | timestamp | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UAT-01 | Director/admin | `POST /ai-data-pack/exports` | Director/admin has cached create and compatible profile. | Cached export create with valid dates, packs, formats, idempotency key. | 2xx or accepted job status. | Redacted manifest-only summary; no token, bytes, URL, storage path, provider payload, or execution action. | `export_create_requested`, `export_create_accepted`, bounded create log. |  |  |  |  |  |  |
| UAT-02 | Director/admin | `POST /ai-data-pack/exports` | Official create allowed in controlled environment. | Official export create. | 2xx, blocked, or completed-with-warnings according to data gates. | Redacted manifest-only summary; no provider direct call/mutation exposure. | Create audit events and bounded logs. |  |  |  |  |  |  |
| UAT-03 | Manager | `POST /ai-data-pack/exports` | Manager has manager-marketer profile. | Cached and partial export create. | 2xx if policy-compatible. | Manager-safe redacted summary; no finance/employee/supplier/PII leak. | Accepted audit/log. |  |  |  |  |  |  |
| UAT-04 | Manager | `POST /ai-data-pack/exports` | Manager has no official create permission. | Official export create. | 403 or generic denial. | Generic denial; no job/source/storage/action data. | Denied audit/log. |  |  |  |  |  |  |
| UAT-05 | Investor status-only | Status/detail/sync-summary | Investor has status read and investor-redacted profile. | Status request, then detail and sync-summary request. | Status allowed if policy-compatible; detail/sync denied. | Status redacted/manifest-only; detail and sync generic denied. | Status viewed audit; detail/sync denied audit/log. |  |  |  |  |  |  |
| UAT-06 | Unbound role | Any public export endpoint | User has no export permissions. | Create/status/detail/sync-summary attempts. | Denied. | No job existence leak or source/storage/action detail. | Denied audit/log. |  |  |  |  |  |  |
| UAT-07 | `system_internal_worker` | Any human public endpoint | User/profile is system worker. | Create/status/detail/sync-summary attempts. | Denied. | Generic denial. | Denied audit/log. |  |  |  |  |  |  |
| UAT-08 | Unassigned reviewer | Status/detail/sync-summary | Reviewer has no assignment. | Existing job id and nonexistent job id. | Same public denial shape where required. | No job existence distinction. | Denied audit/log for both attempts. |  |  |  |  |  |  |
| UAT-09 | Authorized reader | Status/detail | Readable job exists. | Status then detail. | 2xx if readable. | `responseRedaction` present; manifest-only; no forbidden fields. | Status/detail viewed audit/log. |  |  |  |  |  |  |
| UAT-10 | Authorized without audit read | Detail | User has status read but no audit read. | Detail request. | 2xx if readable. | No audit summary escalation. | Detail viewed audit/log. |  |  |  |  |  |  |
| UAT-11 | Director/admin vs manager/investor | Sync-summary | Official/partial job exists. | Sync-summary request as director/admin, manager, investor. | Director/admin allowed; manager/investor denied. | Sanitized sync summary only; no raw provider payload/account topology. | Viewed/denied audit/log. |  |  |  |  |  |  |
| UAT-12 | Same actor | `POST /ai-data-pack/exports` | Same request and idempotency key used twice. | Duplicate create request. | Same accepted summary or expected idempotency response. | Same redacted job summary; no second lifecycle. | `idempotent_request_reused` audit/log. |  |  |  |  |  |  |
| UAT-13 | Controlled test user | Create/status/sync-summary | Safe threshold or repeated calls approved. | Repeat requests until threshold. | 429 or rate-limited denial when threshold reached. | Generic response; no internals. | `rate_limited` audit/log. |  |  |  |  |  |  |
| UAT-14 | Any denied/jobless case | Unknown job or denied create | Endpoint audit persistence enabled. | Denied/jobless request. | Denied. | Generic denial. | Persistent endpoint audit record id/path. |  |  |  |  |  |  |
| UAT-15 | Any allowed and denied request | Logs available. | Run one allowed and one denied request. | Expected status from each. | Response safe. | Bounded metric-name signal in logs. |  |  |  |  |  |  |

## Worksheet Completion Rule

Controlled rollout execution cannot proceed unless all blocking smoke/UAT cases selected for the rollout cohort pass or are explicitly marked not applicable with owner approval.
