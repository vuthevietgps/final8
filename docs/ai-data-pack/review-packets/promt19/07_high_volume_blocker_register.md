# High-Volume Blocker Register

Main document:

- `docs/ai-data-pack/rollout/public-create-status-high-volume-blocker-register.md`

Blockers:

| Blocker | Controlled rollout impact | High-volume impact |
|---|---|---|
| `atomic_limiter_missing` | Acceptable for controlled low-volume/internal use. | Blocks high-volume multi-pod exposure. |
| `central_security_ledger_missing` | Domain-local endpoint audit accepted for controlled rollout. | Blocks broad public exposure until security/platform accepts a pattern. |
| `metrics_backend_missing_if_sla` | Structured logs accepted for manual controlled monitoring. | Blocks SLA-backed public rollout if dashboards/alerts are required. |
| `load_concurrency_test_missing` | Not blocking controlled manual use. | Blocks high-volume exposure. |
| `operational_dashboard_missing_if_sla` | Manual log review accepted for controlled rollout. | Blocks SLA-backed public rollout if dashboard is required. |

Prompt 19 does not solve these blockers.
