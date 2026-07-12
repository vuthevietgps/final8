# Threshold Inventory

Current threshold state:

| Finding | Current source | Status |
|---|---|---|
| `low_inventory_best_seller` | `products.minStock`, implicit `7` days cover, derived reserved/incoming candidates | partial |
| `supplier_cost_up` | implicit `15` percent, supplier quote history, dealer quote lag | partial |
| `overdue_dealer_receivables` | order due date before report date, derived aging buckets | partial |
| `labor_overtime_high` | implicit `8h/day`, 7-day current/prior windows, overtime growth > revenue growth | weak/partial |
| `slow_supplier_good_cost` | implicit `5` percent cost advantage, PO delay, `estimatedDeliveryDays` if present | partial |

Main gap:

Current repo has useful fields but no canonical threshold source registry.

