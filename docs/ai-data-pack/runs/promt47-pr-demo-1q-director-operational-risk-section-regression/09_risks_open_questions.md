# Risks And Open Questions

Residual risks:

- Section `16_operation_capacity` JSON shape changed from exposing only the operation capacity rows at `data` to exposing the full operations payload at `data.operation_capacity`. This is intentional for Prompt47 but downstream readers that assumed `section.data` is always an array should be aware.
- The guard uses deterministic fake in-memory data and does not prove production data quality.
- The repository worktree is already dirty/untracked, including `backend/src/ai-data-pack/`, so review should inspect file content and test output rather than relying only on clean tracked diff output.
- Static scans include existing provider/mutation/token code outside Prompt47 scope.

Open questions:

- Whether a future follow-up should add an XLSX-specific assertion for how nested `16_operation_capacity` data is rendered.
- Whether the schema/no-action guard should be extracted into a shared test helper if more Director section guards are added.

No blocker remains for Prompt47.
