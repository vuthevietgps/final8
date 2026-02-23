# 💡 Đề Xuất: Order-Level Payment Tracking

## 🎯 Vấn Đề Hiện Tại

**Statement-based approach (hiện tại):**
- Quản lý thanh toán theo KỲ (period-based)
- Phức tạp, cần tạo statement trước
- Khó tracking từng đơn hàng
- Phù hợp cho kế toán chặt chẽ

**Nhu cầu thực tế:**
- ✅ Biết đơn nào đã/chưa thanh toán NCC
- ✅ Biết đơn nào đã/chưa thanh toán Agent
- ✅ Xuất danh sách đơn theo lượt thanh toán
- ✅ Đơn giản, dễ sử dụng hàng ngày

---

## 💡 Giải Pháp: Order-Level Payment Tracking

### Schema Changes

Thêm vào `TestOrder2`:

```typescript
// ============ PAYMENT TRACKING ============

// Trạng thái thanh toán nhà cung cấp
@Prop({ 
  type: String, 
  enum: ['pending', 'paid'], 
  default: 'pending',
  index: true 
})
supplierPaymentStatus?: string;  // 'pending' = Chưa thanh toán, 'paid' = Đã thanh toán

// Thông tin thanh toán NCC
@Prop({ type: String })
supplierPaymentBatchId?: string;  // Mã lượt thanh toán NCC (VD: "NCC-2026-01-001")

@Prop({ type: Date })
supplierPaidAt?: Date;  // Ngày thanh toán NCC

@Prop({ type: Number })
supplierPaidAmount?: number;  // Số tiền thực tế trả NCC (có thể khác supplierQuote)

@Prop({ type: String })
supplierPaymentNote?: string;  // Ghi chú thanh toán NCC

// Trạng thái thanh toán đại lý
@Prop({ 
  type: String, 
  enum: ['pending', 'paid'], 
  default: 'pending',
  index: true 
})
agentPaymentStatus?: string;  // 'pending' = Chưa thanh toán, 'paid' = Đã thanh toán

// Thông tin thanh toán Agent
@Prop({ type: String })
agentPaymentBatchId?: string;  // Mã lượt thanh toán Agent (VD: "AGENT-2026-01-001")

@Prop({ type: Date })
agentPaidAt?: Date;  // Ngày thanh toán Agent

@Prop({ type: Number })
agentPaidAmount?: number;  // Số tiền hoa hồng đã trả (thường = agentQuote - agentAppliedPrice)

@Prop({ type: String })
agentPaymentNote?: string;  // Ghi chú thanh toán Agent
```

---

## 🔄 Workflow Mới

### 1. Đơn Hàng Mới
```typescript
{
  supplierQuote: 150000,
  agentQuote: 200000,
  supplierPaymentStatus: 'pending',  // Chưa thanh toán
  agentPaymentStatus: 'pending'      // Chưa thanh toán
}
```

### 2. Thanh Toán NCC (Ngày 10)

**Bước 1:** Query các đơn chưa thanh toán
```typescript
GET /test-order2?supplierPaymentStatus=pending&orderStatus=Giao thành công
```

**Bước 2:** Tạo batch thanh toán
```typescript
POST /test-order2/supplier-payment-batch
{
  orderIds: ['order1', 'order2', 'order3'],
  batchId: 'NCC-2026-01-001',
  paidDate: '2026-01-10',
  note: 'Thanh toán chu kỳ 01-10/01/2026'
}
```

**Kết quả:** Các đơn được cập nhật
```typescript
{
  supplierPaymentStatus: 'paid',
  supplierPaymentBatchId: 'NCC-2026-01-001',
  supplierPaidAt: '2026-01-10',
  supplierPaidAmount: 150000
}
```

### 3. Thanh Toán Agent (Ngày 11)

**Query các đơn:**
```typescript
GET /test-order2?agentPaymentStatus=pending&supplierPaymentStatus=paid
// Chỉ trả agent sau khi đã nhận tiền từ NCC
```

**Tạo batch:**
```typescript
POST /test-order2/agent-payment-batch
{
  orderIds: ['order1', 'order2'],
  batchId: 'AGENT-2026-01-001',
  paidDate: '2026-01-11'
}
```

---

## 📊 API Endpoints Mới

### 1. Query Orders by Payment Status

```typescript
GET /test-order2/payment-pending/supplier
// Trả về các đơn chưa thanh toán NCC

GET /test-order2/payment-pending/agent
// Trả về các đơn chưa thanh toán Agent
```

### 2. Create Payment Batch

```typescript
POST /test-order2/supplier-payment-batch
Body: {
  orderIds: string[],
  batchId: string,
  paidDate: string,
  paidAmount?: number,  // Optional: override individual amounts
  note?: string
}

POST /test-order2/agent-payment-batch
Body: {
  orderIds: string[],
  batchId: string,
  paidDate: string,
  note?: string
}
```

### 3. Get Payment Batches

```typescript
GET /test-order2/payment-batches/supplier
// Trả về danh sách các lượt thanh toán NCC

GET /test-order2/payment-batches/agent
// Trả về danh sách các lượt thanh toán Agent
```

### 4. Export Payment Batch

```typescript
GET /test-order2/payment-batch/:batchId/export
// Export Excel/CSV các đơn trong lượt thanh toán
```

---

## 🎨 UI Changes

### Supplier Payment Page

```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Thanh Toán Nhà Cung Cấp                                  │
│                                                               │
│ Lọc: [NCC ▼] [Từ ngày] [Đến ngày] [Trạng thái ▼] [Tìm]     │
│                                                               │
│ ☑ Chọn tất cả đơn chưa thanh toán (50 đơn)                  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑ #ORD001 │ NCC A │ 150,000 │ 10/01 │ 🟡 Chưa TT │      │ │
│ │ ☑ #ORD002 │ NCC A │ 200,000 │ 10/01 │ 🟡 Chưa TT │      │ │
│ │ ☐ #ORD003 │ NCC B │ 180,000 │ 10/01 │ 🟢 Đã TT   │      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ Đã chọn: 2 đơn │ Tổng: 350,000 đ                            │
│                                                               │
│ [💰 Thanh Toán Các Đơn Đã Chọn]                              │
└─────────────────────────────────────────────────────────────┘
```

### Payment Batch Modal

```
┌────────────────────────────────────────┐
│ 💰 Tạo Lượt Thanh Toán NCC            │
├────────────────────────────────────────┤
│                                        │
│ Mã lượt: [NCC-2026-01-001]            │
│ Ngày TT: [10/01/2026]                 │
│ Ghi chú: [Thanh toán chu kỳ 01-10]   │
│                                        │
│ ────────────────────────────────────  │
│ Đơn hàng đã chọn:                     │
│                                        │
│ 1. #ORD001 - 150,000 đ               │
│ 2. #ORD002 - 200,000 đ               │
│                                        │
│ ────────────────────────────────────  │
│ Tổng: 350,000 đ                       │
│                                        │
│     [Hủy]  [✅ Xác Nhận Thanh Toán]   │
└────────────────────────────────────────┘
```

### Payment History

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Lịch Sử Thanh Toán NCC                                   │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NCC-2026-01-001 │ 10/01 │ 5 đơn │ 1,500,000 │ [📄 PDF] │ │
│ │ NCC-2026-01-002 │ 20/01 │ 8 đơn │ 2,300,000 │ [📄 PDF] │ │
│ │ NCC-2026-01-003 │ 30/01 │ 6 đơn │ 1,800,000 │ [📄 PDF] │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 💪 Ưu Điểm

### 1. Đơn Giản
- ✅ Không cần tạo statement phức tạp
- ✅ Query trực tiếp: "Đơn nào chưa thanh toán?"
- ✅ Dễ hiểu cho người dùng

### 2. Linh Hoạt
- ✅ Có thể thanh toán từng đơn hoặc theo batch
- ✅ Có thể thanh toán không theo chu kỳ cố định
- ✅ Dễ xử lý các trường hợp đặc biệt

### 3. Tracking Tốt
- ✅ Biết chính xác đơn nào đã/chưa thanh toán
- ✅ Có mã batch để xuất báo cáo
- ✅ Có timestamp chính xác

### 4. Reporting
- ✅ Export theo batch
- ✅ Thống kê theo NCC/Agent
- ✅ Dashboard rõ ràng

---

## ⚠️ So Sánh Với Statement-Based

| Tiêu chí | Order-Level ✅ | Statement-Based |
|----------|----------------|-----------------|
| **Đơn giản** | ⭐⭐⭐⭐⭐ Rất đơn giản | ⭐⭐⭐ Phức tạp hơn |
| **Linh hoạt** | ⭐⭐⭐⭐⭐ Rất linh hoạt | ⭐⭐⭐ Phải theo period |
| **Tracking** | ⭐⭐⭐⭐⭐ Theo từng đơn | ⭐⭐⭐⭐ Theo kỳ |
| **Báo cáo** | ⭐⭐⭐⭐ Theo batch | ⭐⭐⭐⭐⭐ Biên bản kỳ |
| **Kế toán** | ⭐⭐⭐ Đủ dùng | ⭐⭐⭐⭐⭐ Chuẩn mực |

---

## 🎯 Khuyến Nghị

### Giải Pháp Hybrid (Tốt Nhất) ⭐⭐⭐⭐⭐

**Dùng CẢ HAI:**
1. **Order-level tracking** (hàng ngày):
   - Đánh dấu đơn đã/chưa thanh toán
   - Tạo batch thanh toán nhanh
   - Query dễ dàng

2. **Statement-based** (định kỳ):
   - Tạo biên bản đối soát chính thức
   - Chốt sổ cuối kỳ
   - Lưu trữ lâu dài

**Flow:**
```
1. Ngày 1-9: Đơn hàng phát sinh
2. Ngày 10: 
   - Tạo payment batch (order-level)
   - Đánh dấu các đơn = 'paid'
   - Tạo statement (period-based) từ batch
3. Export cả 2: Batch list & Statement PDF
```

---

## 🚀 Implementation Steps

### Phase 1: Add Fields to Schema ✅
```bash
# Chỉ cần thêm fields, không breaking change
- supplierPaymentStatus
- agentPaymentStatus
- supplierPaymentBatchId, agentPaymentBatchId
- supplierPaidAt, agentPaidAt
```

### Phase 2: Create Payment Batch APIs
```bash
- POST /test-order2/supplier-payment-batch
- POST /test-order2/agent-payment-batch
- GET /test-order2/payment-batches/supplier
- GET /test-order2/payment-batches/agent
```

### Phase 3: Update Frontend
```bash
- Payment management page
- Batch creation modal
- Payment history view
- Export functionality
```

### Phase 4: Migration (Optional)
```bash
# Sync existing data với statement hiện có
- Đơn trong statement closed → mark as 'paid'
- Gán batchId từ statement._id
```

---

## 📝 Code Implementation

Xem file implementation chi tiết:
- [ORDER-LEVEL-PAYMENT-IMPLEMENTATION.md](./ORDER-LEVEL-PAYMENT-IMPLEMENTATION.md)

---

## ✅ Kết Luận

**Order-level payment tracking** là giải pháp:
- ✅ **Đơn giản hơn** statement-based
- ✅ **Linh hoạt hơn** cho operations hàng ngày
- ✅ **Dễ implement** và maintain
- ✅ **Đáp ứng đủ** nhu cầu tracking và reporting

Có thể kết hợp với statement-based để có báo cáo kế toán chuẩn mực!
