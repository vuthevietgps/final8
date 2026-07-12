# Labor Overtime High Design

Director JSON evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

Collection inputs:

- `laborcost1`
- `laborstatements`
- `ordertest2`
- `users`

Canonical fields implemented where applicable:

- `finding_key`
- `finding_label`
- `evidence_strength`
- `source_domain`
- `source_collections_or_modules`
- `time_window`
- `affected_entity_type`
- `affected_entity_id`
- `affected_entity_name_or_alias`
- `metric_name`
- `metric_value`
- `threshold_value`
- `comparison_period`
- `calculation_method`
- `sample_size`
- `data_quality_status`
- `confidence`
- `blocking_reason_if_any`
- `recommended_advisory_language`
- `not_allowed_actions`

Domain fields implemented:

- `team_or_labor_group_id`
- `team_or_labor_group_alias`
- `current_overtime_hours`
- `prior_overtime_hours`
- `overtime_growth_percent`
- `current_labor_cost`
- `prior_labor_cost`
- `labor_cost_growth_percent`
- `current_revenue`
- `prior_revenue`
- `revenue_growth_percent`
- `workload_or_order_count_current`
- `workload_or_order_count_prior`
- `sla_or_deadline_pressure_if_available`
- `staff_capacity_if_available`
- `overtime_threshold_source`
- `comparison_period`

Row creation logic:

1. Build adjacent 7-day windows ending at the report/as-of date.
2. Group `laborcost1` rows by employee and day.
3. Derive `overtime_hours_candidate = max(0, daily workHours - 8)` per employee/day.
4. Require current and prior overtime candidates to be positive.
5. Calculate current/prior labor cost by employee.
6. Calculate current/prior revenue and workload from `ordertest2`.
7. Require revenue comparison period to exist.
8. Emit a row when overtime growth exceeds revenue growth.
9. Downgrade confidence because SLA pressure, staff capacity, team mapping, and canonical overtime policy are missing.

Action safety:

```text
not_allowed_actions = do_not_change_staffing; do_not_create_schedule_action; do_not_mutate_payroll; do_not_mutate_timesheets; do_not_mutate_orders_or_revenue; do_not_mutate_cashflow; do_not_execute_ads_actions
```

