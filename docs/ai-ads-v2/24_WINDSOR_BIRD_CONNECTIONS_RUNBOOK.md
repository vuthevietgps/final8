# 24 — Windsor/Bird: đợt 1, kết nối và kiểm tra quyền truy cập

Ngày: 2026-09-06.

## Phạm vi đã code

- Trang `/provider-connections`, mục **Windsor / Bird** trong menu Ads.
- Cấu hình Windsor Facebook và Windsor Google riêng; chọn tối đa 75 account ID cho mỗi cấu hình. Chuẩn hóa ID nhập từ UI về chuỗi số, không dùng số JavaScript để lưu provider ID.
- Mỗi Fanpage ERP có một cấu hình Bird Messenger, chọn rõ Bird API mới hoặc MessageBird Conversations v1.
- Key và signing secret mã hóa AES-256-GCM bằng tiện ích hiện có. MongoDB collection `provider_connections`; trường `secretsEnc` không được select mặc định hoặc trả qua API.
- Phân quyền cùng các quyền quản trị credential Google/Meta hiện có. Kiểm tra revision khi sửa; lưu audit người thao tác, thời gian và phiên bản (tối đa 50 sự kiện gần nhất).
- Kiểm tra quyền đọc tài khoản Windsor và khám phá danh sách action; kiểm tra quyền đọc kênh Bird. Kết quả gắn revision; cấu hình đổi trong lúc kiểm tra thì kết quả cũ không được lưu.
- HTTP chỉ có GET đến các host/path cho phép, key trong header, không follow redirect, timeout 20 giây mỗi request, tối đa 2 MiB response và cooldown kiểm tra 60 giây theo kết nối.

## Đợt 2 — Windsor Google Ads read staging

- ERP khám phá `google_ads/fields` và `google_ads/options` trước mỗi lần sync, không đoán field ID.
- Mỗi request bị khóa vào một account, một ngày trọn vẹn, tối đa 5.000 hàng và luôn yêu cầu `include_inactive=true`.
- Khoảng sync thủ công từ 1 đến 30 ngày, mặc định 7 ngày trọn vẹn kết thúc vào hôm qua.
- Lưu chuẩn hóa vào `windsor_ads_resources`, `windsor_ads_daily_metrics` và `windsor_ads_sync_runs`.
- Unique key theo connection/account/resource và connection/account/campaign/ad group/date; sync lặp dùng `$set`, không cộng dồn spend.
- Kết quả sai account, sai ngày, trùng grain, metric không hợp lệ hoặc chạm row limit bị đánh dấu lỗi; không ghi payload thô hay provider error body.
- Manager có quyền `google-ads.read` được sync/xem dữ liệu. Chỉ người có quyền credential mới sửa key và chọn account.
- UI `/provider-connections` có nút **Đồng bộ 7 ngày trọn vẹn** và phần xem tổng hợp staging.

API bổ sung:

| Method | Path sau `/api` | Mục đích |
|---|---|---|
| POST | `/provider-connections/:id/ads-read-sync` | Đồng bộ Google Ads qua Windsor vào staging |
| GET | `/provider-connections/:id/ads-snapshot` | Xem hierarchy, daily metrics và tổng hợp staging |
| GET | `/provider-connections/:id/ads-sync-runs` | Xem tối đa 50 lần sync gần nhất |

Kết nối Windsor trong plugin Codex và kết nối Windsor trong ERP là hai phiên riêng. ERP vẫn cần API key Windsor được lưu qua vault và phải bấm **Kiểm tra quyền truy cập** thành công cho các account đã chọn.

## Đợt 3 — Windsor Google Ads thành nguồn chi phí chính

- `ADS_GOOGLE_COST_SOURCE=windsor` là mặc định. Lịch tài chính 06:00 dùng Windsor cho Google và không gọi đồng bộ Google Ads native trong cùng lượt.
- Mỗi lượt đọc thành công hoặc một phần chỉ materialize các metric mang đúng `lastSyncRunId` vừa tạo vào `advertisingcosts`.
- Khóa idempotent giữ nguyên `channel + customerId + adGroupId + date`; sync lặp dùng `$set`, không cộng dồn chi phí.
- Bản ghi chi phí lưu provenance `sourceSystem=windsor`, connection, sync run, campaign/ad group, tiền tệ và thời điểm provider trả dữ liệu.
- Chỉ materialize tiền tệ trùng `ADS_BASE_CURRENCY` (mặc định `VND`). Sai tiền tệ bị chặn trước khi ghi để tránh trộn số tiền chưa quy đổi.
- Sau bước sync 06:00, pipeline hiện có phân bổ lại OrderTest2 và chốt báo cáo nhóm quảng cáo. Sync thủ công materialize ngay; báo cáo được tính lại ở pipeline kế tiếp hoặc endpoint tính lại hiện có.
- Có thể rollback có chủ đích sang transport native bằng `ADS_GOOGLE_COST_SOURCE=native`; không có fallback ngầm khi Windsor lỗi hoặc chưa cấu hình.
- Endpoint đồng bộ chi phí Google native cũng bị chặn khi Windsor đang là nguồn chính, tránh thao tác thủ công ghi đè cùng ngày/nhóm.

## Chưa được triển khai trong đợt này

Chưa có Windsor Facebook read, webhook Bird, gửi Messenger qua Bird hoặc execution transport Windsor. Chưa có tự động quy đổi ngoại tệ; tài khoản khác tiền tệ cơ sở bị chặn. Không có nút/endpoint ghi live thông qua module mới.

## Đợt 2B — chọn nguồn quảng cáo trong OrderTest2

- `GET /test-order2/ad-attribution-options` hợp nhất nhóm quảng cáo nội bộ với các nhóm Google thuộc kết nối Windsor đang bật và đã có lần read-sync `success` hoặc `partial`.
- Dropdown hiển thị theo cấu trúc **nền tảng → tài khoản → chiến dịch → nhóm quảng cáo (ID)**. Giá trị lưu chính vẫn là provider `adGroupId` để tương thích báo cáo hiện tại.
- Đơn hàng lưu thêm snapshot `adsProvider`, `adAccountProviderId`, `adCampaignId` và tên tài khoản/campaign/ad group. Backend tự tra lại staging khi lưu; frontend không được tự ghi tên snapshot.
- Nếu cùng một `adGroupId` xuất hiện ở nhiều tài khoản, backend yêu cầu khóa tổ hợp từ dropdown và từ chối cách nhập chỉ có ID.
- Đơn mới phải khai báo `customerAcquisitionSource=ads|non_ads`. Đơn `ads` bắt buộc có `adGroupId`; đơn `non_ads` bắt buộc không có `adGroupId`. `productSource` tiếp tục chỉ phản ánh nguồn hàng.
- Việc chọn nguồn đã tạo liên kết đơn → nhóm quảng cáo. Chi phí Windsor vẫn ở staging; lợi nhuận chỉ nhận chi phí Windsor sau khi hoàn tất reconciliation và cutover có kiểm soát sang `AdvertisingCost`.

Danh sách action là thông tin discovery có lọc allowlist, không phải bằng chứng provider validateOnly đã qua. `liveWriteEnabled=false` và `messagingEnabled=false` do server xác định, không nhận từ client.

Các giai đoạn tiếp theo ở tài liệu 23 vẫn chưa hoàn thành. Không sử dụng đợt này như một hệ thống tracking/ads read-write đã vận hành đầy đủ.

## Chuẩn bị backend

1. Dùng môi trường có MongoDB và khóa `API_TOKEN_SECRET` riêng, tối thiểu 32 ký tự, được quản lý bền vững bằng secret manager/cấu hình triển khai hiện có. Không dùng `DEV_TOKEN_SECRET`.
2. Sao lưu và quản lý vòng đời khóa. Tự đổi khóa mà chưa chuyển đổi ciphertext sẽ làm mất khả năng giải mã credential đã lưu. Module không cung cấp key rotation cho master key trong đợt này.
3. Cấp outbound HTTPS đến `connectors.windsor.ai`, `onboard.windsor.ai`, `api.bird.com` hoặc `conversations.messagebird.com` theo phiên bản được chọn.
4. Giữ các cờ production ads hiện có tắt. Chạy build và khởi động backend theo quy trình triển khai của hệ thống.
5. Đăng nhập tài khoản có cả quyền `google-ads.credentials.read/write` và `meta-ads.credentials.read/write`; mặc định vai trò director. Các endpoint vẫn được bảo vệ bởi JWT, RolesGuard và feature module `api-token`.

`ERP_LOCAL_SANDBOX=true` hiện là bản xem thử với master key tạm thời và outbound bị chặn. Backend trả trạng thái `PREVIEW_EPHEMERAL_VAULT`; UI không cho nhập/lưu provider key. Không nhập credential thật vào sandbox này.

## Kết nối Windsor

1. Tạo tài khoản hoặc dùng trial Windsor; cấp quyền Facebook Ads/Google Ads trực tiếp trên Windsor.
2. Mở Windsor / Bird trong ERP, chọn nguồn, nhập tên và API key. Có thể để trống danh sách account ID khi lưu lần đầu.
3. Bấm **Kiểm tra quyền truy cập**. ERP gọi `GET https://onboard.windsor.ai/api/common/ds-accounts?datasource=facebook|google_ads`, key nằm trong `X-Api-Key`.
4. Chọn ID từ danh sách trả về, sửa cấu hình và kiểm tra lại. Account phải có trong response đúng datasource, status active. Nếu response thực tế khác schema tài liệu, ERP báo cần đối chiếu hợp đồng thay vì nhận nhầm dữ liệu.
5. Discovery action dùng `GET https://connectors.windsor.ai/{connector}/actions`. Thành công ở endpoint này không khẳng định team được cấp quyền thực thi hoặc hỗ trợ provider validation.

Chọn gói trial/Basic phù hợp số nguồn và account; không cần kho dữ liệu hoặc Google Sheets trung chuyển. Giá/ngày truy cập được ghi trong kế hoạch 23; phải đối chiếu gói và quota thực tế trước khi mua.

## Kết nối Bird

1. Tạo Fanpage tương ứng trong ERP trước. Kết nối Page trên Bird bằng quy trình cấp quyền của Bird.
2. Xác nhận với tài khoản Bird rằng Messenger API được cấp độc lập; chưa cần mua Inbox seats hoặc Flow Builder cho nghiệp vụ ERP.
3. Chọn đúng phiên bản trong ERP:
   - **Bird API mới**: workspace UUID và channel UUID. Probe đọc `GET /workspaces/{workspaceId}/channels/{channelId}/conversational`, header `Authorization: AccessKey ...`.
   - **MessageBird Conversations v1**: channel ID 32 ký tự hex; không dùng workspace. Probe `GET https://conversations.messagebird.com/v1/channels/{channelId}` và yêu cầu `platformId=facebook`.
4. Chọn Page ERP và nhập API key, signing secret nếu đã có. Probe Bird mới chỉ xác minh truy cập cấu hình Conversations, chưa xác minh platform/Page binding.
5. Trạng thái đọc được channel luôn còn tracking unverified. Cần fixture webhook có xác thực từ đúng phiên bản tài khoản trước khi triển khai/đánh dấu tracking đạt.

Không tự suy `sourceId` thành ad ID; không tự fallback Bird mới sang MessageBird khi gặp lỗi. Đổi phiên bản yêu cầu nhập lại cả hai secrets để tránh giữ thông tin xác thực của hợp đồng cũ.

## API ERP

| Method | Path sau `/api` | Mục đích |
|---|---|---|
| GET | `/provider-connections` | Cấu hình đã che secrets và kết quả kiểm tra hiện hành |
| GET | `/provider-connections/configuration-status` | Kiểm tra môi trường có được lưu key không |
| GET | `/provider-connections/fanpages` | Danh sách Page ERP để lựa chọn |
| POST | `/provider-connections` | Tạo cấu hình; `revision=0` |
| PATCH | `/provider-connections/:id` | Sửa theo revision trả về lần trước; bỏ qua key để giữ nguyên |
| POST | `/provider-connections/:id/check` | Probe chỉ đọc; cooldown 60 giây |

Không có endpoint nhận arbitrary URL, proxy API, webhook hoặc execute. Xung đột revision/duplicate scope trả 409. Credential fields không xuất hiện trong response.

## Kiểm thử

Backend (từ thư mục backend):

```powershell
npm run build
npm test -- --runInBand --testPathPattern=provider-connections
```

Hoặc chọn tường minh các suite:

```powershell
npm test -- --runInBand --runTestsByPath src/provider-connections/provider-read-http.service.spec.ts src/provider-connections/provider-discovery.service.spec.ts src/provider-connections/provider-connections.service.spec.ts src/provider-connections/provider-connections.permissions.spec.ts
```

Integration test cần MongoDB local ở `127.0.0.1:27027`. Không dùng AppModule hoặc `.env`, không gọi nhà cung cấp. Test tạo database tên ngẫu nhiên với prefix riêng và chỉ xóa đúng database đó khi kết thúc:

```powershell
$env:RUN_PROVIDER_CONNECTIONS_LOCAL_TEST = '1'
npm test -- --runInBand --runTestsByPath src/provider-connections/provider-connections.local.spec.ts
```

Frontend (từ thư mục frontend):

```powershell
npm run build
$env:CHROME_BIN = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npm test -- --watch=false --browsers=ChromeHeadless --include=src/app/features/provider-connections/provider-connections.component.spec.ts
```

Kiểm thử mock/fixture và local MongoDB không thay cho xác nhận API tài khoản thật. Trước giai đoạn đồng bộ/nhắn tin/ghi ads, cần giải quyết các điều kiện hợp đồng trong tài liệu 23.

## Kết quả kiểm tra ngày 2026-09-06

- Backend `npm run build`: PASS.
- 5 backend suites: 35 tests PASS, bao gồm integration HTTP + MongoDB local, uniqueness và concurrent edit.
- Frontend `npm run build`: PASS.
- Chrome Headless: 5 component tests PASS. TestBed dùng zoneless như app thực tế.
- Bản xem thử đã khởi động lại với module mới: `/health/live` 200; `/api/provider-connections` không có JWT trả 401; frontend `/provider-connections` 200.
- Các log kiểm tra provider sử dụng fake transport, không có credential thật hoặc cuộc gọi nhà cung cấp trong quá trình test.
- Ở đợt 1 người dùng chưa có tài khoản Windsor/Bird. Hiện Windsor đã được kết nối qua plugin Codex; Bird và kết nối ERP vẫn chờ onboarding riêng.

Kết quả bổ sung sau khi người dùng kết nối Windsor trong plugin Codex:

- Plugin đọc thành công 3 tài khoản Google Ads và dữ liệu 7 ngày 30/08–05/09/2026; đây là bằng chứng kết nối plugin hoạt động.
- Lát cắt ERP read staging: backend/frontend build PASS; 46 backend unit tests PASS; 6 frontend component tests PASS; integration HTTP + MongoDB local PASS, gồm sync lặp không tăng số dòng và xác nhận `AdvertisingCost` chưa bị ghi.
- Chưa chạy ERP với credential Windsor thật. Cần nhập key vào vault bền vững, chọn account và chạy sync staging để nghiệm thu response thực tế.

## Nguồn hợp đồng

- https://windsor.ai/api-documentation/ — header auth, account discovery, action discovery.
- https://developers.messagebird.com/api/conversations/ — MessageBird channel API.
- https://docs.bird.com/api/conversations-api/api-reference/channel-configuration/get-conversations-configuration — probe chỉ đọc Bird mới.
- https://developers.messagebird.com/quickstarts/facebook/referrals/ — bằng chứng tài liệu cho referral; chưa phải chứng cứ trên tài khoản thực.
