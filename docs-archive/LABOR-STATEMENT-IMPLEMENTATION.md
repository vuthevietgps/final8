# LABOR STATEMENT - HỆ THỐNG PHIẾU THANH TOÁN LƯƠNG

## 📋 Tổng Quan

Đã chỉnh sửa module chi phí nhân công (labor-cost1) để có hệ thống phiếu thanh toán lương tương tự như:
- Supplier Payable (phiếu thanh toán NCC)
- Agent Statement (phiếu thanh toán hoa hồng đại lý)

## 🏗️ Kiến Trúc

### 1. Schema Mới

#### `LaborStatement` - Phiếu thanh toán lương
```typescript
{
  employeeId: ObjectId,          // Nhân viên
  periodFrom: Date,              // Đầu kỳ
  periodTo: Date,                // Cuối kỳ
  status: 'draft' | 'open' | 'closed',
  
  // Số tiền
  openingBalance: number,        // Nợ kỳ trước
  periodCost: number,            // Tổng lương trong kỳ
  bonus: number,                 // Thưởng
  deduction: number,             // Khấu trừ
  statementPaymentTotal: number, // Đã thanh toán
  closingBalance: number,        // Còn nợ
  
  // Metadata
  totalWorkHours: number,
  sessionCount: number,
  laborCostIds: [ObjectId],      // Danh sách phiên làm việc
  
  // Thanh toán
  payments: [LaborStatementPayment],
  
  // Tracking
  confirmedAt, confirmedBy,
  closedAt, closedBy
}
```

#### Cập nhật `LaborCost1` Schema
```typescript
{
  // ... existing fields ...
  
  statementId: ObjectId,         // Link đến statement
  paymentStatus: 'unpaid' | 'in_statement' | 'paid',
  // - unpaid: Chưa gộp vào statement
  // - in_statement: Đã gộp, chờ thanh toán
  // - paid: Đã thanh toán (statement closed)
}
```

### 2. Service Layer

**`LaborStatementService`** - Quản lý phiếu thanh toán
- `createStatement()` - Tạo phiếu mới, tự động gộp các phiên chưa thanh toán
- `confirmStatement()` - Xác nhận phiếu (draft → open)
- `addPayment()` - Thêm thanh toán, tự động close nếu đủ tiền
- `closeStatement()` - Đóng phiếu thủ công
- `reopenStatement()` - Mở lại phiếu
- `getTotalUnpaidLabor()` - **Tổng lương chưa thanh toán cho Committed Cash**

### 3. API Endpoints

#### Quản lý Statements
```
POST   /labor-cost1/statements                    - Tạo phiếu mới
GET    /labor-cost1/statements                    - Danh sách phiếu
GET    /labor-cost1/statements/:id                - Chi tiết phiếu
POST   /labor-cost1/statements/:id/confirm        - Xác nhận (draft → open)
POST   /labor-cost1/statements/:id/payments       - Thêm thanh toán
PATCH  /labor-cost1/statements/:id/close          - Đóng phiếu
PATCH  /labor-cost1/statements/:id/reopen         - Mở lại phiếu
```

#### Tổng hợp
```
GET    /labor-cost1/statements/summary/total-unpaid     - Tổng chưa thanh toán
GET    /labor-cost1/statements/summary/by-employee      - Tổng hợp theo NV
```

## 🔄 Workflow Sử Dụng

### 1. Nhân viên làm việc
```typescript
// Tạo các phiên làm việc (LaborCost1)
POST /labor-cost1
{
  userId: "employee_id",
  date: "2026-02-01",
  startTime: "08:00",
  endTime: "17:00",
  workHours: 8,
  hourlyRate: 50000,
  cost: 400000
}
```

→ Phiên có `paymentStatus: 'unpaid'`

### 2. Cuối kỳ: Tạo Statement
```typescript
POST /labor-cost1/statements
{
  employeeId: "employee_id",
  periodFrom: "2026-01-25",
  periodTo: "2026-02-01",
  bonus: 50000,        // Thưởng (optional)
  deduction: 0,        // Khấu trừ (optional)
  openingBalance: 0    // Nợ kỳ trước (optional)
}
```

**Hệ thống tự động:**
- Tìm tất cả phiên chưa thanh toán trong kỳ
- Tính tổng: `periodCost = Σ cost`
- Tính `closingBalance = openingBalance + periodCost + bonus - deduction`
- Cập nhật các phiên: `paymentStatus = 'in_statement'`
- Status = `'draft'`

### 3. Xác nhận Statement
```typescript
POST /labor-cost1/statements/:id/confirm
{
  confirmedBy: "admin"
}
```

→ Status: `draft` → `open`

### 4. Thanh toán
```typescript
POST /labor-cost1/statements/:id/payments
{
  amount: 500000,
  paidAt: "2026-02-02",
  method: "bank_transfer",
  reference: "TXN123456",
  notes: "Thanh toán lương kỳ 1"
}
```

**Hệ thống tự động:**
- Thêm payment vào mảng `payments`
- Cập nhật `statementPaymentTotal`
- Tính lại `closingBalance`
- **Nếu `closingBalance <= 0`:**
  - Status: `open` → `closed`
  - Cập nhật các phiên: `paymentStatus = 'paid'`, `paid = true`

### 5. Đóng thủ công (nếu cần)
```typescript
PATCH /labor-cost1/statements/:id/close
{
  closedBy: "admin"
}
```

## 💰 Tích Hợp Với Committed Cash

### Logic Cũ (❌ Deprecated)
```typescript
// Query trực tiếp laborcost1
db.laborcost1.aggregate([
  { $match: { paid: { $ne: true } } },
  { $group: { total: { $sum: '$cost' } } }
])
```

**Vấn đề:**
- Không biết phiên nào đã gộp vào statement
- Không theo dõi tiến trình thanh toán
- Không có audit trail

### Logic Mới (✅ Recommended)
```typescript
// Query từ laborstatements
db.laborstatements.aggregate([
  { $match: { status: { $in: ['draft', 'open'] } } },
  { $group: { total: { $sum: '$closingBalance' } } }
])
```

**Ưu điểm:**
- Chỉ tính statements chưa đóng
- `closingBalance` = số tiền thực sự còn nợ (đã trừ payments)
- Có tracking đầy đủ

### Cập Nhật Code

#### `FinanceService.calculateReservedOperatingCapital()`
```typescript
// Thay đổi từ query laborcost1 → laborstatements
const unpaidLaborCostResult = await this.orderModel.db
  .collection('laborstatements')
  .aggregate([
    { $match: { status: { $in: ['draft', 'open'] } } },
    { $group: { _id: null, total: { $sum: '$closingBalance' } } }
  ]);
```

#### `FundsService.computeCommittedCashFund()`
```typescript
// Tương tự, query từ laborstatements
const unpaidLaborResult = await this.orderModel.db
  .collection('laborstatements')
  .aggregate([
    { $match: { status: { $in: ['draft', 'open'] } } },
    { $group: { _id: null, total: { $sum: '$closingBalance' } } }
  ]);
```

## 📊 Báo Cáo

### Tổng lương chưa thanh toán
```bash
GET /labor-cost1/statements/summary/total-unpaid
# Response: 1500000
```

→ Dùng cho Committed Cash calculation

### Tổng hợp theo nhân viên
```bash
GET /labor-cost1/statements/summary/by-employee
```

```json
[
  {
    "employeeId": "...",
    "employeeName": "Nguyễn Văn A",
    "totalStatements": 3,
    "totalPeriodCost": 4500000,
    "totalPaid": 3000000,
    "totalOwed": 1500000,
    "openStatements": 1
  }
]
```

## ✅ Lợi Ích

### 1. Quản Lý Chặt Chẽ
- ✅ Biết chính xác phiên nào đã thanh toán
- ✅ Tracking payments theo kỳ
- ✅ Audit trail đầy đủ

### 2. Tích Hợp Committed Cash
- ✅ Chỉ tính statements chưa đóng
- ✅ Tính đúng số tiền còn nợ (đã trừ partial payments)
- ✅ Tránh double-count

### 3. Tương Đồng Với Hệ Thống Khác
- ✅ Giống supplier-payable (thanh toán NCC)
- ✅ Giống agent-statement (thanh toán đại lý)
- ✅ Dễ học, dễ bảo trì

### 4. Linh Hoạt
- ✅ Hỗ trợ partial payments
- ✅ Có bonus/deduction
- ✅ Có thể reopen nếu cần

## 🧪 Testing

Chạy test script:
```bash
powershell -File test-labor-statement.ps1
```

Test cases:
1. Lấy danh sách statements
2. Tạo statement mới
3. Xem chi tiết
4. Confirm statement
5. Thêm thanh toán
6. Tổng lương chưa thanh toán
7. Tổng hợp theo nhân viên
8. Kiểm tra Committed Cash Fund

## 📝 Database Collections

### Trước
```
laborcost1: [
  { userId, date, workHours, cost, paid: false }
]
```

### Sau
```
laborcost1: [
  { 
    userId, date, workHours, cost, 
    paid: false,
    paymentStatus: 'in_statement',
    statementId: ObjectId
  }
]

laborstatements: [
  {
    employeeId, periodFrom, periodTo,
    status: 'open',
    periodCost: 2400000,
    statementPaymentTotal: 1000000,
    closingBalance: 1400000,
    payments: [
      { amount: 1000000, paidAt, method, reference }
    ],
    laborCostIds: [ObjectId, ObjectId, ...]
  }
]
```

## 🚀 Triển Khai

Code đã hoàn thành:
- ✅ Schema: `labor-statement.schema.ts`
- ✅ DTOs: `create-labor-statement.dto.ts`, `add-labor-payment.dto.ts`
- ✅ Service: `labor-statement.service.ts`
- ✅ Controller: Đã thêm endpoints vào `labor-cost1.controller.ts`
- ✅ Module: Đã cập nhật `labor-cost1.module.ts`
- ✅ Finance Integration: Đã cập nhật `finance.service.ts` và `funds.service.ts`
- ✅ Test Script: `test-labor-statement.ps1`

**Backend sẽ tự động reload sau khi save file.**

Kiểm tra routes:
```bash
# Check logs trong terminal Backend
# Tìm dòng: [RouterExplorer] Mapped {/labor-cost1/statements, ...
```
