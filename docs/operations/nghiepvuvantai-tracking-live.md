# nghiepvuvantai.com → Tracking CRM của ERP mới

## Triển khai 09/09/2026

Nguồn: container `nghiepvuvantai-com-web`, SQLite `/opt/websites/sites/nghiepvuvantai-com/database.db`. Lúc khảo sát có 269 dòng `ad_click_visits`, từ 25/08/2026 đến 09/09/2026; không có bảng `ad_visit_events` hoặc `ad_visit_orders`. Website public trả HTTP 200.

Đích: ERP mới cổng 8107, database `erp_next`. Nguồn được quản trị đăng ký dưới namespace `nghiepvuvantai-com-20260825`, giới hạn origin `https://nghiepvuvantai.com`. Host lịch sử được gắn theo database/container riêng của website, không suy ra từ IP. Tài khoản/campaign/adgroup được giữ làm bằng chứng URL thô; không tự gắn người bán, sản phẩm hay tài khoản Google Ads đã xác minh.

## Luồng dữ liệu

- Service `erp-next_tracking-worker` kiểm tra toàn bộ bảng theo từng trang 200 dòng mỗi 30 giây. Chỉ mount file database nguồn **read-only**, không sửa website hoặc SQLite nguồn.
- Fingerprint so sánh cả nội dung visit và counter nên nhận được tương tác muộn, kể cả `last_seen_at` không đổi. ACK lưu riêng trong volume `erp-next_tracking-state` sau khi ERP xác nhận batch.
- Batch tối đa 25 lượt từ worker, API giới hạn 50. `POST /api/tracking-ingest/visits` dùng khóa riêng trong Docker Secret `erp-next-tracking-ingest-v1`. Khóa không nằm trong website JavaScript, `.env`, Compose Env, log hoặc API response.
- ERP xác minh origin, enabled source, timestamp, IP, kiểu/giới hạn dữ liệu; dùng transaction và unique `(sourceId, externalVisitId)`. Lượt retry không nhân đôi. `observedAt` ngăn snapshot cũ ghi đè mới.
- Giữ nguyên bằng chứng lượt gốc và mọi thông tin tư vấn/đơn ERP. Chỉ cập nhật engagement snapshot; không cộng dồn lại counter đã nhận và không tạo lead/đơn tự động.
- IP mang `ipEvidenceTrust=collector_reported`. Chưa xác minh proxy collector đủ để coi IP là bằng chứng chống gian lận.

## Phạm vi dữ liệu thực sự có

Đã nối lượt truy cập quảng cáo, IP, landing, thời gian, click ID, campaign/adgroup thô và snapshot số lần xem/thời gian/độ cuộn/liên hệ/form. Màn Tracking hiện hiển thị lượt và nguồn; snapshot có trong trường `visit.engagement` của API.

Từ bản sửa 10/09/2026, CRM phân loại chuyển đổi từ hợp của sự kiện liên hệ và bộ đếm `contactActions > 0` / `formSubmits > 0`. Click là lượt không có bất kỳ bằng chứng chuyển đổi nào. Danh sách, tổng số, phân trang, bộ lọc loại/kênh và chi tiết hồ sơ dùng cùng quy tắc; dữ liệu cũ áp dụng ngay, không cần backfill hoặc cộng lại số lần. Page view, thời gian ở lại và cuộn trang không phải chuyển đổi.

Nguồn hiện không có lịch sử từng lần phone/Zalo/form, nên không dựng sự kiện hoặc thời điểm liên hệ từ counter. Counter liên hệ mang nhãn `Liên hệ`, không suy ra phone/Zalo. Bộ lọc theo **ngày chuyển đổi** chỉ khớp sự kiện có timestamp thật; để xem các chuyển đổi từ bộ đếm cũ theo ngày, chọn thời gian **Lượt vào trang**. Lịch sử và chọn sự kiện đối chiếu chỉ chứa sự kiện thật. Muốn nối lịch sử liên hệ chi tiết cần nâng cấp collector website ở bước riêng. Chuyển đổi liên hệ không đồng nghĩa với đơn hàng hoặc chuyển đổi được Google Ads xác nhận.

Đây là connector quét snapshot có ACK, **chưa phải transactional outbox tại nguồn**. Nếu nguồn xóa bản ghi trước khi worker từng đọc được thì không phục hồi được. Worker hỗ trợ journal SQLite DELETE hiện tại; nếu chuyển WAL thì dừng báo lỗi để cấu hình lại mount/snapshot, không đọc thiếu dữ liệu WAL. Nếu fork/khởi tạo lại database website, phải đăng ký namespace mới.

## Kiểm tra và vận hành

Kết quả triển khai: 269 lượt có sẵn đã vào ERP; đối chiếu số lượng và hash của toàn bộ tập externalVisitId giữa SQLite nguồn và MongoDB đích khớp chính xác. Đã truy cập website public bằng click ID có tiền tố `ERP_TRACKING_TEST_`, nhận cookie/tracker và xác nhận đúng lượt xuất hiện qua API Tracking CRM sau chu kỳ worker. Lượt thử đã được dọn ở cả hai phía bằng khóa chính xác, không tạo hồ sơ CRM/đơn hàng. API ingest không có khóa trả 401. Backend readiness và website đều healthy; worker trở lại trạng thái không có thay đổi ở chu kỳ kế tiếp.

Kiểm thử: 4 test ingest (gồm 2 integration Mongo), 3 test worker đều PASS; regression Tracking CRM: 46 PASS, 2 integration skip trong lượt regression vì đã chạy riêng. Build image và stack config PASS. Mã sửa tập trung ở module `backend/src/tracking-crm`, worker/config trong `deploy/erp-next`; frontend không đổi.

```powershell
$env:TRACKING_TEST_MONGO='true'
npm.cmd --prefix backend test -- --runInBand tracking-ingest.spec.ts
python deploy/erp-next/test-tracking-worker.py
npm.cmd --prefix backend test -- --runInBand tracking-crm
docker build -f deploy/erp-next/Dockerfile.tracking -t htxbachgia/backend:20260909-tracking .
```

Integration Mongo dùng database tạm `erp_tracking_test_*` trên loopback 27019, tự dọn đúng database đó. Kiểm tra DTO/giới hạn, origin, disabled source, idempotency, snapshot đến muộn, giữ nguyên IP và không tạo CRM lead. Test worker kiểm tra lỗi mạng không ACK, retry thành công, scan không đổi và counter cập nhật muộn.

Image derivative chỉ thay `/app/dist/tracking-crm` của image ERP đã chạy, không thay các module nghiệp vụ khác hoặc frontend.

## Sửa phân loại chuyển đổi — 10/09/2026

- Image đang triển khai: `htxbachgia/backend:20260910-conversion`. Bản cấu hình trước cập nhật: `/home/admin-001/erp-next/stack.before-conversion-20260910.yml`; image trước đó `htxbachgia/backend:20260909-tracking` được giữ để rollback.
- Thay đổi: `tracking-conversion.ts` hợp bằng chứng sự kiện và snapshot; `tracking-list.query.ts` áp dụng trước lọc/đếm/phân trang và trả engagement; `tracking-crm.service.ts` áp dụng cùng quy tắc khi mở hồ sơ. Frontend hiện có đã hiển thị `interactionKind` và `conversionTypes` nên không cần đổi bundle.
- Jest Tracking CRM: 48 PASS; 6 bài integration được chạy riêng cùng validation, kết quả 10/10 PASS (4 integration phân loại + 2 integration ingest + 4 unit/validation). Nest build và Docker build PASS.
- Kiểm tra trực tiếp lúc khoảng 21:24 giờ VN: 269 lượt thật = **14 lượt chuyển đổi + 255 lượt chỉ click**. Nguồn có 21 lần bấm liên hệ trên 14 lượt; không lấy 21 làm số khách hoặc số lượt chuyển đổi.
- Chạy `pwsh -NoProfile -File scripts/verify-live-tracking-conversion.ps1 -ProbeWebsite`: tạo lượt quảng cáo kiểm chứng, xác nhận ban đầu `click`; gọi collector với contact/form, chờ đồng bộ, xác nhận `conversion`, đủ hai nhãn và counter 1/1, không còn trong bộ lọc click. Dọn đúng lượt thử cả nguồn/đích; kiểm tra lại số liệu trở về 269/14/255. Phép thử này xác minh collector → worker → API CRM, không mô phỏng trình duyệt bấm nút hoặc xác nhận chuyển đổi Google Ads.
- Readiness backend HTTP 200; trang login/Tracking CRM, website public và ERP cũ HTTP 200; cả 4 service 1/1, worker rejected=0. Không thay database/website nguồn, không tạo sự kiện lịch sử giả hoặc đơn hàng.

Kiểm tra chỉ đọc số liệu thật: `pwsh -NoProfile -File scripts/verify-live-tracking-conversion.ps1`. Tùy chọn `-ProbeWebsite` tạo rồi xóa lượt thử được đánh dấu, không gọi điện/gửi thông tin tư vấn.

```sh
docker stack services erp-next
docker service logs --tail 10 erp-next_tracking-worker
```

Log worker chỉ có số lượng `sent`, `unchanged`, `rejected`, thời điểm thành công hoặc loại lỗi; không có dữ liệu khách. Health worker yêu cầu scan thành công trong 180 giây và không có dòng bị từ chối. Kiểm tra backend `/health/ready` trong container và màn `/tracking-crm` bằng quyền giám đốc/nhân viên.

Để tạm dừng đồng bộ: `docker service scale erp-next_tracking-worker=0`. Dữ liệu đã nhập vẫn giữ nguyên. Để khôi phục: scale lên 1; worker dùng ACK riêng và đối chiếu lại các dòng còn ở nguồn. Không xóa volume dữ liệu hoặc sửa ERP cũ ở cổng 8090.
