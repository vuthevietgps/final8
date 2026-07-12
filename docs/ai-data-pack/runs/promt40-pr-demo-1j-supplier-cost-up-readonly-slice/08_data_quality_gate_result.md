# Data Quality Gate Result

Implemented gate behavior:

- Supplier quote must map to a product. If product mapping is missing, no row is emitted.
- Current and prior supplier quote/cost must exist. If prior supplier quote is missing, no row is emitted.
- Supplier quote prices must be positive numeric values.
- Supplier quote effective dates must exist from `effectiveAt`, `createdAt`, or `updatedAt`; otherwise no row is emitted.
- Cost increase must be greater than `15%`.
- Dealer price row/history is joined by product when available.
- Dealer price history missing does not create fake data; it downgrades confidence to `low`.
- Dealer price effective date missing downgrades confidence.
- Dealer quote approval status is used when available; missing/non-approved approval status downgrades confidence.
- Supplier quote approval status is reported when present, otherwise marked as unavailable in the current schema.
- Product cost history is not claimed as durable; current product cost-like fields are labelled as current-only.
- No price update action is allowed.

Data quality result:

```text
data_quality_status: partial
confidence: medium when approved dealer history is older than supplier cost increase
confidence: low when dealer history/effective date/approval evidence is missing
```

Missing prior cost result:

```text
no supplier_cost_up row emitted
```

