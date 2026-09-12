# Cập nhật lợi nhuận sau logout

Luồng `AuthService.logout` lưu chi phí nhân công và đánh dấu ngày cần tính lại trong cùng transaction MongoDB, thông qua `AdvertisingCostRefreshService` đang có. Ngày/giờ ghi nhận dùng múi giờ Việt Nam, độc lập múi giờ máy chủ.

Sau commit, gọi `flush(day)` để phân bổ lại chi phí đơn hàng, cập nhật báo cáo nhóm quảng cáo và các projection/cache tài chính qua `AdsCostProjectionService`. Không định giá lại báo giá đã chốt (`revalue=false`).

Nếu projection thất bại hoặc ngày đang được worker khác xử lý, API vẫn trả `laborCostCreated=true`, `financialRefreshPending=true`. Job lưu trong MongoDB được lịch retry hiện có xử lý; retry không tạo thêm chi phí nhân công. Nếu ghi chi phí thất bại, transaction hoàn tác cả yêu cầu cập nhật. Việc phục hồi phiên đã đóng nhưng chưa tạo được chi phí vẫn theo quy trình phiên/labor hiện có, không phải phạm vi sửa này.

Kiểm chứng từ thư mục backend:

```powershell
npm run build
node scripts/verify-financial-propagation-local.cjs
```

Script dùng DB thử riêng trên replica set local 27027, kiểm tra actual `AuthService.logout` với model chi phí, transaction, queue và bộ tính đơn/báo cáo thật. Nguồn user/salary/session là fixture. Có các ca: cập nhật ngay, ngày Việt Nam khác ngày UTC, logout khi không còn phiên, lỗi projection và retry không nhân đôi chi phí, lỗi ghi nguồn hoàn tác job.

Các vấn đề đo giờ hoạt động, đa thiết bị, duyệt công và bù dữ liệu logout lịch sử không thuộc bản sửa này.
