# Risks And Open Questions

Risks:

- `reserved_quantity_candidate` is derived, not canonical reservation.
- `incoming_stock_quantity_candidate` relies on PO status naming, not a separate approval confirmation.
- Dynamic delivery statuses can be edited, so ambiguous statuses must remain excluded.
- Projected availability may overstate coverage if an ordered PO is delayed.

Open questions:

- Should a future schema add canonical reservation semantics?
- Should PO confirmation/approval be modeled before strong incoming evidence?
- Should `TestOrder2.productSource` be persisted to distinguish inventory vs supplier fulfillment?
- Should Director JSON get a dedicated inventory evidence section later?

Residual blocker:

Evidence must remain partial/medium until canonical reserved and confirmed incoming semantics exist.

