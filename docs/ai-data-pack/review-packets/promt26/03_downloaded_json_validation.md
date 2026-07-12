# Downloaded JSON Validation

Validation passed through existing focused tests:

- Rendered official artifact content is parsed as JSON before write.
- Downloaded official endpoint response body is parsed and metadata is asserted.
- Download headers include checksum and `x-ai-data-pack-manifest-only=false`.
- Storage path, public URL, and download token are absent from response headers.

Expected metadata:

- `export_job_id`
- `export_mode`
- `redaction_runtime=pre_rendered`
- `artifact_rendering=rendered`
- `download_ready=true`

Forbidden markers:

- `storageKey`
- `storageLocation`
- `artifactStoragePath`
- `publicUrl`
- `downloadToken`
- `artifactBytes`
- `rawProviderResponse`
- credentials or tokens

