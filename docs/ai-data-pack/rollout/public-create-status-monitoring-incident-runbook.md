# Public Create/Status Monitoring And Incident Runbook

Phase: `PR-2.3B-4H`

This runbook is for controlled internal/admin no-download rollout only.

Reference alignment:

- OWASP Logging Cheat Sheet: application logs should support security and operational use cases and sensitive data should be removed, masked, sanitized, hashed, or encrypted.
- NIST SP 800-61 Rev. 3: incident response planning should help prepare, reduce impact, and improve detection, response, and recovery.

## Signals To Monitor

- `export_create_requested`
- `export_create_accepted`
- `export_create_denied`
- `export_status_viewed`
- `export_status_denied`
- `export_detail_viewed`
- `export_detail_denied`
- `sync_summary_viewed`
- `sync_summary_denied`
- `rate_limited`
- `redaction_profile_applied`
- `idempotent_request_reused`
- `invalid_request_rejected`
- denial by reason category
- audit persistence failures
- unexpected 5xx
- unexpected forbidden-field appearance

Structured log signal names:

- `ai_data_pack_export_create_requested_total`
- `ai_data_pack_export_create_denied_total`
- `ai_data_pack_export_status_read_total`
- `ai_data_pack_export_detail_read_total`
- `ai_data_pack_export_sync_summary_read_total`
- `ai_data_pack_export_rate_limited_total`
- `ai_data_pack_export_redaction_applied_total`
- `ai_data_pack_export_idempotency_reused_total`
- `ai_data_pack_export_denial_by_reason_total`

## Incident: Rate-Limit Spike

Symptoms:

- Elevated `rate_limited` audit/log events.
- Repeated create/status/sync-summary calls by same actor or profile.

Immediate containment:

- Tighten rate-limit environment keys.
- Restrict endpoint access at gateway/VPN if available.
- Temporarily remove public export permissions from suspicious users.

What to check:

- Actor/profile distribution.
- Endpoint name distribution.
- Whether limits are in-memory or shared CacheManager.
- Whether this is multi-pod traffic, which remains blocked for high-volume use.

Rollback/disable path:

- Remove role-permission binding from affected users/roles.
- Disable external access at gateway/reverse proxy if available.

Evidence to preserve:

- Endpoint audit records.
- Structured logs.
- Current rate-limit configuration.

Owner:

- Platform/backend owner with security review.

## Incident: Repeated Denied Access

Symptoms:

- Spike in `export_create_denied`, `export_status_denied`, `export_detail_denied`, or `sync_summary_denied`.

Immediate containment:

- Review and remove suspect role/profile permissions.
- Restrict access to admin/VPN only.

What to check:

- Denial reason category.
- Role/profile involved.
- Unknown job vs non-readable job behavior.
- Whether denial response leaked job existence.

Rollback/disable path:

- Remove endpoint permissions from affected roles/users.
- Disable route at gateway if available.

Evidence to preserve:

- Denied endpoint audit records.
- Correlation/request ids.
- Sanitized logs.

Owner:

- Security owner and auth owner.

## Incident: Audit Persistence Failure

Symptoms:

- Endpoint requests succeed or deny but no corresponding audit records appear.
- Mongoose/audit collection errors.

Immediate containment:

- Stop controlled rollout until persistence is restored.
- Keep logs enabled.

What to check:

- Mongoose connection.
- `ai_data_pack_endpoint_audits` collection.
- Schema registration.
- Database write errors.

Rollback/disable path:

- Remove endpoint permissions.
- Disable gateway exposure if available.

Evidence to preserve:

- Application logs.
- Database error logs.
- Deployment configuration.

Owner:

- Backend/database owner.

## Incident: Redaction Regression Suspicion

Symptoms:

- Response contains `artifactBytes`, `downloadToken`, `publicUrl`, `storageLocation`, `storageKey`, raw provider payload, stack trace, raw PII, action import, dry-run/live, or provider validateOnly/mutation markers.

Immediate containment:

- Disable endpoint exposure.
- Remove permissions from all non-admin users.
- Preserve the exact response sample securely.

What to check:

- Response redactor behavior.
- Controller/service code deployed version.
- Gateway or proxy response transformations.
- Logs and audit records for the request id.

Rollback/disable path:

- Roll back to last known accepted build.
- Keep audit records intact.

Evidence to preserve:

- Sanitized copy of response.
- Request id/correlation id.
- Endpoint audit record.
- Deployment version.

Owner:

- Backend owner and security owner.

## Incident: Unexpected Provider Dependency

Symptoms:

- Logs or stack traces indicate Google Ads mutation, provider validateOnly, OpenAI upload, action import, or execution service dependency from the public endpoint controller/service.

Immediate containment:

- Disable endpoint exposure.
- Stop rollout.

What to check:

- Public endpoint controller/service imports.
- Deployment artifact version.
- Static grep output.

Rollback/disable path:

- Roll back to Prompt 18 accepted build.

Evidence to preserve:

- Logs.
- Static grep result.
- Deployment artifact checksum/version.

Owner:

- Backend owner.

## Incident: Job Existence Leak Suspicion

Symptoms:

- Unauthorized caller can distinguish existing from nonexistent jobs.

Immediate containment:

- Restrict all status/detail/sync-summary endpoints to admin/director only.

What to check:

- HTTP status/body differences.
- Timing differences if relevant.
- Audit records for existing and nonexistent ids.

Rollback/disable path:

- Remove read permissions.
- Disable external exposure.

Evidence to preserve:

- Paired request/response samples.
- Audit records.

Owner:

- Security owner and backend owner.

## Incident: Storage Or Artifact Field Exposure Suspicion

Symptoms:

- Response or log includes storage path/key, artifact id usable for retrieval, public URL, download token, or artifact bytes.

Immediate containment:

- Disable endpoint exposure.
- Remove all non-admin access.
- Do not delete audit records.

What to check:

- Response redactor.
- Audit sanitizer.
- Structured logs.
- Any gateway or UI transformation.

Rollback/disable path:

- Roll back to accepted build or disable route at gateway.

Evidence to preserve:

- Sanitized response sample.
- Request id/correlation id.
- Audit/log records.

Owner:

- Security owner and backend owner.
