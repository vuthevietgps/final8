# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Reason:

Existing ERP models provide enough read-only order-level fields to create partial advisory evidence:

- `ordertest2` has agent/dealer id, payment status, explicit due date, payment amount, and order id.
- `agentstatements` has statement/payment history for last-payment evidence and statement linkage.
- `users` maps agent/dealer ids to aliases and manager/owner hints.
- Director JSON already has a read-only operational risk evidence surface in `16_operation_capacity`.

Non-blocking gaps:

- The `agent-receivable` module name conflicts with schema comments that describe company payable to agent.
- Collection owner is not canonical; `users.managerId` or statement payment creator is only a candidate.
- Last payment may be absent.
- Invoice entities are not separate; order id is the safe linkage used.

These gaps force `data_quality_status: partial` and confidence downgrades, but they do not block advisory read-only rows.

