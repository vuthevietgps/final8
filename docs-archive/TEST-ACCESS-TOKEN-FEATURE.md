# Test Access Token Feature - Hướng dẫn

## ✨ Tính năng mới đã thêm

### 1. Button Test Access Token
- **Vị trí**: Cột "Hành động" trong bảng fanpage
- **Icon**: 🔍 (kính lúp)
- **Chức năng**: Kiểm tra trạng thái access token với Facebook Graph API

### 2. Cột Token cập nhật
- **Hiển thị trạng thái**: Valid, Invalid, Expired, Testing
- **Màu sắc**: 
  - ✅ Xanh lá: Token hợp lệ
  - ❌ Đỏ: Token không hợp lệ/hết hạn
  - 🔄 Xanh dương + animation: Đang kiểm tra
  - ⚪ Xám: Chưa kiểm tra

### 3. Backend API endpoints
- `POST /api/fanpages/debug/:id/validate-token`: Kiểm tra token
- `POST /api/fanpages/debug/:id/refresh-token`: Cập nhật token mới

## 🧪 Cách test

### Method 1: Test trên local (với ngrok)
```bash
# Terminal 1: Start backend
cd backend && npm run start:dev

# Terminal 2: Start frontend  
cd frontend && npm start

# Terminal 3: Setup ngrok
ngrok http 3000
# Copy URL: https://abc123.ngrok.io

# Cập nhật Facebook webhook URL trong Developer Console
```

### Method 2: Test trên server production ⭐ (Khuyến nghị)

#### Bước 1: Deploy code mới
```bash
# Build và push images
docker build -t vutheviet/final8new:backend-debug backend/
docker build -t vutheviet/final8new:frontend-debug frontend/dist/

docker push vutheviet/final8new:backend-debug  
docker push vutheviet/final8new:frontend-debug

# SSH vào server
ssh admin-001@your-server

# Pull và restart
cd /opt/websites/sites/htxbachgia-shop
docker pull vutheviet/final8new:backend-debug
docker pull vutheviet/final8new:frontend-debug

# Tag as current version
docker tag vutheviet/final8new:backend-debug vutheviet/final8new:backend-version6.1
docker tag vutheviet/final8new:frontend-debug vutheviet/final8new:frontend-version6.1

# Restart containers
docker-compose restart
```

#### Bước 2: Test API endpoint
```bash
# Test validate endpoint
curl -X POST "https://htxbachgia.shop/api/fanpages/debug/68ebcb48b631002b38117c82/validate-token" \
  -H "Content-Type: application/json"

# Expected response:
# {"valid": false, "error": "Invalid OAuth access token - Cannot parse access token (Code: 190)"}
```

#### Bước 3: Lấy token mới từ Facebook
1. Vào https://developers.facebook.com/
2. Chọn app của bạn  
3. Tools & Support > Access Token Tool
4. Page Access Tokens > "Hộ Chiếu Toàn Quốc" (Page ID: 670008282852091)
5. Generate Token với permissions:
   - pages_manage_metadata
   - pages_messaging 
   - pages_read_engagement
6. Copy token mới

#### Bước 4: Update token
```bash
curl -X POST "https://htxbachgia.shop/api/fanpages/debug/68ebcb48b631002b38117c82/refresh-token" \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "NEW_TOKEN_HERE"}'

# Expected response:
# {"success": true, "message": "Access token đã được cập nhật thành công cho page: Hộ Chiếu Toàn Quốc"}
```

#### Bước 5: Test UI
1. Vào https://htxbachgia.shop
2. Login và vào menu "📘 Fanpage"  
3. Tìm fanpage "Hộ Chiếu Toàn Quốc"
4. Click button 🔍 trong cột "Hành động"
5. Xem cột "Token" cập nhật trạng thái

## 🔧 Troubleshooting

### Lỗi 404 API endpoint
```bash
# Kiểm tra container backend
docker logs htxbachgia-shop-backend --tail 20

# Restart nếu cần
docker-compose restart backend
```

### Token vẫn invalid sau update
1. Kiểm tra token mới có đúng permissions không
2. Verify token trực tiếp:
```bash
curl "https://graph.facebook.com/v19.0/me?access_token=YOUR_TOKEN"
```

### Frontend không hiển thị
```bash
# Clear browser cache
# Check network tab trong DevTools
# Kiểm tra console errors
```

## ✅ Kết quả mong đợi

Sau khi fix token đúng:
1. Cột Token hiển thị ✅ "Hợp lệ"
2. Messenger webhook hoạt động bình thường
3. AI reply được gửi thành công đến khách hàng
4. Không còn lỗi OAuth trong logs