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
