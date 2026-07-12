# AI Data Pack Sample Export Verification - 2026-06-12 V2

Verification date: 2026-06-13

## Environment

- Backend: rebuilt local NestJS backend at `http://127.0.0.1:3000`.
- Database: local MongoDB `htxbachgia` at `127.0.0.1:27017`.
- Authentication: repository test Director account used transiently; no credential or JWT was saved.
- Report date: `2026-06-12`.
- Scope: read-only AI Data Pack endpoints only.

## Endpoint Results

All required endpoints returned HTTP 200:

| Endpoint | File | Bytes |
|---|---|---:|
| Director JSON | `director-data-pack-20260612.json` | 83194 |
| Director XLSX | `director-data-pack-20260612.xlsx` | 70046 |
| Marketer JSON | `marketer-data-pack-20260612.json` | 40466 |
| Marketer XLSX | `marketer-data-pack-20260612.xlsx` | 37116 |
| Data Quality JSON | `data-quality-report-20260612.json` | 6494 |
| Mapping JSON | `mapping-report-20260612.json` | 11257 |
| Decision History JSON | `decision-history-20260612.json` | 1308 |

## P0 Acceptance Evidence

### Empty XLSX quality

- Director XLSX contains 25 sheets; 9 are empty.
- Marketer XLSX contains 14 sheets; 7 are empty.
- All 16 empty sheets retain `data_quality_status`, `confidence`, `warning`, `missing_fields`, `can_use_for_decision`, source/freshness/calculation metadata, `data_state`, `value_state`, and `empty_reason`.
- No empty sheet is reduced to only `status=empty`.

### Actor metadata and redaction

- Recursive scan across all v2 JSON found no legacy `generated_by`, ObjectId `buffer`, non-string actor field, unsafe actor display, unredacted secret key, or unredacted PII key.
- Finding count: `0`.

### Deterministic content checksum

- A second Director JSON endpoint call produced the same `data_content_checksum`:
  `6bbc0d2abeb134dbdf8c6d0a1eb383b0747a0717ce9e2b72fdc265847bc01f82`.
- The two calls produced different `runtime_export_checksum` values, as expected.

### Finance quality

- `cash_balance_quality`: `ok`, `yes`, state `realized`.
- `debt_schedule_quality`: `weak`, `cautious`, with missing-schedule and overdue warnings.
- `loan_disbursement_quality`: `ok`, `yes`.
- `cashflow_forecast_quality`: `partial`, `cautious`, state `estimated`.
- `overall_financial_context_quality`: `partial`, `cautious`.

### Value states

- Director manual inputs: `not_configured`.
- Ads/Google empty sections: `not_synced`.
- Report-date order/lead sections: `no_records_for_report_date`.
- Decision options and external market sections: `schema_only`.
- Attribution quality: `weak_mapping`.
- Data Quality metrics distinguish `not_synced`, `weak_mapping`, and `no_records_for_report_date`.
- Unit tests separately prove `zero_value`, `missing`, `not_applicable`, `estimated`, and `realized`.

### Decision gates

- `can_generate_action_draft=true`
- `can_import_action_file=false`
- `can_dry_run=false`
- `can_execute_live=false`
- `can_recommend_ads_scale=false`
- `can_use_ltv_strongly=false`

## File Checksums

`checksums.json` contains SHA-256 and byte size for all seven endpoint artifacts. A second verification pass found no checksum mismatch.

## Difference From V1

- Empty XLSX sheets now preserve full quality metadata.
- Actor metadata uses normalized string/null fields and no ObjectId buffer.
- Content checksum is deterministic across repeated calls.
- Finance quality is split and overall finance is cautious when debt quality is weak.
- Empty/zero/mapping/estimated/realized states are explicit.

## Remaining Limits

- The local sample has no report-date orders, leads, Google Ads daily metrics, or sync runs, so strong ads/profit/LTV conclusions remain blocked.
- ChatGPT Web upload was not performed in this coding task.
- PR-2.2 requires reviewer approval before any later phase.

