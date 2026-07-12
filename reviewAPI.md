# API Review Runbook (Facebook/Google/TikTok)

## 1) Mục tiêu
- Rà soát toàn bộ điểm gọi API nền tảng (Facebook, Google, TikTok), đặc biệt luồng token.
- So sánh implementation hiện tại với thay đổi mới từ tài liệu chính thức của nền tảng.
- Tạo patch tương thích, có kiểm thử và có phương án rollback.

## 2) Phạm vi trong codebase hiện tại
- Token lifecycle:
`backend/src/api-token/api-token.service.ts`
`backend/src/api-token/api-token.scheduler.ts`
`backend/src/api-token/schemas/api-token.schema.ts`
`backend/src/api-token/api-token.controller.ts`
- Facebook Ads + Messenger:
`backend/src/advertising-cost/advertising-cost.facebook-sync.service.ts`
`backend/src/chat-message/messenger-webhook.service.ts`
`backend/src/chat-message/messenger-webhook.controller.ts`
`backend/src/fanpage/schemas/fanpage.schema.ts`
- Google Ads + Google Sheets:
`backend/src/advertising-cost/advertising-cost.google-sync.service.ts`
`backend/src/google-sync/google-sync.service.ts`
`backend/src/order-sheet-sync/order-sheet-sync.service.ts`
- TikTok Ads:
`backend/src/advertising-cost/advertising-cost.tiktok-sync.service.ts`
- API health endpoint:
`backend/src/advertising-cost/advertising-cost.controller.ts` (`GET /advertising-cost/sync/health`)

## 3) Khi nào phải chạy review
- Có release/changelog mới từ Meta, Google Ads, TikTok Marketing API.
- Có lỗi tăng đột biến: `401`, `403`, `400`, `429`, `5xx`, token invalid/expired.
- Trước go-live lớn hoặc trước khi nâng version API (`FB_GRAPH_API_VERSION`, `GOOGLE_ADS_API_VERSION`).
- Theo lịch cố định hàng tuần (khuyến nghị 1 lần/tuần).

## 4) Nguồn đối chiếu chính thức
- Meta Graph API Changelog: `https://developers.facebook.com/docs/graph-api/changelog/`
- Meta Marketing API: `https://developers.facebook.com/docs/marketing-api/`
- Google Ads API Release Notes: `https://developers.google.com/google-ads/api/docs/release-notes`
- TikTok Marketing API Docs: `https://business-api.tiktok.com/portal/docs`

## 5) Biến môi trường trọng yếu cần kiểm tra
- Facebook:
`FB_ADS_ACCESS_TOKEN`
`FB_GRAPH_API_VERSION`
`FB_SYNC_FAILURE_ALERT_THRESHOLD`
`FB_APP_ACCESS_TOKEN`
`FACEBOOK_APP_TOKEN`
`MESSENGER_VERIFY_TOKEN`
`FB_VERIFY_TOKEN`
`AI_FB_SENDING_ENABLED`
`FB_SENDING_ENABLED`
- Google Ads:
`GOOGLE_ADS_API_VERSION`
`GOOGLE_ADS_REFRESH_TOKEN`
`GOOGLE_ADS_CLIENT_ID`
`GOOGLE_ADS_CLIENT_SECRET`
`GOOGLE_ADS_DEVELOPER_TOKEN`
`GOOGLE_ADS_LOGIN_CUSTOMER_ID`
- Google Sheets:
`GOOGLE_CREDENTIALS_JSON`
`GOOGLE_APPLICATION_CREDENTIALS`
`GOOGLE_SYNC_DISABLED`
- TikTok:
`TIKTOK_ACCESS_TOKEN`

## 6) Quy trình chuẩn cho AI
1. Tạo baseline:
   - Chụp trạng thái code và cấu hình hiện tại.
   - Ghi lại API version đang dùng và endpoint trọng yếu.
2. Quét callsite API/token:
   - Quét URL, headers, scope, cơ chế refresh/rotate token.
   - Quét fallback path (`env -> DB token -> failover`).
3. Tạo ma trận đối chiếu:
   - Mỗi callsite map với tài liệu mới nhất của nền tảng.
   - Đánh dấu `OK`, `Deprecated`, `Breaking`, `Needs migration`.
4. Phân tích rủi ro:
   - Cao: auth/token, webhook verify, endpoint bị remove.
   - Trung bình: field response đổi tên hoặc optional.
   - Thấp: warning/deprecation chưa có deadline gần.
5. Tạo patch thích nghi:
   - Ưu tiên backward-compatible.
   - Guard theo version hoặc feature flag nếu cần.
   - Chuẩn hóa xử lý lỗi `401/403/429` và retry có giới hạn.
6. Kiểm thử:
   - Chạy endpoint health.
   - Trigger sync thủ công theo từng nền tảng.
   - Xác nhận log và dữ liệu ghi xuống DB đúng.
7. Ghi biên bản review:
   - Lưu danh sách thay đổi, lý do, link tài liệu, ngày hiệu lực.

## 7) Lệnh quét nhanh (PowerShell)
```powershell
rg -n "facebook|graph\\.facebook|FB_|messenger|webhook|access_token" backend/src -S
rg -n "googleads\\.googleapis|GOOGLE_ADS_|googleapis|refresh_token|developer-token" backend/src -S
rg -n "tiktok|business-api\\.tiktok|TIKTOK_" backend/src -S
rg -n "api-token|tokenEnc|tokenHash|expireAt|lastCheckStatus|rotate|set-primary" backend/src/api-token -S
```

## 8) Lệnh verify sau khi sửa
```powershell
# Health đa nền tảng (qua API app)
GET /advertising-cost/sync/health

# Trigger sync thủ công
POST /advertising-cost/fetch/facebook?days=1
POST /advertising-cost/fetch/google?days=1
POST /advertising-cost/fetch/tiktok?days=1

# Kiểm tra token lifecycle
GET  /api-tokens
POST /api-tokens/:id/validate
POST /api-tokens/:id/rotate
POST /api-tokens/sync/from-fanpages
```

## 9) Mẫu báo cáo kết quả cho mỗi đợt review
| Platform | File | API/Token Contract | Current | Latest Doc | Risk | Action |
|---|---|---|---|---|---|---|
| Facebook | `advertising-cost.facebook-sync.service.ts` | `/insights` fields + token source | v19.0 | vX.Y | High/Med/Low | Keep/Patch |
| Google | `advertising-cost.google-sync.service.ts` | `searchStream` + OAuth refresh | v19 | vX | High/Med/Low | Keep/Patch |
| TikTok | `advertising-cost.tiktok-sync.service.ts` | `/report/integrated/get/` | v1.3 | vX | High/Med/Low | Keep/Patch |

## 10) Tiêu chí pass/fail
- Pass:
  - Không còn endpoint/field deprecated ở mức breaking.
  - `GET /advertising-cost/sync/health` trả trạng thái token và sync hợp lệ.
  - Sync manual 3 nền tảng chạy được hoặc fail có thông điệp rõ ràng do cấu hình.
- Fail:
  - Token không validate được nhưng không có fallback.
  - Endpoint chính thức đã đổi mà code vẫn hardcode cũ.
  - Không có kiểm thử lại sau patch.

## 11) Chính sách rollback nhanh
- Tách patch theo commit nhỏ theo từng nền tảng.
- Nếu lỗi production, rollback commit nền tảng bị lỗi trước, giữ các nền tảng còn lại.
- Dùng feature/env flag để tắt luồng sync bị lỗi thay vì dừng toàn hệ thống.

## 12) Prompt mẫu để giao AI chạy review
```text
Hãy chạy API compatibility review cho Facebook/Google/TikTok theo file reviewAPI.md.
Yêu cầu:
1) Quét toàn bộ callsite API + token trong backend/src.
2) Lập bảng so sánh với tài liệu chính thức mới nhất.
3) Liệt kê breaking risks theo mức độ.
4) Tạo patch code tương thích (ưu tiên backward-compatible).
5) Chạy verify bằng các endpoint health/sync liên quan.
6) Trả báo cáo gồm: file changed, lý do thay đổi, kết quả verify, rủi ro còn lại.
```

## 13) Tu dong hoa da duoc them
- Script local:
`scripts/review-api.ps1`
- Workflow CI:
`.github/workflows/api-review.yml`

Chay local:
```powershell
./scripts/review-api.ps1 -OutputDir reports/api-review-local
```

Chay local va so sanh version moi nhat:
```powershell
./scripts/review-api.ps1 `
  -OutputDir reports/api-review-local `
  -LatestFbGraphVersion v19.0 `
  -LatestGoogleAdsVersion v19 `
  -LatestTiktokApiVersion v1.3 `
  -Strict
```

Ket qua:
- `reports/api-review-local/api-review-report.md`
- `reports/api-review-local/api-review-summary.json`
- `reports/api-review-local/*-callsites.txt`
