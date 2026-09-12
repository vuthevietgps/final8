# Rà soát khả năng theo dõi mô hình kinh doanh — 04/09/2026

## Kết luận

Hệ thống có các phần nền tảng nhưng **chưa theo dõi nhất quán toàn bộ hoạt động đã mô tả**. Các trường đã xuất hiện ở màn hình hoặc schema không đồng nghĩa luồng đơn hàng, kho, công nợ và báo cáo đã liên kết đúng.

Hai mô hình đang cùng tồn tại: bộ tính đơn mới coi đại lý là khách mua đứt; nhiều phần thanh toán/công nợ cũ vẫn giả định NCC thu COD và công ty trả hoa hồng đại lý. Kho và sổ nghiệp vụ mới chưa trở thành nguồn dữ liệu thống nhất cho các phần này.

Rà soát lần này không sửa mã nghiệp vụ, không khởi động lại ứng dụng, không triển khai, không kết nối database cũ. Chỉ thêm công cụ kiểm chứng và tài liệu. Đã đọc schema, DTO, service, bộ tính, đường gọi và mẫu giao diện của các phần được liệt kê dưới đây.

## Nghiệp vụ làm chuẩn đối chiếu

1. Công ty mua hàng từ NCC, bán lẻ hoặc bán đứt cho đại lý.
2. Đại lý chịu giá đại lý và phí giao; khi hoàn chịu thêm phí hoàn. Khách của đại lý từ chối nhận không tự hủy giao dịch bán cho đại lý.
3. Công ty bán lẻ chỉ ghi doanh thu khi giao thành công. Giá bán đầy đủ độc lập với cọc, COD và các lần thu.
4. Phải trả tiền NCC và còn giá trị hàng tồn là hai thông tin riêng: nhận lại hàng để bán tiếp không tự giảm nợ NCC.
5. Hàng độc bản không còn giá trị thu hồi và hàng có thể bán lại cần được phân biệt, kiểm tra theo món/lô thực tế.
6. Hàng hoàn mặc định về bên/nơi gửi của **từng lần giao**; có thể chỉ định nơi khác. Nơi giữ không quyết định chủ sở hữu.
7. Xuất lại hàng đã có không tạo lần mua mới. Giao tiếp hàng của cùng đại lý không tạo thêm lần bán hàng cho đại lý.
8. Tiền do công ty/NCC/đại lý/đơn vị vận chuyển thu toàn bộ hoặc một phần; chỉ xác nhận thu, chi, đối trừ khi có nghiệp vụ tương ứng.
9. Giá và chính sách theo bản chụp giao dịch; giá vốn xuất kho theo lô. Phí tính cho khách/đại lý và phí phải trả có thể cần số tiền, đối tác riêng.

Mốc hiện tại “Đã trả kết quả + có mã vận đơn” là quy tắc phần mềm đã áp dụng cho đại lý; vẫn cần bảo đảm mốc đó thực sự đại diện việc chuyển hàng cho đại lý, kể cả trường hợp vận đơn vừa tạo rồi hủy.

## Ma trận phần mềm hiện tại

| Phần | Đã có và có thể tận dụng | Chưa đáp ứng / tác động |
|---|---|---|
| Sản phẩm | SKU, tên/nhóm, giá nhập tham khảo, đóng gói, danh sách NCC, các cờ hoàn cũ | Chưa có khả năng bán lại độc lập với quyền trả NCC; chưa phân biệt món độc bản/cá nhân hóa và giá trị thu hồi thực tế |
| Báo giá NCC | NCC–sản phẩm, giá, phí giao/hoàn, VND/ngoại tệ, hiệu lực, duyệt, lịch sử duyệt | Cờ “trả được” còn nhập nhằng với hoàn tiền/mất giá vốn; chưa tách rõ thời điểm cam kết trả tiền và nơi nhận hoàn |
| Báo giá đại lý | Đại lý–sản phẩm, đơn giá, thời hạn, trạng thái duyệt | Chưa có bộ phí giao/hoàn riêng để chụp vào đơn; đơn hiện dùng cùng mức phí cho chi phí và khoản đại lý chịu |
| Bản chụp báo giá đơn | ID giá nguồn, giá đã áp dụng, ngày chụp/hiệu lực; giữ giá khi nguồn đổi; chỉ chọn báo giá hợp lệ | Chưa phải giá vốn lô tồn kho; thiếu bản chụp giá bán lẻ và chính sách khả năng bán lại; fallback sản phẩm không thay thế báo giá đã duyệt |
| OrderTest2 | Một sản phẩm/số lượng, NCC, đại lý, nhóm quảng cáo, người nhận, trạng thái, mã vận đơn, cọc/COD, phí, doanh thu/giá vốn/lãi mới | Chưa có đầy đủ loại giao dịch, nguồn hàng được lưu, lô/món hàng, người gửi, nơi nhận hoàn, người giữ, lịch sử nhiều lần giao và thu nhiều bên |
| Nhập mua | Đơn nhập, nhận từng phần, tạo lô kho | Đường nhận mua đã bỏ tạo công nợ NCC; chờ đơn bán tạo công nợ theo mô hình dropship, không đầy đủ cho nhập trước bán sau |
| Nhận hàng hoàn | Phiếu gắn đơn, số lượng, quyết định nhập lại/loại bỏ, giá trị thu hồi | Chưa tách chủ sở hữu/nơi giữ; nhập kho và lợi nhuận chưa đồng bộ; chưa đủ quy trình hoàn từng phần qua nhiều lần |
| Kho | Tổng tồn theo sản phẩm, lô mua/lô hoàn, xuất FIFO, lịch sử nhập/xuất | Tổng tồn chung chưa phân theo chủ/nơi; chưa giữ chỗ cho đơn mới; chưa nối lô xuất với OrderTest2 và từng lần giao |
| Công nợ đại lý | Bảng tổng hợp, sao kê, các khoản thanh toán | Công thức cũ sai với mua đứt, nhận tiền một phần và hàng hoàn |
| Công nợ/đối soát NCC | Bảng phải trả, sao kê, thanh toán | Có đường coi toàn bộ là NCC trả chênh lệch COD; không biểu diễn đúng khi công ty/đại lý thu tiền trước |
| Sổ nghiệp vụ mới | Hồ sơ đơn, bút toán nháp/xác nhận/đảo, đối tác, tài khoản tiền, bằng chứng, chống gửi trùng | Cần nhập/xác nhận riêng; chưa tự liên kết đầy đủ với kho/đơn/sao kê cũ; quy tắc hoàn hiện chặn thu hồi giá trị hàng bán lẻ |
| Lãi sản phẩm/đại lý/nhóm quảng cáo | Có các báo cáo và trường tổng hợp | Nhiều báo cáo dùng cơ sở khác nhau, chưa bảo đảm cộng lên cùng kết quả |

## Các sai lệch đã xác định

### F01 — Công nợ đại lý tự coi giao thành công là đã thu tiền, và xóa tiền hàng hoàn

Mức ưu tiên: **P1 — làm sai nghĩa vụ thu tiền**.

`AgentReceivableService.getAgentReceivableSummary` lấy giá từ `agentQuote`, nếu bằng 0 thì chuyển sang COD; giao thành công tự đặt `collected = quoteAmount`; hoàn mà `product.isReturnable=true` thì đặt tiền hàng phải thu về 0. Sau đó luôn cộng cả phí giao và phí hoàn, kể cả đơn giao thành công. Cờ sản phẩm được đọc ở thời điểm báo cáo, không phải chính sách đã chụp trên đơn.

Bằng chứng: `backend/src/agent-receivable/agent-receivable.service.ts:64`, `:91`, `:102`, `:113`. Công thức lặp lại ở phần tổng và sao kê. `schemas/agent-statement.schema.ts:9` vẫn mô tả công ty nợ hoa hồng đại lý.

Kiểm chứng MongoDB thật, không có thanh toán: giá đại lý 250.000, phí giao 20.000, phí hoàn niêm yết 30.000. Giao thành công đáng ra còn nợ 270.000 nhưng hiện 50.000; hoàn đáng ra 300.000 nhưng hiện 50.000. Giá đại lý hợp lệ 0 cũng bị thay bằng COD.

### F02 — Trạng thái giao hàng có thể tự điền tiền NCC đã thu

Mức ưu tiên: **P1 — sai người thu và thực nhận**.

`applyCompletedStatusFinancials` của đơn bán lẻ thay `codCollectedBySupplier=0` bằng toàn bộ COD khi hoàn tất giao; khi hoàn lại đặt về 0. Như vậy lịch sử thực thu có thể bị tạo hoặc xóa theo vận đơn. Trường `supplierPaidAmount` vẫn được tính từ COD trừ giá/phí; đó không phải chứng từ thực nhận.

Bằng chứng: `backend/src/test-order2/services/order-calculation.service.ts:263`, `:271`, `:288`. `services/order-payment.service.ts:43` nhận `paidAmount` nhưng luồng tạo batch chủ yếu đánh dấu paid, không phân bổ số thực thu/chi đầu vào thành giao dịch từng bên/từng đơn. `calculateSupplierUiAmount` ở `:31` chỉ cộng tiền hàng, bỏ phí.

Kiểm chứng: trước tính toán NCC thu 0; sau chuyển giao thành công, trường này thành 300.000 dù kịch bản công ty thu tiền.

### F03 — Đường tạo công nợ NCC giả định NCC thu COD

Mức ưu tiên: **P1 — bỏ sót khoản công ty phải trả NCC**.

Khi sản xuất xong, hook tạo `totalAmount = max(0, COD − giá vốn − phí giao)`, thay vì tách nghĩa vụ mua hàng và tiền thu hộ. Hook bỏ qua nếu trạng thái sản xuất trước đó đã xong, nên các thay đổi sau/hoàn không được đường này đồng bộ đầy đủ.

Bằng chứng: `backend/src/test-order2/test-order2.service.ts:215`; `backend/src/supplier-payable/services/order-integration.service.ts:44`. `backend/src/purchase/purchase-order.service.ts:300` ghi nhập kho nhưng đoạn ngay sau đã bỏ tạo payable từ đơn nhập.

Kiểm chứng: khách trả trước đủ, COD=0, giá NCC 120.000 + phí NCC giao 20.000; hook tạo giá trị 0 thay vì nghĩa vụ 140.000. Đây là sai lệch của đường tự tạo hiện tại; bút toán nhập thủ công ở phần khác không có nghĩa đường này đã đúng.

### F04 — Doanh thu bán lẻ phụ thuộc COD

Mức ưu tiên: **P1 — sai doanh thu/lợi nhuận khi có cọc hoặc trả trước**.

`recognizedRevenue = codAmount` khi giao thành công. Chưa có giá bán lẻ đầy đủ và bản chụp độc lập; không thể chỉ sửa thành luôn cộng cọc vì dữ liệu cũ có thể dùng COD với nghĩa khác.

Bằng chứng: `backend/src/test-order2/services/order-calculation.service.ts:246`.

Kiểm chứng: giao dịch bán 300.000, cọc 100.000, thu còn lại 200.000 → doanh thu hiện 200.000, thiếu 100.000.

### F05 — Hàng bán lẻ nhập lại kho nhưng đơn vẫn chịu toàn bộ tổn thất giá vốn

Mức ưu tiên: **P1 — sai lãi đơn và có thể tính giá vốn lặp khi bán tiếp**.

Phiếu hoàn ghi giá trị thu hồi và tạo lô kho, sau đó gọi bộ tính vẫn trừ toàn bộ giá NCC. `business-ledger.rules.ts:67` còn chặn thu hồi hàng bán lẻ ở trạng thái hoàn, kể cả hồ sơ recoverable. Đây là hạn chế của bản sửa trước, cần sửa theo việc người dùng làm rõ hàng có thể bán lại; không phải bỏ nghĩa vụ trả NCC.

Bằng chứng: `backend/src/return-request/return-request.service.ts:145`, `:169`, `:180`; `backend/src/test-order2/services/order-calculation.service.ts:247`.

Kiểm chứng service + kho MongoDB thật: đã tạo tồn trị giá 120.000, phí giao/hoàn 50.000 nhưng đơn lỗ 170.000. Nếu đã xác nhận thu hồi nguyên giá 120.000, tổn thất của lần giao là 50.000 trước chi phí khác. Hàng độc bản không còn giá trị thu hồi vẫn lỗ 170.000 là đúng trong ví dụ này.

### F06 — Hàng của đại lý có thể vào cùng tồn dùng để bán hàng công ty

Mức ưu tiên: **P1 — sai quyền sở hữu và xuất nhầm hàng giữ hộ**.

Phiếu hoàn không kiểm tra chủ sở hữu trước khi gọi nhập kho. Summary chỉ duy nhất theo productId, batch chưa có chủ sở hữu/nơi giữ/đơn gốc. FIFO cũng chỉ chọn productId. Cờ `goodsOwner=dealer` trên đơn không đi theo lô kho.

Bằng chứng: `backend/src/inventory/schemas/inventory-summary.schema.ts:8`; `schemas/inventory-batch.schema.ts:8`; `backend/src/inventory/inventory.service.ts:116`, `:189`; `backend/src/return-request/return-request.service.ts:169`.

Kiểm chứng: xác nhận nhập lại một hàng của đại lý làm tồn dùng chung tăng 1. Kho chưa có vùng tồn giữ hộ riêng để xuất đúng chủ.

### F07 — Nguồn hàng và giá vốn kho chưa đi xuyên qua OrderTest2

Mức ưu tiên: **P1 — chưa hỗ trợ đúng bán hàng đang có, không mua mới**.

`productSource` có trong DTO và model frontend nhưng không có trong schema OrderTest2, không được gán khi tạo đơn. Giao diện chọn nguồn hiện chỉ chọn NCC và luôn gán supplier. OrderTest2 import InventoryModule nhưng không gọi `issueStock`; lô xuất cũng không có liên kết orderId.

Bằng chứng: `backend/src/test-order2/dto/create-test-order2.dto.ts:148`; `backend/src/test-order2/test-order2.service.ts:385`; `frontend/src/app/features/test-order2/test-order2.component.ts:474`; `backend/src/inventory/inventory.controller.ts:31`.

Kiểm chứng Mongoose thật: serialize một đơn đầu vào `productSource=inventory` mất trường này. Chưa thể xác nhận nguồn kho được giữ và ngăn thêm tiền mua NCC khi giao lại.

### F08 — Chưa có lịch sử từng lần gửi/hoàn và nơi nhận hoàn theo bên gửi

Mức ưu tiên: **P1 — mất thông tin khi giao lại nhiều lần**.

OrderTest2 chỉ có một trackingNumber, một shippingFee, một returnFee. Không thấy cấu trúc từng lần giao gắn bên gửi, địa chỉ gửi, nơi hoàn mặc định/được chỉ định và nơi nhận thực tế. Marker lần hoàn giữ được việc đã từng hoàn nhưng không thay thế danh sách phí/lần giao. Đổi mã hoặc phí có thể thay thông tin hiện hành thay vì bảo toàn từng lần.

Bằng chứng: `backend/src/test-order2/schemas/test-order2.schema.ts:41`, `:95`; `backend/src/test-order2/dealer-sale.ts:22`.

### F09 — Các báo cáo chưa dùng chung công thức và thời điểm ghi nhận

Mức ưu tiên: **P1 — sai so sánh sản phẩm/đại lý/nhóm quảng cáo**.

- Báo cáo sản phẩm đã ưu tiên recognizedRevenue/recognizedGoodsCost nhưng đơn cũ thiếu trường lại fallback COD+cọc+manualPayment; đơn hoàn lịch sử có thể bị cộng doanh thu. Nguồn: `backend/src/test-order2/services/order-report.service.ts:128`.
- Báo cáo hiệu quả nhóm quảng cáo mặc định chỉ lấy trạng thái cuối, bỏ đơn đại lý đã ghi doanh thu nhưng còn đang giao; doanh thu lấy codCollectedBySupplier, giá vốn lấy productCost không nằm trong schema đơn hiện tại. Nguồn: `backend/src/ad-group-profit-report/ad-group-profit-report.service.ts:96`, `:122`.
- Báo cáo nhóm quảng cáo theo ngày lấy grossProfit trừ ads khi có chi tiêu, làm mất phần nhân công/chi phí khác đã có trong netProfit của đơn. Nguồn: `backend/src/finance/ad-group-daily-report.service.ts:178`.
- Báo cáo hoàn đọc paidToCompanyAmount/productCostTotal, chưa lấy recognizedRevenue/recognizedGoodsCost của đơn mới. Nguồn: `backend/src/return-report/return-report.service.ts:172`, `:193`.
- Sổ mới tính từ bút toán đã xác nhận, báo cáo đơn cũ tính từ trường trên đơn; chưa có đường nối tự động bảo đảm hai bên đồng nhất. Tìm đường gọi trong OrderTest2/ReturnRequest/Inventory/Payables không thấy ghi vào BusinessLedgerService. Event tài chính hiện làm mới cache/snapshot, không thay thế bút toán đó.

Các điểm báo cáo trên được xác định từ mã nguồn, chưa phải kết quả kiểm thử HTTP/giao diện. Phân bổ ads giữa báo cáo đơn (theo ngày) và sổ mới (theo cửa sổ báo cáo) cũng cần thống nhất trước nghiệm thu.

### F10 — Trường chính sách sản phẩm/báo giá còn nhập nhằng

Mức ưu tiên: **P2 — dễ nhập đúng ý người dùng nhưng hệ thống hiểu khác**.

`Product.isReturnable` nói về trả NCC; `supplierIsReturnableSnapshot` lại chú thích gộp nhận lại và hoàn tiền. `ledgerReturnPolicy` gộp khả năng thu hồi với cam kết sản xuất. Những điều này không đồng nghĩa hàng độc bản hoặc khả năng bán lại. Màn sản phẩm hiện chỉ hiển thị mô tả quy tắc cũ, chưa có lựa chọn khả năng bán lại; báo giá NCC vẫn có “Trả được/Không trả”.

Bằng chứng: `backend/src/product/schemas/product.schema.ts:60`; `backend/src/test-order2/schemas/test-order2.schema.ts:179`; `frontend/src/app/features/product/product.component.html:200`; `frontend/src/app/features/supplier-quote/supplier-quote.component.html:29`.

Báo giá đại lý chỉ có giá hàng/thời hạn, chưa có phí hai chiều riêng. `dealerSaleAmounts` lấy cùng shippingFee/returnFee cho khoản công ty chịu và khoản tính đại lý; chênh lệch phí luôn triệt tiêu. Nếu hai bên thực tế có giá phí khác nhau thì chưa biểu diễn được. Nguồn: `backend/src/quote/schemas/quote.schema.ts:26`; `backend/src/test-order2/dealer-sale.ts:32`.

## Danh sách thông tin cần bổ sung hoặc tách nghĩa

Đây là đề xuất trường nghiệp vụ; chưa tạo schema hay biểu mẫu mới trong lần rà soát này. Có thể dùng bảng con/chứng từ liên kết để tránh nhồi tất cả vào một dòng đơn.

| Nơi lưu | Thông tin cần có | Quy tắc |
|---|---|---|
| Sản phẩm | Khả năng bán lại: không thể/có thể/cần kiểm tra; đặc điểm cá nhân hóa | Mặc định, không tự xác nhận hàng thực nhận còn nguyên giá |
| Dòng đơn/món hàng | Bản chụp đặc điểm riêng, SKU/biến thể/mã món, khả năng bán lại đã chốt | Cùng một mẫu nhưng hàng in tên có thể khác hàng thông dụng |
| Báo giá NCC | Giá hàng, phí giao/hoàn, đơn vị tính phí, hiệu lực, điều kiện phát sinh nghĩa vụ, điều kiện điều chỉnh tiền | Tách quyền nhận hàng hoàn và việc chấp nhận giảm/hoàn tiền |
| Báo giá đại lý | Giá hàng và phí tính đại lý theo từng loại; hiệu lực/chính sách đã chốt | Không mặc định bằng phí công ty trả NCC/hãng vận chuyển |
| Giao dịch bán | Bán lẻ/bán đại lý; giá bán đầy đủ; chiết khấu/phí tính thêm; mốc ghi nhận | Giá bán độc lập cọc/COD; nếu giao tiếp hàng đã thuộc đại lý thì không tạo thêm lần bán |
| Nguồn hàng đơn | Mua mới/xuất hàng đang có/giao tiếp hàng giữ hộ; lô/món/số lượng xuất; đơn gốc | Giá vốn lô khi xuất tồn; không tạo thêm công nợ mua mới |
| Từng lần giao | Người gửi/địa chỉ; đơn vị vận chuyển; mã vận đơn; nơi hoàn mặc định và chỉ định | Mặc định nơi gửi của chính lần đó; lưu lịch sử, không ghi đè |
| Phí từng lần | Loại phí, số phải trả, trả cho ai, số tính khách/đại lý, tạm tính/thực tế, chứng từ | Chỉ cộng phí hoàn khi phát sinh; không tính trùng phí đã nằm trong giá |
| Nhận hoàn | Số nhận thực tế; tình trạng; người xác nhận; chủ sở hữu; người/nơi giữ; giá trị thu hồi | Đang hoàn không phải tồn sẵn bán; nhận được không tự giảm nợ NCC |
| Kho | Phân vùng chủ sở hữu + nơi giữ; lô/món; đơn gốc; tồn khả dụng/giữ chỗ/hỏng; lịch sử chuyển/xuất | Hàng đại lý không tự trở thành tài sản công ty; chặn xuất trùng |
| Thanh toán | Từng lần thu/chi: bên trả, bên nhận, số tiền, tài khoản, thời điểm, bằng chứng, khoản được thanh toán | Cho phép nhiều bên, nhiều lần; giao thành công không tự đánh dấu thu đủ |
| Đối trừ/đối soát | Khoản phải thu/phải trả, số đối trừ, chứng từ, số thực chuyển, chênh lệch và trạng thái xác nhận | Phân biệt nghĩa vụ gốc, đã thanh toán và số dư còn lại |
| Báo cáo | Nguồn ghi nhận chung, ngày nghiệp vụ, trạng thái tạm tính/đủ dữ liệu, liên kết đơn gốc và đơn giao lại | Cộng được từ đơn lên sản phẩm/đại lý/ads, không lặp giá vốn hoặc doanh thu |

Không cần nhập tay tất cả: hệ thống nên tự điền theo báo giá, nguồn hàng, người gửi và giao dịch gốc; người dùng xác nhận những gì thực tế thay đổi.

## Kiểm chứng đã chạy

1. Bộ kiểm thử hiện có: **4 suites / 51 tests đạt**. Chúng kiểm tra các quy tắc cũ/phạm vi hẹp; một số cố ý yêu cầu bán lẻ hoàn luôn giữ toàn bộ giá vốn. Vì vậy đạt 51 bài không phải nghiệm thu nghiệp vụ hàng hoàn bán lại được.
2. Công cụ chẩn đoán mới: **11 tình huống chọn để kiểm tra / 2 đối chứng đạt / 9 sai lệch tái hiện**. Đây không phải tỷ lệ lỗi của toàn hệ thống hoặc kiểm tra ngẫu nhiên.
3. Database riêng: `erp_business_model_audit_1788513570210_c606b2` tại `127.0.0.1:27027`. Chỉ chứa dữ liệu giả lập của lần kiểm tra này. Không đọc/chuyển database demo/production.
4. Công cụ nạp TypeScript nguồn bằng ts-node có kiểm tra kiểu để giữ metadata Nest/Mongoose. Không dựa vào backend đang chạy hay bản dist có thể cũ.
5. Truy vấn công nợ đại lý và lưu lô/tổng tồn dùng MongoDB thật. Trong thử phiếu hoàn, ranh giới transaction, lưu đơn và phát sự kiện được mô phỏng; không chứng minh rollback, cạnh tranh dữ liệu, phân quyền HTTP hoặc thao tác giao diện.

| Tình huống chẩn đoán | Đúng theo giả định kiểm tra | Hiện tại |
|---|---:|---:|
| Đại lý giao thành công, chưa thanh toán | Nợ 270.000 | 50.000 |
| Đại lý hoàn, chưa thanh toán | Nợ 300.000 | 50.000 |
| Giá đại lý hợp lệ 0, hoàn, COD 300.000 | Nợ phí 50.000 | 350.000 |
| Đối chứng: lãi hàng bán đại lý, A=250.000/S=120.000 | 130.000 | 130.000 |
| Đối chứng: bán lẻ hoàn không thu hồi giá trị | −170.000 | −170.000 |
| Bán lẻ 300.000, cọc 100.000, COD còn 200.000 | Doanh thu 300.000 | 200.000 |
| Công ty thu, NCC thực thu 0 | Giữ NCC thu 0 | Tự điền 300.000 |
| Bán lẻ hoàn đã thu hồi đủ 120.000 vào kho | Lỗ lần giao 50.000 | Lỗ 170.000 dù kho có 120.000 |
| Hàng đại lý hoàn cần tách tồn giữ hộ | Không tăng tồn dùng chung | Tăng 1 |
| Khách trả trước đủ, COD=0 | Nghĩa vụ NCC 140.000 | Hook tạo giá trị 0 |
| Lưu nguồn hàng inventory trên schema đơn | Giữ inventory | Mất trường |

Lệnh kiểm chứng từ thư mục backend:

```powershell
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent order-calculation.four-cases.spec.ts dealer-sale.spec.ts business-ledger.eligibility.spec.ts order-report.service.spec.ts
node --require ./scripts/local-ledger-guard.cjs scripts/audit-business-model-local.cjs
```

Công cụ chẩn đoán trả mã khác 0 khi có sai lệch; kết quả chi tiết ở `.local-ledger/business-model-audit-erp_business_model_audit_1788513570210_c606b2.json`. Chạy lại sẽ tạo database giả lập mới, không ghi đè lần trước. Lần chạy thử đầu bằng transpile-only gặp lỗi metadata khi nạp schema; đã đổi sang kiểm tra kiểu đầy đủ và hoàn tất 11 tình huống. Lỗi công cụ ban đầu không được tính là sai lệch nghiệp vụ.

## Thứ tự chỉnh sửa đề xuất sau rà soát

1. Thống nhất định nghĩa trường, nguồn doanh thu/giá vốn, nghĩa vụ và thực nhận; xử lý các đường công nợ/thu tiền đang sai. Giữ bản chụp và lịch sử đã xác nhận; không tự tính lại dữ liệu cũ toàn bộ.
2. Hoàn thiện nguồn hàng, chủ sở hữu/nơi giữ, nhận hoàn và xuất lại. Tận dụng InventoryService/ReturnRequestService nhưng bổ sung liên kết và kiểm tra trước khi cho đưa hàng đại lý vào tồn có thể xuất.
3. Thêm lịch sử từng lần giao và các khoản phí, mặc định nơi nhận hoàn theo người gửi. Hoàn tất bán lại hàng thu hồi, hoàn một phần, chuyển nơi giữ.
4. Nối giao dịch thu/chi/đối trừ vào sổ chung, rồi chuyển báo cáo sản phẩm/đại lý/ads sang cùng cơ sở. Kiểm tra cộng khớp giữa các cấp và các ngày nghiệp vụ.
5. Nghiệm thu kịch bản đầy đủ qua HTTP/giao diện local với kho và nhiều bên thu tiền; sau đó mới xem xét dữ liệu cũ/triển khai theo yêu cầu riêng.

Các module tận dụng: Product, SupplierQuote, Quote, OrderCalculationService, TestOrder2Service, PurchaseOrderService, InventoryService, ReturnRequestService, AgentReceivableService, SupplierPayableService, BusinessLedgerService và các báo cáo hiện có. Không cần tạo một ERP thứ hai; cần thống nhất các điểm nối giữa những phần đang có.
