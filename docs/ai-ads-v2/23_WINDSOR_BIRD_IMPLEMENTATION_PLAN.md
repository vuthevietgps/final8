# 23 — Kế hoạch Windsor Ads + Bird Messenger trong ERP

Ngày lập: 2026-09-06. Trạng thái: đang triển khai theo từng lát cắt an toàn.

Tiến độ 2026-09-07: đã code cấu hình mã hóa, discovery, Google Ads read staging, dropdown định danh OrderTest2 và cutover chi phí Google sang Windsor. Lịch 06:00 dùng Windsor làm nguồn chính, materialize idempotent vào `AdvertisingCost`, rồi chạy chuỗi phân bổ lợi nhuận hiện có. Kết nối plugin Codex đã đọc được 3 tài khoản Google Ads, nhưng credential/session của plugin không được dùng lại ngầm trong ERP. Bird messaging/tracking, Windsor Facebook sync và Windsor write vẫn chưa triển khai. Xem `24_WINDSOR_BIRD_CONNECTIONS_RUNBOOK.md`.

## 1. Kết quả phải đạt

1. ERP kết nối Windsor để đọc dữ liệu Facebook Ads và Google Ads, đồng bộ chi phí vào báo cáo hiện có.
2. ERP dùng adapter Windsor để ghi các loại hành động đã được xác minh hỗ trợ, thông qua action plan, provider validation, approval, policy và execution log hiện có.
3. Bird làm đầu nối Messenger. Chatbot, nhân viên, khách hàng, lên đơn, quản lý đơn và lợi nhuận tiếp tục vận hành trong ERP.
4. Mỗi đơn truy ngược được nguồn: đơn → lần tương tác/hội thoại → Page + người nhắn → quảng cáo → nhóm quảng cáo → chiến dịch/tài khoản ads.
5. Khách quay lại qua quảng cáo khác không làm đổi nguồn của đơn cũ. Không đoán nguồn khi thiếu bằng chứng.

## 2. Quyết định kiến trúc

```text
Facebook Ads / Google Ads ←→ Windsor REST API ←→ ERP Ads adapters
                                                   ↓
                                dữ liệu ads, chi phí, action plan và log

Messenger ←→ Bird API/webhook ←→ ERP Messenger transport
                                      ↓
                         hội thoại → chatbot/nhân viên → đơn hàng
                                      ↓
                   lịch sử nguồn + nguồn của từng đơn trong MongoDB

                        ERP tổng hợp chi phí/doanh thu/lợi nhuận
```

- ERP gọi REST API trực tiếp của nhà cung cấp; không cần một MCP server/LLM đứng giữa để chuyển tiếp mỗi tin nhắn hoặc mỗi lần sync.
- Windsor là transport mới, không phải một execution engine bỏ qua các cổng kiểm tra hiện có.
- Một tài khoản ads có một nguồn chi phí chính tại một thời điểm. Một Fanpage có một transport chủ động gửi tin tại một thời điểm.
- Thiết kế adapter để giữ kết nối Meta trực tiếp hiện có làm phương án chuyển đổi có kiểm soát. Không âm thầm đổi transport khi lệnh ghi có kết quả không xác định.
- MongoDB hiện có chứa cấu hình, dữ liệu chuẩn hóa, job và lịch sử. Chưa cần mua thêm Redis, kho dữ liệu, nền tảng chatbot hoặc ERP của nhà cung cấp.
- Luồng ChatGPT Web xuất ZIP hiện tại giữ nguyên. Bổ sung trường provider/transport theo phiên bản hợp đồng nếu cần; không làm file Google hiện có trở thành file đa nền tảng một cách ngầm định.

## 3. Điều kiện nhà cung cấp và chi phí

### Windsor

- Tài liệu công bố `GET /{connector}/actions` để đọc JSON Schema và `POST /{connector}/actions` với `account`, `action`, `params` để ghi. Write cần bật trong Team management.
- Connector mục tiêu: `facebook`, `google_ads`; ID connector khác với tên provider nội bộ (`meta`, `google`). Phải chuẩn hóa tại adapter.
- Bảng giá ngày lập kế hoạch: Basic 23 USD/tháng nếu trả tháng hoặc tương đương 19 USD/tháng khi trả năm; 3 nguồn, 75 tài khoản. Facebook Ads + Google Ads dùng 2 nguồn. Forever Free sau trial chỉ có 1 nguồn/1 tài khoản, không đủ cho cả hai.
- Bắt đầu bằng trial rồi trả tháng nếu đủ nhu cầu, không mua gói năm trước khi nghiệm thu. Giá thực trả/thuế và điều kiện hợp đồng cần đối chiếu tại checkout.
- ERP chủ động lấy API vào MongoDB, không cần thêm Google Sheets/BigQuery làm điểm trung chuyển. Kiểm tra quota, freshness/cache thực tế và quyền API trong gói; không suy từ lịch destination task thành cam kết dữ liệu realtime.

### Bird

- Ưu tiên gói API/Connectivity, kết nối Page bằng đăng nhập Facebook/cấp quyền cho Bird. Không thiết kế nghiệp vụ phụ thuộc Inbox seats, Flow Builder hoặc chatbot trả phí của Bird.
- Chưa xác nhận được giá Messenger API áp dụng cho tài khoản mới từ bảng giá công khai đã đọc. Không ghi giá giả định và không khẳng định Bird rẻ nhất thị trường.
- Cần xác nhận: phí nền tảng tối thiểu, số Page/channel, phí tin vào/ra hoặc hội thoại, webhook, media, lưu trữ, hạn mức API, dùng độc lập không mua Inbox, hỗ trợ khu vực Việt Nam và điều kiện trial.
- MessageBird Conversations API có payload `facebookReferral.ad_id`; Bird API mới có cấu trúc referral khác. Giai đoạn 0 phải chọn chính xác một phiên bản tài khoản hỗ trợ. Không tự nhận `source_id`/`sourceId` là ad ID khi trường đó có thể là post ID.
- Tiết kiệm bằng webhook thay vì polling inbox, ánh xạ ads dùng cache trong ERP, không gọi Windsor cho từng tin nhắn, sync lịch sử có giới hạn và chỉ giữ payload thô cần thiết.

### Điểm chặn cần giải quyết: provider validateOnly

Tài liệu Windsor đã đọc chưa công bố tham số provider `validateOnly`, `dry_run` hoặc idempotency cho write. Kiểm tra JSON Schema không thay cho provider validation.

Thứ tự xử lý:

1. Khảo sát API thực tế/tài liệu có xác thực để xác nhận khả năng validation và response theo từng action; lưu bằng chứng đã khử secrets.
2. Nếu Windsor hỗ trợ validation thực: triển khai và buộc evidence gắn đúng account, action hash, payload và thời hạn.
3. Nếu không: chỉ cân nhắc ERP dùng provider validator trực tiếp hiện có khi chứng minh mutation thực sự tương đương với action Windsor, không có thêm side effect do Windsor tự tạo resource. Vẫn cần credential native cho validator. Ghi rõ hạn chế giảm công cấu hình.
4. Action không chứng minh được điều kiện trên giữ ở draft/dry-run với lý do chặn. Có thể sử dụng native execution hiện có theo lựa chọn cấu hình riêng, nhưng không báo đó là đã ghi qua Windsor.

Không bỏ quy tắc trong AGENTS.md: provider validation, approval, quyền, production flag và policy. Không bật ghi live trong quá trình lập kế hoạch hoặc test offline.

## 4. Module hiện có sẽ tái sử dụng

| Module | Vai trò tái sử dụng |
|---|---|
| `api-token`, `crypto.util.ts`, secret-redaction, auth/permissions | Vault, mã hóa credential, che secrets, phân quyền |
| `ad-account`, `ad-group`, `fanpage` | Ánh xạ tài khoản, nhóm, Page; tránh tạo danh mục song song |
| `advertising-cost`, recalculation queue, `finance/data-collection` | Chi phí chuẩn, lịch đồng bộ, tính lại dữ liệu phụ thuộc |
| `google-ads` | Canonical action plan, validation, approval, policy, execution lease/log và readback |
| `meta-ads` | Canonical action plan, provider validator, policy, reservation/log và readback |
| `chat-message`, Messenger webhook, AI delivery recovery | Lưu tin, conversation, chatbot, human handoff và gửi tin |
| `pending-order`, `test-order2` | Tạo đơn nháp, duyệt đơn, trạng thái đơn và snapshot nguồn |
| `ad-group-profit-report` và báo cáo hiện có | Tổng hợp lợi nhuận, không trừ chi phí quảng cáo lần thứ hai |
| Frontend `ads-settings`, `fanpage`, chat, ads action-plan UI | Màn kết nối, chẩn đoán mapping, nguồn đơn và duyệt hành động |

Trước khi sửa từng giai đoạn: đọc lại module liên quan, kiểm tra diff đang tồn tại và giữ nguyên các thay đổi ngoài phạm vi. Repository hiện có nhiều thay đổi chưa commit.

## 5. Dữ liệu và quy tắc nghiệp vụ

Tên collection dưới đây là đề xuất; phải kiểm tra/tái sử dụng schema tương đương trước khi tạo mới.

| Dữ liệu | Nơi lưu và khóa |
|---|---|
| Kết nối nhà cung cấp | Vault hiện có/mở rộng; metadata tách khỏi secrets mã hóa, API chỉ trả trạng thái/giá trị che |
| Đồng bộ | Sync run: provider, transport, account, khoảng ngày, trạng thái, số dòng, độ mới, lỗi đã khử secrets |
| Ads hierarchy | Account → campaign → ad set/ad group → ad; khóa đầy đủ provider + account + loại resource + provider ID |
| Daily performance | Provider + account + group + ngày báo cáo + grain; currency, timezone và thời điểm lấy dữ liệu |
| Chi phí dùng báo cáo | `AdvertisingCost` hiện có; upsert thay thế số tổng, không cộng dồn các lần sync |
| Inbox sự kiện Bird | Event ID, channel/Page, timestamp, trạng thái xử lý, lease/retry; payload thô hạn chế truy cập và retention |
| Ánh xạ người nhắn | Provider channel/Bird contact/conversation ID → ERP Fanpage + PSID + customer ID; không coi Bird contact ID là PSID |
| Lịch sử nguồn | Các lần tương tác có ad ID, thời gian thực tế, evidence, trạng thái map, nguồn và phiên bản quy tắc |
| Nguồn đơn | Snapshot chứa touchpoint ID, ad ID/group/campaign/account, rule version và evidence; chốt cùng đơn |
| Hành động ads | Action plan/approval/execution log hiện có; thêm transport và response/evidence cần thiết |

Quy tắc:

- Ngày chi phí theo timezone tài khoản. Phạm vi đưa vào sổ ERP ban đầu tuân thủ VND/Asia_Ho_Chi_Minh hiện có; dữ liệu khác currency/timezone phải được đánh dấu chưa đủ điều kiện, không gộp tiền khác đơn vị.
- Chi phí tính một lần ở cấp nhóm/ngày. Dữ liệu ad-level để mapping hoặc drilldown không cộng thêm vào số tổng nhóm; breakdown không trộn với total.
- Có dữ liệu nhóm đã pause; giữ chi phí không map được trong danh sách chờ xử lý, không bỏ mất.
- Thiếu `ad_id`: ghi nhận unknown/organic theo bằng chứng; không suy từ tên nhóm hoặc nội dung chatbot.
- Nguồn đề xuất cho đơn: lần tương tác quảng cáo hợp lệ gần nhất trước mốc chốt nguồn, trong cửa sổ cấu hình. Mặc định thử nghiệm 7 ngày; đây là quy tắc ERP đề xuất, không phải mặc định attribution của Meta.
- Chốt snapshot khi tạo đơn nháp; khi duyệt giữ nguyên snapshot. Nếu draft không có evidence hợp lệ, cho phép bổ sung có audit, không lấy nguồn mới nhất âm thầm.
- Sự kiện đến muộn không tự sửa nguồn đơn đã chốt. Tạo mục cần đối soát; sửa nguồn có quyền, lý do, lịch sử và trigger tính lại.
- Không nối hai khách chỉ vì tên giống nhau; merge theo quy trình nhận diện khách hiện có và giữ lịch sử nguồn.
- Lịch sử nguồn/snapshot đơn không phụ thuộc TTL 90 ngày của chat message. Retention/xóa dữ liệu cần xử lý riêng theo chính sách ERP.
- Đơn hủy/hoàn trả tác động doanh thu/lợi nhuận theo quy tắc hiện có; không làm biến mất chi phí ads.

## 6. Các giai đoạn triển khai và nghiệm thu

### Giai đoạn 0 — Khóa hợp đồng API và chi phí

Đầu ra:
- Capability matrix Windsor theo provider/action; schema request/response, mapping ID và tiền tệ, validation/readback/cache/quota.
- Xác định Bird API mới hay MessageBird API theo tài khoản thực; mẫu inbound/referral/outbound/status có ad ID hoặc trạng thái không hỗ trợ.
- Bảng chi phí theo số tài khoản/Page và lưu lượng, phương án trial/API độc lập.
- Fixtures khử secrets và integration contracts có version, phân biệt dữ liệu mẫu tài liệu với dữ liệu đã kiểm chứng.

Nghiệm thu: chọn được hợp đồng Bird thực sự giữ nguồn Ads và phương án provider validation cho từng nhóm action Windsor. Các điểm chưa biết ghi rõ blocked, không gắn nhãn supported.

Không có tài khoản/credential vẫn thực hiện discovery công khai và test fixtures offline. Kiểm thử tích hợp có xác thực chờ cấu hình trong vault, không yêu cầu gửi secrets vào chat. Không tạo/mua dịch vụ hoặc liên hệ sales thay người dùng.

### Giai đoạn 1 — Kết nối, vault và adapter nền

Đầu ra:
- Mở rộng màn ads-settings cho Windsor, Fanpage cho Bird; lưu credential mã hóa, test kết nối chỉ đọc, chọn account/channel/Page.
- Cho phép chọn nguồn đọc/transport ghi theo account, transport nhắn tin theo Page; mặc định chưa kích hoạt tự động/live.
- HTTP transport có timeout, host allowlist, giới hạn response, xử lý 429, lỗi an toàn; retry chỉ cho thao tác phù hợp.
- Phân quyền xem cấu hình, sửa kết nối, sync, duyệt và execute; không mở một endpoint proxy ghi tùy ý.

Nghiệm thu: lưu/đọc lại cấu hình không lộ key, sai quyền bị chặn, sai tài khoản bị chặn; UI thể hiện rõ chưa cấu hình/đọc được/ghi bị chặn.

### Giai đoạn 2 — Windsor read và chi phí chuẩn

Đầu ra:
- Đồng bộ metadata/hierarchy và daily metrics Facebook/Google; pagination và phân biệt empty thành công với lỗi.
- Upsert idempotent vào dữ liệu chuẩn; mapping theo ID, cả nhóm không active, xử lý dữ liệu chưa map.
- Mặc định đề xuất: đồng bộ mỗi ngày và đọc lại 7 ngày gần nhất để bắt điều chỉnh; backfill 30 ngày theo batch trong trial. Tăng tần suất theo quota/freshness/gói thực tế.
- Chạy so sánh riêng trước khi đổi nguồn chính. Chặn native sync ghi đè cùng account/ngày sau cutover; không tự fallback tạo chi phí kép.
- Enqueue tính lại đúng ngày/nhóm khi dữ liệu đổi; trạng thái stale/partial/failed hiển thị đúng.

Nghiệm thu: sync hai lần không tăng số chi phí; tổng khớp mẫu nguồn trong sai số làm tròn được xác định; không bỏ nhóm pause; lỗi một page/khoảng ngày không được đánh dấu hoàn tất. Test boundary ngày, tiền tệ và pagination.

### Giai đoạn 3 — Bird Messenger, giữ chatbot trong ERP

Đầu ra:
- Webhook đúng schema/chữ ký của phiên bản Bird đã chọn; lưu bền vững trước ACK.
- Worker dùng MongoDB inbox với lease, retry và dead-letter; webhook trùng không tạo tin/đơn/AI reply trùng.
- Chuẩn hóa inbound text/media/postback/referral/status về chat pipeline hiện có.
- Thay transport ở tất cả đường gửi: nhân viên, AI, ảnh và delivery recovery; không chỉ một controller. Kiểm soát cửa sổ gửi tin của Meta.
- Ánh xạ Page/channel/PSID/contact; tránh vòng lặp echo và hai bot cùng trả lời.

Nghiệm thu: ERP nhận/gửi bằng adapter trong test; chữ ký sai bị từ chối; restart sau ACK vẫn xử lý được; timeout gửi không retry mù gây tin trùng. Smoke có credential cần hội thoại thử được phép.

### Giai đoạn 4 — Nguồn hội thoại → nguồn đơn → lợi nhuận

Đầu ra:
- Lưu lịch sử touchpoint và queue tra ad ID từ hierarchy Windsor đã cache. Nếu chưa có metadata, giữ pending và giải quyết sau sync; không cản nhận tin.
- Snapshot nguồn từ draft sang đơn thật trong `pending-order`/`test-order2`; loại bỏ fallback nguồn gần nhất không kiểm tra thời điểm ở đường Bird.
- Đơn và hội thoại hiển thị nguồn/bằng chứng; màn xử lý unknown/unmapped; chỉnh nguồn có audit.
- Báo cáo dùng chi phí chuẩn + doanh thu/hoàn/hủy/giá vốn/chi phí theo nghiệp vụ hiện có. Tách báo cáo doanh thu theo ngày đơn với phân tích cohort theo ngày thu hút, không đánh đồng với attribution Meta.

Nghiệm thu bắt buộc:
1. Khách nhắn quảng cáo A → đơn 1; quay lại B → đơn 2: đúng nhóm cho mỗi đơn.
2. Cùng khách khác Page, nhiều đơn một hội thoại, referral đến trễ hoặc trùng: không ghép nhầm.
3. Thiếu ad ID, ad chưa map, ad/group bị pause: trạng thái rõ và không mất chi phí.
4. Chat hết TTL vẫn giữ được nguồn đơn và báo cáo.
5. Đơn hủy/hoàn/đổi nguồn có audit: lợi nhuận cập nhật đúng, không trừ ads hai lần.

### Giai đoạn 5 — Windsor write qua quy trình duyệt hiện có

Đầu ra:
- Tái sử dụng action plan/approval/policy/lease/log Google và Meta; bổ sung adapter translate và execution transport.
- Phạm vi đầu: pause/resume campaign, group, ad; chỉnh budget campaign và Meta ad set khi đúng chế độ ngân sách. Google không giả lập daily budget riêng cho ad group; shared budget phải kiểm tra tác động các campaign liên quan.
- Map action từ schema Windsor thực tế. Không cho user/AI truyền action tùy ý ngoài allowlist.
- Duyệt gắn payload hash/version; thay payload/transport/account làm mất hiệu lực validation/approval. Kiểm tra lại quyền, tài chính và freshness trước execute.
- Lock bền vững và idempotency trong ERP; kết quả timeout/unknown phải reconcile, không gửi lại mutation tự động. Không coi câu thông báo thành công của Windsor là đủ để xác nhận mọi resource đã đúng.
- Readback kiểm tra trạng thái thật, có chính sách freshness độc lập với dữ liệu báo cáo cache. Nếu readback chậm, giữ pending_reconciliation.

Nghiệm thu: toàn bộ gate chặn đúng, mutation chỉ được gửi một lần, kế hoạch bị sửa không dùng lại approval, wrong account/budget bị chặn; blocked rõ khi Windsor thiếu validation/readback phù hợp. Production flags tiếp tục tắt trong test offline.

### Giai đoạn 6 — Tạo mới có giới hạn và nghiệm thu toàn hệ thống

Đầu ra:
- Mở rộng adapter cho create Google Search campaign/ad group/RSA/keyword và Meta campaign/ad set/ad trong phạm vi canonical actions hiện có và capability đã xác minh. Action Windsor chưa hỗ trợ hoặc không validate được hiển thị rõ unavailable; không tuyên bố hỗ trợ tương đương toàn API Meta/Google.
- Campaign mới luôn PAUSED; bật campaign là action riêng được duyệt. Không delete, PMax, Shopping, Display, YouTube hay auto-publish.
- Hoàn thiện UI trạng thái sync, nguồn đơn, chi phí gọi API, validation/execution, lỗi và hướng dẫn kết nối.
- Build frontend/backend, regression modules ảnh hưởng, smoke luồng hoàn chỉnh trên môi trường thử. Bàn giao migration, rollback và checklist bật production theo từng account/Page.

Nghiệm thu: một luồng end-to-end chứng minh read → tracking → đơn → báo cáo → draft action → validate/approve → execute kiểm soát → readback. Phần live chỉ được ghi nhận đã nghiệm thu sau khi có môi trường/credential/quyền tương ứng và gates hợp lệ.

## 7. Thứ tự, kiểm thử và quản lý thay đổi

- Triển khai tuần tự 0 → 1 → 2 → 3 → 4 → 5 → 6. Không nhảy sang tính năng viết/tạo mới khi hợp đồng API hoặc điều kiện validation còn chưa đạt.
- Tách từng giai đoạn thành patch nhỏ; báo cáo module tái sử dụng trước coding, file thay đổi, tests, kết quả và rủi ro sau coding. Không tự gộp/commit các thay đổi có sẵn ngoài phạm vi.
- Tests phải kiểm tra nghiệp vụ/failure mode, không chỉ mock gọi đúng tên hàm. Dùng fixtures chính thức, fake transport và MongoDB local riêng cho tính bền vững/concurrency. Không gọi API live trong unit test.
- Lệnh kiểm tra nền: `cd backend; npm run build`; `npm test -- --runInBand --runTestsByPath <cac-suite-bi-anh-huong>`; `cd frontend; npm run build`; kiểm tra UI theo cấu hình runner trong package.json khi triển khai.
- Giai đoạn 0 kiểm tra hợp đồng; 1 tests permission/secret/HTTP; 2 sync/reconciliation; 3 webhook/delivery/restart; 4 attribution/profit; 5–6 policy/approval/idempotency/readback và UI.
- Phần thay đổi schema ưu tiên additive; dry-run migration trước apply, đo dữ liệu unresolved. Không backfill nguồn hội thoại cũ bằng suy đoán.
- Rollback theo account/Page: dừng lịch sync mới, khóa writes mới, chuyển transport có kiểm soát. Giữ evidence, nguồn đơn và execution log; xử lý các mutation/delivery unknown trước khi đổi đường gửi.

## 8. Thông tin cần ở thời điểm tích hợp thật

- Windsor: tài khoản/team và key nhập vào vault, Facebook/Google accounts đã cấp quyền, chọn danh sách tài khoản thử; xác nhận capability write/validation.
- Bird: tài khoản có Messenger API, phiên bản API, workspace/channel/Page, key và signing secret nhập vault, endpoint HTTPS công khai và Fanpage thử.
- Chỉ cần người quản trị đăng nhập/cấp quyền và chọn gói khi đến bước đó; không đưa password/App Secret/API key vào chat hoặc commit.
- Cần số Fanpage, số tài khoản ads và lưu lượng tin ước tính để chốt chi phí. Việc thiếu các con số này không cản xây adapter, UI và test offline.
- Không đăng ký trả phí hoặc gửi tin nhắn khách thật như một phần test tự động.

## 9. Nguồn đã đối chiếu ngày 2026-09-06

- Windsor REST read/write: https://windsor.ai/api-documentation/
- Windsor capability/action discovery: https://mcp.windsor.ai/
- Windsor pricing: https://windsor.ai/pricing/
- Bird kết nối Messenger: https://docs.bird.com/applications/channels/channels/supported-channels/facebook-messenger/install-facebook-messenger
- MessageBird referral có ad ID: https://developers.messagebird.com/quickstarts/facebook/referrals/
- MessageBird Conversations API: https://developers.messagebird.com/api/conversations/
- Bird API mới: https://docs.bird.com/api/conversations-api/api-reference/conversations-messaging/get-conversation-message
- Bird pricing: https://bird.com/pricing
- Meta Messenger Send API: https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api

Ghi chú: tra tài liệu không thay cho kiểm thử có xác thực trên gói dịch vụ thực tế. Kế hoạch không xác nhận đã kết nối tài khoản, mua gói, gửi Messenger hoặc thay đổi quảng cáo thật.
