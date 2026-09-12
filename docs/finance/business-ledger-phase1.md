# Công nợ, tiền thực nhận và lợi nhuận — giai đoạn 1

> Cập nhật sau khi chạy local: xem [kết quả kiểm chứng và cách chạy](local-ledger-verification.md). **Các điều kiện dưới đây áp dụng cho sổ `business-ledger`, chưa thay công thức tự động của `test-order2`.** Sổ mới chặn doanh thu bán lẻ trước giao thành công, yêu cầu sản xuất xong + vận đơn với đại lý, và chốt chính sách giá vốn hàng hoàn theo đơn. Danh mục sản phẩm có `ledgerReturnPolicy`; profile yêu cầu xác nhận `returnPolicy`. Xem [rà soát chuỗi lợi nhuận đơn hàng](order-profit-chain-audit.md) để biết các sai lệch còn tồn tại.

Ngày: 2026-09-04. Căn cứ: chủ hệ thống xác nhận trong phiên làm việc rằng NCC, công ty và đại lý có thể thu toàn bộ/một phần tiền; hàng có thể đi thẳng từ NCC hoặc qua kho; có cả bán lẻ và giá bán riêng cho đại lý.

## Mô hình và phạm vi

Mô hình chuẩn là thương mại kết hợp bán lẻ/bán đại lý, giao hàng và thu hộ linh hoạt. Mô tả cũ `domestic_dropship_tier1_agency`, `commission_only`, `cash_collection_party=supplier` chỉ còn là một trường hợp, không phải giả định mặc định cho toàn ERP.

Theo AGENTS.md, triển khai theo từng giai đoạn. Giai đoạn này tạo sổ có thể sử dụng và kiểm chứng tại `/finance/business-ledger`, bổ sung đường vào từ từng đơn `/orders/test2`. Không tự chuyển lịch sử tài chính, không thay toàn bộ báo cáo/auto-control cũ, không gọi provider và không điều khiển ads. Các giai đoạn migration/cutover và tích hợp quyết định ads cần chỉ định tiếp theo.

## Kết quả rà soát trước khi viết mã

| Module đã đọc / tái sử dụng | Kết luận |
|---|---|
| `test-order2` | Dùng định danh đơn, sản phẩm, NCC, đại lý, nhóm quảng cáo; số tiền cũ chỉ là gợi ý để đối soát. |
| `product`, `supplier-quote`, `quote` | Giữ danh mục và báo giá; không coi báo giá hay `PaidAmount` là chứng từ thu tiền. |
| `inventory` | Đã có batch và WAC; giá vốn xuất kho cần căn cứ xuất kho, không phát sinh lại nợ NCC từ giá vốn này. |
| `supplier-payable`, `agent-receivable`, `order-payment` | Còn nhánh mặc định NCC thu COD, công ty trả hoa hồng và quy tắc clawback không phù hợp mọi đơn. Không suy diễn lịch sử sang sổ mới. |
| `finance` | `calculateMasterBankBalance` đang suy từ nguồn vốn, số tiền thanh toán đơn và chi phí; không phải sổ tài khoản được đối soát. Không cộng thêm sổ mới vào công thức cũ vì sẽ có nguy cơ trùng tiền. |
| `advertising-cost` | Dùng chi tiêu thực đã nhập/sync trong ERP, chỉ đọc dữ liệu nội bộ. Không coi chi tiêu đã phát sinh là chứng từ ngân hàng đã chi. |
| Phân quyền | Dùng JWT, RolesGuard, `finance` + `finance.cashflow.manage`; hiện chỉ vai trò có cả hai quyền được dùng sổ. |

## Quy tắc dữ liệu

1. `LedgerOrderProfile` chốt quan hệ bán lẻ/đại lý và nguồn hàng cho một đơn. Định danh lấy phía server; không cho client tự chỉ định sản phẩm/NCC/đại lý trên từng bút toán. Khi nguồn đơn thay đổi, chặn ghi mới cho đến khi rà soát ánh xạ; bút toán đảo vẫn dùng được để sửa sai.
2. `LedgerEntry` có `draft`, `confirmed`, `rejected`. Chỉ `confirmed` tác động báo cáo; ngày, người tạo, người xác nhận, chứng từ và diễn giải được giữ. Không có sửa/xóa bút toán đã xác nhận. Sửa sai bằng một bút toán đảo có tác động ngược chính xác.
3. Mỗi yêu cầu tạo có idempotency key và hash nội dung. Xác nhận dùng cập nhật có điều kiện trạng thái. Mongo unique indexes bảo vệ trùng key và chỉ cho một bút toán đảo đã xác nhận cho mỗi bản gốc. Module khởi động phải tạo được indexes mới phục vụ ghi sổ.
4. `LedgerAccount` là từng tài khoản/quỹ công ty, có số dư đầu kỳ được xác nhận, ngày và căn cứ. Số dư = đầu kỳ + tiền vào xác nhận − tiền ra xác nhận + điều chỉnh kiểm quỹ/bút toán đảo. Giao dịch trước mốc đầu kỳ bị chặn để không cộng lại tiền đã nằm trong số dư. Khi phát hiện số dư sai, dùng điều chỉnh tăng/giảm có chứng từ kiểm quỹ, không sửa đầu kỳ hoặc giả tạo một giao dịch thu/chi. Không đồng bộ ngân hàng và không tự tuyên bố đã khai báo đủ mọi tài khoản doanh nghiệp.
5. Mọi số tiền VND là số nguyên. Không tự quy đổi ngoại tệ. Sổ kiểm tra giới hạn số học trước khi xuất tổng.

## Loại nghiệp vụ

| Loại | Lợi nhuận | Công nợ | Tiền công ty |
|---|---|---|---|
| `sale` | Tăng doanh thu công ty theo giá bán của công ty | Bên mua phải trả | Không đổi |
| `sale_credit` | Giảm doanh thu do trả/giảm giá thực tế | Giảm nợ bên mua hoặc tạo nghĩa vụ hoàn lại | Không đổi |
| `direct_cost` | Ghi giá vốn NCC giao thẳng | Công ty phải trả NCC | Không đổi |
| `supplier_credit` | Giảm giá vốn phần NCC thực nhận lại/giảm giá | Giảm khoản phải trả NCC | Không đổi |
| `inventory_cost` / `inventory_recovery` | Giá vốn xuất kho / phần giá vốn thực thu hồi | Không tạo lại nợ tiền mua kho | Không đổi |
| `expense` / `expense_credit` | Chi phí / giảm chi phí thực tế | Tăng/giảm nghĩa vụ trả đúng đối tác | Không đổi |
| `opening_receivable` / `opening_payable` | Không đổi | Chuyển số công nợ còn lại đã đối chiếu tại mốc chuyển sổ | Không đổi |
| `payment` | Không đổi | Theo bên trả/bên nhận và nghĩa vụ được thanh toán | Chỉ đổi nếu công ty thực nhận/chi qua tài khoản đã khai báo |
| `cash_adjustment_in` / `cash_adjustment_out` | Không đổi | Không đổi | Sửa chênh lệch sổ tiền có căn cứ kiểm quỹ; tách khỏi cột thu/chi |
| `reversal` | Đảo đúng bút toán gốc | Đảo đúng bút toán gốc | Đảo đúng bút toán gốc; không phải chứng từ chuyển tiền hoàn lại |

Tiền khách cuối trả trong đơn bán đại lý được tính vào nghĩa vụ mua của đại lý. Nếu chính đại lý thu tiền khách thì công nợ giữa đại lý và công ty không tự giảm; chỉ giảm khi đại lý chuyển lại hoặc một bên khác thực thanh toán nghĩa vụ đó.

Ví dụ: giá công ty bán đại lý 400k, giá NCC 300k, phí giao công ty chịu 20k, quảng cáo 50k. Lãi đã ghi nhận là 30k bất kể ai thu 500k từ khách cuối. Nếu NCC thu 500k và giữ 300k thì NCC còn chuyển 200k; công ty chuyển phần 100k của đại lý. Nếu công ty thu trực tiếp thì công ty trả 300k cho NCC và 100k cho đại lý. Nếu đại lý thu thì đại lý còn trả công ty 400k. Các khoản chuyển này không ghi doanh thu lần nữa.

Hàng hoàn không tự sinh khoản đại lý nợ toàn bộ giá báo. Ghi phần doanh thu hủy, giá vốn thu hồi, phí thực chịu và giao dịch hoàn tiền riêng, theo thỏa thuận có chứng từ. Nếu có khoản phạt/bồi thường cần lập nghiệp vụ được rà soát riêng, không suy ra từ đổi trạng thái giao hàng.

## Báo cáo và ý nghĩa các số

- Tiền và công nợ tính lũy kế đến cuối ngày `to` theo múi giờ +07. Số dư tiền chỉ bao phủ các tài khoản đã khai báo. Không cộng tiền đang ở NCC/đại lý vào tiền công ty.
- Công nợ tổng hợp theo đối tác, giữ khoản còn phải thu/phải trả trên từng đơn. Chênh lệch tổng khác đơn chỉ để xem, không tự tạo chứng từ bù trừ hay tự tất toán.
- Lãi/lỗ theo ngày nghiệp vụ trong khoảng `from`–`to`, từ doanh thu − giá vốn − chi phí đã ghi − ads thực có trong ERP. Có nhóm theo sản phẩm, đại lý, nhóm quảng cáo và từng đơn. Đây là **lãi/lỗ đã ghi nhận**, chưa bảo đảm mọi chi phí đều đã nhập.
- Ads phân bổ theo số lượng đơn thuộc nhóm trong khoảng báo cáo. Phần không có đơn hoặc ID thuộc nhiều nguồn/tài khoản được giữ ở dòng chưa phân bổ; không bỏ chi phí nhóm không ra đơn. Dùng phân bổ phần dư VND để các chiều báo cáo khớp tổng.
- Không nhập lại tiền ads vào `expense` nếu đã có ở module advertising-cost. Thanh toán tiền ads vẫn ghi `payment` để phản ánh tiền thực chi. Chi phí nhân công/vận hành chưa phân bổ có thể ghi expense ngoài đơn, xuất hiện ở dòng chưa phân bổ.
- Báo cáo không dùng `supplierPaidAmount`, `agentPaidAmount`, `codAmount` để tự xác nhận tiền. Đơn chưa ghi đủ doanh thu/giá vốn và chứng từ chờ được đánh dấu cần kiểm tra.
- `settled` chỉ nghĩa là nghĩa vụ **đã ghi trên sổ** của đơn có số dư 0; không chứng minh mọi nghĩa vụ đã được nhập đủ.
- Giới hạn giai đoạn đầu: khoảng lãi/lỗ tối đa 93 ngày; tối đa 20.000 bút toán đến cuối kỳ, 10.000 đơn/profile, 20.000 dòng ads. Vượt ngưỡng trả lỗi, không trả số tổng bị cắt bớt. Pending hiển thị tối đa 200 dòng; báo cáo vẫn đếm số chờ trong phạm vi đọc.

## Hiệu chỉnh báo cáo cũ

- Sửa khóa gộp sản phẩm sau `populate().lean()` bằng `_id`, tránh hai sản phẩm biến thành cùng khóa `[object Object]`.
- Cột hoa hồng dùng `agentCommissionAmount`, không lấy giá báo đại lý nhân số lượng.
- `GET /test-order2/daily-profit-report` trả `cashAvailable: null` và `cashAvailableStatus: requires_account_reconciliation`. Giao diện bỏ nhãn “Tiền chắc ăn/có thể phân bổ” đang dùng lợi nhuận làm số dư tiền. Đây là thay đổi contract có chủ đích; client ngoài frontend cần xử lý null.

## Bắt đầu sử dụng

1. Chọn mốc chuyển sổ và đối chiếu số dư thật từng tài khoản/quỹ. Khai báo đầu kỳ; không nhập lại các thu/chi đã nằm trong số dư này.
2. Với đơn mới, mở “Sổ tiền” từ test-order2, xác nhận bán lẻ/đại lý và NCC giao thẳng/hàng kho. Tạo các nghiệp vụ bán, giá vốn, chi phí theo chứng từ; xác nhận sau khi kiểm tra.
3. Với công nợ cũ, chỉ chuyển **số còn phải thu/trả** đã đối chiếu bằng nghiệp vụ công nợ đầu kỳ. Không đồng thời nhập lại toàn bộ bán/mua lịch sử cho cùng nghĩa vụ. Chuyển số dư công nợ không tái tạo lợi nhuận lịch sử.
4. Từng khoản thu/chi, kể cả một phần và chuyển giữa các bên, được lưu chờ. Chỉ xác nhận khi đã có căn cứ giao nhận tiền. Góp vốn/chuyển quỹ ngoài đơn là cash-only; chỉ chọn “thanh toán công nợ” khi thực sự trả nghĩa vụ đã ghi cho cùng mã đối tác.
5. Xem báo cáo, xử lý các dòng cần kiểm tra và phần chưa phân bổ trước khi dùng lãi/lỗ để quyết định ads thủ công.

## API

Prefix `/api/finance/business-ledger`:

- GET/POST `/accounts`
- POST `/profiles`
- GET `/orders/:id`
- POST `/entries`
- POST `/entries/:id/confirm`
- POST `/entries/:id/reject`
- GET `/pending`
- GET `/report?from=YYYY-MM-DD&to=YYYY-MM-DD`

Không endpoint nào chuyển tiền thật, gọi Google/Meta/TikTok API, hay sửa trạng thái thanh toán của đơn cũ.

## Xác minh

Từ `backend`:

```powershell
npm run build
npm test -- --runInBand --runTestsByPath src/business-ledger/business-ledger.rules.spec.ts src/business-ledger/business-ledger.service.spec.ts src/test-order2/services/order-report.service.spec.ts src/test-order2/services/order-calculation.supplier-approval.spec.ts src/supplier-quote/supplier-quote.service.spec.ts src/google-ads/google-ads-profit-enrichment.service.spec.ts
```

Từ `frontend`: `npm run build`.

Kết quả chạy cuối ngày 2026-09-04: backend build đạt; frontend production build đạt; 6 test suites / 49 tests đạt; kiểm tra whitespace diff các file sửa đạt. Không kết nối cơ sở dữ liệu sản xuất trong lần kiểm tra này.

Các test kiểm tra thu tiền bởi ba bên có cùng lợi nhuận; thu một phần; chứng từ chưa xác nhận; hàng hoàn; giá vốn kho; tiền vốn/chuyển nội bộ; đảo bút toán; công nợ khác đơn không tự bù trừ; ads không có đơn; ID ads mơ hồ; số tiền/ngày không hợp lệ; idempotency; xác nhận có điều kiện; từ chối sửa bản đã xác nhận; quyền; trường đầu vào không được giả mạo xác nhận/hiệu ứng tài chính; và sửa báo cáo cũ.

Đây là unit tests với dữ liệu giả lập và production builds. Chưa nghiệm thu end-to-end trên MongoDB thật (Docker CLI có nhưng Docker engine chưa chạy), chưa đối soát sao kê/chứng từ thật và chưa triển khai máy chủ.

## Phần tiếp theo chưa triển khai trong giai đoạn này

Migration có đối soát toàn bộ lịch sử; sửa/phiên bản hóa profile thương mại; phiếu mua kho và công nợ nhập kho có liên kết tự động; chứng từ bù trừ nhiều đơn; phân bổ nhiều đơn trên một khoản ngân hàng; đối chiếu sao kê; điều kiện hoa hồng/bồi thường; tự ghi nhận từ luồng vận hành sau khi chốt chính sách; chuyển mọi dashboard tài chính và ads sang sổ đã kiểm chứng. Các module finance/settlement/ads cũ vẫn cần giai đoạn cutover, không coi chúng đã dùng công thức mới.
