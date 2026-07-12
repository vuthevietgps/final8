# Risks And Open Questions

Risks:

- Overtime is derived from `workHours > 8/day`, not a canonical policy field.
- Team mapping is employee-level; no durable team/capacity model was found.
- Staff capacity and SLA/deadline pressure are missing.
- Revenue/workload comparison is global order workload, not employee/team-attributed workload.
- The row lives in `16_operation_capacity` because that is the existing read-only risk evidence surface.

Open questions:

- Should a future phase add a canonical overtime threshold policy?
- Should team/staff capacity and SLA pressure be modeled before this finding can become medium/high confidence?
- Should workload be allocated to labor group/team rather than global orders?

