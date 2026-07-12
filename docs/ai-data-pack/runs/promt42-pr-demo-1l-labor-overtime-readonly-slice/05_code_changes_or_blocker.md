# Code Changes Or Blocker

Implemented. No blocker.

Files changed:

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Classes/functions changed:

- `OperationsCapacityQuery.get`
  - Reads `laborcost1` and `laborstatements` with read-only projections.
  - Includes labor evidence source in quality metadata.
- `OperationsCapacityQuery.operationalRiskFindings`
  - Appends `labor_overtime_high` evidence rows.
- New helper functions in `OperationsCapacityQuery`
  - `laborOvertimeHighEvidence`
  - `comparisonWindow`
  - `laborWindowStats`
  - `orderWindowStats`
  - `percentGrowth`
  - `windowOverlaps`
  - `startOfDay`
- `ai-data-pack.service.spec.ts`
  - Adds positive labor overtime evidence test.
  - Adds missing revenue comparison negative test.
  - Adds missing overtime hours negative test.
  - Asserts confidence downgrade fields for missing SLA/staff capacity/threshold policy.

Read-only data source:

- `laborcost1`
- `laborstatements`
- `ordertest2`
- `users`

Director JSON section:

```text
16_operation_capacity
```

Why no banned path is touched:

- No staffing, schedule, payroll, timesheet, order/revenue, cashflow, provider, or ads mutation method is called.
- No provider adapter, Google Ads adapter, validateOnly path, dry-run/live execution path, or action import path is imported.
- No DB migration or production schema change was added.
- Evidence rows contain advisory fields and `not_allowed_actions`, not action payloads.

