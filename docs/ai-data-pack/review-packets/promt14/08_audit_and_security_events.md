# 08 Audit And Security Events

Endpoint audit events:

- `export_create_requested`
- `export_create_denied`
- `export_create_accepted`
- `export_status_viewed`
- `export_status_denied`
- `export_detail_viewed`
- `export_detail_denied`
- `sync_summary_viewed`
- `sync_summary_denied`
- `rbac_denied`
- `redaction_profile_applied`
- `idempotent_request_reused`
- `invalid_request_rejected`

Each event must include:

- actor
- profile
- permission checked
- `jobId` if known
- `exportMode` if known
- `redactionProfile`
- idempotency key hash
- timestamp
- sanitized reason
- no secrets

Security rules:

- Never audit raw tokens.
- Never audit raw provider payloads.
- Never audit stack traces in user-visible or exported metadata.
- Audit exact internal denial reason, but return generic denial externally.
