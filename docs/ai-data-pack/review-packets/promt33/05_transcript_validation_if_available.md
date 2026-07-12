# Transcript Validation If Available

Transcript validation was performed because the transcript file now exists.

## Expected Findings

| Finding | Classification | Evidence location |
|---|---|---|
| `supplier_cost_up` | `detected_but_weak_evidence` | `18_alerts` |
| `ad_spend_spike` | `detected_with_evidence` | `18_alerts + 09_marketing_profitability` |
| `cash_gap` | `detected_with_evidence` | `18_alerts + 05_financial_context + 07_cashflow_scenarios` |
| `overdue_dealer_receivables` | `detected_but_weak_evidence` | `18_alerts + 16_operation_capacity` |
| `low_inventory_best_seller` | `detected_but_weak_evidence` | `18_alerts` |
| `labor_overtime_high` | `detected_but_weak_evidence` | `18_alerts` |
| `negative_margin_product_group` | `detected_with_evidence` | `10_service_group_performance + 11_product_variant_performance + 12_unit_economics + 18_alerts` |
| `slow_supplier_good_cost` | `detected_but_weak_evidence` | `18_alerts` |
| `high_sales_late_payment_agent` | `detected_with_evidence` | `16_operation_capacity` |
| `return_rate_above_policy` | `detected_with_evidence` | `16_operation_capacity` |
| `google_ads_mapping_gap` | `detected_with_evidence` | `20_mapping_report + 19_data_quality` |
| `inventory_movement_gap` | `detected_with_evidence` | `16_operation_capacity` |

## Counts

- `detected_with_evidence`: `7`
- `detected_but_weak_evidence`: `5`
- `missed`: `0`
- `hallucinated_or_unsupported`: `0`
- total classified: `12`

Minor note: the transcript prose summary says `6` / `6`, but the actual table rows parse as `7` / `5`. Validation uses the table rows as source of truth.

## Safety

The transcript stays advisory only, avoids action import, avoids OpenAI/API automation, avoids provider mutation, avoids provider validateOnly, avoids Phase 3, and provides director-level reasoning rather than a generic restatement.
