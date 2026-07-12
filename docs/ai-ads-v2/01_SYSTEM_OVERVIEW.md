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
