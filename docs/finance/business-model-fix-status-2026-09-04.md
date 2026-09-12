# Ghi nhận doanh thu, chi phí, lợi nhuận đơn hàng — bản sửa local 04/09/2026

## Kết luận kiểm tra

Lõi tính toán đã được sửa theo mô hình đại lý mua đứt và bán lẻ. Chưa đủ bằng chứng kết luận toàn bộ hệ thống chạy chính xác xuyên suốt. Phân biệt ba việc: sự kiện đủ điều kiện ghi nhận, mức đầy đủ của giá/phí, và chứng từ thu chi thực tế.

Chỉ làm việc với mã nguồn và dữ liệu local riêng. Không triển khai, không kết nối hay chuyển đổi database cũ. Các đơn mới dùng `financialModelVersion=2`; không mặc định đổi mô hình cho đơn lịch sử.

## Loại đơn và mốc ghi nhận

Phân loại theo quan hệ bán (bán lẻ/đại lý mua đứt), nguồn hàng (NCC/kho công ty/hàng đại lý giữ hộ), và khả năng bán lại (không còn giá trị/có thể bán lại/cần kiểm tra). Ai gửi, ai giữ, ai thu tiền là các thông tin độc lập.

| Tình huống | Doanh thu tiền hàng | Giá vốn và chi phí | Đánh giá lợi nhuận |
|---|---|---|---|
| Đơn nháp/chưa xuất | Chưa ghi | Chưa ghi giá vốn bán hàng; chi phí phân bổ có thể đã phát sinh | Chờ sự kiện, chưa phải kết quả cuối |
| Bán lẻ đang giao | Chưa ghi | Phí giao/đóng gói đã phát sinh được tính; giá vốn chờ kết quả | Chờ giao, có thể đang âm do chi phí |
| Bán lẻ giao thành công | Giá bán đầy đủ × tỷ lệ số lượng giao thành công; không lấy COD/cọc thay giá bán | Giá vốn bản chụp NCC hoặc giá xuất từ lô kho + phí + phân bổ | Đã ghi nhận; còn tạm tính nếu thiếu xác nhận phí/phân bổ |
| Bán lẻ hoàn, hàng mất giá trị | Không ghi doanh thu phần thất bại | Giữ giá vốn phần mất giá trị, phí giao/hoàn/đóng gói và phân bổ | Lỗ phần chi phí; chờ kiểm tra nhận hoàn nếu chưa xong |
| Bán lẻ hoàn, hàng còn giá trị | Không ghi doanh thu phần thất bại | Chỉ giảm giá vốn bằng giá trị thu hồi đã xác nhận khi nhận và kiểm tra hàng; giữ nguyên phí phát sinh | Có thể thay đổi khi xác nhận giá trị thu hồi |
| Bán đứt đại lý, đã sản xuất xong và xuất có vận đơn | Giá đại lý chụp × số lượng, không chờ khách của đại lý nhận | Giá vốn + phí phát sinh − phí thu lại đại lý + phân bổ | Đã ghi nhận; phí chưa chốt thì tạm tính |
| Đơn đại lý bị hoàn | Giữ nguyên doanh thu đã bán cho đại lý | Đại lý vẫn chịu tiền hàng, phí giao và hoàn theo thỏa thuận; hàng hoàn thuộc đại lý | Không tự hủy lãi tiền hàng của công ty |
| Gửi lại hàng vốn thuộc đại lý | Không bán tiền hàng lần hai | Không tính lại giá vốn hàng; chỉ phí của lần giao mới và khoản thu lại tương ứng | Lãi/lỗ dịch vụ giao lại, không lặp giao dịch hàng hóa |
| Nhập mua vào kho công ty | Không có doanh thu bán | Khi nhận: tài sản tồn kho và nghĩa vụ NCC; phân bổ giá mua/chi phí mua vào lô | Chưa phải lãi/lỗ bán hàng; xuất bán mới chuyển giá vốn |

Nguồn kho công ty có thể bán lẻ hoặc bán cho đại lý theo mốc tương ứng ở trên. Giá vốn dùng lô đã có, không phát sinh mua mới từ NCC. Giao một phần chỉ ghi doanh thu bán lẻ phần giao được; phần hoàn vẫn chờ xử lý vật chất và giá trị.

Sản xuất xong có thể làm phát sinh nghĩa vụ trả NCC trước doanh thu bán lẻ. Hàng thu hồi có giá trị không tự làm giảm nghĩa vụ đó. Nơi nhận hoàn mặc định theo người thực sự gửi của từng lần giao, có thể chỉ định nơi khác. Quyền sở hữu không thay đổi chỉ vì thay nơi giữ.

## Công thức và phạm vi báo cáo

Lợi nhuận theo đơn trước điều chỉnh sổ = doanh thu tiền hàng − giá vốn ghi nhận − phí giao − phí hoàn − đóng gói − quảng cáo − nhân công − chi phí chung phân bổ + phí thu lại từ đại lý.

Phí thu lại đại lý hiện trình bày như khoản bù chi phí. Vì vậy doanh thu tiền hàng khác tổng tiền đại lý phải chịu. Ví dụ giá đại lý 250.000, giá vốn 120.000, giao 20.000 và hoàn 30.000, đại lý chịu đủ phí: doanh thu hàng 250.000, tổng nghĩa vụ đại lý 300.000, lãi trước đóng gói/phân bổ 130.000.

Cột `Lãi trước điều chỉnh sổ` ở OrderTest2 lấy chi phí vận hành/phân bổ trên đơn. Báo cáo `/finance/business-ledger` cộng thêm chứng từ điều chỉnh/chi phí bổ sung đã xác nhận trong sổ, theo cùng nguồn cho đơn/sản phẩm/đại lý/nhóm quảng cáo. Hai con số có thể khác nếu có điều chỉnh bổ sung; giao diện đã ghi rõ phạm vi. Không coi cột đơn là kết quả sau mọi điều chỉnh.

Quảng cáo được phân bổ theo số lượng trong cùng ngày Việt Nam và nhóm quảng cáo, làm tròn số nguyên đồng với tổng bảo toàn. Chi phí quảng cáo không có đơn giữ thành dòng riêng, không gán sang nhóm khác. Đây là quy ước phân bổ quản trị, không phải đo chính xác chi phí thu hút riêng từng khách.

Báo cáo lợi nhuận hiện theo nhóm đơn có ngày đặt trong kỳ, cập nhật kết quả và chi phí mới nhất; không phải sổ khóa kỳ ghi nhận theo từng ngày sự kiện. Các màn hình công nợ/hoa hồng/CFO cũ chưa được nghiệm thu đồng nhất với mô hình mới.

## Trạng thái chất lượng số liệu

- `awaiting_event`: chờ mốc ghi nhận; không đồng nghĩa chưa phát sinh chi phí hay nghĩa vụ NCC.
- `incomplete`: thiếu báo giá hợp lệ hoặc tổng giá bán lẻ; không coi giá thiếu là giá 0.
- `provisional`: đã ghi nhận nhưng còn phí chưa xác nhận, nhận hoàn chưa đủ, chưa phân bổ chi phí hoặc lịch sử cũ chưa đối chiếu.
- `calculated`: đã tính theo dữ liệu hiện có. Không có nghĩa đã thu tiền, đã khóa sổ hay chắc chắn không còn chi phí bổ sung.

## Các phần mã sử dụng và đã thay đổi

- Product, Quote, SupplierQuote và TestOrder2: chính sách bán lại, phí đại lý, tổng giá lẻ, chụp giá hiệu lực/được duyệt, giữ lịch sử giá đã áp dụng.
- OrderCalculation và dealer-sale: điều kiện ghi nhận, giữ nghĩa vụ đại lý khi hoàn, tách thu hồi tồn với nghĩa vụ NCC, phân bổ đồng/ngày/nhóm.
- Inventory, Purchase, ReturnRequest: chủ sở hữu/nơi giữ, giữ chỗ/xuất lô, chi phí mua vào lô, tiếp nhận/kiểm tra hoàn.
- OrderShipment: từng lần gửi, nơi hoàn, phí và lịch sử sửa phí, chống lặp yêu cầu, tiếp tục lần xuất đang dở.
- BusinessLedger và AgentReceivable: nguồn giao dịch đơn mới, thanh toán xác nhận/đảo chứng từ, tổng hợp chung. Chặn các thao tác thanh toán cũ suy diễn tiền từ trạng thái.
- Frontend sản phẩm/báo giá/đơn/kho/sổ: thao tác và giải thích các thông tin trên.

## Bằng chứng kiểm thử và giới hạn

- Kiểm tra tập trung tiếp theo về bản chụp/giao/hoàn/chủ hàng/xuất lại: phát hiện và sửa 2 lỗi về lô xuất và địa chỉ nhận hoàn; sau sửa 47/47 bài đạt và backend build thành công. Xem [bằng chứng và giới hạn lượt kiểm thử](shipment-snapshot-regression-2026-09-04.md). Các bài dùng persistence mô phỏng, không thay thế nghiệm thu transaction Mongo thật.

- Đợt kiểm thử rộng TestOrder2/BusinessLedger: 13 suites, 112 tests đạt.
- Đợt bổ sung gần nhất: 5 suites, 38 tests đạt, gồm 8 bài mới về mức đầy đủ lợi nhuận và điều chỉnh phí; các bài còn lại trùng đợt trước, không cộng hai tổng này.
- Sau sửa phí bán lẻ đang giao: suite `operational-projection.spec.ts` chạy lại 6/6 đạt, có bài chứng minh phí không bị tính hai lần khi chuyển từ đang giao sang thành công. Backend Nest và frontend Angular build lại đều thành công sau các sửa cuối.
- Audit Mongo riêng gần nhất thành công: 19/19 kịch bản, tệp `.local-ledger/business-model-audit-erp_business_model_audit_1788516871040_0ec10d.json`. Kiểm tra thật giữ chỗ/xuất kho và gửi lại, nhưng transaction nhận hoàn/persistence đơn của nhánh RMA có mô phỏng; chưa chứng minh rollback transaction thật.
- Lần audit mở rộng sau đó không kết nối được Mongo local 27027. Không tuyên bố đạt bài tích hợp mới về điều chỉnh phí sau gửi lại.
- Lệnh khởi động lại backend và giao diện trước đó bị xét duyệt tự động từ chối (`blocked by policy`). Chưa kiểm tra bản mới qua HTTP/trình duyệt; không chạy đường vòng khởi động. Script replica set local đã chuẩn bị nhưng chưa chạy, nên transaction nhận hoàn thật chưa nghiệm thu.
- Còn cần kiểm tra xuyên suốt tạo sản phẩm → báo giá → đơn → giao → nhận hoàn → xuất lại → đối chiếu báo cáo trên Mongo replica set local riêng. Sau đó mới xem xét dữ liệu lịch sử và thay thế báo cáo cũ; chưa được phép triển khai.
- Chưa có luồng tổng quát chuyển nơi giữ/tách nhiều lô, nhiều sản phẩm trên một dòng đơn, hủy sau sản xuất hay khách trả sau khi giao thành công. Các thao tác điều chỉnh kho cũ không biết lô/chủ sở hữu đã bị chặn để tránh sai tồn; chưa thay bằng đầy đủ quy trình điều chỉnh theo lô.

Lệnh kiểm tra mã không dùng database cũ:

```powershell
# Trong backend
npm run build
node --require ./scripts/local-ledger-guard.cjs ./node_modules/jest/bin/jest.js --runInBand --silent src/test-order2 src/business-ledger
# Trong frontend
npm run build
```
