# Prompt47 - PR-DEMO-1Q Director Operational Risk Section Regression

Status: implemented_section_guard

This packet records the Prompt47 regression guard for the full Director JSON section path:

`sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`

Targeted findings:

- `low_inventory_best_seller`
- `supplier_cost_up`
- `overdue_dealer_receivables`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Implemented scope:

- Updated Director section assembly for `16_operation_capacity` so the JSON section carries the full operations payload under `data.operation_capacity`.
- Extended the existing hardened operational risk guard to assert the Director section nested path.
- Preserved Prompt45 no-action/no-provider/no-mutation payload checks.
- Preserved Prompt46 canonical schema and data-quality checks.
- Added duplicate/path stability assertions for targeted findings.

Verification:

- `cd backend; npm test -- --runTestsByPath src/ai-data-pack/ai-data-pack.service.spec.ts --runInBand` passed, 38/38 tests.
- `cd backend; npm run build` passed.
- Required static scans were run and classified.

Safety:

- No production DB or server MongoDB was used.
- No provider execution, validateOnly, live/dry-run branch, action import, approval workflow, export/download endpoint, migration, or business mutation was added.
