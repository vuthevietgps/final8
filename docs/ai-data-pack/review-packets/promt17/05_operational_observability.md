# Operational Observability

No Prometheus/OpenTelemetry metrics framework was found in the repo.

Prompt 17 added bounded structured logs through the existing Nest `Logger` pattern:

- `backend/src/ai-data-pack/observability/export-endpoint-observability.service.ts`

Observable signal names:

- `ai_data_pack_export_create_requested_total`
- `ai_data_pack_export_create_denied_total`
- `ai_data_pack_export_status_read_total`
- `ai_data_pack_export_detail_read_total`
- `ai_data_pack_export_sync_summary_read_total`
- `ai_data_pack_export_rate_limited_total`
- `ai_data_pack_export_redaction_applied_total`
- `ai_data_pack_export_idempotency_reused_total`
- `ai_data_pack_export_denial_by_reason_total`

Bounded labels:

- `endpointName`
- `exportMode`
- `status`
- `redactionProfile`
- `reasonCategory`

Forbidden labels are not emitted:

- `jobId`
- idempotency key
- raw actor id
- raw tenant id
- raw IP
- raw user-agent
- provider account
- raw error message

Residual gap:

- Structured logs are not a metrics backend. A future phase can wire these signals to the platform metrics stack if one is adopted.
