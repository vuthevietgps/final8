# Schema And No Action Guard Carry Forward

Prompt45 guard preserved:

- Recursively rejects exact banned keys in emitted targeted rows.
- Exact-key matching avoids blocking legitimate evidence metadata.
- Prompt47 added additional exact banned keys required by the new prompt:
  - `action_draft_schema`
  - `approval_workflow`
  - `provider_request`
  - `provider_response`
  - `validate_only`
  - `live_execution`

Prompt46 guard preserved:

- Every targeted row must include non-empty canonical evidence fields:
  - `finding_key`
  - `finding_label`
  - `evidence_strength`
  - `source_domain`
  - `source_collections_or_modules`
  - `time_window`
  - `affected_entity_type`
  - `affected_entity_id`
  - `affected_entity_name_or_alias`
  - `metric_name`
  - `metric_value`
  - `threshold_value`
  - `calculation_method`
  - `sample_size`
  - `data_quality_status`
  - `confidence`
  - `recommended_advisory_language`
  - `not_allowed_actions`
- `data_quality_status` is checked against the repo metadata enum.
- `confidence` is checked against the repo metadata enum.
- Partial/weak rows must carry downgrade/advisory context.
- `not_allowed_actions` must contain `do_not_`.
- Finding-specific minimum field groups remain checked.

Prompt47 addition:

- The same hardened evidence must be visible at the Director section path, not only at query helper level.
