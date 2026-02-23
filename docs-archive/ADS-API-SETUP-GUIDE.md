# 🚀 HƯỚNG DẪN CẤU HÌNH AUTO SYNC CHI PHÍ QUẢNG CÁO

Hệ thống đã có sẵn code sync chi phí từ **Facebook**, **Google Ads** và **TikTok Ads**.
Chỉ cần cấu hình API credentials để kích hoạt.

---

## 📊 TỔNG QUAN

| Nền tảng | File Service | Cronjob | Trạng thái |
|----------|--------------|---------|------------|
| Facebook | `advertising-cost.facebook-sync.service.ts` | 6:00 AM | ✅ Đã hoạt động |
| Google Ads | `advertising-cost.google-sync.service.ts` | 6:15 AM | ⏳ Cần credentials |
| TikTok | `advertising-cost.tiktok-sync.service.ts` | 6:30 AM | ⏳ Cần credentials |

---

## 1️⃣ GOOGLE ADS - HƯỚNG DẪN LẤY CREDENTIALS

### Bước 1: Đăng ký Google Ads API

1. Truy cập [Google Ads API Console](https://ads.google.com/home/tools/manager-accounts/)
2. Tạo **Manager Account** (MCC - My Client Center) nếu chưa có
3. Vào **Tools & Settings** → **Setup** → **API Center**
4. Đăng ký để lấy **Developer Token**

### Bước 2: Tạo OAuth 2.0 Credentials

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project có sẵn
3. Enable **Google Ads API**:
   - APIs & Services → Library → Tìm "Google Ads API" → Enable
4. Tạo OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application** hoặc **Desktop app**
   - Lưu lại **Client ID** và **Client Secret**

### Bước 3: Lấy Refresh Token

Sử dụng [OAuth Playground](https://developers.google.com/oauthplayground/):

1. Click ⚙️ (Settings) → Check "Use your own OAuth credentials"
2. Nhập Client ID và Client Secret
3. Bên trái, tìm "Google Ads API v15" → Check scope `https://www.googleapis.com/auth/adwords`
4. Click **Authorize APIs** → Đăng nhập tài khoản Google Ads
5. Click **Exchange authorization code for tokens**
6. Copy **Refresh Token**

### Bước 4: Cấu hình biến môi trường

Thêm vào file `.env` của backend:

```env
# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token_here
GOOGLE_ADS_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_LOGIN_CUSTOMER_ID=1234567890  # ID tài khoản MCC (không có dấu -)
```

### Bước 5: Tạo Ad Account trong ERP

```bash
# Tạo tài khoản Google Ads
curl -X POST http://localhost:3000/ad-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Google Ads Account",
    "accountId": "1234567890",
    "accountType": "google",
    "isActive": true
  }'
```

---

## 2️⃣ TIKTOK ADS - HƯỚNG DẪN LẤY CREDENTIALS

### Bước 1: Đăng ký TikTok Marketing API

1. Truy cập [TikTok for Business Developers](https://ads.tiktok.com/marketing_api/auth)
2. Tạo App mới:
   - App Name: "ERP Sync"
   - App Type: **Business** (để có quyền report)
3. Lấy **App ID** và **App Secret**

### Bước 2: Lấy Access Token

**Cách 1: Sandbox Mode (Test)**
- Vào App → Sandbox → Get Access Token
- Token này chỉ dùng được với dữ liệu sandbox

**Cách 2: Production Mode (Thật)**

1. Gửi request authorization:
```
https://ads.tiktok.com/marketing_api/auth?app_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&state=YOUR_STATE
```

2. Sau khi user authorize, TikTok redirect với `auth_code`

3. Exchange auth_code lấy access_token:
```bash
curl -X POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/ \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "YOUR_APP_ID",
    "secret": "YOUR_APP_SECRET",
    "auth_code": "AUTH_CODE_FROM_REDIRECT"
  }'
```

4. Response chứa `access_token` (có hiệu lực 24h) và `refresh_token` (dùng để làm mới)

### Bước 3: Cấu hình biến môi trường

```env
# TikTok Ads API
TIKTOK_ACCESS_TOKEN=your_access_token_here
TIKTOK_APP_ID=your_app_id
TIKTOK_APP_SECRET=your_app_secret
```

### Bước 4: Tạo Ad Account trong ERP

```bash
# Tạo tài khoản TikTok Ads
curl -X POST http://localhost:3000/ad-accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "TikTok Ads Account",
    "accountId": "7123456789012345678",
    "accountType": "tiktok",
    "isActive": true
  }'
```

---

## 3️⃣ KIỂM TRA SAU KHI CẤU HÌNH

### Test sync thủ công

```bash
# Test Google Ads sync
curl -X POST http://localhost:3000/advertising-cost/sync/google \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-29"}'

# Test TikTok sync
curl -X POST http://localhost:3000/advertising-cost/sync/tiktok \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-01-29"}'
```

### Kiểm tra logs

```bash
# Xem logs backend
cd backend
npm run start:dev

# Logs sẽ hiển thị:
# [GoogleSyncService] Starting Google Ads sync for 2026-01-29
# [TiktokSyncService] Starting TikTok Ads sync for 2026-01-29
```

---

## 4️⃣ LỊCH CHẠY TỰ ĐỘNG (CRONJOBS)

| Nền tảng | Thời gian | Chức năng |
|----------|-----------|-----------|
| Facebook | 6:00 AM | Sync chi phí hôm qua |
| Google | 6:15 AM | Sync chi phí hôm qua |
| TikTok | 6:30 AM | Sync chi phí hôm qua |

Sau khi sync, hệ thống tự động:
1. Cập nhật chi phí vào collection `advertising_costs`
2. Recalculate các đơn hàng trong ngày đó
3. Cập nhật ROI, lợi nhuận cho các ad groups

---

## 5️⃣ QUẢN LÝ TOKEN QUA ERP (THAY THẾ ENV)

Thay vì dùng biến môi trường, có thể lưu token vào database:

```bash
# Thêm token Facebook
curl -X POST http://localhost:3000/api-tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "facebook",
    "token": "YOUR_FACEBOOK_ACCESS_TOKEN",
    "name": "FB Ads Token",
    "isPrimary": true
  }'

# Thêm token Google
curl -X POST http://localhost:3000/api-tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "google",
    "token": "YOUR_REFRESH_TOKEN",
    "adAccountId": "1234567890",
    "name": "Google Ads Token",
    "isPrimary": true
  }'

# Thêm token TikTok
curl -X POST http://localhost:3000/api-tokens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "tiktok",
    "token": "YOUR_TIKTOK_ACCESS_TOKEN",
    "name": "TikTok Ads Token",
    "isPrimary": true
  }'
```

---

## 6️⃣ METRICS ĐƯỢC SYNC

| Metric | Facebook | Google | TikTok |
|--------|:--------:|:------:|:------:|
| `spentAmount` (Chi phí) | ✅ | ✅ | ✅ |
| `impressions` (Lượt hiển thị) | ✅ | ✅ | ✅ |
| `clicks` (Lượt click) | ✅ | ✅ | ✅ |
| `cpc` (Cost per click) | ✅ | ✅ | ✅ |
| `cpm` (Cost per 1000 impressions) | ✅ | ✅ | ✅ |
| `reach` (Người tiếp cận) | ✅ | ❌ | ❌ |
| `frequency` (Tần suất) | ✅ | ❌ | ❌ |
| `messagingConversationStarted7d` | ✅ | ❌ | ❌ |

---

## 7️⃣ TROUBLESHOOTING

### Lỗi: "Missing GOOGLE_ADS_DEVELOPER_TOKEN"
→ Chưa đăng ký Google Ads API hoặc chưa set biến môi trường

### Lỗi: "Thiếu TIKTOK_ACCESS_TOKEN"
→ Chưa lấy access token TikTok hoặc token đã hết hạn

### Lỗi: "accountId không hợp lệ"
→ Account ID phải là số thuần (không có dấu gạch ngang)

### Lỗi: "No active ad groups found"
→ Cần tạo Ad Group trong ERP với đúng platform và adAccountId

---

## 📞 LIÊN KẾT HỮU ÍCH

- [Facebook Marketing API Docs](https://developers.facebook.com/docs/marketing-api/)
- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [TikTok Marketing API Docs](https://business-api.tiktok.com/marketing_api/docs)
- [OAuth Playground](https://developers.google.com/oauthplayground/)

---

*Tài liệu được tạo tự động bởi ERP System - Ngày 30/01/2026*
