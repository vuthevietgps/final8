# Rà soát và sửa logic lợi nhuận, tài chính — 05/09/2026

**Kết quả cuối: 14/14 đối chiếu đạt, không còn sai lệch trong bộ audit.** Backend build thành công; 36/36 Jest suite với 253/253 test đạt. Frontend cũng build thành công sau thay đổi giao diện quản trị nhóm sản phẩm và nhóm quảng cáo.

Audit chạy service thực với persistence trong bộ nhớ, không kết nối cơ sở dữ liệu và không gọi nhà cung cấp quảng cáo. Tệp kết quả chi tiết: [profit-finance-logic-audit-2026-09-05-results.json](profit-finance-logic-audit-2026-09-05-results.json).

## Kết quả theo tám nhóm chức năng

| Hạng mục | Logic sau sửa | Trạng thái |
|---|---|---|
| Lợi nhuận nhóm quảng cáo | Đối chiếu toàn bộ chi phí quảng cáo nguồn trong kỳ, kể cả ngày không có đơn; phần chưa phân bổ vẫn làm giảm lợi nhuận và được thể hiện riêng. | Đạt A01/C01/C02 |
| Lợi nhuận đơn hàng | Khóa giá bán gốc ngay khi đã ghi nhận một phần doanh thu; giữ nguyên giá, vốn và chi phí đã phát sinh theo trạng thái nghiệp vụ. | Đạt A09/C05 |
| Lợi nhuận sản phẩm | Dùng cùng sổ lợi nhuận hợp nhất với đơn hàng; giữ chi phí đã phát sinh của đơn chưa ghi nhận doanh thu; nhãn ngày dùng ngày nghiệp vụ Việt Nam. | Đạt A02/A03/C02 |
| Lợi nhuận nhóm sản phẩm | Tổng hợp từ cùng các dòng sổ với đơn, sản phẩm và nhóm quảng cáo; ưu tiên bản chụp nhóm sản phẩm tại thời điểm giao dịch. | Đạt C02 |
| Dòng tiền, quản trị tài chính | Số dư CFO đọc số dư đầu kỳ và bút toán tiền đã xác nhận trong sổ mới; bút toán đảo được loại khỏi tiền thu còn hiệu lực. | Đạt A04/A05/C03 |
| Quản trị nhóm quảng cáo | Hiệu quả dựa trên lợi nhuận và chất lượng dữ liệu lợi nhuận; tỷ lệ thu tiền/công nợ theo dõi riêng. Dữ liệu quảng cáo âm hoặc trùng danh tính bị đánh dấu `data_issue`. | Đạt A05/A06 |
| Quản trị sản phẩm | Chặn xóa cứng sản phẩm đã được đơn, báo giá, kho, nội dung, mua hàng, hoàn hàng hoặc công nợ tham chiếu; số lượng sản phẩm trong nhóm được tính từ dữ liệu thật. | Đạt A08 |
| Quản lý chi phí | Ràng buộc số tiền quảng cáo/chi phí; khóa lịch sử chi phí đã xác nhận hoặc đã thanh toán; giữ chi phí nhân công và chi phí khác của ngày không có đơn dưới dạng chưa phân bổ. | Đạt A06/A07/C04 |

## Các sai lệch đã sửa

| Mã | Sai lệch ban đầu | Kết quả sau sửa |
|---|---|---|
| A01 | Nhóm ads lỗ vẫn có thể bị phân loại có lãi khi chi phí phát sinh vào ngày không có đơn. | Tổng chi nguồn 600.000đ được trừ đầy đủ; lợi nhuận mẫu là −400.000đ và trạng thái là lỗ. |
| A02 | Báo cáo sản phẩm bỏ chi phí đã phát sinh của đơn chưa ghi nhận doanh thu. | Mẫu hợp nhất trả đúng 80.000đ. |
| A03 | Nhãn ngày đầu kỳ bị lùi một ngày do chuyển ngày +07 sang chuỗi UTC. | Khoảng ngày trả về đúng `2026-08-03` đến `2026-08-03`. |
| A04 | Phiếu thu/chi ở sổ mới không tác động số dư CFO. | Số dư mẫu từ 1.000.000đ sau phiếu chi 200.000đ còn 800.000đ. |
| A05 | Phiếu thu đã đảo vẫn được tính như tiền khách còn giữ; đánh giá ads bị trộn với thu tiền. | Tiền thu khách ròng bằng 0, công nợ 900.000đ; nhóm vẫn `profitable`, `canProposeScale=true` theo hiệu quả kinh tế. Chỉ báo đề xuất không xác nhận đủ vốn hay cho phép thực thi. |
| A06 | Chi phí quảng cáo âm bị bỏ qua nhưng nhóm vẫn được đánh giá tốt. | Dữ liệu bị gắn `data_issue`, độ tin cậy bằng 0 và không được đề xuất tăng. |
| A07 | Chi phí chung trong ngày không có đơn biến mất khỏi lợi nhuận. | Chi phí 100.000đ được giữ ở dòng chưa phân bổ, lợi nhuận tổng là −100.000đ. |
| A08 | Có thể xóa cứng sản phẩm đang được đơn hàng tham chiếu. | Service trả lỗi xung đột và hướng người dùng chuyển sản phẩm sang Ngừng bán. |
| A09 | Có thể sửa giá gốc của đơn bán lẻ đã giao một phần. | Mọi thay đổi giá sau khi đã ghi nhận doanh thu đều bị chặn; phải dùng chứng từ điều chỉnh. |

Năm kiểm soát nền C01–C05 cũng đạt: giữ đủ chi phí quảng cáo nguồn; tổng đơn/sản phẩm/nhóm sản phẩm/nhóm ads khớp nhau; thu tiền rồi đảo phiếu phục hồi số dư và công nợ; phân bổ VND nguyên bảo toàn tổng; đơn bán lẻ dùng đúng giá thỏa thuận và chỉ trừ phí hoàn khi phí đã phát sinh.

## Thay đổi kỹ thuật chính

- `BusinessLedger` trở thành nguồn hợp nhất cho các chiều lợi nhuận. Chi phí ads, nhân công và chi phí khác được đối chiếu theo ngày nghiệp vụ; phần không gắn được vào đơn vẫn nằm trong tổng toàn công ty.
- `FinanceService` và kiểm soát dòng tiền dùng tài khoản tiền đã đăng ký cùng bút toán sổ đã xác nhận. Số dư khả dụng không còn cộng hạn mức tín dụng chưa giải ngân.
- Thu tiền được tính riêng theo đối tượng khách hàng/đại lý và trạng thái hiệu lực của bút toán, thay vì dùng mọi dòng tiền vào. Chỉ số này không quyết định trạng thái hiệu quả ads.
- Chi phí quảng cáo được kiểm tra không âm, hữu hạn và trong giới hạn ở DTO, schema, create/update/import và các luồng đồng bộ. Sai dữ liệu khiến báo cáo dừng hoặc đánh dấu cần kiểm tra.
- Đơn hàng lưu bản chụp nhóm sản phẩm và khóa giá bán gốc sau lần ghi nhận doanh thu đầu tiên.
- Sản phẩm có tham chiếu chỉ được ngừng bán; `productCount` của nhóm sản phẩm được tính từ collection sản phẩm và hiển thị chỉ đọc.
- OtherCost đã xác nhận và LaborCost đã vào bảng kê/đã trả được giữ bất biến; thao tác xác nhận có kiểm tra cạnh tranh và chạy validator.

## Bằng chứng và cách chạy lại

- Backend: `npm run build` — exit 0.
- Frontend: `npm run build` — exit 0.
- Jest: **36 suites, 253 tests đạt**, exit 0. Log lỗi Mongo/Redis, timeout và chi phí ads không hợp lệ là các tình huống thất bại được chủ động giả lập trong test.
- Audit: **14 đối chiếu, 14 đạt, 0 sai lệch**, exit 0; `databaseConnections=0`, `providerCalls=0`.
- [Script audit](../../backend/scripts/audit-profit-finance-logic-20260905.cjs).

Từ thư mục `backend`:

```powershell
npm run build
node scripts/audit-profit-finance-logic-20260905.cjs
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent src/test-order2 src/business-ledger src/ad-group-profit-report/ad-group-profit-report.service.spec.ts src/finance/ad-group-daily-report.logic.spec.ts src/finance/cashflow-counterparty.spec.ts src/finance/finance.cashflow-transaction.spec.ts src/finance/cashflow-snapshot.service.spec.ts src/finance/financial-control-core-safety.service.spec.ts src/other-cost/cost-history-protection.spec.ts src/product/product.service.spec.ts src/return-request/return-request.business.spec.ts src/inventory/inventory.ownership.spec.ts
```

## Khi nào lợi nhuận được tính lại

- Khi tạo đơn hoặc lưu các trường ảnh hưởng doanh thu/chi phí, service tính lại đơn; thay đổi phạm vi phân bổ sẽ tính lại các đơn thuộc ngày bị ảnh hưởng. Chuyển ngày đơn làm mới cả ngày cũ và ngày mới.
- Giao hàng, giao một phần, hoàn hàng hoặc xác nhận điều chỉnh phí từng lần giao cập nhật phần doanh thu và chi phí nghiệp vụ của đơn.
- Thêm, sửa, xóa hoặc nhập chi phí quảng cáo thủ công, nhân công và OtherCost gọi phân bổ lại cho các ngày liên quan. Vì phân bổ chung, thay đổi một nguồn chi phí hoặc số lượng đơn có thể tác động các đơn khác cùng ngày.
- Đồng bộ chi phí quảng cáo tự động gom thay đổi theo ngày; hàng đợi mặc định đợi 20 phút sau lần lên lịch cuối, có thể cấu hình qua `ADS_RECALCULATE_DEBOUNCE_MS`.
- Pipeline 06:00 giờ Việt Nam đồng bộ chi phí nguồn, tính lại đơn và lưu báo cáo nhóm quảng cáo cho ngày hôm trước. Đây là lượt bổ sung, không quét lại toàn bộ lịch sử mỗi ngày. Lịch chạy phụ thuộc backend đang hoạt động và scheduler được bật; sandbox local chủ động tắt scheduler.
- Báo cáo sổ, lợi nhuận sản phẩm và quản trị nhóm quảng cáo tổng hợp từ dữ liệu hiện có khi API được gọi. Trang đã mở cần tải lại để nhận kết quả mới; không có cơ chế đẩy số liệu trực tiếp lên các trang này.
- Sửa báo giá không tự thay giá đã chụp trên đơn cũ. Thu/chi tiền thuần túy cập nhật tiền/công nợ; chứng từ điều chỉnh doanh thu hoặc chi phí mới tác động lợi nhuận.

Kiểm tra tiếp theo phát hiện lịch 06:00 từng dùng ngày UTC khiến 06:00 ngày 06/09 chọn 04/09 thay vì 05/09. Đã chuyển sang hàm `businessDay`/`previousBusinessDay` chung, đồng thời sửa khóa ngày của sự kiện đơn quá khứ, ngày cũ/mới khi sửa đơn và tác vụ tạo chi phí nhân công 00:30. Test mốc chuyển tháng, chuyển năm, năm nhuận, đơn đầu ngày và hàng đợi nằm trong `backend/src/finance/profit-recalculation-timing.spec.ts`.

Sau phần sửa thời điểm: backend build đạt; 6 suite liên quan với 37 test đạt (gồm 10 test mới về ngày và thời gian chờ); audit đối chiếu chạy lại vẫn đạt 14/14. Lệnh kiểm chứng từ `backend`:

```powershell
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent src/finance/profit-recalculation-timing.spec.ts src/finance/events/finance-event-listener.rebuild.spec.ts src/test-order2/services/order-price-snapshot.regression.spec.ts src/test-order2/services/order-shipment.service.spec.ts src/test-order2/services/order-report.service.spec.ts src/other-cost/cost-history-protection.spec.ts
```

Hàng đợi hiện dùng bộ nhớ tiến trình và ghi log khi lỗi; chưa có hàng đợi bền vững tự thử lại sau restart. Vì vậy cần đối chiếu hoặc chạy lại theo ngày nếu một lượt tính bị lỗi hay bị ngắt, đặc biệt với ngày lịch sử ngoài phạm vi lượt 06:00.

## Giới hạn nghiệm thu và dữ liệu lịch sử

### Tách hiệu quả ads và dữ liệu phục vụ kế hoạch vốn

Cập nhật tiếp theo: đã bổ sung liên kết lịch công nợ có phiên bản, lịch hẹn và lịch sử trả trễ trong [hướng dẫn dữ liệu công nợ và vốn](counterparty-capital-evidence.md). Nhận xét thiếu liên kết bên dưới mô tả thời điểm trước phần bổ sung này; lịch thực tế vẫn cần nhập/đối chiếu theo chứng từ.

Đã bỏ trạng thái `profitable_cash_risk`. Trạng thái, độ tin cậy và phân tích cận biên dùng `profitNeedsReview`, tách khỏi `needsReview` chung của sổ. Phiếu tiền đang chờ vẫn cần rà soát thanh toán nhưng không làm giảm chất lượng lợi nhuận; chứng từ đang chờ có tác động doanh thu, giá vốn hoặc chi phí vẫn chặn kết luận lợi nhuận. Việc thu tiền, thu một phần hay đảo phiếu thu giữ nguyên đánh giá kinh tế nếu doanh thu/chi phí không thay đổi. Các bản đánh giá nội bộ đã lưu giữ nguyên bản chụp lịch sử; tải lại báo cáo để nhận đánh giá hiện tại.

Kiểm kê schema/code: đã có các bảng nền về đơn hàng, giá chụp tại giao dịch, sản phẩm/nhóm sản phẩm, quảng cáo/chi phí ngày, giao/hoàn hàng, chi phí vận hành, tài khoản tiền/bút toán/công nợ, đối soát, nguồn vốn và khoản vay/lịch trả. Đủ cấu trúc nền để phân tích hiệu quả ads và tình hình tiền/công nợ lịch sử.

Chưa đủ dữ liệu chuẩn thống nhất cho dự báo vốn theo lịch: một số module có ngày đến hạn, nhưng sổ công nợ hợp nhất chưa liên kết đầy đủ ngày đến hạn, ngày hẹn trả và lịch sử thanh toán theo từng nghĩa vụ nhà cung cấp/đại lý. Báo cáo công nợ nhà cung cấp dùng nguồn hợp nhất hiện trả `scheduleConfigured=false` và lịch tiền về trống khi chưa cấu hình ngày đến hạn. Cần bổ sung/liên kết trường dữ liệu này trong các bảng nghiệp vụ; chưa cần bảng kết quả phân bổ tối ưu hay thuật toán AI mới. Chưa kiểm tra mức độ đầy đủ của dữ liệu MongoDB thực tế.

Kiểm chứng phần tách trạng thái: backend và frontend `npm run build` đạt; toàn bộ `src/business-ledger` đạt 13 suite / 124 test, gồm trường hợp chưa thu, thu một phần, công nợ phải trả, phiếu tiền đang chờ và chứng từ chi phí đang chờ. Phân tích cận biên giữ nguyên khi chỉ thay đổi tình trạng thu tiền.

Lượt kiểm tra chưa kết nối MongoDB thật, chưa chạy trình duyệt end-to-end, phân quyền hoặc kiểm thử khóa đồng thời trên hạ tầng triển khai. Trước khi dùng số dư CFO trên dữ liệu thật, cần tạo hoặc đối chiếu số dư đầu kỳ của các tài khoản tiền đã đăng ký và chuyển các chứng từ cũ sang sổ; service sẽ dừng thay vì ước lượng khi thiếu nguồn chuẩn.

Đơn cũ chưa có bản chụp nhóm sản phẩm sẽ tạm dùng nhóm hiện tại của Product, nên cần backfill nếu doanh nghiệp muốn báo cáo lịch sử tuyệt đối theo nhóm tại thời điểm bán. Chi phí được đánh dấu đã trả chỉ làm thay đổi số dư tiền khi có bút toán sổ cái đã xác nhận tương ứng. Việc nối chứng từ chi phí với bút toán tiền cần được bảo đảm trong quy trình nhập liệu hoặc bước chuyển đổi dữ liệu.

Không có lệnh quảng cáo thực tế nào được tạo hoặc gửi. `canProposeScale` chỉ là chỉ báo; `automaticExecutionAllowed` vẫn bằng `false`.
