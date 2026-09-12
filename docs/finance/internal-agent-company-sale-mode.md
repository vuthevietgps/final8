# Đại lý nội bộ là công ty — quy tắc phân loại đơn

Ngày chốt: 05/09/2026.

## Quy tắc hiện hành

- `internal_agent` là nhân sự/đại diện của công ty. Đơn do tài khoản này phụ trách là `saleMode=retail`.
- `external_agent` là đại lý mua hàng của công ty. Đơn gắn tài khoản này là `saleMode=dealer`.
- Đơn không có `agentId` là `saleMode=retail`.
- Chỉ `dealer` dùng báo giá đại lý, phát sinh khoản phải thu đại lý và áp dụng quyền sở hữu/giữ hộ hàng hoàn của đại lý.
- `retail` ghi doanh thu theo số lượng giao thành công và không tạo công nợ phải thu đối với nhân sự nội bộ.

`saleMode` và `agentRoleSnapshot` được backend xác định và lưu trên đơn. Client không được tự gửi hai trường này. Vai trò được chụp để việc đổi vai trò người dùng về sau không âm thầm đổi bản chất giao dịch đã chốt.

## Dữ liệu lịch sử

Đơn cũ có `agentId` nhưng chưa có `saleMode` vẫn giữ cách hiểu cũ là đại lý cho đến khi được đối chiếu và tính lại bằng quy trình có kiểm soát. Không tự sửa sổ hoặc công nợ lịch sử đã xác nhận. Trước khi chuyển dữ liệu, cần thống kê riêng các đơn gắn `internal_agent`, bổ sung tổng giá bán lẻ còn thiếu, kiểm tra trạng thái giao/hoàn rồi mới chạy tính lại lợi nhuận theo kỳ.

## Giao diện

Đơn mới mặc định là “Công ty / bán lẻ”. Danh sách chọn đại lý trên đơn và báo giá đại lý chỉ hiển thị `external_agent`.
