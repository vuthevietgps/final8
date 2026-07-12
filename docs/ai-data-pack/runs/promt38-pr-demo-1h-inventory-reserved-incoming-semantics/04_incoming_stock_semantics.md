# Incoming Stock Semantics

Decision:

```text
incoming_stock_derivable_with_caution
```

## Is There An Existing Canonical Incoming Stock Field?

No.

No inspected inventory summary or batch field directly means "incoming stock not yet received".

## Can Incoming Stock Be Derived From Purchase Orders Or Inventory Batches?

From purchase orders: yes, with caution.

Future derivation can calculate:

```text
incoming_stock_quantity_candidate =
  sum(max(0, purchaseorders.items.quantity - purchaseorders.items.quantityReceived))
  grouped by items.productId
  where purchaseorders.status in ['ordered', 'partially_received']
```

From inventory batches: no.

`inventorybatches.quantityRemaining` is received batch stock still remaining after FIFO issues. It is on-hand/batch-remaining evidence, not incoming stock.

## Purchase Order Statuses That Count As Incoming

Recommended future inclusion:

- `ordered`
- `partially_received`

Status-specific formula:

- `ordered`: unreceived quantity is `quantity - quantityReceived`
- `partially_received`: unreceived quantity is `quantity - quantityReceived`

## Purchase Order Statuses That Must Be Excluded

Exclude:

- `draft`: not confirmed as ordered
- `cancelled`: no expected incoming
- `received`: already received into inventory
- missing/unknown status unless explicitly mapped later

## Required Fields

Minimum fields:

- `purchaseorders.status`
- `purchaseorders.items.productId`
- `purchaseorders.items.quantity`
- `purchaseorders.items.quantityReceived`

Recommended fields:

- `purchaseorders.expectedDeliveryDate`
- `purchaseorders.updatedAt`
- `purchaseorders.poNumber`

## Confidence And Data Quality

Recommended future row values:

```text
incoming_stock_source: purchase_order_unreceived_quantity
incoming_stock_data_quality_status: partial
incoming_stock_confidence: medium
```

Downgrade to low if:

- `expectedDeliveryDate` is missing
- PO status is missing/unknown
- item quantity or quantityReceived is missing
- product mapping is missing

## Exact Blockers

Remaining blockers for strong incoming stock:

- no explicit PO approval/confirmation workflow was inspected
- no canonical "confirmed incoming" boolean
- `ordered` status semantics rely on enum naming, not an approval audit trail
- expected delivery may be missing

