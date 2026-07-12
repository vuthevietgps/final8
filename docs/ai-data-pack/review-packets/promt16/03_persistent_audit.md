# Persistent Endpoint Audit

The implementation added a dedicated endpoint audit schema and persistent audit path:

- `backend/src/ai-data-pack/audit/export-endpoint-audit.schema.ts`
- `backend/src/ai-data-pack/audit/export-endpoint-audit.service.ts`

Collection:

- `ai_data_pack_endpoint_audits`

Stored audit fields include:

- `auditId`
- `event`
- `actorId`
- `jobId`
- `status`
- `reason`
- sanitized `details`
- safety flags `canImportActionFile=false`, `canDryRun=false`, `canExecuteLive=false`

Sanitization:

- Forbidden detail keys are omitted instead of persisted with redacted values.
- Secret-like values are redacted.
- Public URL, storage path/key, artifact byte, download-token, provider validation, execution, OpenAI upload, and action-import keys are denied from endpoint audit details.

Behavior:

- Endpoint denials now call persistent audit paths.
- Jobless denied create attempts are persisted.
- Unknown and unauthorized job access still return indistinguishable public denial behavior while audit captures the attempt.

Residual risk:

- This is a dedicated endpoint audit collection, not a centralized enterprise audit pipeline. That is acceptable for Prompt 16 but should be revisited before broader production rollout.
