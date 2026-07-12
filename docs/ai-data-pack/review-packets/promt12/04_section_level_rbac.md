# Section-level RBAC

Sensitivity levels:

- `public_internal`
- `business_sensitive`
- `financial_sensitive`
- `pii_sensitive`
- `employee_sensitive`
- `supplier_sensitive`
- `audit_sensitive`

High-level defaults:

- Business sections can be visible to assigned business profiles after redaction.
- Finance, supplier commission, customer PII, employee activity, payroll, sync detail, and audit logs are restricted.
- Every artifact must include section access profile and explicit omitted-section metadata.

Section policy is defined in `ketquapromt12.json` under `section_level_rbac` for:

```text
executive_summary
ads_performance
marketing_costs
sales_funnel
orders
payments
finance_cash
loans_debt
supplier_settlement
supplier_commission
tier2_agent_commission
customer_pii
employee_activity
payroll_integrity
decision_history
data_quality
mapping_report
operations_sla
artifact_manifest
sync_detail
audit_log
```

ChatGPT Web must be told when a section is omitted due to RBAC and must not treat omission as zero.
