# Risks And Open Questions

Risks:

- The guard checks exact banned keys. It intentionally allows legitimate evidence fields such as `supplier_quote_approval_status`.
- The guard verifies the current five hardened findings; future findings need to be added to `hardenedOperationalRiskFindings`.
- Static scans include many pre-existing app modules outside ai-data-pack and Prompt45 scope.

Open questions:

- Should a future refactor move the banned-key helper into a shared ai-data-pack test utility?
- Should future operational risk finding additions require a matching entry in this guard before merge?

