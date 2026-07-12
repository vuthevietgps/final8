# Finding Spec - `supplier_cost_up`

## Current Evidence

- Classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Current label: `supplier_cost_up_15_percent_without_matching_dealer_price_update`

## Why Evidence Is Weak

The Director JSON currently exposes the alert label, but does not provide enough supplier quote history, product cost history, dealer price update history, joins, effective dates, approval status, cost increase percent, or dealer price update lag.

## Business Meaning For Director

Supplier costs may be increasing faster than dealer/customer prices. If true, margin can compress before the business notices. The Director can review pricing pressure, but should not approve price changes based only on the current alert label.

## Minimum ERP Fields/Tables Needed

- supplier quote history
- product cost history
- dealer price update history
- product id and supplier id
- dealer price list id
- quote effective date
- product cost effective date
- dealer price effective date
- approval status for quote/cost/price changes
- cost increase percent
- dealer price update lag in days

## Likely Current ERP Collections/Modules To Inspect Later

- `supplierquotes`
- `quotes`
- `products`
- `productcategories`
- `purchaseorders`
- supplier/dealer pricing settings if present

## Proposed Director JSON Read-Only Evidence Rows

| field | proposed value |
|---|---|
| `finding_key` | `supplier_cost_up` |
| `finding_label` | `Supplier cost increased without matching dealer price update` |
| `source_domain` | `supplier_pricing` |
| `source_collections_or_modules` | `supplierquotes, products, quotes, purchaseorders` |
| `affected_entity_type` | `product_supplier_pair` |
| `metric_name` | `cost_increase_percent` |
| `threshold_value` | `15_percent` |
| `comparison_period` | `current quote versus prior approved cost` |
| `calculation_method` | `(current_supplier_cost - previous_supplier_cost) / previous_supplier_cost` |
| `data_quality_status` | `partial until dealer price history is joined` |
| `not_allowed_actions` | `do_not_change_prices; do_not_create_supplier_actions` |

## Data Quality Gates

- Supplier quote must map to product.
- Product must map to dealer/customer price row.
- Both supplier cost and dealer price must have effective dates.
- Approval status must be known.
- Sample size must include at least one current and one prior approved quote/cost.
- If dealer price history is missing, ChatGPT Web must downgrade confidence.

## Example Advisory-Only Wording

"Supplier cost appears to have increased faster than dealer price updates for this product/supplier pair. Treat as margin pressure requiring pricing review; do not auto-change prices without approved pricing workflow."

## Future Implementation Acceptance Criteria

- Director JSON includes cost increase percent.
- Director JSON includes dealer price update lag.
- Director JSON includes source quote/cost/price effective dates.
- ChatGPT Web can cite evidence row fields, not only alert labels.

## Future Tests

- Unit test for cost increase percent calculation.
- Fixture test for missing dealer price update.
- Negative test when prior cost is absent.
- Data quality downgrade test when approval status is missing.

## must_not_do_now

- Do not implement query changes in Prompt 36.
- Do not add DB migrations.
- Do not generate seed data.
- Do not create price update actions.
- Do not open Action Draft Schema.

