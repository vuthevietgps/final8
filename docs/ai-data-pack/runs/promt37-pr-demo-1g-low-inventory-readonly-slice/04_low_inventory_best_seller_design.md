# Low Inventory Best Seller Design

Target evidence row fields:

| Field | Implemented value/source |
|---|---|
| `finding_key` | `low_inventory_best_seller` |
| `finding_label` | `best_selling_product_low_inventory` |
| `evidence_strength` | `medium` |
| `source_domain` | `inventory` |
| `source_collections_or_modules` | `inventorysummaries, products, ordertest2` |
| `time_window` | dated order velocity window |
| `affected_entity_type` | `product_or_sku` |
| `affected_entity_id` | product id |
| `affected_entity_name_or_alias` | product name, SKU, or product id |
| `metric_name` | `days_of_cover` |
| `metric_value` | calculated days of cover |
| `threshold_value` | `products.minStock` plus 7-day cover threshold |
| `comparison_period` | dated order velocity window |
| `calculation_method` | recent quantity divided by window days, then onHand divided by velocity |
| `sample_size` | recent order count |
| `data_quality_status` | `partial` |
| `confidence` | `medium` |
| `blocking_reason_if_any` | reserved quantity and incoming stock are not mapped |
| `recommended_advisory_language` | manual review wording from Prompt 36 intent |
| `not_allowed_actions` | no purchase order, no inventory mutation, no replenishment execution |

Domain fields implemented:

- `bestseller_rank`
- `sku`
- `current_inventory_quantity`
- `reserved_quantity`
- `available_quantity`
- `available_quantity_assumption`
- `reorder_threshold`
- `reorder_threshold_source`
- `incoming_stock_quantity`
- `incoming_stock_source`
- `sales_velocity_per_day`
- `days_of_cover`
- `recent_order_count`
- `recent_order_quantity`

Important data-quality constraint:

`available_quantity` is exported as `inventorysummaries.onHand` only with an explicit assumption because reserved quantity is unavailable. This supports advisory review only, not a replenishment action.

