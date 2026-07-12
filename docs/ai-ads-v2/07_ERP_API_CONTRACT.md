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
