# Khảo sát kỹ thuật chức năng quản lý Google Ads qua API

Ngày khảo sát: 2026-06-11  
Phạm vi: đọc code hiện tại và cung cấp dữ liệu đầu vào để viết tài liệu kỹ thuật/triển khai module quản lý Google Ads trong ERP.

## 1. Kết luận nhanh

Hệ thống hiện tại đã có nền tảng đủ tốt để phát triển chức năng quản lý Google Ads:

- Backend: NestJS 11, TypeScript, REST API.
- Frontend: Angular 20.
- Database: MongoDB/Mongoose.
- Đã có cấu hình OAuth/Developer Token/MCC, đồng bộ chi phí Google Ads bằng GAQL `searchStream`, mapping tài khoản và ad group, dashboard lợi nhuận, action plan, duyệt, execution log và đánh giá sau hành động.
- Đã có code Google Ads mutate để đổi campaign budget và pause/resume ad group.

Tuy nhiên hệ thống chưa có module quản lý đầy đủ tài nguyên Google Ads:

- Chưa tạo/sync metadata Google campaign, campaign budget, keyword, responsive search ad.
- Chưa import `ads_action_plan.zip`.
- Chưa có Google-specific action schema và executor cho create campaign/ad group/keyword/RSA.
- Live apply từ AI Marketing đang bị khóa bằng `AI_MARKETING_PROVIDER_EXECUTION_ENABLED = false`.
- Google ad group discovery/sync metadata chưa có; module discovery hiện chỉ hỗ trợ Facebook.

Khuyến nghị MVP: **Search Ads + luôn cần duyệt**, tái sử dụng luồng `ads_action_plans` hiện có, chỉ cho phép:

1. Sync account/campaign/ad group/keyword/RSA.
2. Tạo Search campaign ở trạng thái `PAUSED`.
3. Tạo ad group, keyword và responsive search ad.
4. Đổi campaign budget.
5. Pause/resume campaign hoặc ad group.
6. Đọc báo cáo và đánh giá hiệu quả.

## 2. Trả lời trực tiếp 12 câu hỏi trong file yêu cầu

| Câu hỏi | Kết quả khảo sát hệ thống |
|---|---|
| 1. ERP dùng ngôn ngữ/framework gì? | Node.js/TypeScript. Backend NestJS 11; frontend Angular 20. |
| 2. Database gì? | MongoDB Atlas qua Mongoose 8. |
| 3. Đã có bảng sản phẩm/đơn hàng/lợi nhuận/quảng cáo chưa? | Có `products`, `ordertest2`, `adaccounts`, `adgroups`, `advertisingcosts`, báo cáo lợi nhuận và action plans. Chưa có collection Google campaign/keyword/ad riêng. |
| 4. Nên bắt đầu loại Google Ads nào? | Search Ads. Phù hợp nhất với schema/action plan hiện tại và phạm vi MVP an toàn. |
| 5. Hệ thống hiện được phép làm gì? | Đã đọc chi phí/metrics; đã có code đổi budget và pause/resume ad group. Chưa có create campaign/ad group/keyword/RSA. Live apply AI Marketing đang khóa. |
| 6. Có Google Ads Manager/MCC không? | Code và UI hỗ trợ MCC. Tài liệu hiện có khai báo MCC `4345552613`, nhưng cần xác minh trạng thái live với chủ tài khoản. |
| 7. Đã có developer token/OAuth/refresh token chưa? | Có màn hình/API lưu và test. File `backend/.env` hiện không khai báo các biến Google Ads; credential có thể đang nằm trong DB nhưng chưa được xác minh khi khảo sát code. |
| 8. Ngân sách tối đa/ngày? | AI Marketing đang hard-code `10,000,000` làm max daily budget. Từng ad group có `spendThresholdDaily` tùy chọn. Cần chuyển thành policy cấu hình. |
| 9. Mỗi lần tăng ngân sách tối đa bao nhiêu? | +20%. Giảm tối đa -30% trong AI Marketing. Auto scale còn có +15% trong learning phase. |
| 10. Có bắt buộc người duyệt trước khi chạy thật không? | Luồng AI Marketing có duyệt và live apply đang tắt. Tuy nhiên `AdGroupAutoControlService` vẫn có thể tự pause remote mỗi 10 phút nếu bật `autoControlEnabled`; cần thống nhất policy. |
| 11. Landing page lấy từ đâu? | Hiện có `creative_assets.landingPage` và `products.resourceLink`, nhưng không có product-page URL chuẩn. MVP nên dùng landing page nhập tay/Creative Asset đã duyệt. |
| 12. ERP đã tính `net_profit` chưa? | Có `netProfit` và `realizedNetProfit` trên đơn hàng; có báo cáo theo ad group/ngày; Marketing Lead cũng có revenue/grossProfit/netProfit. |

## 3. Kiến trúc và thành phần hiện có

### 3.1 Kiến trúc ứng dụng

```text
Angular internal ERP
    |
    | JWT + RBAC + REST /api/*
    v
NestJS backend
    |
    +-- MongoDB/Mongoose
    +-- Google OAuth qua package googleapis
    +-- Google Ads API qua REST/axios
    +-- Cron pipeline đồng bộ ads và tính lại lợi nhuận
```

Global API prefix là `/api`. Các route ví dụ:

- `/api/api-tokens/*`
- `/api/ad-accounts/*`
- `/api/ad-groups/*`
- `/api/advertising-cost/*`
- `/api/ai-marketing/*`

### 3.2 Module có thể tái sử dụng

| Module | Vai trò hiện tại | Khả năng tái sử dụng |
|---|---|---|
| `api-token` | Lưu/test OAuth, developer token, MCC, refresh token | Tái sử dụng sau khi sửa bảo mật và tách quyền |
| `ad-account` | Mapping ERP với Google customer ID, `loginCustomerId`, MCC mode | Tái sử dụng |
| `ad-group` | Mapping ad group với sản phẩm, nhân sự, account, budget | Tái sử dụng làm business mapping; không nên dùng thay toàn bộ Google resource snapshot |
| `advertising-cost` | Sync cost/metrics theo ngày và ad group | Tái sử dụng, cần mở rộng metrics |
| `ad-group-profit-report` | Revenue, ads spend, net profit, ROI theo ad group | Tái sử dụng |
| `ai-marketing` | Plan, approve/reject, dry-run/apply, execution log, evaluation | Nền tảng chính cho approval/execution |
| `advertising-optimization` | Provider adapter đổi budget/pause/resume | Tách thành Google Ads adapter chuẩn hóa |
| `inventory` | `onHand` theo sản phẩm | Dùng làm gate tồn kho |

### 3.3 Luồng dữ liệu hiện tại

```text
Google Ads GAQL searchStream
    -> advertisingcosts
    -> phân bổ advertisingCost vào ordertest2 theo adGroupId + ngày
    -> tính grossProfit/netProfit
    -> ad group daily report / profit report / AI Marketing plan
```

Cron thực tế:

- 06:00 Asia/Ho_Chi_Minh: pipeline chung sync Facebook + Google + TikTok, tính lại order và daily report.
- Tài liệu/UI cũ ghi Google 06:15 nhưng hàm 06:15 hiện không có decorator cron; chỉ là fallback thủ công.

## 4. Dữ liệu hiện có so với dữ liệu cần cho Google Ads

| Dữ liệu | Trạng thái | Vị trí |
|---|---|---|
| `product_id` | Có | `products._id`, `adgroups.selectedProducts[]`, `ordertest2.productId` |
| `order_id` | Có | `ordertest2._id` |
| `customer_id` Google Ads | Có | `adaccounts.accountId`, `advertisingcosts.customerId` |
| `login_customer_id` | Có | `adaccounts.loginCustomerId`, Google system settings |
| `campaign_id` | Có một phần | `adgroups.campaignId`, `marketing_leads.campaignId`, `creative_assets.campaignId` |
| `campaign_budget_id` | Có một phần | `adgroups.campaignBudgetId` |
| `ad_group_id` | Có | `adgroups.adGroupId`, orders/cost/leads |
| `ad_id` | Có một phần | `marketing_leads.adId`, `creative_assets.adId` |
| `creative_id` | Có | `creative_assets.creativeId`, `marketing_leads.creativeId` |
| `keyword/criterion_id` | Chưa có | Cần collection mới |
| `revenue` | Có | Lead, profit report; order dùng COD/collected values |
| `gross_profit` | Có | `ordertest2.grossProfit`, Lead |
| `net_profit` | Có | `ordertest2.netProfit`, `realizedNetProfit`, Lead |
| `stock` | Có | `inventorysummaries.onHand`; product có `minStock`/`maxStock` |
| landing page | Có một phần | `creative_assets.landingPage`, `products.resourceLink` |

Vấn đề khóa định danh hiện tại:

- `adgroups.adGroupId` đang unique toàn hệ thống và order chỉ lưu `adGroupId`.
- Thiết kế Google nên dùng resource name/cặp khóa `customerId + resourceId`, không giả định ID provider là khóa toàn cục.
- `adgroups.fanpageId` đang bắt buộc kể cả Google, không đúng ngữ nghĩa và gây khó khi import Google ad group.

## 5. Google Ads API hiện đã triển khai

### 5.1 Authentication/configuration

Hệ thống hỗ trợ:

- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- `GOOGLE_ADS_API_VERSION`

Nguồn ưu tiên hiện tại: env trước, DB sau. UI `/ads-settings` có thể lưu và test cấu hình MCC.

API version mặc định trong code là `v24`. Tại ngày khảo sát 2026-06-11, v24 là major version hiện hành; release notes Google đã có v24.1.

### 5.2 Reporting

`AdvertisingCostGoogleSyncService` gọi:

```text
POST https://googleads.googleapis.com/v24/customers/{customerId}/googleAds:searchStream
```

GAQL hiện lấy:

- `segments.date`
- `ad_group.id`
- `metrics.cost_micros`
- `metrics.impressions`
- `metrics.clicks`
- `metrics.average_cpc`
- `metrics.average_cpm`
- `metrics.conversions`

Metrics được lưu vào `advertisingcosts`.

Điểm cần sửa: `metrics.conversions` hiện bị map sang `messagingConversationStarted7d`. Với Google Ads cần field riêng như `conversions`, `allConversions`, `conversionsValue`, `costPerConversion`.

### 5.3 Mutate hiện có

Đã có code:

- Đổi campaign budget qua `customers/{customerId}/googleAds:mutate`.
- Pause/resume ad group qua `customers/{customerId}/adGroups:mutate`.

Chưa có code:

- Create/update/pause campaign.
- Create ad group từ Google.
- Create/update/remove keyword.
- Create/update/remove responsive search ad.
- Asset/asset group/PMax.
- Sync change history.

## 6. Các gap và rủi ro phải xử lý trước khi bật live

### P0 - Bảo mật và an toàn tiền

1. `ApiToken` vẫn lưu trường `token` plaintext; `saveGoogleAdsSettings()` ghi cả plaintext và encrypted token.
2. `crypto.util.ts` dùng fallback key cố định `DEV_TOKEN_SECRET` nếu thiếu `API_TOKEN_SECRET`. File `.env` hiện không khai báo `API_TOKEN_SECRET`.
3. Quyền hiện tại quá rộng: Director và Manager đều có `api-tokens` và `ai-assistant`; chưa tách quyền xem, lập kế hoạch, duyệt, thực thi và quản lý credential.
4. `AdGroupAutoControlService` có thể tự pause Google ad group không qua approval nếu bật `autoControlEnabled`.
5. Không có idempotency key/concurrency version để ngăn retry tạo trùng campaign hoặc ghi đè thay đổi mới hơn.

### P0 - Tính đúng của budget và tiền tệ

1. `applyGoogleBudget()` fallback budget ID theo thứ tự:

```text
campaignBudgetId || campaignId || adGroupId
```

Không được phép fallback sang campaign/ad group ID khi mutate CampaignBudget. Bắt buộc phải có `campaignBudgetId` đã xác minh.

2. Code nhân `newBudget * 1,000,000` và coi giá trị ERP là currency unit của Google account. Nếu account không phải VND, toàn bộ chi phí/lợi nhuận và budget sẽ sai.
3. Hệ thống kiểm tra timezone UTC+7 nhưng chưa enforce `currencyCode = VND`.

### P1 - Dữ liệu và mapping

1. Chưa sync metadata Google account/campaign/ad group/budget.
2. Google ad group discovery hiện chưa có; discovery/import chỉ gọi Facebook API.
3. Chưa có keyword, RSA, criterion, policy approval status và provider resource name.
4. Chưa có campaign-level/ad-level/keyword-level daily metrics.
5. Chưa có `request-id`, provider error details, partial failure details và remote change history chuẩn hóa.

### P1 - Luồng duyệt và thực thi

1. AI Marketing có action plan nhưng action type chỉ gồm budget, pause/resume và task nội bộ.
2. `AI_MARKETING_PROVIDER_EXECUTION_ENABLED = false` đang hard-code, không phải policy/env.
3. Chưa có bước validate provider bằng `validateOnly` trước khi duyệt/thực thi.
4. Chưa có rollback/compensating action rõ ràng.
5. Chưa có nguyên tắc “mọi campaign mới phải tạo ở trạng thái PAUSED”.

### P2 - Tài liệu và test

1. Tài liệu cron 06:15 không khớp code cron 06:00.
2. Test hiện chủ yếu kiểm tra CRUD/masked settings/fake credential failure; chưa có contract test cho payload Google mutate và idempotency.
3. Chưa có test account integration suite cho create Search campaign end-to-end.

## 7. Quyết định thiết kế đề xuất cho MVP

### 7.1 Phạm vi

MVP chỉ hỗ trợ **Search campaign**.

Action được phép:

- Sync/read account, campaign, campaign budget, ad group, keyword, RSA và metrics.
- Create campaign budget.
- Create Search campaign ở trạng thái `PAUSED`.
- Create ad group.
- Create keyword: `EXACT`, `PHRASE`, `BROAD`.
- Create responsive search ad.
- Update campaign budget.
- Pause/resume campaign và ad group.

Ngoài phạm vi MVP:

- Performance Max, Shopping, Display, Demand Gen, Video.
- Tự động publish hoàn toàn.
- Tự động đổi bid strategy.
- Customer Match/offline conversion upload.

### 7.2 Approval policy

- Mọi create/update/pause/resume đều tạo pending action trước.
- Chỉ role/quyền `google-ads.approve` được duyệt.
- Chỉ `google-ads.execute` được chạy mutate.
- Create campaign luôn `PAUSED`; bật campaign là một action duyệt riêng.
- Auto pause không qua duyệt chỉ được dùng như emergency kill switch và phải ghi audit log.

### 7.3 Landing page

MVP dùng:

1. `creative_assets.landingPage` đã duyệt, hoặc
2. URL nhập tay đã qua allowlist/domain validation.

Không lấy mặc định từ product vì hệ thống chưa có product page URL chuẩn.

## 8. Kiến trúc mục tiêu đề xuất

```text
ChatGPT/nhân viên tạo đề xuất
    -> import/submit typed action plan
    -> server-side schema validation
    -> business-rule validation
    -> Google Ads validateOnly/dry-run
    -> pending approval
    -> approver xác nhận
    -> execution worker gọi Google Ads API
    -> execution log + request-id + provider response
    -> metadata/metrics sync lại
    -> đánh giá hiệu quả sau 3/7 ngày
```

Không thực thi trực tiếp raw payload do ChatGPT tạo. ERP phải tự build provider operations từ typed actions đã được validate.

Đề xuất module backend:

```text
backend/src/google-ads-management/
  google-ads-management.module.ts
  google-ads-management.controller.ts
  google-ads-query.service.ts
  google-ads-mutate.service.ts
  google-ads-sync.service.ts
  google-ads-action-plan.service.ts
  google-ads-policy.service.ts
  google-ads-audit.service.ts
  dto/
  schemas/
```

## 9. Collection/schema cần bổ sung

### 9.1 `google_ads_campaigns`

```json
{
  "customerId": "1234567890",
  "resourceName": "customers/1234567890/campaigns/111",
  "campaignId": "111",
  "campaignBudgetId": "222",
  "name": "Search - Product A",
  "status": "PAUSED",
  "advertisingChannelType": "SEARCH",
  "biddingStrategyType": "MAXIMIZE_CONVERSIONS",
  "currencyCode": "VND",
  "startDate": "2026-06-12",
  "endDate": null,
  "internalProductId": "ObjectId",
  "lastSyncAt": "Date",
  "remoteVersion": "string"
}
```

Unique index: `{ customerId: 1, campaignId: 1 }`.

### 9.2 `google_ads_ad_groups`

Provider snapshot riêng, có optional link tới `adgroups._id`.

```json
{
  "customerId": "1234567890",
  "campaignId": "111",
  "adGroupId": "333",
  "resourceName": "customers/1234567890/adGroups/333",
  "name": "High intent",
  "status": "ENABLED",
  "cpcBidMicros": 0,
  "internalAdGroupId": "ObjectId",
  "lastSyncAt": "Date"
}
```

### 9.3 `google_ads_keywords`

```json
{
  "customerId": "1234567890",
  "campaignId": "111",
  "adGroupId": "333",
  "criterionId": "444",
  "resourceName": "customers/1234567890/adGroupCriteria/333~444",
  "text": "tu khoa mua hang",
  "matchType": "PHRASE",
  "negative": false,
  "status": "ENABLED",
  "lastSyncAt": "Date"
}
```

### 9.4 `google_ads_ads`

```json
{
  "customerId": "1234567890",
  "campaignId": "111",
  "adGroupId": "333",
  "adId": "555",
  "resourceName": "customers/1234567890/adGroupAds/333~555",
  "status": "PAUSED",
  "type": "RESPONSIVE_SEARCH_AD",
  "headlines": [],
  "descriptions": [],
  "finalUrls": [],
  "policySummary": {},
  "creativeAssetId": "ObjectId",
  "lastSyncAt": "Date"
}
```

### 9.5 Mở rộng `ads_action_plans`

Giữ collection hiện có nhưng bổ sung typed Google actions:

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
```

Mỗi item cần thêm:

```json
{
  "provider": "google",
  "customerId": "1234567890",
  "resourceType": "campaign",
  "resourceName": null,
  "operation": "create",
  "typedPayload": {},
  "idempotencyKey": "sha256...",
  "expectedRemoteVersion": null,
  "validationStatus": "pending",
  "validationErrors": [],
  "providerRequestId": null
}
```

### 9.6 `google_ads_daily_metrics`

Lưu metrics đa cấp thay vì ép mọi dữ liệu vào `advertisingcosts`:

```text
customerId
date
level: campaign | ad_group | ad | keyword
campaignId
adGroupId
adId
criterionId
cost
impressions
clicks
conversions
conversionValue
averageCpc
costPerConversion
currencyCode
```

## 10. API nội bộ đề xuất

Tất cả nằm dưới `/api/google-ads`.

### Connection và discovery

```text
GET  /connection/health
GET  /accounts
POST /accounts/:customerId/sync
GET  /accounts/:customerId/campaigns
GET  /accounts/:customerId/ad-groups
GET  /accounts/:customerId/keywords
GET  /accounts/:customerId/ads
```

### Action plan

```text
POST  /action-plans/import
POST  /action-plans
GET   /action-plans
GET   /action-plans/:planId
POST  /action-plans/:planId/validate
PATCH /action-plans/:planId/items/:itemId/approve
PATCH /action-plans/:planId/items/:itemId/reject
POST  /action-plans/:planId/execute
GET   /action-plans/:planId/executions
```

### Reporting

```text
GET /reports/performance
GET /reports/change-history
GET /reports/sync-runs
```

## 11. Chuẩn import action plan đề xuất

Có thể nhận `ads_action_plan.zip`, nhưng:

- `action_plan.json` là nguồn dữ liệu chuẩn duy nhất.
- CSV chỉ dùng để người đọc kiểm tra/export.
- Không thực thi trực tiếp `api_execution_queue.jsonl`.
- ERP tự dựng mutate payload từ `action_plan.json`.

```text
ads_action_plan.zip
├── manifest.json
├── action_plan.json
├── creative_variants.csv
├── keyword_plan.csv
├── validation_rules.json
└── executive_summary.md
```

`manifest.json` tối thiểu:

```json
{
  "schemaVersion": "1.0",
  "planId": "PLAN-20260611-001",
  "generatedAt": "2026-06-11T10:00:00+07:00",
  "generator": "chatgpt-web",
  "targetProvider": "google",
  "hashes": {}
}
```

Server phải kiểm tra:

- Zip size/file count/path traversal.
- MIME/extension.
- JSON schema.
- Hash từng file.
- Duplicate `action_id`.
- Customer/account allowlist.
- URL allowlist.
- Headline/description/keyword constraints.
- Ngân sách và inventory/cashflow rule.

## 12. Business rules mặc định đề xuất

```json
{
  "requireHumanApproval": true,
  "createCampaignInitialStatus": "PAUSED",
  "maxDailyBudgetPerCampaign": 10000000,
  "maxDailyBudgetAllGoogleAccounts": null,
  "maxBudgetIncreasePercentPerAction": 20,
  "maxBudgetDecreasePercentPerAction": 30,
  "minActiveBudget": 50000,
  "minNetProfitLookbackDays": 3,
  "minNetProfitToScale": 0,
  "doNotScaleIfStockBelowProductMinStock": true,
  "pauseIfNegativeProfitDays": 3,
  "requireCurrencyCode": "VND",
  "requireTimezone": "Asia/Ho_Chi_Minh",
  "executeOnlyAfterProviderValidation": true
}
```

Các số này phải chuyển từ hard-code sang collection/config có version và audit.

## 13. RBAC đề xuất

```text
google-ads.read
google-ads.plan
google-ads.approve
google-ads.execute
google-ads.credentials.read
google-ads.credentials.write
google-ads.emergency-pause
```

Gợi ý:

- Employee Ads: read + plan.
- Manager: read + plan + approve.
- Director: toàn bộ, gồm execute và credentials.
- Emergency pause: quyền riêng, mọi thao tác phải có reason và audit.

## 14. Kế hoạch triển khai

### Giai đoạn 0 - Hardening

- Không lưu plaintext token.
- Bắt buộc `API_TOKEN_SECRET`/secret manager; fail startup nếu thiếu ở production.
- Tách RBAC.
- Xóa fallback sai `campaignBudgetId || campaignId || adGroupId`.
- Enforce currency VND hoặc bổ sung conversion.
- Thống nhất approval với auto-pause.

### Giai đoạn 1 - Read-only và metadata

- Sync Google account/campaign/budget/ad group/keyword/RSA.
- Google discovery/mapping UI.
- Metrics riêng cho conversions và đa cấp tài nguyên.
- Sync run/change history/audit.

### Giai đoạn 2 - Action plan + approval

- Import typed plan.
- Validate schema/business rules/provider.
- UI duyệt từng item.
- Dry-run và idempotency.

### Giai đoạn 3 - Live mutate giới hạn

- Create Search campaign ở `PAUSED`.
- Create ad group/keyword/RSA.
- Update budget.
- Pause/resume.
- Re-sync và đánh giá sau hành động.

## 15. Tiêu chí nghiệm thu tối thiểu

1. Credential không xuất hiện plaintext trong API response, log hoặc DB document mới.
2. Không action nào chạy live nếu chưa approved.
3. Retry cùng `idempotencyKey` không tạo trùng resource.
4. Create campaign luôn bắt đầu `PAUSED`.
5. Budget mutate chỉ chạy khi có `campaignBudgetId` hợp lệ.
6. Currency/timezone mismatch bị block.
7. Provider validation lỗi thì không cho approve/execute.
8. Execution log lưu action, người duyệt, người chạy, before/after, request ID và lỗi provider.
9. Sync lại xác nhận remote state sau mutate.
10. Test account chạy được end-to-end: budget -> campaign -> ad group -> keyword -> RSA.

## 16. Các thông tin chủ hệ thống vẫn phải xác nhận

1. MCC `4345552613` có đúng và đang hoạt động không?
2. Developer token đang ở Test Access hay Standard Access?
3. Credential đang lưu trong DB hay chưa cấu hình?
4. Các Google customer account đều dùng VND và UTC+7 không?
5. Ai có quyền approve và ai có quyền execute?
6. Có cho emergency auto-pause không?
7. Max tổng ngân sách/ngày cho toàn bộ Google accounts?
8. CPA/ROAS/net-profit/tồn kho tối thiểu?
9. Domain landing page được phép?
10. Có cần import conversion từ ERP lên Google không? Nếu có, cần thiết kế riêng và xem xét Data Manager API.

## 17. File code chính đã đối chiếu

- `backend/src/advertising-cost/advertising-cost.google-sync.service.ts`
- `backend/src/advertising-optimization/ai-optimization/budget-apply.service.ts`
- `backend/src/ad-group/ad-group.auto-control.service.ts`
- `backend/src/ad-group/ad-group.sync.service.ts`
- `backend/src/ad-account/schemas/ad-account.schema.ts`
- `backend/src/ad-group/schemas/ad-group.schema.ts`
- `backend/src/advertising-cost/schemas/advertising-cost.schema.ts`
- `backend/src/api-token/api-token.service.ts`
- `backend/src/api-token/schemas/api-token.schema.ts`
- `backend/src/api-token/crypto.util.ts`
- `backend/src/ai-marketing/ai-marketing.service.ts`
- `backend/src/ai-marketing/schemas/ads-action-plan.schema.ts`
- `backend/src/ai-marketing/schemas/ads-action-execution-log.schema.ts`
- `backend/src/test-order2/schemas/test-order2.schema.ts`
- `backend/src/product/schemas/product.schema.ts`
- `backend/src/inventory/schemas/inventory-summary.schema.ts`
- `backend/src/finance/data-collection.service.ts`
- `backend/src/auth/role-permissions.ts`
- `frontend/src/app/features/ads-settings/ads-settings.component.ts`
- `frontend/src/app/features/ai-marketing/ai-marketing.component.ts`

## 18. Tài liệu Google chính thức dùng để đối chiếu

- Release notes: https://developers.google.com/google-ads/api/docs/release-notes
- API versions/sunset: https://developers.google.com/google-ads/api/docs/sunset-dates
- OAuth overview: https://developers.google.com/google-ads/api/docs/oauth/overview
- API structure/mutate: https://developers.google.com/google-ads/api/docs/concepts/api-structure
- Create campaigns: https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns
- Create ads/RSA: https://developers.google.com/google-ads/api/docs/ads/create-ads
- Partial failures: https://developers.google.com/google-ads/api/docs/best-practices/partial-failures

