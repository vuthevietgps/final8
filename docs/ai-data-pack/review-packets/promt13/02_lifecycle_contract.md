# 02 Lifecycle Contract

Internal method:

```text
AiDataPackExportJobService.createOfficialPartialExportInternal()
```

Supported modes:

- `official_export`
- `partial_export`

Lifecycle statuses:

```text
requested
pre_assessing
syncing_sources
post_assessing
snapshotting
exporting
completed
completed_with_warnings
blocked
failed
expired
```

Behavior:

- Official export blocks on source post-assessment blocking reasons unless `allowDowngradeToPartial=true`.
- Partial export reclassifies weak source blocking reasons as warnings when RBAC and artifact safety pass.
- Downgrade is explicit only and audited with `export_downgraded`.
- Failure and block reasons are sanitized.
- Cached export path remains separate and does not call source sync.
