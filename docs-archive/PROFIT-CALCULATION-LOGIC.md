# 📊 LOGIC TÍNH LỢI NHUẬN - PHÂN BIỆT LOẠI ĐẠI LÝ

## 🎯 Tổng Quan

Hệ thống tính lợi nhuận gộp (Gross Profit) khác nhau tùy theo **loại đại lý**:

- **Đại lý ngoài (External Agent)**: Phải trả hoa hồng
- **Đại lý nội bộ (Internal Agent)**: Không trả hoa hồng, nhận lương cố định
- **Không có đại lý**: Đơn trực tiếp

---

## 💰 Công Thức Tính Lợi Nhuận Gộp

### 1️⃣ **Đại Lý Ngoài (External Agent)**

```typescript
Gross Profit = COD thu được
               - (Báo giá Đại lý × Số lượng)
               - Phí vận chuyển
               - Phí hoàn hàng
               - (Chi phí NCC × Số lượng)
```

**Ví dụ:**
```
COD thu được:         500,000 đ
Báo giá ĐL:          -400,000 đ (× 1)
Phí ship:             -30,000 đ
Phí hoàn:                  0 đ
Chi phí NCC:         -250,000 đ (× 1)
─────────────────────────────────
Lợi nhuận gộp:       -180,000 đ ❌ LỖ!

→ Cần tăng giá bán hoặc giảm chi phí
```

---

### 2️⃣ **Đại Lý Nội Bộ (Internal Agent) / Không Có Đại Lý**

```typescript
Gross Profit = COD thu được
               - (Chi phí NCC × Số lượng)
               - Phí vận chuyển
               - Phí hoàn hàng

// KHÔNG TRỪ báo giá đại lý!
// Đại lý nội bộ nhận lương cố định, không hưởng hoa hồng theo đơn
```

**Ví dụ:**
```
COD thu được:         500,000 đ
Chi phí NCC:         -250,000 đ (× 1)
Phí ship:             -30,000 đ
Phí hoàn:                  0 đ
─────────────────────────────────
Lợi nhuận gộp:        220,000 đ ✅ LÃI!
```

---

## 🔄 Điều Kiện Tính Toán

### ✅ **Các Trạng Thái Cho Phép Tính**

1. **Giao thành công**
   - COD = số tiền thực tế thu được
   - Tính đầy đủ theo công thức

2. **Hàng hoàn**
   - COD = 0 (không thu được tiền)
   - Lợi nhuận thường âm do vẫn phải trả phí

### ⏳ **Các Trạng Thái Chưa Xác Định**

- Chưa có mã vận đơn
- Đang giao hàng
- Chờ lấy hàng
- ...

**→ Gross Profit = 0** (chưa xác định được)

---

## 📈 Công Thức Lợi Nhuận Thuần

```typescript
Net Profit = Gross Profit
             - Chi phí quảng cáo phân bổ
             - Chi phí nhân công phân bổ
             - Chi phí khác phân bổ
```

**Áp dụng cho cả 2 loại đại lý.**

---

## 🔍 Implementation

### Backend Logic

```typescript
async calculateGrossProfit(order: TestOrder2Document): Promise<number> {
  // 1. Kiểm tra trạng thái đơn hàng
  if (!['Giao thành công', 'Hàng hoàn'].includes(order.orderStatus)) {
    return 0; // Chưa xác định
  }

  // 2. Lấy thông tin đại lý
  let isExternalAgent = false;
  if (order.agentId) {
    const agent = await this.model.db.collection('users').findOne({ _id: order.agentId });
    isExternalAgent = agent?.role === 'external_agent';
  }

  // 3. Tính toán
  const cod = order.codAmount || 0;
  const qty = order.quantity || 1;
  const shipping = order.shippingFee || 0;
  const returnFee = order.returnFee || 0;
  const supplierCost = order.supplierQuote || 0;
  const agentQuote = order.agentQuote || 0;

  if (isExternalAgent) {
    // Đại lý ngoài: trừ cả agentQuote
    return cod - (agentQuote * qty) - shipping - returnFee - (supplierCost * qty);
  } else {
    // Đại lý nội bộ / Không có đại lý: KHÔNG trừ agentQuote
    return cod - (supplierCost * qty) - shipping - returnFee;
  }
}
```

---

## 📊 So Sánh 2 Loại Đại Lý

| Tiêu chí | Đại lý ngoài | Đại lý nội bộ |
|----------|-------------|---------------|
| **Hưởng hoa hồng** | ✅ Có (theo đơn) | ❌ Không |
| **Chi phí nhân công** | ❌ Không tính | ✅ Có (lương cố định) |
| **Công thức GP** | Trừ agentQuote | KHÔNG trừ agentQuote |
| **Trạng thái thanh toán** | agentPaymentStatus | N/A |
| **Phiếu thanh toán** | Có | Không |

---

## ✅ Test Cases

### Test 1: External Agent - Giao thành công
```
Order:
  - agentId: user123 (role: external_agent)
  - orderStatus: "Giao thành công"
  - codAmount: 500,000
  - agentQuote: 400,000
  - quantity: 1
  - supplierQuote: 250,000
  - shippingFee: 30,000
  - returnFee: 0

Expected grossProfit:
  = 500,000 - (400,000 × 1) - 30,000 - 0 - (250,000 × 1)
  = 500,000 - 400,000 - 30,000 - 250,000
  = -180,000 ❌ (LỖ)
```

### Test 2: Internal Agent - Giao thành công
```
Order:
  - agentId: user456 (role: internal_agent)
  - orderStatus: "Giao thành công"
  - codAmount: 500,000
  - agentQuote: 400,000 (IGNORED)
  - quantity: 1
  - supplierQuote: 250,000
  - shippingFee: 30,000
  - returnFee: 0

Expected grossProfit:
  = 500,000 - (250,000 × 1) - 30,000 - 0
  = 500,000 - 250,000 - 30,000
  = 220,000 ✅ (LÃI)
```

### Test 3: Hàng hoàn (bất kỳ loại đại lý)
```
Order:
  - orderStatus: "Hàng hoàn"
  - codAmount: 0
  - supplierQuote: 250,000
  - quantity: 1
  - shippingFee: 30,000
  - returnFee: 50,000

Expected grossProfit (Internal):
  = 0 - (250,000 × 1) - 30,000 - 50,000
  = -330,000 ❌ (LỖ nặng)
```

### Test 4: Đang giao hàng (chưa xác định)
```
Order:
  - orderStatus: "Đang giao hàng"

Expected grossProfit:
  = 0 (chưa xác định)
```

---

## 🎯 Kết Luận

1. **Đại lý ngoài** = chi phí theo đơn (hoa hồng) → Trừ vào lợi nhuận
2. **Đại lý nội bộ** = chi phí cố định (lương) → KHÔNG trừ vào lợi nhuận đơn hàng, đã tính trong `laborCostAllocation`
3. Chỉ tính lợi nhuận khi đơn hàng **đã kết thúc** (giao thành công hoặc hoàn)
4. Các trạng thái khác → Lợi nhuận = 0 (chưa xác định)
