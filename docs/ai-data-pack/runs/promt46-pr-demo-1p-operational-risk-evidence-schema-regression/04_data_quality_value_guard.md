# Data Quality Value Guard

Repo enum source:

`backend/src/ai-data-pack/contracts/metadata.contract.ts`

Allowed `data_quality_status` values:

- `ok`
- `partial`
- `weak`
- `missing`
- `stale`

Allowed `confidence` values:

- `high`
- `medium`
- `low`

Prompt46 guard behavior:

- Imports the enum types from the metadata contract.
- Uses typed Sets to validate emitted row values.
- Requires partial or weak rows to carry context through at least one of:
  - `missing_or_weak_fields`
  - `blocking_reason_if_any`
  - `inventory_semantics_data_quality_notes`
  - `receivable_semantics_note`
  - `available_quantity_assumption`
- Requires `recommended_advisory_language` and `not_allowed_actions` to be present on every targeted row.

Current fixture result:

- The targeted rows emit `data_quality_status: partial`.
- Confidence values are `medium` or `low`.
- All targeted rows include advisory language and action-blocking text.
