---

<!-- FILE: 00_README_INDEX.md -->

# V2 — Codex Operator → ERP Export → ChatGPT Web → ERP Execute

## Mục tiêu

Tách tài liệu V2 thành các phần nhỏ để Codex và marketer dễ dùng.

Luồng chính:

```text
Người dùng chỉ thao tác với Codex
        ↓
Codex gọi ERP API tải dữ liệu ads xuống
        ↓
Người dùng upload file ads_live_export.zip lên ChatGPT Web
        ↓
ChatGPT Web phân tích theo trình tự chuyên gia
        ↓
Người dùng duyệt ý tưởng trong ChatGPT Web
        ↓
ChatGPT Web trả ads_execution_plan.zip
        ↓
Người dùng đưa file cho Codex
        ↓
Codex import/validate/approve/execute thông qua ERP API
        ↓
ERP gọi Google Ads API
        ↓
ERP ghi log, sync lại, đánh giá sau 3/7 ngày
```

## Bộ tài liệu đã tách

| File | Dành cho | Mục đích |
|---|---|---|
| `01_SYSTEM_OVERVIEW.md` | Chủ hệ thống, developer, marketer | Giải thích kiến trúc tổng thể và vai trò từng bên |
| `02_MARKETER_SOP.md` | Marketer | Quy trình làm việc hằng ngày bằng Codex + ChatGPT Web |
| `03_CODEX_OPERATOR_COMMANDS.md` | Codex Operator | Prompt/lệnh chuẩn để export, import, validate, approve, execute |
| `04_ERP_EXPORT_DATA_CONTRACT.md` | Backend/Codex Developer | Chuẩn file `ads_live_export.zip` tải xuống từ ERP |
| `05_EXPERT_ANALYSIS_PROMPT.md` | ChatGPT Web/ERP Export | Prompt chuyên gia phải nhúng vào file export |
| `06_CHATGPT_OUTPUT_CONTRACT.md` | ChatGPT Web/ERP Import | Chuẩn file `ads_execution_plan.zip` ChatGPT Web trả lại |
| `07_ERP_API_CONTRACT.md` | Backend/Codex Developer | API ERP cho Codex Operator gọi |
| `08_GOOGLE_ADS_EXECUTION_GUARDRAILS.md` | Backend/Codex Developer | Các luật chặn rủi ro trước khi gọi Google Ads API |
| `09_CODEX_DEVELOPER_IMPLEMENTATION_PLAN.md` | Codex Developer | Các phase triển khai code trong ERP |
| `10_TESTING_ACCEPTANCE_CRITERIA.md` | QA/Developer | Test plan và tiêu chí nghiệm thu |
| `11_MARKETER_REVIEW_CHECKLIST.md` | Marketer/Manager | Checklist duyệt ý tưởng, keyword, RSA, ngân sách, landing page |
| `12_SECURITY_AND_SECRET_HANDLING.md` | Backend/DevOps | Bảo mật OAuth/developer token/secret |

## Quy tắc thiết kế bất biến

1. Codex không gọi trực tiếp Google Ads API.
2. ChatGPT Web không gọi ERP hoặc Google Ads API.
3. ERP là cổng kiểm soát duy nhất: validate, approve, execute, log.
4. Google Ads API chỉ nhận lệnh từ ERP backend/worker.
5. `action_plan.json` là nguồn dữ liệu chuẩn duy nhất để ERP import.
6. Không execute raw payload do ChatGPT Web tạo.
7. Campaign mới luôn tạo ở trạng thái `PAUSED`.
8. Mọi create/update/pause/resume phải `approvalRequired=true`.
9. ERP phải chạy provider `validateOnly` trước khi approve/execute.
10. Mọi action phải có `idempotencyKey`.



---

<!-- FILE: 01_SYSTEM_OVERVIEW.md -->

# 01 — System Overview

## 1. Mục tiêu kiến trúc

Hệ thống cho phép người dùng vận hành Google Ads bằng Codex, nhưng vẫn giữ ERP làm cổng kiểm soát an toàn.

```text
Codex = tay thao tác kỹ thuật
ChatGPT Web = não phân tích marketing
ERP = cổng kiểm soát dữ liệu, duyệt, thực thi, audit
Google Ads API = nơi nhận lệnh cuối cùng
Marketer = người quyết định chiến lược và duyệt cuối
```

## 2. Luồng tổng thể

```text
[1] Người dùng → Codex
    "Tải dữ liệu Google Ads 14 ngày gần nhất"

[2] Codex → ERP API
    POST /api/google-ads/operator/export-live-analysis

[3] ERP → Codex
    ads_live_export_<exportId>.zip

[4] Người dùng → ChatGPT Web
    Upload ads_live_export.zip

[5] ChatGPT Web
    Phân tích theo expert_analysis_prompt.md

[6] ChatGPT Web → Người dùng
    ads_execution_plan_<planId>.zip

[7] Người dùng → Codex
    "Import file này vào ERP, validate, tạo pending actions"

[8] Codex → ERP API
    POST /api/google-ads/action-plans/import
    POST /api/google-ads/action-plans/{planId}/validate

[9] Người dùng → Codex
    "Duyệt và thực thi ACT001, ACT002"

[10] Codex → ERP API
    PATCH /approve
    POST /execute

[11] ERP → Google Ads API
    Gọi mutate/searchStream theo typed action đã validate

[12] ERP
    Ghi execution log, sync lại, đánh giá sau 3/7 ngày
```

## 3. Vai trò

### Người dùng/marketer

- Chọn phạm vi phân tích.
- Đưa file lên ChatGPT Web.
- Duyệt ý tưởng ads.
- Chỉ định action nào được execute.
- Theo dõi kết quả sau thực thi.

### Codex Operator

- Gọi ERP API để export/import/validate/approve/execute.
- Không tự gọi Google Ads API.
- Không tự sửa `action_plan.json` nếu người dùng chưa yêu cầu.
- Không execute live nếu ERP chưa validate/approval.

### ChatGPT Web

- Đọc file export.
- Phân tích theo trình tự chuyên gia.
- Tạo `ads_execution_plan.zip`.
- Không tạo raw API payload để chạy thẳng.

### ERP

- Lưu dữ liệu, credential, policy.
- Validate schema và business rules.
- Chạy provider `validateOnly`.
- Ghi approval/audit/execution log.
- Gọi Google Ads API.

### Google Ads API

- Chỉ nhận lệnh từ ERP backend/worker.

## 4. Phạm vi MVP

MVP chỉ hỗ trợ Google Search Ads:

- Sync/read account/campaign/campaign budget/ad group/keyword/RSA/metrics.
- Create campaign budget.
- Create Search campaign ở trạng thái `PAUSED`.
- Create ad group.
- Create keyword `EXACT`, `PHRASE`, `BROAD`.
- Create Responsive Search Ad.
- Update campaign budget.
- Pause/resume campaign và ad group.
- Đọc báo cáo và đánh giá sau hành động.

Ngoài phạm vi MVP:

- Performance Max.
- Shopping.
- Display.
- Demand Gen.
- Video/YouTube.
- Tự động publish hoàn toàn.
- Xóa campaign/ad group/ad.
- Offline conversion upload.



---

<!-- FILE: 02_MARKETER_SOP.md -->

# 02 — Marketer SOP

## 1. Mục tiêu

Marketer không cần thao tác trực tiếp trong Google Ads hoặc nhiều màn hình ERP. Marketer làm việc chủ yếu qua Codex và ChatGPT Web.

## 2. Quy trình làm việc chuẩn

### Bước 1 — Yêu cầu Codex tải dữ liệu ads

Prompt:

```text
Tải dữ liệu Google Ads còn sống trong 14 ngày gần nhất từ ERP để tôi đưa lên ChatGPT Web phân tích.
```

Codex phải trả:

```text
- exportId
- file path của ads_live_export.zip
- ngày bắt đầu/kết thúc
- số campaign/ad group/keyword/RSA
- cảnh báo data quality nếu có
```

### Bước 2 — Upload lên ChatGPT Web

Upload file:

```text
ads_live_export_<exportId>.zip
```

Prompt ngắn:

```text
Hãy đọc file tôi upload. Trong file có expert_analysis_prompt.md. Hãy phân tích đúng trình tự và xuất ads_execution_plan.zip để tôi đưa cho Codex thực thi qua ERP.
```

### Bước 3 — Duyệt ý tưởng trong ChatGPT Web

Marketer phải xem:

```text
executive_summary.md
human_review_checklist.md
creative_variants.csv
keyword_plan.csv
risk_register.md
rollback_plan.md
action_plan.json
```

Cần kiểm tra:

- Chiến lược có đúng mục tiêu kinh doanh không.
- Sản phẩm có đủ tồn kho không.
- Keyword có đúng intent mua hàng không.
- RSA có quá cam kết không.
- Landing page có đúng domain và đúng nội dung không.
- Budget có vượt policy không.
- Campaign mới có `PAUSED` không.
- Action rủi ro cao có nên đổi thành `monitor_only` không.

### Bước 4 — Yêu cầu ChatGPT Web xuất file cuối

Prompt:

```text
Tôi duyệt bản này. Hãy xuất ads_execution_plan.zip bản cuối cùng, mọi action để approvalRequired=true và executionMode=pending_approval.
```

### Bước 5 — Đưa file cho Codex import vào ERP

Prompt:

```text
Đây là file ads_execution_plan.zip tôi đã duyệt ý tưởng trên ChatGPT Web.
Hãy import vào ERP, validate schema, validate business rules, chạy provider validateOnly và tạo pending actions. Chưa execute live.
```

### Bước 6 — Duyệt và execute qua Codex

Không nói:

```text
Duyệt hết và chạy hết.
```

Nên nói rõ:

```text
Duyệt và thực thi ACT001, ACT002. Các action còn lại để pending.
```

Sau execute, yêu cầu Codex báo:

```text
- action nào thành công
- action nào lỗi
- provider request ID
- campaign/ad group/keyword/RSA đã tạo
- campaign mới có PAUSED không
- ERP đã sync lại chưa
- khi nào đánh giá sau 3/7 ngày
```

## 3. Tần suất vận hành

### Hằng ngày

- Kiểm tra ads lỗ, CPA tăng, đơn hủy/hoàn.
- Ghi `business_daily_notes` nếu có bất thường.
- Kiểm tra action hôm qua có lỗi không.
- Kiểm tra campaign mới có đúng trạng thái không.

### Mỗi 2–3 ngày

- Tải dữ liệu 7–14 ngày bằng Codex.
- Đưa lên ChatGPT Web phân tích.
- Chỉ duyệt action có evidence đủ.

### Hằng tuần

- Tổng kết keyword thắng/thua.
- Tổng kết RSA/headline/description thắng/thua.
- Cập nhật negative keyword.
- Cập nhật decision rules.
- Đánh giá action sau 3/7 ngày.

## 4. Không nên làm

- Không scale chỉ vì ROAS cao.
- Không bỏ qua `net_profit`.
- Không chạy campaign mới ở `ENABLED` ngay.
- Không dùng quá nhiều broad keyword ở MVP.
- Không duyệt nội dung quá cam kết.
- Không execute nếu provider validateOnly failed.
- Không để Codex gọi trực tiếp Google Ads API.



---

<!-- FILE: 03_CODEX_OPERATOR_COMMANDS.md -->

# 03 — Codex Operator Commands

## 1. Nguyên tắc Codex Operator

Codex Operator chỉ thao tác qua ERP API.

Không được:

- Gọi trực tiếp Google Ads API.
- Tự chỉnh `action_plan.json` nếu người dùng chưa yêu cầu.
- Tự approve hoặc execute toàn bộ plan.
- Bỏ qua ERP validation.
- Execute khi `providerValidationStatus != passed`.

## 2. Prompt tải dữ liệu ads

```text
Bạn đang ở Codex Operator Mode.

Hãy gọi ERP API để xuất dữ liệu Google Ads còn sống trong 14 ngày gần nhất.

Yêu cầu:
1. Chỉ gọi ERP API.
2. Không gọi trực tiếp Google Ads API.
3. Endpoint ưu tiên: POST /api/google-ads/operator/export-live-analysis.
4. Include đầy đủ campaign, budget, ad group, keyword, RSA, metrics, product, inventory, order/profit, landing page, creative asset, change_log, business notes, decision rules và expert prompt.
5. Tải file ZIP về thư mục downloads/ai-ads/.
6. Kiểm tra ZIP có đủ file bắt buộc.
7. Báo lại exportId, file path, rowCounts và cảnh báo data quality.
```

Expected API call:

```http
POST /api/google-ads/operator/export-live-analysis
```

Body:

```json
{
  "provider": "google",
  "dateRange": { "preset": "last_14_days" },
  "include": {
    "campaigns": true,
    "campaignBudgets": true,
    "adGroups": true,
    "keywords": true,
    "responsiveSearchAds": true,
    "dailyMetrics": true,
    "products": true,
    "orders": true,
    "profit": true,
    "inventory": true,
    "changeLog": true,
    "businessNotes": true,
    "decisionRules": true,
    "expertPrompt": true
  },
  "liveOnly": true,
  "includeRecentlyPausedDays": 3,
  "format": "zip"
}
```

## 3. Prompt import file từ ChatGPT Web

```text
Bạn đang ở Codex Operator Mode.

Tôi đã duyệt ý tưởng ads trong ChatGPT Web. Đây là file ads_execution_plan.zip.

Hãy:
1. Upload file này vào ERP bằng POST /api/google-ads/action-plans/import.
2. mode=import_pending.
3. Không execute live.
4. Chạy POST /api/google-ads/action-plans/{planId}/validate với providerValidateOnly=true.
5. Báo lại danh sách action, trạng thái validateOnly, rủi ro và lỗi nếu có.
6. Không tự sửa action_plan nếu tôi chưa yêu cầu.
7. Không gọi Google Ads API trực tiếp.
```

## 4. Prompt duyệt và thực thi

```text
Bạn đang ở Codex Operator Mode.

Duyệt và thực thi các action sau qua ERP API: ACT001, ACT002, ACT003.

Yêu cầu:
1. Gọi approve endpoint cho từng action.
2. Ghi approvalText đúng nội dung lệnh của tôi.
3. Chỉ execute nếu providerValidationStatus=passed.
4. Chỉ execute nếu ERP policy cho phép.
5. Không gọi Google Ads API trực tiếp.
6. Sau execute, lấy execution log và báo cáo:
   - action nào thành công
   - action nào lỗi
   - provider request ID
   - remote state sau sync
   - việc cần theo dõi sau 3/7 ngày
```

## 5. Báo cáo Codex phải trả cho người dùng

Sau import:

```text
Plan ID: ...
Status: pending_approval
Actions total: ...
Valid: ...
Invalid: ...
Provider validateOnly: passed/failed/pending
High-risk actions: ...
Lỗi cần sửa: ...
```

Sau execute:

```text
Plan ID: ...
Executed actions: ...
Succeeded: ...
Failed: ...
Provider request IDs: ...
Remote state verified: yes/no
Next evaluation: sau 3 ngày, sau 7 ngày
```



---

<!-- FILE: 04_ERP_EXPORT_DATA_CONTRACT.md -->

# 04 — ERP Export Data Contract

## 1. Mục tiêu

ERP phải xuất dữ liệu đầy đủ để ChatGPT Web phân tích như chuyên gia.

Tên file:

```text
ads_live_export_<exportId>.zip
```

Ví dụ:

```text
ads_live_export_EXP-20260611-001.zip
```

## 2. Cấu trúc bắt buộc

```text
ads_live_export_EXP-20260611-001.zip
├── manifest.json
├── operator_readme.md
├── expert_analysis_prompt.md
├── data_dictionary.md
├── decision_rules.json
├── data_quality_report.json
├── google_accounts.csv
├── campaigns.csv
├── campaign_budgets.csv
├── ad_groups.csv
├── keywords.csv
├── responsive_search_ads.csv
├── daily_metrics_campaign.csv
├── daily_metrics_ad_group.csv
├── daily_metrics_keyword.csv
├── daily_metrics_ad.csv
├── products.csv
├── inventory.csv
├── order_profit_attribution.csv
├── landing_pages.csv
├── creative_assets.csv
├── change_log.csv
├── business_daily_notes.csv
└── export_summary.md
```

## 3. `manifest.json`

```json
{
  "schemaVersion": "2.0",
  "exportId": "EXP-20260611-001",
  "generatedAt": "2026-06-11T08:00:00+07:00",
  "generator": "erp-google-ads-export",
  "provider": "google",
  "timezone": "Asia/Ho_Chi_Minh",
  "currency": "VND",
  "dateFrom": "2026-05-28",
  "dateTo": "2026-06-11",
  "liveOnly": true,
  "includeRecentlyPausedDays": 3,
  "analysisPromptFile": "expert_analysis_prompt.md",
  "decisionRulesFile": "decision_rules.json",
  "files": []
}
```

## 4. `google_accounts.csv`

```csv
customerId,loginCustomerId,accountName,currencyCode,timeZone,managerAccountId,isMccLinked,status,lastSyncAt
```

## 5. `campaigns.csv`

```csv
customerId,campaignId,resourceName,campaignName,status,advertisingChannelType,biddingStrategyType,campaignBudgetId,campaignBudgetResourceName,startDate,endDate,internalProductId,lastSyncAt
```

## 6. `campaign_budgets.csv`

```csv
customerId,campaignBudgetId,resourceName,name,amountMicros,amountVnd,deliveryMethod,explicitlyShared,status,lastSyncAt
```

Bắt buộc có `campaignBudgetId` hoặc `resourceName`. Không được đoán budget ID từ campaign/ad group ID.

## 7. `ad_groups.csv`

```csv
customerId,campaignId,adGroupId,resourceName,adGroupName,status,type,cpcBidMicros,internalAdGroupId,internalProductIds,lastSyncAt
```

## 8. `keywords.csv`

```csv
customerId,campaignId,adGroupId,criterionId,resourceName,keywordText,matchType,negative,status,qualityScore,lastSyncAt
```

## 9. `responsive_search_ads.csv`

```csv
customerId,campaignId,adGroupId,adId,resourceName,status,headlines,descriptions,finalUrls,path1,path2,policyApprovalStatus,policyReviewStatus,creativeAssetId,lastSyncAt
```

`headlines`, `descriptions`, `finalUrls` có thể là JSON string.

## 10. Daily metrics

### `daily_metrics_campaign.csv`

```csv
date,customerId,campaignId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,allConversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,cancelledOrders,profitPerSpend,roas
```

### `daily_metrics_ad_group.csv`

```csv
date,customerId,campaignId,adGroupId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,allConversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,cancelledOrders,profitPerSpend,roas
```

### `daily_metrics_keyword.csv`

```csv
date,customerId,campaignId,adGroupId,criterionId,keywordText,matchType,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,profitPerSpend,roas
```

### `daily_metrics_ad.csv`

```csv
date,customerId,campaignId,adGroupId,adId,costMicros,costVnd,impressions,clicks,ctr,averageCpc,conversions,conversionValue,costPerConversion,revenue,grossProfit,netProfit,orders,confirmedOrders,profitPerSpend,roas
```

## 11. Business data

### `products.csv`

```csv
productId,productName,category,sellingPrice,costOfGoods,grossMarginPercent,minStock,priority,isActive,defaultLandingPage,note
```

### `inventory.csv`

```csv
productId,onHand,available,reserved,minStock,maxStock,lastUpdatedAt,stockRisk
```

### `order_profit_attribution.csv`

```csv
orderId,orderDate,confirmedDate,customerId,campaignId,adGroupId,adId,criterionId,productId,quantity,revenue,grossProfit,adsCostAllocated,fulfillmentCost,saleCommission,refundAmount,netProfit,orderStatus,paymentStatus,attributionType,attributionConfidence
```

Không xuất PII: tên, số điện thoại, email, địa chỉ.

### `landing_pages.csv`

```csv
landingPageId,url,domain,title,productId,status,approvedForAds,mainCta,notes,lastCheckedAt
```

### `creative_assets.csv`

```csv
creativeAssetId,productId,landingPageUrl,angle,hook,offer,proof,cta,complianceNote,approvedForAds,createdAt
```

### `change_log.csv`

```csv
changeTime,provider,customerId,campaignId,adGroupId,adId,criterionId,changeType,beforeValue,afterValue,reason,changedBy,sourcePlanId,sourceActionId,expectedResult
```

### `business_daily_notes.csv`

```csv
date,noteType,note,affectedCustomerId,affectedCampaignId,affectedAdGroupId,affectedProductId,severity
```

## 12. `data_quality_report.json`

```json
{
  "exportId": "EXP-20260611-001",
  "status": "passed_with_warnings",
  "warnings": [],
  "missingFiles": [],
  "missingColumns": [],
  "duplicateKeys": [],
  "attributionCoverage": {
    "ordersWithAdGroupIdPercent": 92,
    "ordersWithKeywordIdPercent": 38
  }
}
```



---

<!-- FILE: 05_EXPERT_ANALYSIS_PROMPT.md -->

# 05 — Expert Analysis Prompt

File này phải được ERP nhúng vào `ads_live_export.zip` dưới tên:

```text
expert_analysis_prompt.md
```

## Prompt

```text
Bạn là chuyên gia Performance Marketing cấp cao, chuyên phân tích Google Search Ads dựa trên dữ liệu ERP, lợi nhuận thực và lịch sử thay đổi.

Nhiệm vụ:
Phân tích toàn bộ dữ liệu trong gói export này và trả lại một gói ads_execution_plan.zip có cấu trúc ổn định để Codex import vào ERP.

## Trình tự phân tích bắt buộc

### 1. Kiểm tra chất lượng dữ liệu
- File nào thiếu?
- Cột nào thiếu?
- Dữ liệu có đủ ngày không?
- Có đủ campaign/ad group/keyword/RSA không?
- Có dữ liệu lợi nhuận không?
- Có dữ liệu tồn kho không?
- Có change_log không?
- Có business notes không?
- Có vấn đề attribution không?

Nếu dữ liệu thiếu nghiêm trọng, không đề xuất hành động mạnh. Dùng monitor_only.

### 2. Tóm tắt bức tranh tổng quan
- Tổng spend.
- Tổng revenue.
- Tổng gross_profit.
- Tổng net_profit.
- Tổng conversions/orders.
- CPA trung bình.
- ROAS.
- Profit per spend.
- Campaign/ad group đang lãi/lỗ.

### 3. Phân tích tài chính
Ưu tiên thứ tự:
1. net_profit
2. gross_profit
3. confirmed_orders/conversions chất lượng
4. CPA
5. profit_per_spend
6. ROAS
7. clicks/CTR/impressions

Không được ưu tiên ROAS hơn net_profit.

### 4. Phân tích campaign
Với từng campaign:
- Spend.
- Revenue.
- Net profit.
- CPA.
- Conversion.
- Budget.
- Status.
- Có nên giữ, tăng, giảm, pause, hay monitor?

### 5. Phân tích ad group
Với từng ad group:
- Nhóm intent.
- Keyword chính.
- RSA đang dùng.
- Spend/revenue/net_profit.
- Có scale được không?
- Có nên tách nhóm không?
- Có nên pause không?

### 6. Phân tích keyword
Phân loại:
- Keyword thắng.
- Keyword lỗ.
- Keyword có nhiều click nhưng không chuyển đổi.
- Keyword nên thêm.
- Keyword nên pause.
- Keyword nên chuyển match type.
- Keyword nên thêm negative.

### 7. Phân tích Responsive Search Ads
Với RSA:
- Headline nào tốt?
- Description nào yếu?
- Có thiếu thông điệp gọi tư vấn không?
- Có câu quá cam kết không?
- Có câu dễ vi phạm chính sách không?
- Có nên tạo biến thể mới không?

### 8. Phân tích landing page
- Landing page có khớp keyword không?
- Có CTA rõ không?
- Có ưu tiên gọi tư vấn không?
- Có thông tin dễ gây hiểu nhầm không?
- Có nên đổi landing page không?

### 9. Phân tích sản phẩm/lợi nhuận/tồn kho
- Sản phẩm nào lãi tốt?
- Sản phẩm nào doanh thu cao nhưng lãi thấp?
- Tồn kho có đủ scale không?
- Có sản phẩm nào không nên đẩy không?

### 10. Phân tích theo thời gian
- Xu hướng 3 ngày.
- Xu hướng 7 ngày.
- Trước/sau thay đổi budget.
- Trước/sau thay đổi nội dung.
- Trước/sau pause/resume.

### 11. Phân tích change_log
- Hành động nào trước đây đúng?
- Hành động nào trước đây sai?
- Có action nào cần rollback không?

### 12. Phân tích rủi ro
- Dữ liệu thiếu.
- Attribution yếu.
- Mẫu nhỏ.
- Campaign mới chưa đủ thời gian.
- Có ngày bất thường do sale/web/stock không?

### 13. Tìm mẫu thắng/thua
Tìm:
- Nhóm keyword thắng.
- Mẫu headline thắng.
- Mẫu CTA thắng.
- Offer tốt.
- Nỗi đau tốt.
- Loại nội dung kém.

### 14. Đề xuất hành động
Chỉ dùng action_type trong allowlist:
- create_search_campaign
- create_ad_group
- create_keyword
- create_responsive_search_ad
- update_campaign_budget
- pause_campaign
- resume_campaign
- pause_ad_group
- resume_ad_group
- monitor_only

Mọi action phải có:
- actionId
- actionType
- reason
- evidence
- confidence
- risk
- dataQuality
- approvalRequired=true
- idempotencyKey
- rollbackIf
- typedPayload

### 15. Tự phản biện
Trước khi xuất file, hãy tự hỏi:
- Đề xuất này có thể sai vì dữ liệu thiếu không?
- Có đang nhầm tương quan thành nguyên nhân không?
- Có đủ min_spend/min_orders để kết luận không?
- Có vượt budget/tồn kho không?
- Có hành động nào quá rủi ro không?

### 16. Output bắt buộc
Xuất gói ads_execution_plan.zip gồm:
- manifest.json
- action_plan.json
- executive_summary.md
- human_review_checklist.md
- creative_variants.csv
- keyword_plan.csv
- validation_rules.json
- risk_register.md
- rollback_plan.md

Không chỉ trả lời văn xuôi.
```



---

<!-- FILE: 06_CHATGPT_OUTPUT_CONTRACT.md -->

# 06 — ChatGPT Output Contract

## 1. Mục tiêu

ChatGPT Web sau khi phân tích phải trả file có cấu trúc ổn định để Codex import vào ERP.

Tên file:

```text
ads_execution_plan_<planId>.zip
```

Ví dụ:

```text
ads_execution_plan_PLAN-20260611-001.zip
```

## 2. Cấu trúc file

```text
ads_execution_plan_PLAN-20260611-001.zip
├── manifest.json
├── action_plan.json
├── executive_summary.md
├── human_review_checklist.md
├── creative_variants.csv
├── keyword_plan.csv
├── validation_rules.json
├── risk_register.md
└── rollback_plan.md
```

ERP chỉ dùng `action_plan.json` làm nguồn chuẩn để import.

CSV/Markdown chỉ dùng cho người đọc và kiểm tra.

## 3. `manifest.json`

```json
{
  "schemaVersion": "2.0",
  "planId": "PLAN-20260611-001",
  "sourceExportId": "EXP-20260611-001",
  "generatedAt": "2026-06-11T10:00:00+07:00",
  "generator": "chatgpt-web",
  "targetProvider": "google",
  "currency": "VND",
  "timezone": "Asia/Ho_Chi_Minh",
  "executionMode": "pending_approval",
  "hashes": {
    "action_plan.json": "sha256-placeholder",
    "creative_variants.csv": "sha256-placeholder",
    "keyword_plan.csv": "sha256-placeholder"
  }
}
```

## 4. `action_plan.json`

```json
{
  "schemaVersion": "2.0",
  "planId": "PLAN-20260611-001",
  "sourceExportId": "EXP-20260611-001",
  "targetProvider": "google",
  "currency": "VND",
  "timezone": "Asia/Ho_Chi_Minh",
  "executionMode": "pending_approval",
  "analysisSummary": {
    "mainConclusion": "...",
    "dataQuality": "good_with_warnings"
  },
  "actions": [
    {
      "actionId": "ACT001",
      "provider": "google",
      "actionType": "create_search_campaign",
      "customerId": "1234567890",
      "loginCustomerId": "4345552613",
      "resourceType": "campaign",
      "operation": "create",
      "typedPayload": {
        "campaignName": "Search - Example",
        "budgetName": "Budget - Example",
        "dailyBudget": 500000,
        "advertisingChannelType": "SEARCH",
        "status": "PAUSED",
        "biddingStrategyType": "MAXIMIZE_CONVERSIONS",
        "startDate": "2026-06-12",
        "finalUrl": "https://htxbachgia.shop/",
        "adGroups": []
      },
      "reason": "...",
      "evidence": {},
      "confidence": 0.76,
      "risk": "medium",
      "dataQuality": "partial",
      "approvalRequired": true,
      "idempotencyKey": "PLAN-20260611-001_ACT001",
      "rollbackIf": []
    }
  ]
}
```

## 5. Action type allowlist

```text
create_search_campaign
create_ad_group
create_keyword
create_responsive_search_ad
update_campaign_budget
pause_campaign
resume_campaign
pause_ad_group
resume_ad_group
monitor_only
```

## 6. Blocked action types

```text
delete_campaign
delete_ad_group
delete_ad
auto_publish_without_approval
change_payment_method
change_account_setting
create_performance_max
create_shopping_campaign
create_display_campaign
```

## 7. `creative_variants.csv`

```csv
actionId,tempAdId,adGroupRef,headline1,headline2,headline3,headline4,headline5,description1,description2,description3,description4,finalUrl,path1,path2,approvalRequired,complianceNote
```

## 8. `keyword_plan.csv`

```csv
actionId,adGroupRef,keyword,matchType,negative,reason,approvalRequired
```

Allowed match type:

```text
EXACT
PHRASE
BROAD
```

## 9. `human_review_checklist.md`

Phải có các mục:

```text
- Campaign mới có PAUSED không?
- Ngân sách có đúng không?
- Keyword có quá rộng không?
- RSA có cam kết quá mức không?
- Landing page có đúng domain không?
- Action nào rủi ro cao?
- Action nào nên monitor_only?
```



---

<!-- FILE: 07_ERP_API_CONTRACT.md -->

# 07 — ERP API Contract for Codex Operator

## 1. Base path

```text
/api/google-ads
```

## 2. Operator export

### Export live analysis package

```http
POST /api/google-ads/operator/export-live-analysis
```

Request:

```json
{
  "provider": "google",
  "dateRange": { "preset": "last_14_days" },
  "include": {
    "campaigns": true,
    "campaignBudgets": true,
    "adGroups": true,
    "keywords": true,
    "responsiveSearchAds": true,
    "dailyMetrics": true,
    "products": true,
    "orders": true,
    "profit": true,
    "inventory": true,
    "changeLog": true,
    "businessNotes": true,
    "decisionRules": true,
    "expertPrompt": true
  },
  "liveOnly": true,
  "includeRecentlyPausedDays": 3,
  "format": "zip"
}
```

Response:

```json
{
  "success": true,
  "exportId": "EXP-20260611-001",
  "downloadUrl": "/api/google-ads/operator/exports/EXP-20260611-001/download",
  "fileName": "ads_live_export_EXP-20260611-001.zip",
  "rowCounts": {},
  "dataQualityStatus": "passed_with_warnings"
}
```

### Download export

```http
GET /api/google-ads/operator/exports/:exportId/download
```

### Verify export

```http
POST /api/google-ads/operator/exports/:exportId/verify
```

Response:

```json
{
  "success": true,
  "requiredFilesPresent": true,
  "missingFiles": [],
  "checksumPassed": true,
  "dataQualityWarnings": []
}
```

## 3. Action plan import

```http
POST /api/google-ads/action-plans/import
```

Content type:

```text
multipart/form-data
```

Fields:

```text
file = ads_execution_plan.zip
mode = validate_only | import_pending
source = codex_operator
```

Response:

```json
{
  "success": true,
  "planId": "PLAN-20260611-001",
  "status": "pending_approval",
  "itemsTotal": 8,
  "itemsValid": 8,
  "itemsInvalid": 0,
  "providerValidationStatus": "pending"
}
```

## 4. Provider validateOnly

```http
POST /api/google-ads/action-plans/:planId/validate
```

Request:

```json
{
  "providerValidateOnly": true,
  "source": "codex_operator"
}
```

Response:

```json
{
  "success": true,
  "planId": "PLAN-20260611-001",
  "providerValidationStatus": "passed",
  "validActions": 8,
  "failedActions": 0
}
```

## 5. Approve action

```http
PATCH /api/google-ads/action-plans/:planId/items/:actionId/approve
```

Request:

```json
{
  "approvedBySource": "codex_operator",
  "approvalText": "Người dùng đã duyệt trong Codex: Duyệt và thực thi ACT001.",
  "requireExecutionConfirmation": true
}
```

## 6. Reject action

```http
PATCH /api/google-ads/action-plans/:planId/items/:actionId/reject
```

Request:

```json
{
  "rejectedBySource": "codex_operator",
  "reason": "Keyword quá rộng, cần chỉnh lại."
}
```

## 7. Execute approved actions

```http
POST /api/google-ads/action-plans/:planId/execute
```

Request:

```json
{
  "actionIds": ["ACT001", "ACT002"],
  "validateOnly": false,
  "source": "codex_operator"
}
```

## 8. Execution logs

```http
GET /api/google-ads/action-plans/:planId/executions
```

## 9. Reports

```http
GET /api/google-ads/reports/performance
GET /api/google-ads/reports/change-history
GET /api/google-ads/reports/sync-runs
```



---

<!-- FILE: 08_GOOGLE_ADS_EXECUTION_GUARDRAILS.md -->

# 08 — Google Ads Execution Guardrails

## 1. Nguyên tắc

ERP phải block mọi action rủi ro trước khi gọi Google Ads API.

## 2. Block bắt buộc khi import

ERP phải reject file nếu:

```text
1. Không có manifest.json.
2. Không có action_plan.json.
3. schemaVersion không hỗ trợ.
4. targetProvider không phải google.
5. actionId trùng.
6. idempotencyKey trùng action đã executed.
7. actionType không thuộc allowlist.
8. Có blocked action type.
9. Có raw api_execution_queue yêu cầu gọi Google trực tiếp.
```

## 3. Block business rules

ERP phải block nếu:

```text
1. customerId không thuộc allowlist.
2. loginCustomerId không đúng MCC đã cấu hình.
3. currency không phải VND.
4. timezone không phải Asia/Ho_Chi_Minh.
5. landing page domain ngoài allowlist.
6. budget tăng vượt maxBudgetIncreasePercentPerAction.
7. budget ngày vượt maxDailyBudgetPerCampaign.
8. scale khi tồn kho dưới minStock.
9. dữ liệu chưa đủ minSpend/minConversions mà action không phải monitor_only.
```

## 4. Block Google Ads technical rules

ERP phải block nếu:

```text
1. create_search_campaign không có status=PAUSED.
2. update_campaign_budget thiếu campaignBudgetId/resourceName đã xác minh.
3. ERP cố fallback campaignBudgetId sang campaignId/adGroupId.
4. keyword rỗng.
5. matchType không thuộc EXACT/PHRASE/BROAD.
6. RSA thiếu tối thiểu 3 headline.
7. RSA thiếu tối thiểu 2 description.
8. RSA thiếu finalUrl.
9. finalUrl không phải HTTPS hoặc ngoài allowlist.
10. campaign/ad group không tồn tại khi pause/resume/update.
```

## 5. Block execution

Không execute nếu:

```text
1. Action chưa provider validateOnly passed.
2. Action chưa được approve.
3. User/Codex không có quyền execute.
4. GOOGLE_ADS_PRODUCTION_ENABLED=false.
5. AI_MARKETING_DRY_RUN=true nhưng request lại validateOnly=false.
6. idempotencyKey đã executed.
7. Action plan đã cancelled/failed.
```

## 6. Campaign mới

Create campaign luôn:

```json
{
  "status": "PAUSED"
}
```

Bật campaign là action riêng:

```text
resume_campaign
```

## 7. Approval audit

Khi Codex approve thay người dùng, ERP phải lưu:

```text
planId
actionId
approvalText nguyên văn
approvedBySource=codex_operator
userId/người đang đăng nhập
timestamp
IP/session nếu có
```

## 8. Execution log

Mỗi action execute phải ghi:

```text
planId
actionId
idempotencyKey
approvedBy
executedBy
beforeState
afterState
providerRequestId
providerResponse
providerErrors
syncedRemoteState
```



---

<!-- FILE: 09_CODEX_DEVELOPER_IMPLEMENTATION_PLAN.md -->

# 09 — Codex Developer Implementation Plan

## Phase 0 — Hardening

Mục tiêu: chặn rủi ro tiền và secret trước khi làm live mutate.

Tasks:

```text
0.1 Không lưu plaintext token.
0.2 Bắt buộc API_TOKEN_SECRET ở production.
0.3 Tách RBAC google-ads.*.
0.4 Xóa fallback campaignBudgetId || campaignId || adGroupId.
0.5 Enforce VND/timezone.
0.6 Tắt hoặc đưa auto-pause vào approval policy.
0.7 Thêm idempotency service.
```

## Phase 1 — Export cho ChatGPT Web

Tasks:

```text
1.1 Tạo POST /api/google-ads/operator/export-live-analysis.
1.2 Tạo ads_live_export.zip đầy đủ cấu trúc.
1.3 Sinh expert_analysis_prompt.md.
1.4 Sinh decision_rules.json.
1.5 Sinh data_quality_report.json.
1.6 Sinh operator_readme.md.
1.7 Tạo verify export endpoint.
```

## Phase 2 — Read-only metadata sync

Tasks:

```text
2.1 Tạo collection google_ads_campaigns.
2.2 Tạo collection google_ads_ad_groups.
2.3 Tạo collection google_ads_keywords.
2.4 Tạo collection google_ads_ads.
2.5 Tạo collection google_ads_daily_metrics.
2.6 Sync account/campaign/budget/ad group/keyword/RSA.
2.7 Sửa metrics Google: conversions, allConversions, conversionValue, costPerConversion.
```

## Phase 3 — Import action plan

Tasks:

```text
3.1 Nhận ads_execution_plan.zip.
3.2 Validate zip an toàn.
3.3 Validate manifest/action_plan schema.
3.4 Tạo pending actions.
3.5 Không execute live.
3.6 Lưu original file để audit.
```

## Phase 4 — Provider validateOnly

Tasks:

```text
4.1 ERP dựng Google operations từ typedPayload.
4.2 Gọi validateOnly=true.
4.3 Lưu providerValidationStatus.
4.4 Lưu providerValidationErrors.
4.5 Chỉ action passed mới cho approve.
```

## Phase 5 — Approval + execution

Tasks:

```text
5.1 API approve/reject từng action.
5.2 Lưu approvalText từ Codex.
5.3 Execution worker.
5.4 Google mutate cho:
    - create campaign budget
    - create Search campaign PAUSED
    - create ad group
    - create keyword
    - create RSA
    - update campaign budget
    - pause/resume campaign
    - pause/resume ad group
5.5 Idempotency.
5.6 Execution log.
5.7 Re-sync sau execution.
```

## Phase 6 — Evaluation

Tasks:

```text
6.1 Đánh giá action sau 3 ngày.
6.2 Đánh giá action sau 7 ngày.
6.3 So sánh before/after spend/revenue/netProfit/CPA/conversions.
6.4 Xuất dữ liệu vòng sau cho ChatGPT Web.
```



---

<!-- FILE: 10_TESTING_ACCEPTANCE_CRITERIA.md -->

# 10 — Testing & Acceptance Criteria

## 1. Unit tests

```text
1. Validate action_plan schema.
2. Validate action type allowlist.
3. Reject blocked action types.
4. Validate idempotencyKey.
5. Validate campaign status PAUSED.
6. Validate campaignBudgetId required.
7. Validate budget increase/decrease policy.
8. Validate currency VND.
9. Validate timezone Asia/Ho_Chi_Minh.
10. Validate landing page allowlist.
11. Validate keyword match type.
12. Validate RSA minimum headlines/descriptions/finalUrls.
13. Mask secrets in DTO/log.
```

## 2. Integration tests

```text
1. Import valid ads_execution_plan.zip.
2. Reject zip có path traversal.
3. Reject missing action_plan.json.
4. Reject duplicate actionId.
5. Reject duplicate idempotencyKey đã executed.
6. provider validateOnly success.
7. provider validateOnly failed → không cho approve.
8. Approve với role sai → forbidden.
9. Execute unapproved action → blocked.
10. Execute khi production disabled → blocked.
```

## 3. E2E trên test account

```text
1. Test connection.
2. Sync accounts.
3. Export ads_live_export.zip.
4. Import plan create Search campaign.
5. Run provider validateOnly.
6. Approve ACT001.
7. Execute ACT001.
8. Sync lại.
9. Kiểm tra campaign PAUSED.
10. Kiểm tra ad group/keyword/RSA tồn tại.
11. Kiểm tra execution log.
```

## 4. Acceptance criteria

Hệ thống đạt MVP khi:

```text
1. Người dùng có thể chỉ dùng Codex để tải dữ liệu ads từ ERP.
2. Codex tải được ads_live_export.zip đầy đủ cấu trúc.
3. File export có expert_analysis_prompt.md.
4. ChatGPT Web trả được ads_execution_plan.zip.
5. Codex import được file này vào ERP.
6. ERP validate schema/business/provider.
7. Người dùng duyệt bằng lệnh trong Codex.
8. Codex gọi ERP approve/execute API.
9. ERP gọi Google Ads API, không phải Codex.
10. Campaign mới luôn PAUSED.
11. Budget update chỉ chạy khi có campaignBudgetId hợp lệ.
12. Không action nào chạy nếu chưa approve.
13. Retry cùng idempotencyKey không tạo trùng.
14. Execution log lưu đủ người duyệt, người execute, before/after, provider request ID và lỗi.
15. Sau execute, ERP sync lại và tạo evaluation sau 3/7 ngày.
```



---

<!-- FILE: 11_MARKETER_REVIEW_CHECKLIST.md -->

# 11 — Marketer Review Checklist

## 1. Trước khi upload lên ChatGPT Web

```text
[ ] Đã chọn đúng date range.
[ ] Data quality không có lỗi nghiêm trọng.
[ ] Có net_profit.
[ ] Có inventory.
[ ] Có change_log.
[ ] Có landing_pages.
[ ] Có order/profit attribution.
[ ] Có decision_rules.json.
[ ] Có expert_analysis_prompt.md.
```

## 2. Khi duyệt executive summary

```text
[ ] AI ưu tiên net_profit hơn revenue/ROAS.
[ ] AI không kết luận mạnh khi dữ liệu thiếu.
[ ] AI phân biệt campaign/ad group/keyword/RSA thắng thua rõ ràng.
[ ] AI có nêu rủi ro attribution.
[ ] AI có tự phản biện đề xuất.
```

## 3. Khi duyệt keyword

```text
[ ] Keyword đúng intent mua hàng.
[ ] Keyword không quá rộng.
[ ] Broad keyword có lý do rõ.
[ ] Có negative keyword nếu cần.
[ ] Match type hợp lý.
[ ] Không thêm quá nhiều keyword cùng lúc.
```

## 4. Khi duyệt RSA

```text
[ ] Có ít nhất 3 headline.
[ ] Có ít nhất 2 description.
[ ] Có final URL hợp lệ.
[ ] Không dùng câu quá cam kết.
[ ] Không dùng từ dễ vi phạm chính sách.
[ ] CTA rõ ràng.
[ ] Phù hợp landing page.
```

Ví dụ nên tránh:

```text
Cam kết 100% thành công
Nhanh nhất thị trường
Không cần điều kiện gì
Chắc chắn có giấy phép
```

Nên dùng:

```text
Tư vấn hồ sơ phù hợp
Hỗ trợ đúng quy trình
Trao đổi rõ chi phí và thời gian
Gọi để được tư vấn
```

## 5. Khi duyệt ngân sách

```text
[ ] Ngân sách/ngày không vượt policy.
[ ] Tăng ngân sách không vượt 20%/action.
[ ] Có đủ dữ liệu 3–7 ngày.
[ ] CPA/net_profit đủ tốt.
[ ] Sản phẩm/tồn kho đủ để scale.
```

## 6. Khi duyệt landing page

```text
[ ] Domain thuộc allowlist.
[ ] URL dùng HTTPS.
[ ] Nội dung khớp keyword.
[ ] CTA rõ.
[ ] Không cam kết quá mức.
[ ] Không sai chính sách.
```

## 7. Trước khi đưa file cho Codex

```text
[ ] Đã duyệt ý tưởng marketing.
[ ] File cuối tên ads_execution_plan.zip.
[ ] Mọi action approvalRequired=true.
[ ] Campaign mới status=PAUSED.
[ ] Không có delete action.
[ ] Không có auto_publish.
```

## 8. Trước khi execute

```text
[ ] ERP schema validation passed.
[ ] ERP business validation passed.
[ ] Provider validateOnly passed.
[ ] Người dùng chỉ định action ID rõ ràng.
[ ] Không execute toàn bộ plan nếu chưa cần.
[ ] Codex chỉ gọi ERP API.
```



---

<!-- FILE: 12_SECURITY_AND_SECRET_HANDLING.md -->

# 12 — Security & Secret Handling

## 1. Nguyên tắc

Không đưa secret thật vào:

```text
- ChatGPT Web
- Codex prompt
- Markdown docs
- Git
- Log
- API response
- Screenshot chia sẻ công khai
```

Secret gồm:

```text
GOOGLE_ADS_CLIENT_SECRET
GOOGLE_ADS_REFRESH_TOKEN
GOOGLE_ADS_DEVELOPER_TOKEN
ERP_INTERNAL_API_KEY
JWT_SECRET
API_TOKEN_SECRET
```

## 2. `.env.example`

```env
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=
GOOGLE_ADS_LOGIN_CUSTOMER_ID=
GOOGLE_ADS_API_VERSION=v24

API_TOKEN_SECRET=
ERP_INTERNAL_API_KEY=

AI_MARKETING_REQUIRE_APPROVAL=true
AI_MARKETING_DRY_RUN=true
AI_MARKETING_PROVIDER_EXECUTION_ENABLED=false
GOOGLE_ADS_PRODUCTION_ENABLED=false
```

## 3. Hardening bắt buộc

```text
1. Không lưu plaintext token.
2. Chỉ lưu encrypted token.
3. API response luôn mask secret.
4. Production fail startup nếu thiếu API_TOKEN_SECRET.
5. Không dùng fallback DEV_TOKEN_SECRET ở production.
6. Tách RBAC credential read/write.
7. Log không chứa Authorization header hoặc token.
```

## 4. Khi secret đã lộ

Nếu client secret/developer token đã xuất hiện trong ảnh hoặc chat:

```text
1. Recreate/reset secret trong Google Cloud Console.
2. Cập nhật secret mới trong .env/secret manager/ERP settings.
3. Xóa secret cũ khỏi DB nếu đã lưu.
4. Rotate refresh token nếu cần.
5. Kiểm tra log/Git history.
```

## 5. Mặc định môi trường an toàn

Giai đoạn MVP:

```env
AI_MARKETING_DRY_RUN=true
GOOGLE_ADS_PRODUCTION_ENABLED=false
AI_MARKETING_REQUIRE_APPROVAL=true
```

Chỉ bật live khi:

```text
- Credential đã kiểm tra.
- Developer token đủ quyền.
- Account đúng VND/timezone.
- RBAC đúng.
- validateOnly chạy ổn.
- Người dùng hiểu action cần execute.
```
