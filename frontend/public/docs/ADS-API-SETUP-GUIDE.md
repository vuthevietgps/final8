# Huong Dan Thiet Lap He Thong Ads API

Tai lieu nay mo ta cach van hanh 3 mo hinh:

1. Facebook qua `BM`
2. Google qua `MCC`
3. TikTok qua `BC`

Muc tieu cua ERP:

1. Quan ly duoc token he thong toi thieu
2. Quan ly duoc advertiser/account ben duoi tung lop BM/MCC/BC
3. Quan ly duoc ai la nguoi phu trach ads
4. Dong bo duoc chi phi ve `advertising_costs`

## 1. Mapping chung trong ERP

De du lieu vao dung bao cao, ca 3 nen tang deu theo quy trinh sau:

1. Tao `AdAccount`
2. Tao `AdGroup`
3. Map `AdGroup.adAccountId` vao dung account
4. Map `AdGroup.adGroupId` dung voi ID that tren nen tang
5. Gan nguoi phu trach ads va owner lead khi can

Neu thieu `AdGroup` hoac map sai `adGroupId`, sync van chay nhung `updated = 0`.

## 2. Facebook BM

### Cau truc van hanh

1. BM la lop quan ly
2. Moi ad account Facebook nam duoi BM
3. ERP co the lay token he thong va sync ad account/page token

### Thiet lap toi thieu

1. Cau hinh `Facebook System User Token`
2. Neu co `businessId`, co the dong bo them Facebook ad accounts ve ERP
3. Tai khoan Facebook trong ERP nen de `managementMode = bm`

### Lich sync

1. Facebook cost sync: `06:00` hang ngay

## 3. Google MCC

### Cau truc van hanh

1. MCC la lop quan ly
2. Moi customer account nam duoi MCC
3. ERP dung 1 bo OAuth + developer token de doc du lieu cho nhieu customer

### Thiet lap tren ERP

Vao `/ads-settings` tab `Google MCC`, nhap:

1. `Developer Token`
2. `Client ID`
3. `Client Secret`
4. `Refresh Token`
5. `Login Customer ID`
6. `API Version`

Sau do:

1. Test tren 1 customer con
2. Luu cau hinh
3. Tao tung customer thanh `AdAccount` type `google`
4. Dat `managementMode = mcc`

### Lich sync

1. Google cost sync: `06:15` hang ngay

## 4. TikTok Business Center

### Cau truc van hanh de nghi

1. `Business Center` la lop quan ly lon nhat
2. Moi `advertiser` duoc coi la 1 `AdAccount` trong ERP
3. Moi `ad group` TikTok duoc tao thanh 1 `AdGroup` trong ERP
4. Moi `AdGroup` can gan `assignedEmployeeId` de biet ai phu trach ads

### Token va phan quyen toi thieu

ERP chi can quan ly toi thieu cac thong tin sau:

1. `App ID`
2. `App Secret`
3. `Auth Code`
4. `Access Token`
5. `Refresh Token`
6. `Scope / Quyen`
7. `Business Center ID`
8. `Business Center Name`
9. `Test Advertiser ID`
10. Danh sach `Advertiser IDs` can sync

### Ghi chu OAuth quan trong

Theo SDK chinh thuc cua TikTok:

1. `POST /open_api/v1.3/oauth2/access_token/` doi `auth_code` thanh `access_token` va `refresh_token`
2. `access_token` co han `24 gio`
3. `refresh_token` co han `1 nam`
4. Trong vong `1 nam`, can lam moi access token hang ngay bang refresh token
5. Het `1 nam` thi can authorize lai

ERP da duoc mo rong de luu:

1. `authCode`
2. `refreshToken`
3. `scopes`
4. `accessTokenExpiresAt`
5. `refreshTokenExpiresAt`
6. `grantedAdvertiserIds`

### Quy trinh thiet lap TikTok BC

1. Tao 1 `Business Center` tong
2. Add toan bo advertiser can bao cao vao BC
3. Vao `https://ads.tiktok.com/marketing_api/apps/` de tao app trong `TikTok API for Business`
4. Trong app, xin quyen toi thieu de:
   - doc `advertiser` da authorize cho app
   - doc `reporting / insights`
   - uu tien read-only, khong xin quyen tao/sua campaign neu ERP chi dung de doc chi phi
5. Admin BC authorize app, sau do lay `auth_code` tu callback URL
6. Vao `/ads-settings` tab `TikTok BC`
7. Nhap:
   - `App ID`
   - `App Secret`
   - `Auth Code`
   - `Business Center ID`
   - `Business Center Name`
   - `Test Advertiser ID`
8. Bam `Doi auth code`
9. ERP se luu:
   - `Access Token`
   - `Refresh Token`
   - `Scopes`
   - `Advertiser IDs da authorize`
10. Kiem tra va chinh lai `Danh sach Advertiser IDs` can sync neu can
11. Vao `/ad-accounts`, tao moi advertiser thanh 1 `AdAccount`
12. Dat:
   - `accountType = tiktok`
   - `managementMode = bc`
   - `businessCenterId`
   - `businessCenterName`
   - `tokenSource`
   - `adsManagerUserId`
13. Vao `/ad-groups`, tao moi ad group TikTok
14. Gan:
   - `adAccountId`
   - `assignedEmployeeId`
   - `agentId`
15. Test sync TikTok hom qua

### Lich sync

1. TikTok cost sync: `06:30` hang ngay

## 5. Advertising Cost sau khi tai cau truc

Khi sync thanh cong, moi record chi phi co the duoc enrich voi:

1. `channel`
2. `customerId`
3. `businessCenterId`
4. `managementMode`
5. `adAccountName`
6. `adAccountAccountId`
7. `adsManagerUserId`
8. `assignedEmployeeId`

Dieu nay giup bao cao chi phi TikTok duoc nhin theo:

1. advertiser
2. business center
3. nguoi phu trach ads

## 6. Checklist truoc khi chay that

### Facebook

1. BM dung
2. Token hop le
3. Page/ad account da map

### Google

1. MCC dung
2. Refresh token con song
3. Customer da nam duoi MCC

### TikTok

1. BC dung
2. App da duoc authorize boi admin BC
3. Access token doc duoc advertiser trong BC
4. `Advertiser ID` trong ERP dung
5. `AdGroup` da map dung advertiser
6. Da gan nguoi phu trach ads noi bo

## 7. Loi thuong gap

### Sync pass nhung `updated = 0`

1. Sai `adGroupId`
2. Chua map `AdGroup -> AdAccount`
3. Account hoac group dang `isActive = false`

### TikTok test pass nhung chi phi khong ve

1. Advertiser co trong BC nhung khong co trong danh sach advertiser duoc sync
2. `AdAccount.accountId` khong dung advertiser id
3. Ngay do khong co spend

### Doi auth code thanh cong nhung khong thay advertiser

1. App chua duoc authorize tren advertiser hoac BC
2. `App ID / App Secret` sai
3. `auth_code` da het han hoac da duoc dung roi

### TikTok sync dang chay thi dung sau 24 gio

1. Access token da het han
2. Refresh token chua duoc van hanh / chua duoc lam moi
3. Refresh token cung co the het han sau 1 nam va can authorize lai

### Nguoi quan ly khong biet ai dang phu trach ads

1. Kiem tra `AdAccount.adsManagerUserId`
2. Kiem tra `AdGroup.assignedEmployeeId`
3. Kiem tra moc `lastOperatorActivityAt`

## 8. API can nho

1. `GET /api/api-tokens/settings`
2. `POST /api/api-tokens/settings/google`
3. `POST /api/api-tokens/settings/tiktok`
4. `POST /api/api-tokens/test/google`
5. `POST /api/api-tokens/test/tiktok`
6. `POST /api/advertising-cost/fetch/facebook`
7. `POST /api/advertising-cost/fetch/google`
8. `POST /api/advertising-cost/fetch/tiktok`
9. `GET /api/advertising-cost/sync/health`

## 9. Man hinh ERP can dung

1. `/ads-settings`
2. `/ad-accounts`
3. `/ad-groups`
4. `/costs/advertising`
