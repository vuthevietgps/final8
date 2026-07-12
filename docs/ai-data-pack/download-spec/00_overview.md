# PR-2.3B-5A Download Spec Overview

Phase: `PR-2.3B-5A - Download Endpoint Spec, No Code`

Status: spec only.

This document set specifies a safe future artifact download surface for AI Data Pack export jobs. It does not implement a route, token, artifact rendering, artifact bytes, OpenAI upload, action import, approval, dry-run, live execution, provider mutation, provider validateOnly, new provider adapter, or Phase 3 behavior.

## Current Baseline

Accepted prior surface:

- `POST /ai-data-pack/exports`
- `GET /ai-data-pack/exports/:jobId/status`
- `GET /ai-data-pack/exports/:jobId`
- `GET /ai-data-pack/exports/:jobId/sync-summary`

Prior safety flags remain binding:

```text
public_create_endpoint_added=true
public_status_endpoint_added=true
public_job_detail_endpoint_added=true
sync_summary_endpoint_added=true
rbac_fail_closed=true
response_redaction=true
manifest_only=true
audit=true
rate_limit=true
download_endpoint_added=false
download_token_added=false
artifact_bytes_returned=false
openai_upload_added=false
action_import_added=false
approval_workflow_added=false
dry_run_live_added=false
provider_mutation_added=false
provider_validate_only_added=false
phase_3_started=false
```

Prompt 18 accepted the public no-download surface for controlled internal/admin use only. High-volume multi-pod public exposure is still not accepted until platform gates are resolved.

## Reused Modules For Future Implementation

This spec should reuse these existing AI Data Pack module boundaries if implementation is later approved:

- `ExportJobEndpointController`: current public endpoint controller under `ai-data-pack/exports`.
- `ExportJobEndpointService`: current endpoint orchestration, validation, audit, rate-limit, and response flow.
- `ExportEndpointPolicyService`: current public endpoint RBAC/profile policy.
- `ExportRbacPolicyService`: current internal lifecycle RBAC policy and existing download capability guard for system workers.
- `ExportJobResponseRedactorService`: current public response stripping and manifest-only redaction.
- `ExportEndpointAuditService`: persistent sanitized endpoint audit sink.
- `ExportEndpointRateLimitService`: endpoint rate-limit service, with the existing non-atomic CacheManager caveat.
- `ExportEndpointObservabilityService`: bounded structured endpoint logs.
- `ExportJobArtifactService`: existing artifact writer/storage-key boundary for cached artifacts.
- `AiDataPackExportJobService`: export job lifecycle, job lookup, endpoint audit append, and manifest state.
- `ExportRedactionProfileService`: supported redaction profiles and current `manifest_only` redaction runtime.
- `AiDataPackExportJob` schema and `InternalExportArtifactManifest`: job, artifact, checksum, size, redaction, and rendering metadata.

## Non-Negotiable Boundaries

- ERP is the only system allowed to validate, approve, execute, or call provider APIs.
- ChatGPT Web receives files only through manual human upload in this phase family.
- Download must never create a public URL, signed URL, raw storage path response, or storage key response.
- Download must never call Google Ads API or any provider API.
- Download must never upload to OpenAI.
- Download must never import, dry-run, approve, execute, mutate, validateOnly, auto-publish, or start Phase 3.
- Official and partial artifacts with `artifact_rendering=deferred` are not download-ready.

## Download Readiness Principle

Current official/partial export lifecycle creates manifest-only internal metadata:

```text
redaction_runtime=manifest_only
artifact_rendering=deferred
download_ready=false
```

Therefore, official/partial downloads must remain not ready until a later phase implements actual rendered, redacted artifact files and binds them to the manifest. A future download endpoint may be specified now, but implementation must not fake artifact readiness.

