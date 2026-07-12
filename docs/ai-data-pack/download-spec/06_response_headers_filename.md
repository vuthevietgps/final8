# Response Headers And Filename

This contract applies to a future direct or tokenized download response.

## Allowed Headers

The future response may include:

```text
Content-Type
Content-Length
Content-Disposition
ETag
X-AI-Data-Pack-Checksum
X-AI-Data-Pack-Job-Id
X-AI-Data-Pack-Artifact-Id
X-AI-Data-Pack-Redaction-Profile
X-AI-Data-Pack-Manifest-Only
```

Header values must be sanitized and bounded. Do not include raw PII or sensitive business detail in headers.

## Forbidden Headers And Values

The response must not include:

- Raw storage path.
- Storage key.
- Public bucket URL.
- Signed URL.
- Provider payload.
- Credentials.
- Tokens.
- Raw PII.
- Stack trace.
- Debug metadata.
- Customer name.
- Provider account name.
- Employee name.
- Supplier confidential detail.

## Content Types

Allowed formats:

| Format | Content-Type |
|---|---|
| `json` | `application/json` |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

No other format is allowed in this MVP download surface.

## Filename

Filename pattern:

```text
ai-data-pack-<jobId-short>-<packType>-<format>-<redactionProfile>.json
ai-data-pack-<jobId-short>-<packType>-<format>-<redactionProfile>.xlsx
```

Rules:

- `jobId-short` is a safe bounded prefix or suffix, not a raw unbounded ID.
- `packType`, `format`, and `redactionProfile` must be allowlisted enum values.
- Use `Content-Disposition: attachment`.
- No customer name.
- No raw provider account.
- No employee name.
- No supplier name.
- No sensitive business detail.
- No path separators.
- No Unicode control characters.
- No client-supplied filename.

## Checksum And Size

Before streaming:

- File size must match manifest/artifact metadata.
- SHA-256 checksum must match the redacted downloadable artifact checksum.
- Any mismatch must deny streaming and audit `artifact_download_failed` with a sanitized reason category.

