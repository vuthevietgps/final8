# Huong Dan Chi Tiet: Cau Hinh API Facebook/Google/TikTok Va Dua Du Lieu Len UI

Tai lieu nay mo ta day du cach cau hinh API cho tung nen tang quang cao va cach du lieu chay vao man hinh UI hien tai.

Noi dung duoc viet theo dung code dang co trong he thong `final8-version16`.

## 1. Muc tieu

Sau khi cau hinh dung:

1. He thong lay du lieu chi phi quang cao tu API nen tang.
2. Du lieu duoc luu vao collection `advertising_costs` theo cap `(adGroupId, date)` (upsert).
3. UI hien thi du lieu tai:
   - `/costs/advertising`
   - cac dashboard/tong hop co su dung advertising cost.

## 2. Dieu kien bat buoc truoc khi cau hinh API

### 2.1 Quyen truy cap

Can tai khoan co cac permission:

1. `api-tokens` de vao trang cau hinh API: `/ads-settings` va `/api-tokens`
2. `advertising-costs` de vao trang du lieu chi phi: `/costs/advertising`
3. `ad-accounts` va `ad-groups` de tao mapping tai khoan/nhom quang cao (neu can)

### 2.2 Mapping du lieu bat buoc trong he thong

Du lieu se khong vao UI neu thieu mapping:

1. Phai co `AdAccount` dung loai nen tang (`facebook|google|tiktok`) va `isActive=true`.
2. Phai co `AdGroup` dung `platform`, `isActive=true`, gan dung `adAccountId`.
3. `AdGroup.adGroupId` phai trung ID nhom tren nen tang.
4. Rule hien tai da khoa cung: `1 ad group = 1 product`.

Neu khong co `AdGroup` hop le, sync se chay nhung `updated=0`.

## 3. Luong du lieu API -> Database -> UI

1. Cron (hoac manual API) goi service sync tung nen tang.
2. Service sync goi API nen tang theo `adGroupId`.
3. Upsert vao `advertising_costs` theo `(adGroupId, date)`.
4. UI `/costs/advertising` goi `GET /api/advertising-cost` de hien thi.
5. UI co bo loc theo kenh, tai khoan, ngay.

## 4. Cau hinh theo tung nen tang

## 4.1 Facebook Ads

### A. Cach cap token

Co 2 cach:

1. Dat env `FB_ADS_ACCESS_TOKEN`
2. Luu token trong `Api Tokens` (de xai tren UI, de quan ly va rotate de hon)

He thong uu tien env truoc, sau do moi fallback qua token trong DB.

### B. Cach cau hinh de nghi (qua UI)

1. Vao `/api-tokens`
2. Tao token moi:
   - `provider`: `facebook`
   - `token`: access token co quyen ads
   - `status`: `active`
   - `isPrimary`: `true` (khuyen nghi)
   - `adAccountId`: khuyen nghi gan vao account de map dung
3. Validate token (`POST /api/api-tokens/:id/validate`)
4. Test ad account (`POST /api/api-tokens/:id/test-adaccount`)
5. Vao `/ads-settings` tab Facebook de test sync nhanh.

### C. Scope quan trong

Khoi dong sync/auto-control can token co `ads_management` (va/hoac `ads_read` tuy luong).

### D. API sync Facebook

1. Manual 1 lan:
   - `POST /api/advertising-cost/fetch/facebook?date=YYYY-MM-DD`
   - hoac `POST /api/advertising-cost/fetch/facebook?date=YYYY-MM-DD&days=N`
2. Cron tu dong: `06:00` hang ngay (gio server).

### E. Du lieu lay tu Facebook

API dung `/{adsetId}/insights`, lay cac field:

1. `spend`, `cpm`, `cpc`, `frequency`
2. `impressions`, `clicks`, `reach`
3. messaging metrics (`actions`, `cost_per_action_type`)

## 4.2 Google Ads

### A. Thong tin bat buoc

1. `developerToken`
2. `clientId`
3. `clientSecret`
4. `refreshToken`
5. `loginCustomerId` (khuyen nghi khi dung MCC)

### B. Cau hinh tren UI

1. Vao `/ads-settings` -> tab `Google Ads`
2. Dien day du cac truong tren
3. Bam `Test Ket Noi`
4. Bam `Luu Cau Hinh`
5. Bam `Test Sync Google`

UI goi cac API:

1. `POST /api/api-tokens/test/google`
2. `POST /api/api-tokens/settings/google`
3. `POST /api/advertising-cost/fetch/google?date=YYYY-MM-DD`

### C. Luu y mapping account

Service sync Google loc theo:

1. `AdAccount.accountType = google`
2. `AdGroup.platform = google`
3. `AdGroup.adAccountId` thuoc danh sach account dang active

`accountId` va `loginCustomerId` nen luu dang so, bo ky tu khong phai so.

### D. Cron va du lieu lay duoc

1. Cron tu dong: `06:15` hang ngay.
2. API query GAQL `ad_group` lay:
   - `cost_micros` -> `spentAmount`
   - `impressions`
   - `clicks`
   - `average_cpc`
   - `average_cpm`

## 4.3 TikTok Ads

### A. Thong tin bat buoc

1. `accessToken`
2. Co `AdAccount` type `tiktok` va `accountId` la advertiser id

### B. Cau hinh tren UI

1. Vao `/ads-settings` -> tab `TikTok`
2. Dien:
   - `Access Token` (bat buoc)
   - `App ID`, `App Secret` (tuy chon)
   - `Advertiser ID` de test
3. Bam `Test Ket Noi`
4. Bam `Luu Cau Hinh`
5. Bam `Test Sync TikTok`

UI goi cac API:

1. `POST /api/api-tokens/test/tiktok`
2. `POST /api/api-tokens/settings/tiktok`
3. `POST /api/advertising-cost/fetch/tiktok?date=YYYY-MM-DD`

### C. Cron va du lieu lay duoc

1. Cron tu dong: `06:30` hang ngay.
2. API report integrated lay:
   - `spend`
   - `impressions`
   - `clicks`
   - `cpc`
   - `cpm`
   - `reach`
   - `frequency`

## 5. Huong dan dung UI de dong bo du lieu

## 5.1 Trang cai dat API

Route: `/ads-settings`

1. Tab `Facebook`: test sync nhanh, quan ly token qua `/api-tokens`.
2. Tab `Google Ads`: test ket noi + luu credentials + test sync.
3. Tab `TikTok`: test ket noi + luu token + test sync.

## 5.2 Trang quan ly chi phi

Route: `/costs/advertising`

Chuc nang:

1. Dong bo thu cong Facebook/Google/TikTok theo ngay va so ngay.
2. Loc theo channel va ad account.
3. Xem bang chi tiet chi phi theo adGroup.

Luu y: tren man nay, ghi chu Facebook da duoc canh chinh theo cron thuc te la `06:00`.

## 6. API checklist de test nhanh (PowerShell)

Gia su domain la `https://htxbachgia.shop` va da co cookie login:

```powershell
# Sync health tat ca nen tang
Invoke-RestMethod -Method GET `
  -Uri "https://htxbachgia.shop/api/advertising-cost/sync/health"

# Sync Facebook 1 ngay
Invoke-RestMethod -Method POST `
  -Uri "https://htxbachgia.shop/api/advertising-cost/fetch/facebook?date=2026-03-04"

# Sync Google 1 ngay
Invoke-RestMethod -Method POST `
  -Uri "https://htxbachgia.shop/api/advertising-cost/fetch/google?date=2026-03-04"

# Sync TikTok 1 ngay
Invoke-RestMethod -Method POST `
  -Uri "https://htxbachgia.shop/api/advertising-cost/fetch/tiktok?date=2026-03-04"
```

Neu muon test theo nhieu ngay:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://htxbachgia.shop/api/advertising-cost/fetch/facebook?date=2026-03-04&days=7"
```

## 7. Cac loi thuong gap va cach xu ly

## 7.1 Sync thanh cong nhung updated = 0

Nguyen nhan thuong gap:

1. Chua co `AdGroup` dung `platform`
2. `adGroupId` trong ERP khong trung ID tren nen tang
3. `AdGroup` hoac `AdAccount` dang `isActive=false`
4. Token khong du quyen

## 7.2 Google bao thieu developer token hoac OAuth

Kiem tra lai:

1. Da luu `developerToken`
2. Da luu `clientId/clientSecret`
3. `refreshToken` con dung
4. `loginCustomerId` dung voi MCC dang cap quyen

## 7.3 TikTok test pass nhung sync khong co du lieu

Kiem tra:

1. `AdAccount.accountId` co phai advertiser id dung hay khong
2. `AdGroup.platform=tiktok` da map vao account do hay chua
3. Date co phat sinh spend hay khong

## 7.4 Facebook token hop le nhung pause/sync van loi

Kiem tra token co scope `ads_management` va ad account co quyen truy cap that su.

## 8. Bao mat va van hanh an toan

1. Khong commit token that vao git.
2. Dung `Api Tokens` de quan ly token va rotate dinh ky.
3. Dung endpoint health:
   - `GET /api/advertising-cost/sync/health`
4. Theo doi stale data:
   - `freshnessHours` cao -> can test sync thu cong.

## 9. File code chinh de doi chieu

Backend:

1. `backend/src/advertising-cost/advertising-cost.facebook-sync.service.ts`
2. `backend/src/advertising-cost/advertising-cost.google-sync.service.ts`
3. `backend/src/advertising-cost/advertising-cost.tiktok-sync.service.ts`
4. `backend/src/advertising-cost/advertising-cost.controller.ts`
5. `backend/src/api-token/api-token.controller.ts`
6. `backend/src/api-token/api-token.service.ts`

Frontend:

1. `frontend/src/app/features/ads-settings/ads-settings.component.ts`
2. `frontend/src/app/features/advertising-cost/advertising-cost.component.ts`
3. `frontend/src/app/features/advertising-cost/advertising-cost.service.ts`

