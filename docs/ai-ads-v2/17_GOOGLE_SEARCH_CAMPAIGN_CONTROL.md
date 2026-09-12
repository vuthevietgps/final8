# Google Search Campaign Control trong ERP

## Phạm vi

Pha này cho phép cấu hình và vận hành campaign Google Search ở cấp campaign ngay trong ERP:

- tạo Campaign Budget và Search Campaign mới;
- cập nhật tên, rút ngắn ngày kết thúc và cập nhật ngân sách ngày;
- tạm dừng campaign;
- chạy provider `validateOnly`, duyệt, dry-run, execute live và readback qua ERP.

Campaign mới luôn được tạo `PAUSED`. ERP không hỗ trợ Performance Max, Shopping, Display, YouTube/Video, resume, delete hoặc auto-publish trong pha này.

## Ranh giới hệ thống

```text
Trình duyệt ERP
  -> typed action plan, không có credential/raw provider payload
ERP backend
  -> canonical lookup + policy + Financial Control
  -> Google Ads validateOnly
  -> approval tách vai trò
  -> dry-run
  -> live mutate khi toàn bộ server flags cho phép
  -> canonical sync/readback + execution log
Google Ads API
```

Codex và ChatGPT Web không gọi Google Ads API. Credential chỉ được nhập qua khu vực cài đặt Ads của ERP hoặc secret/config store khi triển khai.

## Dữ liệu người dùng nhập

Create Search campaign:

- tài khoản Google Ads đã được ERP xác minh;
- tên campaign, tên budget;
- ngân sách ngày VND;
- chiến lược giá thầu trong allowlist;
- ngày bắt đầu, ngày kết thúc tùy chọn;
- bật/tắt Search Partners;
- Google geo target constant IDs;
- Google language constant IDs;
- kiểu positive geo targeting;
- xác nhận không chứa quảng cáo chính trị EU;
- lý do kinh doanh.

Update campaign:

- campaign canonical;
- tên mới và/hoặc ngày kết thúc mới chỉ theo hướng rút ngắn;
- ngân sách ngày mới tùy chọn;
- lý do kinh doanh.

Pause campaign:

- campaign canonical;
- lý do kinh doanh.

## Dữ liệu ERP lookup hoặc bắt buộc

ERP lookup và không cho trình duyệt tự khai:

- `customerId`, `loginCustomerId`/MCC mapping và readiness;
- campaign resource name;
- campaign budget ID và resource name;
- currency, timezone, sync freshness và canonical before-state;
- credential binding, API version, operation hash và idempotency key.

ERP bắt buộc khi create:

- `advertisingChannelType=SEARCH`;
- `status=PAUSED`;
- budget `STANDARD`, không shared;
- Google Search bật;
- Content Network và Partner Search Network tắt;
- Search Partners mặc định tắt;
- không nhận raw Google mutate payload từ browser.

`campaignId` hoặc `adGroupId` không bao giờ được dùng thay cho `campaignBudgetId`.

## Workflow và điều kiện live

1. Người lập lưu typed draft trong ERP.
2. ERP dựng operations xác định và gọi Google Ads với `validateOnly=true`, `partialFailure=false`.
3. ERP lưu hash operations, credential binding, API version và thời hạn validation.
4. Một người khác duyệt action.
5. Executor chạy dry-run để kiểm tra policy và Financial Control mà không gọi mutate live.
6. Một người khác với approver mới có thể execute live.
7. ERP chỉ gọi live khi các global và per-action flags đều bật.
8. ERP sync/readback canonical state và ghi execution/change/evaluation logs.

Các flag mặc định an toàn:

```dotenv
AI_MARKETING_DRY_RUN=true
AI_MARKETING_PROVIDER_EXECUTION_ENABLED=false
GOOGLE_ADS_PRODUCTION_ENABLED=false
GOOGLE_ADS_CAMPAIGN_CREATE_ENABLED=false
GOOGLE_ADS_CAMPAIGN_UPDATE_ENABLED=false
GOOGLE_ADS_CAMPAIGN_PAUSE_ENABLED=false
```

Lỗi HTTP xác định từ provider có thể giải phóng reservation. Timeout, mất kết nối hoặc lỗi 5xx giữ idempotency reservation và yêu cầu đối soát/readback trước khi retry.

## Credential cần cấu hình

- OAuth client ID;
- OAuth client secret;
- refresh token có scope Google Ads;
- developer token;
- MCC login customer ID khi dùng manager account;
- child customer allowlist.

Không ghi credential thật vào tài liệu, source code, log, test, API response hoặc file `.env` được commit. Token có quyền rộng không thay thế account allowlist, MCC verification, `validateOnly`, approval, SOD, Financial Control hoặc production flags.

## Staged setup để campaign có thể phân phối

Campaign-level control chưa tự tạo một quảng cáo hoàn chỉnh. Các resource delivery phải đi theo wave riêng sau khi readback có ID thật:

```text
Campaign + Budget PAUSED
  -> Ad Group PAUSED
  -> Keywords PAUSED
  -> Responsive Search Ad PAUSED
```

Mỗi wave phải lặp lại validateOnly, approval, execution và readback. ERP không suy đoán provider ID từ temporary ID của wave trước.

## Verification

```powershell
cd backend
npm test -- --runInBand src/google-ads
npm run build

cd ../frontend
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```
