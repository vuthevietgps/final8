# Operational Risk Findings Inventory

Prompt45 guards the five hardened findings accepted by Prompt44:

| finding_key | current surface | evidence status | safety expectation |
|---|---|---|---|
| `low_inventory_best_seller` | `operation_capacity` / `operational_risk_findings` | read-only / partial | no purchase order, inventory, stock, or action payload fields |
| `supplier_cost_up` | `operation_capacity` / `operational_risk_findings` | read-only / partial | no price, supplier action, provider, or action payload fields |
| `overdue_dealer_receivables` | `operation_capacity` / `operational_risk_findings` | read-only / partial | no collection, cashflow, customer, order, provider, or action payload fields |
| `labor_overtime_high` | `operation_capacity` / `operational_risk_findings` | read-only / partial | no staffing, schedule, payroll, timesheet, cashflow, provider, or action payload fields |
| `slow_supplier_good_cost` | `operation_capacity` / `operational_risk_findings` | read-only / partial | no purchase, supplier order, inventory, stock, cost, price, COGS, provider, or action payload fields |

All rows are expected to retain advisory safety text in `not_allowed_actions`.

