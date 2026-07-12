# Xác minh sample export AI Data Pack - 2026-06-12

## Môi trường nghiệm thu

- Backend: `http://localhost:3000`
- Database: local MongoDB `htxbachgia` trên `127.0.0.1:27017`
- Xác thực: đăng nhập thành công bằng user có role `director`; không lưu JWT/credential vào artifact.
- `.env` hiện trỏ tới `127.0.0.1:27019` không hoạt động, nên phiên nghiệm thu dùng biến môi trường tạm thời và không sửa `.env`.
- Ngày báo cáo: `2026-06-12`

## Endpoint và file

| Endpoint | HTTP | File |
|---|---:|---|
| Director JSON | 200 | `director-data-pack-20260612.json` |
| Director XLSX | 200 | `director-data-pack-20260612.xlsx` |
| Marketer JSON | 200 | `marketer-data-pack-20260612.json` |
| Marketer XLSX | 200 | `marketer-data-pack-20260612.xlsx` |
| Data Quality JSON | 200 | `data-quality-report-20260612.json` |
| Mapping JSON | 200 | `mapping-report-20260612.json` |
| Decision History JSON | 200 | `decision-history-20260612.json` |

`checksums.json` có SHA-256 cho đủ 7 file và đã kiểm tra lại không có mismatch.

## Director Data Pack

XLSX đọc được bằng SheetJS và có đúng 25 sheet từ `00_README` đến `24_field_aliases`.

| Sheet | Dữ liệu ngày hiện có | Quality | Confidence | Dùng quyết định | Ghi chú |
|---|---|---|---|---|---|
| 00_README | Có, static contract | ok | high | yes | 7 dòng |
| 01_metadata | Có | ok | high | yes | Thiếu company canonical |
| 02_chatgpt_web_reading_rules | Có | ok | high | yes | 12 rule |
| 03_chatgpt_web_research_rules | Có | ok | high | yes | 6 rule |
| 04_director_manual_inputs | Rỗng | missing | low | no | Không có allowlisted input |
| 05_financial_context | Có dữ liệu canonical hiện tại | ok | medium | yes | Thiếu complete debt schedule 30/90 ngày |
| 06_financing_context | Có, 21 khoản vay | ok | medium | yes | Có warning debt schedule |
| 07_cashflow_scenarios | Có, 1 scenario | ok | medium | yes | Forecast chứa timestamp động |
| 08_business_summary | Chỉ summary số 0 cho ngày không có order | missing | low | no | Thiếu customer/lead/cost completion |
| 09_marketing_profitability | Rỗng | missing | low | no | Thiếu Google metrics ngày báo cáo |
| 10_service_group_performance | Rỗng | missing | low | no | Không có order ngày báo cáo |
| 11_product_variant_performance | Rỗng | missing | low | no | Không có order ngày báo cáo |
| 12_unit_economics | Rỗng | missing | low | no | Không có order ngày báo cáo |
| 13_ltv_summary | Chỉ record count, LTV unavailable | weak | low | no | Thiếu durable customer-order relation |
| 14_sales_funnel | Rỗng | missing | low | no | Không có lead ngày báo cáo |
| 15_sales_team | Rỗng | missing | low | no | Không có lead ngày báo cáo |
| 16_operation_capacity | Có 3 status count | weak | low | no | Không đủ kết luận capacity |
| 17_decision_history | Không có decision/evaluation ngày báo cáo | missing | low | no | Thiếu unified history |
| 18_alerts | Có 6 cảnh báo finance | ok | medium | yes | Có overdue và missing schedule |
| 19_data_quality | Có report tính toán | weak | low | cautious | Hầu hết metric missing |
| 20_mapping_report | Có report tính toán | weak | low | no | Overall attribution confidence = 0 |
| 21_decision_options | Rỗng | missing | low | no | Schema-only |
| 22_permission_risk_limits | Có, static contract | ok | high | yes | Live/action import/dry-run đều false |
| 23_external_market_summary | Rỗng | missing | low | no | Schema-only |
| 24_field_aliases | Có | ok | high | yes | 5 alias/rule |

Lỗi XLSX: với section có `data=[]`, XLSX chỉ xuất một dòng `status=empty` và không giữ warning, confidence, missing fields hoặc `can_use_for_decision`. JSON vẫn giữ đủ quality metadata.

## Marketer Data Pack

- XLSX đọc được và có đủ 14 sheet theo contract.
- `04_accounts` đến `10_leads_by_source` đều không có dữ liệu cho ngày báo cáo.
- Không có Google campaign, ad group, keyword, creative, daily metric hoặc sync run trong DB nghiệm thu.
- Thiếu search term, geo, device, hour và audience performance.
- `monitor_only=true`.
- `live_execution=false`.

## Dữ liệu ngày báo cáo

- Collection `ordertest2`: 30 record tổng, 0 record ngày `2026-06-12`; ngày order mới nhất là `2026-04-19`.
- `advertisingcosts`: 0 record.
- `marketing_leads`: 0 record.
- `google_ads_sync_runs`: 0 record.
- `google_ads_daily_metrics`: 0 record.

## Data Quality thực tế

| Metric | Giá trị | Status |
|---|---:|---|
| lead_source_mapping_rate | null | missing |
| lead_campaign_mapping_rate | null | missing |
| order_lead_mapping_rate | null | missing |
| order_service_mapping_rate | null | missing |
| order_customer_mapping_rate | null | missing |
| order_profit_completion_rate | null | missing |
| campaign_service_mapping_rate | null | missing |
| ads_sync_success_rate | null | missing |
| ads_data_freshness_hours | null | missing |
| attribution_confidence | 0 | blocked |
| estimated_vs_realized_profit_rate | null | missing |

Decision gate:

- `can_import_action_file=false`
- `can_dry_run=false`
- `can_execute_live=false`
- `can_recommend_ads_scale=false`
- `can_conclude_profit=false`
- `can_use_ltv_strongly=false`

## Mapping thực tế

- Tốt: `product_variant_to_service_group = 100%`, confidence high.
- Missing/không có denominator ngày báo cáo: toàn bộ các đoạn còn lại từ ads platform đến net profit.
- Overall attribution confidence: `0`.
- Không có đoạn partial/medium trong sample ngày này.

Các đoạn P0 đang thiếu gồm account/campaign, UTM/landing/lead, lead/customer/order, order/product variant, ad group/service group và profit chain.

## Finance

- `cash_available = bank_balance = 987342003`, lấy từ `FinancialControlService`.
- `free_cash = 986999658`.
- `committed_cash = 342345`.
- Approved-not-disbursed loan: 1; expected inflow: `180000`.
- Disbursed: 9; repaid: 11; không có proposed loan trong sample để kiểm chứng thực nghiệm.
- Debt service 30/90 ngày: `230000`; có quality flag cho missing schedule và overdue.
- Static/source scan xác nhận export không gọi `computeAvailableFunds()`, `getCollectedRevenueToday()`, `getLoanRoomAvailable()`, mock hoặc random source.

## Security và redaction

Quét recursive toàn bộ JSON và XLSX:

- Không phát hiện API key, password, credential, access/refresh token hoặc private key chưa redact.
- Không phát hiện email hoặc số điện thoại đầy đủ trong file xuất.
- Finding count: `0`.

## Deterministic/checksum

- SHA-256 trong `checksums.json` khớp đủ 7 file.
- Metadata checksum của Director Pack **không ổn định** giữa hai lần gọi cùng ngày.
- Nguyên nhân quan sát được: finance/forecast và freshness chứa timestamp động.

## Khả năng dùng với ChatGPT Web

- XLSX hợp lệ và đọc được bằng SheetJS; JSON hợp lệ.
- Có README, reading rules và research rules.
- Có thể upload để ChatGPT Web đọc cấu trúc và đưa ra phân tích thận trọng.
- Tài liệu OpenAI xác nhận ChatGPT hỗ trợ `.xlsx` và `.json` cho data analysis; khả năng cụ thể phụ thuộc model, plan và workspace settings.
- Chưa thực hiện upload thật lên ChatGPT Web trong phiên nghiệm thu này.
- Chưa đủ dữ liệu để ChatGPT Web kết luận mạnh về ads, profit, LTV, sale hoặc attribution.

Nguồn:

- https://help.openai.com/en/articles/8983675-what-types-of-files-are-supported
- https://help.openai.com/en/articles/8437071/data-analysis-with-chatgpt

## Kết luận nghiệm thu

Read-only endpoint và export format hoạt động. Sample đạt điều kiện dùng để kiểm tra khả năng đọc cấu trúc, nhưng chưa đạt điều kiện chuyển sang Giai đoạn 3 vì dữ liệu ads/lead/order theo ngày thiếu, XLSX sheet rỗng mất quality metadata, checksum chưa deterministic và `generated_by` serialize thành ObjectId buffer khó đọc.
