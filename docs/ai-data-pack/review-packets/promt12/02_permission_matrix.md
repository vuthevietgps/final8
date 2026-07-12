# Permission Matrix

| Permission | Purpose | Allowed actors | Denied actors | Data exposure | Audit | Tests |
|---|---|---|---|---|---|---|
| `ai-data-pack.export.official.create` | Request official export | Director or approved service actor | investor, external, manager by default | job metadata only | `export_requested` | unauthorized official denied |
| `ai-data-pack.export.partial.create` | Request partial export | Director, approved reviewer/manager | investor, external | job metadata, warnings | `export_requested` | partial permission enforced |
| `ai-data-pack.export.cached.create` | Request cached export | approved internal users | public/external anonymous | cached job metadata | `export_requested` | cached still no sync |
| `ai-data-pack.export.status.read` | Read status | requester/director/assigned reviewer | unrelated user | sanitized status | status read audit | status RBAC denied |
| `ai-data-pack.export.artifact.download` | Download artifact | matching recipient/profile | public, expired token, profile mismatch | artifact bytes | download success/denial | manager cannot download full director artifact |
| `ai-data-pack.export.sync-detail.read` | Read sync detail | director/operator | manager by default, investor, external | sanitized sync status | `sync_detail_viewed` | sync detail sanitized |
| `ai-data-pack.export.audit.read` | Read audit log | director/security operator | manager by default, investor, external | sanitized audit metadata | `sensitive_section_accessed` | audit read permission |
| `ai-data-pack.section.finance.read` | Read finance | director/finance | manager/investor/external by default | finance details | `sensitive_section_accessed` | finance hidden without permission |
| `ai-data-pack.section.employee-sensitive.read` | Read employee/payroll | director/approved HR/finance | manager/investor/external | employee/payroll detail | `sensitive_section_accessed` | employee hidden without permission |
| `ai-data-pack.section.supplier-commission.read` | Read supplier commission | director/finance | manager/investor/external | supplier/tier2 detail | `sensitive_section_accessed` | supplier hidden without permission |
| `ai-data-pack.section.customer-pii.read` | Read customer PII | director/approved support | manager/investor/external | customer phone/email/address | `sensitive_section_accessed` | PII masked without permission |
| `ai-data-pack.section.investor-redacted.read` | Read investor pack | assigned investor/director | unassigned users | redacted aggregates | `artifact_downloaded` | investor gets redacted only |

No real role binding is approved by this spec.
