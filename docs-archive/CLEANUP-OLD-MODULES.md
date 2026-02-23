# 🧹 HƯỚNG DẪN XÓA CÁC MODULE CŨ

> Ngày: 25/01/2026
> Mục đích: Loại bỏ Summary4, Summary5 và các module báo cáo cũ để xây dựng lại từ OrderTest2

---

## ✅ ĐÃ HOÀN THÀNH

### Backend
- ✅ Xóa import `AdGroupProfitReportModule` khỏi app.module.ts
- ✅ Xóa import `AdGroupProfitModule` khỏi app.module.ts
- ✅ Xóa import `ProductProfitReportModule` khỏi app.module.ts
- ✅ Xóa import `Summary5Module` khỏi app.module.ts

### Frontend
- ✅ Xóa routes `ad-group-profit` khỏi app.routes.ts
- ✅ Xóa routes `ad-group-profit-report` khỏi app.routes.ts
- ✅ Xóa routes `product-profit` khỏi app.routes.ts
- ✅ Đổi redirect mặc định từ `ad-group-profit-report` → `return-report`

---

## 🗑️ CẦN XÓA THỦ CÔNG

### 1. Backend Modules (6 folders)

```bash
# Xóa các folder sau trong backend/src/

rm -rf backend/src/summary4/
rm -rf backend/src/summary5/
rm -rf backend/src/ad-group-profit/
rm -rf backend/src/ad-group-profit-report/
rm -rf backend/src/product-profit-report/
```

**Chi tiết:**
```
backend/src/
├── summary4/                           ❌ XÓA
│   └── schemas/
│       └── summary4.schema.ts
├── summary5/                           ❌ XÓA
│   ├── dto/
│   │   └── summary5-filter.dto.ts
│   ├── schemas/
│   │   └── summary5.schema.ts
│   ├── summary5.controller.ts
│   ├── summary5.module.ts
│   └── summary5.service.ts
├── ad-group-profit/                    ❌ XÓA
│   ├── dto/
│   ├── schemas/
│   ├── ad-group-profit.controller.ts
│   ├── ad-group-profit.module.ts
│   └── ad-group-profit.service.ts
├── ad-group-profit-report/             ❌ XÓA
│   ├── dto/
│   ├── ad-group-profit-report.controller.ts
│   ├── ad-group-profit-report.module.ts
│   └── ad-group-profit-report.service.ts
└── product-profit-report/              ❌ XÓA
    ├── product-profit-report.controller.ts
    ├── product-profit-report.module.ts
    └── product-profit-report.service.ts
```

### 2. Frontend Components (3 folders)

```bash
# Xóa các folder sau trong frontend/src/app/features/

rm -rf frontend/src/app/features/ad-group-profit/
rm -rf frontend/src/app/features/ad-group-profit-report/
rm -rf frontend/src/app/features/product-profit-report/
```

**Chi tiết:**
```
frontend/src/app/features/
├── ad-group-profit/                    ❌ XÓA
│   ├── ad-group-profit.component.ts
│   ├── ad-group-profit.component.html
│   ├── ad-group-profit.component.css
│   ├── ad-group-profit.service.ts
│   └── models/
├── ad-group-profit-report/             ❌ XÓA
│   ├── ad-group-profit-report.component.ts
│   ├── ad-group-profit-report.component.html
│   ├── ad-group-profit-report.component.css
│   ├── ad-group-profit-report.service.ts
│   └── models/
└── product-profit-report/              ❌ XÓA
    ├── product-profit-report.component.ts
    ├── product-profit-report.component.html
    ├── product-profit-report.component.css
    ├── product-profit-report.service.ts
    └── models/
```

### 3. Scripts và Reference Files (Optional)

```bash
# Nếu có các file reference trong backend/scripts/
rm -rf backend/scripts/dist-reference/summary4/
rm -rf backend/scripts/dist-reference/summary5/
rm -rf backend/scripts/summary4-reference/
```

---

## 📋 LỆNH TERMINAL (Copy & Paste)

### Windows PowerShell:
```powershell
# Backend
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\backend\src\summary4"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\backend\src\summary5"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\backend\src\ad-group-profit"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\backend\src\ad-group-profit-report"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\backend\src\product-profit-report"

# Frontend
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\frontend\src\app\features\ad-group-profit"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\frontend\src\app\features\ad-group-profit-report"
Remove-Item -Recurse -Force "d:\code\final8\final8-version14.0\frontend\src\app\features\product-profit-report"
```

### Linux/Mac:
```bash
# Backend
rm -rf backend/src/summary4
rm -rf backend/src/summary5
rm -rf backend/src/ad-group-profit
rm -rf backend/src/ad-group-profit-report
rm -rf backend/src/product-profit-report

# Frontend
rm -rf frontend/src/app/features/ad-group-profit
rm -rf frontend/src/app/features/ad-group-profit-report
rm -rf frontend/src/app/features/product-profit-report
```

---

## ⚠️ KIỂM TRA SAU KHI XÓA

### 1. Compile Backend
```bash
cd backend
npm run build
```

**Kết quả mong đợi:** ✅ Không có lỗi TypeScript

### 2. Compile Frontend
```bash
cd frontend
npm run build
```

**Kết quả mong đợi:** ✅ Không có lỗi Angular

### 3. Kiểm tra Runtime
```bash
# Backend
cd backend
npm run start:dev

# Frontend (terminal khác)
cd frontend
npm start
```

**Kết quả mong đợi:** 
- ✅ Backend khởi động thành công
- ✅ Frontend compile thành công
- ✅ Không có lỗi trong console
- ✅ Route `/reports` redirect đến `/reports/return-report`

---

## 🔍 XÁC NHẬN ĐÃ XÓA SẠCH

Chạy các lệnh sau để đảm bảo không còn reference:

```bash
# Kiểm tra backend
cd backend/src
grep -r "Summary5" . --exclude-dir=node_modules
grep -r "Summary4" . --exclude-dir=node_modules
grep -r "ad-group-profit" . --exclude-dir=node_modules
grep -r "product-profit-report" . --exclude-dir=node_modules

# Kiểm tra frontend
cd frontend/src
grep -r "ad-group-profit" . --exclude-dir=node_modules
grep -r "product-profit-report" . --exclude-dir=node_modules
```

**Kết quả mong đợi:** Không có kết quả nào (hoặc chỉ trong comment/documentation)

---

## 📊 DATABASE CLEANUP (Optional)

Nếu muốn xóa collection trong MongoDB:

```javascript
// Connect to MongoDB
use smarterp-dev

// Drop collections
db.summary4.drop()
db.summary5.drop()

// Verify
show collections
```

⚠️ **Cảnh báo:** Chỉ làm điều này nếu chắc chắn không cần dữ liệu cũ!

---

## ✨ BƯỚC TIẾP THEO

Sau khi xóa xong, chúng ta sẽ xây dựng lại các chức năng mới:

### 1. Báo cáo Lợi nhuận Nhóm Quảng cáo (NEW)
```
GET /api/reports/ad-group-profit
- Query trực tiếp từ TestOrder2
- Tính toán realtime
- Filter linh hoạt
```

### 2. Báo cáo Lợi nhuận Sản phẩm (NEW)
```
GET /api/reports/product-profit
- Aggregate từ TestOrder2
- Group by productId + orderDate
- Sum các cost và profit fields
```

### 3. Phân tích ROI Quảng cáo (NEW)
```
GET /api/reports/roi-analysis
- Advertising cost vs Revenue
- ROI per ad group
- Recommendations
```

### 4. Tối ưu Chi phí Quảng cáo (NEW)
```
GET /api/reports/ad-spend-optimization
- Budget allocation suggestions
- Scale up/down recommendations
- Trend analysis
```

---

## 📝 GHI CHÚ

- ✅ Module FinanceService vẫn giữ lại (có thể dùng cho các báo cáo mới)
- ✅ TestOrder2 đã có đủ dữ liệu: adCost, laborCostAllocation, otherCostAllocation, grossProfit, netProfit
- ✅ Không cần Summary5 nữa vì OrderTest2 đã store tất cả dữ liệu cần thiết
- ⚠️ Backup database trước khi drop collections (nếu có)

---

**Tạo bởi:** AI Assistant
**Ngày:** 25/01/2026
**Trạng thái:** ✅ Ready to execute
