# Next Recommendation

Recommended next step:

`PR-DEMO-1G select the first read-only implementation slice for weak-evidence hardening, still no Action Draft Schema.`

Suggested first slice:

`low_inventory_best_seller`

Reason:

- It has clear fields and calculations: bestseller rank, inventory, reserved quantity, available quantity, reorder threshold, incoming stock, sales velocity, and days of cover.
- It can remain read-only.
- It can be tested without provider execution.

Do not open this implementation in Prompt 36.

Still forbidden:

- Action Draft Schema
- action import
- OpenAI API upload/call
- provider execution/mutation
- provider validateOnly
- production DB
- Phase 3

