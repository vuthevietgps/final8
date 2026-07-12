# Báo cáo kiểm tra bổ sung ERP trước khi viết tài liệu kỹ thuật AI Data Pack

Ngày kiểm tra: 2026-06-12  
Phạm vi: đọc code/schema/service/controller/test và báo cáo audit trước đó; không sửa code, database, API hay business logic; không gọi API quảng cáo; không thêm credential thật.  
Báo cáo nền: `reports/erp-ai-data-pack-readiness-audit-20260612.md`.

## 1. Tóm tắt điều hành

| Câu hỏi | Kết luận |
|---|---|
| Có nên viết tài liệu kỹ thuật nâng cấp ngay chưa? | Có. Phải viết dưới dạng đặc tả có assumption, quality flag, mapping confidence và P0 blocker; chưa nên chuyển thẳng sang code. |
| Có cần kiểm tra thêm gì trước khi viết không? | Cần giám đốc xác nhận các giới hạn tiền, khoản vay, dịch vụ chủ lực, mục tiêu và ma trận duyệt. Không cần kiểm tra code thêm để bắt đầu tài liệu. |
| Có thể làm V1 read-only export chưa? | Có, nếu dùng alias/mapping V1, loại bỏ nguồn mock/demo, không dùng `computeAvailableFunds()` làm `cash_available`, và gắn cờ chất lượng rõ ràng. |
| Có an toàn để nhúng OpenAI API key chưa? | Chưa. Còn plaintext/fallback secret, permission quá rộng, thiếu credential audit và thiếu upload artifact/review workflow chung. |
| Có an toàn để code import action file chưa? | Chưa cho luồng chung. Google action ZIP đã có nền tảng tốt, nhưng chưa phải framework upload/normalize/action chung cho ChatGPT Web và mọi domain. |
| Có an toàn để code thực thi action file chưa? | Chưa. Chỉ Google Search V2 hiện có controlled execution tương đối đầy đủ; không được mở rộng live execution trước các giai đoạn 1-4. |

Kết luận trọng yếu:

- Hai lỗi ngữ nghĩa finance phải được chặn trong tài liệu P0: `getCollectedRevenueToday()` cộng `netProfit`, và `getLoanRoomAvailable()` có thể cộng khoản vay chưa giải ngân vào số tiền khả dụng.
- `FinancialControlService` cùng cashflow thực tế và khoản giải ngân thực tế là nền tảng tốt nhất cho finance context; các module có mock/random phải bị loại khỏi Data Pack chính thức.
- V1 có thể alias `ProductCategory` thành `service_group` và `Product` thành `product_variant`.
- Ads nên phân tích theo `service_group`. Báo giá, đơn hàng, doanh thu, chi phí, lợi nhuận nên tính theo `product_variant`.
- OpenAI/upload/action đa nền tảng chưa đạt mức an toàn để triển khai ngay.

## 2. Danh sách vấn đề cần làm rõ với giám đốc

| Câu hỏi | Vì sao cần hỏi | Ảnh hưởng đến Data Pack | Giả định V1 nếu chưa trả lời |
|---|---|---|---|
| Định nghĩa chính thức của `cash_available`, `expected_cash_inflow` và `free_cash` là gì? | Code hiện có các cách tính không đồng nhất | Quyết định scale ads và survival risk | Chỉ tính tiền đã ghi nhận/giải ngân thực tế; dòng tiền dự kiến tách riêng |
| Trạng thái khoản vay cần dùng: proposed/approved/disbursed/rejected/repaid được xác định thế nào? | Schema hiện chỉ có draft/active/closed và trạng thái giải ngân | `financing_context`, `cashflow_scenarios` | Dùng alias có cảnh báo; không suy đoán rejected |
| Khoản vay nào được phép dùng cho ads và giới hạn bao nhiêu? | Chưa có field rõ ràng | Khóa đề xuất tăng ads | Mặc định không dùng khoản vay cho ads |
| Quỹ dự phòng tối thiểu và số tháng sống còn mục tiêu là bao nhiêu? | Có ratio/survival config nhưng chưa có chính sách giám đốc thống nhất | `financial_context`, `permission_risk_limits` | Dùng config hiện tại và ghi nguồn/assumption |
| Ngân sách test và mức lỗ test tối đa là bao nhiêu? | Chưa có model chính thức | `decision_options`, action guardrail | Không đề xuất test live; chỉ tạo phương án |
| Giới hạn tăng ngân sách theo ngày và tổng kỳ là bao nhiêu? | Rule đang phân mảnh theo env/global/ad group | Khóa scale ads | Dùng mức chặt nhất trong các rule hiện có |
| Dịch vụ/campaign nào là chủ lực, không được tắt nếu chưa duyệt? | Chưa có protected list | Tránh đề xuất pause sai | Không tự đề xuất pause campaign chủ lực; yêu cầu duyệt thủ công |
| Dịch vụ/campaign nào được phép test nhỏ? | `testingPhase` chưa đủ biểu đạt chính sách | `decision_options`, action plan | Chỉ ghi candidate, không thực thi |
| Taxonomy chính thức của service group và product variant là gì? | ProductCategory có thể không đồng nghĩa hoàn toàn với nhóm dịch vụ | Hiệu quả ads và unit economics | Alias ProductCategory/Product và công bố mapping |
| Mục tiêu tháng/quý theo doanh thu, lợi nhuận, dòng tiền, lead và capacity là gì? | Chưa thấy goal model bền vững | `business_summary`, `alerts` | Không kết luận đạt/chưa đạt mục tiêu |
| Ai chịu trách nhiệm nhập ghi chú chiến lược hằng ngày và format nào? | Export đọc `business_daily_notes` nhưng chưa có model/API quản trị | Bối cảnh phân tích hằng ngày | Cho phép file/manual input V1 có người nhập và timestamp |
| Ma trận ai được tạo/duyệt/xác nhận/thực thi action là gì? | Các domain có guardrail khác nhau | `permission_risk_limits` | Mọi action chỉ là nháp/task; Google giữ rule hiện tại |
| ChatGPT Web được nghiên cứu nguồn web nào và yêu cầu trích nguồn ra sao? | Chưa có research policy cấu hình | `chatgpt_web_research_rules` | Chỉ dùng nguồn công khai đáng tin, ghi URL/ngày truy cập |
| Chính sách retention và PII cho file gửi ChatGPT Web/OpenAI là gì? | Chưa có upload artifact lifecycle chung | Bảo mật và tuân thủ | Loại secret/PII không cần thiết; không lưu vô thời hạn |

## 3. Danh sách vấn đề kỹ thuật cần làm rõ từ code

| Vấn đề | File/model/service liên quan | Hiện trạng | Rủi ro | Ưu tiên | Đề xuất xử lý |
|---|---|---|---|---|---|
| `collectedRevenue` thực tế lấy `netProfit` | `backend/src/finance/finance.service.ts` - `getCollectedRevenueToday` | Sai ngữ nghĩa | Phóng đại/nhầm tiền mặt | P0 | Cấm dùng cho canonical cash; đặc tả nguồn realized cash |
| `loanAvailable` cộng room/principal khoản vay chưa đóng | `FinanceService.computeAvailableFunds`, `getLoanRoomAvailable` | Không phân biệt giải ngân | Dùng nợ chưa giải ngân như tiền thật | P0 | Chỉ cộng disbursement/cashflow thực tế |
| Attribution confidence bằng 1 khi chỉ có `adGroupId` | `backend/src/google-ads/google-ads-export.service.ts` - `buildCsvDefinitions` | Quá tự tin | Kết luận sai ads-to-profit | P0 | Thiết kế confidence có xác minh platform/account/mapping/freshness |
| Google quality report để trống missing file/column/duplicate | `GoogleAdsExportService.buildDataQualityReport` | Partial | Không phát hiện lỗi cấu trúc | P0 | Đặc tả Data Quality Report toàn ERP |
| Order không có durable lead/customer/campaign/ad/keyword/UTM | `TestOrder2` schema | Partial | Funnel/LTV/attribution yếu | P0 | V1 proxy + confidence; V2 mapping/migration |
| Chưa có model Director manual inputs | `SystemSettings`, finance schemas | Generic/partial | Không có nguồn quyết định được quản trị | P0 | V1 file/config contract; V2 dedicated model/UI/audit |
| Loan status/fields chưa đủ contract yêu cầu | `LoanContract`, `LoanRepayment`, `FundingSource` | Partial | Kịch bản dòng tiền khó tin cậy | P0 | Alias V1; V2 status/usage/purpose/risk fields |
| Chưa có service group/variant rõ ràng | `ProductCategory`, `Product`, `AdGroup` | Alias được | Phân tích ads và unit economics lẫn cấp | P0 | Chốt mapping V1; cân nhắc migration V2 |
| OpenAI secret còn plaintext schema/runtime fallback | `OpenAIConfig`, `OpenAIConfigService.resolveApiKey` | Partial | Lộ credential | P0 | Migrate/rotate, bỏ plaintext/fallback |
| Permission OpenAI dùng một quyền chung cho Director và Manager | `openai-config.controller.ts`, `auth/role-permissions.ts` | Quá rộng | Quản lý key không tách biệt | P0 | Tách read/write/test/use và audit |
| Upload/parser phân mảnh, không có artifact lifecycle chung | app Multer, import user, advertising cost, Google ZIP | Partial | Không truy vết original/normalized/error/review | P0 | Đặc tả upload artifact và normalization job |
| Non-Google API token vẫn có plaintext/fallback | `ApiTokenService`, `ApiToken` | Partial | Lộ token | P0 | Migrate/rotate và xóa plaintext runtime |
| Google Sheets credential có luồng file plaintext | Google Sheets credential handling | Không đủ an toàn | Lộ service credential | P0 | Secret manager/secure storage, không ghi file thường |
| Finance có module mock/random | `finance/data-collection.service.ts`, `cashflow-control/services/profit.service.ts` | Có mock | Dữ liệu demo lọt Data Pack | P0 | Allowlist canonical sources, cờ provenance |
| Operation capacity chưa có mô hình đủ | order/operation modules | Thiếu | Đề xuất tăng lead khi quá tải | P1 | V1 ghi `unavailable`; V2 capacity/SLA model |
| Action guardrail không đồng đều giữa provider/domain | Google V2, AI Marketing legacy, OpsAction | Google mạnh; phần còn lại yếu hơn | Live apply ngoài kiểm soát | P0 | Chỉ Google Search scoped path; phần khác task/dry-run |

## 4. Director manual inputs

| Dữ liệu | Hiện trạng/evidence | Section V1 | Cách làm V1 | Migration V2 | Rủi ro nếu thiếu |
|---|---|---|---|---|---|
| Khoản vay giả định | `LoanContract.status=draft`, `FundingSource.status=draft` nhưng semantics chưa đủ | `cashflow_scenarios`, `director_manual_inputs` | Manual scenario, tuyệt đối không cộng cash | Có | Dùng tiền giả định như tiền thật |
| Vay đã duyệt chưa giải ngân | `active` + `disbursementStatus=pending` có thể làm alias | `financing_context` | Gắn `expected_cash_inflow`, confidence medium | Có | Scale ads trước khi có tiền |
| Vay đã giải ngân | Có `disbursedAmount`, `recordDisbursement` | `financing_context`, `financial_context` | Chỉ lấy giải ngân thực tế | Không bắt buộc | Sai cash available |
| Lãi suất | Có `interestRate` | `financing_context` | Export trực tiếp | Không bắt buộc | Thiếu debt cost |
| Kỳ hạn vay | Có start/end/repaymentCycle, chưa có term_months | `financing_context` | Tính dẫn xuất và ghi assumption | Có thể | Sai nghĩa vụ trả nợ |
| Lịch trả nợ | Có `LoanRepayment` | `financing_context`, `cashflow_scenarios` | Export kỳ chưa trả | Không bắt buộc | Bỏ sót committed cash |
| Chủ sở hữu góp thêm vốn | `FundingSource.type=equity`, owner-fund transaction một phần | `financing_context` | Manual/actual inflow tách biệt | Có thể | Nhầm vốn dự kiến với tiền thật |
| Khoản thu lớn dự kiến | Có thể ghi note/cashflow context nhưng chưa có commitment model | `cashflow_scenarios` | Manual input có ngày, xác suất, confidence | Có | Forecast quá lạc quan |
| Khoản chi bắt buộc sắp tới | Repayment/payables/reserved fields có một phần | `cashflow_scenarios` | Hợp nhất actual commitment, ghi missing module | Có thể | Free cash bị phóng đại |
| Quỹ dự phòng tối thiểu | Có allocation ratio/survival floor, chưa có manual amount chuẩn | `permission_risk_limits`, `financial_context` | Config/manual input | Có | Scale vượt khả năng sống còn |
| Quỹ ads còn lại | Có funds/budget allocation | `financial_context` | Export với provenance/freshness | Không bắt buộc | Quyết định ads thiếu giới hạn |
| Tiền có thể dùng để test | Có thể dẫn xuất từ free cash/ads fund nhưng chưa có field rõ | `decision_options` | Chỉ là estimate, cần duyệt | Có | Test vượt khả năng chịu đựng |
| Mức lỗ test tối đa | Không tìm thấy | `permission_risk_limits` | Manual input bắt buộc trước test | Có | Không có stop-loss |
| Giới hạn tăng ngân sách/ngày | Có global/env và `AdGroup.maxDailyScaleRate`, phân mảnh | `permission_risk_limits` | Lấy mức chặt nhất | Có thể | Scale quá mạnh |
| Dịch vụ/campaign được bảo vệ | Chưa có protected list; manual override chỉ partial | `permission_risk_limits` | Manual list V1 | Có | Pause tài sản chủ lực |
| Dịch vụ/campaign cho phép test nhỏ | `testingPhase`, budget bucket, target groups chỉ partial | `decision_options`, `permission_risk_limits` | Manual allowlist V1 | Có | Test sai phạm vi |
| Mục tiêu tháng/quý | Chưa thấy durable goal model | `director_manual_inputs`, `business_summary` | Manual input V1 | Có | Không đánh giá được tiến độ |
| Ghi chú chiến lược trong ngày | Google export đọc collection `business_daily_notes`, chưa thấy model/API | `director_manual_inputs`, `decision_history` | File/manual record có owner/time | Có | AI bỏ qua bối cảnh điều hành |

`SystemSettings` có thể làm kho cấu hình V1 vì hỗ trợ `key/value/description/updatedBy`, nhưng không nên được coi là mô hình lâu dài cho dữ liệu giám đốc có version, hiệu lực, lịch sử và phê duyệt.

## 5. Financing context và loan scenarios

### 5.1 Khả năng xuất contract khoản vay

| Field yêu cầu | Khả năng hiện tại | Nguồn/alias V1 | Gap |
|---|---|---|---|
| `loan_id`, `loan_name`, `amount`, `interest_rate` | Found | `LoanContract` | Không đáng kể |
| `status` chuẩn 5 trạng thái | Partial | draft→proposed; active+pending→approved; active+partial/fully→disbursed; closed→repaid/closed | Không biểu đạt rejected rõ ràng |
| `interest_type` | Missing | Manual input | Cần field V2 |
| `term_months` | Partial | Dẫn xuất start/end | Cần chuẩn hóa V2 |
| `disbursement_date` | Found | `disbursementDate` | Cần kiểm tra completeness |
| `repayment_schedule` | Found | `LoanRepayment` | Cần completeness flag |
| `monthly_payment_estimate` | Partial | Tổng kỳ trả theo tháng nếu schedule đủ | Không tin cậy nếu thiếu schedule |
| `debt_service_next_30_days`, `next_90_days` | Partial | `getDebtCashflowSummary(windowDays)` | Tên output vẫn `totalDebtDue14d`; forecast chi tiết chỉ 7 ngày |
| `purpose` | Partial | notes | Cần field V2 |
| `allowed_for_ads`, `max_ads_usage_amount` | Missing/partial | restriction/target group/manual input | Cần policy V2 |
| `confidence`, `risk_note` | Missing | Sinh từ quality rule và manual note | Cần contract |

### 5.2 Quy tắc bắt buộc cho tài liệu kỹ thuật

- `proposed` không được cộng vào `cash_available`.
- `approved` nhưng chưa giải ngân chỉ được đưa vào `expected_cash_inflow`.
- Chỉ tiền giải ngân thực tế/cashflow thực tế được cộng vào `cash_available`.
- Nghĩa vụ trả nợ chưa trả phải trừ khỏi forecast/committed cash.
- Mọi đề xuất tăng ads phải xét `free_cash`, `survival_buffer`, debt service 30/90 ngày và quality flag.
- Không dùng `FinanceService.computeAvailableFunds()` làm nguồn canonical trước khi sửa ngữ nghĩa.
- Forecast 30/90 ngày phải gắn `estimated`, `partial_obligations`, `freshness`, `missing_repayment_schedule`.

## 6. Service group và product variants

Hiện trạng:

- `ProductCategory` là proxy tốt nhất cho `service_group`.
- `Product` có category, SKU, giá/chi phí/lợi nhuận liên quan và là thực thể order đang trỏ tới; V1 có thể coi là `product_variant`.
- Product fanpage variations là biến thể trình bày marketing, không phải durable purchasable variant.
- `AdGroup` có `productCategoryId` và tối đa một `selectedProducts` thực tế trong logic mapping; mapping vẫn tùy chọn.

Mapping V1:

| Khái niệm chuẩn | Alias ERP V1 |
|---|---|
| `service_group_id`, `service_group_name` | `ProductCategory._id`, `ProductCategory.name` |
| `product_variant_id`, `product_variant_name` | `Product._id`, `Product.name` |
| `sku` | `Product.sku` |
| `price` | Giá order/quote; fanpage customPrice chỉ làm context |
| `cost` | Product cost/totalCost và allocation thực tế |
| `gross_profit`, `net_profit` | Order/report theo Product |

Quy tắc chính thức cần ghi vào tài liệu:

> Ads nên phân tích theo `service_group`. Báo giá, đơn hàng, doanh thu, chi phí, lợi nhuận nên tính theo `product_variant`.

V2 cần migration nếu ProductCategory không phải taxonomy nhóm dịch vụ chính thức hoặc cần quan hệ parent/variant bền vững.

## 7. Director Data Pack sections readiness

| Sheet/section | Mục đích | Dữ liệu hiện có / còn thiếu | Model/service hiện tại | V1? | Alias? | V2 migration? | Tin cậy | Ưu tiên |
|---|---|---|---|---|---|---|---|---|
| README | Hướng dẫn pack | Có thể sinh; thiếu contract chính thức | Export services | Có | Không | Không | high | P0 |
| metadata | Version/phạm vi/provenance | Có timestamp/source; thiếu company identity/config chuẩn | Nhiều module | Có | Có | Có thể | medium | P0 |
| director_manual_inputs | Bối cảnh giám đốc | Generic config/finance partial; thiếu model riêng | SystemSettings/finance | Có | Có | Có | medium-low | P0 |
| financial_context | Tiền thật/free cash | Có nhiều nguồn; có nguồn sai semantics | FinancialControl/cashflow | Có có điều kiện | Có | Có thể | medium | P0 |
| financing_context | Khoản vay/vốn | Có loan/funding/repayment; thiếu status/policy chuẩn | FinanceService/schemas | Có | Có | Có | medium | P0 |
| cashflow_scenarios | Base/upside/downside | Forecast 7D/notes partial; thiếu scenario model | FinancialControl | Có giới hạn | Có | Có | low-medium | P0 |
| business_summary | Tổng quan điều hành | Có order/profit/finance/alerts | Reports/services | Có | Có | Không bắt buộc | medium-high | P0 |
| marketing_profitability | Hiệu quả ads→profit | Có ad group/order/profit partial | AI Marketing/Google/order | Có | Có | Có | medium | P0 |
| service_performance | Hiệu quả sản phẩm/dịch vụ | Có product report | OrderReportService | Có | Có | Không bắt buộc | medium-high | P0 |
| service_group_performance | Nhóm dịch vụ | Có thể aggregate category | ProductCategory/Product/order | Có | Có | Có thể | medium | P0 |
| product_variant_performance | Biến thể bán | Có thể alias Product | Product/order | Có | Có | Có thể | medium | P0 |
| unit_economics | Giá/cost/profit đơn vị | Có phần lớn ở product/order | Product/order calculation | Có | Có | Có thể | medium | P0 |
| ltv_summary | Giá trị vòng đời | Customer/order mapping yếu | Customer/order | Có nhưng hạn chế | Có | Có | low | P1 |
| sales_funnel | Lead→order | Lead/order relation partial, nhiều inferred lead | MarketingLead/AI Marketing | Có có cảnh báo | Có | Có | medium-low | P0 |
| sales_team | Hiệu quả sale | assignedSale/agent semantics chưa thống nhất | Lead/order/agent | Có giới hạn | Có | Có thể | low | P1 |
| operation_capacity | Tải/capacity/SLA | Thiếu capacity/status history | Operation/order | Chỉ ghi unavailable | Không | Có | low | P1 |
| decision_history | Quyết định/kết quả | Google mạnh; domain khác phân mảnh | Google action/OpsAction/AI Marketing | Có | Có | Có thể | medium | P1 |
| alerts | Cảnh báo điều hành | Có nhiều nguồn, chưa schema chung | Finance/ads alerts | Có | Có | Có thể | medium-low | P1 |
| data_quality | Chất lượng dữ liệu | Có score cục bộ; thiếu report toàn ERP | Google export/AI Marketing | Có sau đặc tả | Có | Có thể | low-medium | P0 |
| mapping_report | Tỷ lệ mapping | Có dữ liệu nguồn nhưng chưa service/formula chung | Nhiều schema | Có sau đặc tả | Có | Có thể | low-medium | P0 |
| decision_options | Phương án/đánh đổi | Có suggestions/action plans partial | AI Operator/AI Marketing/OpsAction | Có | Có | Có thể | medium | P1 |
| permission_risk_limits | Giới hạn/duyệt | Google mạnh; policy chung thiếu | Auth/ads/finance config | Có | Có | Có | medium | P0 |
| chatgpt_web_reading_rules | Quy tắc đọc | Có static guardrail phân mảnh | AI quality/operator/Google prompt | Có | Có | Không | medium-high | P0 |
| chatgpt_web_research_rules | Quy tắc nghiên cứu web | Chưa có contract đầy đủ | Không thấy module riêng | Có bằng static doc | Có | Có thể | low | P0 |

## 8. ChatGPT web reading/research rules

ERP có rule/guardrail tĩnh trong `backend/src/common/ai-assistant-quality.ts`, `backend/src/ai-operator/ai-operator.knowledge.ts`, `backend/src/ai-operator/ai-operator.v2-registry.ts` và prompt/policy Google Ads. Chúng đang phân mảnh và chủ yếu nằm trong code.

V1 phải export hai section riêng:

- `chatgpt_web_reading_rules`: hard-code đủ 12 rule trong yêu cầu kiểm tra, gồm không kết luận mạnh khi quality thấp, không scale khi mapping/cashflow yếu, phân biệt estimated/realized, và action file chỉ là nháp.
- `chatgpt_web_research_rules`: quy định khi nào phải nghiên cứu web, nguồn được phép, URL/ngày truy cập, phân biệt fact/inference, và không biến nghiên cứu thành live action.

| # | Rule bắt buộc V1 | Loại |
|---:|---|---|
| 1 | Không kết luận mạnh nếu data quality thấp. | Hard-code |
| 2 | Không scale ads nếu mapping campaign → service thấp. | Hard-code |
| 3 | Không tăng ngân sách mạnh nếu chưa rõ dòng tiền. | Hard-code |
| 4 | Không dùng khoản vay giả định như tiền mặt thật. | Hard-code |
| 5 | Không dùng LTV theo campaign nếu customer mapping chưa bền. | Hard-code |
| 6 | Không kết luận sale kém nếu thiếu call/activity log. | Hard-code |
| 7 | Không đề xuất tăng lead nếu vận hành đang quá tải hoặc capacity không rõ. | Hard-code |
| 8 | Không đề xuất tắt campaign chủ lực nếu chưa đủ mẫu và chưa có duyệt. | Hard-code + protected list V2 |
| 9 | Luôn phân biệt estimated profit và realized profit. | Hard-code |
| 10 | Luôn ghi rõ dữ liệu thiếu và việc cần kiểm tra thêm. | Hard-code |
| 11 | Khi cần dữ liệu thị trường/đối thủ/pháp lý, phải nghiên cứu web và ghi nguồn. | Hard-code + research policy V2 |
| 12 | File hành động do ChatGPT Web tạo chỉ là nháp, ERP chưa được thực thi ngay. | Hard-code, không cho UI tắt |

V2 có thể cho admin cấu hình target, threshold, protected/test allowlist, max budget/loss và research source policy. Các nguyên tắc an toàn không được cho phép tắt từ UI.

## 9. OpenAI API key readiness

Kết luận: **chưa an toàn để nhúng OpenAI API key ngay**.

Điểm đã có:

- `OpenAIConfigService` mã hóa key mới bằng `apiKeyEnc`, mask response và có logic migrate plaintext khi update.
- Có utility/interceptor redaction dùng ở nhiều module.

P0 còn thiếu:

1. Schema vẫn có `apiKey` plaintext và runtime `resolveApiKey()` vẫn fallback plaintext.
2. Quyền `openai-configs` cấp cả Director và Manager, không tách read/write/test/use.
3. Chưa thấy credential audit log riêng cho OpenAI config.
4. `testKey` chủ yếu kiểm tra format, không phải verification workflow có audit.
5. Cần áp redaction/error-log policy nhất quán cho OpenAI routes.
6. Cần secret manager/rotation, production encryption-key enforcement và quy trình xóa credential artifact khỏi working tree.

## 10. File upload normalization readiness

Điểm đã có:

- Multer và các endpoint upload cục bộ.
- Parser CSV/XLSX/JSON/ZIP theo từng nghiệp vụ.
- Google action ZIP có kiểm tra size, MIME/name, zip path, checksum, AJV schema, business rule, duplicate và allowlist.

Thiếu nền tảng chung:

- Upload artifact model lưu original hash/file/version/provenance.
- Normalized artifact và schema version.
- Validation errors có cấu trúc.
- Review/approve/reject state và audit trail.
- Retention, access control, malware/content scan và PII/secret redaction.
- Prompt-injection/untrusted-document policy khi dùng OpenAI.
- Cơ chế đảm bảo normalization không tự thực thi action.

Vì vậy giai đoạn OpenAI normalization chỉ được code sau khi tài liệu kỹ thuật định nghĩa đầy đủ artifact lifecycle và security boundary.

## 11. Action file import/dry-run/execution readiness

| Domain/provider | Hiện trạng | V1 | V2 | V3 controlled execution | Không được tự động |
|---|---|---|---|---|---|
| Google Ads Search | ZIP import, schema/business validation, validateOnly, approval, dry-run, policy, confirmation, idempotency, log, post-sync, evaluation 3/7 ngày | Nháp/task + giữ path hiện có | Dry-run | Có thể với guardrail hiện có và P0 hardening; bổ sung đánh giá ngày 1 | Delete, PMax, Shopping, Display, YouTube, auto-publish |
| Facebook/Meta Ads | Legacy AI Marketing có budget/status apply và quality threshold nhưng guardrail yếu hơn Google | Task/nháp | Có thể dry-run sau typed schema/idempotency/policy | Chưa | Mọi live action hiện tại từ file ChatGPT |
| TikTok Ads | Legacy sync/apply partial | Task/nháp | Có thể xem xét dry-run sau hardening | Chưa | Mọi live action hiện tại từ file ChatGPT |
| Zalo | Có token/integration dấu hiệu, chưa thấy ads action pipeline chuẩn | Task/nháp | Chưa | Chưa | Ads/message tự động |
| ERP internal task | OpsAction approval-only, không live apply | Task | Preview/dry-run | Chỉ sau domain-specific policy | Thay đổi tài chính/khách hàng nhạy cảm |
| Sale task | Có thể tạo task/nhắc việc | Task | Preview/dry-run | Chưa | Tự gọi/nhắn khách hàng |
| Operation task | OpsAction approval-only | Task | Preview/dry-run | Chưa | Tự thay đổi trạng thái nghiệp vụ |
| Finance task | Chỉ nên là đề xuất/duyệt | Task | Preview/dry-run | Chưa | Thanh toán, vay, rút vốn, ghi sổ tự động |

Google V2 là path duy nhất đủ gần controlled execution. Không được dùng legacy multi-provider path để né guardrail Google V2.

## 12. Data Quality và Mapping Quality

AI Marketing hiện có `dataQualityScore`: explicit lead 30 điểm, inferred lead 18, ad spend 25, order 25 hoặc pending 10, metadata 10, sample size 10. Threshold action hiện tại: increase 70, decrease 55, pause 45. Score này hữu ích nhưng không thay thế Mapping Report toàn ERP.

| Chỉ số | Công thức V1 đề xuất | Khả năng hiện tại | Cảnh báo/khóa đề xuất |
|---|---|---|---|
| `lead_source_mapping_rate` | lead có `sourcePlatform` / tất cả lead | Có thể tính | <90% cảnh báo |
| `lead_campaign_mapping_rate` | lead có campaign / lead có thể attribution | Có thể tính partial | Thấp thì không kết luận campaign |
| `order_lead_mapping_rate` | order có durable lead / order liên quan | Chỉ proxy qua lead.orderId | Thấp thì khóa funnel mạnh |
| `order_service_mapping_rate` | order có product hợp lệ / tất cả order | Có thể tính | <90% cảnh báo |
| `order_customer_mapping_rate` | order có durable customerId / tất cả order | Durable rate hiện gần 0; chỉ approximate phone/name | <90% khóa LTV campaign |
| `order_profit_completion_rate` | final order có profit/allocation hoàn tất / final order | Có thể tính partial | <80% khóa profit/scale mạnh |
| `campaign_service_mapping_rate` | campaign/ad group có mapping service hợp lệ / tổng | Có thể tính ở ad group | <80% khóa scale/live |
| `ads_sync_success_rate` | sync unit/run thành công / expected unit/run | Có dữ liệu partial | Fail/stale khóa live |
| `ads_data_freshness_hours` | now - last successful sync | Có thể tính | Quá expected window khóa live |
| `attribution_confidence` | weighted verified platform/account/campaign/adgroup/lead/order keys + freshness | Chưa có đúng; Google export đang quá tự tin | <0.8 khóa scale/live |
| `estimated_vs_realized_profit_rate` | số final realized / số có estimated; xuất thêm tỷ lệ giá trị realized/estimated | Có thể tính partial | Thấp thì không kết luận profit chắc chắn |

Mọi live execution vẫn phải qua schema, permission, approval, dry-run, provider validation và policy dù quality score cao.

## 13. Finance canonical source

Nguồn nên dùng:

- `FinancialControlService` cho bank balance, committed breakdown, free cash, survival floor, runway và forecast 7 ngày.
- Cashflow entries và `FinanceService.recordDisbursement()` cho dòng tiền/giải ngân thực tế.
- `FinanceService.getDebtCashflowSummary()` cho debt schedule, với quality flag nếu thiếu lịch.
- Order reports/funds cho realized và pending profit, luôn tách estimated/realized.

Nguồn không được dùng trực tiếp làm canonical:

- `FinanceService.computeAvailableFunds()` trước khi sửa ngữ nghĩa.
- `getCollectedRevenueToday()` vì đang lấy `netProfit`.
- `getLoanRoomAvailable()` vì có thể lấy principal/remaining của khoản chưa giải ngân.
- `finance/data-collection.service.ts` và `cashflow-control/services/profit.service.ts` vì có mock/random.
- Các snapshot/fallback không có provenance/freshness rõ ràng.

Forecast 7 ngày có nền tảng. Forecast 30/90 ngày chưa đủ tin cậy và phải ghi `estimated`, `partial_obligations`, `missing_schedule`, `stale_source` khi phù hợp.

## 14. Security/secret handling

Kết luận: security hiện chưa đạt điều kiện để thêm OpenAI key hoặc mở generic action execution.

P0:

1. Migrate/rotate và bỏ mọi plaintext field/fallback của OpenAI và non-Google API token.
2. Không ghi Google Sheets/service credential ra file plaintext thường; dùng secret manager hoặc secure encrypted storage.
3. Tách permission credential read/write/test/use; giới hạn người quản trị.
4. Bổ sung credential audit log và redaction policy cho request/error/log/response.
5. Rà soát/xử lý credential-like artifact trong working tree mà không in nội dung secret.
6. Định nghĩa retention, encryption, access control, hash, review và deletion cho upload artifacts.
7. Chặn prompt injection/untrusted file, giới hạn MIME/size/content và không cho normalization tự kích hoạt action.

Working tree có credential-like file/directory chưa commit như `backend/dongbodulieuweb-8de0c9a12896.json` và `backend/exports/`; audit này không mở hoặc sửa nội dung.

## 15. Đề xuất thứ tự viết tài liệu kỹ thuật

1. Director Data Pack và Marketer Data Pack contract: JSON schema, XLSX multi-sheet, metadata, provenance, freshness.
2. Finance canonical source, financing context, cashflow scenarios và manual inputs.
3. Service group/product variant alias và mapping contract.
4. Data Quality Report, Mapping Report, confidence formula và decision-lock threshold.
5. ChatGPT Web reading rules và research rules.
6. Permission/risk limits, protected/test allowlist và approval matrix.
7. Upload artifact/normalization/review/security contract.
8. Action file schema, provider/domain capability matrix, dry-run và controlled execution contract.

## 16. Đề xuất thứ tự code sau này

Thứ tự bắt buộc, không đảo:

1. **Giai đoạn 1 - Tài liệu kỹ thuật:** Director/Marketer Data Pack, quality/mapping, rules, schema, manual inputs, financing, service group/variant, security/permission.
2. **Giai đoạn 2 - Read-only export layer:** chỉ xuất dữ liệu; không tạo hoặc thực thi action.
3. **Giai đoạn 3 - OpenAI key + upload normalization:** sau khi hoàn tất P0 secret handling; lưu original/normalized/errors; chờ review.
4. **Giai đoạn 4 - Action import + validate + dry-run:** kiểm tra schema, permission, quality, mapping và policy; chưa live.
5. **Giai đoạn 5 - Controlled execution:** chỉ khi schema valid, quality/mapping đạt, approved, dry-run pass, provider validateOnly pass, có confirmation/rollback/log/post-sync/evaluation 1/3/7 ngày.

## 17. Kết luận cuối

ERP hiện đủ nền tảng để **bắt đầu viết tài liệu kỹ thuật** và sau đó xây dựng **V1 read-only export**, nhưng chưa đủ an toàn để nhúng OpenAI key, triển khai generic upload normalization/action import, hoặc mở controlled execution đa nền tảng.

V1 nên ưu tiên alias/mapping, provenance và cảnh báo chất lượng thay vì migration sớm. V2 cần mô hình bền vững cho Director manual inputs, loan semantics, service group/variant, durable lead/customer/order attribution, upload artifacts và permission/audit credential. Live execution phải là giai đoạn cuối; Google Search V2 là path tham chiếu, không phải lý do để mở execution cho các provider/domain khác.

Kiểm chứng đã chạy:

```text
npm test -- --runInBand openai-config ai-marketing ops-action google-ads api-token ad-group/ad-group.auto-control.service.spec.ts
Test Suites: 19 passed, 19 total
Tests:       104 passed, 104 total
```
