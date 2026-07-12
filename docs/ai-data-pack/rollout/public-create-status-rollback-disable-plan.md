# Public Create/Status Rollback And Disable Plan

Phase: `PR-2.3B-4H`

Rollback must not delete audit records. Rollback must not enable download/action/live/provider mutation. Rollback must preserve evidence for incident review.

## Preferred No-Code Exposure Controls

Use the least invasive control that stops unsafe exposure:

1. Remove AI Data Pack export permissions from affected users.
2. Remove or reduce role-permission binding for the rollout cohort.
3. Restrict endpoint access at gateway/reverse proxy if available.
4. Restrict access to admin IP/VPN if available.
5. Disable external access while preserving internal admin access if safe.
6. Tighten rate-limit config.
7. Increase logging/audit review.

## Permission Rollback

Actions:

- Remove explicit `ai-data-pack.export.*` permissions from affected users.
- Remove rollout cohort membership.
- Confirm manager/investor limitations still hold.
- Confirm unbound roles are denied.

Do not:

- Add broader permissions as a workaround.
- Grant `sync-detail` or audit read to default-denied profiles.
- Enable system worker profile on human public endpoints.

## Gateway/Reverse Proxy Disable

Actions if gateway/reverse proxy policy exists:

- Restrict `/api/ai-data-pack/exports` or equivalent app route prefix to admin/VPN allowlist.
- Block external access to:
  - `POST /ai-data-pack/exports`
  - `GET /ai-data-pack/exports/:jobId/status`
  - `GET /ai-data-pack/exports/:jobId`
  - `GET /ai-data-pack/exports/:jobId/sync-summary`

Do not:

- Add redirects to download or artifact URLs.
- Expose storage paths.

## Rate-Limit Tightening

Actions:

- Lower create per actor.
- Lower official create per actor.
- Lower sync-summary per actor/job.
- Lower denial threshold if probing is suspected.
- Keep idempotency replay throttling enabled.

Do not:

- Disable rate limits.
- Treat non-atomic CacheManager increments as sufficient for high-volume multi-pod public exposure.

## Audit And Evidence Preservation

Preserve:

- Endpoint audit records.
- Structured logs.
- Request ids and correlation ids.
- Deployment version and configuration.
- Sanitized response/request samples for incident review.

Do not:

- Delete `ai_data_pack_endpoint_audits`.
- Purge logs before retention period.
- Edit incident evidence outside approved incident process.

## Rollback Completion Criteria

Rollback is complete only when:

- Unsafe or disputed exposure path is blocked.
- Affected permissions are removed or restricted.
- Audit/log evidence is preserved.
- Follow-up owner is assigned.
- A go/no-go decision is recorded before re-enabling.
