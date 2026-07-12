# Public Create/Status High-Volume Blocker Register

Phase: `PR-2.3B-4H`

High-volume public rollout remains blocked until these items are resolved or explicitly accepted by the platform/security owner.

| Blocker | Current status | Why it matters | Controlled rollout impact | High-volume impact | Owner | Exit criteria | Recommended future phase |
|---|---|---|---|---|---|---|---|
| `atomic_limiter_missing` | Open. CacheManager get/set buckets are not atomic. | Multi-pod concurrent traffic can exceed quotas at the race boundary. | Acceptable only for controlled low-volume/internal use. | Blocks high-volume multi-pod exposure. | Platform/backend infrastructure. | Atomic Redis `INCR`, platform limiter, or equivalent distributed limiter is implemented and tested. | `PR-2.3B-4F-H1` or rollout prerequisite. |
| `central_security_ledger_missing` | Open. Dedicated endpoint audit exists, no central immutable ledger pattern. | Broad public exposure needs incident correlation and stronger audit posture. | Domain-local audit accepted for controlled rollout. | Blocks broad public exposure until security decision. | Security/platform. | Central ledger integration exists or security accepts domain-local audit with written risk decision. | Security/platform backlog or `PR-2.3B-4F-H1`. |
| `metrics_backend_missing_if_sla` | Conditional. Structured logs exist, no metrics backend. | SLA-backed rollout needs dashboards/alerts. | Structured logs are enough for manual controlled monitoring. | Blocks SLA-backed public rollout if metrics/alerts are required. | Platform/observability. | Metrics backend or accepted no-SLA risk decision. | Operational rollout prerequisite. |
| `load_concurrency_test_missing` | Open for high-volume. Prompt 18 tests are functional/security focused. | Need evidence that rate limits, audit, and denial paths hold under concurrent traffic. | Not blocking controlled manual use. | Blocks high-volume exposure. | QA/platform/backend. | Load/concurrency test passes with expected audit/log behavior and no leaks. | Rollout hardening phase. |
| `operational_dashboard_missing_if_sla` | Conditional. Logs exist, dashboard not documented. | Operators need fast visibility during incident response. | Manual log review accepted for controlled rollout. | Blocks SLA-backed public rollout if dashboard is required. | Platform/operations. | Dashboard or accepted manual-monitoring risk decision. | Operational rollout prerequisite. |
