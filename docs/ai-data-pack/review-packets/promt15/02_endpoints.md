# Endpoints

## POST /ai-data-pack/exports

Modes:

- `cached_export`
- `official_export`
- `partial_export`

Permissions:

- cached: `ai-data-pack.export.cached.create`
- official: `ai-data-pack.export.official.create`
- partial: `ai-data-pack.export.partial.create`

Delegation:

- cached calls `createCachedExport`
- official/partial calls `createOfficialPartialExportInternal`
- controller does not call provider code

## GET /ai-data-pack/exports/:jobId/status

Requires:

```text
ai-data-pack.export.status.read
```

Returns redacted status and manifest summary only.

## GET /ai-data-pack/exports/:jobId

Requires:

```text
ai-data-pack.export.status.read
```

Audit summary is included only with:

```text
ai-data-pack.export.audit.read
```

## GET /ai-data-pack/exports/:jobId/sync-summary

Requires:

```text
ai-data-pack.export.sync-detail.read
```

Allowed only for official/partial jobs and denied by default to manager, investor, external consultant, partial reviewer, and unassigned reviewer profiles.
