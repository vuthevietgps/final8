# Evidence Mirror - Prompt 34 Weak Evidence Hardening Backlog

Top note: This is a summarized evidence mirror copied into the Prompt 35 run folder. Source file: `docs/ai-data-pack/manual-transcript-quality-gate/02_weak_evidence_hardening_backlog.md`.

This is a backlog/spec note only. Prompt 35 does not implement fields or tables.

The weak-evidence findings are exactly:

- `supplier_cost_up`
- `overdue_dealer_receivables`
- `low_inventory_best_seller`
- `labor_overtime_high`
- `slow_supplier_good_cost`

Future hardening themes:

- supplier quote history, product cost changes, and dealer price update history
- dealer/agent receivable aging, due dates, invoice/order linkage, and last payment date
- best-seller rank, inventory summary, reorder threshold, reserved quantity, and sales velocity
- labor timesheet rows, overtime hours, labor cost, revenue period joins, and SLA/capacity data
- supplier lead time, late delivery count, fulfilled purchase orders, and quote price comparison

Must not do now:

- do not implement schema/query changes in Prompt 35
- do not create actions
- do not open Action Draft Schema
- do not open provider or approval branches

