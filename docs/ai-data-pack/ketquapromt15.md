# Prompt 15 Result - PR-2.3B-4E Public Create/Status Endpoint Implementation, No Download

## Result

Status: `completed_public_export_endpoints_no_download`

Implemented the Prompt 15 public AI Data Pack export surface:

- `POST /ai-data-pack/exports`
- `GET /ai-data-pack/exports/:jobId/status`
- `GET /ai-data-pack/exports/:jobId`
- `GET /ai-data-pack/exports/:jobId/sync-summary`

No download endpoint, download token, public URL, storage path response, artifact byte response, OpenAI upload, action import, approval workflow, dry-run/live execution, provider mutation, provider validateOnly, or Phase 3 work was added.

## Inputs Reviewed

Reviewed current Prompt 13 and Prompt 14 implementation outputs and review packets under `docs/ai-data-pack`.

The referenced addendum file was not present at the expected path:

```text
docs/ai-data-pack/ba-master-addendum-prompt13-review-prompt14-public-endpoint-spec-20260613.md
```

Optional ledger/roadmap/truc files were also not present. This implementation follows the Prompt 15 file and the available Prompt 13/14 outputs.

## Files Changed

Backend:

- `backend/src/ai-data-pack/ai-data-pack.module.ts`
- `backend/src/ai-data-pack/audit/export-endpoint-audit.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-endpoint-rate-limit.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-response-redactor.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job.types.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-endpoint.controller.spec.ts`
- `backend/src/ai-data-pack/rbac/export-endpoint-policy.service.ts`

Docs:

- `docs/ai-data-pack/ketquapromt15.md`
- `docs/ai-data-pack/ketquapromt15.json`
- `docs/ai-data-pack/review-packets/promt15/00_summary.md`
- `docs/ai-data-pack/review-packets/promt15/01_scope.md`
- `docs/ai-data-pack/review-packets/promt15/02_endpoints.md`
- `docs/ai-data-pack/review-packets/promt15/03_rbac_redaction.md`
- `docs/ai-data-pack/review-packets/promt15/04_validation_idempotency_rate_limit.md`
- `docs/ai-data-pack/review-packets/promt15/05_audit_security.md`
- `docs/ai-data-pack/review-packets/promt15/06_tests.md`
- `docs/ai-data-pack/review-packets/promt15/07_safety_checklist.md`
- `docs/ai-data-pack/review-packets/promt15/08_files_changed.md`
- `docs/ai-data-pack/review-packets/promt15/09_risks_open_questions.md`
- `docs/ai-data-pack/review-packets/promt15/10_next_recommendation.md`

## Endpoints Added

### `POST /ai-data-pack/exports`

Supports:

- `cached_export`
- `official_export`
- `partial_export`

Permission by mode:

- `cached_export`: `ai-data-pack.export.cached.create`
- `official_export`: `ai-data-pack.export.official.create`
- `partial_export`: `ai-data-pack.export.partial.create`

The endpoint accepts only the Prompt 15 allowlist fields and rejects forbidden public inputs before lifecycle delegation.

Official and partial requests delegate only to `AiDataPackExportJobService.createOfficialPartialExportInternal`.

Cached requests delegate only to `AiDataPackExportJobService.createCachedExport` and do not trigger source sync.

### `GET /ai-data-pack/exports/:jobId/status`

Requires:

```text
ai-data-pack.export.status.read
```

Returns redacted status and manifest summary only. It does not return artifact bytes, storage paths, public URLs, provider payloads, tokens, raw errors, or row-level data.

### `GET /ai-data-pack/exports/:jobId`

Requires:

```text
ai-data-pack.export.status.read
```

Includes sanitized audit summary only when the actor also has:

```text
ai-data-pack.export.audit.read
```

### `GET /ai-data-pack/exports/:jobId/sync-summary`

Requires:

```text
ai-data-pack.export.sync-detail.read
```

Available only for `official_export` and `partial_export`.

Denied by default for:

- `manager_marketer`
- `investor_redacted`
- `external_consultant_redacted`
- `reviewer_partial`
- `unassigned_reviewer`

## RBAC And Redaction

Added endpoint RBAC in `ExportEndpointPolicyService`.

Implemented fail-closed checks for:

- missing create/read/sync permission
- redaction profile mismatch
- artifact/job profile mismatch
- job owner mismatch
- unassigned reviewer
- investor full-pack request
- system internal worker public read/create
- sync summary default-denied profiles

Every public response includes:

- `responseRedaction.isRedacted`
- `responseRedaction.redactionProfile`
- `responseRedaction.omittedSections`
- `responseRedaction.reason`
- `responseRedaction.manifestOnly`

Public responses are manifest-only. The serializer strips forbidden keys such as `storageKey`, `storageLocation`, `downloadToken`, `artifactBytes`, `publicUrl`, `rawProviderResponse`, credentials, stack traces, and raw provider query fields.

## Validation, Idempotency, And Rate Limits

Create validation rejects:

- unknown top-level fields
- forbidden nested fields
- provider credentials
- GAQL/raw provider query
- action plan/import payload
- approval payload
- `dryRun`
- `liveExecution`
- OpenAI upload payload
- `downloadNow`
- `publicUrl`
- `artifactStoragePath`
- `storageLocation`
- `roleOverride`
- `redactionOverride`
- `downloadToken`
- `artifactBytes`

The public idempotency scope includes:

- requester
- export mode
- report date
- date range
- pack types
- formats
- redaction profile
- section access profile
- source scope
- policy version
- caller-provided idempotency key

Duplicate public idempotency requests reuse the same job summary and do not call the lifecycle service a second time.

Implemented conservative in-memory controls:

- per actor create limit
- per actor/mode create limit
- stricter official create limit
- per actor/job status polling limit
- stricter sync-summary polling limit
- idempotency replay limit
- repeated denial limit
- large date range rejection
- pack/format count limits
- single in-process concurrent official create per actor

## Audit Events

Added sanitized endpoint audit events:

```text
export_create_requested
export_create_denied
export_create_accepted
export_status_viewed
export_status_denied
export_detail_viewed
export_detail_denied
sync_summary_viewed
sync_summary_denied
rbac_denied
redaction_profile_applied
idempotent_request_reused
invalid_request_rejected
```

When a job exists, events are appended to the job audit history. Jobless denied/invalid events are captured by the endpoint audit service without secrets.

## Tests Run

```text
npm test -- --runInBand export-job-endpoint.controller.spec.ts
npm test -- --runInBand ai-data-pack
npm run build
```

Result:

```text
endpoint_spec=18 passed
ai_data_pack_suite=15 suites passed, 122 tests passed
backend_build=passed
```

## Safety Checklist

```text
download_endpoint_added=false
download_token_added=false
artifact_bytes_returned=false
public_url_returned=false
full_storage_path_returned=false
provider_credentials_accepted=false
raw_provider_query_accepted=false
provider_direct_call_from_controller=false
provider_mutation_added=false
provider_validate_only_added=false
openai_upload_added=false
action_import_added=false
approval_workflow_added=false
dry_run_live_added=false
phase_3_started=false
cached_create_triggers_sync=false
official_partial_delegate_internal_lifecycle_only=true
```

## Risks And Open Questions

- The global role-permission map was not edited because Prompt 15 allowed code changes only under `backend/src/ai-data-pack/**/*`. The endpoint policy reads explicit `user.permissions` plus existing role permissions. Deployment must ensure JWT/current-user claims include the new Prompt 15 permission names, or a later auth-scope change must bind these permissions globally.
- Endpoint audit for denied requests without a job is in-process only. Job-known audit events are appended to the export job. A later phase should wire jobless security events into a persistent central audit sink.
- Rate limits are in-memory per process. A clustered production deployment should replace or back them with Redis/shared throttling.
- The referenced Prompt 13/14 public endpoint addendum was missing from the workspace.
- Download and artifact rendering remain explicitly out of scope.

## Next Recommendation

Stop after Prompt 15 unless review requests a hardening patch.

Recommended next step:

```text
PR-2.3B-4E-H1 - Public endpoint hardening review
```

Do not jump to download, OpenAI upload, action import, approval, dry-run/live execution, provider mutation, or Phase 3 without a new prompt.
