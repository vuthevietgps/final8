# Bản chụp giá và chi phí từng đơn — cập nhật local 04/09/2026

Phần này tiếp nối [rà soát ban đầu](order-profit-chain-audit.md). Không thay thế kết luận nghiệm thu toàn bộ doanh thu/lợi nhuận.

> Cập nhật tiếp theo: chủ hệ thống xác nhận đại lý là khách hàng cuối của công ty, hàng hoàn chỉ giữ hộ. Xem [quy tắc và thay đổi mới](dealer-end-customer-rule.md); phần cần đối chiếu bên dưới là tình trạng trước xác nhận này.

## Đã sửa trong mã local

- Backend chọn báo giá NCC đã duyệt gần nhất có hiệu lực tại `orderDate`; chọn báo giá đại lý đã duyệt trong khoảng hiệu lực, ưu tiên `validFrom` gần nhất. Không dùng báo giá đại lý tương lai/hết hạn làm giá thay thế.
- Tra cứu chấp nhận cả ID dạng chuỗi và ObjectId của các báo giá đã có, gồm báo giá tạo hàng loạt.
- Ghi giá, nguồn giá, thời điểm hiệu lực và thời điểm chụp vào đơn. Giá bằng 0 vẫn hợp lệ. PATCH thông thường và thao tác tính lại báo giá không được ghi đè bản chụp; đổi sản phẩm/NCC/đại lý là đường xác định lại bản chụp tương ứng.
- Giao diện không còn gọi `latest` rồi PATCH giá NCC. Giá chốt lấy từ kết quả backend.
- Giá vốn dự phòng lấy giá nhập sản phẩm, không cộng thêm phí giao. Có nguồn `product_fallback` và thời điểm chụp; không tự trôi theo lần sửa sản phẩm tiếp theo. Đây vẫn là giá dự phòng, chưa tương đương báo giá NCC đã duyệt.
- Phí bằng 0 được giữ. Phí đóng gói có bản chụp riêng theo sản phẩm; phí hoàn chỉ bị trừ khi đơn hoàn. Việc NCC đã bao gồm đóng gói trong giá hay chưa còn cần thể hiện rõ để tránh trùng phí.
- Bản chụp giá được dùng khi tính lãi gộp; chênh lệch đại lý lưu cũ không được thay thế giá bán đã chốt trong công thức đó.
- Sửa tên khách không xóa phân bổ ads/nhân công/chi phí khác. Phân bổ theo kỳ nguồn cập nhật các số tiền cùng `costAllocatedAt` và `costAllocationDate`.
- Chặn báo giá ngoại tệ chưa quy đổi trước khi áp vào phép tính VND.

## Kiểm chứng đã chạy

- Backend build thành công.
- Frontend build thành công sau khi bỏ luồng UI ghi đè giá NCC.
- 3 suite Jest liên quan: 6 tests đạt.
- `node --require ./scripts/local-ledger-guard.cjs scripts/verify-order-price-snapshots.cjs`: 14 checks đạt bằng service/schema thật, database riêng `erp_snapshot_check_1788493878008` trên loopback 27027. Các tác động ngoài phạm vi giá/chi phí được stub.
- Ví dụ hai sản phẩm: giá đại lý 250.000/sp, NCC 120.000/sp, giao 20.000/đơn, đóng gói 5.000/sp, ads 30.000, nhân công 20.000, khác 10.000 → lãi sau phân bổ 170.000. Sửa giá nguồn hoặc tên khách vẫn 170.000. Tăng ads của kỳ thêm 10.000 và phân bổ lại → 160.000.

## Logic cần tiếp tục đối chiếu với chủ hệ thống

1. Doanh thu bán lẻ cần giá bán chốt độc lập với tiền cọc/COD. Mã cũ hiện còn lấy COD làm cơ sở lãi nhưng báo cáo cộng thêm cọc/thanh toán tay.
2. Bán đại lý cần ghi nhận theo sản xuất xong + vận đơn; mã cũ vẫn chờ trạng thái giao/hoàn. Loại giao dịch phải quyết định doanh thu, không dùng vai trò đăng nhập internal/external để thay thế.
3. Chính sách thu hồi giá vốn và trách nhiệm đại lý khi hoàn là hai việc độc lập. Công thức cũ còn giữ toàn bộ giá đại lý khi hoàn, chưa dùng chính sách mới của sản phẩm.
4. Ads hiện chia theo số lượng sản phẩm trong cùng nhóm/ngày đặt đơn. Nhân công và chi phí khác chia theo số lượng toàn ngày. Cần chốt cách chia theo số đơn, số lượng, hoặc định mức phù hợp từng nguồn.
5. Bộ phân bổ còn tính mẫu số trên đơn active nhưng ghi phân bổ cho cả đơn inactive; chi phí ads không có đơn đúng nhóm có nhánh đẩy sang đơn thiếu nhóm. Các trường hợp này chưa được nghiệm thu trong 14 checks bản chụp.
6. Chi phí khác có cả loại vận chuyển/đóng gói; cần tránh vừa ghi trực tiếp vào đơn vừa phân bổ chung. Phải phân biệt số tiền theo đơn với đơn giá theo sản phẩm và phần công ty chịu/phần được bên khác bù.
7. Báo cáo cần dùng cùng thành phần doanh thu, giá vốn và chi phí của đơn; thiếu báo giá hoặc dữ liệu chi phí phải hiển thị chưa đủ dữ liệu/tạm tính.

Chưa sửa hàng loạt dữ liệu lịch sử, chưa triển khai lên hệ thống hoặc kết nối database cũ. Các checks trên chứng minh phạm vi bản chụp, không chứng minh toàn bộ `ordertest2` đã đúng cho mọi nghiệp vụ.
