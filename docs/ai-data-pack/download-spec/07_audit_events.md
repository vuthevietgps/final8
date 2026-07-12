# Audit Events

Every future download attempt must be audited, including denied, failed, expired, and rate-limited attempts.

## Required Artifact Download Events

```text
artifact_download_requested
artifact_download_denied
artifact_download_started
artifact_download_completed
artifact_download_failed
```

## Required Token Events If Option B Is Implemented

```text
download_token_requested
download_token_denied
download_token_created
download_token_used
download_token_expired
download_token_revoked
download_token_replayed
```

## Sanitized Audit Fields

Audit records may include:

- actor id or sanitized actor reference.
- role/profile.
- tenant/scope id or sanitized reference.
- `jobId`.
- `artifactId`.
- `exportMode`.
- `packType`.
- `format`.
- `redactionProfile`.
- `sectionAccessProfile`.
- permission checked.
- result.
- reason category.
- request id or correlation id.
- route template and method.
- IP hash if available.
- user-agent hash if available.
- timestamp.
- bytes served if safe.
- checksum if safe.
- token id hash if tokenized.

## Never Audit

- Artifact bytes.
- Raw file contents.
- Raw storage path.
- Storage key.
- Public or signed URL.
- Raw provider payload.
- Credentials.
- Tokens or token plaintext.
- Raw PII.
- Raw request body.
- Raw headers.
- Raw IP or raw user-agent.
- Raw stack trace.

## Reuse Guidance

Future implementation should extend `ExportEndpointAuditService` or a successor rather than creating a separate unsanitized audit path. Existing sanitized request metadata fields should be reused:

```text
requestId
correlationId
routeTemplate
method
ipHash
userAgentHash
```

If a central immutable security ledger is later approved, write sanitized download events there as well, but do not block the spec on inventing that pattern.

