# Google Search bidding lifecycle trong ERP

## Kết quả

ERP quản lý chuỗi bidding cho Google Search theo bốn trạng thái:

```text
MAXIMIZE_CLICKS
  → MAXIMIZE_CLICKS_CPC_CEILING
  → MAXIMIZE_CONVERSIONS
  → MAXIMIZE_CONVERSIONS_TARGET_CPA
```

Automation chỉ tự sync dữ liệu, đánh giá và tạo action plan `pending_approval`.
Nó không tự validate, approve hoặc execute. Mọi live mutation vẫn đi qua
`provider validateOnly → approval → dry-run → production/policy flags → mutate → readback`.

Tài liệu này thay thế phần giới hạn bidding trong tài liệu pha 19. Campaign
Search mới vẫn luôn được tạo `PAUSED`, nhưng bidding mặc định mới là
`MAXIMIZE_CLICKS`.

## Mapping với Google Ads API

| Trạng thái ERP | Strategy provider | Target provider | Update mask |
|---|---|---|---|
| Maximize Clicks | Chọn `targetSpend`; update body không gửi empty message | Không có | `target_spend.cpc_bid_ceiling_micros` để clear ceiling/chuyển strategy |
| Maximize Clicks + CPC ceiling | `targetSpend` | `cpcBidCeilingMicros` | `target_spend.cpc_bid_ceiling_micros` |
| Maximize Conversions | Chọn `maximizeConversions`; update body không gửi empty message | Không có | `maximize_conversions.target_cpa_micros` để clear target/chuyển strategy |
| Maximize Conversions + target CPA | `maximizeConversions` | `targetCpaMicros` | `maximize_conversions.target_cpa_micros` |

Google Ads không có chiến lược “Maximize Clicks CPA”. Giai đoạn thứ hai là
Maximize Clicks có giới hạn CPC. Target CPA là field con của
Maximize Conversions, không phải một strategy API độc lập.

## Dữ liệu người dùng phải nhập

| Trường policy ERP | Mục đích | Mặc định |
|---|---|---|
| `enabled` | Bật đánh giá tự động cho campaign | `false` |
| `clickThreshold` | Số click để đề xuất CPC ceiling | `50` |
| `clickWindowDays` | Cửa sổ cộng click | `30` |
| `maxCpcBidCeilingVnd` | CPC ceiling của giai đoạn 2 | Bắt buộc khi bật |
| `maximizeConversionsMinConversions` | Conversion tối thiểu để đề xuất giai đoạn 3 | `15` |
| `conversionWindowDays` | Cửa sổ cộng conversion và spend | `30` |
| `targetCpaMinConversions` | Conversion tối thiểu để đề xuất target CPA | `30` |
| `targetCpaVnd` | Target CPA của giai đoạn 4 | Bắt buộc khi bật |
| `minimumStageDwellHours` | Thời gian tối thiểu ở một stage | `168`; có thể đặt `0` |
| `cooldownHours` | Khoảng cách tối thiểu giữa hai draft | `168`; có thể đặt `0` |

`draftOnly` luôn bằng `true` và không thể được tắt qua API.

## Dữ liệu ERP tự lấy và lan tỏa

| Dữ liệu canonical | Nguồn | Ảnh hưởng |
|---|---|---|
| `campaign.bidding_strategy_type` | Google readonly sync | Xác định strategy hiện tại |
| `target_spend.cpc_bid_ceiling_micros` | Google readonly sync | Phân biệt stage 1/2 và exact readback |
| `maximize_conversions.target_cpa_micros` | Google readonly sync | Phân biệt stage 3/4 và exact readback |
| `bidding_strategy_system_status` | Google readonly sync | Chặn chuyển tiếp khi `LEARNING`, `LIMITED`, `MISCONFIGURED` |
| Campaign clicks/conversions/cost theo ngày | `google_ads_daily_metrics`, level `campaign` | So ngưỡng, tính observed CPA; không cộng level khác để tránh double count |
| `ConversionAction.primary_for_goal` | Google readonly sync | Chứng minh conversion action được dùng cho bidding |
| `CampaignConversionGoal.biddable` | Google readonly sync | Chứng minh campaign có goal biddable khớp category/origin |
| `conversion_tracking_status` | Google readonly sync | Chặn Smart Bidding khi conversion tracking chưa bật hoặc chưa xác minh |
| Conversion customer ownership | Account + conversion action | Chặn evidence sai owner |
| Conversion goal campaign config | Google readonly sync | Chặn custom goal chưa được ERP hỗ trợ đầy đủ |

Cron gom các policy đang bật theo batch, sync canonical một lần cho các customer
liên quan, sau đó mới đánh giá từng campaign. Metrics chỉ dùng
`level=campaign`.

Khi tài khoản dùng cross-account conversion tracking, ERP lấy
`customer.conversion_tracking_setting.google_ads_conversion_customer` từ serving
account, query `ConversionAction` bằng conversion customer đó, rồi gắn snapshot
về serving customer. Các campaign goal và goal config vẫn được query bằng serving
customer. Snapshot conversion action dùng chung một conversion customer được cache
trong cùng một sync batch để tránh lặp request.

## Gate và chống tạo draft trùng

- Unique policy theo `(customerId, campaignId)`.
- Atomic lease ngăn hai worker đánh giá cùng campaign.
- Idempotency key gồm customer, campaign, target stage, ngày kết thúc cửa sổ,
  policy version và metrics hash.
- Không tạo draft mới nếu còn plan bidding non-terminal cho campaign.
- Campaign phải là Search, `ENABLED`, canonical fresh và không dùng portfolio
  bidding strategy.
- Metrics và conversion evidence phải fresh.
- Hai transition conversion chỉ được tạo draft khi primary conversion action
  khớp category/origin của campaign goal biddable.
- Custom conversion goal hiện bị chặn fail-closed.
- Live action có flag riêng
  `GOOGLE_ADS_CAMPAIGN_BIDDING_UPDATE_ENABLED=false` theo mặc định.
- Execution kiểm tra lại canonical campaign và conversion readiness; approval
  cũ không thể bypass evidence đã stale.
- Financial Control kiểm tra lại portfolio/envelope theo canonical daily budget
  trước live bidding mutation vì strategy mới có thể làm campaign tiêu gần trần hơn.
- Post-execution sync/readback phải khớp strategy type và target micros chính xác.

## API ERP

```text
GET  /api/google-ads/bidding-lifecycle/:customerId/:campaignId
PUT  /api/google-ads/bidding-lifecycle/:customerId/:campaignId
POST /api/google-ads/bidding-lifecycle/:customerId/:campaignId/evaluate
```

`PUT` và `POST evaluate` yêu cầu permission `google-ads.plan`. Endpoint evaluate
chỉ có thể tạo draft; không có endpoint auto-execute.

## Triển khai

1. Chạy production index preflight:

   ```powershell
   node backend/scripts/ensure-production-indexes.js
   ```

2. Chỉ dùng `--apply` sau khi preflight xác nhận dữ liệu không trùng.
3. Kết nối OAuth/developer token qua secret store hiện hữu; không nhập secret
   trong lifecycle UI.
4. Giữ `GOOGLE_ADS_CAMPAIGN_BIDDING_UPDATE_ENABLED=false` trong lúc thử sync,
   evaluate, validateOnly và approval.
5. Chỉ bật live flag sau khi validateOnly/readback pass trên customer thật.

## Giới hạn còn lại

- Không tự publish và không tự approve.
- Không hỗ trợ portfolio bidding, custom conversion goal, Maximize Conversion
  Value, Performance Max, Shopping, Display, Video hoặc delete trong lifecycle này.
- Mốc 50 click là rule do ERP cấu hình, không phải cam kết readiness từ Google.
- Campaign có thể ở trạng thái learning nhiều ngày; ERP giữ nguyên stage trong
  thời gian này.
