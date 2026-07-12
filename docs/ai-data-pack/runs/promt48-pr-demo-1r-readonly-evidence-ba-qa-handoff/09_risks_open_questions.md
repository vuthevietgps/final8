# Risks And Open Questions

Risks:

- Downstream JSON/XLSX readers may still assume `section.data` is a flat array.
- Production data may be incomplete or semantically weak even when test fixtures pass.
- Confidence values are not high; the evidence is intentionally cautious.
- The worktree is dirty/untracked in the current repo, so reviewers should inspect file-level evidence and packets.

Open questions:

- Should the next phase add a reader compatibility guard for nested `16_operation_capacity`?
- Should BA define canonical reservation, incoming stock, overtime policy, delivery quality, supplier reliability, and receivable semantics?
- Should data-quality thresholds be configured before any action-oriented design begins?

No blocker was found for producing the Prompt48 handoff packet.
