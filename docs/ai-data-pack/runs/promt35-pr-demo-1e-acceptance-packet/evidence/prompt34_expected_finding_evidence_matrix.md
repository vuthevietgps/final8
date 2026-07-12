# Evidence Mirror - Prompt 34 Expected Finding Evidence Matrix

Top note: This is a summarized evidence mirror copied into the Prompt 35 run folder. Source file: `docs/ai-data-pack/manual-transcript-quality-gate/01_expected_finding_evidence_matrix.md`.

Authoritative counts:

- `detected_with_evidence`: `7`
- `detected_but_weak_evidence`: `5`
- `missed`: `0`
- `hallucinated_or_unsupported`: `0`

| finding_key | classification | evidence_location | evidence_strength | advisory safety |
|---|---|---|---|---|
| `supplier_cost_up` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` |
| `ad_spend_spike` | `detected_with_evidence` | `18_alerts + 09_marketing_profitability` | `strong` | `yes` |
| `cash_gap` | `detected_with_evidence` | `18_alerts + 05_financial_context + 07_cashflow_scenarios` | `strong` | `yes` |
| `overdue_dealer_receivables` | `detected_but_weak_evidence` | `18_alerts + 16_operation_capacity` | `weak` | `caution` |
| `low_inventory_best_seller` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` |
| `labor_overtime_high` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` |
| `negative_margin_product_group` | `detected_with_evidence` | `10_service_group_performance + 11_product_variant_performance + 12_unit_economics + 18_alerts` | `strong` | `yes` |
| `slow_supplier_good_cost` | `detected_but_weak_evidence` | `18_alerts` | `weak` | `caution` |
| `high_sales_late_payment_agent` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` |
| `return_rate_above_policy` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` |
| `google_ads_mapping_gap` | `detected_with_evidence` | `20_mapping_report + 19_data_quality` | `strong` | `yes` |
| `inventory_movement_gap` | `detected_with_evidence` | `16_operation_capacity` | `strong` | `yes` |

