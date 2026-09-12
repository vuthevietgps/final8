# Kiểm tra đồng bộ chi phí Facebook / Google / TikTok — 05/09/2026

## Kết luận và phạm vi

Logic hiện tại chưa đủ tin cậy để coi số chi phí tự động là đầy đủ, đã đối soát. TikTok sai hợp đồng request/response; Facebook và Google có cấu trúc lấy chi phí cơ bản phù hợp nhưng còn lỗi chọn nhóm, xử lý thất bại và cập nhật lại lịch sử.

Kiểm tra bản working tree hiện có trong `final8-version16`, bao gồm các thay đổi chưa commit của người dùng. Không sửa mã ứng dụng, không đọc `.env`, không kết nối database hay gọi API tài khoản quảng cáo thật. Vì vậy chưa kết luận token/quyền truy cập, cron production hoặc số tiền thực tế đang đúng hay sai bao nhiêu. Hai file mới chỉ là báo cáo và script chẩn đoán offline.

Tài liệu chỉ dẫn `00-index.md` không tồn tại; đã dùng `docs/ai-ads-v2/00_README_INDEX.md` thực tế trong repository.

## Luồng thực tế

- `FinanceModule` đăng ký `DataCollectionService`. Cron `0 6 * * *`, múi giờ `Asia/Ho_Chi_Minh`, đồng bộ cả ba nền tảng cho ngày hôm trước.
- Lịch chính dùng `previousBusinessDay()`, rồi chờ ba tác vụ settle, phân bổ lại chi phí đơn hàng và tạo báo cáo nhóm quảng cáo. Cách xác định ngày Việt Nam của lịch chính đã đúng trong bản hiện tại.
- Dữ liệu chi phí được upsert vào `AdvertisingCost`, liên kết với nhóm ERP bằng ID nhóm trên nền tảng. Facebook dùng ad set ID; Google/TikTok dùng ad group ID. Đây không phải ngân sách campaign và cũng không phải tiền thanh toán hóa đơn cho nền tảng.
- Các hàm `cronDaily`, `cronDailyGoogle`, `cronDailyTiktok` hiện không có decorator cron; chỉ là fallback. Nhánh đồng bộ Facebook mỗi 10 phút trong auto-control bị chặn bởi `isApprovalPolicyIntegrated() === false`.
- Khi `ERP_LOCAL_SANDBOX=true`, scheduler bị tắt. Việc cron production thực sự hoạt động cần bằng chứng runtime riêng.

## Phát hiện cần sửa

### 1. P1 — TikTok sai phương thức, tham số và vị trí đọc dữ liệu

File `backend/src/advertising-cost/advertising-cost.tiktok-sync.service.ts:150–195`.

Code gọi `POST /open_api/v1.3/report/integrated/get/`, đưa ngày trong `time_range`. API chính thức yêu cầu GET với `start_date`, `end_date` ở query; các danh sách dimensions/metrics được serialize theo hợp đồng API. SDK chính thức xác nhận phương thức và tham số này: [TikTok ReportingApi](https://github.com/tiktok/tiktok-business-api-sdk/blob/main/python_sdk/docs/ReportingApi.md).

Response báo cáo có `data.list[].dimensions` và `data.list[].metrics`. Code lại đọc `row.adgroup_id`, `row.spend`, `row.stat_time_day` trực tiếp. Vì ID không tìm thấy, row hợp lệ bị bỏ qua ngay tại dòng 172. [Ví dụ request/response chính thức TikTok](https://ads.tiktok.com/gateway/docs/index?doc_id=1738864778664961&language=ENGLISH).

Đã tái hiện offline: response đúng cấu trúc, chi phí 150.000, trả `updated=0`, không ghi bản ghi nào. Phải sửa cả request lẫn parser; chỉ thay POST thành GET chưa đủ.

### 2. P1 — Sync thất bại vẫn được xử lý như dữ liệu đã sẵn sàng

- TikTok dòng 168 không kiểm tra `res.data.code`; lỗi nghiệp vụ được trả thành 0 cập nhật. Lỗi HTTP cũng bị catch rồi trả số cập nhật hiện có.
- Google dòng 191–193 catch lỗi API rồi trả 0.
- Facebook dòng 225–227 trả null khi lỗi; một nhóm cập nhật được có thể xóa trạng thái lỗi của toàn lần chạy ở dòng 332–335.
- `backend/src/finance/data-collection.service.ts:157–175` dùng `allSettled`, chỉ log lỗi, không trả trạng thái thiếu dữ liệu. Dòng 76 và 82 vẫn phân bổ đơn và tạo báo cáo.
- `getPipelineStatus()` dòng 367–394 trả `SUCCESS`, thời gian hiện tại và duration cố định, không đọc lịch sử chạy thực.

Đã tái hiện: một nền tảng throw lỗi, pipeline vẫn chạy `recalculate` và `snapshot`; status vẫn SUCCESS. Cần phân biệt thành công đầy đủ, thành công một phần, không phát sinh chi phí, thiếu cấu hình và thất bại theo tài khoản/ngày. Nếu tiếp tục tính báo cáo, phải đánh dấu tạm tính/thiếu nguồn; không coi dữ liệu là đã chốt.

### 3. P1 — Lọc trạng thái hiện tại làm mất chi phí lịch sử

Facebook dòng 300, Google dòng 207, TikTok dòng 244–248 chỉ lấy nhóm `isActive:true`; cả ba cũng lọc tài khoản active. Facebook còn đồng bộ trạng thái nhóm từ nền tảng mỗi giờ (`ad-group.sync.service.ts:72,183`).

Ví dụ nhóm đã tiêu tiền ngày 04/09 rồi bị pause tối đó: lúc 06:00 ngày 05/09, nhóm inactive bị loại khỏi truy vấn nên chi phí 04/09 không được lấy. Chi phí lịch sử cần được truy vấn độc lập với việc nhóm có đang chạy ở thời điểm đồng bộ hay không.

TikTok còn có ngoại lệ không nhất quán: nếu tập nhóm active rỗng, điều kiện `filter.size > 0` dòng 173 khiến bỏ lọc hoàn toàn. Sau khi sửa parser, tài khoản không có nhóm active có thể nhập tất cả nhóm chưa được liên kết ERP.

### 4. P2 — Chỉ tự lấy D-1; không có đối soát lại hay bù ngày lỗi

Cron chính chỉ gọi `syncForDate` một ngày, không có vòng lấy lại D-2/D-3 hay hàng đợi ngày bị lỗi. Dữ liệu nền tảng có độ trễ và có thể điều chỉnh; 06:00 không đồng nghĩa số liệu vĩnh viễn đã chốt. Google mô tả độ trễ khác nhau giữa thống kê và conversion: [Data freshness](https://support.google.com/google-ads/answer/2544985?hl=en).

Nếu ngày 04/09 đồng bộ lỗi, lần cron tiếp theo sẽ đi sang ngày 05/09, không tự bù ngày 04/09. `syncRange` có hỗ trợ tối đa 14 ngày nhưng phải được gọi riêng. Nên có lịch đối soát lại ngắn cho spend và cửa sổ phù hợp attribution cho conversion, cùng cơ chế retry ngày thiếu dữ liệu.

Ngoài ra, response rỗng hiện không đối soát bản ghi cũ về 0. Google có thể không trả các dòng zero metrics khi phân đoạn theo ngày: [Zero metrics](https://developers.google.com/google-ads/api/docs/reporting/zero-metrics). Chỉ được chuẩn hóa ngày không phát sinh sau khi xác nhận truy vấn đầy đủ, không phải lỗi/thiếu quyền.

### 5. P2 — Đồng bộ thủ công có thể lệch ngày và không tính lại lợi nhuận

Các `syncRange` dùng `new Date()`, trừ ngày bằng `setDate`, rồi `toISOString()`; khác với helper ngày Việt Nam của cron chính. Đã tái hiện lúc 06:00 Việt Nam ngày 05/09, Google syncRange không truyền ngày yêu cầu **03/09**, thay vì **04/09**. Facebook/TikTok có cùng mẫu mã.

`advertising-cost.controller.ts:134–184` gọi trực tiếp các hàm range. Những hàm này chỉ upsert chi phí, không gọi queue recalculation, không phát event và không tạo lại daily report. Queue chỉ được gọi ở fallback cron không được scheduler đăng ký. Vì vậy bấm lấy lại chi phí một ngày cũ có thể đổi bảng chi phí nhưng để lợi nhuận đơn/báo cáo ngày ở giá trị cũ.

### 6. P2 — TikTok làm sai các chỉ số phụ

`advertising-cost.tiktok-sync.service.ts:119–126` không lưu clicks mặc dù request và parser có truyền. Đã tái hiện upsert bỏ mất 30 clicks.

Dòng 194–195 gán conversion chung vào `messagingConversationStarted7d` / `costPerMessagingConversation`. Chuyển đổi mua hàng hoặc lead không mặc nhiên là hội thoại. Schema hiện đã có `conversions` / `costPerConversion`; cần dùng đúng loại chỉ số. Đây là lỗi KPI, tách biệt với lỗi số tiền ở mục 1.

### 7. P2 có điều kiện — Chưa ràng buộc đơn vị tiền trước khi tổng hợp tài chính

Cả ba service ghi số tiền trực tiếp; `AdvertisingCost` không lưu currency/tỷ giá. AdAccount có currency nhưng đường sync không kiểm tra bắt buộc VND. Hệ thống cộng `spentAmount` trực tiếp vào chi phí/lợi nhuận VND.

Google micros là đơn vị phần triệu của tiền tệ tài khoản, không phải phép đổi USD sang VND. Nếu tất cả tài khoản đều VND thì không phát sinh lỗi này; nếu có tài khoản ngoại tệ thì cần chặn hoặc chuyển đổi có lưu nguyên tệ/tỷ giá. Chưa kiểm tra danh sách tài khoản thực tế. [Google mô tả cost micros theo tiền tệ tài khoản](https://developers.google.com/google-ads/api/reference/rpc/v25/Recommendation.RecommendationMetrics).

## Những phần phù hợp và giới hạn Facebook

- Google: `POST googleAds:searchStream`, body GAQL, OAuth bearer, developer token, login customer ID và đọc mảng streams/results phù hợp [Google Search & SearchStream](https://developers.google.com/google-ads/api/rest/common/search). Query mức ad_group/ngày, cost/CPC/CPM chia 1.000.000 và upsert có customerId đúng về cấu trúc. Đã kiểm chứng micros 150.000.000.000 thành 150.000; CPC 5.000.000.000 thành 5.000.
- Google mặc định v24 vẫn nằm trong thời gian hỗ trợ theo [lịch sunset](https://developers.google.com/google-ads/api/docs/sunset-dates). Cấu hình môi trường có thể override; chưa kiểm tra phiên bản runtime thật.
- Facebook: GET `/{adset-id}/insights`, `level=adset`, time_range cùng ngày, time_increment=1 và đọc spend đúng hướng của [SDK Meta chính thức](https://raw.githubusercontent.com/facebook/facebook-python-business-sdk/main/facebook_business/adobjects/adset.py). Một adset/một ngày/không breakdown không phải lỗi phân trang hiển nhiên.
- Facebook hard-code `action_attribution_windows: '7d_click,1d_view'`; SDK khai báo danh sách. Nên serialize theo định dạng tài liệu và dùng attribution đã thống nhất với Ads Manager. Chưa gọi thật để xác nhận Graph có chấp nhận dạng chuỗi phân cách này hay không; **không coi đây là lỗi HTTP đã được chứng minh**. Việc cố định cửa sổ có thể làm khác KPI hội thoại/conversion của từng adset, không tự làm thay đổi ý nghĩa spend.
- Ngày ở lịch chính đúng cho múi giờ Việt Nam. ERP có kiểm tra timezone lúc thêm/cập nhật tài khoản; đường sync không tự chuyển dữ liệu account timezone khác sang Việt Nam. Cần xác nhận timezone của tài khoản đã lưu trước khi đối chiếu số theo ngày.
- Khóa lưu cost là channel/customerId/adGroupId/date, nhưng một số phép tổng hợp chỉ group theo adGroupId (`order-calculation.service.ts:663`). AdGroup đang unique toàn hệ thống theo adGroupId. Khi mở rộng đa tài khoản cần rà soát đầy đủ định danh; chưa chứng minh có va chạm trên dữ liệu hiện tại.

## Kiểm chứng đã chạy

Từ thư mục backend:

```powershell
npm test -- --runInBand --runTestsByPath src/advertising-cost/advertising-cost.google-sync.service.spec.ts src/finance/profit-recalculation-timing.spec.ts src/ad-account/ad-account.timezone-check.service.spec.ts
node ../reports/ads-cost-sync-audit-20260905.cjs
```

Kết quả: 3 Jest suites, 13 tests pass; script offline hoàn tất 6 nhóm kiểm chứng. Script chẩn đoán xác nhận hành vi lỗi hiện tại, không phải acceptance test khẳng định hệ thống đã sửa đúng. Nó chạy phương thức service qua TypeScript transpilation, mock HTTP/database/decorator, không kiểm tra Nest dependency injection hay API thật.

Thử nghiệm ban đầu với ts-node transpile-only bị lỗi metadata `User.role` khi import schema; đã chuyển script sang cô lập các dependency. Không thay schema ứng dụng để phục vụ audit.

Ưu tiên sửa: TikTok request/parser → kết quả sync và độ đầy đủ → lấy lịch sử nhóm paused → đối soát/bù ngày và recalculation → KPI/currency. Sau đó kiểm chứng đọc qua ERP với một tài khoản mỗi nền tảng, đối chiếu cùng ngày, timezone, tiền tệ, gồm nhóm active và paused. Không cần bật production execution hoặc thay ngân sách để kiểm chứng chi phí.
