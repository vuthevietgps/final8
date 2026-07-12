# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Reason:

Existing ERP read models support a safe partial evidence row for `low_inventory_best_seller` without adding schema, migrations, fake data, or write paths.

The implementation is intentionally advisory-only:

- it emits read-only rows into existing operations evidence
- it sets `data_quality_status` to `partial`
- it sets `confidence` to `medium`
- it includes `blocking_reason_if_any` for missing reserved and incoming stock
- it explicitly sets `not_allowed_actions`

Blocked branches not opened:

- Action Draft Schema
- action import
- OpenAI upload/call
- approval workflow
- provider validateOnly/mutation/live execution
- inventory/purchase/replenishment mutation

