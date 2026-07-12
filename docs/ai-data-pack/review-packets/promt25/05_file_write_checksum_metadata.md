# File Write, Checksum, And Metadata

File writing:

- Uses `ExportJobArtifactService`.
- Writes under configured artifact root.
- Uses safe path segment validation.
- Rejects path traversal.
- Writes immutable file with `wx`.

Metadata:

- `fileSizeBytes` is recorded from the rendered buffer.
- `artifactChecksum` is SHA-256 of rendered bytes.
- `checksumAlgorithm=sha256`.
- `downloadReady=true` only after successful write.

Failure behavior:

- Render failure marks `artifactRendering=failed`.
- Manifest remains `downloadReady=false`.
- Job fails safely.
- Sanitized error state is stored.
- Raw filesystem path and token-like values are redacted in failure messages.
