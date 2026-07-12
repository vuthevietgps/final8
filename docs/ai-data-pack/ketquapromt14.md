# Prompt 14 Result - PR-2.3B-4D Public Create/Status Endpoint & Response Redaction Spec

## Result

Status: `completed_public_create_status_spec_no_code`

Prompt 14 is documentation only. It defines the future public/admin create, job detail, status, and sync-summary surfaces for AI Data Pack exports. No source code, migration, endpoint, download token, artifact bytes, row-level redaction, OpenAI upload, action import, approval workflow, dry-run/live execution, provider call, provider mutation, provider validateOnly, or Phase 3 work was added.

```text
code_changed=false
docs_changed=true
migration_added=false
public_endpoint_added=false
download_endpoint_added=false
download_token_added=false
artifact_bytes_implemented=false
row_level_redaction_implemented=false
openai_upload_added=false
action_import_added=false
approval_workflow_added=false
dry_run_or_live_added=false
provider_call=false
provider_mutation=false
provider_validate_only=false
phase_3_started=false
download_endpoint=out_of_scope
download_token=out_of_scope
artifact_bytes=out_of_scope
```

## Inputs Reviewed

Mandatory inputs reviewed:

- `docs/ai-data-pack/ba-master-director-ai-data-pack-dropship-20260612.md`
- `docs/ai-data-pack/ketquapromt11.md`
- `docs/ai-data-pack/ketquapromt11.json`
- `docs/ai-data-pack/review-packets/promt11/*`
- `docs/ai-data-pack/ketquapromt12.md`
- `docs/ai-data-pack/ketquapromt12.json`
- `docs/ai-data-pack/review-packets/promt12/*`
- `docs/ai-data-pack/ketquapromt13.md`
- `docs/ai-data-pack/ketquapromt13.json`
- `docs/ai-data-pack/review-packets/promt13/*`

Missing mandatory inputs: none.

Optional ledger/roadmap/truc files were not present:

- `docs/ai-data-pack/chuoi-promt-codex-chatgptweb-ledger*.md`
- `docs/ai-data-pack/lo-trinh-ai-data-pack-roadmap*.md`
- `docs/ai-data-pack/truc-giu-ba-ai-data-pack*.md`

## Endpoint Inventory

Future endpoints covered by this spec:

| Endpoint | Purpose | Download? |
|---|---|---|
| `POST /ai-data-pack/exports` | Request cached, official, or partial export. | No |
| `GET /ai-data-pack/exports/:jobId/status` | Read redacted job status summary. | No |
| `GET /ai-data-pack/exports/:jobId` | Read redacted job detail without artifact bytes or storage path. | No |
| `GET /ai-data-pack/exports/:jobId/sync-summary` | Read sanitized source-sync summary for authorized users. | No |

Explicitly out of scope:

```text
download_endpoint=out_of_scope
download_token=out_of_scope
artifact_bytes=out_of_scope
```

## Create Endpoint Contract

Future endpoint:

```text
POST /ai-data-pack/exports
```

Allowed export modes:

- `cached_export`
- `official_export`
- `partial_export`

Required permission by mode:

| Export mode | Permission |
|---|---|
| `cached_export` | `ai-data-pack.export.cached.create` |
| `official_export` | `ai-data-pack.export.official.create` |
| `partial_export` | `ai-data-pack.export.partial.create` |

Input fields:

- `exportMode`
- `reportDate`
- `dateFrom` / `dateTo`
- `packTypes`
- `formats`
- `redactionProfile`
- `sectionAccessProfile`
- `sourceScope`
- `googleAdsCustomerIds`, only when source scope needs Google Ads customer restriction
- `allowDowngradeToPartial`
- `idempotencyKey`
- `policyVersion`

Forbidden input fields:

- provider credentials
- raw provider query / GAQL
- action plan
- approval payload
- `dryRun`
- `liveExecution`
- OpenAI upload payload
- `downloadNow`
- `publicUrl`
- `artifactStoragePath`
- `roleOverride`
- `redactionOverride`

Rules:

- Fail closed on permission or profile mismatch.
- Do not return artifact bytes.
- Do not return download token.
- Do not return public URL or storage path.
- Response returns job summary only.
- Official/partial create calls the internal lifecycle method only.
- Cached create keeps cached behavior and must not trigger source sync.
- No provider call outside internal lifecycle policy.
- No action/import/dry-run/live gate opens.
- No silent downgrade unless `allowDowngradeToPartial=true`, with audit reason.

## Status Endpoint Contract

Future endpoint:

```text
GET /ai-data-pack/exports/:jobId/status
```

Required permission:

```text
ai-data-pack.export.status.read
```

Allowed response fields:

- `jobId`
- `exportMode`
- `syncPolicy`
- `status`
- `createdAt`
- `updatedAt`
- `completedAt`
- `redactionProfile`
- `packTypes`
- `formats`
- `sourceImpactSummary`
- `decisionGateSummary`
- `warnings`
- `blockingReasons`
- `artifactManifestSummary`
- `allowedNextActions`
- `omittedSections`
- `responseRedaction`

Forbidden response fields:

- full `storageLocation` key
- download token
- raw provider response
- raw sync errors
- credentials
- tokens
- stack trace
- raw PII
- full finance, supplier, employee, payroll, or customer sections

Allowed `allowedNextActions`:

- `view_status`
- `request_new_export`
- `request_partial_if_blocked`

Forbidden `allowedNextActions` until later phases:

- `download`
- `upload_to_openai`
- `import_action`
- `dry_run`
- `execute_live`

## Job Detail Endpoint Contract

Future endpoint:

```text
GET /ai-data-pack/exports/:jobId
```

Purpose:

- Read redacted export job metadata and manifest summary.
- Support admin/director review without exposing artifact bytes or storage keys.

Required permission:

```text
ai-data-pack.export.status.read
```

If audit events are included, also require:

```text
ai-data-pack.export.audit.read
```

Response must be profile-redacted. It may include sanitized audit summaries only when authorized.

## Sync Summary Endpoint Contract

Future endpoint:

```text
GET /ai-data-pack/exports/:jobId/sync-summary
```

Required permission:

```text
ai-data-pack.export.sync-detail.read
```

Output fields:

- `sourceKey`
- `freshnessStatus`
- `coverageStatus`
- `sourceImpactStatus`
- `adapterAttempted`
- `providerSyncAttempted`
- `sanitizedErrorCategories`
- `postAssessment`
- `decisionGateImpact`

Forbidden output:

- raw provider payload
- raw HTTP headers
- raw provider request/response
- OAuth/access/refresh token
- customer/account topology beyond authorized scope
- stack trace

Manager, marketer, investor, external consultant, and unassigned reviewer profiles are denied by default.

## Request Validation And Idempotency

Create endpoint validation:

- `idempotencyKey` is required.
- `reportDate`, `dateFrom`, and `dateTo` must use `YYYY-MM-DD`.
- `dateFrom` must not be after `dateTo`.
- Large date ranges must be rejected or downgraded to an explicitly approved bounded request.
- `packTypes` must be supported and bounded.
- `formats` must be `json` and/or `xlsx`, with implementation-defined max count.
- `redactionProfile` must be supported.
- `sectionAccessProfile` must be supported and compatible with the actor.
- `sourceScope` must be bounded to authorized sources and customer IDs.
- `policyVersion` must be recognized.
- Forbidden fields must be rejected before lifecycle call.

Idempotency scope:

```text
requester
exportMode
reportDate
dateFrom/dateTo
packTypes
formats
redactionProfile
sectionAccessProfile
sourceScope
policyVersion
idempotencyKey
```

Duplicate behavior:

- If an equivalent active request exists, return the same redacted job summary.
- Audit `idempotent_request_reused`.
- Do not start a second lifecycle.

Expired idempotency behavior:

- Expired terminal jobs may permit a new request using a new idempotency key.
- Reusing an old key after retention expiry must return a generic conflict or require a new key.

## Response Redaction Policy

All responses must include:

- `responseRedaction.isRedacted`
- `responseRedaction.redactionProfile`
- `responseRedaction.omittedSections`
- `responseRedaction.reason`
- `responseRedaction.manifestOnly`

Profile rules:

| Profile | Status visibility | Sync summary | Sensitive data |
|---|---|---|---|
| `director_full` | Full job status, sanitized provider status, manifest summary. | Allowed if permission granted. | May see sensitive flags, not raw tokens or raw payload. |
| `director_redacted` | Full workflow status, redacted sensitive sections. | Sanitized only if permission granted. | No raw PII by default. |
| `manager_marketer` | Assigned partial/cached jobs only. | Denied by default. | No finance, employee, supplier commission, customer PII. |
| `finance_operator` | Assigned finance-scoped jobs. | Sanitized only if granted. | Finance summaries allowed, no customer PII by default. |
| `reviewer_partial` | Assigned partial jobs only. | Denied by default. | Redacted business status only. |
| `investor_redacted` | Assigned redacted summary only. | Denied. | No full Director Pack, no sync detail. |
| `external_consultant_redacted` | Assigned redacted summary only. | Denied. | No finance detail, PII, sync detail, or audit detail. |
| `system_internal_worker` | No human read surface by default. | No human read surface. | Cannot download or read human endpoints by default. |

Rules:

- Status response must list omitted sections due to RBAC.
- Redacted response must explicitly say it is redacted.
- Warnings and blocking reasons must be sanitized.
- ChatGPT Web must know if the pack is partial, redacted, and/or manifest-only.
- Redacted response must not look like a full dataset.

## RBAC And Denial Policy

Denial cases:

- missing permission
- profile mismatch
- artifact profile mismatch
- job owner mismatch
- unassigned reviewer
- investor trying full pack
- manager trying finance/employee/supplier detail
- system worker trying human download/read
- sync detail requested by default-denied profile

Denial behavior:

- Fail closed.
- Return generic denial to caller.
- Audit exact internal reason.
- Do not leak job existence where policy requires 404-style denial.
- No source sync on denied create.
- No artifact or token generation on denied create.

## Audit And Security Events

Endpoint-layer audit events:

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

Each event includes:

- actor
- profile
- permission checked
- `jobId` if known
- `exportMode` if known
- `redactionProfile`
- idempotency key hash
- timestamp
- sanitized reason
- no secrets

## Rate Limit And Abuse Controls

Required controls:

- per actor create rate limit
- per mode create rate limit
- per job status polling limit
- sync summary read limit
- idempotency replay limit
- large date range rejection
- pack size limits
- format limits
- concurrent official export limit
- concurrent source-sync limit reuse
- repeated denial throttling

Suggested initial policy:

- Official create: stricter than partial/cached.
- Status polling: low-cost but capped per actor/job.
- Sync summary: privileged and more tightly capped.
- Repeated invalid payloads: audit and throttle.

## Future Implementation Test Plan

Future implementation tests must cover:

- unauthorized create official denied
- manager cannot create official by default
- partial creator permission enforced
- idempotency returns same job
- cached create never triggers sync
- official create calls internal lifecycle only
- status denied to unrelated user
- status response redacted by profile
- sync summary denied to manager/investor
- sync summary sanitized
- create rejects `dryRun` / `liveExecution` / OpenAI / action payload
- create rejects raw provider query / credentials
- no download token returned
- no artifact bytes returned
- no public storage path returned
- no provider mutation / validateOnly
- no existing GET export behavior changed

## Risks And Open Questions

- Endpoint implementation still needs route-level auth integration.
- Row-level redaction is still not implemented.
- Official/partial rendering remains manifest-only.
- Exact rate-limit values need owner approval.
- Exact 404-vs-403 job existence policy needs security approval.
- Whether cached create should be public/admin or remain internal requires product approval.
- `GET /exports/:jobId` audit detail expansion should wait for a separate audit-read policy decision.
- Download endpoint and token policy remain separate future work.

## Next Recommendation

Stop after Prompt 14.

If this spec is accepted:

```text
PR-2.3B-4E - Public Create/Status Endpoint Implementation, no download
```

If risks remain:

```text
PR-2.3B-4D-H1 - Public Endpoint Spec Fix
```

Do not jump to:

- download endpoint
- download token
- OpenAI/upload
- action import
- approval workflow
- dry-run/live execution
- provider mutation
- Phase 3
