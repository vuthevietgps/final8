# 📊 Hướng Dẫn Sử Dụng Công Nợ Nhà Cung Cấp (Cải Tiến)

## 🎯 Tính Năng Mới

### ✅ **1. Modal Thanh Toán Kỳ**
- **Trước**: Form phức tạp với nhiều input trong table
- **Sau**: Modal riêng biệt, form rõ ràng, dễ sử dụng

**Các trường:**
- Số tiền thanh toán (required)
- Ngày thanh toán (required)
- Phương thức: Chuyển khoản / Tiền mặt / Bù trừ
- Mã giao dịch / Số phiếu
- Ghi chú
- Upload chứng từ (ảnh/PDF, tối đa 5 files)
- Hoặc nhập link chứng từ (Google Drive, Dropbox...)

**Cách dùng:**
1. Click nút **💰 Thanh toán** trên dòng kỳ đối soát
2. Nhập thông tin trong modal
3. Upload file hoặc paste link chứng từ
4. Click **✅ Xác nhận thanh toán**

### ✅ **2. Xác Nhận Trước Khi Chốt Kỳ**
- **Modal cảnh báo** trước khi chốt kỳ không thể hoàn tác
- Hiển thị:
  - ⚠️ Cảnh báo rõ ràng
  - Tóm tắt thông tin kỳ
  - Số dư cuối kỳ

**Cách dùng:**
1. Click nút **🔒 Chốt** trên dòng kỳ
2. Đọc cảnh báo trong modal
3. Click **🔒 Xác nhận chốt** để chốt kỳ

### ✅ **3. Export PDF Kỳ Đối Soát**
- **Endpoint**: `GET /supplier-payables/statements/:id/pdf`
- **Hiện tại**: Export HTML preview (có thể in ra PDF từ browser)
- **Nội dung**:
  - Header: Biên bản đối soát công nợ
  - Chi tiết kỳ: Opening, Payables, Payments, COD, Closing
  - Chi tiết thanh toán (nếu có)
  - Ghi chú
  - Chữ ký 2 bên (NCC & Công ty)
  - **Nút 🖨️ In biên bản** (tích hợp sẵn)
  - **Nút 💾 Tải HTML** (download file HTML)

**Cách dùng:**
1. Click nút **📄 PDF** trên dòng kỳ
2. Trang HTML mở trong tab mới
3. Click **🖨️ In biên bản** → Chọn "Save as PDF" trong Print dialog
4. Hoặc click **💾 Tải HTML** để lưu file HTML

**⚠️ Lưu ý**: Hiện tại đang export HTML (browser render). Để có file PDF thật, cần thêm library (xem phần Production TODO).

### ✅ **4. UI/UX Cải Tiến**

**Table Actions:**
```
💰 Thanh toán  → Mở modal thanh toán
📄 PDF         → Export PDF kỳ đối soát
🔒 Chốt        → Xác nhận và chốt kỳ
```

**Status Badges:**
- 🟡 **Chưa chốt** (status: open)
- 🟢 **Đã chốt** (status: closed)

**Thanh toán hiển thị:**
- Ngày | Số tiền | Mã giao dịch
- Link chứng từ (📎)

## 🛠️ Triển Khai

### Backend Changes
1. **Controller**: Thêm endpoint `GET /statements/:id/pdf`
2. **Service**: Method `generateStatementPDF(id)` → HTML report
3. DTO đã có: `documents?: string[]`

### Frontend Changes
1. **Modal thanh toán**: Form đầy đủ + file upload
2. **Modal xác nhận chốt**: Warning + summary
3. **Export PDF**: Call API endpoint
4. **CSS**: Styles cho modal, badges, buttons

## 📈 Production TODO

### 1. **PDF Generation Library**
Hiện tại: HTML report (browser render)  
Production: Dùng thư viện chuyên dụng

**Khuyến nghị:**
```bash
# Option 1: Puppeteer (Chrome headless)
npm install puppeteer

# Option 2: PDFKit (Node.js native)
npm install pdfkit

# Option 3: wkhtmltopdf (binary)
npm install wkhtmltopdf
```

**Ví dụ với Puppeteer:**
```typescript
import puppeteer from 'puppeteer';

async generateStatementPDF(id: string): Promise<Buffer> {
  const statement = await this.statementModel.findById(id);
  const html = this.buildHTML(statement);
  
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return Buffer.from(pdf);
}
```

### 2. **File Upload Storage**
Hiện tại: Placeholder `uploaded://{filename}`  
Production: Upload thật lên cloud storage

**Khuyến nghị:**
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- Cloudinary (image optimization)

**Ví dụ S3:**
```typescript
import { S3 } from 'aws-sdk';

async uploadFile(file: Express.Multer.File): Promise<string> {
  const s3 = new S3();
  const result = await s3.upload({
    Bucket: 'supplier-documents',
    Key: `payments/${Date.now()}_${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  }).promise();
  
  return result.Location; // Public URL
}
```

### 3. **Email Notification**
Gửi email khi:
- Thanh toán mới được thêm
- Kỳ đối soát được chốt
- PDF biên bản đối soát

**Ví dụ:**
```typescript
async notifyStatementClosed(statement: SupplierStatement) {
  const supplier = await this.userModel.findById(statement.supplierId);
  await this.emailService.send({
    to: supplier.email,
    subject: 'Kỳ đối soát đã được chốt',
    body: `Kỳ ${formatDate(statement.periodFrom)} - ${formatDate(statement.periodTo)} đã chốt.`,
    attachments: [
      { filename: 'statement.pdf', content: await this.generateStatementPDF(statement._id) }
    ]
  });
}
```

## 🎨 UI Customization

### Màu sắc
```css
.badge.open { background: #fef3c7; color: #92400e; } /* Yellow */
.badge.closed { background: #d1fae5; color: #065f46; } /* Green */
```

### Button styles
```css
.btn-small { padding: 4px 8px; font-size: 11px; }
.btn-primary { background: #2563eb; } /* Blue */
.btn-danger { background: #dc2626; } /* Red */
```

## 📊 Báo Cáo Bổ Sung (Future)

### 1. **Aging Report**
```
| NCC | 0-30 ngày | 31-60 | 61-90 | >90 | Tổng |
```

### 2. **Dashboard Tổng Quan**
- Tổng công nợ hiện tại
- Công nợ quá hạn
- Top 5 NCC nợ nhiều nhất
- COD chưa bù trừ

### 3. **Template Excel**
Export kỳ đối soát sang Excel với:
- Formatted table
- Charts
- Conditional formatting

## 🔐 Security Notes

1. **File Upload**:
   - Validate file type (whitelist: images, PDF)
   - Limit file size (max 5MB per file)
   - Scan for malware (ClamAV)

2. **PDF Generation**:
   - Sanitize HTML input (XSS protection)
   - Rate limiting (prevent DoS)

3. **Permissions**:
   - Chỉ role có quyền `purchase-costs` mới xem/tạo/chốt
   - Audit log cho actions quan trọng

## 📞 Support

Questions? Contact: dev@company.com
