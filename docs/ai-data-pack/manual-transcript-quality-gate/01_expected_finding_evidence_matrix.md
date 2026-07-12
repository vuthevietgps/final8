# Expected Finding Evidence Matrix

Source of truth: Prompt 33 validation table rows.

Authoritative counts:

- `detected_with_evidence`: `7`
- `detected_but_weak_evidence`: `5`
- `missed`: `0`
- `hallucinated_or_unsupported`: `0`

| finding_key | classification | evidence_location | evidence_strength | is_safe_for_director_advisory_analysis | recommended_future_data_hardening |
|---|---|---|---|---|---|
| `supplier_cost_up` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` | Add supplier quote history, product cost change history, dealer price update history, and quote-to-product joins so the finding is supported beyond alert labels. |
| `ad_spend_spike` | `detected_with_evidence` | `18_alerts + 09_marketing_profitability` | `strong` | `yes` | Preserve ad group daily spend/conversion/profit rows and add stable campaign/ad group names for easier review. |
| `cash_gap` | `detected_with_evidence` | `18_alerts + 05_financial_context + 07_cashflow_scenarios` | `strong` | `yes` | Add aging buckets and cashflow scenario assumptions for stronger pressure timing analysis. |
| `overdue_dealer_receivables` | `detected_but_weak_evidence` | `18_alerts + 16_operation_capacity` | `weak` | `caution` | Add dealer/agent receivable aging rows, due dates, invoice/order linkage, last collection date, and collection owner. |
| `low_inventory_best_seller` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` | Add best-seller ranking, inventory summary, reorder threshold, reserved quantity, incoming stock, and stockout risk windows. |
| `labor_overtime_high` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` | Add labor timesheets, overtime hours, labor cost, revenue-by-period, and capacity/SLA joins. |
| `negative_margin_product_group` | `detected_with_evidence` | `10_service_group_performance + 11_product_variant_performance + 12_unit_economics + 18_alerts` | `strong` | `yes` | Add realized profit fields and cost component breakdown to separate estimated and realized margin. |
| `slow_supplier_good_cost` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` | Add supplier reliability metrics, lead time, late delivery count, quote price, accepted order count, and service quality notes. |
| `high_sales_late_payment_agent` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` | Add agent statement aging, sales volume, collection due date, and account owner fields for stronger prioritization. |
| `return_rate_above_policy` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` | Add return policy threshold source, return reasons by SKU/offer, and return outcome status. |
| `google_ads_mapping_gap` | `detected_with_evidence` | `20_mapping_report + 19_data_quality` | `strong` | `yes` | Add durable search term, UTM, lead, order, and customer relation keys to improve attribution confidence. |
| `inventory_movement_gap` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` | Add inventory movement source document type, source id integrity checks, and purchase order relation diagnostics. |

