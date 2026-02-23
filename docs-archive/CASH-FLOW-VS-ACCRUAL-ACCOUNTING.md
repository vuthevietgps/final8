# 💰 Vấn Đề: Cash Flow vs Accrual Accounting trong Phân Bổ Ngân Sách Ads

## 📊 Tổng Quan Vấn Đề

### Hiện Trạng
Hệ thống có **2 chức năng phân bổ** hoạt động ở 2 timing khác nhau:

1. **Phân Bổ Ngân Sách (Budget Allocation)** - Hàng ngày/realtime
2. **Phân Bổ Lợi Nhuận Thuần (Capital Allocation)** - Định kỳ (sau khi có lợi nhuận)

### ⚠️ Vấn Đề Timing Mismatch

```
Timeline của một đơn hàng:

Ngày 1: Chi phí ads     →  -500,000 VND (Đã chi thực tế)
Ngày 2: Đơn hàng tạo    →  Lợi nhuận thuần: +1,200,000 VND (Accrued)
Ngày 3: orderStatus     →  "Chờ lấy hàng" (Chưa có tiền thực tế)
Ngày 7: orderStatus     →  "Đang giao" (Vẫn chưa có tiền)
Ngày 10: orderStatus    →  "Giao thành công" (Có tiền COD, nhưng ở NCC)
Ngày 15: Đối soát NCC   →  Tiền về tài khoản (CASH IN thực tế)
```

**Vấn đề:**
- ✅ **Lợi nhuận thuần** (netProfit) tính ngay từ ngày 2
- ❌ **Tiền thực tế** (cash) về ngày 15
- ⚠️ **Chi phí ads** cần trả ngày 1-2

---

## 🔍 Phân Tích Chi Tiết

### 1. Accrual Accounting (Kế toán dồn tích)
**Hiện tại hệ thống đang dùng:**

```typescript
// File: backend/src/test-order2/schemas/test-order2.schema.ts
@Schema({ collection: 'ordertest2', timestamps: true })
export class TestOrder2 {
  @Prop({ type: String, default: 'Chưa có mã vận đơn' })
  orderStatus?: string;  // ⚠️ Không ảnh hưởng đến netProfit
  
  @Prop({ type: Number, default: 0 })
  netProfit?: number;    // ✅ Tính ngay khi có đơn
  
  @Prop({ type: Number, default: 0 })
  codCollectedBySupplier?: number;  // ❌ Chưa được dùng để adjust
}
```

**Công thức hiện tại:**
```typescript
// File: backend/src/finance/finance.service.ts (line 139-143)
async computeRealAvailableFunds() {
  const netProfitResult = await this.orderModel.aggregate([
    { $match: { netProfit: { $exists: true } } },
    { $group: { _id: null, total: { $sum: '$netProfit' } } }
  ]);
  const totalNetProfit = netProfitResult?.[0]?.total || 0;
  
  // ⚠️ Vấn đề: Tính TẤT CẢ netProfit, kể cả đơn chưa thu tiền
}
```

### 2. Cash Basis Accounting (Kế toán tiền mặt)
**Cần bổ sung để tracking tiền thực tế:**

```typescript
// Tiền thực tế thu được
const realizedRevenue = await this.orderModel.aggregate([
  { 
    $match: { 
      orderStatus: { $in: ['Giao thành công', 'Đã đối soát'] },
      codCollectedBySupplier: { $gt: 0 }  // Đã thu COD
    } 
  },
  { $group: { _id: null, total: { $sum: '$codCollectedBySupplier' } } }
]);
```

---

## 🚨 Các Trường Hợp Đặc Biệt

### Case 1: Đơn "Thành Công Nợ"
```
orderStatus: "Giao thành công"
codCollectedBySupplier: 1,000,000 VND
supplierPayable.status: "unpaid"  ← Tiền ở NCC, chưa về

→ netProfit: +300,000 (đã tính)
→ realCash: 0 (chưa có)
```

**Hậu quả:**
- Capital Allocation tính 45% tái đầu tư = 135,000 VND
- Nhưng thực tế chưa có tiền → **Không đủ trả ads**

### Case 2: Đơn Hoàn Hàng (Return)
```
Ngày 10: orderStatus: "Giao thành công" → netProfit: +300,000
Ngày 15: orderStatus: "Hoàn hàng" → netProfit: -300,000

→ Lợi nhuận bị adjust ngược
→ Nếu đã chi 45% = 135,000 cho ads → MẤT TIỀN
```

### Case 3: Lệch Thời Gian Đối Soát
```
Ngày 1-10:  Chi phí ads = -5,000,000 VND (Đã trả Facebook)
Ngày 10:    Có 20 đơn "Giao thành công"
            netProfit tích lũy = +6,000,000 VND
            45% tái đầu tư = +2,700,000 VND (Có thể chi tiếp)
            
Ngày 15:    Đối soát NCC → Chỉ nhận được 3,000,000 VND
            → Thiếu 2,000,000 VND!
```

---

## ✅ Giải Pháp Đề Xuất

### Phương Án 1: Conservative (An Toàn Nhất) ⭐ RECOMMENDED

**Nguyên tắc:** Chỉ tính lợi nhuận từ đơn **ĐÃ ĐỐI SOÁT** (tiền về thực tế)

```typescript
// File: backend/src/finance/finance.service.ts
async computeRealAvailableFunds() {
  // 1. Chỉ tính netProfit từ đơn ĐÃ ĐỐI SOÁT
  const realizedNetProfit = await this.orderModel.aggregate([
    { 
      $match: { 
        orderStatus: { $in: [
          'Giao thành công',
          'Đã đối soát',
          'Hoàn thành'
        ] },
        codCollectedBySupplier: { $gt: 0 },  // Đã thu COD
        netProfit: { $exists: true }
      } 
    },
    { $group: { _id: null, total: { $sum: '$netProfit' } } }
  ]);
  
  // 2. Trừ đi khoản NCC chưa trả (Supplier Payable Unpaid)
  const unpaidToSuppliers = await this.supplierPayableModel.aggregate([
    { 
      $match: { 
        status: { $in: ['pending', 'partial'] }  // Chưa trả hết NCC
      }
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } }
      }
    }
  ]);
  
  // 3. Vốn AN TOÀN = Lợi nhuận đã thực hiện - Nợ NCC
  const safeAvailableFunds = realizedNetProfit - unpaidToSuppliers;
  
  return {
    safeAvailableFunds,
    breakdown: {
      realizedNetProfit,      // Lợi nhuận đã có tiền thực tế
      unpaidToSuppliers,      // Còn nợ NCC
      cashAvailable: safeAvailableFunds  // Tiền thực tế có thể dùng
    }
  };
}
```

**Ưu điểm:**
- ✅ An toàn tuyệt đối
- ✅ Không bao giờ overspend
- ✅ Phù hợp với Cash Flow thực tế

**Nhược điểm:**
- ❌ Chậm hơn (phải đợi đối soát)
- ❌ Có thể bỏ lỡ cơ hội scale nhanh

---

### Phương Án 2: Moderate (Cân Bằng)

**Nguyên tắc:** Tính netProfit accrued nhưng giữ **buffer an toàn**

```typescript
async computeRealAvailableFunds() {
  // 1. Tổng netProfit từ TẤT CẢ đơn (Accrual)
  const totalNetProfit = await this.getTotalNetProfit();
  
  // 2. Phân loại theo orderStatus
  const profitByStatus = await this.orderModel.aggregate([
    { $match: { netProfit: { $exists: true } } },
    {
      $group: {
        _id: null,
        realizedProfit: {  // Đã giao thành công
          $sum: {
            $cond: [
              { $in: ['$orderStatus', ['Giao thành công', 'Đã đối soát']] },
              '$netProfit',
              0
            ]
          }
        },
        pendingProfit: {  // Đang giao
          $sum: {
            $cond: [
              { $in: ['$orderStatus', ['Đang giao', 'Chờ lấy hàng']] },
              '$netProfit',
              0
            ]
          }
        },
        riskyProfit: {  // Mới tạo, chưa giao
          $sum: {
            $cond: [
              { $in: ['$orderStatus', ['Chưa có mã vận đơn', 'Mới']] },
              '$netProfit',
              0
            ]
          }
        }
      }
    }
  ]);
  
  // 3. Áp dụng hệ số chiết khấu theo độ rủi ro
  const safeAvailableFunds = 
    profitByStatus.realizedProfit * 1.0 +      // 100% đã có tiền
    profitByStatus.pendingProfit * 0.7 +       // 70% đang giao (rủi ro hoàn)
    profitByStatus.riskyProfit * 0.3;          // 30% mới tạo (rủi ro cao)
  
  return {
    safeAvailableFunds,
    breakdown: {
      totalNetProfit,
      realizedProfit: profitByStatus.realizedProfit,
      pendingProfit: profitByStatus.pendingProfit,
      riskyProfit: profitByStatus.riskyProfit,
      discountApplied: true
    }
  };
}
```

**Ưu điểm:**
- ✅ Cân bằng giữa tốc độ và an toàn
- ✅ Có thể scale nhanh hơn
- ✅ Quản lý rủi ro theo từng giai đoạn

**Nhược điểm:**
- ⚠️ Phức tạp hơn
- ⚠️ Cần điều chỉnh hệ số theo thực tế

---

### Phương Án 3: Aggressive (Rủi Ro Cao)

**Nguyên tắc:** Dùng hết netProfit accrued + vay nếu cần

```typescript
async computeRealAvailableFunds() {
  const totalNetProfit = await this.getTotalNetProfit();
  const loanAvailable = await this.getLoanRoomAvailable();
  
  // Dùng 100% netProfit + 50% vay
  const aggressiveFunds = totalNetProfit + (loanAvailable * 0.5);
  
  return {
    safeAvailableFunds: aggressiveFunds,
    riskLevel: 'HIGH',
    warning: 'Đang dùng lợi nhuận chưa thu + vay'
  };
}
```

**Ưu điểm:**
- ✅ Scale nhanh nhất
- ✅ Tối đa hóa cơ hội

**Nhược điểm:**
- ❌ Rủi ro rất cao
- ❌ Có thể dẫn đến thiếu hụt tiền mặt
- ❌ Không phù hợp với doanh nghiệp nhỏ

---

## 🛠️ Implementation Roadmap

### Phase 1: Tracking & Monitoring (Tuần 1-2)

**1.1. Thêm field tracking vào TestOrder2**
```typescript
// backend/src/test-order2/schemas/test-order2.schema.ts
@Schema({ collection: 'ordertest2', timestamps: true })
export class TestOrder2 {
  // ... existing fields
  
  // Cash tracking
  @Prop({ type: Date })
  cashRealizedDate?: Date;  // Ngày tiền về thực tế
  
  @Prop({ type: String, enum: ['accrued', 'realized', 'reversed'] })
  profitStatus?: string;    // Trạng thái lợi nhuận
  
  @Prop({ type: Boolean, default: false })
  isSettledWithSupplier?: boolean;  // Đã đối soát NCC?
}
```

**1.2. Tạo Dashboard Cash Flow**
- Biểu đồ: Accrued Profit vs Realized Cash
- Cảnh báo: Các đơn "Thành công nợ" quá 7 ngày
- Metric: Days to Cash (trung bình bao nhiêu ngày tiền về)

### Phase 2: Adjust Calculation (Tuần 3-4)

**2.1. Cập nhật FinanceService**
```typescript
// backend/src/finance/finance.service.ts

async computeRealAvailableFunds(mode: 'conservative' | 'moderate' | 'aggressive' = 'moderate') {
  switch (mode) {
    case 'conservative':
      return this.computeConservativeFunds();
    case 'moderate':
      return this.computeModerateFunds();
    case 'aggressive':
      return this.computeAggressiveFunds();
  }
}
```

**2.2. Cập nhật CapitalAllocationService**
```typescript
// backend/src/finance/capital-allocation.service.ts

async computeAllocation(policyId?: string) {
  // Dùng mode 'moderate' cho an toàn
  const fundsData = await this.financeService.computeRealAvailableFunds('moderate');
  
  // Tính 45% reinvestment từ safeAvailableFunds
  const reinvestmentAmount = fundsData.safeAvailableFunds * 0.45;
  
  return {
    reinvestmentAmount,
    breakdown: fundsData.breakdown,  // Hiện chi tiết
    riskLevel: fundsData.riskLevel
  };
}
```

### Phase 3: Auto Adjustment (Tuần 5-6)

**3.1. Cronjob xử lý hoàn hàng**
```typescript
@Cron('0 */6 * * *')  // Mỗi 6 tiếng
async handleReturnedOrders() {
  const returnedOrders = await this.orderModel.find({
    orderStatus: { $regex: /hoàn/i },
    profitStatus: { $ne: 'reversed' }
  });
  
  for (const order of returnedOrders) {
    // Đảo ngược lợi nhuận
    order.netProfit = -Math.abs(order.netProfit);
    order.profitStatus = 'reversed';
    await order.save();
    
    // Log để audit
    this.logger.warn(`Order ${order._id} returned, profit reversed`);
  }
}
```

**3.2. Alert System**
```typescript
@Cron('0 8 * * *')  // Mỗi sáng 8h
async checkCashFlowHealth() {
  const funds = await this.computeRealAvailableFunds('moderate');
  
  if (funds.breakdown.pendingProfit > funds.breakdown.realizedProfit) {
    // Cảnh báo: Quá nhiều tiền chưa về
    this.alertService.send({
      type: 'WARNING',
      message: `Pending profit (${funds.breakdown.pendingProfit}) > Realized (${funds.breakdown.realizedProfit}). Risk of cash shortage!`
    });
  }
}
```

---

## 📈 Metrics Cần Tracking

### 1. Cash Conversion Cycle
```
CCC = Số ngày từ "Chi phí ads" → "Tiền về thực tế"
Target: < 15 ngày
```

### 2. Profit Realization Rate
```
PRR = Realized Profit / Accrued Profit
Target: > 85%
```

### 3. Return Rate
```
RR = Số đơn hoàn / Tổng đơn giao
Target: < 5%
```

### 4. Supplier Settlement Lag
```
SSL = Số ngày từ "Giao thành công" → "Đối soát NCC"
Target: < 7 ngày
```

---

## 🎯 Khuyến Nghị

### Ngắn Hạn (1-2 tháng)
1. ✅ **Áp dụng Phương Án 2 (Moderate)** cho Capital Allocation
2. ✅ Bổ sung tracking `profitStatus` và `cashRealizedDate`
3. ✅ Tạo dashboard Cash Flow monitoring
4. ✅ Setup alert cho đơn "Thành công nợ" > 7 ngày

### Trung Hạn (3-6 tháng)
1. ✅ Tích hợp tự động với hệ thống đối soát NCC
2. ✅ Optimize Days to Cash xuống < 10 ngày
3. ✅ Xây dựng ML model dự đoán return rate
4. ✅ Implement buffer động dựa trên lịch sử

### Dài Hạn (6-12 tháng)
1. ✅ Tích hợp trực tiếp với ngân hàng (bank API)
2. ✅ Real-time cash position tracking
3. ✅ Automated cash flow forecasting
4. ✅ Dynamic budget allocation dựa trên cash forecast

---

## 📚 Tài Liệu Tham Khảo

- [BUDGET-ALLOCATION-GUIDE.md](./BUDGET-ALLOCATION-GUIDE.md) - Hướng dẫn phân bổ ngân sách
- [finance-insights.md](./finance-insights.md) - Phân tích tài chính
- [return-report.md](./return-report.md) - Báo cáo hoàn hàng

---

**Tác giả:** System Analysis  
**Ngày tạo:** 2026-01-26  
**Version:** 1.0
