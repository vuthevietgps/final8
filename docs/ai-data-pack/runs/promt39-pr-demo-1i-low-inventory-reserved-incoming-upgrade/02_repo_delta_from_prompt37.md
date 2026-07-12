# Repo Delta From Prompt 37

## Existing Prompt 37 Implementation

File:

```text
backend/src/ai-data-pack/queries/operations-capacity.query.ts
```

Existing after Prompt 37:

- `OperationsCapacityQuery.get()` reads orders, inventory summaries, products, purchase orders, and operational risk sources.
- `lowInventoryBestSellerEvidence()` emits `low_inventory_best_seller` rows.
- Director JSON receives these rows through existing `16_operation_capacity`.
- Evidence was partial because `reserved_quantity` and `incoming_stock_quantity` were not mapped.

## Prompt 39 Delta

Prompt 39 extends the same read-only path:

- extends `purchaseorders` projection to include status, items, expected delivery date, and received fields
- reads `deliverystatuses` metadata for order status classification
- adds `reservedQuantityCandidate()`
- adds `incomingStockQuantityCandidate()`
- recalculates `available_quantity`
- adds `projected_available_quantity` and `projected_days_of_cover`

## Inspected Supporting Semantics

| Area | File | Reused semantics |
|---|---|---|
| Purchase status enum | `backend/src/purchase/dto/create-purchase-order.dto.ts` | `draft`, `ordered`, `partially_received`, `received`, `cancelled`. |
| Purchase order schema | `backend/src/purchase/schemas/purchase-order.schema.ts` | `items.quantity`, `items.quantityReceived`, `expectedDeliveryDate`, `status`. |
| Purchase receive service | `backend/src/purchase/purchase-order.service.ts` | Receiving PO updates `quantityReceived` and inventory, so unreceived quantity is the incoming candidate. |
| Delivery status schema | `backend/src/delivery-status/schemas/delivery-status.schema.ts` | `isActive`, `isFinal`, `isPaymentTrigger`, `isReturnStatus`. |
| Delivery status service | `backend/src/delivery-status/delivery-status.service.ts` | Default statuses and status flags define active/final/payment/return semantics. |
| Order status canonicalization | `backend/src/test-order2/test-order2.service.ts` | Canonicalizes order status strings, but no reservation field exists. |
| Tests | `backend/src/ai-data-pack/ai-data-pack.service.spec.ts` | Existing focused OperationsCapacityQuery tests extended. |

No new module, schema, migration, provider adapter, or export path was added.

