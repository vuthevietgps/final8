# Downloaded JSON Validation

Validation target: rendered redacted JSON artifact downloaded from:

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

Expected JSON shape:

- Top-level metadata object exists.
- Metadata includes `export_job_id`.
- Metadata includes `export_mode`.
- Metadata includes `redaction_runtime=pre_rendered`.
- Metadata includes `artifact_rendering=rendered`.
- Metadata includes `download_ready=true`.
- Pack content sections exist under the rendered pack structure.

Automated evidence:

- Official lifecycle spec parses the rendered JSON content before artifact write.
- Official endpoint spec downloads the rendered JSON and asserts parsed body metadata.
- Cached endpoint spec also asserts parsed response body and safe response headers.

Forbidden content checks:

- No `storageKey`.
- No `storageLocation`.
- No `artifactStoragePath`.
- No `publicUrl`.
- No `downloadToken`.
- No raw provider payload.
- No credentials.
- No access tokens or refresh tokens.
- No OpenAI upload metadata.
- No action import metadata.

Result:

```text
downloaded_json_parseable=true
downloaded_json_has_no_storage_or_public_url=true
downloaded_json_has_no_known_secret_markers=true
```

