# Tracking: IP, lượt truy cập và khách tiềm năng

## Form nhân viên và đơn chính thức — 08/09/2026

Form nhập nhanh: tên, điện thoại, nhu cầu/ghi chú, `contactedAt`, `contactChannel`, `nextFollowUpAt` và trạng thái. Báo giá, đại lý, NCC và thông tin nhận đơn được thu gọn. Bộ lọc cơ bản có thời gian/landing/trạng thái; bộ lọc nâng cao giữ IP, account/campaign/adgroup, nguồn, sản phẩm/đại lý, mức đối chiếu, lịch hẹn, kênh thực tế. Các nút lọc nhanh giữ các điều kiện nguồn/ngày đang chọn.

`timeField=visit|conversion|contact` chọn loại thời gian cho from/to (UTC+7). Khi lọc chuyển đổi theo ngày và kênh, cùng một event phải khớp cả hai. `confidence=unknown|approximate|verified`, `followUp=due|upcoming|none`, `contactChannel` lọc trên dữ liệu CRM trước phân trang. Lịch đến hẹn/sắp tới chỉ xét hồ sơ đang tư vấn.

Nhân viên có thể chọn `matchedEventId` trong lịch sử lượt đang mở. Backend xác minh event thuộc đúng source/visit và là một sự kiện liên hệ; yêu cầu thời gian, kênh liên hệ và bằng chứng khi chọn. `matchConfidence` là mức đánh giá do nhân viên nhập, không phải thuật toán bảo đảm danh tính. Hiện đối chiếu là chọn thủ công trong lượt đang mở, chưa có hệ thống tự xếp hạng ứng viên giữa nhiều lượt. Lịch sử đang giới hạn 100 sự kiện gần nhất.

Nút **Tạo đơn chính thức · OrderTest2** chỉ mở cho hồ sơ đã chốt và đã lưu; backend vẫn kiểm tra báo giá/định danh trước khi tạo. Sau khi có liên kết thật, bảng hiển thị Đơn chính thức; thay đổi trạng thái đơn xử lý ở OrderTest2. Thông tin IP, source, tài khoản/campaign/adgroup gốc trên visit được giữ độc lập với đối chiếu của nhân viên. Chưa có luồng gửi IP để Windsor chặn; trước bước đó phải xác minh tài khoản Ads đích và đi qua cơ chế thực thi ERP, không suy ra tài khoản chỉ từ IP hoặc dùng nhóm đã sửa tay làm nguồn gốc của IP.

Danh sách lấy từ `tracking_crm_visits`, không yêu cầu có hồ sơ `tracking_crm_leads`. Một IP có thể xuất hiện ở nhiều lượt truy cập và nhiều khách. Khóa chống nhập trùng lượt truy cập vẫn là `sourceId + externalVisitId`; khóa sự kiện là `sourceId + externalEventId`. IP và adGroupId không phải khóa khách hàng.

GET `/api/tracking-crm` trả `{ items, total, page, pageSize }`. Bộ lọc áp dụng trước phân trang: `search`, `ip` chính xác, `landing`, `from/to` (ngày theo UTC+7), `provider`, `account/campaign/adGroup` từ bằng chứng lượt truy cập, `sourceId`, `agentId/productId/categoryId` từ hồ sơ đã đối chiếu, `status` (new/noted/confirmed/cancelled), `type`, `conversion`, `order`. Trang 25/50/100 dòng. Không tải toàn bộ lịch sử vào bảng; lịch sử tải khi mở phần chi tiết, tối đa 100 sự kiện gần nhất. Bộ đếm/phân loại chuyển đổi xét toàn bộ sự kiện liên hệ của lượt truy cập.

Mở lượt truy cập chỉ đọc dữ liệu. Lưu lần đầu qua POST `/visits/:id/lead` tạo hồ sơ riêng; unique visitId ngăn hai nhân viên tạo trùng. PATCH hồ sơ sử dụng version. Nhân viên phải xác nhận khách đã chốt, chọn nhóm ads/đại lý/sản phẩm/NCC và có bằng chứng đối chiếu trước khi chuyển OrderTest2. Nút chuyển gọi POST `/:id/promote`; backend kiểm tra trạng thái và báo giá, dùng TestOrder2Service.create để tính giá. Khóa `ordertest2.trackingLeadId` unique ngăn tạo lại cùng hồ sơ khi thử lại. Liên kết đơn đã có vẫn kiểm tra đầy đủ danh tính quảng cáo và đại lý. Đồng bộ sau đó chỉ cập nhật thông tin khách/ghi chú.

Angular ứng dụng dùng zoneless. Component phải `markForCheck()` sau tác vụ bất đồng bộ để trạng thái tải/lưu cập nhật ngay. Danh mục tải độc lập và được dùng lại trong phiên màn hình; mở hồ sơ không chờ API danh mục hoặc lịch sử.

Kiểm tra tại thư mục backend:

```powershell
npm run build
npm test -- --runInBand tracking-crm
node --require ./scripts/local-ledger-guard.cjs scripts/tracking-crm-local-demo.cjs
node scripts/verify-tracking-local.cjs
```

Tại frontend: `npm run build`. Script kiểm tra tích hợp chỉ dùng MongoDB/API loopback của bản demo đang chạy. Nó tạo 260 lượt truy cập và 5.200 sự kiện, kiểm tra lọc/phân trang ngoài 200 dòng, tạo hồ sơ, cấm chuyển khách chưa chốt, báo giá đúng đại lý và chuyển đơn lặp. Dữ liệu kiểm tra có namespace riêng và được dọn trong finally. Seeder giữ các lượt mẫu IP để thử trực tiếp.

Tại gốc repo: `node scripts/verify-tracking-ui.cjs` chạy Chromium riêng với bản local, kiểm tra đăng nhập qua nút demo, lọc IP, mở hồ sơ không phát sinh request, tải lịch sử khi cần và lưu ghi chú cập nhật ngay cả bảng lẫn drawer trong Angular zoneless. Script dọn lượt/hồ sơ kiểm thử riêng và chụp `.local-ledger/tracking-ui.png`. Nó không đọc hay điều khiển phiên trình duyệt của người dùng.

Trước triển khai server: tạo/kiểm tra các index khai báo trong TrackingVisitSchema và TestOrder2Schema, đặc biệt `order_tracking_lead_unique`; rà soát các khóa tham chiếu CRM cũ có kiểu chuỗi trước khi chuyển sang ObjectId. Nếu tiến trình dừng đột ngột giữa thao tác chuyển đơn, cần kiểm tra đơn theo trackingLeadId và gỡ operationLock của hồ sơ sau đối chiếu; không tạo đơn thay thế thủ công. Các landingpage/collector thật chưa được nối bởi thay đổi này. Số lượt IP không tự chứng minh click quảng cáo hợp lệ hoặc gian lận.
