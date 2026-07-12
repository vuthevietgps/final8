# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Reason:

Existing ERP models provide enough read-only fields to create partial advisory evidence:

- `laborcost1` has employee/date/work-hour/cost rows.
- `laborstatements` has period/cost/work-hour summaries for statement linkage.
- `ordertest2` has order revenue and workload counts for comparable windows.
- `users` maps employees to safe aliases.
- Director JSON already has a read-only operational risk evidence surface in `16_operation_capacity`.

Non-blocking gaps:

- No canonical `overtimeHours` field.
- No canonical overtime policy threshold field.
- No durable team/staff capacity table.
- No mapped labor SLA/deadline pressure field.
- Revenue/workload is global order workload, not team-specific.

These gaps force `data_quality_status: partial` and `confidence: low`, but they do not block an advisory read-only row.

