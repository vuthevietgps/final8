# 📦 Mô Hình Kinh Doanh Dropshipping COD - Làm Rõ Luồng Tiền

## 🎯 Tổng Quan Mô Hình

### Đặc Điểm Chính
- **Loại hình**: Dropshipping với COD (Cash on Delivery)
- **Người thu tiền**: Nhà cung cấp thu COD trực tiếp
- **Ưu điểm**: Không áp lực nhập hàng, không ứng vốn trước
- **Chu kỳ thanh toán**: 10 ngày/lần đối soát

---

## 💰 Luồng Tiền Chi Tiết

```
BƯỚC 1: Khách đặt hàng
┌─────────────┐
│  Khách hàng │ (đặt hàng qua quảng cáo/agent)
└──────┬──────┘
       │ 1. Order thông tin
       ▼
┌─────────────┐
│    User     │ (chuyển thông tin cho NCC)
└──────┬──────┘
       │ 2. Thông tin đơn hàng
       ▼
┌─────────────────┐
│ Nhà cung cấp    │ (lên đơn & ship COD)
└─────────────────┘

BƯỚC 2: Giao hàng & thu tiền
┌─────────────┐
│ Khách hàng  │ (nhận hàng + trả tiền COD)
└──────┬──────┘
       │ 3. Tiền COD
       ▼
┌─────────────────┐
│ Nhà cung cấp    │ (GIỮ tiền COD)
└─────────────────┘

BƯỚC 3: Đối soát 10 ngày (hoặc theo chu kỳ)
┌─────────────────┐
│ Nhà cung cấp    │
│                 │
│ Tính toán:      │
│ • Tổng COD thu  │ = 10,000,000 đ
│ • Chi phí hàng  │ = -7,000,000 đ
│ • Phí ship      │ =   -500,000 đ
│ ─────────────── │
│ → Trả về User   │ = 2,500,000 đ (doanh thu thuần)
└──────┬──────────┘
       │ 4. Chuyển khoản doanh thu thuần
       ▼
┌─────────────┐
│    User     │ (nhận doanh thu thuần)
└──────┬──────┘
       │
       ├─► 5a. Trả hoa hồng Agent (nếu đơn của agent)
       │    Ví dụ: 250,000 đ (10% của doanh thu thuần)
       │
       └─► 5b. Phân bổ vào các quỹ
            • Quỹ tiền đặt chỗ (Reserved Capital)
            • Quỹ tái đầu tư quảng cáo (Ad Reinvestment)
            • Lợi nhuận thuần (Net Profit)
```

---

## 📊 Ví Dụ Cụ Thể

### Kỳ đối soát 01-10/01/2026

#### Dữ liệu đầu vào:
```
Đơn hàng thành công: 100 đơn
Tổng COD thu được:   10,000,000 đ
Chi phí hàng (NCC):  -7,000,000 đ
Phí ship:              -500,000 đ
─────────────────────────────────
Doanh thu thuần:      2,500,000 đ
```

#### Các đơn hàng theo loại:

| Loại đơn | Số lượng | Doanh thu thuần | Hoa hồng agent (10%) |
|----------|----------|-----------------|---------------------|
| Đơn Agent A | 30 | 750,000 đ | 75,000 đ |
| Đơn Agent B | 20 | 500,000 đ | 50,000 đ |
| Đơn trực tiếp | 50 | 1,250,000 đ | 0 đ |
| **TỔNG** | **100** | **2,500,000 đ** | **125,000 đ** |

#### Phân bổ sau khi trả agent:
```
Nhận từ NCC:        2,500,000 đ
Trả agent:           -125,000 đ
─────────────────────────────────
Còn lại phân bổ:    2,375,000 đ

Phân bổ vào quỹ:
• Reserved Capital:   950,000 đ (40%)
• Ad Reinvestment:    712,500 đ (30%)
• Net Profit:         712,500 đ (30%)
```

---

## 🔍 Phân Tích Các Chức Năng

### 1️⃣ **Thanh Toán Nhà Cung Cấp** (Supplier Settlements)

**Tên cũ**: "Công nợ nhà cung cấp" ❌  
**Tên mới**: "Thanh Toán Nhà Cung Cấp" ✅

#### Bản chất:
- **KHÔNG PHẢI** công nợ truyền thống (user không vay/mua chịu)
- NCC là người THU TIỀN COD hộ
- NCC GIỮ TIỀN và trả định kỳ
- Đây là thanh toán/đối soát, không phải nợ

#### Schema hiện tại phù hợp:
```typescript
SupplierStatement {
  openingBalance: 0            // Số dư đầu kỳ
  periodCodCollected: 10M      // COD NCC thu được
  periodPayables: 7.5M         // Chi phí hàng + phí
  statementPaymentTotal: 2.5M  // NCC đã trả về
  closingBalance: 0            // Số dư cuối kỳ
  netAfterCod: 2.5M           // ✅ Số tiền user nhận
}
```

#### Điều chỉnh cần thiết:
1. ✅ Đổi tên UI: "Thanh Toán Nhà Cung Cấp"
2. ✅ Giải thích rõ: "NCC thu COD và trả về theo chu kỳ"
3. ✅ Highlight `netAfterCod` là số tiền chính

---

### 2️⃣ **Hoa Hồng Đại Lý** (Agent Commissions)

**Tên cũ**: "Công nợ đại lý" ❌  
**Tên mới**: "Hoa Hồng Đại Lý" ✅

#### Bản chất:
- Agent tạo đơn → có hoa hồng
- User PHẢI TRẢ hoa hồng cho agent
- Đây là PAYABLES (user nợ agent)
- Nhưng tên "receivable" từ góc nhìn agent

#### Schema hiện tại phù hợp:
```typescript
AgentStatement {
  openingBalance: 0          // Nợ đầu kỳ
  periodReceivables: 125K    // Hoa hồng phát sinh
  statementPaymentTotal: 0   // User đã trả
  closingBalance: 125K       // ✅ User còn nợ agent
}
```

#### Điều chỉnh cần thiết:
1. ✅ Đổi tên UI: "Hoa Hồng Đại Lý"
2. ✅ Giải thích rõ: "Hoa hồng phải trả cho đại lý"
3. ✅ Highlight `closingBalance` là số phải trả

---

## 🎯 Workflow Tối Ưu

### Timeline 10 ngày:

```
Ngày 1-9:
├─ Đơn hàng được tạo và ship COD
├─ NCC thu tiền và ghi nhận
└─ Các đơn hoàn trả được xử lý

Ngày 10: Đối soát với NCC
├─ 1. Tạo Supplier Statement
├─ 2. NCC xác nhận và chuyển tiền
│     COD thu - Chi phí = Doanh thu thuần
│     Ví dụ: 10M - 7.5M = 2.5M
│
└─ 3. User nhận tiền vào tài khoản

Ngày 11: Thanh toán Agent
├─ 1. Tạo Agent Statement
├─ 2. Tính hoa hồng từ các đơn trong kỳ
│     Ví dụ: 2.5M × 5% = 125K
│
└─ 3. Chuyển khoản cho Agent

Ngày 12: Phân bổ quỹ
├─ 1. Số tiền còn lại = 2.5M - 125K = 2.375M
├─ 2. Phân bổ theo tỷ lệ:
│     • Reserved: 950K (40%)
│     • Reinvestment: 712.5K (30%)
│     • Profit: 712.5K (30%)
│
└─ 3. Ghi nhận vào Finance module
```

---

## ✅ Đề Xuất Thay Đổi

### 1. Supplier Module

#### Frontend (UI):
```typescript
// Sidebar
{ icon: "📦", label: "Thanh Toán NCC", route: "/suppliers/settlements" }

// Component title
<h1>Thanh Toán Nhà Cung Cấp</h1>
<p class="description">
  Quản lý đối soát và thanh toán với nhà cung cấp. 
  NCC thu COD và chuyển về doanh thu thuần theo chu kỳ 10 ngày.
</p>
```

#### Backend (terminology):
```typescript
// Keep technical names for compatibility
// But add clear comments

/**
 * SupplierStatement - Kỳ đối soát với nhà cung cấp
 * 
 * NCC thu COD hộ và giữ tiền, thanh toán định kỳ.
 * netAfterCod = COD thu - Chi phí = Doanh thu thuần
 * 
 * KHÔNG PHẢI công nợ truyền thống!
 */
```

### 2. Agent Module

#### Frontend (UI):
```typescript
// Sidebar
{ icon: "💰", label: "Hoa Hồng Đại Lý", route: "/agents/commissions" }

// Component title
<h1>Hoa Hồng Đại Lý</h1>
<p class="description">
  Quản lý hoa hồng phải trả cho đại lý. 
  Thanh toán sau khi nhận doanh thu từ nhà cung cấp.
</p>
```

#### Display changes:
```typescript
// Thay vì "Công nợ"
periodReceivables → "Hoa hồng phát sinh"
closingBalance → "Số phải trả"
statementPaymentTotal → "Đã thanh toán"
```

---

## 📝 Tóm Tắt

### Vấn đề hiện tại:
- ❌ "Công nợ NCC" → nghe như user nợ NCC
- ❌ "Công nợ Đại lý" → không rõ ràng

### Giải pháp:
- ✅ "Thanh toán NCC" → NCC trả tiền định kỳ cho user
- ✅ "Hoa hồng Đại lý" → User trả hoa hồng cho agent

### Lợi ích:
1. **Rõ ràng**: Ai trả tiền cho ai
2. **Chính xác**: Phản ánh đúng mô hình dropshipping COD
3. **Dễ hiểu**: Không gây nhầm lẫn với công nợ truyền thống

---

## 🚀 Triển Khai

Xem file [`TERMINOLOGY-REFACTORING.md`](./TERMINOLOGY-REFACTORING.md) để có hướng dẫn chi tiết về:
- [ ] Thay đổi UI/labels
- [ ] Update routing
- [ ] Thêm tooltips giải thích
- [ ] Update documentation
