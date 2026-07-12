# Security and No-Sync Guard

## Production Dependencies

The new service injects only:

- ExportJob Mongoose model.
- Existing Director/Marketer/Data Quality/Mapping builders.
- Existing metadata, JSON and XLSX services.
- Local artifact service.

It does not inject or call provider, action, sheet, payment, settlement, recalculation, auto-control, OpenAI or live-execution services.

## Cached-only Controls

- Schema enums only allow `cached_export` and `export_cached`.
- Lifecycle excludes `syncing`.
- Job and metadata explicitly record:

```text
provider_sync_attempted=false
freshness_gate_evaluated=false
live_execution=false
```

- Existing GET controller does not reference ExportJob.
- No public endpoint or permission change was added.

## Error and Artifact Safety

- Failure audit stores a sanitized bounded category/message only.
- No raw stack trace is stored.
- Test removes secret, bearer token, email, phone and URL.
- Artifact path segments are validated and traversal is rejected.
- Only a relative storage key is persisted.
- Artifact writes are immutable (`wx`).

## Decision Safety

Existing AI Data Pack tests still prove import, dry-run, live execution, ads scale and strong LTV remain false for the tested weak-data state.
