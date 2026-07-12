# Prompt 13 Result - PR-2.3B-4C Official/Partial Export Lifecycle

## Result

Status: `completed_internal_lifecycle_manifest_only`

Prompt 13 implemented the internal official/partial export lifecycle only. No public endpoint, status endpoint, download endpoint, download token endpoint, OpenAI upload, action import, approval workflow, dry-run/live execution, or provider mutation was added.

```text
code_changed=true
docs_changed=true
provider_calls=false
provider_mutation=false
provider_validate_only=false
public_endpoint_added=false
download_endpoint_added=false
official_partial_lifecycle_implemented=true
cached_export_semantics_changed=false
existing_get_exports_changed=false
redaction_runtime=manifest_only
artifact_rendering=deferred
ready_for_public_endpoint=false
ready_for_download_endpoint=false
ready_for_openai_upload=false
```

## Implementation Summary

- Added `official_export` and `partial_export` internal lifecycle support in `AiDataPackExportJobService.createOfficialPartialExportInternal()`.
- Preserved cached export behavior: cached exports still use `export_cached`, do not call source sync, render cached artifacts, and use the existing GET controller independently.
- Added official/partial lifecycle statuses: `requested`, `pre_assessing`, `syncing_sources`, `post_assessing`, `snapshotting`, `exporting`, `completed`, `completed_with_warnings`, `blocked`, `failed`, `expired`.
- Enforced source sync policy mapping:
  - `official_export` -> `sync_required`
  - `partial_export` -> `sync_if_stale`
- Added transition validation for the official/partial lifecycle.
- Added fail-closed RBAC/profile checks with internal `rbac_denied` audit and no artifact/source sync when denied.
- Added explicit downgrade behavior: official export only downgrades to partial when `allowDowngradeToPartial=true`, with `export_downgraded` audit.
- Added manifest-only internal artifact metadata with `artifact_rendering=deferred` and `redaction_runtime=manifest_only`.

## Files Changed

- `backend/src/ai-data-pack/export-jobs/export-job.types.ts`
- `backend/src/ai-data-pack/export-jobs/export-job.schema.ts`
- `backend/src/ai-data-pack/export-jobs/export-job.service.ts`
- `backend/src/ai-data-pack/export-jobs/export-job.service.spec.ts`
- `backend/src/ai-data-pack/export-jobs/export-job-artifact.service.ts`
- `backend/src/ai-data-pack/rbac/export-rbac-policy.service.ts`
- `backend/src/ai-data-pack/rbac/export-rbac-policy.service.spec.ts`
- `backend/src/ai-data-pack/redaction/export-redaction-profile.service.ts`
- `backend/src/ai-data-pack/redaction/export-redaction-profile.service.spec.ts`
- `backend/src/ai-data-pack/ai-data-pack.module.ts`
- `docs/ai-data-pack/ketquapromt13.md`
- `docs/ai-data-pack/ketquapromt13.json`
- `docs/ai-data-pack/review-packets/promt13/*`

## Internal Lifecycle Contract

Required input fields are validated internally:

- `mode`
- `reportDate`
- `dateFrom` / `dateTo`
- `packTypes`
- `formats`
- `requester` / `requestedBy`
- `redactionProfile`
- `sectionAccessProfile`
- `policyVersion`
- `idempotencyKey`
- `sourceScope.googleAdsCustomerIds` or `googleAdsCustomerIds` when source sync needs customer scope
- `allowDowngradeToPartial`, default `false`

Forbidden payload keys are rejected before job execution:

- provider credentials and raw tokens
- raw provider query / GAQL
- action plan / approval payload
- dry-run/live flags
- OpenAI/upload payload
- provider mutation / validateOnly input

## Manifest Policy

Official/partial exports currently generate manifest-only internal artifact metadata. Full row-level rendering is intentionally deferred until redaction is implemented.

Manifest includes:

```text
artifactId
exportJobId
exportMode
syncPolicy
policyVersion
redactionProfile
sectionAccessProfile
packTypes
formats
rowCounts
sourceFreshnessMetadata
sourceCoverageMetadata
decisionGates
warnings
blockingReasons
containsPii
containsFinancialSensitive
containsEmployeeSensitive
containsSupplierSensitive
dataContentChecksum
runtimeExportChecksum
artifactChecksum
createdAt
expiresAt
retentionUntil
storageLocation
downloadPolicy
```

`storageLocation` is an internal key only, not a public URL.

## Tests Run

All required Prompt 13 verification commands were run:

```text
npm run build
npm test -- --runInBand export-job
npm test -- --runInBand source-sync
npm test -- --runInBand ai-data-pack
npm test -- --runInBand google-ads-readonly
npm test -- --runInBand source-registry
npm test -- --runInBand rbac
npm test -- --runInBand redaction
```

Results: all passed.

## Remaining Risks

- Row-level redaction is not implemented; official/partial artifacts are manifest-only with `artifact_rendering=deferred`.
- Public create/status/download endpoints are intentionally not implemented and should remain blocked until endpoint RBAC, status redaction, token expiry, and download audit are implemented.
- Full artifact rendering is not ready for redacted profiles.
- OpenAI upload is not ready.

## Next Recommendation

Stop after Prompt 13.

Recommended next phase, only if accepted:

```text
PR-2.3B-4D - Public create/status endpoint specification or implementation, no download
```

Do not jump to download endpoint, OpenAI/upload, action import, approval workflow, dry-run/live execution, provider mutation, or Phase 3.
