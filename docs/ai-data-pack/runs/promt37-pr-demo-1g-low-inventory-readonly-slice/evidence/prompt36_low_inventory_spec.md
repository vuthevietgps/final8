# Finding Spec - `low_inventory_best_seller`

## Current Evidence

- Classification: `detected_but_weak_evidence`
- Evidence location: `18_alerts`
- Current label: `best_selling_product_low_inventory`

## Why Evidence Is Weak

The current Director JSON exposes the alert label but not a joined view of best-seller rank, SKU/product id, current inventory, reserved quantity, available quantity, reorder threshold, incoming stock, sales velocity, or days of cover.

## Business Meaning For Director

A high-selling product may be at risk of stockout. The Director can review inventory pressure, but should not create purchase/replenishment actions from an alert label alone.

## Minimum ERP Fields/Tables Needed

- best-seller rank
- SKU/product id
- current inventory
- reserved quantity
- available quantity
- reorder threshold
- incoming stock
- sales velocity
- days of cover
- recent order count and quantity sold

## Likely Current ERP Collections/Modules To Inspect Later

- `inventorysummaries`
- `inventorytransactions`
- `inventorybatches`
- `products`
- `ordertest2`
- purchase order/incoming stock modules

## Proposed Director JSON Read-Only Evidence Rows

| field | proposed value |
|---|---|
| `finding_key` | `low_inventory_best_seller` |
| `finding_label` | `Best-selling product has low available inventory` |
| `source_domain` | `inventory` |
| `source_collections_or_modules` | `inventorysummaries, inventorytransactions, products, ordertest2` |
| `affected_entity_type` | `product_or_sku` |
| `metric_name` | `days_of_cover` |
| `threshold_value` | `reorder threshold or minimum days of cover` |
| `comparison_period` | `recent sales velocity window` |
| `calculation_method` | `available quantity / average daily sales velocity` |
| `data_quality_status` | `partial until reserved and incoming stock are mapped` |
| `not_allowed_actions` | `do_not_create_purchase_order; do_not_mutate_inventory` |

## Data Quality Gates

- Product/SKU must map to inventory summary.
- Current, reserved, and available quantity must be consistent.
- Reorder threshold must have a source.
- Sales velocity window must be defined.
- Incoming stock must be included or explicitly unavailable.
- If available quantity or velocity is missing, ChatGPT Web must downgrade confidence.

## Example Advisory-Only Wording

"This best-selling product appears to have low available stock relative to sales velocity. Review replenishment manually after confirming reserved quantity, incoming stock, and reorder threshold."

## Future Implementation Acceptance Criteria

- Director JSON includes bestseller rank.
- Director JSON includes available quantity and days of cover.
- Director JSON includes reorder threshold source.
- Director JSON distinguishes current, reserved, and incoming stock.

## Future Tests

- Unit test for days of cover calculation.
- Fixture test for bestseller with low available quantity.
- Negative test for missing sales velocity.
- Data quality downgrade test for missing incoming stock.

## must_not_do_now

- Do not implement inventory query changes in Prompt 36.
- Do not add migrations.
- Do not create purchase orders.
- Do not mutate inventory.
- Do not open Action Draft Schema.

