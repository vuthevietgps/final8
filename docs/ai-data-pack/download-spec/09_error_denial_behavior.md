# Error And Denial Behavior

Future download errors must be safe and boring. They must not reveal existence, storage, provider, or sensitive business detail.

## Safe Responses

| Case | Response |
|---|---|
| Missing permission | `403` generic access denied |
| Profile/section mismatch | `403` generic access denied |
| Tenant/job ownership mismatch | `404` style generic not found when existence must not leak |
| Invalid `jobId` or `artifactId` shape | `404` style generic not found or `400` generic invalid request, per route policy |
| Job not completed | `409` not ready |
| `artifact_rendering=deferred` | `409` not ready |
| `redaction_runtime=manifest_only` with no rendered file | `409` not ready |
| Artifact expired or revoked | `410` gone |
| Token expired or revoked, if tokenized | `410` gone |
| Rate limited | `429` generic rate limited |
| Checksum/size mismatch | `500` or `409` sanitized internal artifact unavailable |
| Unexpected internal error | `500` sanitized internal error |

## No-Leak Requirements

Responses must not leak:

- Job existence when actor is not authorized.
- Artifact existence when actor is not authorized.
- Whether a different tenant owns the job.
- Whether a full director artifact exists.
- Source/provider details.
- Provider account IDs beyond authorized profile.
- Storage location.
- Storage key.
- Exact filesystem or bucket error.
- Sensitive reason with finance, employee, supplier, customer, or campaign detail.
- Stack traces.

## Audit Versus Response

Audit may store sanitized reason categories such as:

```text
missing_permission
profile_mismatch
job_not_found_for_requester
artifact_not_ready
artifact_expired
checksum_mismatch
rate_limited
```

The user-facing response should remain generic.

