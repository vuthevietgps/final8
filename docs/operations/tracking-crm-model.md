# Tracking & CRM — model dữ liệu và màn hình local

> Cập nhật 08/09/2026: mô tả màn hình 200 hồ sơ và chưa có nút tạo đơn bên dưới là lịch sử phase trước. Hiện danh sách lấy mọi visit, lọc/phân trang trên server và có nút chuyển khách đã chốt qua TestOrder2Service. Xem [trạng thái và kiểm thử hiện tại](../tracking-crm-local-verification.md). Thiết kế kết nối dữ liệu IP/hành vi từ Ladifinal nằm tại [Ladifinal IP tracking integration](ladifinal-ip-tracking-integration.md); connector này chưa được triển khai.

## Cập nhật: màn hình nội bộ và đối chiếu đại lý

Đã có route `/tracking-crm` trong menu Đơn hàng, API nội bộ có JWT, permission
orders-test2, role director/manager/employee và feature gate test-order2.
Danh sách giới hạn 200 hồ sơ gần nhất; tìm kiếm/lọc trên số hồ sơ đã tải.

Lead bổ sung agentId, snapshot tên/role đại lý, supplierId, orderDate và danh tính
ads đã resolve từ selectionKey. assignedTo vẫn là nhân viên phụ trách, độc lập
với agentId. Không tự suy ra đại lý từ IP hoặc chỉ từ ID nhóm quảng cáo.

Có thể lưu ghi chú, chọn đại lý/nhóm ads, xem trước báo giá bằng chính
OrderCalculationService, liên kết đơn đã có và cập nhật tên khách/người nhận/
địa chỉ/điện thoại/ghi chú qua TestOrder2Service. Không chuyển giá bán, cọc, COD
hoặc giá vốn ghi chú vào đơn. Đại lý ngoài lấy doanh thu dự kiến theo báo giá đại lý;
chênh lệch tiền hàng chưa bao gồm ads/ship/hoàn/chi phí chung và chưa là lợi nhuận
ghi nhận. Không có nút tự tạo đơn ở phase này.

Liên kết/cập nhật từ CRM yêu cầu khớp agentId, productId, supplierId và danh tính
ads trên đơn. Hồ sơ đã liên kết khóa sửa các định danh, ngày đơn và số lượng tại
CRM. Operation lock + __v ngăn xử lý đồng thời trên cùng hồ sơ. Nếu tiến trình
chết giữa thao tác, giữ lock để đối chiếu thủ công trước khi mở lại; không tự hết
hạn lock rồi gửi lại khi chưa biết đơn đã được cập nhật chưa.

Khởi chạy local sau khi build cả backend/frontend:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local-ledger.ps1
# Từ backend:
node --require ./scripts/local-ledger-guard.cjs scripts/tracking-crm-local-demo.cjs
```

Mở `http://127.0.0.1:4300/__local/tracking`. Script chỉ kết nối database local đã
định danh; giữ dữ liệu mẫu bằng upsert và kiểm tra hai đại lý có hai báo giá khác
nhau, chặn truy cập không đăng nhập, liên kết/cập nhật đơn mẫu và chặn sai đại lý.
Không có collector public, cấu hình secret, tự nhận đại lý từ landing, import
dữ liệu cũ hay cơ chế tạo đơn tự động. Các bước đó vẫn theo hợp đồng bên dưới.

### Cập nhật giao diện hộp thư tracking

Bảng chính tập trung vào dữ liệu thu được: Landingpage, Nhóm sản phẩm, Thời gian,
Loại (Click/Chuyển đổi), Loại chuyển đổi và trạng thái đã tạo OrderTest2.
Sự kiện phone/zalo/inbox/form/contact được tính là chuyển đổi; page view/scroll/
heartbeat chỉ là click hoặc hành vi. Nút Mở dùng dữ liệu visit/events/link đã tải
theo batch trong response danh sách, không gọi lại detail API nên mở tức thời.

Tracking CRM vẫn là collection riêng chứa cả khách tiềm năng. Trạng thái “Đã tạo
OrderTest2” chỉ lấy từ TrackingOrderLink có orderId thật; trạng thái CRM confirmed
không tự biến thành đơn và không tự ghi nhận lợi nhuận.

## Nền model (phase 1)

Module NestJS `TrackingCrmModule` được đăng ký trong AppModule, export Mongoose models.
Đăng ký model không đồng nghĩa dữ liệu landing đã được kết nối. Nguồn mới mặc định disabled.

Tái sử dụng NestJS/Mongoose và tham chiếu User, Product, TestOrder2. Customer hiện
tại là dữ liệu khách đã mua được trích xuất từ đơn; không dùng nó thay cho lead tư vấn.
Bước tích hợp đơn sẽ dùng TestOrder2Service và AdsAttributionOptionsService hiện có.

## Collections và quan hệ

| Model | Vai trò | Khóa chống trùng |
|---|---|---|
| TrackingSource | Namespace ổn định của một collector/database Ladifinal; danh sách origin được phép | sourceKey |
| TrackingVisit | Lượt truy cập, landing, thời gian và bằng chứng ads thô | sourceId + externalVisitId |
| TrackingEvent | Lịch sử sự kiện liên hệ/hành vi | sourceId + externalEventId |
| TrackingLead | Hồ sơ khách, ghi chú, số tiền dự kiến, người đối chiếu | visitId |
| TrackingOrderLink | Liên kết hồ sơ với đơn ERP và phiên bản CRM đã đồng bộ | leadId; orderId |

Một nguồn có nhiều visits. Event nối visit bằng cặp sourceId + externalVisitId;
cặp này cũng cho phép tiếp nhận sự kiện đến trước visit ở phase connector.
Một visit có tối đa một hồ sơ CRM trong MVP. Một lead liên kết tối đa một đơn;
một đơn có một lead nguồn chính để không đếm doanh thu nhiều lần. Nhiều lần ghé
của cùng khách được giữ riêng; không tự ghép theo IP/số điện thoại. Mô hình đa điểm
chạm hoặc nhiều đơn trên một lead cần phase riêng.

`occurredAt` là giờ phát sinh tại nguồn, `receivedAt` là giờ ERP nhận. Lưu UTC,
giao diện hiển thị Asia/Ho_Chi_Minh. Bằng chứng visit và event bất biến.
Không lưu URL query đầy đủ, payload tự do hoặc plaintext credential. IP mặc định
không được select. allowedOrigins là cấu hình, chưa phải cơ chế xác thực.

Lead dùng __v và optimisticConcurrency; writer tương lai phải dùng save() với
kiểm tra version hoặc compare-and-set tương đương, không PATCH bất chấp phiên bản.
Chọn confirmed cần có matchMethod, matchedBy, matchedAt và matchEvidence.
confirmed chỉ là xác nhận CRM, không ghi nhận doanh thu hay xác nhận đã thu tiền.

## Mapping Ladifinal khi kết nối sau này

- `ad_click_visits.visit_token` → externalVisitId. Không dùng ID số hàng, IP hay click ID làm khóa visit.
- `ad_visit_events.id` → externalEventId ổn định, ví dụ `legacy-event:123`, trong namespace nguồn.
- Collector mới phải tạo UUID event trước lần gửi đầu tiên và giữ nguyên khi retry.
- occurred_at → occurredAt; landing_name/path → landingName/landingPath; hostname
  phải lấy từ cấu hình nguồn tin cậy hoặc đối chiếu allowlist.
- click_id/type, campaign_id, ad_group_id, keyword → ads evidence. campaign_id
  cũ có thể là tên utm_campaign; không mặc định coi là Google campaign ID hợp lệ.
- ad_visit_orders → lead: customer_name, recipient_name, phone, shipping_address,
  sale_total, deposit, cod_amount, supplier_cost, notes tương ứng các trường model.
  supplier_cost → supplierCostNote. updated_by phải ánh xạ sang User ERP; không
  ép ID SQLite thành ObjectId. Hồ sơ confirmed cũ thiếu bằng chứng cần hàng chờ
  đối chiếu/import exception; không bịa bằng chứng để vượt validation.
- Dữ liệu cũ chỉ có tổng số hành động: giữ bản xuất gốc khi migration, không dựng
  các event/giờ liên hệ giả. Thiết kế import bổ sung trước khi chuyển dữ liệu thật.
- Nếu nhiều deployment dùng cùng database thì dùng chung namespace nguồn; nếu
  database độc lập thì dùng sourceKey khác nhau dù visit/event token trùng nhau.

## Hợp đồng tích hợp bắt buộc ở phase tiếp theo

1. Collector gửi server-to-server có xác thực, chống replay, giới hạn kích thước/
   tốc độ và retry bền vững. ERP lấy sourceId từ danh tính connector, không tin
   sourceId do browser tự khai. Browser không giữ bí mật connector.
2. Upsert bằng compound key; retry payload cũ là no-op. Cùng key nhưng nội dung
   bất biến khác phải báo conflict. Không ghi đè ghi chú ERP khi nguồn gửi lại.
3. Kiểm tra timestamp, host/path, event value (scroll 0–100), source enabled và
   quan hệ nguồn. Không tin dữ liệu tracking công khai là chứng cứ chốt đơn.
4. API CRM có đăng nhập/phân quyền, actor lấy từ session và audit lịch sử sửa.
   Schema reference không tự đảm bảo record tồn tại hoặc quyền truy cập.
5. Nút Lưu ghi chú không tạo đơn. Tạo đơn / Liên kết đơn / Cập nhật sang OrderTest2
   phải xem trước các trường thay đổi và dùng nghiệp vụ TestOrder2Service.
6. Cần cơ chế idempotency/transaction cho toàn bộ create-order + link, không chỉ
   index link: lỗi giữa hai bước không được để retry tạo đơn mồ côi/trùng.
7. Trước khi áp nguồn ads vào đơn, resolve provider/account/campaign/ad group qua
   AdsAttributionOptionsService. Thiếu/không rõ mapping thì giữ chờ đối chiếu;
   không đoán account hoặc chuyển thành non_ads để lách validation.
8. saleTotal → retailSaleAmount, deposit → depositAmount, codAmount → codAmount;
   recipientName/phone/shippingAddress → receiverName/receiverPhone/receiverAddress.
   Không coi phone khách mặc định là phone người nhận nếu thực tế khác nhau;
   cần xác nhận ở form tạo đơn. supplierCostNote chỉ để tham khảo, không ghi đè
   snapshot báo giá. Tiền chưa biết để undefined; 0 là số 0 thực sự. Không tự tính COD.
9. ERP là nguồn chuẩn trạng thái đơn, thu tiền, giá vốn, lợi nhuận. Không đồng bộ
   ngược ghi chú cancelled thành hủy đơn đã giao hay sửa số tài chính đã khóa.
10. Không có TTL tự xóa bằng chứng kinh doanh. Thiết kế retention theo hồ sơ/link,
    phân quyền dữ liệu cá nhân và audit trước khi vận hành collector.

## Kiểm chứng và triển khai

Chạy từ backend:

```powershell
npm test -- --runInBand tracking-crm.schema.spec.ts
npm run build
```

Test offline kiểm tra validation và khai báo indexes, không chứng minh MongoDB đã
tạo index. Trước mở connector trên server cần migration tạo/kiểm tra các indexes
từ schemas trên database đích, test tích hợp gửi lại/out-of-order/cross-source,
đồng thời sửa/xung đột phiên bản và lỗi giữa tạo đơn với tạo link. Không gọi API Ads.
