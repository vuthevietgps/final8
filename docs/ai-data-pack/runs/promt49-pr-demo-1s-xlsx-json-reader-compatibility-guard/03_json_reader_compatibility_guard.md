# JSON Reader Compatibility Guard

Guarded JSON path:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Implemented guard:

- The existing hardened operational risk test builds fake in-memory operations data.
- It builds a Director pack through `DirectorDataPackService`.
- It reads the section path directly from `pack.sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`.
- It asserts all five hardened findings are present.

Targeted findings:

- `low_inventory_best_seller`
- `supplier_cost_up`
- `overdue_dealer_receivables`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Carry-forward:

- Prompt45 recursive no-action guard remains active in the same test.
- Prompt46 schema/data-quality guard remains active in the same test.
- Prompt47 section-path guard remains active in the same test.
