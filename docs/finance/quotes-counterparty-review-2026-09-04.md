# Rà soát báo giá và công nợ NCC/đại lý — 04/09/2026

> Đây là báo cáo trước sửa. Kết quả sửa và kiểm thử tiếp theo: [counterparty-settlement-fix-2026-09-05.md](counterparty-settlement-fix-2026-09-05.md).

## Kết luận

Bốn chức năng chưa đồng nhất với mô hình NCC bán hàng cho công ty và đại lý mua đứt của công ty. Không chỉ là chất lượng nhập liệu: còn sai lệch xử lý, liên kết dữ liệu và diễn giải giao diện. Bản chụp trên OrderTest2 đã được kiểm thử giữ nguyên không có nghĩa toàn bộ chức năng báo giá/công nợ đã hoàn tất.

Lượt này là rà soát: đọc mã nguồn, chạy kiểm thử và thêm script tái hiện. Không sửa logic chạy của bốn module, không thay dữ liệu, không triển khai.

## Phát hiện theo mức ưu tiên

### P1 — Thanh toán NCC một phần có thể đánh dấu cả kỳ đã thanh toán

`backend/src/supplier-payable/services/statement-management.service.ts:130`, `:174`; endpoint còn được gọi qua `SupplierPayableService.addStatementPayment`.

Sau khi lưu bất kỳ khoản thanh toán nào, service phát `updateMany` đặt `supplierPaymentStatus=paid` cho các đơn thuộc NCC/kỳ/trạng thái giao đủ điều kiện. Không kiểm tra số tiền phân bổ cho từng đơn, không loại `financialModelVersion=2`. Đã tái hiện bằng khoản 10.000 trên kỳ 1.000.000: số dư kỳ vẫn 990.000 nhưng lệnh cập nhật trạng thái toàn kỳ vẫn được phát. Model mô phỏng chỉ thu lệnh, không ghi đơn thật.

Yêu cầu sửa: thanh toán xác nhận phải được phân bổ/đối trừ theo chứng từ và từng nghĩa vụ; đơn còn dư không được coi đã tất toán. Bỏ nhánh cập nhật cờ hàng loạt theo kỳ, không để đường cũ tác động đơn mới.

### P1 — Công nợ NCC cũ không phải nguồn đầy đủ cho mô hình mới

`backend/src/supplier-payable/supplier-payable.service.ts:155`, `:208`; `backend/src/supplier-payable/services/statement-management.service.ts:69`; `backend/src/test-order2/test-order2.service.ts:223`.

- Module cũ mô tả NCC thu COD và trả chênh lệch về công ty. Giao diện cũng mặc định NCC thu COD theo chu kỳ.
- Công thức COD dùng `codCollectedBySupplier > 0 ? codCollectedBySupplier : codAmount`. Khi công ty/đại lý thu tiền và NCC thực thu bằng 0, nhánh cũ vẫn có thể tính cả COD là tiền NCC thu.
- Đơn mô hình mới chủ động không upsert vào collection công nợ NCC cũ; nghĩa vụ được sinh trong Sổ kinh doanh. Vì vậy danh sách/kỳ cũ không thể đại diện đầy đủ nợ NCC của đơn mới và PO mới.

Yêu cầu sửa: lấy cùng nguồn nghĩa vụ và chứng từ xác nhận với Sổ kinh doanh; tách tiền công ty phải trả NCC khỏi tiền NCC thu hộ phải trả lại; không suy diễn thực thu từ giao thành công/COD. Giữ nhãn lịch sử cho dữ liệu cũ chưa đối chiếu.

### P1 — Công nợ đại lý bỏ qua điều chỉnh ngoài thanh toán

`backend/src/agent-receivable/dealer-receivable.pipeline.ts:28` chỉ cộng tác động nợ từ `payment` và các bút toán đảo payment. Trong khi `backend/src/business-ledger/business-ledger.rules.ts:262` cho phép `sale_credit` giảm doanh thu và nợ đại lý ở tình huống đủ điều kiện; chi phí trả đại lý cũng có thể ảnh hưởng số dư.

Ví dụ hợp đồng đại lý 300.000, điều chỉnh giảm giá 20.000 đã xác nhận: Sổ kinh doanh có số dư 280.000, nhưng pipeline công nợ đại lý vẫn 300.000 nếu không có thanh toán. Đây là đối chiếu đường mã và tác động sổ, chưa thực thi pipeline Mongo trong lượt này.

Yêu cầu sửa: dùng một nguồn tác động công nợ chung, tính đủ điều chỉnh/đảo; vẫn trình bày riêng “thực thu” và “điều chỉnh”, không gọi mọi khoản giảm nợ là thu tiền.

### P2 — Ngày hết hiệu lực báo giá đại lý kết thúc sớm

`backend/src/quote/quote.controller.ts:30`, `backend/src/quote/quote.service.ts:123`.

Giao diện nhập ngày `2026-09-04`, controller chuyển thành `2026-09-04T00:00:00.000Z`, tương đương 07:00 Việt Nam. Đơn 10:00 cùng ngày không còn đủ điều kiện lấy báo giá. Đã tái hiện bằng controller thật và so sánh ngày, không dùng Mongo.

Yêu cầu sửa: thống nhất ngày hiệu lực theo ngày Việt Nam (ngày cuối bao gồm hết ngày); kiểm tra ngày bắt đầu <= ngày kết thúc. Không chỉ thay chuỗi hiển thị; phải chuẩn hóa ở API và rà soát dữ liệu ngày cũ.

### P2 — Báo giá đại lý sửa điều khoản nhưng giữ trạng thái đã duyệt

`backend/src/quote/quote.service.ts:174`; controller chỉ dùng quyền chung `quotes`.

Sửa giá 250.000 thành 270.000 vẫn giữ “Đã duyệt”, không có bước hủy duyệt cũ như báo giá NCC. Đã tái hiện với service thật/model mô phỏng. Đây là lỗ hổng kiểm soát chất lượng giá được duyệt, không kết luận người sửa không có quyền kinh doanh.

Yêu cầu sửa: lưu lịch sử điều khoản, người sửa, mốc áp dụng; đổi điều khoản thương mại phải có quyết định duyệt tương ứng. Đơn đã chụp tiếp tục giữ bản chụp, không tự sửa lịch sử đơn.

### P2 — Áp dụng báo giá đại lý hàng loạt có thể bỏ sót hoặc chọn nhầm đối tượng

`backend/src/quote/quote.service.ts:36`, `:59`.

- Danh sách vai trò gồm cả internal/external supplier mặc dù chức năng ghi “tất cả đại lý”.
- Chỉ cần tồn tại báo giá `isActive != false` là bỏ qua; báo giá đã hết ngày hiệu lực cũng chặn tạo giá kỳ mới. Đã tái hiện trường hợp có giá hết năm 2025 nên tạo giá tháng 09/2026 trả về 0 bản ghi.

Yêu cầu sửa: chọn đúng đại lý, xét khoảng hiệu lực/phiên bản, trả rõ số tạo mới/bỏ qua/lỗi và lý do. Không tự ghi đè báo giá đã dùng.

### P2 — API báo giá NCC hiệu lực chưa dùng cùng điều kiện với OrderTest2

`backend/src/supplier-quote/supplier-quote.service.ts:248`.

Với báo giá cũ thiếu `effectiveAt`, API hiệu lực chấp nhận mà không kiểm tra `createdAt <= targetDate`. OrderCalculation đã có điều kiện đó. Đã thu lại truy vấn và xác nhận thiếu điều kiện; chưa chứng minh bằng truy vấn Mongo thật.

`getLatest` còn trả bản mới nhất kể cả chờ duyệt/tương lai: phù hợp nếu xem lịch sử, không được dùng thay cho giá hiệu lực. Cần giữ rõ hai ý nghĩa.

Yêu cầu sửa: dùng chung hàm/chính sách chọn giá hiệu lực và cách xử lý dữ liệu cũ giữa các chức năng.

### P2 — Giao diện và bảng kỳ đại lý vẫn diễn giải theo hoa hồng

`frontend/src/app/features/agent-receivable/agent-receivable.component.html:4`, `:63`, `:104`, `:121`.

- Hiển thị “hoa hồng phải trả”, “giao thành công = đã thu”, nút “trả hoa hồng” trong khi service mới tính tiền hàng phải thu và đã chặn thanh toán hoa hồng cũ.
- `AgentReceivableService.calculateBalances` tính số dư của nhóm đơn trong khoảng ngày, đầu kỳ bằng 0, bao gồm thanh toán đã xác nhận mới nhất của nhóm đơn. Đây không phải sao kê có số dư đầu kỳ/phát sinh/thanh toán trong kỳ/cuối kỳ, nhưng các nhãn cũ khiến người dùng hiểu như vậy.
- Các endpoint cashflow đại lý vẫn dùng mô hình hoa hồng. Không dùng thay bảng phải thu mới.

Yêu cầu sửa: thống nhất thuật ngữ, bỏ thao tác thanh toán cũ, phân biệt “nhóm đơn theo ngày đặt” với “sao kê theo ngày chứng từ”.

## Phần đã có nền tảng đúng

- NCC: tạo mới chờ duyệt; sửa điều khoản thương mại quay lại chờ duyệt; người tạo/người sửa không tự quyết định duyệt; có lịch sử và kiểm soát ghi đồng thời bằng version.
- OrderTest2: chỉ lấy báo giá đã duyệt theo hiệu lực, giữ bản chụp giá/phí, xử lý giá 0; dùng giá vốn lô khi xuất kho.
- Pipeline đại lý: tiền hàng và phí, giữ nghĩa vụ khi hoàn, hàng giữ hộ không bán lại lần hai; payment xác nhận/đảo payment và số dư trả thừa không bị ép về 0.
- Sổ kinh doanh mới: có tác động nghĩa vụ/thu chi/đảo/điều chỉnh; tổng hợp theo đơn và đối tác. Vấn đề còn lại là các chức năng cũ không dùng đầy đủ cùng nguồn.

## Kiểm chứng lượt này

1. Chạy 5 suites hiện có: 4 suites đạt, 22 tests đạt; 3 tests HTTP/RBAC của supplier-quote controller bị `LOCAL_SANDBOX_OUTBOUND_BLOCKED` vì Supertest kết nối cổng ngẫu nhiên ngoài guard local. Không sửa/nới guard và không kết luận 3 bài đó là lỗi nghiệp vụ. Chưa có kiểm chứng quyền qua HTTP trong lượt này.
2. Script `backend/scripts/audit-quotes-counterparty-local.cjs`: service/controller thật, persistence mô phỏng, không kết nối mạng/database. Tái hiện 7 kiểm tra không đạt: ngày cuối giá đại lý, duyệt cũ sau đổi giá, giá hết hạn cản tạo hàng loạt, vai trò NCC trong danh sách đại lý, điều kiện ngày API giá NCC, tất toán toàn kỳ sau thanh toán nhỏ, nhánh thanh toán cũ không loại đơn mới.
3. Bằng chứng máy đọc: `.local-ledger/quotes-counterparty-audit.json`. Các phát hiện còn lại dựa vào đối chiếu mã nguồn; chưa kiểm tra dữ liệu thật hoặc giao diện trình duyệt.

```powershell
# Trong backend; chỉ mô phỏng, không dùng database
node --require ./scripts/local-ledger-guard.cjs scripts/audit-quotes-counterparty-local.cjs
```

## Thứ tự xử lý đề xuất

1. Dừng suy diễn tất toán cả kỳ và COD thực thu; thống nhất nguồn công nợ NCC/đại lý với sổ.
2. Tính đủ điều chỉnh, phân bổ thanh toán từng nghĩa vụ; kiểm tra trả một phần, trả thừa, đảo và tiền thu hộ ở các bên.
3. Chuẩn hóa hiệu lực và quy trình sửa/duyệt báo giá; sửa tạo hàng loạt.
4. Sửa nhãn/thao tác giao diện và sao kê kỳ; sau đó kiểm thử local xuyên suốt. Không tự chuyển dữ liệu lịch sử hay triển khai hệ thống.
