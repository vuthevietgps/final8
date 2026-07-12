# Role And Redaction Profiles

| Profile | Export modes | Allowed sections | Forbidden sections | Create export | Status | Download | Sync detail | PII |
|---|---|---|---|---|---|---|---|---|
| `director_full` | official, partial, cached | all | none | yes | yes | yes | yes | allowed purpose-bound |
| `director_redacted` | official, partial, cached | business plus sanitized audit | raw PII/payroll/provider payload | yes | yes | yes | sanitized | no raw PII |
| `manager_marketer` | partial, cached | ads, sales, orders aggregate, DQ, mapping | finance, supplier, employee, payroll, PII, sync detail | permission-bound | assigned | redacted | no | no |
| `finance_operator` | partial, cached, assigned support | finance, payments, supplier settlement | customer PII, employee detail by default | limited | assigned | finance-scoped | sanitized if granted | no by default |
| `reviewer_partial` | partial | redacted business, DQ, mapping | finance detail, PII, employee, sync detail | permission-bound | assigned | redacted | no | no |
| `investor_redacted` | assigned redacted only | aggregate investor-safe | full Director Pack, PII, employee, supplier detail, audit | no | summary only | investor-redacted | no | no |
| `external_consultant_redacted` | assigned redacted only | redacted business | finance detail, PII, employee, audit | no | summary only | external-redacted | no | no |
| `system_internal_worker` | internal execution only | none for human reading | artifact download without service policy | service-triggered | no human read | no | write audit only | no |

Rules:

- Investor never receives full Director Pack by default.
- Manager/Marketer does not receive finance/supplier/employee/payroll sensitive data by default.
- External consultant only receives redacted artifact.
- System worker may run jobs but cannot download artifacts without a separate audited policy.
