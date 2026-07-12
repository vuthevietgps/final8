# Prompt 42 - PR-DEMO-1L

Status: `implemented_read_only_slice`

This run implements a read-only Director JSON evidence slice for:

```text
labor_overtime_high
```

Output root:

```text
docs/ai-data-pack/runs/promt42-pr-demo-1l-labor-overtime-readonly-slice/
```

Implemented:

- Reads existing `laborcost1`, `laborstatements`, `ordertest2`, and `users` collections through `OperationsCapacityQuery`.
- Adds advisory-only `labor_overtime_high` rows to the Director `16_operation_capacity` evidence surface.
- Compares adjacent 7-day windows ending on the report/as-of date.
- Derives overtime candidate hours from `laborcost1.workHours` above 8 hours per employee/day.
- Compares overtime growth against revenue growth from `ordertest2`.
- Downgrades confidence because staff capacity, SLA pressure, team mapping, and canonical overtime policy threshold are not mapped.

No Action Draft Schema, action import, OpenAI API call, approval workflow, provider execution/mutation/validateOnly, DB migration, staffing action, schedule action, payroll mutation, timesheet mutation, order/revenue mutation, cashflow mutation, ads mutation, or new export/download behavior was added.

