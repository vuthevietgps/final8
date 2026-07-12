# Risks And Open Questions

Risks:

- Cost advantage is based on latest peer quote median for same product/currency, not an approved procurement policy.
- Slow supplier signal is based on purchase order expected/received dates, not a formal supplier reliability score.
- Delivery quality notes are not modeled in the current evidence row.
- Accepted quote count is only available when status/approval fields are present; the current SupplierQuote schema does not require those fields.
- Product variant grouping is product/SKU level, not a full variant matrix.
- Margin/COGS impact is intentionally not asserted because supplier-good-to-order margin attribution is not complete in this slice.
- Fulfilled PO sample size can be small; confidence downgrades to low unless sample and threshold fields are stronger.

Open questions:

- Should the cost advantage threshold remain 5 percent or move to a configured policy source?
- Should supplier reliability score become a first-class read-only metric in a future BA/code phase?
- Should delivery quality notes be added as an explicit source before any stronger procurement conclusion?

