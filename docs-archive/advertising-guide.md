# Hướng dẫn chức năng Quảng cáo

## Tổng quan luồng dữ liệu
- Token BM/Facebook (ApiToken) -> Đồng bộ chi phí qua Facebook Marketing API -> Lưu `advertising_cost` (spentAmount, impressions, clicks, messaging metrics) theo `adGroupId` + ngày.
- Đơn hàng (`TestOrder2`) lưu `adGroupId` -> Đồng bộ sang `Summary4` (đã truyền `adGroupId`) -> (cần pipeline sang `Summary5` để báo cáo lợi nhuận/ROAS theo nhóm QC).
- Báo cáo cost-per-order (`ad-report`) ghép chi phí quảng cáo với đơn hàng theo `adGroupId` + ngày.

## Menu & chức năng
1) **Tài khoản quảng cáo**
   - Quản lý tài khoản (Facebook) và trạng thái kích hoạt.
   - Cần bật `isActive` để job đồng bộ chi phí chạy.
2) **Nhóm quảng cáo (Ad Group)**
   - Quản lý adset/adGroupId, gắn với tài khoản quảng cáo.
   - Phải bật `isActive` và chọn `adAccountId` hợp lệ để đồng bộ chi phí.
3) **Chi phí quảng cáo (Advertising Cost)**
   - CRUD chi phí theo `adGroupId`, ngày, spentAmount, CPM, CPC, impressions, clicks, reach, messaging metrics.
   - Upload Excel Facebook: `POST /advertising-cost/upload-facebook-excel` (field `file`).
   - Đồng bộ Facebook thủ công: `POST /advertising-cost/fetch/facebook?date=YYYY-MM-DD&days=N` (N mặc định 1); hoặc theo danh sách tài khoản `POST /advertising-cost/fetch/facebook/by-accounts` body `{ accounts: ["act_123"], date?: "2024-12-08", days?: 3, cleanup?: false }`.
   - Thống kê nhanh: `/advertising-cost/stats/summary`, `/advertising-cost/stats/by-adgroup?adGroupId=...`, `/advertising-cost/stats/conversation-cost?adGroupId=...`, `/advertising-cost/stats/conversation-cost/daily?adGroupId=...&date=YYYY-MM-DD`.
4) **Token BM / Api Token**
   - Lưu token Facebook; ưu tiên dùng env `FB_ADS_ACCESS_TOKEN`, fallback token `provider=facebook`, `status=active`, `lastCheckStatus=valid`.
   - Có thể đặt `isPrimary` để ưu tiên; hỗ trợ token mã hoá (`tokenEnc`).
5) **Báo cáo chi phí / ROAS**
   - API `GET /ad-report/cost-per-order` (trong service `AdReportService`) ghép chi phí và đơn để tính cost-per-order theo `adGroupId` + ngày.
   - Báo cáo lợi nhuận theo nhóm QC lấy từ `Summary5` (cần đảm bảo pipeline nạp dữ liệu).

## Quy trình sử dụng nhanh (UI)
- Vào menu **Tài khoản quảng cáo**: tạo tài khoản Facebook, bật `isActive`.
- Vào **Nhóm quảng cáo**: khai báo `adGroupId` (adset id), chọn tài khoản vừa tạo, bật `isActive`.
- Vào **Chi phí quảng cáo**:
  1. Đồng bộ: bấm nút "Sync Facebook" (hoặc gọi API fetch) để kéo chi phí theo ngày; kiểm tra cột spentAmount, impressions.
  2. Hoặc nhập tay / upload Excel: chọn file, gửi, sau đó kiểm tra danh sách.
  3. Dùng filter theo tài khoản để xem đúng adGroupId.
  4. Kiểm tra tổng chi phí và cost per conversation (hệ thống đếm hội thoại inbound đầu tiên theo `adGroupId`).
- Đơn hàng: khi tạo `TestOrder2` cần điền `adGroupId` để gắn doanh thu vào nhóm QC.
- Báo cáo: dùng endpoints thống kê hoặc màn hình báo cáo (Summary5/Ad Group Profit) sau khi pipeline Summary5 được nạp.

## Lưu ý kỹ thuật
- Chi phí được chuẩn hoá ngày về 00:00:00 UTC; frontend nhập mm/dd/yyyy và convert sang ISO.
- Index duy nhất `(adGroupId, date)` trong `advertising_cost` tránh trùng ngày.
- Quyền truy cập: bảo vệ bởi `JwtAuthGuard` + `RolesGuard`, permission `advertising-costs`.
- Đồng bộ Facebook bỏ qua nhóm không active hoặc tài khoản không active.

## Việc cần hoàn thiện thêm
- Kích hoạt pipeline nạp `Summary5` từ `Summary4` + `AdvertisingCost` để báo cáo ROAS/lợi nhuận theo nhóm QC không bị rỗng.
- Backfill `Summary4` và `Summary5` sau khi gắn `adGroupId` cho đơn hàng cũ.
