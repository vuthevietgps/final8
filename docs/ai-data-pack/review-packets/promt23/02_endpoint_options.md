# Endpoint Options

## Option A

```text
GET /ai-data-pack/exports/:jobId/artifacts/:artifactId/download
```

Properties:

- Authenticated human ERP user.
- RBAC checked at request time.
- Tenant/job/artifact/profile/section checks before stream.
- Server streams/proxies artifact.
- No public URL.
- No download token.
- Easier audit and denial behavior.

## Option B

```text
POST /ai-data-pack/exports/:jobId/artifacts/:artifactId/download-token
GET  /ai-data-pack/download/:downloadToken
```

Properties:

- Token creation requires authenticated user.
- Token is short-lived, one-time or limited-use, hashed at rest, bound to actor/job/artifact/redaction profile.
- Useful only if browser or storage constraints require decoupling.
- More complex and replay-sensitive.

## Shared Prohibitions

- No signed storage URL.
- No public bucket URL.
- No raw storage path or key in response.
- No OpenAI upload.
- No action import.
- No dry-run/live/provider mutation/provider validateOnly.

