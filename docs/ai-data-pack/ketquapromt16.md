# Prompt 16 Result - PR-2.3B-4E-H1 Public Endpoint Hardening & Acceptance, No Download

## Result

Status: `completed_public_endpoint_hardening_no_download`

Prompt 16 hardened the Prompt 15 public export endpoints without opening download, OpenAI upload, action import, approval, dry-run/live execution, provider mutation, provider validateOnly, or Phase 3.

Implemented hardening:

- Bound Prompt 15 endpoint permissions through the existing role-permission map.
- Added persistent Mongo-backed endpoint audit for public export endpoint audit/security events.
- Wired endpoint rate limits to the global CacheManager when available, preserving in-memory fallback for isolated tests/dev.
- Added deeper denial, redaction, auth, audit, limiter, and static safety regression tests.
- Documented static grep findings and remaining risks.

## Inputs Reviewed

Mandatory Prompt 16 inputs reviewed:

- `docs/ai-data-pack/ketquapromt15.md`
- `docs/ai-data-pack/ketquapromt15.json`
- `docs/ai-data-pack/review-packets/promt15/*`
- `docs/ai-data-pack/ketquapromt14.md`
- `docs/ai-data-pack/ketquapromt14.json`
- `docs/ai-data-pack/review-packets/promt14/*`
- `docs/ai-data-pack/ketquapromt13.md`
- `docs/ai-data-pack/ketquapromt13.json`
- `docs/ai-data-pack/review-packets/promt13/*`

Optional inputs:

| File | Status | Impact | Can continue |
|---|---|---|---|
| `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md` | present/read | Confirms ERP remains source of truth, ChatGPT Web analyst only, no live execution. | true |
| `docs/ai-data-pack/ba-master-addendum-prompt13-review-prompt14-public-endpoint-spec-20260613.md` | missing | Addendum-specific review could not be verified. Prompt 15 and available Prompt 13/14 outputs fully define H1 constraints. | true |
| `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger-v11.md` | missing | Optional phase ledger unavailable; checkpoint from Prompt 15 preserved. | true |
| `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap-v11.md` | missing | Optional roadmap unavailable; no phase expansion performed. | true |
| `docs/ai-data-pack/truc-giu-ba-ai-data-pack-v8.md` | missing | Optional guardrail file unavailable; Prompt 15 guardrails preserved. | true |
| `C:/Users/PC/Downloads/promt15.md` | present/read | Used to re-check Prompt 15 acceptance contract. | true |
| `C:/Users/PC/Downloads/chatgptweb15.md` | present/read | Used to re-check reviewer focus and no-download hardening scope. | true |

## Files Changed

Backend:

- `backend/src/auth/role-permissions.ts`
- `backend/src/ai-data-pack/ai-data-pack.module.ts`
- `backend/src/ai-data-pack/audit/export-endpoint-audit.schema.ts`
- `backend/src/ai-data-pack/audit/export-endpoint-audit.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-endpoint-rate-limit.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.spec.ts`
- `backend/src/ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-source-guard.spec.ts`

Docs:

- `docs/ai-data-pack/ketquapromt16.md`
- `docs/ai-data-pack/ketquapromt16.json`
- `docs/ai-data-pack/review-packets/promt16/*`

## Auth Permission Binding

Existing pattern found:

```text
backend/src/auth/role-permissions.ts
```

Bound Prompt 15 export permissions:

- `ai-data-pack.export.cached.create`
- `ai-data-pack.export.official.create`
- `ai-data-pack.export.partial.create`
- `ai-data-pack.export.status.read`
- `ai-data-pack.export.audit.read`
- `ai-data-pack.export.sync-detail.read`

Role mapping:

- `director`: cached create, official create, partial create, status read, audit read, sync-detail read, and AI Data Pack profile permissions.
- `manager`: cached create, partial create, status read, manager-marketer profile only.
- `investor`: status read, investor-redacted profile only.
- `employee`, internal/external agent, supplier, lender: no public export create/read binding added.

Preserved fail-closed behavior:

- Manager does not receive official create.
- Manager/investor do not receive audit read or sync-detail read.
- Internal-agent/system-like roles do not receive public export permissions.
- Explicit `user.permissions` still works for non-bound roles.

## Persistent Audit

Existing pattern found:

```text
backend/src/ai-data-pack/source-sync/source-sync-audit.schema.ts
backend/src/ai-data-pack/source-sync/source-sync-audit.service.ts
```

Added:

```text
backend/src/ai-data-pack/audit/export-endpoint-audit.schema.ts
```

Collection:

```text
ai_data_pack_endpoint_audits
```

Endpoint audit now persists sanitized events when the AI data-pack module is loaded with Mongoose. Job-known events still append to export jobs as before.

Persistent audit stores:

- audit id
- event
- actor id
- job id if known
- status
- sanitized reason
- sanitized details
- fixed action safety flags: `canImportActionFile=false`, `canDryRun=false`, `canExecuteLive=false`

Forbidden audit fields are omitted:

- credentials
- tokens
- raw provider request/response/query
- raw HTTP headers
- raw stack traces
- raw PII
- storage keys/locations
- artifact bytes
- public URLs

## Rate Limit Hardening

Existing shared-cache pattern found:

```text
CacheModule.registerAsync({ isGlobal: true, Redis when REDIS_URL exists, in-memory fallback })
```

`ExportEndpointRateLimitService` now uses CacheManager buckets when available and falls back to local in-memory buckets otherwise.

Config keys exposed:

- `AI_DATA_PACK_EXPORT_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_CREATE_PER_MODE`
- `AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_SYNC_SUMMARY_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_IDEMPOTENCY_REPLAY_PER_ACTOR_KEY`
- `AI_DATA_PACK_EXPORT_DENIAL_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_MAX_DATE_RANGE_DAYS`
- `AI_DATA_PACK_EXPORT_MAX_PACK_TYPES`
- `AI_DATA_PACK_EXPORT_MAX_FORMATS`
- `AI_DATA_PACK_EXPORT_MAX_CONCURRENT_OFFICIAL_PER_ACTOR`

Defaults preserved:

```text
windowMs=60000
createPerActor=10
createPerMode=6
officialCreatePerActor=2
statusPollPerActorJob=60
syncSummaryPerActorJob=12
idempotencyReplayPerActorKey=20
denialPerActor=30
maxDateRangeDays=31
maxPackTypes=4
maxFormats=2
maxConcurrentOfficialPerActor=1
```

## Denial Behavior

Tested/hardened behavior:

- missing global permission -> 403 generic
- profile mismatch -> 403 generic with internal audit
- job owner mismatch -> 404-style generic denial
- unknown job and non-readable job status responses are indistinguishable
- unassigned reviewer -> generic denial without source detail
- sync-summary default-denied profile -> 403 generic without source key leak
- denied detail does not leak audit summary existence
- all denial cases emit sanitized audit/security events

## Redaction Regression

Regression tests now cover:

- create response
- status response
- detail response
- sync-summary response
- denial/error responses

Assertions:

- success responses include `responseRedaction`
- success responses are manifest-only
- omitted sections are present
- `allowedNextActions` excludes download/upload/import/dry-run/live
- no `artifactBytes`
- no `downloadToken`
- no `publicUrl`
- no public storage key/path
- no raw provider response/query
- no credentials/tokens
- no stack trace
- no raw PII fixture data

## Static Safety Checks

Commands run:

```text
rg -n "download-token|@(Get|Post|Put|Patch|Delete)\([^\n]*download|/download" backend/src/ai-data-pack
rg -n "upload_to_openai|import_action|execute_live|validateOnly|provider mutation route|artifactBytes|downloadToken|publicUrl|storageLocation|storageKey" backend/src/ai-data-pack/export-jobs backend/src/ai-data-pack/audit backend/src/auth/role-permissions.ts
```

Interpretation:

- No production download route was found.
- Download strings appeared only in tests asserting absence.
- Forbidden response-key strings appeared in sanitizer denylists, tests, and internal manifest/artifact model fields, not in public response allowlists.
- `validateOnly` appeared only in forbidden-input denylists and tests.
- Internal `storageLocation` and `storageKey` fields remain in internal artifact/manifest code, but public serializers strip them.

## Tests Run

```text
npm test -- --runInBand export-job-endpoint.controller.spec.ts
npm test -- --runInBand ai-data-pack
npm run build
```

Results:

```text
export-job-endpoint.controller.spec.ts: 29 passed
ai-data-pack suite: 15 suites passed, 133 tests passed
backend build: passed
```

## Safety Checklist

```text
download_endpoint_added=false
download_token_added=false
artifact_bytes_returned=false
public_url_returned=false
full_storage_path_returned=false
openai_upload_added=false
action_import_added=false
approval_workflow_added=false
dry_run_live_added=false
provider_mutation_added=false
provider_validate_only_added=false
phase_3_started=false
provider_direct_call_from_controller=false
cached_create_triggers_sync=false
official_partial_delegate_internal_lifecycle_only=true
```

## Risks And Open Questions

- CacheManager limiter uses shared cache buckets when configured, but increments are read/write rather than atomic Redis increments. This is acceptable for H1 hardening but should be reviewed before high-volume public exposure.
- Endpoint audit is persistent for AI Data Pack endpoint events, but not a cross-domain central security ledger.
- Audit records do not yet include request path/method because the endpoint service does not receive raw request context. Events still include event, actor, job when known, status, reason, and sanitized details.
- The referenced Prompt 13/14 addendum and optional ledger/roadmap/truc files were missing.
- Download, artifact rendering, OpenAI upload, action import, approval, dry-run/live, provider mutation, and Phase 3 remain out of scope.

## Next Recommendation

Stop after Prompt 16.

Recommended next phase, only if accepted:

```text
PR-2.3B-4F - Public Create/Status Acceptance Finalization, No Download
```

Do not open download, OpenAI upload, action import, approval, dry-run/live execution, provider mutation, provider validateOnly, or Phase 3 without a new explicit prompt.
