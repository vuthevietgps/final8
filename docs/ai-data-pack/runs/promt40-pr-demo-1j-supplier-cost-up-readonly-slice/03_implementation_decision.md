# Implementation Decision

Decision:

```text
implemented_read_only_slice
```

Reason:

Existing ERP models provide enough read-only fields to create partial advisory evidence:

- `supplierquotes` has product/supplier quote history with price and effective dates.
- `products` maps supplier quote product ids to product names/SKUs and current cost-like fields.
- `quotes` has dealer/customer price rows with status and effective date fields.
- Director JSON already has a read-only risk evidence surface in `16_operation_capacity`.

Non-blocking gaps:

- `SupplierQuote` has no canonical approval status in the schema.
- Product cost history is not durable; only current product cost-like fields are available.
- Dealer price history may be missing for some products.

These gaps force `data_quality_status: partial` and confidence downgrade logic, but they do not block an advisory read-only row.

