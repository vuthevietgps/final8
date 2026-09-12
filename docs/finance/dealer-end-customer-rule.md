# Đại lý là khách hàng của công ty — 04/09/2026

> Quy tắc hiện hành đã được chốt thêm cho cả bán lẻ và đại lý: xem [bốn trường hợp tính tiền và chi phí](four-case-charge-rules.md). Các ngoại lệ “giá gồm phí giao” bên dưới là lịch sử trao đổi, không còn áp dụng.

Quy tắc chủ hệ thống vừa xác nhận thay thế giả định trước đây rằng trách nhiệm đại lý khi hoàn thay đổi theo sản phẩm: đại lý đã mua hàng thì chịu toàn bộ giá bán đã chốt; khi hoàn phải chịu đủ giá hàng, phí giao và phí hoàn; hàng hoàn công ty nhận lại để giữ hộ, quyền sở hữu vẫn thuộc đại lý.

## Cách tính và lưu trên đơn

- Mốc xuất hàng dùng điều kiện đã thống nhất: `Đã trả kết quả` và có mã vận đơn. Backend lưu `dealerSaleRecognizedAt`; đổi trạng thái giao/hoàn sau đó không xóa mốc này.
- Doanh thu hàng = `agentAppliedPrice × quantity`; giá vốn = `supplierAppliedPrice × quantity`, dùng bản chụp báo giá. Không phụ thuộc vai trò internal/external hay ai thu COD.
- Thiếu bản chụp báo giá thật thì đánh dấu `missing_quotes`, giao diện hiển thị “Thiếu báo giá”; không trình bày số 0 như lãi đã hoàn tất.
- Hàng hoàn giữ nguyên doanh thu và giá vốn. `goodsOwner=dealer`, `returnDisposition=dealer_custody` thể hiện hướng xử lý giữ hộ. Đây là dấu vết theo đơn, chưa phải sổ nhập/xuất kho giữ hộ theo từng kiện.
- Với đơn đại lý đã hoàn, nghĩa vụ = giá bán chụp × số lượng + phí giao + phí hoàn, kể cả có cờ `dealerShippingIncludedInPrice=true` từ trước. Cờ này chỉ còn áp dụng với đơn chưa từng hoàn; giao diện khóa lựa chọn sau khi hoàn.
- Phí hoàn chỉ phát sinh sau khi hoàn. Mốc `dealerReturnedAt` giữ dấu vết để lần giao lại không xóa phí đã phát sinh. Số tiền `returnFee` là tổng phí hoàn hiện ghi cho đơn; cập nhật lặp không tự cộng thêm lần nữa.
- `dealerRecoverableFees` của đơn đã hoàn luôn là phí giao cộng phí hoàn. Khoản thu bù bằng chi phí không làm tăng lãi hàng.
- `dealerContractAmount` là giá trị nghĩa vụ theo hợp đồng gồm hàng và phí, **không phải số còn nợ**. Số còn nợ vẫn phải căn cứ bút toán và các khoản thanh toán đã xác nhận.
- Đơn đã xuất không được đổi người mua/sản phẩm/NCC/số lượng hoặc xóa hồ sơ qua thao tác thông thường.

Ví dụ 1 sản phẩm: giá bán 250.000, vốn 120.000, đóng gói 5.000, phí giao 20.000 tính riêng, phí hoàn 30.000. Nghĩa vụ đại lý là 300.000; lãi trước ads/chi phí chung là 125.000 cả trước và sau hoàn. Cờ giá gồm phí giao không làm giảm nghĩa vụ này khi hoàn. Với đơn chưa hoàn và phí giao nằm trong giá bán, nghĩa vụ trước hoàn là 250.000; khi hoàn áp dụng đủ ba khoản thành 300.000.

## Liên kết sổ và giao diện

- Hồ sơ sổ đại lý mới mặc định `full_sale_price` theo quy tắc vừa chốt. Hồ sơ/bút toán đã xác nhận trước đây không bị ghi lại hàng loạt.
- Với đơn đại lý đã xuất và bị hoàn, sổ chặn các nghiệp vụ giảm doanh thu/thu hồi giá vốn/nhập thành hàng công ty do hoàn thông thường. Bút toán đảo sửa sai có căn cứ vẫn là cơ chế sửa sổ riêng.
- Bổ sung nghiệp vụ `dealer_cost_recovery`: tăng khoản phải thu đại lý và bù chi phí đã ghi, không tạo thêm doanh thu hàng hay tiền thực nhận. Cần nhập chứng từ/căn cứ và xác nhận như các nghiệp vụ sổ khác; không tự nhân bản số tiền từ đơn vào sổ.
- Bảng đơn hiển thị phí giao, phí hoàn, lựa chọn giá gồm phí giao, lãi đơn đại lý và dấu hiệu hàng thuộc đại lý cho người có quyền quản lý sổ. Bộ lọc báo cáo lợi nhuận nhận cả đơn đại lý đã ghi doanh thu nhưng còn đang giao.
- Danh mục sản phẩm hiển thị quy tắc đại lý mua đứt; chính sách thu hồi giá vốn sản phẩm vẫn phục vụ các trường hợp hàng thuộc công ty, chẳng hạn bán lẻ.

## Kiểm chứng và giới hạn

Các service dùng dữ liệu thử nghiệm trên MongoDB riêng cổng 27027; không dùng database cũ hoặc dịch vụ quảng cáo. Các kiểm tra bản chụp được mở rộng với hoàn hàng, lặp cập nhật, đổi vai trò tài khoản, giữ chủ sở hữu và giao lại sau hoàn.

Kết quả: backend/frontend build thành công; bộ 5 suite liên quan đạt 48 tests trước kiểm tra bổ sung giao lại; suite `dealer-sale.spec.ts` mới nhất đạt 18 tests. Script với service/schema thật đạt 19 checks trên database riêng `erp_snapshot_check_1788507809805`. Backend local khởi động và `/health/live` trả HTTP 200. Bước khởi động web host cổng 4300 bị bộ duyệt công cụ tự động từ chối với thông báo `blocked by policy`; chưa nghiệm thu tương tác trình duyệt của lần thay đổi này. Công cụ trình duyệt cũng báo lỗi khởi tạo kernel assets trên thiết bị.

```powershell
# backend
npm run build
npm test -- --runInBand --silent dealer-sale.spec.ts business-ledger.dealer-policy.spec.ts business-ledger.eligibility.spec.ts order-report.service.spec.ts business-confirmation.service.spec.ts
node --require ./scripts/local-ledger-guard.cjs scripts/verify-order-price-snapshots.cjs
```

Đây là thay đổi nghiệp vụ bán đại lý/giữ hộ. Việc phân bổ ads theo số đơn hay số lượng, cơ sở doanh thu bán lẻ từ giá bán độc lập COD, và các luồng báo cáo/đối soát cũ khác vẫn là các hạng mục riêng. Phí lưu kho, giao lại, đóng gói lại có thể ghi bằng chi phí và khoản thu bù trong sổ; chưa tự sinh thành các dòng phí trên `ordertest2`. Không triển khai hoặc chuyển dữ liệu lịch sử lên hệ thống.


## Chốt thêm: đủ ba khoản khi hoàn

Chủ hệ thống nhấn mạnh lại: “phí giao hàng, báo giá đại lý, phí hàng hoàn đều phải chịu”. Đã bỏ ngoại lệ không thu phí giao cho đơn đã hoàn. Ví dụ 250.000 + 20.000 + 30.000 = 300.000. Đây là nghĩa vụ gốc; số còn phải thu chỉ xác định sau khi trừ các khoản thanh toán/đối trừ đã xác nhận. Giá bán và giá vốn không bị đảo do hàng hoàn giữ hộ.

Kiểm chứng sau sửa: backend/frontend build đạt; suite dealer-sale đạt 19 tests; script service/MongoDB đạt 19 checks trên `erp_snapshot_check_1788508120787`, gồm trường hợp cờ phí giao đã bao gồm trước hoàn, cập nhật hoàn lặp và giao lại. Bản sửa này chưa được xác minh qua giao diện hoặc nạp lại vào tiến trình backend đang chạy trước đó.
