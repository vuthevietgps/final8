# 💰 FINANCIAL CONTROL – CASH FLOW + FORECAST

**Version:** 3.0 - Feb 3, 2026  
**Author:** CFO-Approved Specification for Developers  
**Mục tiêu:** Quản lý sự sống còn, tốc độ scale, số tiền owner có thể rút, và dự báo 7 ngày.  
**Nguyên tắc:** Chỉ có **Cash In / Cash Out** làm thay đổi Bank Balance. Các khái niệm khác là **thuộc tính/nhãn**.

---

## 📚 MỤC LỤC

1. [Định nghĩa & Nguồn dữ liệu](#1-định-nghĩa--nguồn-dữ-liệu)
2. [Committed Cash (Tiền Giữ Chỗ)](#2-committed-cash-tiền-giữ-chỗ)
3. [Free Cash (Tiền Khả Dụng)](#3-free-cash-tiền-khả-dụng)
4. [Survival Reserve (Sống Còn)](#4-survival-reserve-sống-còn)
5. [Growth (Ads) - Gợi ý & Ngân sách](#5-growth-ads---gợi-ý--ngân-sách)
6. [Owner Withdrawable](#6-owner-withdrawable)
7. [Forecast 7 Days (Dự Báo)](#7-forecast-7-days-dự-báo)
8. [Dashboard Tối Thiểu](#8-dashboard-tối-thiểu)
9. [Pseudocode Tổng Hợp](#9-pseudocode-tổng-hợp)

---

## 1. ĐỊNH NGHĨA & NGUỒN DỮ LIỆU

### 1.1. Bank Balance (Số Dư Ngân Hàng)

```
┌─────────────────────────────────────────────────────────────┐
│  🏦 BANK BALANCE = Source of Truth                          │
├─────────────────────────────────────────────────────────────┤
│  Nguồn: Số dư THỰC TẾ từ bank statement (reconcile)        │
│                                                             │
│  ERP có thể tính:                                           │
│  Bank(t) = Bank(t-1) + In(t) - Out(t)                       │
│                                                             │
│  Nhưng số THẬT vẫn là bank statement!                       │
└─────────────────────────────────────────────────────────────┘
```

### 1.2. Cash In (Tiền VÀO) - Chỉ tính khi tiền ĐÃ VÀO tài khoản

```
📥 CASH IN (Tiền thật đã vào):
  ├─ NCC chuyển tiền đối soát (supplierPaymentStatus: "paid")
  ├─ Vốn vay giải ngân
  ├─ Owner nạp thêm vốn
  └─ Refund / thu khác
```

### 1.3. Cash Out (Tiền RA) - Chỉ tính khi tiền ĐÃ RA khỏi tài khoản

```
📤 CASH OUT (Tiền thật đã ra):
  ├─ Ads đã chi
  ├─ Lương/nhân công đã trả
  ├─ Vận hành đã trả
  ├─ Đại lý đã trả
  ├─ Thuế đã đóng
  ├─ Trả nợ (gốc/lãi) đã trả
  └─ Owner đã rút
```

### 1.4. Internal Transfer (Chuyển tiền nội bộ)

```
⚠️ INTERNAL TRANSFER = KHÔNG phải Cash In/Out

Chuyển tiền giữa các quỹ/ví trong cùng hệ thống
→ Bank Balance KHÔNG THAY ĐỔI
→ Chỉ thay đổi phân bổ nội bộ
```

---

## 2. COMMITTED CASH (TIỀN GIỮ CHỖ)

**Khái niệm:** Nghĩa vụ CHẮC CHẮN phải trả trong tương lai gần → "không được đụng"

### 2.1. CommittedWindowDays (Cửa sổ cam kết)

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ CONFIGURATION                                           │
├─────────────────────────────────────────────────────────────┤
│  CommittedWindowDays = 14 ngày (mặc định, có thể config)   │
│                                                             │
│  Lựa chọn:                                                  │
│  • 7 ngày:  Rất cẩn trọng (startup, cashflow chặt)         │
│  • 14 ngày: Cân bằng (khuyến nghị - DEFAULT) ✅             │
│  • 30 ngày: Linh hoạt (doanh nghiệp lớn, cashflow tốt)     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. Công Thức

```
CommittedCash(XD) = Σ khoản chi:
  ├─ isApproved = TRUE (đã duyệt)
  ├─ dueDate ∈ [today, today + X]
  ├─ paymentStatus = "pending" (chưa trả)
  └─ priority = "must_pay" (bắt buộc)
```

### 2.3. Các Khoản Thường Đưa Vào Committed

```
✅ COMMITTED (trong 14 ngày tới):
  ├─ Lương đến hạn
  ├─ Vận hành đến hạn
  ├─ Hoa hồng đại lý đến hạn
  ├─ Thuế đến hạn
  └─ Nợ vay đến hạn (gốc + lãi)

❌ KHÔNG PHẢI COMMITTED:
  ├─ Chi phí chưa duyệt
  ├─ Chi phí > 14 ngày nữa
  └─ Chi phí đã thanh toán (đã trừ Bank Balance rồi)
```

### 2.4. Ví Dụ

```
Hôm nay: 3/2/2026, CommittedWindowDays = 14

Khoản phải trả:
  ├─ Lương tháng 2: 50M (due: 5/2) ✅ 2 ngày → COMMITTED
  ├─ Vận hành: 20M (due: 10/2) ✅ 7 ngày → COMMITTED
  ├─ Đại lý: 30M (due: 15/2) ✅ 12 ngày → COMMITTED
  ├─ Chi phí NCC: 200M (chưa duyệt) ❌ KHÔNG TÍNH
  └─ Lương tháng 3: 50M (due: 5/3) ❌ > 14 ngày

→ CommittedCash = 50M + 20M + 30M = 100M
```

---

## 3. FREE CASH (TIỀN KHẢ DỤNG)

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 FREE CASH = BankBalance - CommittedCash                 │
├─────────────────────────────────────────────────────────────┤
│  Ý nghĩa: Tiền CÓ THỂ dùng ngay                             │
│           (nhưng chưa nói dùng vào việc gì)                │
└─────────────────────────────────────────────────────────────┘
```

**Ví dụ:**
```
BankBalance:    450M
CommittedCash: -100M
─────────────────────
FreeCash:       350M ✅
```

---

## 4. SURVIVAL RESERVE (SỐNG CÒN - BẮT BUỘC)

### 4.1. MonthlyBurn (Burn Cơ Bản / Tháng)

```
MonthlyBurn = Lương core + Vận hành bắt buộc + Trả nợ bắt buộc

Ví dụ:
  ├─ Lương core: 50M/tháng
  ├─ Vận hành bắt buộc: 15M/tháng
  └─ Trả nợ bắt buộc: 5M/tháng
  → MonthlyBurn = 70M/tháng
```

### 4.2. SurvivalFloor (Sàn Sống Còn)

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ SURVIVAL FLOOR = 3 × MonthlyBurn                        │
├─────────────────────────────────────────────────────────────┤
│  = Tiền BẮT BUỘC giữ để sống còn 3 tháng                   │
│  = Không được đụng cho ads hay owner rút!                  │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  MonthlyBurn = 70M
  → SurvivalFloor = 210M
```

### 4.3. AvailableAfterSurvival (Tiền Còn Sau Sống Còn)

```
┌─────────────────────────────────────────────────────────────┐
│  💰 AVAILABLE AFTER SURVIVAL                                 │
│  = max(0, FreeCash - SurvivalFloor)                         │
├─────────────────────────────────────────────────────────────┤
│  = Tiền CÓ THỂ dùng cho ads/owner                          │
│  = SAU KHI đã đảm bảo sống còn 3 tháng                     │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  FreeCash = 350M
  SurvivalFloor = 210M
  → AvailableAfterSurvival = 140M ✅
```

### 4.4. RunwayMonths (Số Tháng Sống Còn)

```
RunwayMonths = FreeCash / MonthlyBurn

Ví dụ:
  FreeCash = 350M
  MonthlyBurn = 70M
  → RunwayMonths = 5.0 tháng

Phân loại:
  ├─ >= 6 tháng → 🟢 AN TOÀN
  ├─ 3-6 tháng  → 🟡 KHÁ ỔN
  ├─ 1-3 tháng  → 🟠 CẢNH BÁO
  └─ < 1 tháng  → 🔴 NGUY HIỂM
```

---

## 5. GROWTH (ADS) - GỢI Ý & NGÂN SÁCH

### 5.1. OptimalAdsSuggestion (Management Accounting - GỢI Ý)

**Khái niệm:** Output từ phân tích performance ads (ROI/CAC/contribution...)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 OPTIMAL ADS SUGGESTION = GỢI Ý, không phải nghĩa vụ    │
├─────────────────────────────────────────────────────────────┤
│  OptimalAdsSuggestion = calcOptimalAdsForNext7Days()        │
│                                                             │
│  Input:                                                     │
│  ├─ Chi phí ads thực tế từng ad group                      │
│  ├─ ROI của từng ad group                                  │
│  ├─ Contribution margin                                     │
│  └─ CAC (Customer Acquisition Cost)                        │
│                                                             │
│  ⚠️ Chỉ là GỢI Ý "nên chi", không phải nghĩa vụ cash       │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.1. RULE CAP 20% - Safety Rule Cho Từng Ad Group

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ QUY TẮC BẢO VỆ: Mỗi ad group KHÔNG tăng quá 20%/ngày  │
├─────────────────────────────────────────────────────────────┤
│  OptimalSpend[g] ≤ SpendYesterday[g] × 1.20                 │
│                                                             │
│  Mục đích:                                                  │
│  ├─ Tránh scale quá nhanh gây rủi ro                       │
│  ├─ Ổn định learning của các nền tảng ads                  │
│  └─ Tránh số liệu nhiễu                                    │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.2. Công Thức Chi Tiết Cho Từng Ad Group

```typescript
// Input cho mỗi ad group g
SpendYesterday[g]     // Chi phí ads THỰC TẾ hôm qua
AvgSpendLast3Days[g]  // Trung bình 3 ngày gần nhất
OptimalRaw[g]         // Gợi ý "thô" từ thuật toán performance

// Configuration
MinStartBudget = 200_000  // 200k - cho nhóm mới
UpperCapMultiplier = 1.20 // Tăng tối đa 20%
LowerCapMultiplier = 0.70 // Giảm tối đa 30% (cắt lỗ nhanh hơn)
```

#### 5.1.3. Baseline Spend (Xử lý edge cases)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 BASELINE SPEND - Xử lý edge cases                       │
├─────────────────────────────────────────────────────────────┤
│  BaselineSpend[g] = max(                                    │
│    SpendYesterday[g],       // Chi hôm qua                  │
│    AvgSpendLast3Days[g],    // TB 3 ngày (tránh outage)    │
│    MinStartBudget           // Min cho nhóm mới             │
│  )                                                          │
├─────────────────────────────────────────────────────────────┤
│  Edge Cases:                                                │
│  1️⃣ Nhóm mới (spend = 0): Dùng MinStartBudget              │
│  2️⃣ Hôm qua lỗi/outage: Dùng AvgSpendLast3Days            │
│  3️⃣ Nhóm bình thường: Dùng SpendYesterday                  │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.4. Upper Cap & Lower Cap

```
┌─────────────────────────────────────────────────────────────┐
│  📈 UPPER CAP (Trần - không tăng quá nhanh)                 │
│  UpperCap[g] = BaselineSpend[g] × 1.20                      │
│                                                             │
│  📉 LOWER CAP (Sàn - cho phép giảm nhanh hơn để cắt lỗ)    │
│  LowerCap[g] = BaselineSpend[g] × 0.70                      │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  Ad Group A:
    SpendYesterday = 10M
    AvgSpendLast3Days = 9M
    → BaselineSpend = 10M
    → UpperCap = 12M (tăng tối đa 20%)
    → LowerCap = 7M (giảm tối đa 30%)
```

#### 5.1.5. OptimalSuggested (Kết quả cuối cùng cho mỗi ad group)

```typescript
// Clamp: giới hạn trong khoảng [min, max]
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Công thức cho mỗi ad group
OptimalSuggested[g] = clamp(
  OptimalRaw[g],    // Gợi ý từ thuật toán
  LowerCap[g],      // Không giảm quá 30%
  UpperCap[g]       // Không tăng quá 20%
)
```

#### 5.1.6. Ví Dụ Cụ Thể

```
Ad Group A (ROI tốt, thuật toán suggest tăng 50%):
  ├─ SpendYesterday: 10M
  ├─ OptimalRaw: 15M (thuật toán gợi ý)
  ├─ UpperCap: 12M (10M × 1.20)
  └─ OptimalSuggested: 12M ✅ (bị chặn ở 20%)

Ad Group B (ROI trung bình, thuật toán suggest tăng 10%):
  ├─ SpendYesterday: 20M
  ├─ OptimalRaw: 22M
  ├─ UpperCap: 24M (20M × 1.20)
  └─ OptimalSuggested: 22M ✅ (dưới cap, OK)

Ad Group C (ROI xấu, thuật toán suggest giảm 50%):
  ├─ SpendYesterday: 10M
  ├─ OptimalRaw: 5M (thuật toán gợi ý giảm)
  ├─ LowerCap: 7M (10M × 0.70)
  └─ OptimalSuggested: 7M ⚠️ (chặn ở -30%, giảm dần)

Ad Group D (Nhóm mới, chưa có data):
  ├─ SpendYesterday: 0
  ├─ MinStartBudget: 200k
  ├─ BaselineSpend: 200k
  ├─ UpperCap: 240k
  └─ OptimalSuggested: 200k-240k ✅ (khởi đầu an toàn)
```

#### 5.1.7. Tổng Hợp Toàn Tài Khoản

```
OptimalAdsSuggestion = Σ OptimalSuggested[g] (tất cả ad groups)

Ví dụ:
  Ad Group A: 12M
  Ad Group B: 22M
  Ad Group C: 7M
  Ad Group D: 0.2M
  ───────────────────
  OptimalAdsSuggestion = 41.2M/ngày
  
  Cho 7 ngày:
  OptimalAdsSuggestion(7D) = 41.2M × 7 = 288.4M
```

### 5.2. AdsBudgetApproved (Cash Management - NGÂN SÁCH THỰC)

```
┌─────────────────────────────────────────────────────────────┐
│  💰 ADS BUDGET APPROVED = NGÂN SÁCH THỰC ĐƯỢC DUYỆT        │
├─────────────────────────────────────────────────────────────┤
│  AdsBudgetApproved = min(                                   │
│    OptimalAdsSuggestion,                                    │
│    AvailableAfterSurvival                                   │
│  )                                                          │
│                                                             │
│  → Ads chỉ được chi trong giới hạn cash                    │
│  → SAU KHI đảm bảo sống còn 3 tháng                        │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  OptimalAdsSuggestion (7D): 288M
  AvailableAfterSurvival: 140M
  
  → AdsBudgetApproved = min(288M, 140M) = 140M ✅
  → Chỉ được chi 140M dù gợi ý 288M (vì cash không đủ)
```

### 5.3. MaxDailyAds (Tốc Độ Scale Theo Chu Kỳ NCC)

```
┌─────────────────────────────────────────────────────────────┐
│  📅 MAX DAILY ADS                                           │
├─────────────────────────────────────────────────────────────┤
│  MaxDailyAds = AdsBudgetApproved / SupplierCashCycleDays   │
│                                                             │
│  SupplierCashCycleDays = N ngày                            │
│  (N = số ngày từ lúc chi ads → lúc NCC trả tiền)           │
│  Default: 10 ngày (nếu chưa có data)                       │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  AdsBudgetApproved: 140M
  SupplierCashCycleDays: 10 ngày
  
  → MaxDailyAds = 140M / 10 = 14M/ngày
  → Có thể nhân safety factor 0.8: 11.2M/ngày
```

---

## 6. OWNER WITHDRAWABLE

```
┌─────────────────────────────────────────────────────────────┐
│  👤 OWNER WITHDRAWABLE = Số tiền Owner có thể rút          │
├─────────────────────────────────────────────────────────────┤
│  OwnerWithdrawable = max(0,                                 │
│    AvailableAfterSurvival - AdsBudgetApproved               │
│  )                                                          │
│                                                             │
│  Thứ tự ưu tiên:                                            │
│  1️⃣ Survival (3 tháng) - TRƯỚC                              │
│  2️⃣ Ads Budget Approved - SAU                               │
│  3️⃣ Phần còn lại → Owner có thể rút                         │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ RULE: Nếu Owner rút > OwnerWithdrawable                │
│  → Hệ thống CHẶN hoặc CẢNH BÁO                             │
│  → "Ảnh hưởng sống còn/khả năng scale"                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.1. Ví Dụ Có Thể Rút

```
FreeCash: 350M
SurvivalFloor: 210M
→ AvailableAfterSurvival: 140M

AdsBudgetApproved: 100M

→ OwnerWithdrawable = 140M - 100M = 40M ✅
→ Owner có thể rút tối đa 40M
```

### 6.2. Ví Dụ Không Thể Rút

```
FreeCash: 250M
SurvivalFloor: 210M
→ AvailableAfterSurvival: 40M

AdsBudgetApproved: 60M (nhưng chỉ có 40M available)
→ AdsBudgetApproved thực tế: 40M

→ OwnerWithdrawable = max(0, 40M - 40M) = 0M ❌
→ Owner KHÔNG thể rút (cần giữ tiền cho survival + ads)
```

---

## 7. FORECAST 7 DAYS (DỰ BÁO 7 NGÀY) - BẮT BUỘC

**Mục tiêu:** Biết 7 ngày tới có bị hụt tiền không, và "đáy tiền" xảy ra ngày nào.

### 7.1. Expected Inflows (Tiền VÀO dự kiến)

```
┌─────────────────────────────────────────────────────────────┐
│  📥 EXPECTED INFLOWS (7D)                                   │
├─────────────────────────────────────────────────────────────┤
│  1. NCC dự kiến trả:                                        │
│     ├─ Đơn đã success chưa nhận tiền (AR NCC)              │
│     ├─ Profile NCC settlement (chu kỳ N ngày/trả theo thứ) │
│     └─ × RiskAdjustInflow (0.8 = chỉ tính 80%)             │
│                                                             │
│  2. Vốn vay dự kiến giải ngân (chỉ tính nếu CHẮC)          │
│                                                             │
│  3. Refund dự kiến (nếu có)                                 │
└─────────────────────────────────────────────────────────────┘

⚠️ RiskAdjustInflow = 0.8
   → Chỉ tính 80% expected NCC payout
   → An toàn với rủi ro hoàn/boom
```

### 7.2. Expected Outflows (Tiền RA dự kiến)

```
┌─────────────────────────────────────────────────────────────┐
│  📤 EXPECTED OUTFLOWS (7D)                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Ads plan theo ngày:                                     │
│     = AdsBudgetApproved / 7 (chia đều)                     │
│     hoặc theo lịch chạy ads thực tế                        │
│                                                             │
│  2. Các khoản due trong 7 ngày:                            │
│     ├─ Lương (từ AP schedule)                              │
│     ├─ Vận hành (từ AP schedule)                           │
│     ├─ Đại lý (từ AP schedule)                             │
│     ├─ Thuế (từ AP schedule)                               │
│     └─ Nợ vay (từ AP schedule)                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3. Forecast Theo Ngày

```
┌─────────────────────────────────────────────────────────────┐
│  📅 FORECAST BANK BALANCE (7 ngày)                          │
├─────────────────────────────────────────────────────────────┤
│  ForecastBank[0] = BankBalance (hôm nay)                   │
│                                                             │
│  Cho mỗi ngày d từ 1..7:                                   │
│  ForecastBank[d] = ForecastBank[d-1]                       │
│                  + ExpectedIn[d]                           │
│                  - ExpectedOut[d]                          │
└─────────────────────────────────────────────────────────────┘
```

### 7.4. Low Point (Đáy Tiền) & Cảnh Báo

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ LOW POINT = min(ForecastBank[1..7])                     │
├─────────────────────────────────────────────────────────────┤
│  Cảnh báo:                                                  │
│  ├─ LowPoint < 0                                           │
│  │   → 🚨 CASH CRUNCH (ĐỨT TIỀN - critical)                │
│  │                                                          │
│  └─ LowPoint < SurvivalFloor                               │
│      → ⚠️ RỦI RO SỐNG CÒN (warning)                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.5. Ví Dụ Bảng Forecast 7 Ngày

```
┌──────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Ngày │ Tiền VÀO    │ Tiền RA     │ Số Dư       │ Status      │
├──────┼─────────────┼─────────────┼─────────────┼─────────────┤
│ T0   │ -           │ -           │ 350M        │ 🟢 Today    │
│ T+1  │ 50M (NCC)   │ 30M (Ads)   │ 370M        │ 🟢          │
│ T+2  │ 0           │ 30M (Ads)   │ 340M        │ 🟢          │
│ T+3  │ 0           │ 80M (Lương) │ 260M        │ 🟡 Near SF  │
│ T+4  │ 100M (NCC)  │ 30M (Ads)   │ 330M        │ 🟢          │
│ T+5  │ 0           │ 30M (Ads)   │ 300M        │ 🟢          │
│ T+6  │ 80M (NCC)   │ 30M (Ads)   │ 350M        │ 🟢          │
│ T+7  │ 0           │ 30M (Ads)   │ 320M        │ 🟢          │
├──────┴─────────────┴─────────────┴─────────────┴─────────────┤
│ LOW POINT: 260M @ T+3 (Ngày trả lương)                      │
│ SurvivalFloor: 210M                                          │
│ Status: ✅ OK - LowPoint > SurvivalFloor                     │
└─────────────────────────────────────────────────────────────┘
```

### 7.6. Forecast Free Cash (Nâng cao)

```
Có thể tính tương tự:
  ForecastCommitted[d] = Tổng khoản đến hạn trong window tại ngày d
  ForecastFreeCash[d] = ForecastBank[d] - ForecastCommitted[d]
```

---

## 8. DASHBOARD TỐI THIỂU (CEO/CFO)

**Mỗi ngày chỉ cần hiển thị 8 số:**

```
┌─────────────────────────────────────────────────────────────┐
│  💰 FINANCIAL CONTROL DASHBOARD                              │
├─────────────────────────────────────────────────────────────┤
│  1. 🏦 Bank Balance (Now)           450,000,000 VNĐ         │
│  2. 📌 Committed (14D)              100,000,000 VNĐ         │
│  3. 🚀 Free Cash (Now)              350,000,000 VNĐ         │
│  4. 🔥 Monthly Burn                  70,000,000 VNĐ         │
│  5. ⏱️ Runway                        5.0 tháng 🟢           │
│  6. 📈 Ads Budget Approved (7D)     140,000,000 VNĐ         │
│  7. 👤 Owner Withdrawable (Now)      40,000,000 VNĐ         │
│  8. ⚠️ Forecast 7D Low Point        T+3: 260M 🟢            │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. PSEUDOCODE TỔNG HỢP (CHO DEVELOPER)

```typescript
// ═══════════════════════════════════════════════════════════
// CONFIGURATION DEFAULTS
// ═══════════════════════════════════════════════════════════
const CONFIG = {
  CommittedWindowDays: 14,          // Cửa sổ cam kết
  SurvivalMonths: 3,                // Số tháng sống còn
  SupplierCashCycleDays: 10,        // Chu kỳ NCC trả tiền
  RiskAdjustInflow: 0.80,           // Hệ số an toàn inflow
  MinStartBudget: 200_000,          // Budget min cho ad group mới
  UpperCapMultiplier: 1.20,         // Tăng tối đa 20%
  LowerCapMultiplier: 0.70,         // Giảm tối đa 30%
  SafetyFactor: 0.80,               // Safety factor cho daily ads
};

// ═══════════════════════════════════════════════════════════
// CORE CASH CALCULATIONS
// ═══════════════════════════════════════════════════════════
function calculateCashMetrics(bankBalance: number): CashMetrics {
  // 1. Committed Cash
  const committedCash = calcCommittedCash(CONFIG.CommittedWindowDays);
  
  // 2. Free Cash
  const freeCash = bankBalance - committedCash;
  
  // 3. Survival
  const monthlyBurn = calcMonthlyBurn();
  const survivalFloor = CONFIG.SurvivalMonths * monthlyBurn;
  const availableAfterSurvival = Math.max(0, freeCash - survivalFloor);
  const runwayMonths = freeCash / monthlyBurn;
  
  return { committedCash, freeCash, monthlyBurn, survivalFloor, 
           availableAfterSurvival, runwayMonths };
}

// ═══════════════════════════════════════════════════════════
// OPTIMAL ADS SUGGESTION (Management Accounting)
// ═══════════════════════════════════════════════════════════
function calcOptimalAdsSuggestion(adGroups: AdGroup[]): number {
  let totalOptimal = 0;
  
  for (const g of adGroups) {
    // 1. Baseline (xử lý edge cases)
    const baseline = Math.max(
      g.spendYesterday,
      g.avgSpendLast3Days,
      CONFIG.MinStartBudget
    );
    
    // 2. Caps
    const upperCap = baseline * CONFIG.UpperCapMultiplier;
    const lowerCap = baseline * CONFIG.LowerCapMultiplier;
    
    // 3. Clamp optimal raw
    const optimalSuggested = clamp(g.optimalRaw, lowerCap, upperCap);
    
    totalOptimal += optimalSuggested;
  }
  
  return totalOptimal * 7; // 7 ngày tới
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ═══════════════════════════════════════════════════════════
// ADS BUDGET APPROVED (Cash Management)
// ═══════════════════════════════════════════════════════════
function calcAdsBudgetApproved(
  optimalAdsSuggestion: number, 
  availableAfterSurvival: number
): number {
  return Math.min(optimalAdsSuggestion, availableAfterSurvival);
}

function calcMaxDailyAds(adsBudgetApproved: number): number {
  const raw = adsBudgetApproved / CONFIG.SupplierCashCycleDays;
  return raw * CONFIG.SafetyFactor;
}

// ═══════════════════════════════════════════════════════════
// OWNER WITHDRAWABLE
// ═══════════════════════════════════════════════════════════
function calcOwnerWithdrawable(
  availableAfterSurvival: number,
  adsBudgetApproved: number
): number {
  return Math.max(0, availableAfterSurvival - adsBudgetApproved);
}

// ═══════════════════════════════════════════════════════════
// FORECAST 7 DAYS
// ═══════════════════════════════════════════════════════════
interface ForecastDay {
  day: number;
  expectedIn: number;
  expectedOut: number;
  forecastBank: number;
}

function calcForecast7Days(bankBalance: number): Forecast7D {
  const forecast: ForecastDay[] = [];
  let currentBalance = bankBalance;
  
  for (let d = 1; d <= 7; d++) {
    const expectedIn = calcExpectedInflow(d) * CONFIG.RiskAdjustInflow;
    const expectedOut = calcExpectedOutflow(d);
    currentBalance = currentBalance + expectedIn - expectedOut;
    
    forecast.push({
      day: d,
      expectedIn,
      expectedOut,
      forecastBank: currentBalance
    });
  }
  
  // Low Point
  const lowPoint = Math.min(...forecast.map(f => f.forecastBank));
  const lowPointDay = forecast.find(f => f.forecastBank === lowPoint)?.day || 0;
  
  return {
    forecast,
    lowPoint,
    lowPointDay,
    isCashCrunch: lowPoint < 0,
    isSurvivalRisk: lowPoint < calcSurvivalFloor()
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN CALCULATION
// ═══════════════════════════════════════════════════════════
function calculateFinancialControl(bankBalance: number, adGroups: AdGroup[]) {
  // 1. Core cash
  const cash = calculateCashMetrics(bankBalance);
  
  // 2. Ads
  const optimalAdsSuggestion = calcOptimalAdsSuggestion(adGroups);
  const adsBudgetApproved = calcAdsBudgetApproved(
    optimalAdsSuggestion, 
    cash.availableAfterSurvival
  );
  const maxDailyAds = calcMaxDailyAds(adsBudgetApproved);
  
  // 3. Owner
  const ownerWithdrawable = calcOwnerWithdrawable(
    cash.availableAfterSurvival,
    adsBudgetApproved
  );
  
  // 4. Forecast
  const forecast7D = calcForecast7Days(bankBalance);
  
  return {
    // Dashboard 8 số
    bankBalance,
    committedCash: cash.committedCash,
    freeCash: cash.freeCash,
    monthlyBurn: cash.monthlyBurn,
    runwayMonths: cash.runwayMonths,
    adsBudgetApproved,
    ownerWithdrawable,
    forecast7DLowPoint: {
      amount: forecast7D.lowPoint,
      day: forecast7D.lowPointDay
    },
    
    // Chi tiết
    survivalFloor: cash.survivalFloor,
    availableAfterSurvival: cash.availableAfterSurvival,
    optimalAdsSuggestion,
    maxDailyAds,
    forecast7D: forecast7D.forecast,
    isCashCrunch: forecast7D.isCashCrunch,
    isSurvivalRisk: forecast7D.isSurvivalRisk
  };
}
```

---

## 📝 GHI CHÚ QUAN TRỌNG (Để tránh rối)

| Khái niệm | Ý nghĩa | Loại |
|-----------|---------|------|
| **Committed** | "Must pay soon" (approved + due trong window) | Cash |
| **Ads Suggestion** | Gợi ý hiệu quả (không phải committed) | Management |
| **AdsBudgetApproved** | Mức cash cho phép (phụ thuộc survival) | Cash |
| **OwnerWithdrawable** | Tiền owner có thể rút an toàn | Cash |
| **Forecast 7D** | Dự đoán tương lai để chặn rủi ro | Forecast |
| **Rule 20%** | Mỗi ad group không tăng > 20%/ngày | Safety |

---

## ⚙️ CONFIG DEFAULTS

```typescript
const DEFAULTS = {
  CommittedWindowDays: 14,          // Cửa sổ committed
  SurvivalMonths: 3,                // Số tháng survival floor
  SupplierCashCycleDays: 10,        // Lấy từ profile NCC
  RiskAdjustInflow: 0.80,           // Chỉ tính 80% expected inflow
  MinStartBudget: 200_000,          // 200k cho ad group mới
  UpperCapMultiplier: 1.20,         // Tăng max 20%/ngày
  LowerCapMultiplier: 0.70,         // Giảm max 30%/ngày
  SafetyFactor: 0.80,               // Safety cho daily ads
};
```

---

## ✅ CHECKLIST IMPLEMENTATION

- [ ] **Bank Balance**: Reconcile từ bank statement
- [ ] **Committed Cash**: Filter AP theo window 14D + approved + due
- [ ] **Free Cash**: BankBalance - CommittedCash
- [ ] **Monthly Burn**: Lương core + vận hành bắt buộc
- [ ] **Survival Floor**: 3 × MonthlyBurn
- [ ] **AvailableAfterSurvival**: max(0, FreeCash - SurvivalFloor)
- [ ] **Runway**: FreeCash / MonthlyBurn
- [ ] **Optimal Ads Suggestion**: Với rule 20% cap per ad group
- [ ] **Ads Budget Approved**: min(Suggestion, AvailableAfterSurvival)
- [ ] **Max Daily Ads**: AdsBudgetApproved / SupplierCashCycleDays
- [ ] **Owner Withdrawable**: max(0, AvailableAfterSurvival - AdsBudgetApproved)
- [ ] **Forecast 7D**: ForecastBank[d] = ForecastBank[d-1] + In[d] - Out[d]
- [ ] **Low Point Detection**: min(ForecastBank[1..7])
- [ ] **Alerts**: Cash crunch, Survival risk

---

**END OF SPEC v3.0**
