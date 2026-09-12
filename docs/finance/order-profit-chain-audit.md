# Rà soát sản phẩm → báo giá → đơn hàng → lợi nhuận

Ngày kiểm tra: 04/09/2026. Phạm vi: lợi nhuận quản trị theo quy tắc chủ hệ thống đã mô tả; chưa đánh giá dòng tiền, thuế hoặc báo cáo tài chính theo chuẩn kế toán.

> Đây là bằng chứng trước sửa. Sau đó đã sửa một phần về bản chụp giá/chi phí; xem [cập nhật và giới hạn kiểm chứng](order-price-snapshot-phase.md). Con số 5/15 bên dưới là kết quả rà soát ban đầu.

## Kết luận

**Chưa chính xác xuyên suốt.** Có liên kết dữ liệu giữa sản phẩm, NCC, đại lý và đơn hàng, nhưng chưa đủ để tin cậy lợi nhuận từng đơn hoặc tổng hợp theo sản phẩm, đại lý, nhóm quảng cáo.

Các chính sách mới `ledgerReturnPolicy`, `dealerReturnPolicy` và điều kiện ghi doanh thu đã được bổ sung vào `business-ledger`. Chúng chưa thay thế công thức tự động trong `test-order2`. Việc mở sổ từ một đơn hàng không đồng nghĩa các trường `grossProfit`/`netProfit` cũ đã dùng sổ đó. Sổ mới vẫn cần bút toán được xác nhận; trạng thái đơn không tự tạo đủ doanh thu, giá vốn và điều chỉnh hàng hoàn.

## Kiểm chứng local

- Dùng các service và schema thật được biên dịch từ backend; MongoDB riêng tại `127.0.0.1:27027`, database mới tên `erp_profit_audit_<timestamp>` cho mỗi lần chạy.
- Không sửa dữ liệu demo hiện có, không kết nối database cũ, không deploy/push, không gọi Google/Meta/Sheets.
- Tái sử dụng `ProductSchema`, `SupplierQuoteService`, `QuoteService`, `TestOrder2Service`, `OrderCalculationService`, `OrderReportService`, `DeliveryStatusService`.
- Các phần gửi sự kiện, đồng bộ Sheets và tạo công nợ phụ trợ được thay bằng stub để cô lập phép tính. Chưa kiểm thử toàn bộ HTTP/phân quyền/giao diện hay mọi subscriber phía sau.
- Luồng giao diện lấy giá NCC mới nhất rồi PATCH giá được đọc từ mã Angular và tái hiện bằng service thật; chưa thao tác chuỗi này trên trình duyệt.
- Kết quả: **20 phép đối chiếu, 5 khớp kỳ vọng, 15 sai lệch**. Đây là bộ chẩn đoán phát hiện lỗi, không phải bộ nghiệm thu đã đạt. F01a/F01b là hai bước của cùng một lỗi.
- `npm run build` backend đã thành công; chạy lại chẩn đoán trên bản build đó lúc `2026-09-04T03:36:33Z` vẫn cho cùng 5/15 kết quả.

Xem [kết quả máy đọc được](order-profit-chain-audit-results.json) và [script chạy lại](../../backend/scripts/audit-order-profit-chain.cjs).

```powershell
# Từ thư mục backend; mongod thử nghiệm riêng phải đang chạy ở 27027.
npm run build
node --require ./scripts/local-ledger-guard.cjs scripts/audit-order-profit-chain.cjs
```

Script chỉ ghi database thử nghiệm mới và cập nhật file kết quả. Mã thoát 0 chỉ có nghĩa chẩn đoán chạy xong; đọc `mismatches` để đánh giá nghiệp vụ.

## Những điểm đang đúng trong tình huống kiểm tra

1. Backend chọn báo giá NCC đã duyệt và có hiệu lực tại ngày đặt đơn khi chốt lần đầu.
2. Chỉ sửa báo giá NCC nguồn không tự đổi giá đã chốt của đơn.
3. Báo giá đại lý tạo riêng, đã duyệt, đúng cặp sản phẩm/đại lý và thời hạn được áp dụng.
4. Chỉ sửa báo giá đại lý nguồn không tự đổi giá đã chốt của đơn.
5. Bán lẻ đang giao chưa ghi lãi gộp.

## Các sai lệch đã tái hiện

Đơn vị tiền trong bảng: đồng. Các ví dụ dùng số lượng 1; lãi gộp chưa trừ quảng cáo/chi phí chung nếu không ghi khác.

| Mã | Tình huống | Kỳ vọng | Thực tế |
|---|---|---|---|
| F01a/b | NCC có giá chốt 100.000; báo giá mới 160.000 còn chờ duyệt, hiệu lực năm sau. UI lấy `latest` rồi PATCH giá. | Giữ giá đã chốt 100.000 | Đổi thành 160.000 nhưng vẫn giữ ID báo giá cũ |
| F02 | Bán đại lý giá 250.000, vốn 100.000, sản xuất xong + có vận đơn, đang giao | Lãi gộp 150.000 theo mốc chủ hệ thống yêu cầu | 0 |
| F03 | Không có giá đại lý trong thời hạn, chỉ có báo giá năm sau 999.000 | Không tự áp giá ngoài thời hạn | Áp 999.000 |
| F14 | Tạo giá 250.000 bằng “áp dụng cho tất cả đại lý” | Tìm được giá như tạo riêng | Không tìm được giá |
| F04 | Hàng hoàn thu hồi được giá vốn, đại lý không chịu tiền hàng, công ty chịu phí hoàn 30.000; giá bán đại lý 250.000 | Lỗ 30.000 | **Lãi 220.000** |
| F05 | Cùng giao dịch bán đại lý giá 250.000, vốn 100.000, COD 300.000; tài khoản `internal_agent` | Lãi 150.000 nếu đây là giao dịch bán sỉ đã thỏa thuận | Lãi 200.000 vì vai trò tài khoản làm thay đổi công thức |
| F06 | Sản phẩm `isReturnable=false`, `production_committed`; NCC không đặt giá trị ghi đè | Kế thừa chính sách sản phẩm | Chốt `supplierIsReturnableSnapshot=true` |
| F07 | NCC báo phí giao/hoàn bằng 0; sản phẩm có shipping 20.000, packaging 10.000 | Giữ phí 0/0 đã báo | Đổi thành 20.000/10.000 |
| F08 | Không có báo giá NCC: giá nhập sản phẩm 100.000, phí giao 20.000, bán 300.000 | Lãi 180.000 | Lãi 160.000; phí giao nằm cả trong vốn lẫn phí |
| F09 | Giao thành công: bán 300.000, vốn 100.000, phí giao 20.000; biểu phí hoàn 30.000 | Lãi 180.000 | Lãi 150.000; trừ phí hoàn dù chưa hoàn |
| F10 | Đơn đang dùng giá vốn dự phòng từ sản phẩm; sửa giá nhập sản phẩm 100.000 → 150.000 rồi tính lại | Giá vốn lịch sử không tự đổi | Giá vốn gồm phí đổi 120.000 → 170.000 |
| F11 | Báo giá NCC 10 USD | Chặn hoặc quy đổi rõ ràng trước khi tính chung tiền VND | Lấy số 10 đưa thẳng vào giá vốn |
| F12 | Đơn đã có lãi gộp 200.000; ads 10.000, nhân công 10.000, khác 5.000. Chỉ sửa tên khách | Giữ lãi sau phân bổ 175.000 | Ads thành 50.000, nhân công/khác thành 0; lãi thành 150.000 |
| F13 | COD 200.000, cọc 100.000, vốn 100.000 | Báo cáo và đơn phải dùng cùng một cơ sở doanh thu | Báo cáo: doanh thu 300.000, vốn 100.000; đơn: lãi gộp 100.000 |

F13 chứng minh sự không thống nhất; không kết luận rằng mọi khoản cọc phải cộng thêm vào doanh thu. Cần xác định rõ giá bán đã thỏa thuận và COD là số còn phải thu hay toàn bộ giá bán.

## Nguyên nhân và điểm mã cần sửa

| Nhóm | Điểm mã | Nguyên nhân |
|---|---|---|
| Giá NCC | `frontend/.../test-order2.component.ts:501`; `supplier-quote.service.ts:235`; `order-calculation.service.ts:385` | UI dùng endpoint “mới nhất” không lọc duyệt/hiệu lực để ghi đè `supplierAppliedPrice`; backend tin giá PATCH dù vẫn có ID báo giá cũ. |
| Giá đại lý | `order-calculation.service.ts:512`; `quote.service.ts:57`; `quote.schema.ts:15` | Nhánh dự phòng bỏ giới hạn thời gian. Schema runtime của các ID báo giá là `Mixed`; tạo riêng lưu chuỗi, tạo hàng loạt lưu `agent._id` dạng ObjectId, trong khi lookup dùng chuỗi. |
| Chính sách và mốc ghi nhận | `order-calculation.service.ts:226,425,671,692` | Dựa trạng thái thanh toán/giao hàng và role external/internal; chưa dùng loại giao dịch và hai chính sách hàng hoàn mới. Công thức hoa hồng âm khi hoàn giữ toàn bộ giá đại lý trong lãi. |
| Chi phí giao/hoàn | `order-calculation.service.ts:436,445,486` | Giá vốn dự phòng cộng phí giao; sau đó lại trừ phí. `0` bị coi là thiếu. Phí đóng gói bị dùng làm phí hoàn. |
| Lan truyền cập nhật | `test-order2.service.ts:600`; `order-calculation.service.ts:619` | Mọi PATCH đều tính lại ước tính chi phí; chỉ một số trường kích hoạt phân bổ thực theo ngày. Sửa tên khách làm mất phân bổ cũ. |
| Báo cáo | `order-report.service.ts:126` | Doanh thu lấy COD + cọc + thanh toán tay; giá vốn lấy appliedPrice; lãi cộng từ trường lưu sẵn tính theo công thức khác. |

## Hệ quả cho báo cáo và quảng cáo

Nếu báo cáo sản phẩm, đại lý hoặc nhóm quảng cáo cộng các giá trị sai ở đơn, tổng hợp vẫn sai dù phép cộng/nhóm ID đúng. Sổ mới có công thức riêng nên cũng chưa thể mặc định số liệu giữa hai nơi sẽ khớp. Chưa nghiệm thu luồng quyết định ads từ lợi nhuận của `ordertest2`.

## Thứ tự điều chỉnh đề xuất trên local

1. Chốt một hợp đồng dữ liệu cho từng đơn: loại giao dịch, số lượng, giá bán, giá vốn, đơn vị tiền, phí giao/hoàn/đóng gói, hai chính sách hàng hoàn, nguồn báo giá và thời điểm áp dụng. Chỉnh giá quá khứ phải là thao tác rõ ràng có lịch sử; không âm thầm thay khi sửa danh mục.
2. Cho backend chọn giá đã duyệt và đúng thời hạn; bỏ PATCH giá từ `latest`; chuẩn hóa kiểu ID trong cả tạo riêng/tạo hàng loạt. Không coi giá hoặc phí bằng 0 là thiếu.
3. Nối mốc ghi nhận bán lẻ/bán đại lý và chính sách hàng hoàn vào một nguồn tính lợi nhuận thống nhất. Khi đổi sản xuất/vận đơn/trạng thái hoàn phải cập nhật đúng các thành phần, có chống tính trùng và điều chỉnh lịch sử.
4. Tách chi phí thực tế khỏi ước tính; chỉnh trường không liên quan tài chính không được thay chi phí. Phân bổ quảng cáo phải cộng lại bằng chi phí nguồn trong cùng kỳ; hiển thị phần chưa phân bổ/ước tính.
5. Tổng hợp sản phẩm/đại lý/nhóm quảng cáo từ cùng nguồn doanh thu, giá vốn và chi phí từng đơn; kiểm tra tổng con khớp tổng hệ thống trước khi dùng điều chỉnh ads.

Lần rà soát này bổ sung script và bằng chứng, không thay công thức ứng dụng. Các lỗi trên còn tồn tại; không trình bày kết quả kiểm tra sổ mới trước đây như bằng chứng chuỗi `ordertest2` đã đạt.
