# Public Create/Status Environment And Config Checklist

Phase: `PR-2.3B-4H`

This checklist applies only to controlled internal/admin no-download rollout.

## Auth And Permission

- [ ] Auth role-permission mapping is deployed.
- [ ] `director` resolves cached/official/partial create, status read, audit read, sync-detail read, and allowed profile permissions.
- [ ] `manager` resolves cached/partial create and status read only; official create and sync-summary remain denied.
- [ ] `investor` resolves status read and investor-redacted profile only; detail and sync-summary remain denied.
- [ ] Employee, agent, supplier, lender, and other unbound roles remain denied unless explicitly permissioned and tested.
- [ ] JWT/current-user role resolution is verified in the target environment.
- [ ] Explicit `user.permissions` path is verified only for intended users.

## Database And Audit

- [ ] Mongoose connection is available.
- [ ] `ai_data_pack_endpoint_audits` collection is available.
- [ ] Jobless denied requests persist sanitized audit events.
- [ ] Rate-limited requests persist sanitized audit events.
- [ ] Audit details omit credentials, tokens, raw provider payloads, raw headers, raw request body, raw IP, raw user-agent, raw PII, storage keys, artifact bytes, public URLs, and download tokens.
- [ ] Audit records are retained according to operational policy.

## Cache And Rate Limits

- [ ] CacheManager is configured.
- [ ] `REDIS_URL` decision is documented.
- [ ] In-memory limiter is accepted only for single-process/internal use.
- [ ] Multi-pod or high-volume rollout is blocked until atomic limiter/platform limiter exists.

Rate-limit keys to review:

- `AI_DATA_PACK_EXPORT_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_CREATE_PER_MODE`
- `AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_SYNC_SUMMARY_PER_ACTOR_JOB`
- `AI_DATA_PACK_EXPORT_IDEMPOTENCY_REPLAY_PER_ACTOR_KEY`
- `AI_DATA_PACK_EXPORT_DENIAL_PER_ACTOR`
- `AI_DATA_PACK_EXPORT_MAX_DATE_RANGE_DAYS`
- `AI_DATA_PACK_EXPORT_MAX_PACK_TYPES`
- `AI_DATA_PACK_EXPORT_MAX_FORMATS`
- `AI_DATA_PACK_EXPORT_MAX_CONCURRENT_OFFICIAL_PER_ACTOR`

Minimum expected relationship:

- Official create is stricter than cached/partial.
- Sync-summary is stricter than status polling.
- Denial and idempotency replay throttling remain enabled.
- Date range, pack count, format count, and concurrent official export bounds remain enabled.

## Logging And Observability

- [ ] Structured endpoint logs are visible in the deployment logging system.
- [ ] Log retention policy is documented.
- [ ] Operator knows where to search for:
  - `ai_data_pack_export_create_requested_total`
  - `ai_data_pack_export_create_denied_total`
  - `ai_data_pack_export_status_read_total`
  - `ai_data_pack_export_detail_read_total`
  - `ai_data_pack_export_sync_summary_read_total`
  - `ai_data_pack_export_rate_limited_total`
  - `ai_data_pack_export_redaction_applied_total`
  - `ai_data_pack_export_idempotency_reused_total`
  - `ai_data_pack_export_denial_by_reason_total`
- [ ] Logs use bounded labels only: endpoint name, export mode, status, redaction profile, reason category.
- [ ] Logs do not include job id, idempotency key, raw actor id, raw tenant id, raw IP, raw user-agent, provider account, or raw error message.

## Forbidden Surface Check

- [ ] No download route.
- [ ] No download-token route.
- [ ] No artifact bytes.
- [ ] No public URL.
- [ ] No raw storage path/full storage key.
- [ ] No OpenAI upload.
- [ ] No action import.
- [ ] No approval workflow.
- [ ] No dry-run or live execution.
- [ ] No provider mutation.
- [ ] No provider validateOnly.
- [ ] No new provider adapter.
- [ ] No Phase 3 behavior.
