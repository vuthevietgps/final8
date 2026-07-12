# Prompt 41 - PR-DEMO-1K

Status: `implemented_read_only_slice`

This run implements a read-only Director JSON evidence slice for:

```text
overdue_dealer_receivables
```

Output root:

```text
docs/ai-data-pack/runs/promt41-pr-demo-1k-overdue-dealer-receivables-readonly-slice/
```

Implemented:

- Reads existing `ordertest2`, `agentstatements`, and `users` collections through `OperationsCapacityQuery`.
- Adds advisory-only `overdue_dealer_receivables` rows to the Director `16_operation_capacity` evidence surface.
- Calculates `days_overdue` and `aging_bucket` from `ordertest2.agentPaymentDueDate` and report/as-of date.
- Uses pending positive agent/dealer settlement amounts as `outstanding_balance` / `overdue_balance`.
- Downgrades confidence when last payment, collection owner, or statement linkage is missing.

No Action Draft Schema, action import, OpenAI API call, approval workflow, provider execution/mutation/validateOnly, DB migration, collection action, agent/dealer blocking action, customer mutation, invoice/order mutation, payment mutation, cashflow mutation, purchase/replenishment action, ads mutation, or new export/download behavior was added.

