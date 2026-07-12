# Risks And Open Questions

Risks:

- Existing `agent-receivable` naming conflicts with schema comments; the row is not proof of true dealer accounts receivable.
- Collection owner is not canonical and is inferred from `users.managerId` or statement payment creator.
- Last payment is statement-level, not necessarily allocated to a specific order.
- Separate invoice entities were not found; order id is used as the safest linkage.
- The row lives in `16_operation_capacity` because that is the existing read-only risk evidence surface.

Open questions:

- Should a later BA/code phase rename or split agent payable versus dealer receivable semantics?
- Should a dedicated dealer receivable/invoice ledger be added before this finding can become strong evidence?
- Should collection owner be formalized as a canonical field?

