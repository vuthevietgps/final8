# Implementation Decision

Decision:

```text
implemented_partial_read_only_upgrade
```

Reason:

Prompt 38 authorized a partial read-only upgrade. Existing repository fields can safely derive cautious candidates:

- reserved candidate from active non-final/non-payment/non-return order rows
- incoming candidate from unreceived quantities on `ordered` and `partially_received` purchase orders

The implementation keeps:

- `data_quality_status: partial`
- `confidence: medium`
- advisory-only wording
- explicit `not_allowed_actions`

No blocker was hit for the partial read-only implementation.

Remaining blocker for strong evidence:

- no canonical reserved stock field
- no confirmed incoming-stock approval semantics
- no automatic replenishment or purchase action is allowed

