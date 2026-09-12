# ERP mới độc lập — 2026-09-09

- URL LAN: http://192.168.100.236:8107/login
- Tài khoản ban đầu: `vutheviet@gmail.com`, vai trò `director`.
- Mật khẩu được giữ trong tệp Windows DPAPI `tmp/erp-next-admin.credential.xml` trên máy triển khai. Chạy `scripts/copy-erp-next-password.ps1` bằng cùng tài khoản Windows để sao chép vào clipboard; không in mật khẩu hoặc commit tệp này.
- Thư mục triển khai trên server: `/home/admin-001/erp-next`.
- Docker stack: `erp-next`, tự khởi động lại dịch vụ theo restart policy.
- MongoDB 8.2, replica set một node `erp-next-rs`, database `erp_next`, application user chỉ có `readWrite` trong database mới.
- Volume riêng: `erp-next_mongo-data`, `erp-next_mongo-config`, `erp-next_uploads`, `erp-next_media`.
- Mạng riêng: `erp-next_database`, `erp-next_web`. Database và backend không publish cổng ra host.
- Frontend publish cổng 8107, Nginx giới hạn truy cập các mạng nội bộ. Chưa gắn domain/HTTPS công khai.
- 7 bí mật riêng lưu bằng Docker Swarm Secrets; ứng dụng đọc từ `/run/secrets` lúc chạy. Không có `.env` chứa bí mật và không ghi bí mật vào cấu hình Env của service. Cơ chế mã hóa/lưu trong bộ nhớ theo [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/).
- Swarm một máy được bật trên Docker Engine hiện có; các container Compose cũ giữ nguyên. Cổng quản lý Swarm chỉ listen trên loopback. Các ứng dụng vẫn dùng chung tài nguyên vật lý của server.

## Kiểm tra và vận hành

```sh
cd /home/admin-001/erp-next
docker stack services erp-next
python3 verify-server.py
```

`verify-server.py` kiểm tra volume/mạng không giao với ERP cũ, health của cả hai hệ thống, readiness có transaction/index, thực hiện commit và abort transaction trên collection kiểm chứng riêng rồi xóa đúng bản ghi thử. Nó cũng xác nhận trạng thái khởi tạo: 1 user, 0 sản phẩm/đơn hàng/chi phí quảng cáo. Sau khi nhập dữ liệu thật, không dùng assertion số lượng khởi tạo làm health check định kỳ.

Đã kiểm tra: health/readiness, transaction commit/abort, index, đăng nhập quản trị và gọi API profile, API chưa xác thực trả 401, đăng ký công khai bị chặn 403. Tài khoản bổ sung tạo bằng màn hình quản lý người dùng sau đăng nhập.

Để cập nhật cấu hình/image:

```sh
cd /home/admin-001/erp-next
docker stack config -c stack.yml >/dev/null
docker stack deploy --resolve-image never -c stack.yml erp-next
```

Giữ nguyên secrets, volume và `hostname: mongo`. Với Docker Config đã được sử dụng, cần tạo tên config phiên bản mới trước khi cập nhật nội dung. Image backend/frontend là bộ đã build ngày 2026-09-09, không kéo `latest` từ registry. Script tạo index được mount riêng, bao gồm sửa alias `$group` cho đường dẫn index lồng như `actions.actionId`.

`provision-secrets.py` tạo bí mật mới chỉ khi toàn bộ 7 tên chưa tồn tại; nếu đủ thì giữ nguyên, nếu chỉ có một phần thì dừng để tránh xoay khóa ngầm. Không xóa Docker secrets hoặc dữ liệu Swarm khi chưa có phương án sao lưu/khôi phục khóa mã hóa.

ERP cũ tại cổng 8090 giữ database và dữ liệu hiện có. Chưa chuyển danh mục, số dư đầu kỳ, tồn kho, công nợ, đơn hàng hay token tích hợp từ ERP cũ. Thực thi quảng cáo và gửi tin tự động đang tắt.

Chưa thiết lập lịch sao lưu tự động. Replica set một node phục vụ transaction, không cung cấp dự phòng khi mất server; cần sao lưu database, media và bí mật mã hóa trước khi vận hành dữ liệu thật.
