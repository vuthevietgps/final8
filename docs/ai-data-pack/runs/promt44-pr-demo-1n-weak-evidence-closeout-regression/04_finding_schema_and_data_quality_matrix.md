# Finding Schema And Data Quality Matrix

## `low_inventory_best_seller`

- Canonical fields: finding key/label, evidence strength, source domain, collections, time window, affected product/SKU, metric, threshold, comparison period, calculation method, sample size, data quality, confidence, advisory language, not-allowed actions.
- Domain fields: bestseller rank, current inventory, reserved quantity candidate, available quantity, incoming quantity candidate, projected available quantity, sales velocity, days of cover.
- Row blockers: missing product/inventory mapping, missing sales velocity, missing reorder/days-of-cover threshold.
- Downgrades: derived reserved quantity, candidate incoming stock, incomplete reservation semantics.
- Advisory style: review replenishment manually.
- Safety text: no purchase order creation, no inventory mutation, no replenishment execution.

## `supplier_cost_up`

- Canonical fields: finding key/label, evidence strength, source domain, collections, affected product-supplier pair, metric, threshold, comparison period, calculation method, sample size, data quality, confidence, advisory language, not-allowed actions.
- Domain fields: current/prior supplier quote, quote dates, approval status, product cost candidate, dealer price history, dealer price lag.
- Row blockers: missing prior supplier cost, missing product/supplier mapping, current supplier increase below threshold.
- Downgrades: missing dealer price history, missing approval status, missing effective dates.
- Advisory style: pricing review only.
- Safety text: no price changes, no supplier actions, no dealer price mutation, no purchase order, no ads execution.

## `overdue_dealer_receivables`

- Canonical fields: finding key/label, source domain, collections, affected dealer/agent, metric, threshold, calculation method, sample size, data quality, confidence, advisory language, not-allowed actions.
- Domain fields: due date, days overdue, aging bucket, overdue balance, original amount, paid amount, last payment, statement linkage, collection owner.
- Row blockers: missing due date, missing outstanding balance, paid/not-applicable status.
- Downgrades: missing last payment date, missing collection owner, missing statement linkage.
- Advisory style: settlement pressure review only.
- Safety text: no collection action, no blocking agent, no customer/order/cashflow/provider mutation.

## `labor_overtime_high`

- Canonical fields: finding key/label, evidence strength, source domain, collections, time window, affected labor group, metric, threshold, comparison period, calculation method, sample size, data quality, confidence, advisory language, not-allowed actions.
- Domain fields: current/prior overtime, labor cost growth, revenue growth, workload/order count, labor statements, overtime threshold candidate.
- Row blockers: missing comparable revenue period, missing overtime hours.
- Downgrades: missing canonical overtime policy, SLA pressure, staff capacity, team mapping.
- Advisory style: operations capacity/cost review only.
- Safety text: no staffing change, no schedule action, no payroll/timesheet/order/revenue/cashflow/provider mutation.

## `slow_supplier_good_cost`

- Canonical fields: finding key/label, evidence strength, source domain, collections, time window, affected product-supplier pair, metric, threshold, comparison period, calculation method, sample size, data quality, confidence, advisory language, not-allowed actions.
- Domain fields: supplier alias, product alias, SKU, current/prior supplier cost, cost advantage, peer median, currency, lead time, delay days, fulfilled/delayed PO counts, stock context, incoming context.
- Row blockers: missing product/supplier mapping, missing peer cost source, missing slow delivery signal.
- Downgrades: missing configured threshold, missing accepted quote status, missing prior PO sample, missing delivery quality notes, missing reliability score.
- Advisory style: procurement tradeoff review only.
- Safety text: no purchase order, no supplier order, no inventory/stock/cost/price/COGS/order-revenue/cashflow/ads mutation.

