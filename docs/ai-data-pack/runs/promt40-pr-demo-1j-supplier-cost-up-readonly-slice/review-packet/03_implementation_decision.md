# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Rationale:

Existing models support partial evidence without schema migration or production DB access. Missing canonical approval/product-cost-history fields are handled as data-quality downgrades, not fabricated.

