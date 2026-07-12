# Public Create/Status Smoke And UAT Plan

Phase: `PR-2.3B-4H`

No test in this plan may require download, artifact bytes, action import, live execution, OpenAI upload, provider mutation, provider validateOnly, or Phase 3 behavior.

## Smoke Test Table

| ID | Scenario | Precondition | Request | Expected status | Expected safe response | Expected audit/log evidence | Pass/fail note |
|---|---|---|---|---|---|---|---|
| S01 | Director cached create | Director/admin token with cached create and profile permission. | `POST /ai-data-pack/exports` with `cached_export`, valid dates, packs, formats, profile, idempotency key. | 2xx or accepted job status according to implementation. | Redacted manifest-only job summary; no token, bytes, URL, storage path, provider payload, or execution action. | `export_create_requested`, `export_create_accepted`, create requested/accepted log. | Pass only if no forbidden fields appear. |
| S02 | Director official create | Controlled environment permits official create; director/admin token. | `POST /ai-data-pack/exports` with `official_export`. | 2xx, blocked, or completed-with-warnings according to source gates; not provider mutation. | Redacted manifest-only summary; source warnings sanitized. | Create audit events and bounded logs. | Pass only if lifecycle remains internal and no provider direct call is exposed. |
| S03 | Manager cached/partial create | Manager token with manager-marketer profile. | `POST /ai-data-pack/exports` with `cached_export` and `partial_export`. | 2xx if policy-compatible. | Redacted manager-safe summary. | Accepted audit/log. | Pass only if no finance/employee/supplier/PII sections leak. |
| S04 | Manager official create denied | Manager token. | `POST /ai-data-pack/exports` with `official_export`. | 403 or generic denial. | Generic denial; no job detail/source/storage/action data. | Denied audit with internal reason, bounded denied log. | Pass only if official create is denied. |
| S05 | Investor status-only behavior | Investor token and readable redacted own job. | `GET /ai-data-pack/exports/:jobId/status`, then detail and sync-summary. | Status allowed if policy-compatible; detail/sync-summary denied. | Status is redacted/manifest-only; detail and sync-summary generic denied. | Status viewed audit; detail/sync denied audit/log. | Pass only if investor remains status-only. |
| S06 | Unbound role denied | Employee/agent/supplier/lender token without explicit safe permissions. | Any public export endpoint. | 403 or generic 404-style denial. | No job existence leak, no source/storage/action data. | Denied audit/log. | Pass only if fail-closed. |
| S07 | System worker denied | User/profile `system_internal_worker`. | Any public human endpoint. | Denied. | Generic denial. | Denied audit/log. | Pass only if human public surface is denied. |
| S08 | Unassigned reviewer denied/no job leak | Reviewer without assignment. | Status/detail/sync-summary for existing and nonexistent job ids. | Same public denial shape where policy requires. | No job existence distinction. | Denied audit/log. | Pass only if existing/nonexistent are indistinguishable. |
| S09 | Status response redacted | Authorized readable job. | `GET /ai-data-pack/exports/:jobId/status`. | 2xx. | `responseRedaction` present; manifest-only; no forbidden fields. | `export_status_viewed`, status read log. | Pass only if redaction is explicit. |
| S10 | Detail no audit escalation | User has status read but not audit read. | `GET /ai-data-pack/exports/:jobId`. | 2xx if readable. | Redacted detail without audit summary escalation. | `export_detail_viewed`; no audit detail exposure. | Pass only if audit requires audit permission. |
| S11 | Sync-summary privileged only | Director/admin with sync-detail, then manager/investor. | `GET /ai-data-pack/exports/:jobId/sync-summary`. | Director/admin allowed for official/partial; manager/investor denied. | Sanitized sync summary only; no raw provider payload/account topology. | Viewed/denied audit and log. | Pass only if default-denied profiles remain denied. |
| S12 | Idempotency duplicate | Same actor, same request, same idempotency key. | Repeat `POST /ai-data-pack/exports`. | Same accepted summary or conflict semantics from implementation. | Same redacted job summary; no second lifecycle. | `idempotent_request_reused`, idempotency log. | Pass only if duplicate does not start a second lifecycle. |
| S13 | Rate-limit threshold observable | Controlled test user and agreed low threshold or safe repeated calls. | Repeat status/sync-summary/create until limit. | 429 or rate-limited denial when threshold reached. | Generic rate-limit response; no internals. | `rate_limited` audit and log. | Pass only if audit/log records event. |
| S14 | Denied/jobless audit | Unknown job or invalid/denied create. | Denied request with safe payload. | Denied. | Generic denial. | Persistent endpoint audit exists. | Pass only if jobless denied audit persists. |
| S15 | Structured log emitted | Any allowed and denied request. | Run S01 and S04. | Expected status from each. | Response safe. | Bounded metric-name signal in logs. | Pass only if labels remain bounded and sanitized. |

## UAT Sign-Off

UAT can pass only when:

- All selected smoke tests pass in the controlled target environment.
- No forbidden field appears in any response.
- Denied and rate-limited attempts have audit/log evidence.
- Director/admin confirms responses are useful despite being metadata-only.
- Security/platform owner confirms high-volume blockers remain tracked and not waived by this rollout.
