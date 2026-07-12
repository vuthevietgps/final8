# Public Surface Contract

This is a spec only; no endpoint is implemented.

| Surface | Purpose | Permission | Forbidden input | Output | Audit |
|---|---|---|---|---|---|
| Internal service method | Start prepared export job | service identity plus mode permission | raw token, raw provider query, mutation/action payload | job ID/status | `export_requested` |
| Future create endpoint | Request export | create permission by mode | provider credentials, query, action plan, dry-run/live flags | job summary | `export_requested` |
| Future status endpoint | Read status | `ai-data-pack.export.status.read` | artifact storage path, token override | status and sanitized warnings | status/sync read event |
| Future download endpoint | Download artifact | artifact permission plus profile match | raw storage path, redaction override | file or denial | `artifact_downloaded` / `download_denied` |
| Future sync-detail endpoint | Inspect sync details | `ai-data-pack.export.sync-detail.read` | raw provider response, credentials | sanitized sync summary | `sync_detail_viewed` |
| Future audit endpoint | Inspect audit | `ai-data-pack.export.audit.read` | raw payload filters, secret filters | sanitized audit records | `sensitive_section_accessed` |

Denials must fail closed, return sanitized messages, and audit internal details without leaking secrets or raw payloads.
