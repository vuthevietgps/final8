# Implementation Decision

Decision: `implemented_read_only_slice`

Reason:

- Existing supplier quote data can support a read-only supplier cost advantage comparison.
- Existing purchase order data can support a read-only slow supplier signal using expected and received dates.
- Existing product data can support supplier-product mapping and optional lead-time threshold context.
- Existing inventory summary data can provide read-only stock context.
- No schema migration, fake evidence, production database access, or mutation path is required.

Director JSON section:

- `16_operation_capacity`
- Nested data path: `operation_capacity` and `operational_risk_findings`

