# Recommended Design

Default recommendation:

```text
Option A first: authenticated direct download/proxy.
Option B later only if real browser/storage constraints require tokenized download.
```

## Why Option A First

Option A keeps the future implementation closer to the already accepted public endpoint shape:

- `JwtAuthGuard` can remain the entry gate.
- `SecretRedactionInterceptor` can remain active.
- `ExportEndpointPolicyService` can be extended instead of inventing a parallel permission path.
- `ExportEndpointAuditService` can persist every attempt with sanitized request metadata.
- `ExportEndpointRateLimitService` can add download buckets beside existing create/status/sync buckets.
- `ExportJobResponseRedactorService` remains the model for stripping metadata from non-byte responses.
- Tenant/job ownership and profile checks happen on every request.

## Future Direct Download Contract

Logical future route:

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

The deployment may still apply the existing global API prefix. The logical controller route should stay under the AI Data Pack export job surface.

The service must:

1. Authenticate the actor.
2. Reject all forbidden query/body/header override parameters.
3. Load job using a no-leak policy.
4. Check tenant/scope/job ownership/assignment.
5. Check download permission and redaction/section profile compatibility.
6. Check job and artifact eligibility.
7. Check file existence, file size, and checksum against the downloadable redacted artifact manifest.
8. Emit request, denial, start, complete, or failure audit events.
9. Stream/proxy bytes without exposing storage path or storage key.

## Future Token Contract If Option B Is Needed

Token creation route:

```text
POST /ai-data-pack/exports/:jobId/artifacts/:artifactId/download-token
```

Token use route:

```text
GET /ai-data-pack/download/:downloadToken
```

The token must be:

- Random and high entropy.
- Stored only as a hash.
- Short-lived.
- One-time by default, or limited-use with a strict replay counter.
- Bound to actor, tenant, job, artifact, format, redaction profile, section access profile, checksum, and expiry.
- Revocable on artifact revocation, job expiry, actor permission removal, or policy update.
- Audited on request, denial, creation, use, expiry, replay, and revocation.

Option B is not the default because it adds a second authorization surface.

