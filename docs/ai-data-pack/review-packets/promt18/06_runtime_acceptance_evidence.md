# Runtime Acceptance Evidence

| Area | Acceptance | Evidence |
|---|---|---|
| RBAC/role binding | accepted | Prompt 16 role binding and Prompt 17 runtime matrix; endpoint tests cover director, manager, investor, explicit permission, unbound, system worker, and reviewer paths. |
| Response redaction | accepted | Public responses include `responseRedaction` and strip token/bytes/url/storage/provider fields. |
| Idempotency | accepted | Duplicate public create returns the same redacted job summary and does not call lifecycle twice. |
| Rate limit | accepted_with_condition | Conservative CacheManager/in-memory limiter exists; non-atomic distributed increment remains a high-volume blocker. |
| Audit | accepted_with_condition | Dedicated persistent endpoint audit exists and stores sanitized metadata; no central ledger yet. |
| HTTP transport metadata | accepted | Request id, correlation id, route template, method, IP hash, and user-agent hash are persisted without raw body/header/IP/user-agent. |
| Observability | accepted_with_condition | Bounded structured logs exist; metrics backend remains a platform decision. |
| Denial behavior | accepted | Unknown/non-readable job responses are indistinguishable where required; denials do not leak detail, audit, source, storage, or execution data. |
| Runtime acceptance matrix | accepted | Prompt 17 matrix and tests cover required profiles/endpoints. |
| Static safety | accepted | Required static checks completed and interpreted. |
| Tests/build | accepted | Focused endpoint tests, AI Data Pack suite, and backend build passed. |

Conclusion:

- Public create/status/detail/sync-summary is accepted for controlled internal/admin no-download use.
- High-volume/multi-pod exposure is not accepted until the platform gates are satisfied.
