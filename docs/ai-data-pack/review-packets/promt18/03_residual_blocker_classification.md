# Residual Blocker Classification

## `atomic_limiter_missing`

Description:

- CacheManager-backed limiter uses shared buckets when configured but remains non-atomic because no Redis `INCR` or platform limiter abstraction was found.

Impact:

- Security: concurrent multi-pod traffic can race at the rate-limit boundary.
- Business: abuse or polling spikes can consume backend resources beyond intended quotas.
- Production: acceptable for controlled internal/admin use; blocker for high-volume multi-pod public exposure.

Future owner:

- Platform/backend infrastructure.

Recommended phase:

- `PR-2.3B-4F-H1` or operational rollout prerequisite.

## `central_security_ledger_missing`

Description:

- Dedicated AI Data Pack endpoint audit exists, but no central immutable cross-domain security ledger pattern was found.

Impact:

- Security: events are persisted in a domain-local sink rather than a company-wide immutable ledger.
- Business: incident correlation and security review are limited for broad public exposure.
- Production: acceptable for controlled internal/admin use; blocker for high-volume public exposure until security/platform accepts a pattern.

Future owner:

- Security/platform.

Recommended phase:

- `PR-2.3B-4F-H1` or security platform backlog.

## `metrics_backend_missing`

Description:

- Bounded structured Logger signals exist, but no Prometheus/OpenTelemetry metrics backend pattern was found.

Impact:

- Security: no direct data exposure; labels are bounded and sanitized.
- Business: dashboards and alerting may be insufficient for SLA-backed public rollout.
- Production: not blocking controlled internal/admin use; conditional high-volume gate when SLA/alerting is required.

Future owner:

- Platform/observability.

Recommended phase:

- Operational rollout prerequisite.
