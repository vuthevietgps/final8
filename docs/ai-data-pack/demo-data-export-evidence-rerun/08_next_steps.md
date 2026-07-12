# 08 Next Steps

Recommended next phase:

`PR-DEMO-1B-FIX - Surface missing demo findings in Director export and document smoke export harness, Dev/Test Only`

Reason:

- Prompt 31 apply/export/download succeeded.
- The downloaded Director JSON exposes 9 of 12 expected synthetic findings.
- Three seeded demo findings are not surfaced by the current Director export:
  - `high_sales_late_payment_agent`
  - `return_rate_above_policy`
  - `inventory_movement_gap`

Suggested scope:

1. Add or document a repeatable dev/test Director export smoke harness.
2. Fix cached export download metadata or document why only partial/official export supports direct artifact download.
3. Extend Director Data Pack sections or mapping so agent-statement, return-rate, and inventory-movement demo signals are visible.
4. Re-run Prompt 31 expected findings check until 12 of 12 are present.

Do not start Action Draft Schema, import action, OpenAI API upload, provider mutation, provider validateOnly, dry-run/live execution, or Phase 3 in this next step.

