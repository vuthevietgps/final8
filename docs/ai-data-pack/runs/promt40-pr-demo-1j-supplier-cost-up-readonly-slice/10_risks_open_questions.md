# Risks And Open Questions

Risks:

- Supplier quote approval status is not canonical in `SupplierQuote`; evidence remains partial.
- Product cost history is not durable; current `products.importPrice`, `products.totalCost`, or `products.suppliers.appliedPrice` cannot prove historical cost approval.
- Dealer price history may be incomplete or not one-to-one with supplier/product economics.
- The row lives in `16_operation_capacity` because that is the existing read-only risk evidence surface; a future domain-specific supplier/pricing section may be cleaner.

Open questions:

- Should supplier quote approval be formalized in the supplier quote schema in a later BA/code phase?
- Should dealer price lists be modeled separately from agent quotes?
- Should product cost history be captured as immutable cost events before this evidence can become strong?

