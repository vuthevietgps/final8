# MÔ TẢ HỆ THỐNG SMARTERP (BẢN CHÀO BÁN)

## 1. Review hệ thống hiện tại (dựa trên codebase)

### 1.1 Kiến trúc và độ sẵn sàng
- Kiến trúc fullstack: `NestJS` (backend) + `Angular` (frontend) + `MongoDB`.
- Đã có cấu hình đóng gói và triển khai bằng `Docker` (`docker-compose.yml`, `docker-compose.prod.yml`).
- Có health check vận hành (`/health`, `/health/db`) và có cơ chế cronjob tự động.
- Quy mô hệ thống hiện tại:
  - 47 module backend.
  - 58 API controller.
  - 30 cronjob tự động hóa.

### 1.2 Các khối nghiệp vụ đã có
- Quản trị người dùng và phân quyền theo vai trò (JWT + RBAC): Director, Manager, Employee, Agent, Supplier.
- Vận hành đơn hàng:
  - Quản lý trạng thái sản xuất, giao hàng, đơn hàng.
  - Cập nhật đơn hàng, đồng bộ Google Sheets.
- Quản lý sản phẩm:
  - Nhóm sản phẩm, sản phẩm, media.
  - Báo cáo liên quan hình ảnh/media.
- Khối quảng cáo:
  - Tài khoản quảng cáo, nhóm quảng cáo, chi phí quảng cáo.
  - KPI nhân viên Ads, cảnh báo Ads, báo cáo lợi nhuận theo nhóm quảng cáo.
- Khối tài chính - dòng tiền:
  - Financial Control, funds, owner fund, loan management.
  - Công nợ nhà cung cấp, công nợ đại lý.
  - Báo cáo lợi nhuận ngày, lợi nhuận sản phẩm, báo cáo hàng hoàn.
- Khối AI và chat:
  - Fanpage, hội thoại, webhook Messenger, cấu hình OpenAI, API token.

### 1.3 Điểm mạnh để bán
- Một nền tảng duy nhất cho toàn bộ vận hành: đơn hàng + quảng cáo + chi phí + công nợ + báo cáo tài chính.
- Có phân quyền theo vai trò, phù hợp mô hình doanh nghiệp có nhiều bộ phận.
- Có cơ chế tự động hóa theo lịch (cron) để đồng bộ dữ liệu và tạo báo cáo.
- Có sẵn khả năng tích hợp API (Facebook/Google/TikTok, Google Sheets, Messenger).
- Sẵn sàng triển khai production bằng Docker, có health check và log rotation.

### 1.4 Điểm cần chốt scope khi bán
- Kết quả test tổng hợp gần nhất: 12 nhóm module, 11 PASS, 1 FAIL (`Net Profit & Ad Group`).
- Một số tính năng nâng cao trong khối tối ưu quảng cáo/dự báo tài chính đang ở trạng thái mở rộng (TODO), nên tách thành gói nâng cao để triển khai theo giai đoạn.
- Đề xuất bán giai đoạn 1 theo phạm vi "vận hành + tài chính cốt lõi", sau đó mở rộng module nâng cao.

---

## 2. Mục tiêu hệ thống (để sử dụng khi chào bán)

### 2.1 Mục tiêu tổng quát
Xây dựng nền tảng quản trị vận hành và tài chính tập trung cho doanh nghiệp kinh doanh online/phân phối, giúp chủ doanh nghiệp ra quyết định nhanh dựa trên dữ liệu thực tế, giảm thất thoát dòng tiền và tăng hiệu quả quảng cáo.

### 2.2 Mục tiêu kinh doanh
- Tập trung toàn bộ dữ liệu doanh thu, chi phí, công nợ và hiệu quả quảng cáo về một hệ thống.
- Rút ngắn thời gian lập báo cáo cho ban lãnh đạo từ nhiều giờ xuống theo ngày.
- Tăng tốc độ ra quyết định scale/stop chiến dịch quảng cáo dựa trên KPI và cảnh báo.
- Minh bạch hóa công nợ đại lý, nhà cung cấp và dòng tiền thực tế.

### 2.3 Mục tiêu vận hành
- Chuẩn hóa quy trình từ đơn hàng -> giao hàng -> doanh thu -> công nợ -> lợi nhuận.
- Chuẩn hóa phân quyền theo vai trò, giảm phụ thuộc vào trao đổi thủ công.
- Tự động hóa các tác vụ lặp lại: đồng bộ dữ liệu, tổng hợp KPI, cảnh báo rủi ro.
- Đồng bộ liên phòng ban: Vận hành, Ads, Kế toán, Quản lý.

### 2.4 Mục tiêu tài chính và kiểm soát rủi ro
- Theo dõi liên tục sức khỏe dòng tiền, mức độ rủi ro và ngưỡng cảnh báo.
- Kiểm soát ngân sách quảng cáo theo hiệu quả và khả năng chi trả.
- Quản trị quỹ owner, vay và cam kết chi trả theo mức ưu tiên.
- Hỗ trợ ban lãnh đạo quản lý "lãi thật - tiền thật" theo ngày/tuần/tháng.

### 2.5 Mục tiêu công nghệ và mở rộng
- Triển khai nhanh trên server qua Docker, dễ vận hành và bảo trì.
- Sẵn sàng kết nối các kênh dữ liệu ngoài (Ads platforms, Google Sheets, Messenger).
- Mở rộng theo giai đoạn: cốt lõi trước, AI/forecasting nâng cao sau.

---

## 3. Bộ KPI để chốt với khách (đề xuất)

- KPI 1: 100% dữ liệu vận hành cốt lõi được quản lý trên hệ thống trong giai đoạn 1.
- KPI 2: Giảm tối thiểu 50% thời gian tổng hợp báo cáo ngày cho cấp quản lý.
- KPI 3: 100% giao dịch công nợ đại lý/NCC mới được theo dõi có trạng thái.
- KPI 4: Có dashboard cảnh báo Ads và dòng tiền cập nhật theo chu kỳ đã cấu hình.
- KPI 5: Ban lãnh đạo có bộ báo cáo quyết định chuẩn hóa theo ngày/tuần/tháng.

---

## 4. Thông điệp chào bán ngắn gọn (có thể dùng trực tiếp)

SMARTERP là hệ thống quản trị tổng thể cho doanh nghiệp kinh doanh đa kênh, kết nối vận hành đơn hàng, quảng cáo, công nợ và tài chính trong một nền tảng duy nhất. Hệ thống giúp doanh nghiệp giảm thao tác thủ công, minh bạch dòng tiền, kiểm soát hiệu quả quảng cáo và ra quyết định nhanh dựa trên dữ liệu thời gian thực.
