# Director JSON Evidence Result

Implemented evidence surface:

```text
sections["16_operation_capacity"].data
operation_capacity
operational_risk_findings
```

The row shape includes:

```json
{
  "status": "risk_signal",
  "finding_key": "labor_overtime_high",
  "finding_label": "labor_overtime_high_without_matching_revenue_growth",
  "source_domain": "labor_operations",
  "source_collections_or_modules": "laborcost1, laborstatements, ordertest2, users",
  "affected_entity_type": "team_or_period",
  "metric_name": "overtime_hours_growth_vs_revenue_growth",
  "data_quality_status": "partial",
  "confidence": "low",
  "not_allowed_actions": "do_not_change_staffing; do_not_create_schedule_action; do_not_mutate_payroll; do_not_mutate_timesheets; do_not_mutate_orders_or_revenue; do_not_mutate_cashflow; do_not_execute_ads_actions"
}
```

Test-proven sample facts:

- `team_or_labor_group_id: employee-1`
- `current_overtime_hours: 4`
- `prior_overtime_hours: 1`
- `overtime_growth_percent: 300`
- `current_labor_cost: 2000`
- `prior_labor_cost: 900`
- `labor_cost_growth_percent: 122.22`
- `current_revenue: 1100`
- `prior_revenue: 1000`
- `revenue_growth_percent: 10`
- `workload_or_order_count_current: 2`
- `workload_or_order_count_prior: 1`
- `metric_value: 290`

No action payloads are present. The row is advisory-only evidence for Director/ChatGPT Web reading.

