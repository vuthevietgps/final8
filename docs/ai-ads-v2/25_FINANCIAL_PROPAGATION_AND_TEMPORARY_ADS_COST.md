# Cập nhật lợi nhuận và chi phí Windsor tạm tính — 2026-09-08

## Phạm vi đã nối

| Nguồn thay đổi | Xử lý |
|---|---|
| Sản phẩm / nhóm sản phẩm | Tìm ngày có đơn liên quan, tính lại dữ liệu đầu vào theo quy tắc snapshot và cập nhật báo cáo/cache |
| Báo giá đại lý / báo giá NCC (tạo, sửa, duyệt, từ chối) | Tính lại các ngày liên quan; chỉ lấy báo giá đã duyệt, có hiệu lực theo ngày đơn; giữ giá đã chốt |
| Đơn hàng (tạo/sửa/xóa, đổi ngày hoặc nhóm ads) | Phân bổ lại cả ngày cũ và ngày mới, gồm những đơn cùng chia chi phí |
| Nhập đơn JSON | Tính dữ liệu đầu vào và phân bổ các ngày vừa nhập |
| Vận đơn, phí từng lần giao, xác nhận hàng hoàn | Cập nhật lợi nhuận và báo cáo sau khi thay đổi nghiệp vụ đã lưu |
| Chi phí ads thủ công / native | Theo quy trình phân bổ hiện có, nay nối sang báo cáo và tài chính; native vẫn có debounce |
| Nhân công / chi phí khác (tạo, sửa, xóa, đổi ngày) | Chờ hàng đợi tính lại các ngày cũ/mới; lỗi được trả về và job đã tạo được thử lại |
| Windsor | Ghi đè theo tài khoản/nhóm/ngày; tự tính lại cả các ngày lịch sử vừa đồng bộ |

Chuỗi chung: dữ liệu nguồn → hàng đợi theo ngày → tính đầu vào khi cần → phân bổ chi phí → netProfit và realizedNetProfit đã có căn cứ → báo cáo nhóm/ngày → ads_daily_spendings và reinvestmentUsed → snapshot công nợ / cache tài chính. Sổ nghiệp vụ đọc lại dữ liệu nguồn hiện tại để tổng hợp sản phẩm, đại lý, nhóm ads và lợi nhuận.

Không tự tạo khoản thu/chi ngân hàng, không dùng chi phí tạm để hợp thức hóa thanh toán. Giá và chính sách thương mại đã chốt, giá vốn kho, chứng từ tiền và snapshot quyết định lịch sử không bị viết lại theo bảng giá mới. Product fallback của đơn chưa xuất vẫn có thể cập nhật theo giá/quote hợp lệ; fallback đã xuất hoặc đã thực hiện giữ lịch sử.

## Độ bền và tính lại tài chính

- `ads_cost_refresh_jobs`: khóa ngày duy nhất, version, pending, revalue và lease. Nguồn thay đổi trong khi đang tính làm version tăng; kết quả cũ không xóa yêu cầu mới.
- Cron thử lại việc chưa hoàn tất mỗi 5 phút, tối đa 30 ngày/lượt, lease 30 phút. Đây là khóa cho luồng refresh dùng hàng đợi, không phải transaction bao toàn bộ ERP.
- Windsor ghi chi phí và đánh dấu việc cần tính lại trong cùng MongoDB transaction. API chỉ báo hoàn tất projection sau bước refresh; lỗi projection để lại việc pending.
- Báo cáo chi phí cập nhật theo chênh lệch trên snapshot vốn đã gắn ban đầu: tăng, giảm, về 0, chạy lặp đều được xử lý. Tracking chi phí và cập nhật vốn nằm cùng transaction.
- Cập nhật catalog/đơn hàng phát sự kiện sau khi lưu nguồn. Nếu bước sau lưu thất bại, nguồn có thể đã được lưu; lỗi được trả về và các job đã tạo còn pending. Không coi đây là rollback toàn bộ thao tác nghiệp vụ.
- Lợi nhuận đã thực hiện được điều chỉnh chi phí trên `realizedGrossProfit` hiện có, không tự suy diễn việc đã thanh toán từ trạng thái giao hàng.
- Ngày không có đơn vẫn nhận toàn bộ chi phí ads trong báo cáo nhóm/ngày. Không phân bổ chi phí đó sang đơn không liên quan.

## Tạm tính khi Windsor gián đoạn

- Áp dụng khi provider báo timeout, unavailable hoặc rate limit. Lỗi quyền, cấu hình, hợp đồng dữ liệu, ngoại tệ không được che bằng ước tính.
- Theo đúng connection, Google account và ad group; dùng trung bình tối đa 7 ngày có chi phí thực trong 28 ngày trước ngày cần tính, tối thiểu 3 mẫu. Có thể dùng ngày chi phí thực bằng 0; ngày thiếu không tự xem là 0.
- Không dùng số tạm làm mẫu, không dùng ngày tương lai; nhóm không có mẫu thực trong 7 ngày gần nhất không được tiếp tục ước tính.
- Chỉ chèn ô còn thiếu, không hạ dữ liệu thực thành số tạm. Lưu `isEstimated`, phương pháp, ngày mẫu, thời điểm ước tính. Thiếu mẫu được báo unresolved.
- Windsor trả số thực sẽ ghi đè và xóa nhãn tạm; lượt đọc đầy đủ thành công không còn dòng của nhóm tạm thì thay placeholder bằng 0. Lượt đọc lỗi/partial không xóa placeholder của phần chưa đọc thành công.
- Cron 06:00 đọc lại 7 ngày trọn vẹn gần nhất, gồm hôm qua. Khoảng cũ hơn cần đồng bộ thủ công (tối đa 30 ngày mỗi lần); đây chưa phải lịch backfill mọi khoảng mất dữ liệu vô hạn.
- Giao diện sổ chi phí, kết nối Windsor, báo cáo lợi nhuận ngày hiển thị số tạm. API sổ nghiệp vụ trả `quality.estimatedAdsRows/estimatedAdsSpend`; bộ evidence không coi lợi nhuận có số tạm là dữ liệu fresh để scale.
- Ước tính không bảo đảm bằng chi phí thực và không thay thế đối soát. Trạng thái read-sync vẫn partial/failed khi dùng số tạm.

## Triển khai và kiểm tra

### Nhân công, vận hành, COD và tiền cọc

- Nhân công và chi phí khác phân bổ theo số lượng sản phẩm trong tất cả đơn đang hoạt động cùng ngày Việt Nam, gồm cả đơn không từ quảng cáo. Đây là phân bổ chi phí chung, không phải chấm công trực tiếp theo từng sản phẩm.
- Làm tròn từng dòng chi phí nguồn sang VND rồi mới cộng/phân bổ; đơn hàng và sổ nghiệp vụ dùng cùng quy tắc. Ví dụ hai dòng 100,4đ cộng thành 200đ trên cả hai báo cáo.
- Sửa tăng/giảm, xóa hoặc đổi ngày chi phí làm đổi chi phí phân bổ và lợi nhuận thuần; doanh thu, giá vốn hàng hóa không đổi. Xác nhận đã chi không ghi nhận chi phí lần thứ hai; các khoản đã chốt vẫn giữ quy tắc chống sửa/xóa hiện có.
- Ngày có chi phí chung nhưng không có đơn được sổ nghiệp vụ giữ ở dòng “chưa phân bổ”, lợi nhuận âm tương ứng. Không dồn sang sản phẩm/nhóm quảng cáo/ngày khác. Báo cáo chuyên ads theo ngày không phải báo cáo toàn bộ chi phí chung chưa phân bổ.
- Ngày/giờ nhân công dùng UTC+7 rõ ràng, độc lập múi giờ máy chủ. Không chuyển đổi ngược dữ liệu nhân công lịch sử đã lưu.
- `codAmount`, `depositAmount`, `manualPayment` trên đơn là thông tin thu tiền. Sửa các trường này kích hoạt refresh nhưng không thay thế `retailSaleAmount` hay báo giá bán đại lý, và không tạo chứng từ tiền. Nếu thực sự đổi giá bán, dùng quy trình giá bán/điều chỉnh phù hợp.
- Chứng từ nhận cọc/COD được xác nhận mới tác động tiền thực thu và công nợ; không cộng doanh thu hoặc lợi nhuận lần thứ hai. Chỉ gõ tiền cọc trên đơn không giảm phải thu trong sổ nghiệp vụ.
- Test `business-ledger.report.financial-flows.spec.ts` đối chiếu chi phí, doanh thu, lợi nhuận ở đơn/sản phẩm/nhóm; `order-collection-inputs.spec.ts` kiểm tra lưu COD/cọc và chờ refresh; `overhead-financial-inputs.spec.ts` kiểm tra sự kiện tạo/sửa/xóa, ngày cũ/mới và lỗi sau lưu. Script MongoDB local kiểm tra tổng phân bổ và đối chiếu lợi nhuận thực lưu, bao gồm số nguồn có phần thập phân.

Chạy test với múi giờ server UTC trong PowerShell (ở `backend`):

```powershell
$env:TZ = 'UTC'
npm test -- --runInBand --silent overhead-financial-inputs order-collection-inputs business-ledger.report financial-propagation financial-input-events advertising-cost-refresh profit-recalculation-timing cost-history-protection order-business-financial operational-projection
```

MongoDB cần hỗ trợ transaction (replica set/Atlas). Khóa mã hóa vault và các cổng thực thi ads vẫn theo cấu hình an toàn hiện có. Không bật Google/Meta production chỉ để đọc chi phí.

Trong `backend`:

```powershell
npm run build
npm test -- --runInBand --silent financial-propagation financial-input-events advertising-cost-refresh windsor profit-recalculation-timing test-order2 supplier-quote product.service return-request ads-automation-evidence.service ads-automation-evidence.rules ad-group-daily-report.logic business-ledger.report
npm run db:indexes:check
```

Sau khi đối chiếu kết quả kiểm tra index trên môi trường đích, dùng script index hiện có để áp dụng các index còn thiếu. Không chạy trên URI nhầm môi trường. Các index bổ sung: `ads_cost_refresh_jobs.day`, `ads_daily_spendings(date,snapshotId)`, `ad_group_daily_reports(date,adGroupId)`.

Kiểm tra transaction thật, chỉ chấp nhận replica local có sẵn tại `127.0.0.1:27027`, tên `erp-local-ledger`:

```powershell
node scripts/verify-financial-propagation-local.cjs
```

Script tạo database kiểm thử riêng rồi xóa đúng database đó; không đọc `.env`, không dùng credential và không gọi nhà cung cấp. Kiểm tra tăng/giảm/0/lặp, số tạm → số thực, ngày không có đơn, rollback transaction và retry với service mới.

Trong `frontend`: `npm run build`. Trước vận hành, nghiệm thu ERP với credential Windsor thật và đối chiếu tổng chi phí từng tài khoản/ngày. Test local không chứng minh hợp đồng phản hồi tài khoản thật hoặc trạng thái database server.
