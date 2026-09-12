# Bốn trường hợp tính tiền và chi phí — quy tắc hiện hành

> Bản lịch sử: các giới hạn COD, phục hồi giá vốn và tiến độ dưới đây đã có thay đổi tiếp. Dùng [ma trận ghi nhận và trạng thái sửa 04/09/2026](business-model-fix-status-2026-09-04.md) làm mô tả hiện tại; không dùng riêng tài liệu này để nghiệm thu.

> Cập nhật sau khi làm rõ nghiệp vụ hàng hoàn: tài liệu này ghi lại quy tắc và bản sửa của giai đoạn trước. Với hàng bán lẻ hoàn còn bán lại được, cần tách nghĩa vụ trả NCC khỏi giá trị hàng thu hồi; không mặc định toàn bộ giá vốn là tổn thất. Xem `business-model-system-audit-2026-09-04.md` để biết các sai lệch đã tái hiện và yêu cầu hiện tại. Bốn trường hợp đơn giản chưa phải nghiệm thu toàn bộ mô hình.

Chủ hệ thống xác nhận ngày 04/09/2026. Quy tắc này thay thế ngoại lệ miễn phí giao cho đại lý và việc tự thu hồi giá vốn khi đơn bán lẻ hoàn.

Gọi A là giá bán cho đại lý đã chụp × số lượng, S là giá NCC đã chụp × số lượng, G là tổng phí giao của đơn, H là tổng phí hoàn phát sinh của đơn.

| Trường hợp | Đại lý chịu | Chi phí hàng và vận chuyển công ty chịu với NCC | Doanh thu hàng của công ty |
|---|---|---|---|
| Đại lý, giao thành công | A + G | S + G | A |
| Đại lý, giao không thành công/hoàn | A + G + H | S + G + H | A |
| Bán lẻ, giao thành công | Không áp dụng | S + G | Giá bán lẻ được ghi nhận khi giao thành công |
| Bán lẻ, giao không thành công/hoàn | Không áp dụng | S + G + H | 0 |

Đại lý là người mua của công ty. Phí công ty chi rồi thu bù đủ từ đại lý được ghi hai phần tương ứng, không tính thành lãi hàng thêm. Hàng hoàn của đại lý vẫn thuộc đại lý, công ty giữ hộ. Đơn bán lẻ hoàn vẫn giữ giá vốn NCC; các cờ `isReturnable`/`recoverable` cũ không tự làm giảm khoản này.

Ví dụ A = 250.000, S = 120.000, G = 20.000, H = 30.000, giá bán lẻ = 300.000, chưa có đóng gói/ads/chi phí chung:

- Đại lý giao thành công: nghĩa vụ đại lý 270.000, phần chi phí NCC 140.000, chênh lệch 130.000.
- Đại lý hoàn: nghĩa vụ đại lý 300.000, phần chi phí NCC 170.000, chênh lệch 130.000.
- Bán lẻ thành công: 300.000 − 140.000 = 160.000.
- Bán lẻ hoàn: 0 − 170.000 = −170.000.

Lợi nhuận sau phân bổ còn trừ đóng gói chưa nằm trong giá vốn, quảng cáo, nhân công và chi phí khác tương ứng. Các nghĩa vụ trên là giá trị giao dịch, không phải tiền đã thu/chi hoặc số dư công nợ còn lại; số dư cần trừ các thanh toán/đối trừ đã xác nhận.

## Thay đổi mã local

- `dealer-sale.ts`: mọi đơn đại lý đã xuất đều thu phí giao, bỏ hiệu lực của cờ `dealerShippingIncludedInPrice`. Phí hoàn đã phát sinh còn được giữ khi giao lại.
- `order-calculation.service.ts`: bán lẻ hoàn không giảm giá vốn NCC; ghi `recognizedRevenue=0`, giữ `recognizedGoodsCost` và tổng `supplierContractAmount`. Chỉ giao thành công hoặc hoàn cuối cùng mới áp dụng trường hợp tương ứng; đang giao không bị coi là thất bại. Trường `retailProfitState` phân biệt chờ giao, thiếu báo giá và đã tính.
- Báo cáo sản phẩm dùng các trường doanh thu/giá vốn đã ghi trên đơn, nên đơn bán lẻ hoàn không tiếp tục cộng COD/cọc thành doanh thu.
- Sổ chặn thao tác hoàn thông thường làm giảm giá vốn/nợ NCC của đơn bán lẻ, kể cả hồ sơ cũ ghi recoverable. Không sửa các bút toán lịch sử đã xác nhận; điều chỉnh có căn cứ qua bút toán đảo vẫn là quy trình riêng.
- Giao diện bỏ ô miễn phí giao cho đại lý, đổi cột lãi thành lãi đơn hàng để hiển thị cả bán lẻ. Danh mục sản phẩm trình bày quy tắc hiện hành thay cho lựa chọn tự thu hồi giá vốn.

## Kiểm chứng

```powershell
# backend
npm run build
npm test -- --runInBand --silent order-calculation.four-cases.spec.ts dealer-sale.spec.ts business-ledger.eligibility.spec.ts order-report.service.spec.ts
node --require ./scripts/local-ledger-guard.cjs scripts/verify-order-price-snapshots.cjs
```

Script tạo database mới trên cổng 27027 và dùng service/schema thật. Không kết nối database cũ, không chuyển dữ liệu demo/hệ thống. Các bài kiểm tra có cả số lượng 2 để phân biệt đơn giá và tổng phí theo đơn.

Kết quả ngày 04/09/2026: backend và frontend build thành công; 4 bộ kiểm thử với 51 bài đạt; script kiểm chứng đạt 22 tình huống trên database riêng `erp_snapshot_check_1788509088949` ở cổng 27027. Các kiểm tra service dùng MongoDB thật nhưng mô phỏng các tích hợp bên ngoài; chưa phải kiểm chứng toàn bộ giao diện và luồng HTTP.

Trạng thái chạy local: lệnh khởi động lại backend với bản build mới bị bộ xét duyệt tự động từ chối (`blocked by policy`), nên chưa xác nhận bản sửa đã được nạp vào ứng dụng đang chạy. Việc khởi động giao diện local trước đó cũng bị từ chối. Không triển khai lên hệ thống và không kết nối database cũ.

Giới hạn còn lại: giá bán lẻ hiện vẫn dựa trên trường COD cũ, chưa có bản chụp giá bán lẻ độc lập cho mọi tình huống cọc/thu trước. Các phép thử bán lẻ dùng COD bằng giá bán đầy đủ; chưa chứng minh các trường hợp thu trước khác. Phân bổ quảng cáo vẫn dùng phương pháp số lượng hiện có. Các luồng tiền thực nhận và đối soát cũ chưa được coi là đã nghiệm thu bởi thay đổi này.
