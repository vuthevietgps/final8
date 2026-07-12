# Reserved Quantity Semantics

Decision:

```text
reserved_quantity_derivable_with_caution
```

## Is There An Existing Canonical Reserved Stock Field?

No.

Inspected models do not expose a canonical reserved stock field:

- `InventorySummary` has `onHand` and `avgCost`
- `InventoryBatch` has `quantityRemaining`, but this is remaining received batch stock
- `InventoryTransaction` records movements, not reservations
- `TestOrder2` has `productId`, `quantity`, `isActive`, `productionStatus`, `orderStatus`, but no reservation field

## Can Reserved Quantity Be Derived Read-Only From Existing Orders?

Yes, with caution.

Future derivation can calculate a `reserved_quantity_candidate` from active non-final order rows:

```text
reserved_quantity_candidate =
  sum(ordertest2.quantity)
  grouped by productId
  where isActive != false
    and productId exists
    and quantity > 0
    and orderStatus is active / non-final / non-payment-trigger / non-return
```

This is not canonical reserved stock because there is no persisted reservation event and no proof that each order is fulfilled from inventory rather than dropship/supplier flow.

## Statuses That Should Count As Reserved

Use dynamic delivery status flags when available:

```text
DeliveryStatus.isActive = true
DeliveryStatus.isFinal = false
DeliveryStatus.isPaymentTrigger = false
DeliveryStatus.isReturnStatus = false
```

Fallback default order statuses that can count:

- `Chua co ma van don` / canonical no-tracking status
- `Dang giao` / canonical shipping status

Additional canonicalized statuses such as waiting pickup may count only if they are present in `delivery-status` with the same active/non-final/non-payment/non-return flags.

## Statuses That Must Be Excluded

Exclude:

- final statuses
- payment-trigger statuses
- return statuses
- inactive delivery statuses
- inactive orders (`isActive === false`)
- missing `productId`
- missing or non-positive `quantity`

Fallback exclusions:

- `Giao thanh cong`
- `Hang hoan`

Also exclude ambiguous raw statuses if no delivery-status metadata can classify them.

## Fields Needed

Minimum fields:

- `ordertest2.productId`
- `ordertest2.quantity`
- `ordertest2.isActive`
- `ordertest2.orderStatus`
- delivery-status metadata: `name`, `isActive`, `isFinal`, `isPaymentTrigger`, `isReturnStatus`

Optional but useful fields:

- `ordertest2.productionStatus`
- `ordertest2.orderDate`
- `ordertest2.updatedAt`

## Confidence And Data Quality

Recommended future row values:

```text
reserved_quantity_source: order_status_derived_candidate
reserved_quantity_data_quality_status: partial
reserved_quantity_confidence: low_to_medium
```

The row can improve evidence from on-hand-only to partial stock-pressure evidence, but it must not support a strong replenishment/action conclusion.

## Exact Blockers

Remaining blockers for strong reserved quantity:

- no canonical `reservedQuantity` field
- no durable reservation event/table
- no `reservesInventory` flag in delivery status
- `productSource` exists in DTO but is not persisted in `TestOrder2`
- no order-to-inventory-reservation linkage

