# Public Create/Status Execution Checklist

Phase: `PR-2.3B-4I`

Scope: controlled internal/admin execution checklist for the no-download AI Data Pack create/status/detail/sync-summary surface.

This checklist is not a deployment action by itself. It is a fillable execution control for a human/operator rollout.

Allowed endpoints:

- `POST /ai-data-pack/exports`
- `GET /ai-data-pack/exports/:jobId/status`
- `GET /ai-data-pack/exports/:jobId`
- `GET /ai-data-pack/exports/:jobId/sync-summary`

Forbidden throughout execution:

- Download, download token, artifact bytes, public URL, storage path/key.
- OpenAI upload.
- Action import.
- Approval workflow.
- Dry-run/live execution.
- Provider mutation or provider validateOnly.
- New provider adapter.
- Phase 3.

## Checklist

| Group | Item | Owner | Evidence required | Pass/fail | Notes | blocking_if_failed |
|---|---|---|---|---|---|---|
| Pre-flight owner confirmation | Confirm rollout is controlled internal/admin only. | Business/director owner | Signed go/no-go or rollout ticket. |  |  | true |
| Pre-flight owner confirmation | Confirm high-volume public rollout remains blocked. | Security/platform owner | Blocker register linked. |  |  | true |
| Pre-flight owner confirmation | Confirm download phase is not opened. | Technical owner | Signoff note. |  |  | true |
| Deployment environment confirmation | Confirm target environment name and release candidate id. | Technical owner | Environment and build identifier. |  |  | true |
| Deployment environment confirmation | Confirm access is internal/admin, VPN, allowlist, or equivalent. | Operator/support owner | Gateway/network rule evidence or manual restriction note. |  |  | true |
| Auth/permission confirmation | Verify director/admin role or explicit permission path. | Technical owner | Test user id and permission evidence. |  |  | true |
| Auth/permission confirmation | Verify manager official create remains denied. | Tester | Smoke worksheet result. |  |  | true |
| Auth/permission confirmation | Verify investor remains status-only if enabled. | Tester | Smoke worksheet result. |  |  | true |
| Auth/permission confirmation | Verify unbound role, system worker, and unassigned reviewer are denied. | Tester | Smoke worksheet result. |  |  | true |
| Audit/log confirmation | Confirm `ai_data_pack_endpoint_audits` is available. | Operator/support owner | Collection check or audit record sample path. |  |  | true |
| Audit/log confirmation | Confirm denied/jobless attempt creates sanitized audit. | Tester | Audit record id/path. |  |  | true |
| Audit/log confirmation | Confirm structured logs are visible. | Operator/support owner | Log query/screenshot/path. |  |  | true |
| Rate-limit confirmation | Confirm limiter mode: Redis/CacheManager or accepted single-process in-memory. | Platform owner | Config evidence, `REDIS_URL` decision, or risk acceptance. |  |  | true |
| Rate-limit confirmation | Confirm rate-limit keys reviewed. | Platform owner | Config checklist link. |  |  | false |
| Endpoint smoke test confirmation | Complete smoke/UAT worksheet. | Tester | Filled worksheet link. |  |  | true |
| Endpoint smoke test confirmation | Confirm status/detail responses are redacted and manifest-only. | Tester | Response sample path. |  |  | true |
| Endpoint smoke test confirmation | Confirm sync-summary is privileged only. | Tester | Allowed and denied response evidence. |  |  | true |
| UAT signoff | Director/admin confirms output is useful and safe. | Business/director owner | Signed UAT note. |  |  | true |
| UAT signoff | Security/reviewer confirms no unsafe surfaces. | Security/reviewer | Signoff note and evidence links. |  |  | true |
| Go/no-go decision | Complete go/no-go signoff. | Release owner | Signoff document link. |  |  | true |
| Rollback readiness | Complete rollback drill checklist or tabletop. | Operator/support owner | Drill checklist link. |  |  | true |
| Rollback readiness | Confirm audit records will not be deleted during rollback. | Security/reviewer | Rollback checklist signoff. |  |  | true |
| Post-rollout monitoring window | Define monitoring window start/end. | Operator/support owner | Monitoring plan entry. |  |  | true |
| Post-rollout monitoring window | Assign owner for first response during monitoring window. | Operator/support owner | On-call/contact placeholder. |  |  | true |
| Post-rollout monitoring window | Complete post-rollout report after window. | Operator/support owner | Report link. |  |  | false |

## Execution Rule

Any `blocking_if_failed=true` item stops controlled rollout execution until the owner records a fix, explicit risk acceptance, or rollback decision.
