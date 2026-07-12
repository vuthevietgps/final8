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
