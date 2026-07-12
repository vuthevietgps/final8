# Risks And Open Questions

## Risks

- Derived reserved quantity may overstate reservation if some active orders are supplier/dropship orders.
- Derived reserved quantity may understate reservation if stock is reserved by a workflow not represented in order statuses.
- Incoming stock derived from `ordered` status may overstate pipeline if the PO is not truly confirmed.
- Missing expected delivery dates weaken projected coverage.
- Dynamic delivery statuses can be edited; future implementation must treat ambiguous statuses cautiously.
- Strong evidence remains blocked without canonical reserved or confirmed incoming semantics.

## Open Questions

- Should delivery statuses add a future `reservesInventory` flag?
- Should orders persist `productSource` if inventory-vs-supplier fulfillment matters?
- Should PO statuses have an approval/confirmation gate before counting incoming stock?
- What sales velocity window is canonical for Director evidence?
- Should immediate availability and projected availability be separate Director fields?

