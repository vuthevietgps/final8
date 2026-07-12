# Artifact Rendering Implementation

Rendering point:

```text
requested -> pre_assessing -> syncing_sources -> post_assessing -> snapshotting -> exporting -> render JSON artifact -> completed/completed_with_warnings
```

The render step:

- Uses existing ERP pack builders.
- Does not fetch provider data live.
- Does not call external APIs.
- Does not mutate providers.
- Attaches policy-bound metadata.
- Uses `JsonExporterService.stableStringify`, which applies existing redaction utility.
- Writes through `ExportJobArtifactService`.
- Persists artifact metadata only after successful file write.

Supported:

- `official_export` JSON.
- `partial_export` JSON.

Not supported yet:

- Official/partial XLSX.

Unsupported XLSX behavior:

- Emits `artifact_render_skipped_not_supported`.
- Adds warning `artifact_render_skipped_not_supported:xlsx`.
- Does not create a fake artifact.
