# Runtime Acceptance Matrix

Endpoints covered:

- `POST /ai-data-pack/exports`
- `GET /ai-data-pack/exports/:jobId/status`
- `GET /ai-data-pack/exports/:jobId`
- `GET /ai-data-pack/exports/:jobId/sync-summary`

Matrix:

| Role/profile | Create | Status | Detail | Sync summary |
|---|---|---|---|---|
| director | cached/official/partial allowed as intended | allowed | allowed | allowed |
| manager | cached/partial allowed; official denied | allowed for own jobs | no audit escalation | denied |
| investor | denied by default | redacted status allowed for own jobs | denied | denied |
| employee/unbound | denied | denied unless explicit safe permissions | denied unless explicit safe permissions | denied |
| explicit permission user | allowed only when permission/profile policy passes | allowed only when policy passes | allowed only when policy passes | allowed only when policy passes |
| system_internal_worker | denied | denied | denied | denied |
| unassigned reviewer | denied/no job leak | denied/no job leak | denied/no job leak | denied |

Prompt 17 code change:

- `investor_redacted` detail access is now default-denied, making investor public access status-only.

Tests cover:

- Director role-bound create.
- Manager official create denial.
- Explicit permission path.
- Investor status-only behavior.
- System internal worker denial.
- Unknown vs non-readable job denial shape.
- Sync-summary default-denied profiles.
