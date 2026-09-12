# Kiểm thử bản chụp giá, giao/hoàn, quyền sở hữu và xuất lại hàng

Ngày kiểm tra: 04/09/2026. Chỉ mã nguồn local; không triển khai, không kết nối database cũ.

**Kết quả sau sửa: 6 suites, 47/47 bài đạt; backend `npm run build` thành công.** Trong đó 41 bài thuộc giá/giao/hoàn/kho và 6 bài kiểm tra tổng hợp tài chính. Không có kiểm thử MongoDB thật hay trình duyệt trong lượt này.

## Phạm vi và cách kiểm tra

Các bài chạy service TypeScript thật: OrderCalculationService, OrderShipmentService, ReturnRequestService, InventoryService và bộ tổng hợp BusinessLedger. Model database, lưu đơn, sự kiện và transaction được mô phỏng theo từng suite. Bài về chọn giá kiểm tra điều kiện truy vấn và hành vi giữ snapshot; không chứng minh thao tác chọn/sắp xếp báo giá trên Mongo thật trong lượt này.

Các module có sẵn trên được tái sử dụng, không tạo bộ tính giá hay lợi nhuận thứ hai trong test.

| Nhóm | Các tình huống kiểm tra |
|---|---|
| Bản chụp | Giá NCC/đại lý và phí không đổi theo bảng giá cập nhật; giá 0 hợp lệ; giá sản phẩm dự phòng không giả làm báo giá đã duyệt; kho dùng giá vốn lô cũ; điều kiện báo giá đúng trạng thái duyệt và thời điểm đơn |
| Từng lần giao | Ghi nhận đại lý trước khi khách cuối nhận; gửi lại yêu cầu không nhân đôi lần giao; gián đoạn xuất kho có thể tiếp tục; chặn sửa lô ngầm lúc xuất |
| Phí hoàn | Dùng phí thực tế; phí công ty trả và phí thu đại lý độc lập; sửa phí lần giao trước có lịch sử; không bán lại tiền hàng khi điều chỉnh phí; không tạo phí hoàn nếu chưa hoàn |
| Chủ hàng/nơi giữ | Hàng đại lý giữ tại công ty vẫn thuộc đại lý; không cộng vào tồn thuộc công ty; không xuất hàng của đại lý khác; bên gửi phải đúng nơi giữ; nơi hoàn mặc định theo bên gửi nhưng có thể chỉ định rõ nơi khác |
| Nhận hoàn | Giá trị thu hồi không vượt giá vốn; hàng độc bản không nhập thành hàng bán lại; tiêu hủy không phục hồi giá vốn; nhận từng phần; chặn vượt số lượng; xử lý phiếu lặp không nhập tồn hai lần; lỗi ghi kho không phát sự kiện hoàn tất |
| Xuất lại | Chặn giao lại khi chưa thực nhận đủ hàng; hàng của đại lý giao lại không tăng doanh thu tiền hàng/giá vốn lần hai; giữ phí giao/hoàn cũ và cộng phí lần mới |
| Tổng hợp | Giữ nghĩa vụ NCC khi thu hồi tài sản; lợi nhuận theo đơn/sản phẩm/đại lý/nhóm ads cộng khớp; không nhân đôi phí lúc bán lẻ chuyển từ đang giao sang thành công |

## Lỗi tái hiện và sửa

Lần chạy trước sửa: 39 bài, 37 đạt và 2 thất bại do lỗi nghiệp vụ, không phải lỗi biên dịch/test harness.

1. **Lô xuất khác lô trên đơn nhưng giá vốn không đổi.** Đơn chụp giá vốn 120.000; yêu cầu xuất chọn lô khác giá 50.000 được chấp nhận, giá vốn trên đơn vẫn 120.000. Sửa `OrderShipmentService.create`: lần xuất đầu phải khớp lô và nguồn đã chọn trên đơn. Muốn đổi lô cần cập nhật nguồn hàng trên đơn trước để tính lại giá vốn/giữ chỗ. Quy tắc này không cản chọn lô hàng hoàn ở lần giao lại.
2. **Đổi bên nhận hoàn vẫn kế thừa địa chỉ bên gửi.** Ví dụ NCC gửi nhưng chọn hoàn về công ty, địa chỉ cũ của NCC vẫn được chép vào. Sửa: chỉ mặc định địa chỉ bên gửi khi bên nhận có cùng loại và cùng định danh; giữ địa chỉ nhận được nhập rõ, xóa định danh bên ngoài khi nơi nhận là công ty. Kiểm tra thêm trường hợp NCC A gửi nhưng NCC B nhận hoàn.

## Tệp thay đổi trong lượt này

- Sửa nghiệp vụ: `backend/src/test-order2/services/order-shipment.service.ts`.
- Mở rộng kiểm thử: `backend/src/test-order2/services/order-shipment.service.spec.ts`.
- Thêm: `backend/src/test-order2/services/order-price-snapshot.regression.spec.ts`.
- Thêm: `backend/src/return-request/return-request.business.spec.ts`.
- Thêm: `backend/src/inventory/inventory.ownership.spec.ts`.
- Chạy lại các kiểm thử supplier-approval và operational-projection có sẵn.

## Lệnh tái hiện

Chạy từ `backend`, guard loại bỏ cấu hình môi trường cũ và chặn kết nối ngoài phạm vi local riêng:

```powershell
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent src/test-order2/services/order-price-snapshot.regression.spec.ts src/test-order2/services/order-calculation.supplier-approval.spec.ts src/test-order2/services/order-shipment.service.spec.ts src/return-request/return-request.business.spec.ts src/inventory/inventory.ownership.spec.ts src/business-ledger/operational-projection.spec.ts
npm run build
```

## Giới hạn bằng chứng

Không có listener trên cổng Mongo local riêng 27027 lúc kiểm tra. Việc khởi động ứng dụng ở lượt trước đã bị xét duyệt tự động chặn; lượt này không khởi động đường vòng, không dùng Mongo đang chạy ở cổng khác. Không chạy audit database và không tái sử dụng kết quả Mongo cũ như bằng chứng cho bản sửa mới.

Chưa kiểm chứng: rollback transaction Mongo thật khi lỗi giữa nhận hoàn/lưu đơn, ghi đồng thời từ hai người dùng, unique index/idempotency khi tranh chấp thật, và thao tác HTTP/UI. Các bài mô phỏng kiểm tra nhánh lỗi và hợp đồng gọi service, không thể thay bằng chứng tích hợp. Kết quả của suite chỉ áp dụng các tình huống liệt kê trên, không phải chứng nhận toàn bộ hệ thống.
