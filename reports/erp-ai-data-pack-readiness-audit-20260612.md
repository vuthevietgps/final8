# Báo cáo audit mức độ sẵn sàng ERP AI Data Pack

Ngày audit: 2026-06-12  
Phạm vi: đọc code, schema, service, controller, job, report module và tài liệu AI Ads V2 trong working tree hiện tại.  
Repository được audit: `final8-version16`  
Mục tiêu: đánh giá khả năng xuất dữ liệu nội bộ để ChatGPT Web phân tích quản trị hằng ngày.

## 1. Phạm vi và giới hạn

- Audit này không truy vấn hoặc thay đổi dữ liệu production.
- Không tạo migration, không sửa database, API hoặc business logic.
- Không gọi Google Ads API.
- Không kiểm tra tính đầy đủ thực tế của từng collection trên production.
- Kết luận phản ánh working tree hiện tại. Nhiều file AI Ads V2 và module liên quan đang chưa commit, vì vậy chưa thể coi là trạng thái đã deploy.
- Tài liệu bắt đầu được đối chiếu từ `docs/ai-ads-v2/00_README_INDEX.md`. Tên file thực tế khác tên `00-index.md` trong hướng dẫn ban đầu.

## 2. Kết luận nhanh

| Hạng mục | Điểm | Kết luận |
|---|---:|---|
| Director Data Pack | 6/10 | Có phần lớn dữ liệu nguồn cần thiết nhưng chưa có export tổng hợp chuẩn AI |
| Marketer Data Pack | 5/10 | Google Ads Search khá đầy đủ; multi-channel và dữ liệu chi tiết còn thiếu |
| Ads → lead → order → profit | 5/10 | Nối tốt nhất ở mức `adGroupId`; lead/customer/campaign/keyword chưa nối bền vững |
| Google Ads Search V2 safety | 8/10 | Có validateOnly, approval, dry-run, policy, idempotency và execution log |
| Data Quality/Mapping Report | 3/10 | Có báo cáo giới hạn trong Google export; chưa có báo cáo toàn ERP |

### Điểm mạnh hiện tại

- Đơn hàng lưu sản phẩm, doanh thu/tiền thu, chi phí quảng cáo, chi phí nhân công, chi phí khác, gross profit và net profit.
- Finance có cashflow, available funds, committed cash, free cash, ads fund, survival buffer, runway và forecast 7 ngày.
- Google Ads V2 có sync account/campaign/budget/ad group/keyword/RSA và metrics đa cấp.
- Google Ads V2 có export ZIP, import action plan, provider `validateOnly`, approval, execution log và đánh giá sau hành động.
- Role/permission đã tách quyền đọc, lập kế hoạch, duyệt, thực thi và quản lý credential cho Google Ads.

### Thiếu lớn nhất

- Chưa có Director Data Pack và Marketer Data Pack toàn ERP dưới dạng XLSX nhiều sheet và JSON chuẩn schema.
- Order không lưu quan hệ bền vững về lead, customer, campaign, ad, keyword/criterion hoặc UTM.
- Chưa có Data Quality Report và Mapping Report toàn ERP với ngưỡng khóa quyết định.
- Chưa có search term, geo, device, hour và audience performance.
- Chưa đủ dữ liệu SLA/capacity để phân tích vận hành.

### Rủi ro dữ liệu lớn nhất

Google export hiện gán `attributionConfidence = 1` cho mọi order có `adGroupId`, dù chưa bắt buộc xác minh ad group thuộc đúng platform và Google customer. Điều này có thể làm ChatGPT kết luận attribution quá chắc chắn hoặc gán nhầm đơn giữa các nền tảng.

Vị trí: `backend/src/google-ads/google-ads-export.service.ts`, phần tạo `order_profit_attribution`.

## 3. Ma trận dữ liệu tổng hợp

| Nhóm dữ liệu | Field chuẩn đề xuất | Model/field ERP tương đương | Quan hệ hiện tại | Trạng thái | Ngày/3/7/30 ngày | Tin cậy | Ưu tiên |
|---|---|---|---|---|---|---|---|
| Ads platform/account | `platform`, `account_id` | `AdAccount.platform`, `accountId` | Account nối với ad group và Google resource | Đã có | Có thể query | High | P1 |
| Campaign | `campaign_id`, `campaign_name` | Google campaign schemas; `AdGroup.campaignId` | Google nối tốt; kênh khác một phần | Có một phần | Có thể query | Medium | P1 |
| Campaign budget | `campaign_budget_id` | Google campaign budget; `AdGroup.campaignBudgetId` | Google nối theo customer/resource | Đã có cho Google | Có thể query | High | P1 |
| Ad group/ad set | `ad_group_id`, `ad_set_id` | `AdGroup.adGroupId` | Nối ads cost, order và product một phần | Đã có | Có thể query | Medium | P0 |
| Ad/creative | `ad_id`, `creative_id` | Google ads; `CreativeAsset.creativeId`, `adId` | Chưa nối chắc về order | Có một phần | Có thể query | Medium-Low | P1 |
| Keyword | `keyword_id`, `criterion_id` | Google keyword schema | Có metrics nhưng chưa nối lead/order | Có một phần | Có thể query | Medium-Low | P1 |
| Search term | `search_term` | Không tìm thấy model/sync | Không nối | Chưa có | Không | Low | P1 |
| UTM/source tracking | `utm_source`, `utm_campaign`, `utm_term` | Không tìm thấy tracking chuẩn | Không nối | Chưa có | Không | Low | P0 |
| Landing page | `landing_page_id`, `landing_url` | Creative asset landing page; URL dẫn xuất | Không có collection/module chuẩn đáng tin cậy | Có một phần | Có thể query giới hạn | Low | P1 |
| Lead | `lead_id` | `MarketingLead._id` | Có source/campaign/ad/ad group/sale/order nhưng nhiều lead được suy diễn | Có một phần | Có thể query | Medium-Low | P0 |
| Sale | `sale_id` | `MarketingLead.assignedSaleId`; order `agentId` | Ý nghĩa sale và agent chưa thống nhất | Có một phần | Có thể query giới hạn | Low | P0 |
| Customer | `customer_id` | `Customer._id` | Customer sinh từ tên + số điện thoại; order không lưu `customerId` | Có một phần | Query gần đúng | Low | P0 |
| Order | `order_id` | `TestOrder2._id` | Nối chắc với product và profit | Đã có | Có thể query | High | P0 relation |
| Service/product | `service_id`, `service_name` | `Product._id`, `name` | Order nối chắc; ad group nối tùy chọn; lead không nối | Có một phần | Có thể query | Medium | P0 |
| Revenue | `revenue` | COD/deposit/manual payment và report logic | Nối order | Đã có | Có thể query | Medium-High | P0 |
| Gross profit | `gross_profit` | `grossProfit`, `realizedGrossProfit` | Nối order/product | Đã có | Có thể query | High | P0 |
| Net profit | `net_profit` | `netProfit`, `realizedNetProfit` | Nối order/product; đơn mới có thể là ước tính | Đã có | Có thể query | Medium-High | P0 |
| Cashflow | `cash_in`, `cash_out`, `free_cash` | Finance/funds/financial-control | Có query và snapshot | Đã có | Có thể query/forecast | Medium-High | P0 canonical source |
| Operations | SLA, deadline, capacity | Order/production status | Thiếu deadline/capacity/status history | Có một phần | Query giới hạn | Low | P1 |
| Decision/audit | decision/action/result IDs | Google action plan, execution logs, evaluations | Google V2 nối tốt | Có một phần | Có thể query | High Google | P1 |
| Alerts | alert/evidence/records | Ads alerts, finance alerts | Chưa thống nhất schema toàn ERP | Có một phần | Có thể query | Medium-Low | P1 |
| Data quality | mapping/freshness rates | Google export quality; AI Operator quality | Chưa có toàn ERP | Có một phần | Chưa đủ | Low | P0 |

## 4. Sơ đồ mapping hiện tại

```text
Google Ads account
    → campaign
    → campaign budget
    → ad group
    → keyword / RSA
    → daily metrics
    [ĐÃ NỐI TỐT TRONG GOOGLE ADS V2]

Legacy multi-channel account
    → ad group
    → daily advertising cost
    [ĐÃ NỐI, CHỦ YẾU Ở MỨC AD GROUP]

Ad group
    → selected product
    [NỐI MỘT PHẦN, PRODUCT KHÔNG BẮT BUỘC]

Ad group
    → chat/conversation
    → pending order
    → final order
    [CÓ LUỒNG, NHƯNG FINAL ORDER KHÔNG GIỮ ĐẦY ĐỦ QUAN HỆ TRUNG GIAN]

Ad group
    → MarketingLead suy diễn
    → order
    [NỐI MỘT PHẦN, KHÔNG PHẢI MỌI LEAD ĐỀU LÀ LEAD NGUỒN THỰC]

Order
    → product
    → revenue
    → gross profit
    → net profit
    [ĐÃ NỐI TỐT]

Customer
    → nhiều orders
    [NỐI GẦN ĐÚNG BẰNG TÊN + SỐ ĐIỆN THOẠI, THIẾU KHÓA NGOẠI]

Keyword/search term/UTM/landing page
    → lead
    → order
    [ĐỨT]
```

### Các đoạn nối chắc chắn

- Google customer → campaign → budget → ad group → keyword/RSA → provider metrics.
- Order → product.
- Order → gross profit/net profit.
- Ad group → daily advertising cost.
- Order có `adGroupId` → phân bổ advertising cost theo ngày.

### Các đoạn nối một phần

- Ad group → product qua `selectedProducts`.
- Ad group → conversation/pending order/order.
- Ad group → marketing lead → order.
- Lead → assigned sale.
- Customer → latest order/product.
- Creative → campaign/ad/ad group/landing page.

### Các đoạn chưa nối

- Search term → lead/order/profit.
- UTM → lead/order/profit.
- Keyword/criterion → lead/order/profit.
- Durable order → lead/customer/campaign/ad relation.
- Customer → source/campaign → LTV.
- Product/service → operation capacity.

## 5. Metadata của Data Pack

| Metadata | Hiện trạng | Nguồn/cách sinh đề xuất |
|---|---|---|
| `data_pack_id` | Có tương đương trong Google export | Dùng UUID/export ID từ export service |
| `schema_version` | Google export có `2.0` | Bắt buộc cho mọi Data Pack |
| `report_date` | Có date range | Sinh từ query |
| `exported_at` | Có generated time | Sinh tự động |
| `timezone` | Google/finance chủ yếu `Asia/Ho_Chi_Minh` | Đưa vào system settings chuẩn |
| `currency` | Google dùng `VND` | Đưa vào system settings chuẩn |
| `company_id` | Chưa tìm thấy nguồn chuẩn | Cần cấu hình hệ thống |
| `company_name` | Chưa tìm thấy nguồn chuẩn | Cần cấu hình hệ thống |
| `generated_by` | Chưa đầy đủ | Lấy current authenticated user |
| `data_sources` | Chỉ implicit theo file/row count | Export service tự liệt kê |
| `data_freshness` | Có rải rác | Tổng hợp từ `lastSyncAt`, timestamps và snapshots |
| Ads last sync | Có | Ad account/resources/sync runs |
| CRM/sale last sync | Không có sync-run chuẩn | Có thể dùng max timestamp, nhưng nên có sync run |
| Order/accounting last sync | Không có metadata chuẩn | Có thể dùng max timestamp/snapshot |

## 6. Tài chính và dòng tiền

### Dữ liệu đã có hoặc tính được

- Tiền hiện có/bank balance.
- Committed cash và free cash.
- Ads fund, survival buffer và owner fund.
- Realized/pending revenue và net profit.
- Khoản vay, lịch trả nợ và khoản đến hạn.
- Phải thu/phải trả theo các module supplier/agent.
- Monthly burn, runway và forecast 7 ngày.
- Cashflow entries và available fund snapshots.

### Điểm cần lưu ý

- Cần chỉ định rõ các service finance chính thức dùng cho Data Pack.
- Không dùng dữ liệu mock/random từ các service cũ trong `cashflow-control`, đặc biệt logic sinh order mock.
- Forecast 30 ngày và expected inflow/outflow cần chuẩn hóa công thức và mức độ tin cậy.
- Một số cấu phần finance trả về ước tính hoặc fallback 0 khi module nguồn không khả dụng; Data Pack phải xuất kèm quality flags.

## 7. Tổng quan kinh doanh và lợi nhuận

### Có thể xuất V1

- Doanh thu, số đơn và AOV theo ngày/range.
- Gross profit, net profit và profit margin.
- Estimated profit và realized profit.
- Hiệu quả theo sản phẩm.
- Advertising cost, labor cost và other cost đã phân bổ.
- So sánh 7 ngày/30 ngày có thể tính bằng query/export service mới.

### Hạn chế

- Chưa có report chuẩn cho so sánh kỳ trước và trạng thái trend/anomaly.
- Net profit của order mới dùng estimated ads cost; labor/other cost được batch ghi sau.
- Chi phí quảng cáo orphan có thể được phân bổ cho order không có ad group, làm giảm độ tin cậy attribution.
- Tỷ lệ hoàn/hủy và chi phí lỗi/khiếu nại chưa được chuẩn hóa đầy đủ cho unit economics.

## 8. Hiệu quả theo sản phẩm/dịch vụ và Unit Economics

Order nối trực tiếp với `productId`, nên có thể tính:

- Doanh thu/số đơn theo sản phẩm.
- Ads cost/order.
- Gross profit/net profit.
- Average order value.
- Average profit/order.
- Profit margin.

Chưa thể tính đáng tin cậy:

- Lead theo dịch vụ và tỷ lệ chốt theo dịch vụ, vì lead không lưu product/service interest.
- Campaign → service nếu ad group chưa map product.
- Công suất xử lý còn lại và rủi ro vận hành theo dịch vụ.
- Chi phí lỗi/hủy/khiếu nại đầy đủ.

V1 có thể dùng unit economics ước tính nhưng phải phân biệt:

- `estimated_net_profit`
- `realized_net_profit`
- `cost_allocation_status`
- `attribution_confidence`

## 9. LTV và Customer Mapping

ERP có collection customer, nhưng customer được đồng bộ từ orders bằng khóa gần đúng `customerName + phoneNumber`. Customer chỉ lưu latest order/product; final order không lưu `customerId`.

Do đó:

- Có thể tính repeat purchase/LTV gần đúng bằng query PII.
- Không nên kết luận mạnh về LTV theo source/campaign.
- Không có referral tracking chuẩn.
- Không nối bền vững customer → lead → source → nhiều orders.

P0 nên bổ sung durable customer relation hoặc mapping table trước khi dùng LTV để quyết định ngân sách.

## 10. Funnel Lead → Sale → Order → Money

`MarketingLead` hiện có:

- Source platform.
- Campaign/ad set/ad/ad group/creative IDs.
- Assigned sale.
- Lead created time.
- First response time và response SLA seconds.
- Status, lost reason.
- Order ID, revenue, gross profit và net profit.

Hạn chế:

- Nhiều lead được suy diễn từ chat, pending order hoặc final order.
- Thiếu product/service interest.
- Thiếu assignment timestamp.
- Thiếu call/activity/note log chuẩn.
- Thiếu status history và timestamp từng bước.
- Bộ trạng thái chưa bao phủ đầy đủ `assigned`, `unreachable`, `waiting_document`, `deposit_paid`, `completed`.
- Lost reason chưa được chuẩn hóa theo bộ enum quản trị.

Mapping trạng thái V1 đề xuất:

| Trạng thái hiện tại | Trạng thái chuẩn |
|---|---|
| `new` | `new` |
| có `assignedSaleId` nhưng chưa contacted | `assigned` |
| `contacted` | `contacted` |
| `no_response` | `unreachable` |
| `qualified` | `qualified` |
| `not_qualified` | `unqualified` |
| `quoted` | `quoted` |
| pending/deposit evidence | `deposit_paid` hoặc `waiting_document` tùy evidence |
| `won` | `won` |
| `lost` | `lost` |
| order completed/final | `completed` |

## 11. Năng lực vận hành

ERP có order status và production status, nhưng chưa có:

- Deadline/SLA chuẩn trên mỗi order/hồ sơ.
- Status history đầy đủ.
- Capacity theo nhân sự/bộ phận.
- Công suất tối đa/tuần.
- Nhân sự nghỉ/vắng.
- Bottleneck và overload theo dịch vụ.

V1 chỉ nên xuất:

- Số order theo trạng thái.
- Order mới/hoàn thành theo thời gian.
- Order chưa hoàn thành và tuổi order.

Không nên kết luận công suất còn lại nếu chưa có capacity baseline.

## 12. Marketer Data Pack readiness

| Sheet/section | Trạng thái |
|---|---|
| `campaigns` | Có cho Google; kênh khác một phần |
| `ad_groups` / `ad_sets` | Có |
| `keywords` | Có cho Google |
| `search_terms` | Chưa có |
| `ads_creatives` | Có một phần |
| `landing_pages` | Có một phần/dẫn xuất |
| `geo_performance` | Chưa có |
| `device_performance` | Chưa có |
| `hour_performance` | Chưa có |
| `audience_performance` | Chưa có |
| `leads_by_source` | Có một phần |
| `conversion_quality` | Có thể tính một phần |
| `alerts` | Có nhiều module nhưng chưa thống nhất |
| `data_quality` | Chưa đủ |
| `allowed_actions` | Google V2 có thể xuất từ policy |

Google readonly sync hiện đồng bộ:

- Account.
- Campaign.
- Campaign budget.
- Ad group.
- Keyword.
- Responsive Search Ad.
- Daily metrics cấp campaign/ad group/keyword/ad.

Chưa đồng bộ search terms, geo, device, hour hoặc audience.

## 13. Data Quality Report và Mapping Report

Google export đã có quality report giới hạn, nhưng chưa đủ cho quản trị toàn ERP. Các mảng `missingFiles`, `missingColumns`, `duplicateKeys` hiện được tạo rỗng thay vì tính từ dữ liệu.

Data Quality Report V1 cần tối thiểu:

- `lead_source_mapping_rate`
- `lead_campaign_mapping_rate`
- `order_lead_mapping_rate`
- `order_service_mapping_rate`
- `order_customer_mapping_rate`
- `order_profit_completion_rate`
- `campaign_service_mapping_rate`
- `ads_sync_success_rate`
- `ads_data_freshness_hours`
- Duplicate provider IDs theo platform/account
- Missing critical fields theo domain
- Estimated-vs-realized profit rate

Ngưỡng đề xuất:

| Chỉ số | Ngưỡng cảnh báo/khóa |
|---|---|
| `lead_source_mapping_rate` | Cảnh báo nếu `< 90%` |
| `order_profit_completion_rate` | Không kết luận profit mạnh nếu `< 80%` |
| `campaign_service_mapping_rate` | Không scale tự động nếu `< 80%` |
| `order_service_mapping_rate` | Cảnh báo nếu `< 90%` |
| `order_customer_mapping_rate` | Không dùng LTV mạnh nếu `< 90%` |
| `ads_data_freshness_hours` | Cảnh báo nếu quá lịch sync kỳ vọng |
| `attribution_confidence` | Chỉ high khi platform/account/resource mapping đều khớp |

## 14. Decision history, alerts và quyền hành động

### Google Ads V2

Đã có:

- Action plan và typed payload.
- Provider validation status.
- Approval history.
- Execution confirmation.
- Idempotency key.
- Execution log.
- Before/after state.
- Provider request/error.
- Post-execution sync.
- Evaluation sau 3/7 ngày.

### Alerts

ERP có ads alerts và finance alerts, nhưng chưa có unified alert schema gồm đầy đủ:

- `alert_type`
- `severity`
- `affected_area`
- `evidence`
- `suggested_investigation`
- `related_records`

### RBAC và safety

Google Ads V2 đã tách:

- `google-ads.read`
- `google-ads.plan`
- `google-ads.approve`
- `google-ads.execute`
- credential read/write
- emergency pause

Live execution bị chặn nếu:

- `GOOGLE_ADS_PRODUCTION_ENABLED` không bật.
- Provider execution không bật.
- Hệ thống vẫn ở dry-run.
- Action chưa approved.
- Provider `validateOnly` chưa pass.
- Action thiếu execution confirmation.
- Policy/customer/budget/landing page không hợp lệ.

Create Search campaign và các tài nguyên mới bắt đầu ở trạng thái `PAUSED`.

## 15. Rủi ro bảo mật và secret handling

### P0

1. Non-Google API token vẫn có thể được lưu cả plaintext `token` và `tokenEnc`.
2. Schema token vẫn hỗ trợ field plaintext và runtime fallback về plaintext.
3. Google Sheets credential endpoint ghi service-account JSON plaintext vào `google-sheets-credentials.json`.
4. Endpoint lưu Google Sheets credential chỉ yêu cầu permission `orders`, chưa phải quyền credential riêng.
5. Working tree có các file tên giống credential/service account và generated exports. Không mở nội dung trong audit; cần kiểm tra, rotate nếu cần và bảo vệ bằng `.gitignore`/secret manager.

Riêng Google Ads credential hiện đã được mã hóa và có response/log redaction tốt hơn các module cũ.

## 16. Dữ liệu thiếu cần bổ sung

### P0: bắt buộc cho Data Pack V1 đáng tin cậy

- Canonical Data Pack export service cho Director/Marketer/Data Quality/Mapping.
- Durable mapping order → lead/customer/source/campaign/ad/criterion.
- Khóa provider theo `platform + customerId/accountId + resourceId`.
- UTM/source/landing/form/inbox tracking chuẩn.
- Mapping campaign/ad group → product/service.
- Broad Data Quality Report và Mapping Report với thresholds.
- Sửa attribution confidence trong Google export.
- Chỉ định nguồn finance canonical và loại dữ liệu mock.
- Metadata company/timezone/currency/freshness chuẩn.
- Loại bỏ plaintext secret storage.

### P1: cần để phân tích tốt hơn

- Search term sync.
- Geo/device/hour/audience performance.
- Multi-channel campaign/ad/adset metadata đầy đủ.
- Lead assignment/status/activity/call history.
- Lost reason chuẩn.
- Operations deadline/SLA/capacity.
- Unified alert schema.
- Report trend/anomaly và kỳ so sánh.

### P2: nâng cấp chiến lược dài hạn

- LTV durable theo source/campaign/dịch vụ đầu tiên.
- Referral và cross-service tracking.
- Cost allocation chi tiết cho complaint/refund/error.
- Materialized daily AI Data Pack.
- Learning history toàn ERP sau quyết định.
- Automated anomaly models sau khi chất lượng dữ liệu đủ cao.

## 17. Lộ trình triển khai đề xuất

### V1: xuất hiện trạng read-only

- Tạo Director/Marketer/Data Quality/Mapping JSON và XLSX.
- Dùng nguồn canonical hiện có.
- Xuất quality flags và mapping confidence.
- Không kết luận nhân quả mạnh khi relation thiếu.
- Không thay đổi live ads execution.

### V2: đủ dữ liệu đề xuất hành động

- Bổ sung tracking/mapping bền vững.
- Chuẩn hóa lead funnel và sale performance.
- Sync search terms/geo/device/hour/audience.
- Thêm multi-channel detailed metrics.
- Xây classification/recommendation dựa trên quality gates.

### V3: validate/dry-run/action plan

- Typed recommendation.
- Business validation.
- Provider `validateOnly`.
- Dry-run.
- Approval và execution confirmation.

Google Ads Search V2 hiện đã gần đạt V3.

### V4: controlled execution

- ERP là hệ thống duy nhất gọi provider API.
- Chỉ execute khi validateOnly pass, approved, production enabled và policy pass.
- Re-sync remote state và đánh giá sau hành động.
- Tiếp tục loại trừ PMax, Shopping, Display, YouTube, delete actions và auto-publish khỏi MVP.

## 18. Cấu trúc module/code đề xuất

```text
backend/src/ai-data-pack/
  ai-data-pack.module.ts
  ai-data-pack.controller.ts
  director-data-pack.service.ts
  marketer-data-pack.service.ts
  data-quality-report.service.ts
  mapping-report.service.ts
  decision-history-export.service.ts
  export/
    json-exporter.service.ts
    xlsx-exporter.service.ts
  contracts/
    metadata.contract.ts
    director-data-pack.contract.ts
    marketer-data-pack.contract.ts
    data-quality.contract.ts
    mapping-report.contract.ts
  queries/
    finance-data.query.ts
    order-profit.query.ts
    customer-ltv.query.ts
    lead-funnel.query.ts
    ads-performance.query.ts
    operations-capacity.query.ts
  aliases/
    erp-field-alias.registry.ts
```

Endpoint đề xuất:

```text
GET /api/ai/director/data-pack?date=YYYY-MM-DD&format=json|xlsx
GET /api/ai/marketer/data-pack?date=YYYY-MM-DD&format=json|xlsx
GET /api/ai/data-quality/report?date=YYYY-MM-DD&format=json|xlsx
GET /api/ai/mapping/report?date=YYYY-MM-DD&format=json|xlsx
GET /api/ai/decision-history?from=YYYY-MM-DD&to=YYYY-MM-DD
```

### Chiến lược query

- Query adapter riêng cho từng domain.
- Alias layer map field ERP hiện tại sang schema chuẩn.
- Export service chỉ tổng hợp, không chứa business calculation phức tạp.
- V1 query trực tiếp; chỉ tạo materialized snapshots khi đo được vấn đề hiệu năng.
- Mọi sheet/section phải xuất `data_quality`, `source`, `freshness` và `confidence`.

### Test cần có

- Contract test JSON schema.
- Multi-sheet XLSX structure test.
- Mapping rate calculation tests.
- Duplicate/missing field detection tests.
- PII/secret redaction tests.
- Attribution confidence tests.
- Finance canonical source tests.
- Role/permission tests.
- Export deterministic/checksum tests.

## 19. Các module và file chính đã đối chiếu

- `docs/ai-ads-v2/*`
- `backend/src/google-ads/*`
- `backend/src/ai-marketing/*`
- `backend/src/ai-operator/*`
- `backend/src/test-order2/*`
- `backend/src/customer/*`
- `backend/src/product/*`
- `backend/src/ad-account/*`
- `backend/src/ad-group/*`
- `backend/src/advertising-cost/*`
- `backend/src/finance/*`
- `backend/src/cashflow-control/*`
- `backend/src/ads-alerts/*`
- `backend/src/api-token/*`
- `backend/src/order-sheet-sync/*`
- `backend/src/auth/role-permissions.ts`

## 20. Kết quả xác minh

Lệnh test đã chạy:

```text
npm test -- --runInBand google-ads common/ads-safety-config api-token/crypto.util api-token/api-token.service ad-group/ad-group.auto-control.service
```

Kết quả:

```text
Test Suites: 17 passed, 17 total
Tests:       87 passed, 87 total
Snapshots:   0 total
```

Các test bao phủ export, readonly sync, action-plan import/approval, provider validation, execution policy, live-execution gates, post-execution, secret redaction và auto-control disabled.

Không chạy build/lint vì các lệnh hiện tại có thể tạo hoặc sửa artifact trong working tree đang có nhiều thay đổi, trái với yêu cầu audit không sửa code/file ngoài báo cáo.

## 21. Kết luận cuối

ERP đã có nền tảng dữ liệu đủ để triển khai Director Data Pack V1 và Marketer Data Pack Google-focused V1 mà không cần xây lại các domain nghiệp vụ chính. Tuy nhiên, chưa nên dùng dữ liệu hiện tại để đưa ra kết luận mạnh về attribution, LTV theo campaign hoặc tự động scale ads.

Ưu tiên đúng cho giai đoạn tiếp theo là xây export layer read-only, Data Quality Report và Mapping Report trước; đồng thời sửa các quan hệ attribution/customer/lead và secret handling P0. Google Ads Search V2 đã có safety foundation tốt, nhưng chỉ nên bật live sau khi working tree được review, commit, deploy có kiểm soát và các rủi ro P0 được xử lý.
