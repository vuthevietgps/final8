# Hardened Findings Inventory

| finding_key | latest accepted prompt | implementation status | Director JSON section/path | read-only sources | confidence/data quality behavior | remaining weak fields | action payloads absent |
|---|---|---|---|---|---|---|---|
| `low_inventory_best_seller` | Prompt39 | `implemented_partial_read_only_upgrade` | `16_operation_capacity` / `operation_capacity` / `operational_risk_findings` | `inventorysummaries`, `products`, `ordertest2`, `purchaseorders`, `deliverystatuses` | `partial`, confidence `medium` when reorder/days-of-cover and velocity are supportable | reserved quantity is derived; incoming stock is candidate; confirmed reservation semantics missing | yes |
| `supplier_cost_up` | Prompt40 | `implemented_read_only_slice` | `16_operation_capacity` / `operation_capacity` / `operational_risk_findings` | `supplierquotes`, `products`, `quotes` | `partial`, confidence `medium` only when dealer price history supports lag; otherwise `low` | approval status and effective dates can be incomplete; dealer price history can be missing | yes |
| `overdue_dealer_receivables` | Prompt41 | `implemented_read_only_slice` | `16_operation_capacity` / `operation_capacity` / `operational_risk_findings` | `ordertest2`, `agentstatements`, `users` | `partial`, confidence `medium` with due date/balance/payment owner context; otherwise `low` | last payment date, collection owner, statement linkage can be missing | yes |
| `labor_overtime_high` | Prompt42 | `implemented_read_only_slice` | `16_operation_capacity` / `operation_capacity` / `operational_risk_findings` | `laborcost1`, `laborstatements`, `ordertest2`, `users` | `partial`, confidence `low` due derived overtime and missing policy/SLA/capacity | canonical overtime policy, SLA pressure, staff capacity, team attribution | yes |
| `slow_supplier_good_cost` | Prompt43 | `implemented_read_only_slice` | `16_operation_capacity` / `operation_capacity` / `operational_risk_findings` | `supplierquotes`, `purchaseorders`, `products`, `inventorysummaries`, `users` | `partial`, confidence `medium` only with PO sample, lead-time threshold, and accepted quote status; otherwise `low` | reliability score, delivery quality notes, configured thresholds, variant grouping, margin impact | yes |

All five targeted findings are accounted for. Each is read-only and advisory-only.

