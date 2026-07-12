# Data Quality Gates

These gates tell ChatGPT Web when to downgrade confidence or refuse strong conclusions.

## `supplier_cost_up`

Minimum data completeness:

- current and prior supplier cost exist
- product and supplier mapping exists
- dealer price row exists or is explicitly missing
- effective dates and approval status exist

Freshness requirement:

- supplier cost and dealer price history must cover the reporting window and comparison period

Mapping requirement:

- supplier quote maps to product and dealer price row

Sample size requirement:

- at least one prior approved cost and one current approved cost per product/supplier pair

Threshold source requirement:

- cost increase percent threshold must be documented

Downgrade confidence when:

- dealer price history is missing
- approval status is unknown
- effective dates are partial

Refuse strong conclusion when:

- prior cost is absent
- product/supplier mapping is missing

## `overdue_dealer_receivables`

Minimum data completeness:

- receivable row, due date, outstanding balance, and dealer/agent id exist

Freshness requirement:

- receivable aging must be current as of report date

Mapping requirement:

- receivable maps to invoice/order and dealer/agent

Sample size requirement:

- enough rows to show aging bucket totals

Threshold source requirement:

- payment terms or aging threshold source must be known

Downgrade confidence when:

- last payment date is missing
- collection owner is missing

Refuse strong conclusion when:

- due date is missing
- outstanding balance cannot be calculated

## `low_inventory_best_seller`

Minimum data completeness:

- bestseller rank, product/SKU id, current inventory, reserved quantity, available quantity, and sales velocity exist

Freshness requirement:

- inventory snapshot and sales velocity window must be recent enough for the report date

Mapping requirement:

- product/SKU maps to inventory summary and order rows

Sample size requirement:

- sales velocity window has enough orders to avoid one-off noise

Threshold source requirement:

- reorder threshold or minimum days-of-cover threshold must be known

Downgrade confidence when:

- incoming stock is missing
- reserved quantity is missing

Refuse strong conclusion when:

- available quantity or sales velocity is missing

## `labor_overtime_high`

Minimum data completeness:

- timesheet/overtime rows, labor cost, comparable revenue period, and overtime threshold exist

Freshness requirement:

- labor and revenue periods align with the report window

Mapping requirement:

- labor rows map to team/department and comparable revenue/workload context

Sample size requirement:

- enough workdays/shifts to avoid one-off spikes

Threshold source requirement:

- overtime policy threshold must be documented

Downgrade confidence when:

- workload/SLA data is missing
- staff capacity is missing

Refuse strong conclusion when:

- revenue comparison period is missing
- overtime hours cannot be calculated

## `slow_supplier_good_cost`

Minimum data completeness:

- supplier lead time, late delivery count, fulfilled PO count, accepted quote count, and quote/cost comparison exist

Freshness requirement:

- delivery and quote windows cover the same recent period

Mapping requirement:

- purchase orders and accepted quotes map to supplier

Sample size requirement:

- enough fulfilled POs to calculate reliability

Threshold source requirement:

- lead time threshold and cost advantage threshold must be known

Downgrade confidence when:

- delivery quality notes are missing
- peer supplier comparison is incomplete

Refuse strong conclusion when:

- promised date or received date is missing
- fulfilled PO sample size is too small

