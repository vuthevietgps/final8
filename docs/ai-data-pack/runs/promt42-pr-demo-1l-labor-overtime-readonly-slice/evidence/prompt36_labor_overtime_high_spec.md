# Finding Spec - `labor_overtime_high`

## Current Evidence

- Classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Current label: `labor_overtime_high_without_matching_revenue_growth`

## Why Evidence Is Weak

The current Director JSON exposes the alert label but not timesheets, overtime hours, labor cost by period, revenue by comparable period, SLA/workload, staff capacity, or overtime threshold.

## Business Meaning For Director

Labor overtime may be rising without matching revenue growth. The Director can review capacity and cost pressure, but should not infer staff inefficiency without workload and SLA context.

## Minimum ERP Fields/Tables Needed

- timesheets
- overtime hours
- labor cost by period
- revenue by comparable period
- SLA/workload count
- staff capacity
- overtime threshold
- department/team id
- period comparison baseline

## Likely Current ERP Collections/Modules To Inspect Later

- `laborcost1`
- `laborstatements`
- `ordertest2`
- operation status modules
- cashflow/revenue summaries if used for period comparisons

## Proposed Director JSON Read-Only Evidence Rows

| field | proposed value |
|---|---|
| `finding_key` | `labor_overtime_high` |
| `finding_label` | `Labor overtime is high without matching revenue growth` |
| `source_domain` | `labor_operations` |
| `source_collections_or_modules` | `laborcost1, laborstatements, ordertest2` |
| `affected_entity_type` | `team_or_period` |
| `metric_name` | `overtime_hours_growth_vs_revenue_growth` |
| `threshold_value` | `overtime policy threshold` |
| `comparison_period` | `current period versus prior comparable period` |
| `calculation_method` | `overtime growth percent compared with revenue growth percent` |
| `data_quality_status` | `partial until workload and capacity are mapped` |
| `not_allowed_actions` | `do_not_change_staffing; do_not_create_schedule_action` |

## Data Quality Gates

- Timesheet rows must map to employee/team and period.
- Overtime threshold source must be known.
- Revenue comparison period must be defined.
- Workload/SLA count must be present or explicitly missing.
- Sample size must be sufficient for the period.
- If workload is missing, ChatGPT Web must avoid staff-efficiency conclusions.

## Example Advisory-Only Wording

"Overtime appears elevated relative to revenue growth. Treat this as an operations cost and capacity review signal; confirm workload, SLA pressure, and staffing context before drawing performance conclusions."

## Future Implementation Acceptance Criteria

- Director JSON includes overtime hours and labor cost by period.
- Director JSON includes revenue growth comparison.
- Director JSON includes workload/SLA and staff capacity fields where available.
- ChatGPT Web can cite evidence rows rather than alert label only.

## Future Tests

- Unit test for overtime growth calculation.
- Fixture test for high overtime with flat revenue.
- Negative test for missing revenue comparison period.
- Data quality downgrade test for missing workload/SLA rows.

## must_not_do_now

- Do not implement labor query changes in Prompt 36.
- Do not add migrations.
- Do not create staffing actions.
- Do not open approval workflow.
- Do not open Action Draft Schema.

