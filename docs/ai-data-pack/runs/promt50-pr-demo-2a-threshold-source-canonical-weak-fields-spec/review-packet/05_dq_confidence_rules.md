# Data Quality And Confidence Rules

Enum values used:

- `data_quality_status`: `ok | partial | weak | missing | stale`
- `confidence`: `high | medium | low`

Rule summary:

- Missing identity, source mapping, core metric, or threshold basis can block row emission.
- Missing semantic support fields should usually emit with downgrade context.
- Current rows should not claim high confidence.
- High confidence is future-only and requires approved, effective-dated, reviewed threshold sources plus fresh source data.

