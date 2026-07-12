# 02 Endpoint Inventory

Future endpoints specified:

| Endpoint | Purpose | Required permission | Download scope |
|---|---|---|---|
| `POST /ai-data-pack/exports` | Request cached, official, or partial export. | Mode-specific create permission. | Out of scope |
| `GET /ai-data-pack/exports/:jobId/status` | Read redacted status summary. | `ai-data-pack.export.status.read` | Out of scope |
| `GET /ai-data-pack/exports/:jobId` | Read redacted job detail and manifest summary. | `ai-data-pack.export.status.read`; audit detail requires audit read. | Out of scope |
| `GET /ai-data-pack/exports/:jobId/sync-summary` | Read sanitized source-sync summary. | `ai-data-pack.export.sync-detail.read` | Out of scope |

No endpoint returns:

- artifact bytes
- download token
- public URL
- full storage key
- raw provider payload
- raw PII
- action import/dry-run/live options
