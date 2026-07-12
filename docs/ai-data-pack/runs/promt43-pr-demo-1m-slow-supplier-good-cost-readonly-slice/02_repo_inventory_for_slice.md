# Repo Inventory For Slice

Director JSON export/query surface:

- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts`
- `backend/src/ai-data-pack/queries/operations-capacity.query.ts`
- Existing weak-evidence rows are surfaced through `OperationsCapacityQuery.get()` into `operation_capacity` and `operational_risk_findings`.

AI data pack tests:

- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`

Supplier/vendor model and quote source:

- `backend/src/supplier-quote/schemas/supplier-quote.schema.ts`
  - `SupplierQuote.productId`
  - `SupplierQuote.supplierId`
  - `SupplierQuote.price`
  - `SupplierQuote.currency`
  - `SupplierQuote.effectiveAt`
  - `SupplierQuote.note`
- `backend/src/supplier-quote/supplier-quote.service.ts`
  - `getLatest(productId, supplierId)`
  - `getEffectiveAt(productId, supplierId, targetDate)`
  - `getPriceHistory(productId, supplierId)`
  - `getSupplierQuotes(supplierId)`

Product/good/SKU/variant model:

- `backend/src/product/schemas/product.schema.ts`
  - `Product.name`
  - `Product.sku`
  - `Product.importPrice`
  - `Product.totalCost`
  - `Product.minStock`
  - `Product.estimatedDeliveryDays`
  - `Product.suppliers[].supplierId`
  - `Product.suppliers[].appliedPrice`
  - `Product.suppliers[].appliedAt`

Supplier-good or supplier-product mapping:

- `supplierquotes.productId + supplierquotes.supplierId`
- `products.suppliers[].supplierId` when present
- `purchaseorders.supplierId + purchaseorders.items[].productId`

Purchase orders / import orders / inbound shipments:

- `backend/src/purchase/schemas/purchase-order.schema.ts`
  - `PurchaseOrder.supplierId`
  - `PurchaseOrder.supplierNameSnap`
  - `PurchaseOrder.status`
  - `PurchaseOrder.expectedDeliveryDate`
  - `PurchaseOrder.receivedDate`
  - `PurchaseOrder.items[].productId`
  - `PurchaseOrder.items[].quantity`
  - `PurchaseOrder.items[].unitPrice`
  - `PurchaseOrder.items[].quantityReceived`
- `backend/src/purchase/purchase-order.service.ts`
  - `priceHistory(params)`
  - `supplierReport(params)`
  - `receive(id, dto)` exists but Prompt43 does not call it.

Inventory context:

- `backend/src/inventory/schemas/inventory-summary.schema.ts`
  - `InventorySummary.productId`
  - `InventorySummary.onHand`
  - `InventorySummary.avgCost`
- `backend/src/inventory/schemas/inventory-batch.schema.ts`
  - `InventoryBatch.productId`
  - `InventoryBatch.supplierId`
  - `InventoryBatch.purchaseOrderId`
  - `InventoryBatch.quantityRemaining`
  - `InventoryBatch.unitCost`
  - `InventoryBatch.receivedAt`
- `backend/src/inventory/schemas/inventory-transaction.schema.ts`
  - `InventoryTransaction.productId`
  - `InventoryTransaction.supplierId`
  - `InventoryTransaction.purchaseOrderId`
  - `InventoryTransaction.unitCost`
  - `InventoryTransaction.occurredAt`

Orders/revenue/COGS/margin context:

- `backend/src/test-order2/schemas/test-order2.schema.ts`
  - `productId`
  - `supplierId`
  - `supplierQuoteId`
  - `supplierAppliedPrice`
  - `grossProfit`
  - `netProfit`
  - `realizedGrossProfit`
  - `realizedNetProfit`
- Prompt43 does not use order/revenue/margin for row emission because a safe supplier-product reliability mapping is available from purchase orders. Margin impact is exposed as missing/weak context.

Threshold sources:

- Good-cost threshold: latest `supplierquotes` peer median for the same product and currency; current supplier must be at least 5 percent below peer median.
- Slow supplier threshold: `purchaseorders.receivedDate > purchaseorders.expectedDeliveryDate`; `products.estimatedDeliveryDays` is used when available and missing otherwise downgrades confidence.

