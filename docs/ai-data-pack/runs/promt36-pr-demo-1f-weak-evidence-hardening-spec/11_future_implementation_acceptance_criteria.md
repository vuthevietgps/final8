# Future Implementation Acceptance Criteria

This file defines future criteria only. Prompt 36 does not implement code.

Future weak-evidence hardening can be accepted only if:

- export/download JSON remains parseable
- no secret/token/public URL/raw provider payload exposure exists
- all 5 weak findings are upgraded from alert-label-only to evidence-backed
- each finding has read-only evidence rows
- each finding has data quality status and confidence
- each finding has downgrade/refusal behavior when data is missing
- tests exist for each finding
- demo seed evidence exists if needed in a later approved phase
- no Action Draft Schema is opened
- no action import is added
- no approval workflow is added
- no provider execution or mutation is added
- no provider validateOnly is added
- no production DB is used

Acceptance by finding:

- `supplier_cost_up`: cost increase percent, effective dates, approval status, and dealer price lag are visible.
- `overdue_dealer_receivables`: aging bucket, due date, outstanding balance, and collection owner are visible.
- `low_inventory_best_seller`: bestseller rank, available quantity, reorder threshold, incoming stock, velocity, and days of cover are visible.
- `labor_overtime_high`: overtime hours, labor cost, comparable revenue, workload/SLA, staff capacity, and threshold are visible.
- `slow_supplier_good_cost`: lead time, late delivery count, fulfilled PO count, accepted quote count, cost comparison, and reliability score are visible.

