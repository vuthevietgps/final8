# Public Create/Status Rollback Drill Checklist

Phase: `PR-2.3B-4I`

This drill must not delete audit records and must not enable download/action/live/provider mutation.

## Drill Metadata

| Field | Value |
|---|---|
| Environment |  |
| Drill date/time |  |
| Drill owner |  |
| Participants |  |
| Evidence folder/link |  |

## Drill Steps

| Step | Owner | Evidence required | Pass/fail | Notes | blocking_if_failed |
|---|---|---|---|---|---|
| Remove or restrict explicit AI Data Pack export permissions for test cohort. | Auth/technical owner | Before/after permission evidence. |  |  | true |
| Confirm affected users are blocked or reduced to intended access. | Tester | Denied response samples. |  |  | true |
| Apply gateway/reverse proxy restriction if available. | Operator/support owner | Rule change evidence or N/A note. |  |  | false |
| Restrict to VPN/IP allowlist if available. | Operator/support owner | Access policy evidence or N/A note. |  |  | false |
| Tighten rate limits for test cohort or environment. | Platform owner | Config diff or setting note. |  |  | false |
| Confirm endpoint audit still persists after restrictions. | Tester | Audit record id/path. |  |  | true |
| Confirm no audit deletion occurred. | Security/reviewer | Audit retention check. |  |  | true |
| Confirm forbidden surfaces remain disabled. | Tester | Response/static evidence. |  |  | true |
| Preserve incident/drill evidence. | Operator/support owner | Evidence folder/path. |  |  | true |
| Document how controlled access can be re-enabled. | Technical owner | Re-enable steps. |  |  | true |

## Rollback Success Criteria

- Affected users are blocked or reduced to intended access.
- Audit and structured logs remain active.
- No download/action/live/provider mutation appears.
- Operators know how to re-enable controlled access.
- Evidence is preserved for incident review.

## Drill Outcome

```text
rollback_drill_result=
follow_up_required=
follow_up_owner=
```
