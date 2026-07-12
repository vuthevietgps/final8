# Prompt 37 - PR-DEMO-1G

Status: `implemented_read_only_slice`

This run implements a read-only Director JSON evidence slice for `low_inventory_best_seller`.

Output root:

```text
docs/ai-data-pack/runs/promt37-pr-demo-1g-low-inventory-readonly-slice/
```

No files were intentionally written outside this run folder except the scoped backend query and test files needed for the read-only implementation.

Safety boundary preserved:

- no Action Draft Schema
- no action import
- no OpenAI API upload/call
- no approval workflow
- no dry-run/live provider execution
- no provider mutation or validateOnly path
- no DB migration or production schema
- no inventory, purchase, replenishment, or ads-platform mutation

