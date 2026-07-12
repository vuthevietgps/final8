# Data Quality Gate Result

Preserved:

```text
data_quality_status: partial
confidence: medium
```

Implemented gates:

- product mapping missing: no row
- inventory summary or `onHand` missing: no row
- dated sales velocity missing: no row
- active non-final/non-payment/non-return statuses included for reserved candidate
- final/payment/return/inactive/ambiguous statuses excluded from reserved candidate
- `ordered` and `partially_received` POs included for incoming candidate
- `draft`, `cancelled`, `received`, missing/unknown, and non-positive remaining quantities excluded from incoming candidate

Data-quality notes are emitted on each row:

- reserved is derived from status metadata or fallback status keys
- incoming is derived from PO unreceived quantities
- `inventorybatches.quantityRemaining` is not counted as incoming
- evidence remains partial and advisory-only

No strong replenishment conclusion is allowed.

