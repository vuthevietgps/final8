# Risks and Assumptions

- Default staleness thresholds require final Director/BA approval.
- Some collection names rely on confirmed Mongoose default pluralization.
- Several sources only prove local `max(updatedAt)`, not external/provider sync.
- Meta/TikTok use local advertising-cost evidence only.
- Payments use partial order-level evidence; no canonical payment ledger was confirmed.
- Operations has current state but no durable SLA/status history.
- Supplier settlement criticality remains pending approval.
- Fresh sources may still lack report-date coverage or mapping/completeness.
- No public endpoint/RBAC/download, official/partial export, provider adapter or snapshot integration exists.
- Full repository tests and real DB assessment were not run.
