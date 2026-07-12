# Export Policy Matrix

| Mode | Sync policy | Who uses it | Pre-assessment | Adapter call | Post-assessment | Completion | Strong decisions |
|---|---|---|---|---|---|---|---|
| `cached_export` | `export_cached` | Existing cached/export fixture flow | No required new gate | Never | No required new gate | `completed` or `failed` | Cautious unless embedded freshness proves source quality |
| `official_export` | `sync_required` | Director official pack | Required | Only for approved source adapters through internal source-sync | Required | `completed`, `blocked`, or `failed` | Allowed only for passing gates |
| `partial_export` | `sync_if_stale` | Review/critique pack when data is weak | Required | Optional for stale approved adapters | Required | `completed_with_warnings`, `blocked`, or `failed` | Locked for affected domains |

Downgrade rule:

- Official export may downgrade to partial only if request policy explicitly allows it and the audit records the downgrade reason.
- No automatic silent downgrade.

Provider rule:

- Provider success is not a freshness pass.
- Post-sync DB-only assessment is final.
