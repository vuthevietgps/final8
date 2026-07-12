# Next Recommendation

Proceed only after director and ChatGPT Web Pro Extended review.

First implementation prompt:

```text
PR-2.2: restore AI Data Pack compile/test health, then verify and accept the five P0 export fixes only.
Do not add new BA sheets, endpoint, model or migration.
Fix the checksum helper type contract and stale focused test calls without changing business behavior.
Run focused AI Data Pack tests and build until both pass.
Regenerate fixed sample exports twice.
Prove empty-sheet quality metadata, normalized actor metadata,
deterministic content checksum, split finance quality dimensions,
and explicit value-state distinctions.
Keep all action import, dry-run and live execution gates false.
```

After PR-2.2 acceptance, write and approve PR-2.3A pre-export sync/freshness and section-level RBAC technical specification before implementation.
