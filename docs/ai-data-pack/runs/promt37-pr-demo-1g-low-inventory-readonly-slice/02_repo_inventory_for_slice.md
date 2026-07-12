# Repo Inventory For Slice

Inspected and reused modules:

| Area | File | Finding |
|---|---|---|
| Director JSON section mapping | `backend/src/ai-data-pack/director-data-pack.service.ts` | `16_operation_capacity` is built from `operations.operation_capacity`. |
| Director contract | `backend/src/ai-data-pack/contracts/director-data-pack.contract.ts` | `16_operation_capacity` is an existing Director section. |
| Operations query | `backend/src/ai-data-pack/queries/operations-capacity.query.ts` | Existing query already emits operational risk rows into `operation_capacity`. |
| Query helper | `backend/src/ai-data-pack/queries/query.util.ts` | Existing `findRows` read helper reused. |
| AI data-pack tests | `backend/src/ai-data-pack/ai-data-pack.service.spec.ts` | Existing OperationsCapacityQuery tests extended. |
| Inventory summary model | `backend/src/inventory/schemas/inventory-summary.schema.ts` | Existing fields include `productId`, `onHand`, `avgCost`. |
| Inventory transaction model | `backend/src/inventory/schemas/inventory-transaction.schema.ts` | Existing fields include `productId`, `type`, `quantity`, `purchaseOrderId`, `occurredAt`. |
| Inventory batch model | `backend/src/inventory/schemas/inventory-batch.schema.ts` | Existing fields include `productId`, `quantityRemaining`, `purchaseOrderId`, `receivedAt`. Not used in this slice because incoming stock semantics are not mapped. |
| Product model | `backend/src/product/schemas/product.schema.ts` | Existing fields include `name`, `sku`, `minStock`, `maxStock`. |
| Order model | `backend/src/test-order2/schemas/test-order2.schema.ts` | Existing fields include `productId`, `quantity`, `orderDate`, status fields. |
| Demo seed | `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts` | Existing demo inventory/products/orders can support this kind of evidence. No seed mutation was needed. |

Existing fields are sufficient for a read-only partial evidence row:

- bestseller rank from `ordertest2.productId` and `ordertest2.quantity`
- current inventory from `inventorysummaries.onHand`
- product/SKU display from `products._id`, `products.name`, `products.sku`
- reorder threshold from `products.minStock`
- sales velocity and days of cover from dated order rows

Existing fields are not sufficient for a strong replenishment conclusion:

- reserved quantity is not mapped in the inspected models
- incoming stock is not safely mapped for this slice
- no purchase/replenishment action may be inferred from this row

