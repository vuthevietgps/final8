# Repo Semantics Inventory

## Order Status And Quantity Sources

| File | Class/function | Semantics found |
|---|---|---|
| `backend/src/test-order2/schemas/test-order2.schema.ts` | `TestOrder2` | Order rows live in `ordertest2`; fields include `productId`, `quantity`, `isActive`, `productionStatus`, `orderStatus`, `orderDate`. No canonical reserved-stock field exists. |
| `backend/src/test-order2/dto/create-test-order2.dto.ts` | `CreateTestOrder2Dto` | DTO has `productSource?: string` comment `inventory|supplier`, but the schema does not persist `productSource`. It cannot be used as reliable reserved-stock evidence from persisted order rows. |
| `backend/src/test-order2/constants/test-order2.constants.ts` | `OrderStatus` | Fallback statuses: `NO_TRACKING`, `SHIPPING`, `DELIVERED`, `RETURNED`. Completed payment statuses fallback to delivered and returned. |
| `backend/src/test-order2/test-order2.service.ts` | `canonicalizeOrderStatus` | Normalizes variants to canonical status names such as no tracking, shipping, waiting pickup, delivered, returned, reconciled, completed. |
| `backend/src/test-order2/test-order2.service.ts` | `handleOrderStatusChange` | Uses `OrderCalculationService.isPaymentTriggerStatus` and `isReturnStatus`; does not reserve or issue stock. |
| `backend/src/test-order2/services/order-calculation.service.ts` | `getPaymentTriggerStatuses`, `getReturnStatuses`, `isPaymentTriggerStatus`, `isReturnStatus` | Uses dynamic delivery statuses with fallback constants. Payment/return semantics exist; reserve semantics do not. |

## Delivery Status Semantics

| File | Class/function | Semantics found |
|---|---|---|
| `backend/src/delivery-status/schemas/delivery-status.schema.ts` | `DeliveryStatus` | Fields include `name`, `isActive`, `isFinal`, `isPaymentTrigger`, `isReturnStatus`, `estimatedDays`. No `reservesInventory` or stock-state flag exists. |
| `backend/src/delivery-status/dto/create-delivery-status.dto.ts` | `CreateDeliveryStatusDto` | DTO supports `isFinal`, `isPaymentTrigger`, and `isReturnStatus`, but no reservation flag. |
| `backend/src/delivery-status/delivery-status.service.ts` | `getDefaultStatuses` | Defaults: no tracking and shipping are active/non-final/non-payment/non-return; delivered and returned are final/payment-trigger; returned is return status. |
| `backend/src/delivery-status/delivery-status.service.ts` | `getPaymentTriggerStatusNames`, `getReturnStatusNames` | Existing methods can supply exclusion lists for reserved derivation. |

## Inventory Sources

| File | Class/function | Semantics found |
|---|---|---|
| `backend/src/inventory/schemas/inventory-summary.schema.ts` | `InventorySummary` | Existing fields: `productId`, `onHand`, `avgCost`. No reserved or incoming field. |
| `backend/src/inventory/schemas/inventory-transaction.schema.ts` | `InventoryTransaction` | Types are `receive`, `adjust`, `sale`, `return`; `quantity` is signed. Transactions record movement, not reservation. |
| `backend/src/inventory/schemas/inventory-batch.schema.ts` | `InventoryBatch` | `quantityRemaining` is batch stock remaining after receipt, with `source` purchase/return. It is not incoming stock. |
| `backend/src/inventory/inventory.service.ts` | `recordReceiveFromPO` | Receiving a PO creates batches, receive transactions, and increases `InventorySummary.onHand`. |
| `backend/src/inventory/inventory.service.ts` | `issueStock` | Issues stock by FIFO, decreases `InventoryBatch.quantityRemaining`, records `sale` transaction, and decreases `InventorySummary.onHand`. |
| `backend/src/inventory/inventory.service.ts` | `recordReturnFromRMA` | Restocked returns create batches and receive transactions. |

## Purchase Order Sources

| File | Class/function | Semantics found |
|---|---|---|
| `backend/src/purchase/dto/create-purchase-order.dto.ts` | `PurchaseStatus` | Status enum: `draft`, `ordered`, `partially_received`, `received`, `cancelled`. |
| `backend/src/purchase/schemas/purchase-order.schema.ts` | `PurchaseOrder`, `PurchaseItem` | PO items have `productId`, `quantity`, `quantityReceived`; PO has `status`, `expectedDeliveryDate`, `receivedDate`. |
| `backend/src/purchase/purchase-order.service.ts` | `create` | New POs default to `draft`; item `quantityReceived` starts at 0. |
| `backend/src/purchase/purchase-order.service.ts` | `receive` | Receiving a PO increments `quantityReceived`, changes status to `partially_received` or `received`, and calls `InventoryService.recordReceiveFromPO`. |
| `backend/src/purchase/purchase-order.service.ts` | `priceHistory`, `supplierReport` | Received quantities are treated as historical received stock/cost evidence. |
| `backend/src/ai-data-pack/demo-seed/director-demo-seed.fixtures.ts` | `buildPurchaseOrders`, `buildInventory` | Demo uses PO statuses and inventory batches consistently with received/remaining-stock semantics. |

## Stock Movement Reservation Logic

No code path was found that:

- creates a stock reservation row
- writes `reservedQuantity`
- links an order to an inventory reservation
- issues inventory automatically when an order enters a shipping/production status
- persists `productSource` in the order schema

This means reservation can only be a read-only derived candidate, not a canonical stock commitment.

