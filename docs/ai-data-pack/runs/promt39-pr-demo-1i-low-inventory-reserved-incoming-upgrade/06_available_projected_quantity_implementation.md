# Available And Projected Quantity Implementation

Implemented formulas:

```text
available_quantity = max(0, inventorysummaries.onHand - reserved_quantity_candidate)
projected_available_quantity = max(0, inventorysummaries.onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)
days_of_cover = available_quantity / sales_velocity_per_day
projected_days_of_cover = projected_available_quantity / sales_velocity_per_day
```

Existing on-hand field preserved:

```text
current_inventory_quantity = inventorysummaries.onHand
```

Assumption made explicit:

```text
reserved quantity is a derived candidate from active non-final/non-payment/non-return order statuses; not a canonical inventory reservation.
```

Representative test result:

```json
{
  "current_inventory_quantity": 12,
  "reserved_quantity_candidate": 4,
  "incoming_stock_quantity_candidate": 12,
  "available_quantity": 8,
  "projected_available_quantity": 20,
  "sales_velocity_per_day": 2.4,
  "days_of_cover": 3.33,
  "projected_days_of_cover": 8.33
}
```

The row remains advisory-only and cannot create purchase/replenishment actions.

