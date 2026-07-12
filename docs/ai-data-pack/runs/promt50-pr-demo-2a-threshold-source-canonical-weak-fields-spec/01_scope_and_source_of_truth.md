# Scope And Source Of Truth

## Phase

`PR-DEMO-2A`

## Scope

This packet defines BA-level threshold and weak-field semantics only. It does not implement a threshold registry, database schema, API endpoint, export endpoint, provider call, action draft, approval flow, or business mutation.

## Immediate prior packets inspected

- `docs/ai-data-pack/runs/promt49-pr-demo-1s-xlsx-json-reader-compatibility-guard/`
- `docs/ai-data-pack/runs/promt48-pr-demo-1r-readonly-evidence-ba-qa-handoff/`
- `docs/ai-data-pack/runs/promt47-pr-demo-1q-director-operational-risk-section-regression/`
- `docs/ai-data-pack/runs/promt46-pr-demo-1p-operational-risk-evidence-schema-regression/`
- `docs/ai-data-pack/runs/promt45-pr-demo-1o-readonly-action-payload-regression/`
- `docs/ai-data-pack/runs/promt44-pr-demo-1n-weak-evidence-closeout-regression/`
- `docs/ai-data-pack/runs/promt43-pr-demo-1m-slow-supplier-good-cost-readonly-slice/`
- `docs/ai-data-pack/runs/promt42-pr-demo-1l-labor-overtime-readonly-slice/`
- `docs/ai-data-pack/runs/promt41-pr-demo-1k-overdue-dealer-receivables-readonly-slice/`
- `docs/ai-data-pack/runs/promt40-pr-demo-1j-supplier-cost-up-readonly-slice/`
- `docs/ai-data-pack/runs/promt39-pr-demo-1i-low-inventory-reserved-incoming-upgrade/`
- `docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice/`
- `docs/ai-data-pack/runs/promt36-pr-demo-1f-weak-evidence-hardening-spec/`

## Current repo files inspected

- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- `backend/src/ai-data-pack/contracts/metadata.contract.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/export/xlsx-exporter.service.ts`
- `backend/src/product/schemas/product.schema.ts`
- `backend/src/supplier-quote/schemas/supplier-quote.schema.ts`
- `backend/src/purchase/schemas/purchase-order.schema.ts`
- `backend/src/agent-receivable/schemas/agent-statement.schema.ts`
- `backend/src/labor-cost1/schemas/labor-cost1.schema.ts`
- `backend/src/salary-config/schemas/salary-config.schema.ts`
- `backend/src/inventory/schemas/inventory-summary.schema.ts`
- `backend/src/test-order2/schemas/test-order2.schema.ts`
- `backend/src/delivery-status/schemas/delivery-status.schema.ts`

## Read-only searches run

Searches covered these terms or equivalent terms:

```text
DataQualityStatus, ConfidenceLevel, DIRECTOR_XLSX_SHEETS,
16_operation_capacity, operational_risk_findings,
low_inventory_best_seller, supplier_cost_up,
overdue_dealer_receivables, labor_overtime_high,
slow_supplier_good_cost, threshold, policy, config,
minStock, estimatedDeliveryDays, supplier quote, SupplierQuote,
purchase order, PurchaseOrder, agent statement, AgentStatement,
labor cost, LaborCost, salary config, SalaryConfig,
inventory summary, InventorySummary, order status, delivery status
```

One broad PowerShell wildcard search against `docs/ai-data-pack/runs/promt4*` returned a Windows path syntax error for the docs glob. The docs search was repeated with explicit prior run folder paths and yielded usable evidence.

## Carry-forward facts

- Prompt45 no-action/no-provider/no-mutation guard remains active.
- Prompt46 schema/data-quality guard remains active.
- Prompt47 section path guard remains active.
- Prompt49 JSON/XLSX compatibility guard remains active.
- XLSX compatibility is not a final spreadsheet-first design.
- The five findings remain read-only advisory evidence.

