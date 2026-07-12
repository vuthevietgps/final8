# Response Headers, Audit, And Rate Limit

Allowed response headers:

- `Content-Type`
- `Content-Length`
- `Content-Disposition`
- `ETag`
- `X-AI-Data-Pack-Checksum`
- `X-AI-Data-Pack-Job-Id`
- `X-AI-Data-Pack-Artifact-Id`
- `X-AI-Data-Pack-Redaction-Profile`
- `X-AI-Data-Pack-Manifest-Only=false`

Filename pattern:

```text
ai-data-pack-<jobId-short>-<packType>-<format>-<redactionProfile>.<format>
```

Audit events added:

- `artifact_download_requested`
- `artifact_download_denied`
- `artifact_download_started`
- `artifact_download_completed`
- `artifact_download_failed`

Audit remains sanitized through the existing endpoint audit service. It does not store artifact bytes, raw file contents, raw storage path, storage key, raw provider payload, credentials, tokens, raw headers, or stack traces.

Rate-limit controls added:

- Per actor download attempts.
- Per actor/job download attempts.
- Per artifact download attempts.
- Denied download throttling through existing denial limiter.
- Max download file size.
- Max concurrent downloads per actor.

The implementation does not claim high-volume multi-pod readiness.
