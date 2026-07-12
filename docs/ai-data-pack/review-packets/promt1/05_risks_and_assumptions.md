# Risks And Assumptions

P0 risks:

- GMV or supplier-held cash may be misread as usable company cash.
- Agent records may be incorrectly assumed to always represent tier-2 agents.
- Max `updatedAt` may be treated as successful source sync.
- Sensitive employee/payroll/supplier data may leak through broad Director Pack permissions.
- Saved sample artifacts may be mistaken for current source behavior.
- Candidate Phase 2.2 source may be mistaken for accepted implementation even though backend build and focused tests fail compile.
- Generic or legacy action paths may bypass Google V2-grade guardrails.

V1 assumptions requiring explicit labels:

- `ProductCategory = service_group`.
- `Product = product_variant`.
- `SupplierPayable` is semantically supplier commission receivable.
- `AgentStatement` is semantically agent/tier-2 payable only when business policy confirms the role.
- Customer referral attribution is unavailable; Messenger referral events are not a durable customer referral graph.
- Operations capacity is unavailable; current status counts are not capacity.
