# RBAC And Public Surface

Proposed permission keys:

- `ai-data-pack.export.official.create`
- `ai-data-pack.export.partial.create`
- `ai-data-pack.export.cached.create`
- `ai-data-pack.export.status.read`
- `ai-data-pack.export.artifact.download`
- `ai-data-pack.export.sync-detail.read`
- `ai-data-pack.section.finance.read`
- `ai-data-pack.section.employee-sensitive.read`
- `ai-data-pack.section.supplier-commission.read`

Policy answers:

| Question | Policy |
|---|---|
| Who can create official export? | Director or explicitly delegated internal service with `ai-data-pack.export.official.create`. |
| Who can create partial export? | Director, or reviewer/manager only with `ai-data-pack.export.partial.create` and redaction profile. |
| Who can view sync detail? | Users with `ai-data-pack.export.sync-detail.read`; sanitized only. |
| Who can download artifact? | Requester, Director, or users with `ai-data-pack.export.artifact.download`, subject to redaction. |
| Who can view finance/supplier/employee/payroll fields? | Only section-specific permissions. |
| Is section-level RBAC needed? | Yes. |
| Can investor read full Director Pack? | No by default; use investor redaction profile. |

No role binding is approved in this spec.
