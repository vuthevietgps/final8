# Canonical Evidence Model

This is a read-only Director JSON evidence row model.

It is not Action Draft Schema. It does not define executable actions, provider mutations, action imports, approval workflows, or live execution.

## Proposed Row Fields

| Field | Meaning |
|---|---|
| `finding_key` | Stable expected finding key, such as `supplier_cost_up`. |
| `finding_label` | Human-readable label for Director/ChatGPT Web review. |
| `evidence_strength` | `strong`, `medium`, or `weak`. |
| `source_domain` | Domain such as supplier, receivables, inventory, labor, or procurement. |
| `source_collections_or_modules` | ERP collections/modules used to build the row. |
| `time_window` | Date range used for calculation. |
| `affected_entity_type` | Entity type, such as supplier, dealer, product, SKU, labor team, or purchase order. |
| `affected_entity_id` | Redacted/stable id if safe to expose. |
| `affected_entity_name_or_alias` | Redacted name or display alias safe for Director review. |
| `metric_name` | Metric being measured, such as cost increase percent or days of cover. |
| `metric_value` | Actual metric value. |
| `threshold_value` | Policy or business threshold used for comparison. |
| `comparison_period` | Prior period, baseline, or target period. |
| `calculation_method` | Plain-language calculation description. |
| `sample_size` | Number of rows/orders/items included. |
| `data_quality_status` | `ok`, `partial`, `weak`, or `missing`. |
| `confidence` | `high`, `medium`, or `low`. |
| `blocking_reason_if_any` | Reason ChatGPT Web must not make a strong conclusion. |
| `recommended_advisory_language` | Safe director-level wording. |
| `not_allowed_actions` | Actions explicitly out of scope. |

## Usage

Future Director JSON exports can include these rows in an evidence section or nested under existing sections. ChatGPT Web should use these rows to separate evidence-backed conclusions from alert-label-only signals.

## Non-Action Boundary

This model must not include:

- action ids
- executable payloads
- provider operation names
- Google/Facebook mutation instructions
- approval state transitions
- auto-publish flags
- dry-run/live execution commands

