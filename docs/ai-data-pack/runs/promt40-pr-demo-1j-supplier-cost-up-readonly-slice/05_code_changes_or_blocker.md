# Code Changes Or Blocker

Implemented. No blocker.

Files changed:

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Classes/functions changed:

- `OperationsCapacityQuery.get`
  - Adds read-only `supplierquotes` and `quotes` collection reads.
  - Extends `products` projection with current cost-like fields.
- `OperationsCapacityQuery.operationalRiskFindings`
  - Appends `supplier_cost_up` evidence rows.
- New helper functions in `OperationsCapacityQuery`
  - `supplierCostUpEvidence`
  - `productCostCandidate`
  - `dealerPriceHistoryStatus`
  - `isApprovedQuoteStatus`
  - supplier/dealer timestamp helpers
- `ai-data-pack.service.spec.ts`
  - Adds positive supplier-cost evidence test.
  - Adds negative missing-prior-cost test.
  - Adds dealer-history-missing downgrade test.

Read-only data source:

- `supplierquotes`
- `products`
- `quotes`

Director JSON section:

```text
16_operation_capacity
```

Why no banned path is touched:

- No service method that mutates supplier, quote, product, purchase order, or ads data is called.
- No provider adapter, Google Ads adapter, validateOnly path, dry-run/live execution path, or action import path is imported.
- No DB migration or production schema change was added.
- Evidence rows contain advisory fields and `not_allowed_actions`, not action payloads.

