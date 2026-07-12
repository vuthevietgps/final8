# Existing Threshold And Semantics Inventory

## Repo enum values

`backend/src/ai-data-pack/contracts/metadata.contract.ts` defines:

- `data_quality_status`: `ok | partial | weak | missing | stale`
- `confidence`: `high | medium | low`

Prompt50 uses only these values.

## Director path and reader compatibility

`backend/src/ai-data-pack/contracts/director-data-pack.contract.ts` includes `16_operation_capacity` in `DIRECTOR_XLSX_SHEETS`.

`backend/src/ai-data-pack/director-data-pack.service.ts` preserves the nested section shape:

```text
sections["16_operation_capacity"].data.operation_capacity
```

Prompt49 confirms JSON and XLSX readers can access:

```text
sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings
```

## Current threshold inventory

| Finding | Current threshold/source | Evidence in current code | What it can prove | What it cannot prove |
|---|---|---|---|---|
| `low_inventory_best_seller` | `products.minStock`; implicit `daysOfCoverThreshold = 7`; sales velocity from order window | `operations-capacity.query.ts`, product schema, inventory summary schema | Low stock relative to order velocity and `minStock`; projected stock can include derived incoming PO quantity | Canonical reservation ledger, confirmed incoming stock policy, configured days-of-cover policy, approved reorder policy |
| `supplier_cost_up` | implicit `thresholdPercent = 15`; current/prior `supplierquotes.price`; dealer quote lag | `operations-capacity.query.ts`, supplier quote schema, product schema, quote usage in query | Supplier quote increased more than 15 percent and dealer quote appears older/missing | Approved supplier quote status is not guaranteed by current `SupplierQuote` schema; product cost history and margin impact are incomplete |
| `overdue_dealer_receivables` | `ordertest2.agentPaymentDueDate < as_of_report_date`; aging bucket from days overdue | `operations-capacity.query.ts`, test order schema, agent statement schema | Settlement pressure with due date, outstanding amount, days overdue | Clean receivable versus payable terminology; collectible cash-in proof; formal collection policy or owner workflow |
| `labor_overtime_high` | implicit `8h/day` overtime candidate; current 7-day window vs prior 7-day window; overtime growth greater than revenue growth | `operations-capacity.query.ts`, labor cost schema, salary config schema, order schema | Labor overtime candidate grew faster than revenue/workload proxy | Canonical overtime policy, SLA pressure, staff capacity, team mapping, approved staffing threshold |
| `slow_supplier_good_cost` | implicit `costAdvantageThresholdPercent = 5`; delayed fulfilled PO; `products.estimatedDeliveryDays` if present | `operations-capacity.query.ts`, supplier quote schema, purchase order schema, product schema | Supplier has lower cost than peer median and recent fulfilled PO delay | Configured cost-advantage policy, accepted quote status, reliability score, delivery quality notes, variant-level grouping, margin/COGS attribution |

## Source files and findings

| Source | Useful fields found | Limitation |
|---|---|---|
| `Product` | `minStock`, `estimatedDeliveryDays`, `importPrice`, `totalCost`, `suppliers[].appliedPrice`, `suppliers[].appliedAt`, `sku` | Product-level values are current fields, not versioned threshold records. |
| `InventorySummary` | `productId`, `onHand`, `avgCost` | No reservation ledger or stock allocation status. |
| `TestOrder2` | `productId`, `quantity`, `orderStatus`, `orderDate`, `agentPaymentDueDate`, `agentPaidAmount`, `agentCommissionAmount`, supplier/dealer quote snapshots | Mixed order, payment, and settlement semantics; not a formal receivable policy source. |
| `DeliveryStatus` | `isActive`, `isFinal`, `isPaymentTrigger`, `isReturnStatus`, `estimatedDays` | Useful for reserved candidate inclusion/exclusion, not a stock reservation record. |
| `PurchaseOrder` | `status`, `expectedDeliveryDate`, `receivedDate`, `items[].quantity`, `items[].quantityReceived`, `items[].unitPrice` | PO status is useful but not the same as confirmed incoming stock policy. |
| `SupplierQuote` | `productId`, `supplierId`, `price`, `currency`, `effectiveAt`, `note` | Current schema does not define `status` or `approvalStatus`, although query reads those candidate fields if present. |
| `AgentStatement` | `agentId`, `periodReceivables`, `periodCollected`, `statementPaymentTotal`, `closingBalance`, `payments` | Schema comments clarify the module is settlement/payable-oriented despite receivable naming. |
| `LaborCost1` | `date`, `userId`, `workHours`, `hourlyRate`, `cost`, `sessionCount`, `paymentStatus` | Work-hour source exists, but no overtime policy, SLA, or capacity model. |
| `SalaryConfig` | `hourlyRate`, `payrollCycle`, `attendanceTiers`, `kpiBonusTiers`, `punctualityRules` | Salary policy exists but not overtime threshold policy. |

