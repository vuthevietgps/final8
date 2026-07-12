# Data Quality And Confidence Limits

Current repo enum values:

- `data_quality_status`: `ok`, `partial`, `weak`, `missing`, `stale`
- `confidence`: `high`, `medium`, `low`

All five hardened findings are read-only advisory evidence and currently remain `partial` in the guarded fixture.

Finding limits:

- `low_inventory_best_seller`: confidence is `medium` in the guarded fixture; reservation and incoming stock are derived candidates, not canonical operational facts.
- `supplier_cost_up`: confidence can be `medium` or `low`; depends on supplier/dealer quote approval, effective dates, product cost history, and dealer price history.
- `overdue_dealer_receivables`: confidence can be `medium` or `low`; depends on last payment date and collection owner; settlement semantics remain weak.
- `labor_overtime_high`: confidence is `low`; overtime policy, SLA pressure, staff capacity, and team mapping are not canonical.
- `slow_supplier_good_cost`: confidence can be `medium` or `low`; depends on fulfilled PO count, accepted quote count, configured delivery threshold, and reliability evidence.

Production readiness disclaimer:

- These findings are not sufficient for production action automation.
- They are evidence for Director review, not proof that the ERP should mutate orders, prices, supplier decisions, inventory, cashflow, staffing, payroll, or ads.

Autonomous execution readiness disclaimer:

- No finding is ready for autonomous execution.
- Any future action phase must introduce separate BA-approved contracts, provider validation, approval gates, policy checks, and test coverage in a new explicit phase.
