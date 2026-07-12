# Incoming Stock Implementation

Implemented field:

```text
incoming_stock_quantity_candidate
```

Formula:

```text
incoming_stock_quantity_candidate =
  sum(max(0, purchaseorders.items.quantity - purchaseorders.items.quantityReceived))
  where item.productId = evidence product
    and purchaseorders.status in ['ordered', 'partially_received']
```

Included PO statuses:

- `ordered`
- `partially_received`

Excluded:

- `draft`
- `cancelled`
- `received`
- missing/unknown status
- items without matching productId
- non-positive remaining quantity

Important boundary:

`inventorybatches.quantityRemaining` is not counted as incoming stock. It represents received batch quantity remaining after FIFO issues.

Evidence fields:

- `incoming_stock_quantity`
- `incoming_stock_quantity_candidate`
- `incoming_stock_source`
- `incoming_purchase_order_count`
- `incoming_expected_delivery_dates`
- `incoming_statuses_included`
- `incoming_statuses_excluded_or_ambiguous`

Representative test result:

```json
{
  "incoming_stock_quantity_candidate": 12,
  "incoming_stock_source": "purchase_order_unreceived_quantity_candidate",
  "incoming_purchase_order_count": 2,
  "incoming_expected_delivery_dates": ["2026-06-10", "2026-06-11"],
  "incoming_statuses_included": ["ordered", "partially_received"],
  "incoming_statuses_excluded_or_ambiguous": ["cancelled", "draft", "non_positive_remaining_purchase_order_quantity", "received"]
}
```

