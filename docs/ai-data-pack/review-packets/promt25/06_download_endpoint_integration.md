# Download Endpoint Integration

Prompt 24 route remains:

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

Additional artifact-level gates:

- `artifactClass` must be `downloadable_redacted_artifact`.
- `downloadReady` must not be false.
- `redactionRuntime` must not be `manifest_only`.
- `artifactRendering` must be `rendered` if present.

The endpoint can stream official rendered JSON artifacts.

The endpoint still blocks:

- Manifest-only artifacts.
- Deferred artifacts.
- Failed artifacts.
- Raw/internal artifacts.
- Checksum mismatch.
- Size mismatch.
- RBAC/profile/section/ownership mismatch.

No tokenized route, public URL, storage path response, OpenAI upload, action import, dry-run/live, provider mutation, or provider validateOnly was added.
