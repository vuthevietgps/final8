# Available Quantity And Days Of Cover Semantics

## Option A: Available = On Hand Only

Formula:

```text
available_quantity = inventorysummaries.onHand
days_of_cover = available_quantity / sales_velocity_per_day
```

Pros:

- already implemented in Prompt 37
- simple and directly backed by `InventorySummary.onHand`
- does not rely on ambiguous reservation or incoming semantics

Cons:

- overstates available stock if active orders already consume inventory
- ignores incoming replenishment
- cannot distinguish immediate stockout risk from future replenishment coverage

Risk:

- ChatGPT Web may infer stock is available for new demand when existing orders may consume it.

Required data quality:

- product maps to inventory summary
- `onHand` exists
- sales velocity exists

Recommended usage:

- keep as fallback/advisory only
- confidence no higher than medium/partial

## Option B: Available = On Hand - Reserved

Formula:

```text
available_quantity = max(0, onHand - reserved_quantity_candidate)
days_of_cover = available_quantity / sales_velocity_per_day
```

Pros:

- better reflects immediate sellable inventory pressure
- can be derived read-only from order rows and delivery-status flags
- does not add incoming stock that has not arrived

Cons:

- reserved quantity is a candidate, not canonical reservation
- order rows do not prove whether fulfillment is inventory or dropship
- ambiguous raw order statuses must be excluded

Risk:

- may understate stock if some non-final orders are supplier/dropship orders and do not consume local inventory.

Required data quality:

- all Option A requirements
- delivery-status metadata available or fallback statuses used
- order rows include `productId`, `quantity`, `isActive`, `orderStatus`
- ambiguous statuses excluded and counted in data-quality warnings

Recommended usage:

```text
recommended_formula_for_next_partial_upgrade
```

Use this for the next read-only implementation upgrade, still with `data_quality_status: partial`.

## Option C: Available = On Hand - Reserved + Confirmed Incoming

Formula:

```text
projected_available_quantity = max(0, onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)
projected_days_of_cover = projected_available_quantity / sales_velocity_per_day
```

Pros:

- shows near-future coverage if confirmed incoming stock exists
- uses existing PO `quantity - quantityReceived`
- helps Director separate immediate stock pressure from replenishment pipeline

Cons:

- should not be called immediate available quantity
- incoming stock has PO-status ambiguity until confirmation/approval semantics are stronger
- expected delivery date may be missing

Risk:

- may overstate coverage if an ordered PO is delayed, not confirmed, or cancelled later.

Required data quality:

- all Option B requirements
- PO item fields: `productId`, `quantity`, `quantityReceived`
- PO status in `ordered` or `partially_received`
- expected delivery date preferred

Recommended usage:

- expose separately as `projected_available_quantity` and `projected_days_of_cover`
- do not mix projected incoming into immediate `available_quantity`

## Recommended Future Formula

Immediate availability:

```text
available_quantity = max(0, inventorysummaries.onHand - reserved_quantity_candidate)
```

Projected availability:

```text
projected_available_quantity =
  max(0, inventorysummaries.onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)
```

Immediate days of cover:

```text
days_of_cover = available_quantity / sales_velocity_per_day
```

Projected days of cover:

```text
projected_days_of_cover = projected_available_quantity / sales_velocity_per_day
```

## Downgrade And Refusal Rules

Downgrade confidence when:

- reserved quantity is derived rather than canonical
- incoming stock lacks expected delivery date
- only fallback order statuses are used
- ambiguous statuses are excluded
- sales velocity window has small sample size

Refuse strong conclusion when:

- `onHand` is missing
- product mapping is missing
- sales velocity is missing
- order quantity is missing for reserved derivation
- PO item quantity or quantityReceived is missing for incoming derivation

