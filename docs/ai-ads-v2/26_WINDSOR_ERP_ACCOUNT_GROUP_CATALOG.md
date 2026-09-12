# Windsor → tài khoản và nhóm quảng cáo ERP

## Phạm vi

Luồng Windsor Google hiện có được mở rộng để đưa danh mục đã đọc vào `adaccounts` và `adgroups`. Chưa bổ sung bộ đọc Windsor Facebook. Chỉ những tài khoản đã chọn trong kết nối được kiểm tra quyền truy cập mới được xử lý. Nhóm cần có dòng tài nguyên do Windsor trả về; không suy đoán các nhóm chưa xuất hiện trong dữ liệu nguồn.

Các module dùng lại: `WindsorAdsReadService`, `WindsorAdsCostSyncService`, `ProviderConnectionsModule`, schema/service của `AdAccount`, `AdGroup` và màn Angular tương ứng. Module mới `WindsorAdsCatalogService` chỉ đọc MongoDB, không gọi Google Ads hoặc Windsor.

## Luồng sử dụng

1. Cấu hình Windsor Google, chọn tài khoản, kiểm tra quyền truy cập.
2. Chọn **Đồng bộ 7 ngày trọn vẹn**. Cùng một luồng đọc tạo/cập nhật danh mục trước khi ghi chi phí và cập nhật các báo cáo tài chính. Tác vụ đồng bộ hàng ngày cũng chạy bước danh mục này.
3. Màn **Tài Khoản Quảng Cáo** có tài khoản gắn nhãn Windsor; chọn người phụ trách tài khoản.
4. Màn **Nhóm Quảng Cáo** có nhóm liên kết đúng tài khoản; chọn **Gắn sản phẩm / người phụ trách**. Modal chỉ có hai lựa chọn, không bắt nhập Fanpage hay đại lý.
5. Các lần đồng bộ tiếp theo giữ nguyên sản phẩm, danh mục suy ra từ sản phẩm, người phụ trách tài khoản/nhóm, ghi chú, ngân sách ERP và cấu hình điều khiển nội bộ. Có thể bỏ gắn sản phẩm/người phụ trách; bỏ sản phẩm cũng xóa danh mục suy ra.

Tài khoản đã được Windsor xác nhận nhưng chưa phát sinh chi phí vẫn có thể được tạo từ danh sách tài khoản đã kiểm tra. Tên/tiền tệ/múi giờ lấy từ tài nguyên khi có; không đánh dấu token Google trực tiếp đã được xác thực. Trạng thái nguồn của nhóm nằm ở `remoteStatus`; `isActive` là cờ quản lý ERP, được khởi tạo theo trạng thái nguồn và giữ nguyên ở lần đồng bộ sau.

## Dữ liệu đã lưu và lỗi

- Khi khởi động ERP, danh mục đã lưu của các kết nối đang bật và đã kiểm tra được bổ sung tự động.
- Có thể chạy lại tại màn Kết nối bằng **Đưa dữ liệu đã lưu vào tài khoản / nhóm**, gọi `POST /provider-connections/:id/ads-catalog-sync` với quyền `google-ads.read`. Không phát sinh lượt gọi nhà cung cấp.
- Tài nguyên thuộc lần đọc thất bại hoặc tài khoản có lỗi trong lần đọc một phần bị bỏ qua, kèm mã `RESOURCE_READ_NOT_COMPLETE`. Không ghi đè metadata tốt bằng tài nguyên có thể đã được ghi dở.
- Nếu một nhóm không có mặt trong lần đọc mới thì giữ lại bản ghi; không tự xóa nhóm, không xóa chi phí.
- ID hiện được đánh unique toàn ERP. Nếu trùng ID khác nền tảng/tài khoản/chiến dịch/kết nối, trả xung đột, không tự chuyển liên kết. ID tài khoản Google dạng `123-456-7890` được đối chiếu với `1234567890`; nếu cả hai cùng tồn tại thì báo xung đột.
- Kết quả đồng bộ trả `catalog.status`, `accounts`, `groups`, `conflicts` và hiển thị ở màn kết nối. Số lượng là bản ghi đã đối chiếu/cập nhật, không phải chỉ bản ghi mới.
- Lỗi riêng bước danh mục không chặn bước cập nhật tài chính. Có thể chạy lại từ kho đã lưu sau khi xử lý lỗi. Không thay đổi chính sách ghi đè chi phí Windsor.

Các trường `sourceSystem`, `sourceConnectionId`, `sourceLastSeenAt` lưu nguồn gốc riêng. API CRUD chặn đổi định danh nguồn và xóa tài khoản/nhóm đã liên kết Windsor. Không tạo campaign, không sửa trạng thái/ngân sách trên nền tảng; auto-control/webhook của nhóm mới mặc định tắt.

## Kiểm tra

```powershell
cd backend
npm run build
npx jest --runInBand --runTestsByPath src/provider-connections/windsor-ads-cost-sync.service.spec.ts src/provider-connections/provider-connections.permissions.spec.ts src/provider-connections/windsor-ads-read.service.spec.ts src/advertising-cost/advertising-cost.list.spec.ts
node scripts/verify-windsor-catalog-local.cjs
cd ../frontend
npm run build
```

Script Mongo yêu cầu replica set cục bộ `erp-local-ledger` tại `127.0.0.1:27027`. Tạo database kiểm thử có tên riêng, kiểm tra host/database/replica set trước khi chạy và chỉ dọn database đó. Kiểm tra tạo danh mục, liên kết account/group, gắn và bỏ gắn qua service ERP thật, đồng bộ lặp, bảo toàn trường nội bộ, lỗi đọc một phần, xung đột ID, tài khoản ngoài phạm vi, không xóa khi thiếu dữ liệu và cấu hình bị tắt/chưa kiểm tra. Dữ liệu kiểm thử là giả lập, không dùng credentials và không gọi nhà cung cấp.
