# ExportJob Contract

## Persistence

- Mongoose code-first schema.
- Collection: `ai_data_pack_export_jobs`.
- No SQL migration.
- Prompt 4 did not connect to or modify a database.

## Cached-only Invariants

```text
exportMode=cached_export
syncPolicy=export_cached
cachedExport=true
providerSyncAttempted=false
freshnessGateEvaluated=false
liveExecution=false
```

Statuses:

```text
pending
exporting
completed
failed
```

The schema has no `syncing` status.

## Audit Fields

```text
jobId
reportDate
packTypes
formats
requestedByUserId/Role/Display
requestedAt/startedAt/completedAt/failedAt
policyVersion
idempotencyKey
artifacts
errorCategory
sanitizedErrorMessage
```

## Artifacts

```text
artifactId
packType
format
fileName
storageKey
artifactChecksum
dataContentChecksum
fileSizeBytes
createdAt
cachedExport=true
```

## Idempotency

Normalized key components:

```text
reportDate + sorted packTypes + sorted formats
+ cached_export + export_cached + policyVersion + requestedByUserId
```

Equivalent active requests return/reuse the existing active job. A unique partial `activeIdempotencyKey` index protects concurrent creation.
