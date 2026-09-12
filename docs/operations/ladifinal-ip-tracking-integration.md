# Ladifinal → ERP: tracking IP và đánh giá click đáng ngờ

Ngày khảo sát: 08/09/2026. Trạng thái: đã đọc mã nguồn và kiểm tra bộ test collector hiện có; đây là thiết kế tích hợp, chưa triển khai connector hoặc bật đồng bộ server thật.

## Mục đích

ERP nhận mọi lượt vào có dấu hiệu Google Ads, các lần liên hệ và hành vi trên trang để quản lý IP cùng khách tiềm năng. ERP có thể đối chiếu một IP nhiều lượt vào với hồ sơ tư vấn và đơn đã chốt. Điểm nghi ngờ là bằng chứng tham khảo, không phải kết luận gian lận hoặc lý do tự động bỏ khách.

Luồng dự kiến:

```text
Khách vào landingpage
  → Ladifinal ghi lượt truy cập và IP phía máy chủ
  → JavaScript gửi hành vi về Ladifinal cùng nguồn
  → Ladifinal ghi thay đổi + outbox trong một transaction SQLite
  → worker gửi batch có xác thực sang ERP và retry khi lỗi
  → ERP giữ visit / event / engagement riêng
      ├─ Danh sách lượt truy cập và khách tiềm năng
      ├─ Tổng hợp IP và lý do cần kiểm tra
      └─ Khách đã chốt → nghiệp vụ OrderTest2 hiện có
```

Không gọi ERP đồng bộ trong request tải landing. Không đặt khóa tích hợp ERP trong JavaScript. Mất kết nối ERP không được làm hỏng landing hoặc mất lượt đã ghi tại nguồn.

## Mã nguồn đã đọc

Các đường dẫn Ladifinal tính từ `C:/Users/PC/Documents/code/ladifinal/ladifinal`:

- `app/routes/click_tracking_routes.py`: thu request Ads, IP, cookie, nhận sự kiện; trang quản trị và xuất IP.
- `app/click_tracking_repository.py`: lưu SQLite, chống reload gần nhau, chấm điểm và CRM.
- `app/db.py`: cấu trúc ad_click_visits, ad_visit_events, ad_visit_orders.
- `static/js/click-fraud-tracker.js`: page view, heartbeat, scroll, phone/Zalo/Messenger/form.
- `templates/click_fraud.html`: danh sách IP đề xuất, copy và xuất TXT/CSV thủ công.
- `tests/test_click_tracking.py`: ba kiểm thử đã chạy thành công với SQLite tạm; tắt dotenv và kết nối mạng trong tiến trình kiểm thử.

Phần ERP tái sử dụng: TrackingSource/Visit/Event/Lead/OrderLink, bộ lọc/phân trang TrackingCrmService, AdsAttributionOptionsService, OrderCalculationService và TestOrder2Service. Chưa thấy endpoint nhận dữ liệu Ladifinal hay worker outbox trong module Tracking hiện tại.

## Ladifinal đang làm gì

Collector nhận GET public có gclid/wbraid/gbraid hoặc UTM Google trả phí. Bản ghi giữ visit_token, thời gian UTC, IP, click ID/type, landing path/name, campaign/group, keyword/network/device/match type, country, user agent và referrer.

Page view, thời gian ở trang và độ cuộn cập nhật các cột tổng hợp trên visit. Chỉ contact/phone/zalo/inbox/form_submit được ghi từng dòng vào ad_visit_events. ad_visit_orders là ghi chú/hồ sơ CRM riêng; tên bảng không có nghĩa đó là đơn ERP đã chốt.

Điểm rủi ro hiện tại theo IP trong kỳ chọn (mặc định 7 ngày, tối đa 90 ngày):

| Dấu hiệu | Điểm hiện có |
|---|---:|
| ≥3 / ≥4 / ≥6 / ≥10 lượt trong kỳ | +10 / +20 / +30 / +40 |
| ≥3 lượt, ít nhất 80% không tương tác rõ | +20; thêm +5 nếu tất cả không tương tác |
| ≥3 / ≥6 lượt trong một cửa sổ 10 phút | +20 / +30 |
| ≥4 lượt, ≥3 click ID khác nhau, tỷ lệ ≥75% | +10 |
| ≥5 lượt không có liên hệ/form | +10 |
| Có country và tất cả nằm ngoài vùng cấu hình | +20 |
| ≥5 lượt và chỉ một chuỗi user agent | +5 |
| Có liên hệ/form | −20 |
| Nếu không có liên hệ nhưng ≥50% lượt có tương tác | −15 |

Điểm giới hạn 0–100. Mức theo dõi từ 30, trung bình từ 50, cao từ 70; trung bình/cao được đề xuất kiểm tra. Tương tác rõ hiện được tính khi ở trang ≥10 giây, cuộn ≥25%, hoặc có liên hệ/form. Công cụ hiện chỉ đề xuất và xuất IP; không thực thi chặn Google Ads.

## Các điểm phải xử lý trước khi nối thật

1. **Độ tin cậy IP:** collector mặc định tin CF-Connecting-IP nếu hợp lệ về cú pháp, chưa tự kiểm tra request đến từ proxy Cloudflare tin cậy. Cần xác minh cấu hình mạng origin/proxy; chỉ nhận header này từ đường đi được tin cậy. ERP dùng IP khách đã được collector xác minh, không dùng IP máy chủ Ladifinal đang gửi batch. Country cũng phải gắn mức độ tin cậy.
2. **Thiếu host/account/dealer:** bảng hiện chưa có landingHost, Ads account ID và ERP dealer ID. Cần binding do quản trị cấu hình giữa source/landing và tài khoản Ads, nhóm sản phẩm, tài khoản đại lý. URL có thể cung cấp bằng chứng thô, nhưng không được tự quyết định agentId/báo giá. Không suy đoán host cho dữ liệu cũ của nguồn phục vụ nhiều domain.
3. **Campaign thô:** campaign_id có thể lấy từ utm_campaign, tức là tên chiến dịch. Phải giữ riêng bằng chứng này và chỉ đánh dấu đã đối chiếu khi khớp tài khoản/campaign/adgroup ERP; không gán trực tiếp thành ID chuẩn.
4. **Chống trùng tại nguồn còn hạn chế:** hiện xét IP + path + clickId trong 30 giây, chưa có host, account hay adgroup. Với UTM không có clickId, hai lượt hợp lệ cùng IP/path có thể bị gộp. ERP giữ nguyên visit_token cho backfill; cải thiện collector cho dữ liệu mới, không bịa lại lượt cũ đã bị gộp.
5. **Hành vi là snapshot:** không thể dựng lại đầy đủ thời điểm heartbeat/scroll từ dữ liệu cũ. Đồng bộ các số tổng hợp riêng, không tạo các sự kiện giả. Counter snapshot không cộng dồn qua mỗi lần gửi lại.
6. **Sự kiện trình duyệt chưa có ID chống retry:** mỗi lần phone/Zalo/form gửi thành công sẽ tăng bộ đếm và thêm event; cần event UUID ổn định trước lần gửi đầu cho collector mới. ID SQLite chỉ chống trùng khi chuyển chính dòng đó sang ERP, không sửa được trùng đã xảy ra trước khi lưu tại nguồn.
7. **Cookie nhiều tab:** sự kiện hiện chỉ dựa vào cookie visit_token dùng chung trong 30 phút. Một click Ads ở tab mới có thể thay cookie của tab cũ. Cần binding event theo visit của từng trang/tab do server cấp và xác minh, thay vì đọc cookie hiện tại làm nguồn duy nhất.
8. **Chất lượng tín hiệu:** heartbeat đo thời gian từ lúc tải trang nên có thể bao gồm lúc tab bị ẩn; form_submit là thao tác submit, chưa xác nhận form đã được máy chủ nhận. Không gọi các tín hiệu này là khách đã chốt hay chuyển đổi Ads đã được xác nhận. Request được ghi trước khi biết HTTP response có thành công hay không; cần lưu status/loại tài nguyên hoặc chỉ xác nhận landing HTML hợp lệ.
9. **Hiệu năng và lưu trữ:** analyze_ips hiện lấy toàn bộ lượt trong kỳ vào Python rồi nhóm IP, chưa phân trang. ERP cần tổng hợp có giới hạn thời gian/index, cập nhật nền và phân trang; không chạy lại toàn bộ lịch sử khi bấm Mở hồ sơ. Retention Ladifinal có thể xóa lượt cũ chưa có ghi chú; phải tách chính sách retention và ACK đồng bộ, cảnh báo hàng đợi chưa gửi, không âm thầm xóa dữ liệu đang chờ.

Các nhận xét trên là từ mã nguồn; chưa xác minh cấu hình proxy, retention đang bật, lượng dữ liệu hay việc xuất IP trên server thật.

## Hợp đồng dữ liệu đề xuất

| Dữ liệu nguồn | Đích ERP / quy tắc |
|---|---|
| Namespace collector/database | TrackingSource.sourceKey do ERP đăng ký, tách namespace khi fork/reset database |
| visit_token | externalVisitId, unique (sourceId, externalVisitId) |
| occurred_at | occurredAt UTC; receivedAt do ERP tự ghi |
| IP, country | ipAddress chuẩn hóa IPv4/IPv6 + phương thức xác minh IP; thiếu thì unknown |
| landing_path/name + host mới | landingPath/name/host; host đối chiếu cấu hình nguồn |
| click/campaign/group/keyword/network/device/match_type | Bằng chứng ads gốc; giữ độc lập với danh tính ERP đã resolve |
| ad_visit_events.id | externalEventId = legacy-event:{id}, trong namespace nguồn |
| UUID của event mới | Dùng lại UUID khi retry; không sinh ID mới ở ERP |
| page_views, engaged_seconds, max_scroll, contact_actions, form_submits, last_seen_at | TrackingVisitEngagement snapshot riêng, unique visitId; có sourceRevision tăng dần |
| user_agent | Chuẩn hóa/băm có phiên bản cho tín hiệu lặp; chỉ giữ raw nếu có nhu cầu đối chiếu và giới hạn truy cập/retention |
| referrer | Origin/path đã lọc; không lưu nguyên query chứa thông tin nhạy cảm |
| ad_visit_orders cũ | Import lead ở luồng riêng, xử lý xung đột ownership; không tự tạo OrderTest2 hoặc ghi đè CRM ERP |

Không thêm counter thay đổi vào phần bằng chứng visit bất biến. Snapshot engagement chỉ nhận revision mới hơn; revision bằng nhau cùng nội dung là retry, cùng revision khác nội dung là conflict; revision cũ bị bỏ qua. Dữ liệu legacy backfill phải có quy trình snapshot/checkpoint nhất quán; không dùng timestamp chỉ chính xác đến giây làm revision duy nhất.

Batch dự kiến `POST /api/tracking-crm/ingest/batches` (chưa có): schemaVersion, batchId, visits, events, engagementSnapshots; tối đa 100 mục và 256 KiB/batch ở bước đầu. Danh tính source lấy từ credential đã xác thực, không tin sourceId trong payload. Timestamp/chữ ký chống replay dùng thời điểm gửi, độc lập với occurredAt của dữ liệu cũ.

Mỗi source có credential riêng, lưu phía máy chủ qua secret store/tham chiếu mã hóa; hỗ trợ xoay khóa. HMAC cần ký đúng raw body, timestamp và batchId, kiểm tra constant-time; allowlist domain/CORS không thay thế xác thực. Ngày dữ liệu bất hợp lý, ID quá dài, IP không hợp lệ và thay đổi bằng chứng bất biến phải bị từ chối có mã lỗi.

ERP ACK từng mục sau khi lưu bền vững: accepted/duplicate/stale/rejected. Timeout thì retry cùng ID; worker không tăng cursor chỉ vì đã gửi request. Sự kiện đến trước visit giữ pending theo source + visit ID và chỉ đưa vào báo cáo khi có visit hợp lệ. Worker backoff, giới hạn hàng đợi và hiện last success/pending/failed/rejected/delay trong trạng thái nguồn. Không ghi token/chữ ký/raw payload khách vào log lỗi.

Outbox phải được ghi cùng transaction với thay đổi dữ liệu nguồn. Chỉ quét last_seen_at hoặc chỉ đọc những visit ID mới sẽ bỏ sót các lần liên hệ/ở trang cập nhật sau. Với nhiều tiến trình worker cần claim/lease để phối hợp, và ERP vẫn idempotent nếu lease hết hạn rồi gửi lại.

## Cách trình bày trong module

- **Lượt truy cập & khách tiềm năng:** bảng hiện có; thêm thời gian ở trang/độ cuộn trong hồ sơ, mức độ tin cậy nguồn và trạng thái đồng bộ.
- **Phân tích IP:** một dòng/IP trong phạm vi source/tài khoản/kỳ chọn; lượt vào, click ID khác nhau, burst 10 phút, tỷ lệ thiếu tương tác, liên hệ, số lead và đơn liên kết riêng biệt, điểm/lý do. Bấm IP mở các visit với cùng bộ lọc. Bật tổng hợp xuyên nguồn chỉ khi người dùng chọn rõ, không gộp điểm từ những tài khoản không liên quan.
- **Theo dõi xử lý:** chưa xem/đang theo dõi/có khách thật/đề xuất kiểm tra chặn, người đánh giá và ghi chú. Không dùng cờ điểm nghi ngờ để xóa lead, cộng doanh thu hay tự chặn quảng cáo.

Điểm cần lưu ruleVersion, cửa sổ thời gian, phạm vi nguồn/tài khoản và completeness/updatedAt. Không có heartbeat do lỗi tracker là thiếu quan sát, không mặc định là khách vào rất ngắn. Không cộng điểm legacy và điểm ERP vào nhau. Khách có tương tác/đơn là tín hiệu giảm nghi ngờ, không phải bảo đảm cả IP đều hợp lệ.

## Thứ tự triển khai và nghiệm thu

1. Sửa collector: host/account binding, IP trust, per-page visit binding, event UUID và outbox/revision. Test reload, nhiều tab, retry sự kiện, response lỗi, Cloudflare header giả và snapshot đến muộn.
2. Thêm ingest ERP + engagement snapshot, xác thực nguồn, chống trùng và kiểm tra payload. Test source sai, disabled, replay/conflict, gửi trùng, đảo thứ tự, timeout sau khi ERP đã lưu; không tạo lead/order từ ingest.
3. Backfill qua nguồn đã đăng ký, checkpoint và đối chiếu số lượt/sự kiện/counter. Dữ liệu host/account/dealer chưa rõ để hàng chờ; không tự suy ra bằng IP. Đảm bảo import không ghi đè thông tin tư vấn ERP.
4. Tab phân tích IP có tổng hợp nền; test phân trang, timezone, phạm vi tài khoản, burst, giảm điểm do liên hệ, thiếu dữ liệu và tải thực tế.
5. Kết nối server: tạo index, cấu hình credential/proxy/worker, thử source nhỏ rồi đối chiếu trước khi mở toàn bộ landingpage. Chức năng thực thi chặn Ads nếu có là phase riêng đi qua cơ chế validate/approve/execute của ERP.

Kết quả khảo sát hiện tại: 3/3 test Ladifinal qua. Chưa có test connector bởi connector chưa được triển khai; không coi kết quả bộ test collector là nghiệm thu đồng bộ ERP.
