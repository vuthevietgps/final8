# Code Changes Or Blocker

Implementation status: `implemented_read_only_slice`

Files changed:

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Functions/classes changed:

- `OperationsCapacityQuery.get()`
- `OperationsCapacityQuery.operationalRiskFindings()`
- Added `OperationsCapacityQuery.slowSupplierGoodCostEvidence()`
- Added `OperationsCapacityQuery.supplierProductFulfillmentStats()`
- Added `OperationsCapacityQuery.median()`

Read-only data sources:

- `supplierquotes`
- `purchaseorders`
- `products`
- `inventorysummaries`
- `users`

Director JSON section:

- `16_operation_capacity`
- `operation_capacity`
- `operational_risk_findings`

Why no mutation path is touched:

- The code only reads with `findRows()`.
- It does not call `PurchaseOrderService.create/update/receive/remove`.
- It does not call inventory stock adjustment or receipt functions.
- It does not write supplier quotes, costs, prices, COGS, orders, revenue, cashflow, provider data, or ads entities.
- It emits only evidence rows and `not_allowed_actions` safety text.

Blocker:

- None.

