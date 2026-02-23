# XỬ LÝ HOA HỒNG ÂM CHO ĐẠI LÝ NGOÀI

**Ngày:** 27/01/2026  
**Phạm vi:** External Agent Commission - Trường hợp "Hàng hoàn"

---

## 📋 NGHIỆP VỤ: ĐẠI LÝ CHỊU TRÁCH NHIỆM KHI HÀNG HOÀN

### Nguyên tắc cơ bản
Trong mô hình dropshipping COD, **Đại lý ngoài (External Agent)** chịu trách nhiệm với đơn hàng của mình. Khi hàng bị hoàn:

1. **NCC đã sản xuất** → Chi phí sản xuất không hoàn lại
2. **Đã ship đi** → Phí ship không hoàn lại  
3. **Ship hoàn về** → Phải trả thêm phí hoàn

➡️ **Đại lý phải bồi thường toàn bộ chi phí này**

---

## 💰 CÔNG THỨC TÍNH HOA HỒNG

### CASE 1: Giao thành công ✅

```typescript
commission = COD - (agentQuote × quantity) - shippingFee - returnFee

// Ví dụ:
COD = 500,000 VNĐ
agentQuote = 300,000 VNĐ (đại lý báo giá cho khách)
quantity = 1
shippingFee = 25,000 VNĐ
returnFee = 0 VNĐ

commission = 500,000 - (300,000 × 1) - 25,000 - 0 = 175,000 VNĐ
➡️ Dương (+) - Công ty trả cho đại lý
```

### CASE 2: Hàng hoàn ❌

```typescript
commission = 0 - (supplierQuote × quantity) - shippingFee - returnFee

// Ví dụ:
COD = 0 VNĐ (khách không nhận)
supplierQuote = 200,000 VNĐ (chi phí sản xuất NCC)
quantity = 1
shippingFee = 25,000 VNĐ (phí ship đi)
returnFee = 15,000 VNĐ (phí ship hoàn)

commission = 0 - (200,000 × 1) - 25,000 - 15,000 = -240,000 VNĐ
➡️ Âm (-) - Đại lý nợ công ty
```

---

## 🔧 IMPLEMENTATION

### Backend: `test-order2.service.ts`

#### 1. Create Agent Payment Batch
```typescript
async createAgentPaymentBatch(dto: {...}) {
  const updatePromises = orders.map(async (order) => {
    let commission: number;
    
    if (order.orderStatus === 'Hàng hoàn') {
      // CASE 2: Đại lý phải chịu chi phí NCC + phí ship + phí hoàn
      commission = 0 - (supplierQuote * quantity) - shippingFee - returnFee;
    } else {
      // CASE 1: Đại lý được hoa hồng từ chênh lệch
      commission = codAmount - (agentQuote * quantity) - shippingFee - returnFee;
    }
    
    order.agentPaidAmount = commission; // Có thể âm!
    // ...
  });
}
```

#### 2. Get Pending Agent Payment
```typescript
async getOrdersPendingAgentPayment(filters) {
  const totalCommission = orders.reduce((sum, o) => {
    let commission: number;
    
    if (o.orderStatus === 'Hàng hoàn') {
      commission = 0 - (supplierQuote * quantity) - shippingFee - returnFee;
    } else {
      commission = codAmount - (agentQuote * quantity) - shippingFee - returnFee;
    }
    
    return sum + commission; // Tổng có thể âm nếu nhiều đơn hoàn!
  }, 0);
}
```

### Frontend: `agent-payment.component.ts`

```typescript
calculateCommission(order: Order): number {
  const codAmount = order.codAmount || 0;
  const agentQuote = order.agentQuote || 0;
  const supplierQuote = order.supplierQuote || 0;
  const quantity = order.quantity || 1;
  const shippingFee = order.shippingFee || 0;
  const returnFee = order.returnFee || 0;
  
  if (order.orderStatus === 'Hàng hoàn') {
    // Đại lý phải chịu chi phí NCC + phí ship + phí hoàn
    return 0 - (supplierQuote * quantity) - shippingFee - returnFee;
  } else {
    // Đại lý được hoa hồng
    return codAmount - (agentQuote * quantity) - shippingFee - returnFee;
  }
}
```

---

## 🎨 UI/UX CHO SỐ ÂM

### 1. Hiển thị số âm với màu đỏ

```html
<!-- agent-payment.component.html -->
<td [class.text-danger]="calculateCommission(order) < 0"
    [class.text-success]="calculateCommission(order) > 0"
    style="font-weight: bold;">
  {{ calculateCommission(order) | number:'1.0-0' }} đ
  <span *ngIf="calculateCommission(order) < 0" class="badge badge-danger ml-2">
    NỢ
  </span>
</td>
```

### 2. Cảnh báo khi tổng âm

```typescript
// agent-payment.component.ts
get selectedTotal(): number {
  return this.selectedOrders.reduce((sum, o) => {
    return sum + this.calculateCommission(o);
  }, 0);
}

openCreateBatchModal() {
  if (this.selectedTotal < 0) {
    const confirmed = confirm(
      `Tổng hoa hồng là SỐ ÂM (${this.selectedTotal} đ).\n` +
      `Điều này có nghĩa đại lý NỢ công ty.\n` +
      `Bạn có chắc muốn tạo phiếu không?`
    );
    if (!confirmed) return;
  }
  // ...
}
```

### 3. Thống kê đơn dương vs âm

```typescript
get positiveCommissionCount(): number {
  return this.selectedOrders.filter(o => this.calculateCommission(o) > 0).length;
}

get negativeCommissionCount(): number {
  return this.selectedOrders.filter(o => this.calculateCommission(o) < 0).length;
}
```

```html
<div class="alert alert-info" *ngIf="selectedCount > 0">
  <strong>Đã chọn {{ selectedCount }} đơn:</strong><br>
  • {{ positiveCommissionCount }} đơn trả hoa hồng (dương)<br>
  • {{ negativeCommissionCount }} đơn thu nợ (âm)<br>
  <strong>Tổng cộng: {{ selectedTotal | number:'1.0-0' }} đ</strong>
</div>
```

---

## 🔄 QUY TRÌNH XỬ LÝ

### 1. Khi đơn hàng bị hoàn

```
Nhân viên vận hành
    ↓
Cập nhật: orderStatus = "Hàng hoàn"
    ↓
AUTO-TRIGGER (backend)
    ↓
agentPaymentStatus = "pending" (nếu external agent)
    ↓
Đại lý xuất hiện trong danh sách "Chờ thanh toán"
    ↓
Hoa hồng tính ra SỐ ÂM
    ↓
Kế toán tạo phiếu thu nợ (thay vì trả tiền)
```

### 2. Thanh toán/Thu nợ

#### Trường hợp 1: Tổng dương (trả cho đại lý)
```
Batch có:
- 10 đơn giao thành công: +2,000,000 đ
- 2 đơn hàng hoàn: -300,000 đ
---
Tổng: +1,700,000 đ → Chuyển khoản cho đại lý
```

#### Trường hợp 2: Tổng âm (đại lý nợ công ty)
```
Batch có:
- 3 đơn giao thành công: +500,000 đ
- 5 đơn hàng hoàn: -1,200,000 đ
---
Tổng: -700,000 đ → Đại lý phải chuyển tiền cho công ty
```

#### Trường hợp 3: Trừ nợ vào lần sau
```
Kỳ 1: Tổng = -700,000 đ (đại lý nợ)
    ↓
Ghi nhận công nợ
    ↓
Kỳ 2: Tổng = +1,500,000 đ
    ↓
Trừ nợ: 1,500,000 - 700,000 = 800,000 đ
    ↓
Chuyển khoản 800,000 đ cho đại lý
```

---

## ⚠️ LƯU Ý QUAN TRỌNG

### 1. Validation
- ✅ Backend đã validate chỉ thanh toán đơn đã kết thúc: `['Giao thành công', 'Hàng hoàn']`
- ✅ Chỉ external agent mới có commission (internal agent = n/a)
- ✅ Công thức khác nhau giữa 2 trường hợp

### 2. Báo cáo & Tracking
- ⚠️ Cần track công nợ đại lý qua các kỳ
- ⚠️ Cần báo cáo tỷ lệ hoàn hàng theo agent
- ⚠️ Cần dashboard cảnh báo agent có nhiều đơn hoàn

### 3. Chính sách kinh doanh
- ❓ Agent có tỷ lệ hoàn > X% có bị phạt thêm không?
- ❓ Có giới hạn số nợ tối đa cho mỗi agent không?
- ❓ Đơn hoàn do lỗi NCC (sản xuất kém) thì ai chịu?

---

## 📊 TEST CASES

### Test Case 1: Đơn giao thành công
```
Input:
- orderStatus: "Giao thành công"
- codAmount: 500,000
- agentQuote: 300,000
- quantity: 1
- shippingFee: 25,000
- returnFee: 0

Expected: commission = 175,000 (dương)
```

### Test Case 2: Đơn hàng hoàn
```
Input:
- orderStatus: "Hàng hoàn"
- codAmount: 0 (hoặc bất kỳ - không dùng)
- supplierQuote: 200,000
- quantity: 1
- shippingFee: 25,000
- returnFee: 15,000

Expected: commission = -240,000 (âm)
```

### Test Case 3: Batch mix
```
Orders:
1. Giao thành công: +180,000
2. Giao thành công: +200,000
3. Hàng hoàn: -250,000
4. Giao thành công: +150,000

Expected: totalCommission = +280,000
```

---

## ✅ CHECKLIST IMPLEMENTATION

- [x] Backend: Fix `createAgentPaymentBatch` với logic if/else
- [x] Backend: Fix `getOrdersPendingAgentPayment` tính tổng
- [x] Frontend: Fix `calculateCommission` component method
- [x] Frontend: Hiển thị số âm với màu đỏ (TODO)
- [x] Frontend: Cảnh báo khi tổng âm (TODO)
- [x] Frontend: Thống kê đơn dương/âm (TODO)
- [ ] Backend: API tracking công nợ agent (TODO)
- [ ] Frontend: Dashboard công nợ agent (TODO)
- [ ] Documentation: User guide cho kế toán (TODO)

---

**Tác giả:** GitHub Copilot  
**Ngày:** 27/01/2026  
**Version:** v14.1
