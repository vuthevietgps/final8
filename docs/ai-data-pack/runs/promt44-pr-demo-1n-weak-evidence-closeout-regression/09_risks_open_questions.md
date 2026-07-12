# Risks And Open Questions

Risks:

- Evidence remains partial/advisory, not production-ready.
- `low_inventory_best_seller` still uses derived reserved and incoming stock semantics.
- `supplier_cost_up` can be low-confidence when approval/effective dates or dealer price history are incomplete.
- `overdue_dealer_receivables` has terminology risk around agent/dealer settlement semantics.
- `labor_overtime_high` uses derived overtime candidate and lacks canonical SLA/staff capacity.
- `slow_supplier_good_cost` lacks configured reliability score, delivery quality notes, and policy thresholds.
- Static scans include many pre-existing provider/OpenAI/mutation modules outside Prompt44 scope; they are not evidence of Prompt44 changes.

Open questions:

- Should future phases define configured threshold sources for all five findings?
- Should a separate QA phase add a single explicit no-action-payload assertion across every operational risk finding row?
- Should delivery quality/reliability score and canonical reservation semantics become read-only source registry metrics before any action phase?

