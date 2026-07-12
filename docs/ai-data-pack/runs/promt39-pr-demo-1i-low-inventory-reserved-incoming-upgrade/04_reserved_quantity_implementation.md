# Reserved Quantity Implementation

Implemented field:

```text
reserved_quantity_candidate
```

Formula:

```text
reserved_quantity_candidate =
  sum(ordertest2.quantity)
  where productId = evidence product
    and isActive != false
    and quantity > 0
    and orderStatus is active/non-final/non-payment/non-return
```

Implementation:

- uses dynamic `deliverystatuses` metadata when present
- includes statuses where `isActive=true`, `isFinal!=true`, `isPaymentTrigger!=true`, `isReturnStatus!=true`
- falls back only to safe no-tracking/shipping status keys if metadata is absent
- excludes inactive orders
- excludes missing/non-positive quantities
- excludes final/payment-trigger/return/inactive/ambiguous statuses

Evidence fields:

- `reserved_quantity`
- `reserved_quantity_candidate`
- `reserved_quantity_source`
- `reserved_order_count`
- `reserved_statuses_included`
- `reserved_statuses_excluded_or_ambiguous`

Representative test result:

```json
{
  "reserved_quantity_candidate": 4,
  "reserved_quantity_source": "order_status_derived_candidate_using_delivery_status_metadata",
  "reserved_order_count": 2,
  "reserved_statuses_included": ["awaiting_tracking", "shipping"],
  "reserved_statuses_excluded_or_ambiguous": ["delivered", "inactive_order", "manual_hold", "returned"]
}
```

Quality:

Reserved stock remains a derived candidate, not canonical reservation.

