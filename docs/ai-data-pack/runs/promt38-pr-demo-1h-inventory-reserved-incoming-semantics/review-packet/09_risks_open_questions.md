# Risks And Open Questions

Risks:

- Derived reserved quantity may be wrong for supplier/dropship fulfillment.
- Derived incoming stock may be wrong if `ordered` is not a confirmed PO.
- Missing expected delivery dates weaken projected stock coverage.
- Ambiguous dynamic statuses must be excluded or downgraded.

Open questions:

- Should `DeliveryStatus` get a future `reservesInventory` flag?
- Should `TestOrder2` persist `productSource`?
- Should PO confirmation/approval status be modeled before strong incoming evidence?

