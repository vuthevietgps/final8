# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Reason:

Existing read models support partial evidence safely. Missing reserved and incoming stock are represented as null plus explicit downgrade/blocking language instead of being invented.

