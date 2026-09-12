# Công nợ, lịch thanh toán và căn cứ phân tích vốn

## Phạm vi đã triển khai

Lịch công nợ nằm cùng nguồn báo cáo của nhà cung cấp và đại lý, theo khóa `partyKey + orderId + direction`. `orderId` là mã đơn bán, hoặc `purchase:<id>` với PO mua hàng. Chiều `receivable` là đối tác phải trả công ty; `payable` là công ty phải trả đối tác. Không suy chiều từ tên module cũ.

Tái sử dụng `CounterpartyLedgerService`, `counterpartyBalances`, sổ `businessledgerentries`, các bảng `businessledgersettlements`, nguồn đơn/PO, và màn Công nợ & đối soát đối tác. Bổ sung collection `businessledgerdebtschedules` để lưu các phiên bản lịch có căn cứ, không sửa đè lịch sử. Đây là một lịch cho số dư mỗi đơn/PO và chiều công nợ, chưa chia nhiều kỳ trả góp trong cùng một khoản.

## Cách sử dụng

1. Mở Công nợ nhà cung cấp hoặc đại lý, chọn đối tác, đến **Lịch thanh toán theo từng khoản**.
2. Chọn **Lịch & chứng từ**, nhập ngày đến hạn theo thỏa thuận và ngày hẹn trả nếu có. Nhập lý do và căn cứ (số hợp đồng, biên bản, xác nhận của đối tác).
3. Lưu phiên bản mới. Bỏ trống ngày nghĩa là chưa rõ, không phải đã trả hay đúng hạn. Hẹn lại không thay ngày đến hạn nếu chưa có thỏa thuận thay hạn.
4. Thanh toán qua phiếu thu/chi sổ hoặc bảng đối soát hiện có, phân bổ đúng đơn/PO. Chỉ bút toán xác nhận có tiền công ty mới là thực thu/chi; đối trừ và thu hộ được ghi loại riêng.
5. Xem lịch sử trả từng phần, trễ hạn, trễ hẹn và đảo phiếu ngay trong khoản. Nút **Xuất dữ liệu công nợ và lịch vốn có căn cứ (JSON)** xuất toàn bộ các đối tác trong phạm vi nguồn hỗ trợ.

Ngày cũ `ordertest2.agentPaymentDueDate` và `supplierpayables.dueDate` được nối thành `legacyCandidates`, giữ mã nguồn và chiều công nợ của mô hình hoa hồng cũ. Cần đối chiếu trước khi ghi lịch hợp nhất; hệ thống không tự chuyển lịch hoa hồng thành hạn nợ hàng hóa. Chứng từ tiền cũ chưa vào sổ cũng không được đếm thêm lần thứ hai.

## Quy tắc lịch sử và số liệu

- `dueDate` là hạn nghĩa vụ; `promisedDate` là hẹn trả hiện tại. `daysOverdue` theo hạn, `promiseDaysOverdue` theo hẹn. Cả hai dùng ngày Việt Nam, hết ngày hạn mới quá hạn.
- Sửa lịch lưu thời điểm server, người ghi, số dư tại lúc sửa, lý do và căn cứ. Khóa phiên bản chống ghi đè đồng thời; `requestKey` chống tạo trùng khi thử lại. Chỉ khoản có nguồn đủ đối chiếu và đúng chiều số dư mới được ghi lịch.
- Lịch sử mỗi thanh toán dùng phiên bản đã được ghi nhận trước thời điểm giao dịch. Nếu chưa có hạn lúc đó, trả `lateDays=null` và `unknown_historical_deadline`, không hồi tố một hạn vừa nhập để kết luận trả trễ. `latePaymentCount` chỉ đếm phiếu tiền còn hiệu lực có hạn đã biết.
- Phiếu đã đảo vẫn hiện kèm mã phiếu đảo, nhưng không được đếm là tiền còn hiệu lực. Khoản còn dư tiếp tục quá hạn. Đối trừ không trở thành tiền về.
- Lịch sử sửa còn cho biết khoản còn dư và đã trễ hạn/hẹn cũ bao nhiêu ngày tại lúc sửa. Hẹn mới không xóa bằng chứng trễ hẹn cũ.
- Số dư đổi chiều không kế thừa hạn của chiều đối diện. Khoản đã hết số dư giữ lịch sử nhưng không còn dự kiến thu/chi.
- `paymentSchedule.scheduledByDay` lấy ngày hẹn nếu có, nếu không lấy ngày đến hạn; giữ nguyên ngày quá khứ, không đẩy tiền quá hạn thành tiền chắc chắn về hôm nay. Tách phải thu, phải trả, chưa có lịch và số tiền cần rà soát.
- Báo cáo trả thời điểm `generatedAt`, `schemaVersion`, `evidenceHash` của dữ liệu xuất và mã chứng từ nguồn. `sourceHash` dùng cho đối soát chỉ băm số liệu tài chính; thay lịch hoặc thời gian trôi qua không làm thay đổi mã này.
- Sửa lịch phát sự kiện làm mới báo cáo tài chính hiện có. Không phát sinh bút toán tiền, không tính lại lợi nhuận ads, không thay ngân sách quảng cáo.

## API cho Codex đọc căn cứ

Các đường dẫn dưới đây dùng tiền tố `/api`, xác thực và quyền tài chính hiện có. Không cấp quyền mới hoặc truy cập mặc định cho AI.

| Nhu cầu | API |
|---|---|
| Toàn bộ công nợ và lịch vốn hiện tại, lịch sử và nguồn | `GET /api/finance/business-ledger/capital-evidence` |
| Tổng hợp tên và số dư đối tác | `GET /api/finance/business-ledger/counterparties?kind=supplier` hoặc `kind=agent` |
| Chi tiết từng đối tác | `GET /api/finance/business-ledger/counterparties/:partyKey` |
| Ghi phiên bản lịch mới | `POST /api/finance/business-ledger/debt-schedules` |
| Tiền, doanh thu, chi phí, lợi nhuận theo các chiều | `GET /api/finance/business-ledger/report?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Hiệu quả ads và dữ liệu theo ngày | `GET /api/finance/business-ledger/ad-group-management?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| Đơn và kết quả giao hàng | `GET /api/test-order2/:id` |
| Chi tiết hàng hoàn | `GET /api/returns/:id` |
| Sản phẩm | `GET /api/products/:id` |

Trong dữ liệu công nợ, dùng `orderId`, `context.productId`, `context.adGroupId`, `partyKey` để nối sang nguồn nghiệp vụ. PO có tiền tố `purchase:`; không coi PO là đơn bán. Sổ lợi nhuận có các chiều sản phẩm/nhóm sản phẩm/nhóm ads; không cộng các chiều với nhau vì chúng cùng tổng hợp một nguồn.

Ví dụ câu hỏi sau khi cung cấp JSON hoặc quyền đọc ERP: “Trong 14 ngày tới, những khoản phải trả nào chưa có nguồn tiền tương ứng? Nêu số liệu, khoản chưa rõ hạn và chứng từ làm căn cứ.” Hoặc: “Nhóm ads nào có lãi nhưng bị hạn chế vốn do đối tác trễ hẹn? Tách đánh giá ads và rủi ro thu tiền.” Codex phải đọc thêm sổ tiền và nguồn ads khi trả lời; bản xuất công nợ riêng không chứa toàn bộ vốn khả dụng, khoản vay, hàng tồn hay công suất sản xuất.

## Kiểm chứng và giới hạn triển khai

Chạy từ backend:

```powershell
npm run build
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent src/business-ledger src/finance/cashflow-counterparty.spec.ts src/finance/events/finance-event-listener.rebuild.spec.ts
node scripts/audit-profit-finance-logic-20260905.cjs
```

Frontend: `npm run build`. Index duy nhất của collection lịch được tạo qua `DebtScheduleService.onModuleInit`, đồng nhất với cơ chế bảng đối soát hiện có.

Kết quả ngày 05/09/2026: backend/frontend build đạt; 16 suite / 152 test đạt; audit 14/14, không kết nối cơ sở dữ liệu hay gọi nhà cung cấp quảng cáo. Test bao phủ ghép nguồn, phiên bản/ghi trùng/xung đột, ngày Việt Nam, trả từng phần, đổi hẹn, đảo phiếu, đối trừ, lịch sử chưa rõ hạn, sự kiện làm mới báo cáo và tính ổn định của mã đối soát tài chính.

Chưa tự điền lịch thực tế, chưa triển khai lên production và chưa kết nối MongoDB doanh nghiệp trong lượt sửa này. Dữ liệu lịch sử thiếu chứng từ/thời hạn cần được nhập hoặc đối chiếu. API công nợ đọc hiện trạng; không tuyên bố tái dựng chính xác mọi số dư của một ngày quá khứ từ bản chụp đơn hiện tại. Các trường dự báo hoa hồng cũ vẫn không được dùng thay cho lịch công nợ mua bán; dữ liệu chuẩn mới được trả riêng ở `paymentSchedule` trong API công nợ và các adapter tài chính. Chưa thay thuật toán phê duyệt vốn hay triển khai AI tự quyết định.
