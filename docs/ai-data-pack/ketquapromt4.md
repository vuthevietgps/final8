# Ket qua Prompt 4 - PR-2.3B-1 ExportJob + Cached Export Wrapper Only

## 1. Executive Summary

PR-2.3B-1 is completed within the authorized cached-only scope.

- Added a Mongoose code-first `AiDataPackExportJob` persistence contract and internal service.
- Added a cached export wrapper that reuses the existing Director, Marketer, Data Quality and Mapping builders plus existing JSON/XLSX exporters.
- Added immutable local artifact writing, artifact checksum, data-content checksum linkage and sanitized failure audit.
- Added active-job idempotency with `reuse_existing` behavior.
- Added minimal cached metadata: job ID, cached mode, export-cached policy, no provider sync, no freshness gate and no live execution.
- Existing GET controller behavior was not changed and no public endpoint/RBAC/download route was added.
- No provider, action, sheet, payment, settlement, recalculation, auto-control, OpenAI or live-execution service is imported/injected/called by the new production code.
- No provider call or database execution was run during Prompt 4.

Final verification:

- `npm run build`: passed.
- `npm test -- --runInBand export-job`: passed, 1 suite / 10 tests.
- `npm test -- --runInBand ai-data-pack`: passed, 3 suites / 30 tests.
- Prettier check for touched code: passed.

## 2. Scope Control

Included:

- ExportJob types, Mongoose schema and internal cached-export service.
- Cached-only lifecycle: `pending -> exporting -> completed | failed`.
- Reuse of the four existing read-only builders and JSON/XLSX exporters.
- Minimal cached metadata fields.
- Active-job idempotency and duplicate reuse.
- Safe local artifact writer and deterministic SHA-256 artifact checksum.
- Sanitized error category/message.
- Focused tests and Prompt 4 reports.

Excluded and not implemented:

- Source registry and DB-only freshness/coverage gate.
- Stale/fresh thresholds.
- Official or partial export.
- Google Ads or any provider adapter/API call.
- Public endpoint, full RBAC or download flow.
- Action import, generic dry-run or live execution.
- Provider mutation, sheet writes, payment/settlement mutation, order recalculation and auto-control.
- OpenAI/upload work, new BA domains and Phase 3.

`blocked_by_scope=false`. No out-of-scope implementation was required. The BA addendum was read from `C:\Users\PC\Downloads\ba-pr-2-3b-1-exportjob-cached-wrapper-addendum.md`; the requested repo copy did not already exist and was not required for implementation.

## 3. Files Changed

Code and tests:

- `backend/src/ai-data-pack/export-jobs/export-job.types.ts`
  - Cached-only request/pack/format/status/artifact contracts and constants.
- `backend/src/ai-data-pack/export-jobs/export-job.schema.ts`
  - Mongoose ExportJob/artifact schema and unique active idempotency index.
- `backend/src/ai-data-pack/export-jobs/export-job.service.ts`
  - Internal cached export lifecycle and existing-builder wrapper.
- `backend/src/ai-data-pack/export-jobs/export-job-artifact.service.ts`
  - Configurable-root immutable local artifact writer.
- `backend/src/ai-data-pack/export-jobs/export-job-error.util.ts`
  - Sanitized job error category/message helper.
- `backend/src/ai-data-pack/export-jobs/export-job.service.spec.ts`
  - Cached lifecycle, idempotency, artifact, sanitization and no-sync tests.
- `backend/src/ai-data-pack/ai-data-pack.module.ts`
  - Mongoose schema and internal service DI wiring only.
- `backend/src/ai-data-pack/contracts/metadata.contract.ts`
  - Optional minimal cached-job metadata fields.
- `backend/src/ai-data-pack/data-pack-metadata.service.ts`
  - Public reuse of existing safe actor normalization.
- `backend/src/ai-data-pack/export/json-exporter.service.ts`
  - Excludes cached runtime/job metadata from deterministic data-content checksum.

Existing `backend/src/ai-data-pack/ai-data-pack.controller.ts` was not changed by Prompt 4.

Reports:

- `docs/ai-data-pack/ketquapromt4.md`
- `docs/ai-data-pack/ketquapromt4.json`
- `docs/ai-data-pack/review-packets/promt4/*`

## 4. ExportJob Contract Implemented

Collection:

```text
ai_data_pack_export_jobs
```

Cached-only business fields:

```text
jobId
exportMode=cached_export
syncPolicy=export_cached
cachedExport=true
providerSyncAttempted=false
freshnessGateEvaluated=false
liveExecution=false
status
reportDate
packTypes
formats
requestedByUserId
requestedByRole
requestedByDisplay
requestedAt
startedAt
completedAt
failedAt
policyVersion
idempotencyKey
activeIdempotencyKey
artifacts[]
errorCategory
sanitizedErrorMessage
```

Statuses available now:

```text
pending
exporting
completed
failed
```

The schema does not include or use `syncing`. Export mode and sync policy enums only accept `cached_export` and `export_cached`.

No SQL migration was added because the repo uses Mongoose code-first schemas. Prompt 4 did not connect to or modify a database.

## 5. Cached Export Lifecycle Implemented

Internal call:

```text
AiDataPackExportJobService.createCachedExport(request)
```

Lifecycle:

```text
normalize and validate cached request
-> normalize/redact actor
-> compute idempotency key
-> reuse equivalent active job, or create pending job
-> transition to exporting
-> call selected existing read-only builders
-> add minimal cached metadata and refresh checksums
-> render JSON/XLSX using existing exporters
-> write and audit artifacts
-> completed

builder/render/storage failure
-> store sanitized failure audit
-> failed
```

Supported pack types:

```text
director_data_pack
marketer_data_pack
data_quality_report
mapping_report
```

Supported formats:

```text
json
xlsx
```

Minimal metadata added only to cached-job output:

```text
export_job_id
export_mode=cached_export
cached_export=true
sync_policy=export_cached
provider_sync_attempted=false
freshness_gate_evaluated=false
live_execution=false
```

The existing GET endpoints do not call the new service, do not create jobs and remain side-effect-free.

## 6. Artifact / Checksum / Idempotency Behavior

### Artifact lifecycle

- Root is configurable with `AI_DATA_PACK_EXPORT_ROOT`.
- Safe default is `process.cwd()/exports/ai-data-pack`.
- Job IDs and file path segments are validated.
- Only relative `storageKey` is persisted; absolute local paths are not exposed.
- Files are written with the immutable `wx` flag and are not overwritten.
- Artifact records include ID, pack type, format, safe file name/storage key, artifact checksum, data-content checksum, byte size, creation time and `cachedExport=true`.

### Checksum behavior

- Artifact checksum: SHA-256 of rendered file bytes. It may change when runtime metadata/rendered bytes change.
- Data-content checksum: existing deterministic Data Pack checksum.
- Cached runtime/job metadata is excluded from data-content checksum normalization, so changing only `export_job_id` does not change the data-content checksum.

### Idempotency behavior

Chosen behavior:

```text
reuse_existing
```

The key includes normalized/sorted:

```text
reportDate
packTypes
formats
exportMode=cached_export
syncPolicy=export_cached
policyVersion
requestedByUserId
```

Active statuses are `pending` and `exporting`. A unique partial index on `activeIdempotencyKey` protects against concurrent duplicate active jobs. Terminal jobs unset the active key.

## 7. Security / No-Sync / No-Mutation Guard

The new production dependency graph contains only:

- Existing AI Data Pack builders.
- Existing JSON/XLSX exporters.
- Existing metadata/actor normalization.
- ExportJob Mongoose model.
- Local artifact writer.

It does not import/inject/call:

- Google Ads read-only or mutation services.
- Facebook/Google/TikTok/Zalo advertising sync.
- `DataCollectionService`.
- `OrderSheetSyncService`.
- Ad-group auto-control, budget apply, provider validation or execution.
- Payment/statement/settlement/order recalculation.
- OpenAI/upload/action/live execution.

Additional guards:

- Cached schema has no `syncing` status.
- Cached metadata explicitly records `provider_sync_attempted=false`, `freshness_gate_evaluated=false`, `live_execution=false`.
- Failure audit stores only a bounded sanitized category/message. Tests cover secret, bearer token, email, phone and URL removal.
- Safe decision gates remain unchanged and existing tests still prove import/dry-run/live/ads-scale/strong-LTV false in the tested weak-data case.
- No new controller route or RBAC permission was added.

## 8. Tests Run

Initial verification:

```text
cd backend
npm run build
```

Result: passed.

```text
npm test -- --runInBand export-job
npm test -- --runInBand ai-data-pack
```

Initial result: failed because Nest Mongoose runtime reflection required explicit `String`/`Boolean` schema types for literal-only cached fields. The schema declarations were corrected.

Final verification:

```text
cd backend
npm run build
```

Result: passed.

```text
npm test -- --runInBand export-job
```

Result: passed, 1 suite / 10 tests.

```text
npm test -- --runInBand ai-data-pack
```

Result: passed, 3 suites / 30 tests.

```text
npx prettier --check src/ai-data-pack/export-jobs/*.ts src/ai-data-pack/contracts/metadata.contract.ts src/ai-data-pack/data-pack-metadata.service.ts src/ai-data-pack/export/json-exporter.service.ts src/ai-data-pack/ai-data-pack.module.ts
```

Result: passed.

Full repository tests were not run.

## 9. Acceptance Checklist

| Item | Status | Evidence |
|---|---|---|
| Build passes | passed | Final `npm run build` |
| Focused tests pass | passed | ExportJob 1/10; AI Data Pack 3/30 |
| ExportJob contract/model/service tested | passed | Schema/service/spec added |
| Cached wrapper reuses read-only builders/exporters | passed | Four existing builders plus JSON/XLSX services |
| Cached flag in job/artifact/metadata | passed | Schema, artifact record and rendered metadata tests |
| Duplicate active job enforced | passed | Unique active key plus concurrent reuse test |
| Artifact/checksum lifecycle tested | passed | Immutable write, traversal guard and checksum tests |
| Failure audit sanitized | passed | Failure-path redaction test |
| Existing GET exports side-effect-free | passed | Controller unchanged; controller tests and source guard pass |
| No provider call | passed | No production dependency and no provider execution |
| No action/import/dry-run/live execution | passed | No dependency; safe gate tests pass |
| No sheet/payment/settlement/recalculation/auto-control | passed | No production dependency |
| No source registry/freshness gate/provider adapter | passed | Only false `freshness_gate_evaluated` marker added |
| No public endpoint/full RBAC/download | passed | Controller unchanged |
| Prompt 4 docs complete | passed | Main report, JSON and review packet created |

## 10. Risks and Assumptions

- Local artifact retention/cleanup is not finalized. Files remain until a later approved retention policy/process is implemented.
- If a process crashes while a job is `pending` or `exporting`, `activeIdempotencyKey` remains reserved. Recovery/expiry is intentionally deferred; manual investigation is required.
- The unique active-job index depends on MongoDB index creation being enabled/applied in the deployment.
- Local artifact storage is not a multi-pod shared artifact store. Cloud/shared storage is out of scope.
- There is no public endpoint, status polling, download or RBAC path yet.
- Cached export proves neither freshness nor report-date coverage.
- Artifact checksum covers rendered bytes; data-content checksum covers normalized content. They serve different purposes.
- A failed multi-artifact job can retain already-written immutable artifacts and their audit entries.
- Full repository tests were not run.

## 11. Next Recommendation

Stop after Prompt 4 and upload the Prompt 4 result to ChatGPT Web Pro Extended for review.

If approved, the next separately authorized phase may be:

```text
PR-2.3B-2 Source Registry + DB-only Freshness/Coverage Gate
```

Do not auto-code PR-2.3B-2. Do not start a Google Ads/provider adapter, official/partial export, endpoint/RBAC/download work, action/live execution or Phase 3 before its separate review and authorization.
