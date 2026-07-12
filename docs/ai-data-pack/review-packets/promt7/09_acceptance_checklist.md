# Acceptance Checklist

| Requirement | Result |
|---|---|
| Adapter exposes `sourceKey=google_ads`, `mode=read_only` | PASS |
| No action/execution methods | PASS |
| Caller cannot supply URL/method/GAQL | PASS |
| Scope fails closed before credential/provider call | PASS |
| Unknown/inactive/unapproved customer fails closed | PASS |
| Date ordering and max range enforced | PASS |
| `google-ads.read` alone is insufficient | PASS |
| Retry only transient/429/eligible 5xx | PASS |
| Auth/policy/scope/invalid GAQL not retried | PASS |
| Errors redact secrets/raw payloads/stack | PASS |
| Local-write allowlist excludes unsafe targets | PASS |
| Cached export does not reference adapter | PASS |
| Existing GET exports remain side-effect-free | PASS |
| Decision/action/live invariants remain false | PASS |
| Forbidden dependency source guard | PASS |
| No mutate/validateOnly/create/update/delete/status path | PASS |
| No provider API call in tests | PASS |
| Required build and regression suites | PASS |

Acceptance is limited to adapter isolation and guard scope. It does not authorize integration or real sync.

