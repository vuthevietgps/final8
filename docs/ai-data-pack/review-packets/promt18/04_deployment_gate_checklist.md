# Deployment Gate Checklist

## Controlled Internal/Admin Gate

Status: `met_with_conditions`.

Required checks:

- [x] Auth role-permission binding is active.
- [x] JWT/current-user claims or role resolution include expected export permissions.
- [x] Endpoint audit collection is available when the AI Data Pack module is loaded with Mongoose.
- [x] CacheManager is configured, or in-memory limiter is explicitly accepted for single-process/internal use.
- [x] Structured endpoint logs are visible to operators.
- [x] Static safety checks are reviewed.
- [x] Required tests and build passed.
- [x] Download/action/live/provider mutation surfaces remain disabled.

Operational condition:

- Do not treat this as approval for high-volume public traffic unless the high-volume gate below is met.

## High-Volume/Multi-Pod Gate

Status: `blocked_until_platform_gates`.

Required before exposure:

- Atomic Redis `INCR`, platform limiter, or equivalent distributed limiter.
- Central/cross-domain security ledger decision.
- Metrics backend decision if operational SLA requires metrics/alerting.
- Load/concurrency test for create/status/detail/sync-summary and denial paths.
- Security review for rate-limit race boundaries.
- Operational dashboard/runbook for audit, rate-limit, denial, redaction, and idempotency signals.
