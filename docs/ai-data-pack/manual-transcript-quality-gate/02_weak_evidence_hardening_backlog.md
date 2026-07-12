# Weak Evidence Hardening Backlog

This backlog is a spec note only. Do not code these fields or tables in Prompt 34.

The weak-evidence findings are exactly:

- `supplier_cost_up`
- `overdue_dealer_receivables`
- `low_inventory_best_seller`
- `labor_overtime_high`
- `slow_supplier_good_cost`

## `supplier_cost_up`

Current evidence:

- Transcript classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Alert label: `supplier_cost_up_15_percent_without_matching_dealer_price_update`

Why evidence is weak:

- The transcript saw the alert label, but not a full supplier quote/product cost/dealer price update table.

Minimum additional ERP fields/tables needed:

- supplier quote history
- product cost history
- dealer price history
- product id and supplier id joins
- effective date and approval status for price changes

Suggested future BA/code phase:

- `PR-DEMO-1D-FOLLOWUP supplier cost evidence hardening`

must_not_do_now:

- Do not implement schema changes or query changes in Prompt 34.
- Do not open Action Draft Schema.
- Do not create price update actions.

## `overdue_dealer_receivables`

Current evidence:

- Transcript classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts + 16_operation_capacity`
- Related operational signal: `high_sales_late_payment_agent`

Why evidence is weak:

- Dealer receivable detail is not independently expanded in the transcript evidence.

Minimum additional ERP fields/tables needed:

- dealer or agent receivable aging
- invoice/order linkage
- due date
- last payment date
- outstanding balance
- collection owner

Suggested future BA/code phase:

- `PR-DEMO-1D-FOLLOWUP receivable aging evidence hardening`

must_not_do_now:

- Do not implement receivable workflow changes in Prompt 34.
- Do not create collection actions.
- Do not open approval workflow.

## `low_inventory_best_seller`

Current evidence:

- Transcript classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Alert label: `best_selling_product_low_inventory`

Why evidence is weak:

- The transcript saw the alert label, but detailed inventory-by-best-seller rows were not expanded.

Minimum additional ERP fields/tables needed:

- best-seller rank
- product id/SKU
- current inventory
- reserved quantity
- reorder threshold
- incoming stock
- days of cover
- recent sales velocity

Suggested future BA/code phase:

- `PR-DEMO-1D-FOLLOWUP inventory bestseller evidence hardening`

must_not_do_now:

- Do not implement inventory schema changes in Prompt 34.
- Do not create purchase or replenishment actions.
- Do not mutate inventory.

## `labor_overtime_high`

Current evidence:

- Transcript classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Alert label: `labor_overtime_high_without_matching_revenue_growth`

Why evidence is weak:

- The transcript saw the alert label, but detailed labor/overtime rows were not expanded.

Minimum additional ERP fields/tables needed:

- labor timesheet rows
- overtime hours
- labor cost by period
- revenue by comparable period
- shift/staff capacity
- SLA/deadline workload

Suggested future BA/code phase:

- `PR-DEMO-1D-FOLLOWUP labor overtime evidence hardening`

must_not_do_now:

- Do not implement labor schema/query changes in Prompt 34.
- Do not create staffing actions.
- Do not open provider or approval branches.

## `slow_supplier_good_cost`

Current evidence:

- Transcript classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Alert label: `slow_reliability_supplier_with_good_cost`

Why evidence is weak:

- The transcript saw the alert label, but supplier reliability and lead-time rows were not expanded.

Minimum additional ERP fields/tables needed:

- supplier lead time
- late delivery count
- accepted quote count
- fulfilled purchase order count
- quote price/cost comparison
- delivery quality issue notes

Suggested future BA/code phase:

- `PR-DEMO-1D-FOLLOWUP supplier reliability evidence hardening`

must_not_do_now:

- Do not implement supplier scorecard changes in Prompt 34.
- Do not create supplier replacement actions.
- Do not open Action Draft Schema.

