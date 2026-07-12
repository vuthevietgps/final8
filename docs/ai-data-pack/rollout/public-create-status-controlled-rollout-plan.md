# Public Create/Status Controlled Rollout Plan

Phase: `PR-2.3B-4H`

Scope: controlled internal/admin rollout for the existing no-download AI Data Pack public/admin endpoints:

- `POST /ai-data-pack/exports`
- `GET /ai-data-pack/exports/:jobId/status`
- `GET /ai-data-pack/exports/:jobId`
- `GET /ai-data-pack/exports/:jobId/sync-summary`

This rollout is accepted only for controlled internal/admin no-download use. It is not accepted for high-volume multi-pod public exposure until platform gates are met.

## Purpose

Allow a small controlled audience to request and inspect AI Data Pack export job metadata, status, detail, and privileged sync-summary data without exposing artifact bytes, download tokens, storage paths, OpenAI upload, action import, approval, dry-run/live execution, provider mutation, provider validateOnly, or Phase 3 behavior.

## Allowed Audience

- Director/admin users with role-bound or explicit AI Data Pack permissions.
- Internal reviewers with explicit permissions and compatible redaction/section profiles.
- Managers only within role/profile limits: cached/partial create and status for allowed jobs; no official create and no sync-summary by default.
- Investors only if explicitly intended for redacted status-only behavior.

## Forbidden Audience And Traffic

- External high-volume public traffic.
- Anonymous users.
- Unbound employee/agent/supplier/lender roles unless explicit safe permissions are granted and tested.
- System worker profiles on human public endpoints.
- Unassigned reviewers.

## Allowed Endpoints

| Endpoint | Rollout use |
|---|---|
| `POST /ai-data-pack/exports` | Controlled cached/official/partial job creation according to role/profile permission. |
| `GET /ai-data-pack/exports/:jobId/status` | Redacted manifest-only job status. |
| `GET /ai-data-pack/exports/:jobId` | Redacted manifest-only job detail; audit summary only when audit permission exists. |
| `GET /ai-data-pack/exports/:jobId/sync-summary` | Privileged sanitized sync summary for authorized official/partial jobs only. |

## Forbidden Surfaces

- Download or download-token routes.
- Artifact bytes or artifact retrieval.
- Public URL, storage path, or full storage key.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run or live execution.
- Provider mutation or provider validateOnly.
- New provider adapter.
- Performance Max, Shopping, Display, YouTube, delete actions, or Phase 3.

## Deployment Assumptions

- Prompt 18 final acceptance freeze remains valid.
- Rollout is single-process or low-volume controlled internal/admin unless a shared CacheManager/Redis path is explicitly accepted.
- In-memory limiter is accepted only for single-process/internal use.
- `ai_data_pack_endpoint_audits` collection is available.
- Structured endpoint logs are visible to operators.
- No gateway/reverse-proxy rule exposes these endpoints to broad public traffic.

## Pre-Deployment Checklist

- [ ] Confirm this is a controlled internal/admin rollout, not high-volume public exposure.
- [ ] Confirm auth role-permission binding is deployed.
- [ ] Verify director/admin permissions resolve through role or explicit user permissions.
- [ ] Verify manager and investor limitations are intentionally accepted.
- [ ] Confirm Mongoose connection is available.
- [ ] Confirm endpoint audit persistence works.
- [ ] Decide and document `REDIS_URL`: configured shared cache or accepted single-process in-memory limiter.
- [ ] Review all rate-limit environment keys.
- [ ] Confirm structured logs are visible in the deployment logging path.
- [ ] Confirm no download/action/live/provider mutation route is exposed at app or gateway level.

## Deployment Steps

1. Deploy the already accepted build containing Prompts 15-18 public endpoint behavior.
2. Restrict access to internal/admin network, VPN, allowlist, or equivalent gateway policy if available.
3. Enable only the intended users/roles.
4. Confirm audit persistence by triggering one safe denied request in a non-production or controlled environment.
5. Confirm structured logs show create/status/detail/sync-summary signals without raw secrets, PII, storage keys, or provider payloads.
6. Run the smoke/UAT checklist before declaring rollout active.

## Post-Deployment Verification

- [ ] Director cached create succeeds with redacted manifest-only response.
- [ ] Manager official create is denied.
- [ ] Investor detail and sync-summary are denied.
- [ ] Unbound role is denied.
- [ ] Status/detail responses do not include artifact bytes, download token, public URL, storage path, raw provider payload, or execution actions.
- [ ] Denied/jobless/rate-limited attempts are audited.
- [ ] Structured log signals are emitted with bounded labels only.

## Go/No-Go Criteria

Go only when:

- Controlled audience is verified.
- Smoke/UAT passes.
- Audit and logs are visible.
- No forbidden fields or actions appear in responses.
- Rate limits are configured and accepted for the deployment shape.

No-go when:

- Any unsafe surface appears.
- Audit persistence fails.
- Role/profile behavior differs from Prompt 18.
- Gateway exposure permits broad unauthenticated or high-volume public access.
- High-volume platform gates are unmet but traffic plan depends on multi-pod/public exposure.

## Rollback Criteria

Rollback or disable exposure immediately when:

- Download/artifact/action/provider/OpenAI behavior appears.
- Public response leaks storage path/key, public URL, artifact bytes, token, raw provider data, stack trace, or raw PII.
- Job existence leak is suspected.
- Audit persistence fails for denied/jobless attempts.
- Repeated 5xx or rate-limit bypass behavior appears.

## Manual Owner Checklist

- Business owner: confirms controlled internal/admin audience only.
- Security owner: confirms no unsafe surface and accepts domain-local endpoint audit for controlled rollout.
- Platform owner: confirms limiter mode and high-volume blockers.
- Operator: confirms smoke/UAT, logs, and audit evidence.
- Director/admin: confirms UAT outcome and go/no-go decision.
