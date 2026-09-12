# Google Search activation và RSA pinning trong ERP

## Kết quả của pha

ERP có thể cấu hình và provider-validate toàn bộ nội dung Responsive Search Ad (RSA), gồm:

- final URL;
- 3–15 headline, tối đa 30 ký tự mỗi headline;
- 2–4 description, tối đa 90 ký tự mỗi description;
- pin headline vào `HEADLINE_1`, `HEADLINE_2`, `HEADLINE_3`;
- pin description vào `DESCRIPTION_1`, `DESCRIPTION_2`;
- display path 1/2;
- tracking URL template có `{lpurl}`;
- final URL suffix.

ERP cũng có typed action để chuyển tài nguyên canonical từ `PAUSED` sang `ENABLED` theo đúng thứ tự:

```text
1. resume_responsive_search_ad
2. resume_keyword
3. resume_ad_group
4. resume_campaign
```

Create không bao giờ tự kích hoạt. Campaign, Ad Group, positive Keyword và RSA mới vẫn được tạo ở trạng thái `PAUSED`.

## Mapping RSA

| Dữ liệu người dùng cấu hình trong ERP | Provider field | Guard và readback |
|---|---|---|
| Headline | `responsive_search_ad.headlines[].text` | 3–15 phần tử, không trùng, tối đa 30 ký tự; đối chiếu lại text sau mutate |
| Headline pin | `responsive_search_ad.headlines[].pinned_field` | Index phải trỏ đúng headline; chỉ nhận `HEADLINE_1..3`; gửi lại pin khi thay toàn bộ headline |
| Description | `responsive_search_ad.descriptions[].text` | 2–4 phần tử, không trùng, tối đa 90 ký tự; đối chiếu lại text |
| Description pin | `responsive_search_ad.descriptions[].pinned_field` | Index phải trỏ đúng description; chỉ nhận `DESCRIPTION_1..2`; gửi lại pin khi thay toàn bộ description |
| Final URL | `ad.final_urls[0]` | HTTPS, không có credential trong URL, hostname thuộc allowlist |
| Path 1/2 | `responsive_search_ad.path1/path2` | Tối đa 15 ký tự |
| Tracking template | `ad.tracking_url_template` | HTTPS, có `{lpurl}`, hostname thuộc tracking allowlist, không chứa secret-like data |
| Final URL suffix | `ad.final_url_suffix` | Chỉ nhận chuỗi `key=value`, không nhận URL hoặc fragment |

Update headline/description là thao tác thay toàn bộ asset list. Vì vậy, khi thay text, ERP bắt buộc payload phải chứa `headlinePins`/`descriptionPins`; mảng rỗng có nghĩa là chủ động bỏ toàn bộ pin. UI luôn gửi lại pin hiện tại khi text thay đổi để tránh mất pin ngoài ý muốn.

## Activation gate theo từng bước

| Bước | Canonical precondition | Ảnh hưởng |
|---|---|---|
| RSA | Campaign `PAUSED`; RSA `PAUSED`; policy `APPROVED`; landing/tracking an toàn | Chỉ RSA chuyển `ENABLED`; parent vẫn chặn serving |
| Positive Keyword | Campaign `PAUSED`; keyword positive và `PAUSED` | Chỉ keyword chuyển `ENABLED`; negative keyword không được resume |
| Ad Group | Campaign và Ad Group `PAUSED`; cùng Ad Group đã có positive Keyword và RSA policy-approved `ENABLED` | Ad Group chuyển `ENABLED`; campaign vẫn chặn serving |
| Campaign | Campaign `PAUSED`; network Search đúng invariant; có location/language canonical ở trạng thái `ENABLED`; có ít nhất một delivery graph hoàn chỉnh | Campaign chuyển `ENABLED`, bắt đầu có khả năng serving |

Mỗi bước là một plan/wave riêng và phải sync/readback trước bước kế tiếp. ERP không dùng provider temporary ID hoặc giả định trạng thái của action khác trong cùng plan.

## Bidding và conversion

Campaign create vẫn cho phép cấu hình `MANUAL_CPC`, `MAXIMIZE_CONVERSIONS` và `MAXIMIZE_CONVERSION_VALUE`, nhưng mặc định an toàn hiện tại là `MANUAL_CPC`.

Campaign chỉ được resume với `MANUAL_CPC` trong pha này. Hai chiến lược conversion bị khóa fail-closed cho đến khi ERP có canonical model và freshness/readback cho:

- `ConversionAction.primary_for_goal`;
- customer/campaign conversion goal `biddable`;
- conversion customer ownership;
- value/currency readiness khi dùng `MAXIMIZE_CONVERSION_VALUE`.

`customer.conversion_tracking_setting` chỉ là configuration evidence, không đủ để chứng minh bidding goal đã sẵn sàng.

## Live controls

Ngoài các canonical precondition ở trên, mọi resume action vẫn phải qua toàn bộ control plane:

1. provider `validateOnly=true` pass với đúng operation hash;
2. approval hợp lệ và separation-of-duties;
3. dry-run thành công;
4. Financial Control áp dụng cho action tạo exposure;
5. `GOOGLE_ADS_PRODUCTION_ENABLED=true`;
6. `AI_MARKETING_PROVIDER_EXECUTION_ENABLED=true`;
7. `AI_MARKETING_DRY_RUN=false`;
8. đúng per-action flag được bật;
9. post-execution sync/readback xác nhận chính xác `status=ENABLED`.

Các flag mới mặc định `false`:

```text
GOOGLE_ADS_RSA_RESUME_ENABLED
GOOGLE_ADS_KEYWORD_RESUME_ENABLED
GOOGLE_ADS_AD_GROUP_RESUME_ENABLED
GOOGLE_ADS_CAMPAIGN_RESUME_ENABLED
```

Không có delete, negative keyword mutation/resume, auto-publish, Performance Max, Shopping, Display hoặc Video trong pha này.

## Verification

```powershell
cd backend
npm test -- --runInBand src/google-ads
npm run build

cd ../frontend
npm test -- --watch=false --browsers=ChromeHeadless `
  --include=src/app/features/google-ads/google-ads-campaign.component.spec.ts `
  --include=src/app/features/google-ads/google-ads-campaign.service.spec.ts `
  --include=src/app/features/google-ads/google-ads-campaign.route.spec.ts
npm run build
```
