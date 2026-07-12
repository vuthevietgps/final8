# Prompt50 - PR-DEMO-2A Threshold Sources And Weak Fields Spec

Status: `no_code_ba_threshold_spec`

Target: `configured_threshold_sources_and_canonical_weak_fields_spec`

This packet is a no-code BA/spec output. It defines configured threshold source semantics and canonical weak-field definitions for the five hardened operational risk findings:

- `low_inventory_best_seller`
- `supplier_cost_up`
- `overdue_dealer_receivables`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Canonical Director JSON path preserved:

```text
sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings
```

Main conclusion:

- Current rows are useful read-only advisory evidence.
- Several thresholds are currently implicit constants or derived candidates.
- Future implementation should introduce a read-only threshold source registry before raising evidence confidence.
- No finding should become an action payload, provider call, mutation, approval workflow, or execution command.

No application code, migrations, APIs, provider paths, export endpoints, or database mutations were changed.

