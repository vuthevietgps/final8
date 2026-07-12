# Schema No Action Guard

Preserved checks:

- canonical evidence fields are present and non-empty
- repo-valid `data_quality_status`
- repo-valid `confidence`
- partial/weak advisory context
- finding-specific minimum evidence groups
- recursive exact banned-key rejection
- `not_allowed_actions` includes `do_not_`

Prompt47 added exact banned keys for action draft schema, approval workflow, provider request/response, validate_only, and live_execution.
