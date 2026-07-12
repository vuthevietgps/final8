# Data Quality Gate Result

Implemented gate behavior:

- Labor rows must map to employee through `laborcost1.userId`.
- Overtime hours must be calculable from daily `laborcost1.workHours`; missing/non-overtime rows emit no finding.
- Comparable prior labor period must exist with positive prior overtime candidate.
- Revenue comparison period must exist in current and prior `ordertest2` windows; missing revenue comparison emits no row.
- Workload/order count is included from `ordertest2`.
- SLA/deadline pressure missing downgrades confidence.
- Staff capacity missing downgrades confidence.
- Canonical overtime policy threshold missing downgrades confidence.
- No staffing, schedule, payroll, timesheet, order/revenue, or cashflow action is allowed.

Data quality result:

```text
data_quality_status: partial
confidence: low
```

Blocked strong conclusion cases:

```text
missing revenue comparison period -> no row emitted
missing overtime hours -> no row emitted
missing employee mapping -> no row emitted
```

Semantic downgrade:

```text
Overtime is a derived candidate above 8 work hours per employee/day, not a canonical overtime policy field.
```

