# Director JSON Contract Impact

The Director path remains unchanged:

```text
sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings
```

Future threshold-source evidence should appear as read-only fields inside each evidence row. It must not become an action payload.

## Recommended future row fields

- `threshold_source_key`
- `threshold_source_type`
- `threshold_source_version_or_effective_date`
- `threshold_source_approval_status`
- `threshold_source_owner`
- `threshold_source_default_used`
- `weak_fields_present`
- `missing_or_weak_fields`
- `semantic_notes`
- `confidence_reason`
- `data_quality_reason`

## Example shape

```json
{
  "finding_key": "supplier_cost_up",
  "threshold_source_key": "supplier_cost.cost_increase_percent_threshold",
  "threshold_source_type": "business_policy_config",
  "threshold_source_version_or_effective_date": "2026-06-01",
  "threshold_source_approval_status": "approved",
  "weak_fields_present": ["margin_cogs_impact"],
  "missing_or_weak_fields": ["dealer_price_lag_threshold"],
  "semantic_notes": "Threshold metadata is read-only evidence.",
  "confidence_reason": "Supplier quote and dealer price dates exist, but margin impact is missing."
}
```

## Non-action boundary

These fields must not include:

- action ids
- action draft payloads
- provider operation names
- approval state transitions
- mutate commands
- dry-run/live execution settings
- price, purchase, inventory, payroll, schedule, cashflow, or ads changes

XLSX readers should continue to treat the JSON path as the source of truth. Prompt49 proves XLSX compatibility but does not make XLSX the canonical analysis surface.

