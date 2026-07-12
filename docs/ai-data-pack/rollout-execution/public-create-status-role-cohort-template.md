# Public Create/Status Role And Cohort Verification Template

Phase: `PR-2.3B-4I`

No anonymous users, no high-volume public cohort, and no unbound external cohort are allowed in this controlled rollout.

| Cohort | Allowed endpoints | Forbidden endpoints/surfaces | Required permissions/profile | Expected denial cases | Sample user id placeholder | verified_by | verified_at |
|---|---|---|---|---|---|---|---|
| Director/admin | `POST /exports` cached/official/partial; status; detail; sync-summary. | Download, artifact bytes, OpenAI upload, action import, approval, dry-run/live, provider mutation/validateOnly. | `ai-data-pack.export.cached.create`, `official.create`, `partial.create`, `status.read`, `audit.read`, `sync-detail.read`, compatible director profile. | None for in-scope own/authorized jobs; forbidden fields always absent. | `USER_DIRECTOR_ADMIN_001` |  |  |
| Manager | `POST /exports` cached/partial if profile-compatible; status for allowed jobs. | Official create, sync-summary by default, audit escalation, download/action/live/provider surfaces. | Manager role binding or explicit cached/partial/status permissions; `manager_marketer` profile. | Official create denied; sync-summary denied; finance/employee/supplier/PII detail omitted. | `USER_MANAGER_001` |  |  |
| Investor status-only | Status for own/authorized redacted job if explicitly enabled. | Create, detail, sync-summary, audit summary, download/action/live/provider surfaces. | `ai-data-pack.export.status.read`; `investor_redacted` profile. | Create denied; detail denied; sync-summary denied; no full pack. | `USER_INVESTOR_001` |  |  |
| Explicit permission user | Only endpoints matching explicit permissions and compatible profile. | Any endpoint not explicitly granted; all unsafe surfaces. | Explicit `user.permissions` plus compatible redaction/section profile. | Missing permission denied; profile mismatch denied. | `USER_EXPLICIT_001` |  |  |
| Unbound role | None by default. | All public export endpoints unless explicitly permissioned and tested; all unsafe surfaces. | No export permissions. | Create/status/detail/sync-summary denied without job leak. | `USER_UNBOUND_001` |  |  |
| `system_internal_worker` | None on human public endpoint surface. | All human public export endpoints; all unsafe surfaces. | Worker profile must not be used for human public endpoint access. | Create/read/sync-summary denied. | `USER_SYSTEM_WORKER_001` |  |  |
| Unassigned reviewer | None until assignment and compatible permissions exist. | Status/detail/sync-summary for unassigned jobs; all unsafe surfaces. | Reviewer profile plus explicit assignment if future policy permits. | Denied/no job leak for existing and nonexistent jobs. | `USER_REVIEWER_UNASSIGNED_001` |  |  |

## Verification Notes

- Verify one positive path for each intended allowed cohort.
- Verify one denial path for each forbidden cohort or forbidden endpoint.
- Preserve only sanitized evidence: no credentials, tokens, raw provider payloads, storage keys, artifact bytes, public URLs, raw PII, raw request body, or raw headers.
