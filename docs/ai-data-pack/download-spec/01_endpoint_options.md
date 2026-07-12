# Endpoint Options

This spec compares two future endpoint options. Neither option is implemented in PR-2.3B-5A.

## Option A: Direct Authenticated Download

Future route:

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

Characteristics:

- Requires authenticated ERP user.
- Runs RBAC, tenant ownership, job ownership/assignment, redaction profile, section access, artifact eligibility, rate-limit, and audit checks at request time.
- Server streams or proxies the already-rendered redacted artifact.
- Does not return or create a public URL.
- Does not need a download token.
- Keeps request ownership and audit simpler.
- Keeps forbidden request parameters easier to reject centrally.

Primary risks:

- Browser/file download behavior must preserve auth cookies or bearer auth.
- Large files require streaming and backpressure controls.
- Controller/service must not expose the underlying storage key or absolute path.

## Option B: Two-Step Short-Lived Token

Future routes:

```text
POST /ai-data-pack/exports/:jobId/artifacts/:artifactId/download-token
GET  /ai-data-pack/download/:downloadToken
```

Characteristics:

- First step requires authenticated ERP user.
- Token is short-lived, one-time or limited-use, revocable, and bound to actor, tenant, job, artifact, export mode, format, redaction profile, section access profile, and checksum.
- Second step uses the token to stream the already-rendered redacted artifact.
- Useful if the browser download flow cannot reliably keep authenticated headers or if storage/proxy constraints require a decoupled GET.

Primary risks:

- Larger attack surface.
- Requires token storage, hashing, expiry, replay controls, revocation, and token audit events.
- Token URL can be copied; it must not be a public bucket URL or signed storage URL.
- More complex failure and rate-limit behavior.

## Explicitly Forbidden For Both Options

- Signed storage URL.
- Public bucket URL.
- Returning raw `storageKey` or `storageLocation`.
- Returning artifact bytes before RBAC/profile/tenant/job/artifact validation.
- Client-controlled redaction overrides.
- OpenAI upload.
- Action import.
- Approval, dry-run, live execution, provider mutation, or provider validateOnly.

