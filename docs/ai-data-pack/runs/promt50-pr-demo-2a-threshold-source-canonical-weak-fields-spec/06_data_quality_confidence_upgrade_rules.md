# Data Quality And Confidence Upgrade Rules

## General rules

Use only current repo enum values:

- `data_quality_status`: `ok | partial | weak | missing | stale`
- `confidence`: `high | medium | low`

Do not claim `high` confidence unless all material threshold sources are approved, effective-dated, reviewed, and source evidence is fresh enough for the report window.

If evidence is useful but has weak semantics, emit a row with downgrade context rather than suppressing it. If a row lacks minimum identity, metric, or threshold basis, do not emit the row.

## `low_inventory_best_seller`

Minimum row emission:

- product/SKU id exists
- inventory summary exists with numeric on-hand
- sales velocity window has positive quantity and timestamps
- reorder point or days-of-cover threshold exists
- row breaches reorder point or days-of-cover threshold

Low confidence:

- bestseller window or sales sample is thin
- reserved/incoming semantics are missing or derived only

Medium confidence:

- current repo state: `products.minStock`, inventory, velocity, reserved candidate, and incoming candidate are present.

High confidence:

- only future: approved threshold sources for rank/window, days of cover, reservation, incoming stock, and formula; fresh inventory and order data.

No row:

- missing product mapping, inventory mapping, sales velocity, or threshold.

Downgrade row:

- derived reserved quantity, candidate incoming stock, ambiguous order/PO statuses, missing confirmation policy.

## `supplier_cost_up`

Minimum row emission:

- product and supplier ids exist
- current and prior positive supplier costs exist
- current quote date and prior quote date exist
- cost increase exceeds threshold

Low confidence:

- dealer price history missing
- approval status missing
- product cost effective date missing

Medium confidence:

- dealer price history exists and is older than supplier cost increase, with usable effective date/status.

High confidence:

- only future: approved supplier quote statuses, product cost ledger, dealer price ledger, lag threshold, and margin/COGS impact are all canonical and fresh.

No row:

- no prior supplier cost, missing product/supplier mapping, invalid price, or increase below threshold.

Downgrade row:

- missing dealer price history, quote approval status, effective date, cost history, or margin impact.

## `overdue_dealer_receivables`

Minimum row emission:

- dealer/agent id exists
- due date exists and is before report/as-of date
- positive outstanding balance exists
- payment status is not paid or not applicable

Low confidence:

- last payment date missing
- collection owner missing
- statement linkage missing
- terminology boundary unresolved

Medium confidence:

- due date, balance, payment context, last payment, owner, and statement linkage are present.

High confidence:

- only future: formal finance glossary and versioned settlement/receivable policy, statement-order linkage, current aging, and owner mapping.

No row:

- missing due date, missing positive outstanding amount, paid status, not-applicable status, or missing dealer/agent id.

Downgrade row:

- missing payment history, owner, statement linkage, or ambiguous receivable/payable/settlement terminology.

## `labor_overtime_high`

Minimum row emission:

- labor rows with positive work hours exist
- current and prior comparison windows exist
- current and prior overtime candidates are positive
- revenue/workload comparison exists
- overtime growth exceeds revenue/workload growth

Low confidence:

- current repo state because overtime threshold is hardcoded candidate and SLA/capacity/team mapping are missing.

Medium confidence:

- future only when overtime policy, source hierarchy, team mapping, workload window, and capacity are configured and fresh.

High confidence:

- future only when SLA/deadline pressure and labor cost attribution are also canonical, reviewed, and aligned with the report window.

No row:

- missing comparable revenue/workload period, missing overtime hours, no positive prior overtime, or overtime growth does not exceed comparison metric.

Downgrade row:

- missing canonical overtime threshold, SLA pressure, staff capacity, team mapping, or labor cost attribution.

## `slow_supplier_good_cost`

Minimum row emission:

- product and supplier ids exist
- current supplier quote exists
- peer quote comparison exists
- cost advantage exceeds threshold
- fulfilled PO sample has a slow delivery signal

Low confidence:

- accepted quote status missing
- lead-time threshold missing
- sample size small
- quality notes/reliability/margin impact missing

Medium confidence:

- current repo can reach medium when fulfilled PO count is at least 2, lead-time threshold exists, and accepted quote count is present.

High confidence:

- only future: configured cost advantage threshold, peer method, accepted quote status, supplier lead-time SLA, reliability score, delivery quality, variant grouping, and margin/COGS impact.

No row:

- missing product/supplier mapping, missing peer cost, missing slow delivery signal, invalid price, or cost advantage below threshold.

Downgrade row:

- missing configured threshold, accepted quote status, prior PO sample, delivery quality notes, reliability score, variant-level mapping, reserved/sales usage context, or margin/COGS impact.

