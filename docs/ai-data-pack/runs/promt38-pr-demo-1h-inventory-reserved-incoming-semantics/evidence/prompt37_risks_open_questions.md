# Risks And Open Questions

Remaining risks:

- `available_quantity` is provisional because reserved quantity is not mapped.
- Incoming stock is not mapped, so Director review must check replenishment manually.
- The slice ranks products only within the order rows returned by the current query, not a separately curated merchandising bestseller table.
- `inventorybatches.quantityRemaining` exists but was not used as incoming stock because this phase did not establish safe incoming-stock semantics.

Open questions for a later phase:

- Which ERP field represents reserved stock?
- Which purchase order state should count as incoming stock?
- What report window should become canonical for sales velocity?
- Should the system expose a dedicated inventory evidence section rather than embedding these rows in `16_operation_capacity`?

Safety risk:

The evidence row includes explicit `not_allowed_actions` and no executable payload. The remaining risk is interpretive: ChatGPT Web must not transform this advisory row into a replenishment or ads action.

