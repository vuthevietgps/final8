# Cached Export Lifecycle

Internal service only:

```text
AiDataPackExportJobService.createCachedExport
```

Flow:

```text
validate request/actor
-> compute idempotency
-> reuse active job or create pending job
-> exporting
-> existing read-only builder
-> minimal cached metadata
-> existing JSON/XLSX exporter
-> immutable artifact + audit
-> completed
```

Failure:

```text
builder/render/storage error
-> sanitized error category/message
-> failed
```

Supported packs:

- Director Data Pack
- Marketer Data Pack
- Data Quality Report
- Mapping Report

Supported formats: JSON and XLSX.

Minimal metadata:

```text
export_job_id
export_mode=cached_export
cached_export=true
sync_policy=export_cached
provider_sync_attempted=false
freshness_gate_evaluated=false
live_execution=false
```

Existing GET endpoints do not inject/call the ExportJob service and remain side-effect-free.
