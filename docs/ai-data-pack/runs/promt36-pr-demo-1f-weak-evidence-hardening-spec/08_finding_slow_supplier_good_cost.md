# Finding Spec - `slow_supplier_good_cost`

## Current Evidence

- Classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Current label: `slow_reliability_supplier_with_good_cost`

## Why Evidence Is Weak

The current Director JSON exposes the alert label but not supplier lead time, late delivery count, fulfilled purchase order count, accepted quote count, quote/cost comparison, delivery quality notes, reliability score, or cost advantage.

## Business Meaning For Director

A supplier may offer good cost but weak reliability. The Director can review procurement tradeoffs, but should not prioritize, demote, or replace a supplier without lead-time and reliability evidence.

## Minimum ERP Fields/Tables Needed

- supplier lead time
- late delivery count
- fulfilled purchase order count
- accepted quote count
- quote/cost comparison
- delivery quality notes
- reliability score
- cost advantage
- purchase order promised date
- purchase order received date

## Likely Current ERP Collections/Modules To Inspect Later

- `supplierquotes`
- `purchaseorders`
- `supplierstatements`
- `inventorybatches`
- `inventorytransactions`
- supplier quality modules if present

## Proposed Director JSON Read-Only Evidence Rows

| field | proposed value |
|---|---|
| `finding_key` | `slow_supplier_good_cost` |
| `finding_label` | `Supplier has good cost but slow reliability` |
| `source_domain` | `supplier_reliability` |
| `source_collections_or_modules` | `supplierquotes, purchaseorders, supplierstatements, inventorybatches` |
| `affected_entity_type` | `supplier` |
| `metric_name` | `lead_time_and_cost_advantage` |
| `threshold_value` | `lead time threshold and cost advantage threshold` |
| `comparison_period` | `recent purchase order window` |
| `calculation_method` | `average delivery delay plus cost comparison against supplier peer group` |
| `data_quality_status` | `partial until promised and received dates are mapped` |
| `not_allowed_actions` | `do_not_replace_supplier; do_not_create_procurement_action` |

## Data Quality Gates

- Purchase orders must map to supplier.
- Promised and received dates must exist or be explicitly missing.
- Accepted quote count must be available.
- Cost comparison peer group must be defined.
- Delivery quality notes must be available or marked missing.
- If received date is missing, ChatGPT Web must refuse strong reliability conclusions.

## Example Advisory-Only Wording

"This supplier appears cost-competitive but may be slower or less reliable. Review lead-time history and delivery quality before procurement prioritization decisions."

## Future Implementation Acceptance Criteria

- Director JSON includes average lead time and late delivery count.
- Director JSON includes fulfilled purchase order count.
- Director JSON includes quote/cost advantage metric.
- Director JSON includes reliability score or explicit reason it cannot be calculated.

## Future Tests

- Unit test for average lead time and late delivery count.
- Fixture test for good cost but slow delivery.
- Negative test for missing promised/received dates.
- Data quality downgrade test for insufficient purchase order sample size.

## must_not_do_now

- Do not implement supplier reliability query changes in Prompt 36.
- Do not add migrations.
- Do not create procurement actions.
- Do not open provider or approval branches.
- Do not open Action Draft Schema.

