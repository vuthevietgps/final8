# Audit And Security

Endpoint audit service:

```text
backend/src/ai-data-pack/audit/export-endpoint-audit.service.ts
```

Events implemented:

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

Security behavior:

- job-known events are appended to the export job audit history
- invalid/denied jobless events are recorded in the endpoint audit service
- audit details are sanitized
- secrets, credentials, raw provider payloads, raw queries, URLs, stack traces, artifact bytes, and storage paths are redacted from audit details

Production hardening note:

Jobless audit events should be routed to a persistent central audit sink in a later hardening phase.
