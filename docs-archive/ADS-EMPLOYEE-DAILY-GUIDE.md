# 📋 Hướng Dẫn Công Việc Hàng Ngày - Nhân Viên Ads

> **Phiên bản**: 1.1  
> **Cập nhật**: 30/01/2026  
> **Đối tượng**: Nhân viên chạy quảng cáo (Facebook, Google, TikTok)

---

## 🚀 THIẾT LẬP BAN ĐẦU (Chỉ làm 1 lần)

### Bước 1: Tạo Tài Khoản Quảng Cáo (Ad Account)

1. Vào menu **"💳 Tài Khoản QC"** (`/ad-accounts`)
2. Nhấn **"+ Thêm mới"**
3. Điền thông tin:
   - **Tên**: Ví dụ "FB Ads Account 1"
   - **Account ID**: Copy từ Facebook Ads Manager (ví dụ: `123456789`)
   - **Loại**: Chọn `facebook` / `google` / `tiktok`
4. Lưu

### Bước 2: Auto-Discover Ad Groups từ Facebook

1. Vào menu **"📊 Nhóm Quảng Cáo"** (`/ad-groups`)
2. Nhấn **"🔍 Discover"** (nút mới)
3. Chọn Ad Account vừa tạo
4. Hệ thống sẽ tự động:
   - Kết nối Facebook API
   - Lấy danh sách tất cả Ad Groups (Adsets)
   - Hiển thị để bạn chọn import
5. Tick chọn các ad groups muốn theo dõi
6. Chọn Fanpage, Nhóm Sản Phẩm, Đại Lý liên kết
7. Nhấn **"Import"**

**⚡ SAU KHI IMPORT:**
- Hệ thống TỰ ĐỘNG lấy chi phí quảng cáo hàng ngày (6:00 AM)
- Tự động cập nhật metadata mỗi giờ
- Không cần thao tác thủ công nữa!

---

## 📅 Lịch Trình Làm Việc Hàng Ngày

### ⏰ Buổi Sáng (8:00 - 12:00)

#### 1. Kiểm Tra Thông Báo Hệ Thống (8:00 - 8:30)

**Bước 1**: Đăng nhập vào hệ thống ERP tại `http://localhost:4200`

**Bước 2**: Kiểm tra **🔔 Notification Bell** ở góc trên bên phải sidebar
- Badge đỏ = Có cảnh báo nghiêm trọng cần xử lý ngay
- Nhấn vào 🔔 để mở drawer thông báo

**Bước 3**: Xem tab **"🚨 Cảnh báo"**
- 🚨 **CRITICAL (Đỏ)**: Ad group cần TẮT NGAY - ROI < 50%
- ⚠️ **WARNING (Vàng)**: Ad group cần theo dõi - ROI 50-80%
- 🚀 **SUCCESS (Xanh)**: Ad group có thể SCALE - ROI > 150%

**Bước 4**: Xem tab **"💡 Gợi ý chi phí"**
- Xem danh sách gợi ý ngân sách tối ưu cho từng ad group
- Ghi chú lại những ad group cần điều chỉnh

---

#### 2. Điều Chỉnh Ngân Sách Ads (8:30 - 10:00)

Dựa trên gợi ý từ hệ thống, vào các nền tảng để điều chỉnh:

##### Facebook Ads Manager
1. Truy cập: https://business.facebook.com/adsmanager
2. Chọn tài khoản quảng cáo tương ứng
3. Điều chỉnh budget theo gợi ý:

| Gợi ý từ ERP | Hành động trên Facebook |
|--------------|-------------------------|
| 📈 Tăng 20% | Tăng Daily Budget lên 20% |
| 📈 Tăng 10% | Tăng Daily Budget lên 10% |
| ➡️ Giữ nguyên | Không thay đổi |
| 📉 Giảm 20% | Giảm Daily Budget xuống 20% |
| ⛔ Nên tắt | Pause ad group |

##### Google Ads
1. Truy cập: https://ads.google.com
2. Chọn account > Campaigns > Ad Groups
3. Điều chỉnh budget tương tự

##### TikTok Ads
1. Truy cập: https://ads.tiktok.com
2. Chọn Campaign > Ad Group
3. Điều chỉnh budget theo gợi ý

---

#### 3. Kiểm Tra Hiệu Suất Ad Groups (10:00 - 11:00)

**Trong ERP:**
1. Vào menu **"📊 Nhóm Quảng Cáo"** (`/ad-groups`)
2. Xem bảng tổng quan tất cả ad groups
3. Chú ý các chỉ số:
   - **ROI**: Lợi nhuận trên chi phí quảng cáo
   - **Spend**: Chi phí đã chi
   - **Revenue**: Doanh thu tạo ra
   - **Profit**: Lợi nhuận thực

**Các ngưỡng cần nhớ:**

| Chỉ số | Tốt | Trung bình | Xấu |
|--------|-----|------------|-----|
| ROI | > 150% | 80-150% | < 80% |
| CSI (Composite Severity Index) | < 0.3 | 0.3-0.7 | > 0.7 |

---

#### 4. Báo Cáo Buổi Sáng (11:00 - 12:00)

1. Vào **"📈 Báo Cáo Lợi Nhuận"** (`/ad-group-profit-report`)
2. Xem tổng quan:
   - Tổng chi phí ads hôm nay
   - Tổng doanh thu từ ads
   - ROI tổng thể
3. Ghi chú các ad group có vấn đề để báo cáo Manager

---

### ⏰ Buổi Chiều (13:00 - 17:30)

#### 5. Kiểm Tra Lại Alerts (13:00 - 13:30)

- Hệ thống tự động check mỗi 30 phút (8:00 - 22:00)
- Nhấn **"🔍 Kiểm tra ngay"** nếu muốn check thủ công
- Xử lý các cảnh báo mới phát sinh

---

#### 6. Tối Ưu Quảng Cáo (13:30 - 16:00)

##### Với ad groups ROI > 200% (Có thể scale mạnh):
- [ ] Tăng budget 20-30%
- [ ] Duplicate ad group với audience mới
- [ ] Test thêm creative mới

##### Với ad groups ROI 100-200% (Đang tốt):
- [ ] Giữ nguyên hoặc tăng nhẹ 10%
- [ ] Theo dõi thêm 2-3 ngày

##### Với ad groups ROI 50-100% (Cần theo dõi):
- [ ] Không tăng budget
- [ ] Phân tích audience, creative
- [ ] Cân nhắc điều chỉnh targeting

##### Với ad groups ROI < 50% (Cần tắt):
- [ ] Pause ngay lập tức
- [ ] Phân tích nguyên nhân
- [ ] Báo cáo Manager

---

#### 7. Kiểm Tra Trạng Thái Đồng Bộ (16:00 - 16:30)

1. Vào menu **"📊 Nhóm Quảng Cáo"** (`/ad-groups`)
2. Kiểm tra cột **"Sync Status"**:
   - ✅ **OK**: Đồng bộ thành công
   - ❌ **Error**: Có lỗi - kiểm tra token API
   - ⏳ **Pending**: Chưa sync (chờ đến 6:00 AM)
3. Nếu thấy Error, vào **"⚙️ Cài Đặt API"** (`/ads-settings`) để kiểm tra token

**Lưu ý**: Hệ thống tự động đồng bộ chi phí mỗi ngày lúc 6:00 AM

---

#### 8. Báo Cáo Cuối Ngày (17:00 - 17:30)

1. Tổng hợp kết quả ngày:
   - Số ad groups đã điều chỉnh
   - Số ad groups đã tắt
   - Số ad groups đã scale

2. Gửi báo cáo cho Manager qua hệ thống hoặc chat

---

## 🔔 Quy Tắc Xử Lý Cảnh Báo

### Mức độ ưu tiên:

| Loại | Icon | Thời gian xử lý | Hành động |
|------|------|-----------------|-----------|
| CRITICAL | 🚨 | Trong 30 phút | Tắt ad group ngay |
| WARNING | ⚠️ | Trong 2 giờ | Theo dõi, giảm budget |
| SUCCESS | 🚀 | Trong ngày | Cân nhắc scale |
| INFO | ℹ️ | Khi rảnh | Đọc để nắm thông tin |

### Khi nhận được cảnh báo CRITICAL:

```
1. Nhấn vào alert để xem chi tiết
2. Ghi nhận ad group ID và tên
3. Vào platform (Facebook/Google/TikTok)
4. Tìm ad group đó
5. Pause ngay lập tức
6. Quay lại ERP, dismiss alert
7. Báo cáo Manager nếu chi phí lớn (> 1 triệu VND)
```

---

## 💡 Cách Đọc Gợi Ý Chi Phí

### Trong tab "💡 Gợi ý chi phí":

Mỗi gợi ý hiển thị:
- **Tên ad group**: Tên nhóm quảng cáo
- **Platform**: Facebook / Google / TikTok
- **Chi phí hiện tại → Đề xuất**: Số tiền cần thay đổi
- **ROI**: Tỷ lệ lợi nhuận hiện tại
- **Độ tin**: Độ tin cậy của gợi ý (cao = nên làm theo)
- **Tag màu**: Hành động cần thực hiện

### Ý nghĩa các tag:

| Tag | Màu | Ý nghĩa | Hành động |
|-----|-----|---------|-----------|
| Tăng ngân sách | 🟢 Xanh lá | ROI tốt, nên scale | Tăng budget theo gợi ý |
| Giữ nguyên | 🔵 Xanh dương | ROI ổn định | Không thay đổi |
| Giảm ngân sách | 🟡 Vàng | ROI chưa tốt | Giảm để test thêm |
| Nên tắt | 🔴 Đỏ | ROI quá thấp | Pause ngay |

---

## 📊 Các Màn Hình Quan Trọng

| Tính năng | Đường dẫn | Mục đích |
|-----------|-----------|----------|
| 🔔 Alerts | Sidebar header | Xem cảnh báo real-time |
| � Tài Khoản QC | `/ad-accounts` | Quản lý ad accounts (điền 1 lần) |
| 📊 Nhóm Quảng Cáo | `/ad-groups` | Quản lý ad groups + Auto-Discover |
| 📈 Báo Cáo Lợi Nhuận | `/ad-group-profit-report` | Xem profit report |
| 💸 Ngân Sách Ads | `/ads-budget` | Xem phân bổ ngân sách |
| 🎯 KPI Nhân Viên | `/employee-ads-kpi` | Xem KPI cá nhân |
| ⚙️ Cài Đặt API | `/ads-settings` | Cấu hình token Facebook/Google |

---

## 🔄 Hệ Thống Tự Động

### Các Cron Jobs chạy hàng ngày:

| Thời gian | Chức năng | Mô tả |
|-----------|-----------|-------|
| Mỗi giờ | Sync Metadata | Cập nhật tên, trạng thái, budget từ Facebook |
| 6:00 AM | Sync Chi Phí Facebook | Lấy chi phí ngày hôm qua |
| 6:15 AM | Sync Chi Phí Google | Lấy chi phí ngày hôm qua |
| 6:30 AM | Sync Chi Phí TikTok | Lấy chi phí ngày hôm qua |
| 8:00 - 22:00 (mỗi 30 phút) | Kiểm tra Alerts | Tạo cảnh báo cho ad groups cần chú ý |

**⚡ Nhân viên ads chỉ cần:**
1. Tạo Ad Account + Import Ad Groups (1 lần)
2. Xem cảnh báo và gợi ý hàng ngày
3. Điều chỉnh budget trên nền tảng (Facebook/Google/TikTok)

---

## ⚠️ Lưu Ý Quan Trọng

### ✅ NÊN làm:
- Kiểm tra alerts ít nhất 3 lần/ngày (sáng, trưa, chiều)
- Xử lý alert CRITICAL trong vòng 30 phút
- Ghi chép lại mọi thay đổi đã thực hiện
- Báo cáo Manager khi có vấn đề lớn
- Đọc lý do gợi ý trước khi hành động

### ❌ KHÔNG NÊN làm:
- Bỏ qua alerts CRITICAL
- Tự ý scale ad group mà không check gợi ý
- Thay đổi budget quá 30% một lần
- Quên báo cáo cuối ngày

---

## 📞 Liên Hệ Hỗ Trợ

- **Vấn đề kỹ thuật hệ thống**: Liên hệ IT
- **Vấn đề về ads, budget**: Liên hệ Manager
- **Vấn đề về KPI, target**: Liên hệ Director

---

## 📝 Checklist Hàng Ngày

### Thiết lập ban đầu (1 lần):
```
☐ Tạo Ad Account trong hệ thống
☐ Cấu hình token API trong "Cài Đặt API"
☐ Discover và Import Ad Groups
```

### Công việc hàng ngày:
```
☐ 8:00  - Đăng nhập hệ thống
☐ 8:00  - Check notification bell
☐ 8:15  - Xử lý alerts CRITICAL (nếu có)
☐ 8:30  - Xem tab "Gợi ý chi phí"
☐ 9:00  - Điều chỉnh budget trên Facebook
☐ 9:30  - Điều chỉnh budget trên Google
☐ 10:00 - Điều chỉnh budget trên TikTok
☐ 10:30 - Review hiệu suất ad groups
☐ 11:30 - Báo cáo sáng cho Manager

☐ 13:00 - Check alerts lần 2
☐ 13:30 - Tối ưu ad groups (creative, targeting)
☐ 15:00 - Check alerts lần 3
☐ 16:00 - Kiểm tra trạng thái sync
☐ 17:00 - Tổng hợp báo cáo ngày
☐ 17:30 - Gửi báo cáo cuối ngày
```

---

*Tài liệu này được cập nhật định kỳ. Nếu có thắc mắc, vui lòng liên hệ Manager.*
