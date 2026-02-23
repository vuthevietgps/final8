# 🚀 Order-Level Payment Implementation - Complete Guide

## ✅ Đã Implement

### Backend Changes

#### 1. Schema Updates ✅
**File**: `backend/src/test-order2/schemas/test-order2.schema.ts`

Đã thêm các trường:
```typescript
// Supplier payment tracking
supplierPaymentStatus: 'pending' | 'paid'  // Default: 'pending'
supplierPaymentBatchId: string              // VD: "SUPP-2026-01-001"
supplierPaidAt: Date
supplierPaidAmount: number
supplierPaymentNote: string

// Agent payment tracking
agentPaymentStatus: 'pending' | 'paid' | 'n/a'  // Default: 'n/a'
agentPaymentBatchId: string                      // VD: "AGENT-2026-01-001"
agentPaidAt: Date
agentPaidAmount: number  // Commission amount
agentPaymentNote: string
```

#### 2. DTOs ✅
**File**: `backend/src/test-order2/dto/payment-batch.dto.ts`

- `CreateSupplierPaymentBatchDto`
- `CreateAgentPaymentBatchDto`
- `PaymentBatchSummary`

#### 3. Service Methods ✅
**File**: `backend/src/test-order2/test-order2.service.ts`

Đã thêm:
- `createSupplierPaymentBatch()` - Tạo lượt thanh toán NCC
- `createAgentPaymentBatch()` - Tạo lượt thanh toán Agent
- `getOrdersPendingSupplierPayment()` - Lấy đơn chưa thanh toán NCC
- `getOrdersPendingAgentPayment()` - Lấy đơn chưa thanh toán Agent
- `getSupplierPaymentBatches()` - Lấy danh sách lượt thanh toán NCC
- `getAgentPaymentBatches()` - Lấy danh sách lượt thanh toán Agent
- `getOrdersInBatch()` - Lấy đơn trong 1 lượt thanh toán

#### 4. API Endpoints ✅
**File**: `backend/src/test-order2/test-order2.controller.ts`

```
GET  /test-order2/payment-pending/supplier
GET  /test-order2/payment-pending/agent
POST /test-order2/supplier-payment-batch
POST /test-order2/agent-payment-batch
GET  /test-order2/payment-batches/supplier
GET  /test-order2/payment-batches/agent
GET  /test-order2/payment-batch/:batchId/:type
```

---

## 📖 API Usage Guide

### 1. Get Orders Pending Supplier Payment

**Request:**
```bash
GET http://localhost:3000/test-order2/payment-pending/supplier?supplierId=123&orderStatus=Giao%20thành%20công
```

**Response:**
```json
{
  "orders": [
    {
      "_id": "ord001",
      "customerName": "Nguyễn Văn A",
      "supplierQuote": 150000,
      "supplierPaymentStatus": "pending",
      "orderStatus": "Giao thành công",
      "orderDate": "2026-01-05"
    }
  ],
  "count": 5,
  "totalAmount": 750000
}
```

### 2. Create Supplier Payment Batch

**Request:**
```bash
POST http://localhost:3000/test-order2/supplier-payment-batch
Content-Type: application/json

{
  "orderIds": ["ord001", "ord002", "ord003"],
  "batchId": "SUPP-2026-01-001",
  "paidDate": "2026-01-10",
  "note": "Thanh toán chu kỳ 01-10/01/2026"
}
```

**Response:**
```json
{
  "batchId": "SUPP-2026-01-001",
  "paidDate": "2026-01-10T00:00:00.000Z",
  "orderCount": 3,
  "totalAmount": 450000,
  "note": "Thanh toán chu kỳ 01-10/01/2026"
}
```

**Kết quả:** Các đơn được cập nhật:
```json
{
  "supplierPaymentStatus": "paid",
  "supplierPaymentBatchId": "SUPP-2026-01-001",
  "supplierPaidAt": "2026-01-10",
  "supplierPaidAmount": 150000,
  "supplierPaymentNote": "Thanh toán chu kỳ 01-10/01/2026"
}
```

### 3. Get Payment Batches

**Request:**
```bash
GET http://localhost:3000/test-order2/payment-batches/supplier
```

**Response:**
```json
[
  {
    "batchId": "SUPP-2026-01-003",
    "paidDate": "2026-01-30",
    "orderCount": 8,
    "totalAmount": 2400000,
    "note": "Thanh toán cuối tháng"
  },
  {
    "batchId": "SUPP-2026-01-002",
    "paidDate": "2026-01-20",
    "orderCount": 6,
    "totalAmount": 1800000
  },
  {
    "batchId": "SUPP-2026-01-001",
    "paidDate": "2026-01-10",
    "orderCount": 5,
    "totalAmount": 1500000
  }
]
```

### 4. Get Orders in Batch

**Request:**
```bash
GET http://localhost:3000/test-order2/payment-batch/SUPP-2026-01-001/supplier
```

**Response:**
```json
[
  {
    "_id": "ord001",
    "customerName": "Nguyễn Văn A",
    "supplierQuote": 150000,
    "supplierPaymentStatus": "paid",
    "supplierPaymentBatchId": "SUPP-2026-01-001",
    "supplierPaidAt": "2026-01-10",
    "supplierPaidAmount": 150000
  }
]
```

---

## 🎨 Frontend Implementation (Next Step)

### Component Structure

```
frontend/src/app/features/payment-management/
├── supplier-payment/
│   ├── supplier-payment.component.ts
│   ├── supplier-payment.component.html
│   ├── supplier-payment.component.css
│   └── supplier-payment.service.ts
├── agent-payment/
│   ├── agent-payment.component.ts
│   ├── agent-payment.component.html
│   ├── agent-payment.component.css
│   └── agent-payment.service.ts
└── models/
    └── payment.model.ts
```

### Supplier Payment Component (Pseudo-code)

```typescript
@Component({
  selector: 'app-supplier-payment',
  templateUrl: './supplier-payment.component.html'
})
export class SupplierPaymentComponent {
  pendingOrders: Order[] = [];
  selectedOrders: Order[] = [];
  batches: PaymentBatch[] = [];
  
  async ngOnInit() {
    await this.loadPendingOrders();
    await this.loadBatches();
  }
  
  async loadPendingOrders() {
    const res = await this.http.get('/test-order2/payment-pending/supplier');
    this.pendingOrders = res.orders;
  }
  
  async createBatch() {
    const batchId = this.generateBatchId(); // "SUPP-2026-01-001"
    const orderIds = this.selectedOrders.map(o => o._id);
    
    await this.http.post('/test-order2/supplier-payment-batch', {
      orderIds,
      batchId,
      paidDate: new Date(),
      note: 'Thanh toán chu kỳ'
    });
    
    await this.loadPendingOrders();
    await this.loadBatches();
    this.selectedOrders = [];
  }
  
  generateBatchId() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const seq = String(this.batches.length + 1).padStart(3, '0');
    return `SUPP-${year}-${month}-${seq}`;
  }
}
```

### HTML Template

```html
<div class="payment-page">
  <h2>📦 Thanh Toán Nhà Cung Cấp</h2>
  
  <!-- Filters -->
  <div class="filters">
    <select [(ngModel)]="supplierId">
      <option value="">Tất cả NCC</option>
      <option *ngFor="let s of suppliers" [value]="s._id">{{s.name}}</option>
    </select>
    <input type="date" [(ngModel)]="fromDate" />
    <input type="date" [(ngModel)]="toDate" />
    <button (click)="loadPendingOrders()">🔍 Lọc</button>
  </div>
  
  <!-- Pending Orders Table -->
  <div class="card">
    <h3>Đơn Hàng Chưa Thanh Toán ({{pendingOrders.length}})</h3>
    
    <table>
      <thead>
        <tr>
          <th><input type="checkbox" (change)="selectAll($event)" /></th>
          <th>Mã đơn</th>
          <th>Khách hàng</th>
          <th>NCC</th>
          <th>Số tiền</th>
          <th>Ngày đặt</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let order of pendingOrders">
          <td><input type="checkbox" [(ngModel)]="order.selected" /></td>
          <td>{{order._id}}</td>
          <td>{{order.customerName}}</td>
          <td>{{order.supplierId}}</td>
          <td>{{order.supplierQuote | number}}</td>
          <td>{{order.orderDate | date}}</td>
          <td>🟡 Chưa thanh toán</td>
        </tr>
      </tbody>
    </table>
    
    <div class="summary">
      <strong>Đã chọn: {{selectedCount}} đơn</strong>
      <strong>Tổng: {{selectedTotal | number}} đ</strong>
      <button (click)="openCreateBatchModal()" [disabled]="selectedCount === 0">
        💰 Tạo Lượt Thanh Toán
      </button>
    </div>
  </div>
  
  <!-- Payment Batches History -->
  <div class="card">
    <h3>Lịch Sử Thanh Toán</h3>
    
    <table>
      <thead>
        <tr>
          <th>Mã lượt</th>
          <th>Ngày TT</th>
          <th>Số đơn</th>
          <th>Tổng tiền</th>
          <th>Ghi chú</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let batch of batches">
          <td>{{batch.batchId}}</td>
          <td>{{batch.paidDate | date}}</td>
          <td>{{batch.orderCount}}</td>
          <td>{{batch.totalAmount | number}}</td>
          <td>{{batch.note}}</td>
          <td>
            <button (click)="viewBatch(batch)">👁️ Xem</button>
            <button (click)="exportBatch(batch)">📄 Xuất</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 🔄 Workflow Example

### Scenario: Thanh toán NCC ngày 10

#### Step 1: Query pending orders
```bash
GET /test-order2/payment-pending/supplier?orderStatus=Giao%20thành%20công
```
→ Nhận 50 đơn chưa thanh toán

#### Step 2: Select orders
User chọn 20 đơn từ NCC A

#### Step 3: Create batch
```bash
POST /test-order2/supplier-payment-batch
{
  "orderIds": ["ord001", "ord002", ...],
  "batchId": "SUPP-2026-01-002",
  "paidDate": "2026-01-10",
  "note": "Thanh toán 20 đơn NCC A"
}
```

#### Step 4: Verify
```bash
GET /test-order2/payment-batch/SUPP-2026-01-002/supplier
```
→ Xem danh sách 20 đơn đã thanh toán

#### Step 5: Export (Optional)
Export Excel/CSV để lưu trữ

---

## 📊 Database Query Examples

### Query đơn chưa thanh toán NCC
```javascript
db.ordertest2.find({
  supplierPaymentStatus: "pending",
  supplierId: { $exists: true, $ne: null },
  orderStatus: "Giao thành công"
})
```

### Thống kê theo NCC
```javascript
db.ordertest2.aggregate([
  { $match: { supplierPaymentStatus: "pending" } },
  {
    $group: {
      _id: "$supplierId",
      totalOrders: { $sum: 1 },
      totalAmount: { $sum: "$supplierQuote" }
    }
  }
])
```

### Lịch sử thanh toán
```javascript
db.ordertest2.aggregate([
  { $match: { supplierPaymentBatchId: { $exists: true } } },
  {
    $group: {
      _id: "$supplierPaymentBatchId",
      paidDate: { $first: "$supplierPaidAt" },
      count: { $sum: 1 },
      total: { $sum: "$supplierPaidAmount" }
    }
  },
  { $sort: { paidDate: -1 } }
])
```

---

## ✅ Migration Script (Optional)

Nếu có dữ liệu cũ, chạy script sync với statement hiện có:

```javascript
// backend/scripts/migrate-payment-status.js
const mongoose = require('mongoose');

async function migrate() {
  // Connect to DB
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Get all statements
  const statements = await mongoose.model('SupplierStatement').find({
    status: 'closed'
  });
  
  for (const statement of statements) {
    const batchId = `SUPP-MIGRATED-${statement._id}`;
    
    // Update orders in this statement
    await mongoose.model('TestOrder2').updateMany(
      {
        supplierId: statement.supplierId,
        orderDate: {
          $gte: statement.periodFrom,
          $lte: statement.periodTo
        }
      },
      {
        $set: {
          supplierPaymentStatus: 'paid',
          supplierPaymentBatchId: batchId,
          supplierPaidAt: statement.periodTo,
          supplierPaidAmount: '$supplierQuote'
        }
      }
    );
  }
  
  console.log('Migration completed!');
}

migrate();
```

---

## 🎯 Next Steps

### Priority 1: Frontend UI
- [ ] Create supplier payment component
- [ ] Create agent payment component
- [ ] Add to sidebar navigation
- [ ] Implement batch creation modal

### Priority 2: Export Feature
- [ ] Export batch to Excel
- [ ] Export batch to PDF
- [ ] Email batch report

### Priority 3: Advanced Features
- [ ] Auto-generate batch ID
- [ ] Bulk update payment status
- [ ] Payment reminders
- [ ] Dashboard statistics

### Priority 4: Integration
- [ ] Sync with finance module
- [ ] Update capital allocation
- [ ] Integrate with statement-based

---

## 📝 Testing Checklist

- [ ] Create supplier payment batch
- [ ] Create agent payment batch
- [ ] Query pending orders
- [ ] View batch details
- [ ] Filter by supplier/agent
- [ ] Filter by date range
- [ ] Verify status updates
- [ ] Test with 0 orders
- [ ] Test with large batches (100+)
- [ ] Test concurrent updates

---

## 🚨 Important Notes

### Payment Status Logic

**Supplier:**
- Default: `pending`
- After batch creation: `paid`

**Agent:**
- Default: `n/a` (no agent)
- If has agent: `pending`
- After batch creation: `paid`

### Batch ID Convention

```
SUPP-YYYY-MM-XXX  → Supplier payment
AGENT-YYYY-MM-XXX → Agent payment

Example:
SUPP-2026-01-001  → First supplier batch in Jan 2026
AGENT-2026-01-001 → First agent batch in Jan 2026
```

### Commission Calculation

```typescript
agentCommission = agentQuote - agentAppliedPrice
```

Example:
- agentQuote: 200,000 đ (price quoted to customer)
- agentAppliedPrice: 150,000 đ (actual product cost)
- Commission: 50,000 đ (what agent earned)

---

## 💡 Tips & Best Practices

1. **Always filter by orderStatus**: Chỉ thanh toán đơn "Giao thành công"
2. **Generate unique batch IDs**: Tránh trùng lặp
3. **Add notes**: Ghi chú rõ ràng cho mỗi lượt
4. **Export regularly**: Lưu trữ báo cáo định kỳ
5. **Verify before create**: Double-check số tiền trước khi tạo batch

---

## 📞 Support

Nếu có vấn đề:
1. Check API response logs
2. Verify schema fields exist
3. Check database indexes
4. Review error messages

Backend ready! Frontend implementation là bước tiếp theo! 🚀
