# Google Search delivery stack trong ERP

## Kết quả của pha

ERP quản lý typed create/update/pause cho chuỗi tài nguyên bắt buộc của Google Search:

```text
Google Ads account
  -> Campaign Budget + Search Campaign (PAUSED)
  -> Search Ad Group (PAUSED)
  -> Positive Keyword (PAUSED)
  -> Responsive Search Ad (PAUSED)
```

Mỗi wave chỉ dùng provider ID canonical sau khi wave trước đã execute và đồng bộ readback. Trình duyệt không được gửi resource name, credential hoặc raw Google mutate operation.

Pha này không hỗ trợ Performance Max, Shopping, Display, YouTube/Video, negative-keyword mutation, resume/enable, delete hoặc auto-publish.

## Mapping dữ liệu

| Resource/action | Người dùng nhập trong ERP | ERP lấy hoặc ép | Ảnh hưởng lan tỏa |
|---|---|---|---|
| Search Campaign create | account, tên campaign/budget, ngân sách ngày, bidding strategy, ngày chạy, Search Partners, geo/language constant IDs, geo presence, khai báo EU, lý do | `SEARCH`, `PAUSED`, Google Search on, Content/Partner Search Network off, budget `STANDARD` không shared, VND/Asia/Ho_Chi_Minh | Tạo canonical parent cho toàn bộ Ad Group/Keyword/RSA; ngân sách đi qua Financial Control |
| Search Campaign update | tên mới, ngày kết thúc chỉ được giữ/rút ngắn, ngân sách mới, lý do | campaign và Campaign Budget canonical; budget ID không suy từ campaign/ad-group ID | Tên/ngày tác động campaign; budget được tách thành action riêng và tái tính exposure toàn portfolio |
| Campaign pause | campaign, lý do | exact campaign resource name | Dừng phân phối ở cấp parent; không xóa child resources |
| Ad Group create/update/pause | campaign, tên nhóm, CPC tùy chọn, lý do | `SEARCH_STANDARD`, create `PAUSED`, exact parent/resource | Là parent canonical của Keyword/RSA; CPC chỉ hợp lệ khi campaign canonical dùng `MANUAL_CPC` |
| Positive Keyword create/update/pause | Ad Group, text, match type, CPC/final URL tùy chọn, lý do | create `PAUSED`; exact `adGroupCriteria/{adGroupId}~{criterionId}`; text/match type immutable sau create | Điều khiển truy vấn tìm kiếm; CPC đi qua absolute cap và maximum-increase policy; URL đi qua HTTPS/domain allowlist |
| Responsive Search Ad create/update/pause | Ad Group, final URL, 3–15 headline, 2–4 description, path, tracking template/suffix, lý do | create `PAUSED`; exact Ad/AdGroupAd IDs; length/dedup/HTTPS/tracking-domain rules | Nội dung và landing/tracking được provider validateOnly rồi canonical readback; pause đổi trạng thái AdGroupAd |
| Configuration evidence | không nhập | account conversion-tracking setting, network invariants, số lượng canonical Ad Group/positive Keyword/RSA, domain allowlist | Chỉ cho biết dữ liệu cấu hình hiện diện; không phải bằng chứng campaign có thể serving hoặc activation |

## Dữ liệu canonical và lan truyền

```text
customerId + MCC credential binding
  -> mọi validateOnly/mutate/readback

campaignId + biddingStrategyType + campaignBudgetId
  -> Ad Group parent
  -> CPC policy
  -> Financial Control exposure

adGroupId
  -> Keyword criterion resource
  -> AdGroupAd resource

final URL + tracking fields
  -> HTTPS/domain allowlist
  -> provider validateOnly operation hash
  -> post-execution canonical readback
```

Các lookup loại bỏ resource `REMOVED` và fail-closed khi account/resource thiếu sync thành công hoặc quá tuổi `GOOGLE_ADS_CANONICAL_SYNC_MAX_AGE_MS`. Mọi CPC bid phải thuộc campaign `MANUAL_CPC`, không vượt `GOOGLE_ADS_MAX_CPC_BID_VND`, và mức tăng không vượt `GOOGLE_ADS_MAX_CPC_BID_INCREASE_PERCENT`.

## Negative keyword

Google không cho update negative ad-group criterion. Vì ERP cũng cấm delete, việc tạo negative keyword ở trạng thái `PAUSED` sẽ tạo một resource không thể kích hoạt hoặc sửa an toàn. Do đó pha này hiển thị negative keyword canonical ở chế độ read-only và từ chối create/update/pause/delete.

## Điều kiện live

Một action chỉ được mutate thật khi đồng thời đạt:

1. canonical account/resource còn mới và đúng Search hierarchy;
2. provider `validateOnly=true` đã pass;
3. operation hash, API version và credential binding còn khớp và chưa hết hạn;
4. creator, approver và live executor thỏa separation-of-duties;
5. global production flags và đúng per-resource action flag đều bật;
6. spend-increasing action vượt qua Financial Control dưới distributed lease;
7. explicit `validateOnly=false`, action IDs và live confirmation hợp lệ;
8. post-execution sync/readback xác nhận đúng resource và field đã mutate.

Tất cả production/per-resource flags trong example và Docker Compose mặc định là `false`.

## Giới hạn cần pha riêng

- Chưa có explicit activation/resume. Các resource mới không tự serving và không thể auto-publish.
- Configuration evidence hiện đọc `customer.conversion_tracking_setting`; chưa cấu hình hoặc chứng minh `ConversionAction.primary_for_goal`, customer/campaign conversion goal `biddable`, hay value/currency readiness cho `MAXIMIZE_CONVERSION_VALUE`.
- Readback campaign xác nhận campaign/budget/network/geo type/EU declaration, nhưng chưa query campaign criteria để đối chiếu từng geo/language constant ID.
- Negative keyword cần workflow riêng: chỉ tạo khi toàn hierarchy còn PAUSED và có chiến lược activation bất biến, hoặc tiếp tục giữ read-only.

Pha activation phải enable child resources có kiểm soát trong khi campaign còn `PAUSED`, kiểm tra RSA policy approval cùng conversion/tracking/budget readiness, rồi mới resume campaign ở action cuối. Activation không được gộp ngầm vào create/update.

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
