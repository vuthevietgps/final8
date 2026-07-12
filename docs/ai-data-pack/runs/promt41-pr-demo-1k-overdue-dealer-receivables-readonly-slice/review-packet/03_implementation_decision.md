# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Rationale:

Existing models support partial read-only evidence without schema migration or production DB access. Missing canonical owner, separate invoice, and receivable/payable semantic gaps are handled as data-quality downgrades, not fabricated.

