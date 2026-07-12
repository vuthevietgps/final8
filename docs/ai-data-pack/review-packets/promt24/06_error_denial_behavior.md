# Error And Denial Behavior

Safe status behavior:

- `403`: missing permission, profile mismatch, manager official/full denied, system worker denied.
- `404`: unknown job, owner/assignment mismatch, unassigned reviewer, unknown artifact where existence must not leak.
- `409`: not ready, manifest-only, official/partial deferred, file missing, checksum mismatch, size mismatch.
- `413`: artifact exceeds configured max download file size.
- `429`: rate limit or concurrent download limit.

Responses and audit must not leak:

- Storage key.
- Storage location.
- Storage path.
- Public URL.
- Artifact bytes in JSON.
- Raw provider payload.
- Credentials or tokens.
- Stack trace.

Official/partial `artifactRendering=deferred` or `redactionRuntime=manifest_only` returns `409` and is not streamed.
