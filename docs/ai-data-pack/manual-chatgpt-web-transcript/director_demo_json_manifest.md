# Director Demo JSON Manifest

Phase: `PR-DEMO-1C`

Source: Prompt 32 redacted Director JSON artifact.

## Artifact

| Field | Value |
|---|---|
| Relative path | `tmp/ai-data-pack-prompt32-exports/AIDP-20260614045658-a295d333/director_data_pack.json` |
| Job id | `AIDP-20260614045658-a295d333` |
| Export mode | `partial_export` |
| Sync policy | `sync_if_stale` |
| Redaction profile | `director_redacted` |
| Artifact class | `downloadable_redacted_artifact` |
| Redaction runtime | `pre_rendered` |
| Artifact rendering | `rendered` |
| Download ready | `true` |
| Downloaded | `true` |
| Parseable JSON | `true` |
| File size bytes | `98124` |
| SHA256 file checksum | `C9DE0CF6AC7664C77642423C905AC9BBE22036E07B894709220A7560B902921F` |
| Data content checksum | `3e744a0ef5f2a5eb26d600db5f15c5ddb04861b720ce2228f5461d3633a091f2` |
| Runtime export checksum | `2d775c78d54a4e1c66425fffc9d97c07a6ddcc4188c56b5886431b0d466a2c6b` |

## Provenance

Prompt 32 confirmed the artifact came from the safe local Docker demo MongoDB:

`mongodb://127.0.0.1:27018/aidp_demo_20260614`

Prompt 33 reused the existing downloaded JSON artifact. It did not rerun seed, export, or database operations.

## Metadata Confirmation

Metadata in the JSON reports:

- `export_job_id=AIDP-20260614045658-a295d333`
- `export_mode=partial_export`
- `redaction_profile=director_redacted`
- `download_ready=true`
- `provider_sync_attempted=false`
- `live_execution=false`
- `can_import_action_file=false`
- `can_dry_run=false`
- `can_execute_live=false`

## Safety Exposure Check

The artifact was checked for these exposure patterns:

- storage path
- public URL
- download token
- raw provider payload
- access token
- refresh token
- client secret
- developer token
- Authorization/Bearer token

Result: no matches found.

## Sections

The Director JSON contains these top-level sections under `sections`:

- `00_README`
- `01_metadata`
- `02_chatgpt_web_reading_rules`
- `03_chatgpt_web_research_rules`
- `04_director_manual_inputs`
- `05_financial_context`
- `06_financing_context`
- `07_cashflow_scenarios`
- `08_business_summary`
- `09_marketing_profitability`
- `10_service_group_performance`
- `11_product_variant_performance`
- `12_unit_economics`
- `13_ltv_summary`
- `14_sales_funnel`
- `15_sales_team`
- `16_operation_capacity`
- `17_decision_history`
- `18_alerts`
- `19_data_quality`
- `20_mapping_report`
- `21_decision_options`
- `22_permission_risk_limits`
- `23_external_market_summary`
- `24_field_aliases`

## Expected Demo Findings Present In Artifact

| Expected key | Evidence label or pattern |
|---|---|
| `supplier_cost_up` | `supplier_cost_up_15_percent_without_matching_dealer_price_update` |
| `ad_spend_spike` | `ad_spend_spike_with_lower_lead_volume` |
| `cash_gap` | `cash_gap_next_7_days_from_agent_receivable_delay` |
| `overdue_dealer_receivables` | `overdue_dealer_receivables_for_high_revenue_agent` |
| `low_inventory_best_seller` | `best_selling_product_low_inventory` |
| `labor_overtime_high` | `labor_overtime_high_without_matching_revenue_growth` |
| `negative_margin_product_group` | `negative_margin_product_group` |
| `slow_supplier_good_cost` | `slow_reliability_supplier_with_good_cost` |
| `high_sales_late_payment_agent` | `high_sales_late_payment_agent` |
| `return_rate_above_policy` | `return_rate_above_policy_for_single_offer` |
| `google_ads_mapping_gap` | `ads_account_to_campaign` and mapping confidence warnings |
| `inventory_movement_gap` | `inventory_movement_without_matching_purchase_order` |

