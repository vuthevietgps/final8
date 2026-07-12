# Future Test Plan

Prompt 36 does not add tests because it does not change code. This is a future test plan for an approved implementation phase.

## Unit Tests

- `supplier_cost_up`: cost increase percent and dealer price lag.
- `overdue_dealer_receivables`: aging bucket calculation.
- `low_inventory_best_seller`: available quantity and days of cover.
- `labor_overtime_high`: overtime growth versus revenue growth.
- `slow_supplier_good_cost`: lead time, late delivery count, and cost advantage.

## Fixture/Seed Tests

- Fixture rows create one positive evidence case per weak finding.
- Fixture rows create one negative/insufficient-data case per weak finding.
- Seed data stays dev/test only.

## Director JSON Section Presence Tests

- Evidence rows appear in selected surface option.
- Rows include canonical evidence model fields.
- Rows include data quality status and confidence.
- Rows are read-only and contain no action payloads.

## Download Parse Tests

- Export/download JSON remains parseable.
- Redaction profile remains present.
- Artifact does not expose secrets/tokens/public URLs/raw provider payload.

## Safety/Static Guard Scans

- No OpenAI API upload.
- No Action Draft Schema.
- No action import.
- No provider validateOnly/mutation/live execution.
- No production DB path.

## Negative Tests

- Missing prior supplier cost downgrades/refuses `supplier_cost_up`.
- Missing receivable due date refuses strong overdue conclusion.
- Missing sales velocity downgrades `low_inventory_best_seller`.
- Missing workload/SLA downgrades `labor_overtime_high`.
- Missing promised/received dates refuses strong supplier reliability conclusion.

