# 📊 Các Đại Lượng & Logic Tính Toán - Capital Management System

## 📌 Tóm Tắt Các Đại Lượng Chính

### 1️⃣ **Đại Lượng Cơ Bản Từ TestOrder2 Collection**

| Đại lượng | Nguồn | Ý nghĩa |
|-----------|-------|---------|
| `supplierPaidAmount` | Order field | Số tiền đã trả cho NCC |
| `agentPaidAmount` | Order field | Số tiền đại lý đã nhận |
| `supplierPaymentStatus` | Order field | Trạng thái thanh toán NCC: `'paid'`, `'pending'`, `'partial'` |
| `agentPaymentStatus` | Order field | Trạng thái thanh toán Đại lý: `'paid'`, `'n/a'`, `'pending'` |
| `realizedGrossProfit` | Order field | Lợi nhuận gộp đã thực hiện |
| `realizedNetProfit` | Order field | Lợi nhuận ròng đã thực hiện |
| `realizedAt` | Order field | Thời điểm đơn hàng được coi là realized |

---

## 🎯 **MODE 1: CONSERVATIVE (An Toàn)**

### A. Điều Kiện Realized Order
```typescript
supplierPaymentStatus === 'paid' 
AND 
(agentPaymentStatus === 'paid' OR agentPaymentStatus === 'n/a')
```

### B. Các Đại Lượng

#### 1. **realizedNetProfit** (Lợi nhuận ròng đã thực hiện)
```
realizedNetProfit = supplierPaidAmount - agentPaidAmount - allocatedCosts
```
- **Nguồn**: Tính từ các đơn đã thanh toán CẢ 2 bên
- **Ý nghĩa**: Lợi nhuận THỰC TẾ đã về tay, an toàn 100%

#### 2. **realizedGrossProfit** (Lợi nhuận gộp đã thực hiện)
```
realizedGrossProfit = supplierPaidAmount - agentPaidAmount
```
- **Không trừ** chi phí phân bổ (ads, labor, etc.)

#### 3. **realizedOrderCount** (Số đơn đã thực hiện)
```
COUNT(orders WHERE supplierPaymentStatus='paid' AND agentPaymentStatus IN ['paid','n/a'])
```

#### 4. **pendingNetProfit** (Lợi nhuận chờ thanh toán)
```
pendingNetProfit = SUM(estimatedProfit WHERE NOT realized)
```
- **Ý nghĩa**: Đơn chưa thanh toán đủ, chưa chắc chắn

#### 5. **pendingOrderCount** (Số đơn đang chờ)
```
COUNT(orders WHERE NOT (supplierPaymentStatus='paid' AND agentPaymentStatus IN ['paid','n/a']))
```

#### 6. **safeAvailableFunds** (Tiền chắc ăn)
```
safeAvailableFunds = realizedNetProfit + initialCapital
```
- **initialCapital**: Vốn ban đầu (mặc định = 0)
- **Ý nghĩa**: Tiền có thể PHÂN BỔ NGAY, không rủi ro

#### 7. **netCashAvailable** (Tiền mặt ròng khả dụng)
```
netCashAvailable = realizedNetProfit + initialCapital
```
- Trong mode Conservative: `netCashAvailable === safeAvailableFunds`

#### 8. **totalNetProfit** (Tổng lợi nhuận)
```
totalNetProfit = realizedNetProfit + pendingNetProfit
```
- **Ý nghĩa**: Bao gồm CẢ realized và pending (để tham khảo)

---

## ⚖️ **MODE 2: MODERATE (Cân Bằng)**

### A. Phân Loại Orders

#### **Realized Orders** (100% discount)
```
supplierPaymentStatus === 'paid' 
AND 
agentPaymentStatus IN ['paid', 'n/a']
```

#### **Partial Orders** (70% discount)
```
(supplierPaymentStatus === 'paid' AND agentPaymentStatus === 'pending')
OR
(supplierPaymentStatus === 'pending' AND agentPaymentStatus === 'paid')
```
- Đã thanh toán 1 bên, còn bên kia chưa

#### **Pending Orders** (40% discount)
```
supplierPaymentStatus !== 'paid' 
AND 
agentPaymentStatus !== 'paid'
```
- Chưa thanh toán cả 2 bên

### B. Các Đại Lượng

#### 1. **realizedProfit** (100% discount)
```
realizedProfit = SUM(realizedNetProfit FROM realized_orders)
```

#### 2. **realizedCount**
```
realizedCount = COUNT(realized_orders)
```

#### 3. **partialProfit** (70% discount)
```
partialProfit = SUM(estimatedNetProfit FROM partial_orders) × 0.70
```
- **Ý nghĩa**: Chấp nhận 70% giá trị vì 1 bên đã thanh toán

#### 4. **partialCount**
```
partialCount = COUNT(partial_orders)
```

#### 5. **pendingProfit** (40% discount)
```
pendingProfit = SUM(estimatedNetProfit FROM pending_orders) × 0.40
```
- **Ý nghĩa**: Chỉ tính 40% vì chưa chắc chắn

#### 6. **pendingCount**
```
pendingCount = COUNT(pending_orders)
```

#### 7. **discountedFunds** (Tổng sau chiết khấu)
```
discountedFunds = realizedProfit + partialProfit + pendingProfit
```

#### 8. **safeAvailableFunds** (Tiền khả dụng)
```
safeAvailableFunds = discountedFunds + initialCapital
```

#### 9. **netCashAvailable**
```
netCashAvailable = safeAvailableFunds
```

#### 10. **totalNetProfit**
```
totalNetProfit = realizedProfit + (partialProfit / 0.70) + (pendingProfit / 0.40)
```
- Quy về giá trị gốc (không chiết khấu)

---

## 🔴 **MODE 3: AGGRESSIVE (Rủi ro)**

### A. Các Đại Lượng

#### 1. **estimatedProfit** (Ước tính toàn bộ)
```
estimatedProfit = SUM(estimatedNetProfit FROM ALL orders)
```
- **Ý nghĩa**: Tính TẤT CẢ đơn, kể cả chưa thanh toán

#### 2. **realizedProfit** (Đã thực hiện)
```
realizedProfit = SUM(realizedNetProfit FROM realized_orders)
```

#### 3. **unrealizedProfit** (Chưa thực hiện)
```
unrealizedProfit = estimatedProfit - realizedProfit
```
- **Ý nghĩa**: Phần lợi nhuận chưa về tay, RỦI RO CAO

#### 4. **loanAvailable** (Khoản vay khả dụng)
```
loanAvailable = 0  // Mặc định = 0, cần tích hợp với loan system
```
- **Tương lai**: Có thể tích hợp với module vay vốn

#### 5. **safeAvailableFunds** (Tổng vốn)
```
safeAvailableFunds = initialCapital + estimatedProfit + loanAvailable
```
- **RỦI RO**: Bao gồm cả lợi nhuận chưa về và khoản vay

#### 6. **netCashAvailable**
```
netCashAvailable = safeAvailableFunds
```

#### 7. **totalNetProfit**
```
totalNetProfit = estimatedProfit
```

---

## 💎 **PHÂN BỔ LỢI NHUẬN (Capital Allocation)**

### A. Policy Ratios (Chính Sách Mặc Định)

```typescript
interface CapitalAllocationPolicy {
  reinvestmentRatio: 0.45      // 45% - Tái đầu tư
  safetyReserveRatio: 0.25     // 25% - Dự phòng
  personalIncomeRatio: 0.20    // 20% - Thu nhập cá nhân
  longTermAssetRatio: 0.10     // 10% - Tài sản dài hạn
}
```

**Kiểm tra**: `reinvestmentRatio + safetyReserveRatio + personalIncomeRatio + longTermAssetRatio = 1.00` (100%)

### B. Các Đại Lượng Phân Bổ

#### 1. **cashAvailable** (Vốn để phân bổ)
```
cashAvailable = safeAvailableFunds  // Theo mode đã chọn
```

#### 2. **reinvestmentAmount** (Số tiền tái đầu tư)
```
reinvestmentAmount = cashAvailable × reinvestmentRatio
```
- **Mục đích**: Quay lại vốn quảng cáo để tăng trưởng

#### 3. **safetyReserveAmount** (Quỹ dự phòng)
```
safetyReserveAmount = cashAvailable × safetyReserveRatio
```
- **Mục đích**: Dự phòng rủi ro, chi phí bất ngờ

#### 4. **personalIncomeAmount** (Thu nhập cá nhân)
```
personalIncomeAmount = cashAvailable × personalIncomeRatio
```
- **Mục đích**: Thu nhập cho chủ doanh nghiệp

#### 5. **longTermAssetAmount** (Tài sản dài hạn)
```
longTermAssetAmount = cashAvailable × longTermAssetRatio
```
- **Mục đích**: Đầu tư dài hạn (bất động sản, cổ phiếu, etc.)

### C. Kiểm Tra Logic
```
reinvestmentAmount + safetyReserveAmount + personalIncomeAmount + longTermAssetAmount 
= cashAvailable
```

---

## 🎯 **PHÂN BỔ NGÂN SÁCH ADS (Budget Allocation)**

### A. Các Đại Lượng Ad Group

#### 1. **actualSpent** (Chi phí thực tế)
```
actualSpent = SUM(cost FROM advertising_costs WHERE adGroupId = X)
```

#### 2. **revenue** (Doanh thu)
```
revenue = SUM(price × quantity FROM orders WHERE adGroupId = X)
```

#### 3. **profit** (Lợi nhuận)
```
profit = revenue - actualSpent - otherCosts
```

#### 4. **ROI** (Return on Investment)
```
ROI = (revenue - actualSpent) / actualSpent
```

**Ví dụ**:
- Chi 1 triệu, thu 3 triệu → ROI = (3M - 1M) / 1M = 2.0x
- ROI = 2.0 nghĩa là thu về gấp đôi vốn bỏ ra

### B. Phân Loại ROI

| ROI | Phân loại | Màu sắc | Chiến lược |
|-----|-----------|---------|------------|
| ≥ 2.0 | 🟢 High | Green | Tăng budget mạnh |
| 1.0 - 2.0 | 🟡 Medium | Yellow | Duy trì hoặc tăng nhẹ |
| < 1.0 | 🔴 Low | Red | Giảm budget hoặc dừng |

### C. Budget Allocation Logic

#### 1. **availableFunds** (Vốn để phân bổ)
```
availableFunds = reinvestmentAmount  // Từ capital allocation
```

#### 2. **suggestedBudget** (Ngân sách đề xuất cho từng group)
```
suggestedBudget = f(ROI, profit, currentBudget)
```

**Thuật toán**:
```
IF ROI >= 2.0:
  suggestedBudget = currentBudget × 1.5  // Tăng 50%
ELSE IF ROI >= 1.0:
  suggestedBudget = currentBudget × 1.2  // Tăng 20%
ELSE IF ROI >= 0.5:
  suggestedBudget = currentBudget × 0.8  // Giảm 20%
ELSE:
  suggestedBudget = currentBudget × 0.5  // Giảm 50%
```

#### 3. **totalSuggestedSpend** (Tổng đề xuất)
```
totalSuggestedSpend = SUM(suggestedBudget FROM all_ad_groups)
```

#### 4. **canAfford** (Có đủ tiền không?)
```
canAfford = (availableFunds >= totalSuggestedSpend)
```

#### 5. **deficit** (Thiếu hụt)
```
deficit = MAX(0, totalSuggestedSpend - availableFunds)
```

#### 6. **allocatedBudget** (Budget được phân bổ thực tế)
```
IF canAfford:
  allocatedBudget = suggestedBudget
ELSE:
  // Phân bổ tỷ lệ theo available funds
  allocatedBudget = suggestedBudget × (availableFunds / totalSuggestedSpend)
```

---

## 📈 **FLOW TỔNG THỂ**

### 1. Load Dashboard
```
User chọn mode → API calls (parallel):
  ├─ GET /finance/available-funds/current?mode={mode}
  ├─ GET /capital-allocation/policies/active
  ├─ GET /capital-allocation/compute?mode={mode}
  └─ GET /budget-allocation/status
```

### 2. Tính Available Funds (theo mode)
```
TestOrder2 Collection
  → Filter theo điều kiện mode
  → Calculate realized/pending profits
  → Apply discount (nếu moderate)
  → Add initial capital
  → Return safeAvailableFunds
```

### 3. Tính Capital Allocation
```
safeAvailableFunds (từ step 2)
  → Get active policy (ratios)
  → Calculate allocation amounts
  → Return {reinvestment, safety, personal, longTerm}
```

### 4. Tính Budget Allocation
```
Ad Groups + Orders
  → Calculate ROI for each group
  → Suggest budget based on ROI
  → Check if can afford
  → Allocate budget proportionally
  → Return allocation table
```

---

## 🔢 **VÍ DỤ TÍNH TOÁN CỤ THỂ**

### Scenario: 10 đơn hàng

| Order | Supplier Paid | Agent Paid | Supplier Status | Agent Status | Estimated Net Profit |
|-------|---------------|------------|-----------------|--------------|---------------------|
| 1 | 1,000,000 | 300,000 | paid | paid | 700,000 |
| 2 | 1,500,000 | 400,000 | paid | n/a | 1,100,000 |
| 3 | 2,000,000 | 500,000 | paid | pending | 1,500,000 |
| 4 | 1,200,000 | 0 | pending | paid | 1,200,000 |
| 5 | 3,000,000 | 800,000 | pending | pending | 2,200,000 |

### Conservative Mode Calculation:

**Realized Orders** (Order 1, 2):
```
realizedNetProfit = 700,000 + 1,100,000 = 1,800,000
realizedOrderCount = 2
```

**Pending Orders** (Order 3, 4, 5):
```
pendingNetProfit = 1,500,000 + 1,200,000 + 2,200,000 = 4,900,000
pendingOrderCount = 3
```

**Safe Available Funds**:
```
safeAvailableFunds = 1,800,000 + 0 (no initial capital) = 1,800,000
```

### Moderate Mode Calculation:

**Realized** (100%): Order 1, 2
```
realizedProfit = 1,800,000
```

**Partial** (70%): Order 3, 4
```
partialProfit = (1,500,000 + 1,200,000) × 0.70 = 1,890,000
```

**Pending** (40%): Order 5
```
pendingProfit = 2,200,000 × 0.40 = 880,000
```

**Safe Available Funds**:
```
safeAvailableFunds = 1,800,000 + 1,890,000 + 880,000 = 4,570,000
```

### Aggressive Mode Calculation:

**Estimated Profit** (all orders):
```
estimatedProfit = 700,000 + 1,100,000 + 1,500,000 + 1,200,000 + 2,200,000 
                = 6,700,000
```

**Safe Available Funds**:
```
safeAvailableFunds = 6,700,000 + 0 (initial) + 0 (loan) = 6,700,000
```

---

### Capital Allocation (với Conservative = 1,800,000)

**Policy**: 45% / 25% / 20% / 10%

```
reinvestmentAmount    = 1,800,000 × 0.45 = 810,000
safetyReserveAmount   = 1,800,000 × 0.25 = 450,000
personalIncomeAmount  = 1,800,000 × 0.20 = 360,000
longTermAssetAmount   = 1,800,000 × 0.10 = 180,000
                                     ─────────────
TỔNG                                  = 1,800,000 ✓
```

---

### Budget Allocation (với reinvestment = 810,000)

**3 Ad Groups**:

| Ad Group | ROI | Current Budget | Suggested | Allocated |
|----------|-----|----------------|-----------|-----------|
| Group A | 3.5x | 500,000 | 750,000 | 300,000 |
| Group B | 1.8x | 400,000 | 480,000 | 240,000 |
| Group C | 0.8x | 300,000 | 150,000 | 270,000 |
| **TOTAL** | - | 1,200,000 | **1,380,000** | **810,000** |

**Logic**:
- `totalSuggestedSpend` = 1,380,000
- `availableFunds` = 810,000
- `canAfford` = false (thiếu 570,000)
- **Scale down tỷ lệ**: `810,000 / 1,380,000 = 0.587` (58.7%)
- Group A: `750,000 × 0.587 = 440,000` (làm tròn 300k)
- Group B: `480,000 × 0.587 = 282,000` (làm tròn 240k)
- Group C: `150,000 × 0.587 = 88,000` (làm tròn 270k)

---

## 🎓 **GLOSSARY (Thuật Ngữ)**

| Thuật ngữ | Tiếng Việt | Định nghĩa |
|-----------|------------|-----------|
| **Realized Profit** | Lợi nhuận đã thực hiện | Lợi nhuận từ đơn đã thanh toán đủ |
| **Pending Profit** | Lợi nhuận chờ | Lợi nhuận từ đơn chưa thanh toán |
| **Safe Available Funds** | Tiền chắc ăn | Tiền có thể phân bổ ngay |
| **ROI** | Tỷ suất lợi nhuận | (Revenue - Cost) / Cost |
| **Reinvestment** | Tái đầu tư | Tiền quay lại vốn QC |
| **Safety Reserve** | Dự phòng | Quỹ dự phòng rủi ro |
| **Capital Allocation** | Phân bổ vốn | Phân chia lợi nhuận theo policy |
| **Budget Allocation** | Phân bổ ngân sách | Phân chia budget cho ad groups |

---

## ⚠️ **LƯU Ý QUAN TRỌNG**

1. **Mode Conservative**: An toàn nhất, chỉ dùng tiền ĐÃ VỀ TAY
2. **Mode Moderate**: Cân bằng, chiết khấu theo rủi ro
3. **Mode Aggressive**: Rủi ro cao, dùng cả tiền CHƯA VỀ

4. **Allocation Priority**:
   ```
   Realized Orders > Partial Orders > Pending Orders
   ```

5. **ROI Calculation**: Luôn dựa trên `actualSpent`, không estimate

6. **Policy Ratios**: Phải tổng = 100%, không được âm

7. **Budget Deficit**: Khi thiếu vốn, scale down tỷ lệ cho TẤT CẢ ad groups

---

## 🔗 **DEPENDENCIES (Phụ Thuộc)**

```
TestOrder2 Collection
  ↓
Available Funds Calculation (by mode)
  ↓
Capital Allocation (policy ratios)
  ↓
Budget Allocation (ROI-based)
  ↓
UI Dashboard (3 tabs)
```

**Mỗi bước phụ thuộc vào bước trước, không thể đảo ngược!**
