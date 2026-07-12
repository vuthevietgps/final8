# Threshold Source Contract

This is a BA-level contract for future read-only implementation. It is not a database migration or DTO.

## Contract fields

| Field | Required now | Future implementation expectation |
|---|---:|---|
| `threshold_key` | yes | Stable unique key, e.g. `low_inventory.days_of_cover_threshold`. |
| `finding_key` | yes | One of the five approved finding keys only. |
| `business_owner` | yes | Owning business role or team, e.g. `operations`, `finance`, `procurement`. |
| `source_type` | yes | `schema_field`, `derived_candidate`, `business_policy_config`, `manual_director_config`, or `future_registry`. |
| `source_module_or_collection` | yes | Collection/module name such as `products`, `purchaseorders`, `laborcost1`. |
| `field_path_or_config_key` | yes | Field path or proposed config key. |
| `value_type` | yes | `number`, `percent`, `days`, `date`, `status_set`, `formula`, `text`, `boolean`, or `enum`. |
| `unit` | yes | Unit such as `percent`, `days`, `VND`, `quantity`, `hours`, `status`. |
| `default_allowed` | yes | Whether a default can be used when no approved source exists. |
| `effective_from` | optional now | Required for production-grade registry records. |
| `effective_to` | optional now | Required when policy changes are versioned. |
| `approval_status` | yes | `approved`, `draft`, `deprecated`, `unknown`, or `not_applicable`. |
| `last_reviewed_at` | optional now | Required before raising confidence to high. |
| `data_quality_status_impact` | yes | How missing/stale/unapproved threshold affects row quality. |
| `confidence_impact` | yes | How threshold quality affects confidence. |
| `fallback_behavior` | yes | `no_row`, `emit_with_downgrade`, or `use_documented_default`. |
| `not_allowed_actions` | yes | Explicit parked actions. Must include `do_not_...` advisory text. |

## Source type definitions

| Source type | Meaning | Confidence ceiling |
|---|---|---|
| `schema_field` | Value exists as a current ERP field, e.g. `products.minStock`. | Medium unless versioned and reviewed. |
| `derived_candidate` | Value is inferred from current records, e.g. active non-final orders as reserved quantity. | Low or medium depending on field. Never high. |
| `business_policy_config` | Approved policy/config owned by business, versioned and effective-dated. | Can support high if source data is also strong. |
| `manual_director_config` | Manually supplied Director setting with owner and review metadata. | Medium unless approval/review workflow is formalized. |
| `future_registry` | Proposed read-only threshold registry record, not implemented in Prompt50. | Future-only. |

## Required safety behavior

Threshold source records must be read-only evidence. They must not include:

- provider operation names
- action draft payloads
- action import fields
- approval transitions
- mutate operations
- dry-run or live execution flags
- purchase, pricing, inventory, stock, cashflow, payroll, staffing, or ads commands

