# Future Implementation Contract

This contract applies only if a later prompt explicitly authorizes code implementation.

Implementation decision:

```text
partial read-only upgrade allowed later
```

## Fields To Add To Evidence Row

Add:

- `reserved_quantity_candidate`
- `reserved_quantity_source`
- `reserved_order_count`
- `reserved_statuses_included`
- `reserved_statuses_excluded_or_ambiguous`
- `incoming_stock_quantity_candidate`
- `incoming_stock_source`
- `incoming_purchase_order_count`
- `incoming_expected_delivery_dates`
- `available_quantity_formula`
- `projected_available_quantity`
- `projected_days_of_cover`
- `inventory_semantics_data_quality_notes`

Keep:

- `finding_key`
- `finding_label`
- `current_inventory_quantity`
- `available_quantity`
- `sales_velocity_per_day`
- `days_of_cover`
- `data_quality_status`
- `confidence`
- `blocking_reason_if_any`
- `not_allowed_actions`

## Calculation Formula

Reserved:

```text
reserved_quantity_candidate =
  sum(ordertest2.quantity)
  where productId = evidence product
    and isActive != false
    and quantity > 0
    and orderStatus is active/non-final/non-payment/non-return
```

Incoming:

```text
incoming_stock_quantity_candidate =
  sum(max(0, purchaseorders.items.quantity - purchaseorders.items.quantityReceived))
  where item.productId = evidence product
    and purchaseorders.status in ['ordered', 'partially_received']
```

Immediate available:

```text
available_quantity = max(0, onHand - reserved_quantity_candidate)
```

Projected available:

```text
projected_available_quantity =
  max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)
```

Days of cover:

```text
days_of_cover = available_quantity / sales_velocity_per_day
projected_days_of_cover = projected_available_quantity / sales_velocity_per_day
```

## Status Filters

Order statuses included:

- dynamic `DeliveryStatus` where `isActive=true`, `isFinal=false`, `isPaymentTrigger=false`, `isReturnStatus=false`
- fallback no-tracking and shipping statuses only if delivery-status metadata is unavailable

Order statuses excluded:

- `isFinal=true`
- `isPaymentTrigger=true`
- `isReturnStatus=true`
- inactive statuses
- ambiguous statuses without metadata

Purchase statuses included:

- `ordered`
- `partially_received`

Purchase statuses excluded:

- `draft`
- `cancelled`
- `received`
- missing/unknown status

## Data Quality Gates

Emit no upgraded row when:

- product mapping is missing
- inventory summary is missing
- `onHand` is missing
- sales velocity is missing
- order date window is missing

Downgrade to partial when:

- reserved is derived, not canonical
- incoming is derived from PO status without approval metadata
- expected delivery date is missing
- ambiguous statuses are excluded

Never raise evidence to strong unless:

- reserved stock is canonical or explicitly approved by BA
- incoming stock status semantics are confirmed
- expected delivery date is present for incoming stock
- sample size and velocity window are sufficient

## Negative Cases

Required negative cases:

- missing product mapping
- missing sales velocity
- missing inventory summary
- ambiguous order status
- `draft` PO excluded from incoming
- `cancelled` PO excluded from incoming
- `received` PO excluded from incoming
- `inventorybatches.quantityRemaining` not counted as incoming

## Tests Required

Required tests in a later implementation prompt:

- reserved derivation from non-final active orders
- reserved exclusion for delivered/returned/final/payment-trigger statuses
- incoming derivation from ordered and partially received PO rows
- incoming exclusion for draft/cancelled/received PO rows
- available quantity recalculation with reserved
- projected available quantity with incoming
- days of cover and projected days of cover
- negative test for ambiguous statuses
- static safety checks for no action/provider/OpenAI/live/mutation path

## Non-Action Boundary

The future implementation must not add:

- action payloads
- action import
- approval workflow
- provider validateOnly/mutation/live execution
- inventory mutation
- purchase/replenishment mutation
- export/download behavior changes

