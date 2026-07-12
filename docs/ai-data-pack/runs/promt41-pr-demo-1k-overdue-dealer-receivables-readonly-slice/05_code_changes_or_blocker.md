# Code Changes Or Blocker

Implemented. No blocker.

Files changed:

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Classes/functions changed:

- `OperationsCapacityQuery.get`
  - Adds optional as-of date input for deterministic aging calculations.
  - Expands read-only projections for `ordertest2` and `agentstatements`.
  - Adds read-only `users` projection without secret/PII-heavy fields.
- `OperationsCapacityQuery.operationalRiskFindings`
  - Appends `overdue_dealer_receivables` evidence rows.
- New helper functions in `OperationsCapacityQuery`
  - `overdueDealerReceivablesEvidence`
  - `asOfDate`
  - `outstandingAgentBalance`
  - `originalAgentOrderAmount`
  - `agingBucket`
- `ai-data-pack.service.spec.ts`
  - Adds positive overdue evidence and aging bucket test.
  - Adds negative missing due date test.
  - Adds negative missing outstanding balance test.
  - Adds confidence downgrade test for missing owner/last payment.

Read-only data source:

- `ordertest2`
- `agentstatements`
- `users`

Director JSON section:

```text
16_operation_capacity
```

Why no banned path is touched:

- No service method that mutates agent statements, payments, cashflow, customers, invoices/orders, suppliers, purchase orders, or ads data is called.
- No provider adapter, Google Ads adapter, validateOnly path, dry-run/live execution path, or action import path is imported.
- No DB migration or production schema change was added.
- Evidence rows contain advisory fields and `not_allowed_actions`, not action payloads.

