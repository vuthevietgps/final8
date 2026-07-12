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
