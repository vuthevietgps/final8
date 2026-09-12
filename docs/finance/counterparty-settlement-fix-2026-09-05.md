# Báo giá, công nợ và quyết toán — sửa local 05/09/2026

## Kết quả và phạm vi

Đã sửa mã nguồn cho báo giá đại lý/NCC, nguồn công nợ chung, bảng đối soát và thanh toán phân bổ. 216/216 kiểm thử tự động đạt; backend và frontend build thành công. Đây là bằng chứng logic/service với dữ liệu mô phỏng, **chưa phải nghiệm thu 10/10 toàn hệ thống**.

Không triển khai, không kết nối database cũ. Các cổng local 27027/3001/4300 không có dịch vụ lắng nghe tại lần kiểm tra cuối. Việc khởi động local trước đó bị automatic approval review từ chối với thông báo `blocked by policy`; không chạy lại bằng đường khác. Chưa thực hiện được nghiệm thu MongoDB transaction và giao diện đầu cuối.

## Các giai đoạn đã thực hiện

1. Tái sử dụng QuoteService, SupplierQuoteService, OrderCalculationService; sửa thời hạn/duyệt/liên kết báo giá.
2. Tái sử dụng operationalEntries, receivedPurchaseValue và LedgerEntry; hợp nhất nghĩa vụ, thanh toán và điều chỉnh trong CounterpartyLedgerService.
3. Thêm SettlementService và màn hình Công nợ & đối soát; nối các lối vào thanh toán cũ; kiểm thử phân bổ, đối trừ, đảo giao dịch và ảnh hưởng lên cảnh báo tài chính.

## Thay đổi chính

| Phần | Hành vi sau sửa |
|---|---|
| Hiệu lực báo giá đại lý | Ngày nhập không có giờ được tính từ 00:00 đến hết ngày cuối theo giờ Việt Nam; từ chối ngày/khoảng ngày sai. |
| Sửa báo giá đã duyệt | Đổi giá, phí hoặc điều khoản liên quan chuyển về chờ duyệt; lưu người sửa và trước/sau; kiểm tra phiên bản chống ghi đè đồng thời. |
| Báo giá hàng loạt | Chỉ chọn đại lý hoạt động; báo giá đã hết kỳ không chặn kỳ mới; không dùng chuỗi `"false"` để bật chế độ hàng loạt. |
| Chọn đối tượng báo giá | Kiểm tra vai trò đại lý, tên lấy từ hồ sơ liên kết khi tạo hoặc đổi đối tượng; không tin tên do client tự gửi để bỏ qua kiểm tra vai trò. |
| Báo giá NCC hiệu lực | Báo giá thiếu effectiveAt phải có createdAt không sau ngày cần áp dụng; chỉ lấy báo giá đã duyệt. |
| Tiền báo giá | Số nguyên đồng không âm, trong giới hạn số nguyên chính xác; giá 0 vẫn hợp lệ. |
| Nguồn công nợ | Nghĩa vụ OrderTest2/PO + tất cả tác động công nợ từ chứng từ xác nhận, bao gồm giảm giá, điều chỉnh và đảo chứng từ. Chứng từ nháp chưa làm thay đổi số dư. |
| NCC thu hộ | COD dự kiến hoặc giao thành công không được tự coi là tiền NCC đã thu. Phải có chứng từ ghi nhận. |
| Thanh toán một phần | Giảm đúng khoản phân bổ; không đánh dấu toàn bộ đơn của kỳ đã trả. |
| Đối trừ | Cùng đối tác, hai chiều bằng nhau, không tạo dòng tiền; thanh toán thu/chi thực tế lập riêng. |
| Bảng đối soát | Bản chụp giữ nguyên; xác nhận bảng riêng với việc thu/chi; luôn hiển thị số dư hiện tại bên cạnh bản chụp. |
| Thay đổi nguồn | Kiểm tra hash trước xác nhận/phân bổ; thiếu đơn nguồn hoặc dữ liệu chờ rà soát thì không tự coi đã tất toán. |
| Chống trùng | Khóa yêu cầu idempotency; mỗi tài khoản + mã giao dịch/số phiếu không ghi lần hai trong chức năng quyết toán; thay nội dung với cùng mã yêu cầu bị từ chối. |
| Ngày thực tế | Lưu ngày thực thu/chi riêng với lúc nhập; không chấp nhận ngày tương lai hoặc trước số dư đầu kỳ tài khoản. |
| Đảo giao dịch | Đảo toàn bộ các dòng phân bổ của giao dịch, giữ lịch sử, chặn đảo hai lần. Đối trừ không được đảo riêng một vế. |
| Đồng thời/hoàn tác | Các dòng sổ và lịch sử giao dịch nằm trong cùng MongoDB transaction; dùng khóa sổ chung và chạm phiên bản đơn/PO để phát hiện chỉnh sửa đồng thời. Cần replica set. |
| Tài chính gián tiếp | DSO đọc khoản đại lý nợ công ty; DPO đọc khoản công ty nợ NCC. Không quay về sổ hoa hồng cũ khi nguồn chuẩn lỗi. |

Màn hình mới được dùng tại `/payments/supplier`, `/payments/agent`, `/purchases/payables`, `/agents/receivables`, `/finance/counterparties`. Các lối vào yêu cầu quyền tài chính. Nhãn “Hoa hồng đại lý” đã đổi thành “Công nợ & đối soát đại lý”. CSV công nợ NCC lấy nguồn chung; PDF hoa hồng cũ không còn dùng để quyết toán tiền hàng. Bảng kỳ cũ chỉ tra cứu, được gắn nhãn lịch sử.

## Quy trình quyết toán nhanh

1. Chọn NCC/đại lý, rà soát nghĩa vụ và chứng từ. Dấu dương: đối tác phải trả công ty; dấu âm: công ty phải trả đối tác.
2. Chọn đơn đủ dữ liệu, lập bản chụp; để riêng đơn đang tranh chấp hoặc thiếu chứng từ.
3. Xuất CSV, đối chiếu với đối tác; nhập căn cứ hai bên đã thống nhất và xác nhận bảng.
4. Nếu có hai chiều công nợ, lập chứng từ đối trừ cân bằng với căn cứ riêng.
5. Khi thực thu/chi: nhập số tiền, tài khoản, ngày thực tế, mã giao dịch/số phiếu và phân bổ từng đơn. Tổng phân bổ phải đúng số tiền thực tế.
6. Chỉ số dư bằng 0 mới là hết nợ. Sai chứng từ thì đảo giao dịch và ghi lại; không xóa hoặc sửa lịch sử đã xác nhận.

Ví dụ: đại lý nợ 300.000, có giảm giá đã xác nhận 20.000, đã thu 100.000 → còn phải thu 180.000. Giảm giá 20.000 không được trình bày như đã thu tiền.

## Kiểm thử đã chạy

| Nhóm | Kết quả |
|---|---:|
| Báo giá, bản chụp, công nợ, quyết toán, tương thích API, DSO/DPO, chặn dự báo thiếu lịch và OpsAction | 91/91, 11 suites |
| Sổ kinh doanh, điều kiện ghi nhận, chính sách đại lý, từng lần giao, bốn trường hợp kinh doanh, sở hữu/hoàn kho | 125/125, 10 suites |
| Backend Nest build | Đạt |
| Frontend Angular build, gồm các route mới | Đạt |
| Cú pháp script kiểm thử MongoDB local | Đạt; chưa chạy nội dung tích hợp |

Bằng chứng: `.local-ledger/quotes-counterparty-regression.json`, `.local-ledger/order-ledger-regression.json` và các log tương ứng. Không cộng số lần chạy lặp vào tổng 216 ca.

Chạy lại nhóm công nợ từ thư mục backend:

```powershell
node --require ./scripts/local-ledger-guard.cjs scripts/audit-quotes-counterparty-local.cjs
npm run build
```

Script `backend/scripts/verify-settlement-local.cjs` đã chuẩn bị để kiểm chứng transaction thật, rollback sau khi ghi dòng sổ, hai bảng cùng trả một khoản, mã giao dịch trùng, đối trừ và đảo. Script chỉ dùng một database tổng hợp mới trên replica set local đã chạy sẵn ở 27027, tự kiểm tra tên replica set, rồi dọn đúng database test của lượt đó. Không khởi động dịch vụ và không đọc .env. **Chưa có kết quả thực thi script này**.

## Giới hạn cần phân biệt trước khi nghiệm thu

- 216 ca đạt không chứng minh MongoDB đồng thời/rollback hoặc Angular/API/auth từ đầu đến cuối; đây vẫn là cổng nghiệm thu chưa hoàn tất do dịch vụ local chưa chạy.
- Chưa có lịch đến hạn được xác lập cho mô hình công nợ mới. Số phải thu/phải trả vẫn có; dự báo đến hạn/quá hạn được đánh dấu chưa có dữ liệu. Các trường hoa hồng/thu nhập cũ không còn tương đương được trả `null`, không giả thành 0. Financial Control từ chối dùng snapshot thiếu lịch để xác nhận ngân sách khả dụng. Không đồng nghĩa chức năng dự báo tiền và đầu tư ads đã được nghiệm thu toàn bộ.
- Phạm vi chống trùng mã ngân hàng hiện áp dụng các thao tác trong bảng quyết toán. Phiếu nhập qua Sổ kinh doanh riêng vẫn dùng idempotency của phiếu; chưa có nhập sao kê ngân hàng và đối chiếu mã giao dịch xuyên mọi nguồn tự động.
- Lịch sử cũ, báo giá ngày cũ và cờ “đã trả” cũ không tự được chuyển thành chứng từ tiền thật. Phải đối chiếu chứng từ/số dư đầu kỳ trước khi đưa vào nguồn chuẩn.
- Công nợ hiện tại theo nhóm đơn không phải sổ cái khóa kỳ lịch sử. Thay đổi nghiệp vụ hợp lệ sau ngày lập bảng làm thay đổi số dư hiện tại; bản chụp vẫn giữ nguyên.
- Mỗi bảng tối đa 500 khoản; nguồn đọc có giới hạn 10.000 đơn/10.000 PO/50.000 chứng từ. Vượt giới hạn sẽ báo lỗi, không cắt bớt số liệu rồi tính như đầy đủ.
- Dữ liệu sai hoặc chứng từ không có thật vẫn làm kết quả sai. Hệ thống kiểm soát ràng buộc và lưu vết; không tự chứng minh nội dung nhập là sự kiện ngoài thực tế.

## Tệp chính

- `backend/src/quote/quote-validity.ts`, `quote.service.ts`, `quote.controller.ts`, DTO/schema/tests; supplier-quote DTO và service.
- `backend/src/business-ledger/counterparty-balances.ts`, `counterparty-ledger.service.ts`, `settlement.*`, `ledger-events.ts`, module/controller/schema và BusinessLedgerService.
- `backend/src/agent-receivable/agent-receivable.service.ts`, `backend/src/supplier-payable/supplier-payable.service.ts`, `services/statement-management.service.ts`, modules.
- `backend/src/finance/cashflow-safety.service.ts`, `financial-control.service.ts`, `backend/src/ops-action/ops-action.service.ts` và kiểm thử liên quan.
- `frontend/src/app/features/business-ledger/counterparty.component.*`, routes/sidebar và hiển thị ngày báo giá.
- `backend/scripts/audit-quotes-counterparty-local.cjs`, `audit-business-model-local.cjs`, `verify-settlement-local.cjs`.

Các tệp khác đã thay đổi sẵn trong workspace không bị reset/checkout/commit. Báo cáo rà soát 04/09 là bằng chứng trước sửa; dùng tài liệu này để xem trạng thái hiện tại.
