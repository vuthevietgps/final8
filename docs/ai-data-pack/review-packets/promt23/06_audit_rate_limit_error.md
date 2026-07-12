# Audit, Rate Limit, And Error Behavior

## Audit

Required events:

```text
artifact_download_requested
artifact_download_denied
artifact_download_started
artifact_download_completed
artifact_download_failed
download_token_requested
download_token_denied
download_token_created
download_token_used
download_token_expired
download_token_revoked
download_token_replayed
```

Never audit artifact bytes, raw file contents, raw storage path, storage key, provider payload, credentials, tokens, raw PII, raw request body, raw headers, raw IP/user-agent, or stack traces.

## Rate Limit

Required controls:

- Per actor download attempts.
- Per actor/job attempts.
- Per artifact attempts.
- Denied/failed throttling.
- Token creation/use/replay throttling if tokenized.
- Large file and concurrent download limits.

Prompt 18 high-volume blocker still applies: non-atomic limiter and missing central ledger block broad public exposure.

## Errors

Safe responses:

- `403` generic missing permission/profile mismatch.
- `404` style no-leak tenant/job ownership mismatch.
- `409` not ready for not completed, deferred rendering, or manifest-only artifact.
- `410` expired/revoked artifact or token.
- `429` rate limited.
- `500` sanitized internal error.

