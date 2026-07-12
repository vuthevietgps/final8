# Acceptance Checklist

| Requirement | Result |
|---|---|
| Every legacy sync searchStream step uses transport wrapper | PASS |
| No raw Axios/searchStream bypass remains in legacy sync | PASS |
| No caller-supplied URL/path/method/GAQL accepted | PASS |
| Static template IDs used by legacy sync | PASS |
| Date params validated in query templates | PASS |
| Timeout/deadline propagated to transport | PASS |
| mutate/validateOnly/create/update/delete/status provider paths absent | PASS |
| Actual local write telemetry emitted for current sync writes | PASS |
| Missing/forbidden/delete telemetry rejected | PASS |
| Audit receives write telemetry summary | PASS |
| Adapter invokes mocked sync port after lock/scope validation | PASS |
| Adapter safety booleans remain false | PASS |
| Source guards reject forbidden dependencies | PASS |
| Cached ExportJob does not call adapter | PASS |
| GET exports remain side-effect-free | PASS |
| Provider call in tests | NONE |
| Official/partial export integration | NONE |
| Ready for ExportJob integration | MAYBE, SPEC REVIEW ONLY |
