# FINANCIAL CONTROL - LÀM RÕ TẤT CẢ
**Version:** 2.0 - Feb 3, 2026  
**Mục tiêu:** Giải thích RÕ RÀNG, KHÔNG LẪN LỘN tất cả khái niệm

---

## 📚 MỤC LỤC
1. [Các Khái Niệm Cốt Lõi](#1-các-khái-niệm-cốt-lõi)
2. [Công Thức Bank Balance](#2-công-thức-bank-balance)
3. [4 Quỹ Trong Hệ Thống](#3-4-quỹ-trong-hệ-thống)
4. [Cash Flow vs Business Performance](#4-cash-flow-vs-business-performance)
5. [Quyết Định Scale](#5-quyết-định-scale)
6. [Ví Dụ Thực Tế Hoàn Chỉnh](#6-ví-dụ-thực-tế-hoàn-chỉnh)
7. [Câu Hỏi Thường Gặp](#7-câu-hỏi-thường-gặp)

---

## 1. CÁC KHÁI NIỆM CỐT LÕI

### 1.1. NGUỒN TIỀN (Sources - Tiền VÀO)

```
┌─────────────────────────────────────┐
│  NGUỒN TIỀN (Cash Inflows)          │
├─────────────────────────────────────┤
│  1. Vốn Vay (Loans)                 │
│  2. Vốn Cá Nhân (Personal Capital)  │
│  3. Doanh Thu ĐÃ NHẬN (Revenue)     │
│     = COD - Tiền nhập hàng          │
│     ✅ NCC đã thanh toán            │
│                                     │
│  4. Doanh Thu CHỜ ĐỐI SOÁT          │
│     = Đơn đã giao, NCC chưa trả     │
│     ⏳ Đang chờ thanh toán          │
└─────────────────────────────────────┘
```

**CHÚ Ý QUAN TRỌNG**:
- **Vốn vay + Vốn cá nhân** = **Seed Capital** (Vốn ban đầu)
- **Doanh thu** phải phân biệt 2 loại:
  - ✅ **Đã nhận**: NCC đã chuyển tiền → VÀO Bank Balance
  - ⏳ **Chờ đối soát**: NCC chưa trả → KHÔNG vào Bank Balance

### 1.2. TIÊU TIỀN (Uses - Tiền RA)

```
┌─────────────────────────────────────┐
│  TIÊU TIỀN (Cash Outflows)          │
├─────────────────────────────────────┤
│  1. Chi Phí Ads (đã chi)             │
│  2. Lương (đã trả)                  │
│  3. Vận Hành (đã trả)               │
│  4. Hoa Hồng Đại Lý (đã trả)        │
│  5. Owner Đã Rút                    │
│  6. Thuế Đã Đóng                    │
│  7. Trả Nợ (đã trả, nếu có)         │
└─────────────────────────────────────┘
```

### 1.3. BANK BALANCE (Số Dư Ngân Hàng)

**CÔNG THỨC HOẠT ĐỘNG (Operational - Theo Ngày)**:
```
Bank Balance(t) = Bank Balance(t-1) + Cash In(t) - Cash Out(t) + Reconcile(t)

📥 TIỀN VÀO hôm nay (Cash Inflows - Daily):
    + Vốn vay giải ngân hôm nay
    + Vốn cá nhân bổ sung hôm nay
    + Doanh thu ĐÃ THU hôm nay từ NCC
      → supplierPaymentStatus: "paid"
      → supplierPaidAt: hôm nay
  
📤 TIỀN RA hôm nay (Cash Outflows - Daily):
    - Chi phí Ads đã chi hôm nay
    - Lương đã trả hôm nay
    - Vận hành đã trả hôm nay
    - Hoa hồng đại lý đã trả hôm nay
    - Owner đã rút hôm nay
    - Thuế đã đóng hôm nay
    - Trả nợ hôm nay (nếu có)

🔄 RECONCILE (Điều chỉnh đối soát):
    ± Chênh lệch đối soát với bank statement
    ± Phí ngân hàng phát sinh
    ± Lãi tiền gửi (nếu có)

= SỐ DỰ NGÂN HÀNG CUỐI NGÀY

⚠️ CHÚ Ý:
  - Công thức THEO NGÀY cho hoạt động hàng ngày
  - Bank Balance(t-1) = số dư cuối ngày hôm qua
  - Reconcile đảm bảo khớp với bank statement thực tế
```

**CÔNG THỨC AUDIT (Tích Lũy - Kiểm Tra)**:
```
Bank Balance = TÍCH LŨY (Tổng Cash In - Tổng Cash Out từ đầu)

📊 Mục đích: AUDIT và KIỂM CHỨNG
  - Dùng để verify Bank Balance(t) có đúng không
  - Chạy định kỳ (cuối tuần, cuối tháng)
  - So sánh với bank statement
  
Kiểm chứng:
  Bank Balance(t) = Bank Balance(0) + Σ(Cash In) - Σ(Cash Out) + Σ(Reconcile)
  
⚠️ KHÔNG dùng công thức tích lũy cho hoạt động hàng ngày
   (vì phải tính lại toàn bộ từ đầu, chậm và không cần thiết)
```

**QUAN TRỌNG - Phân biệt 2 loại doanh thu**:

```
┌────────────────────────────────────────────────┐
│  DOANH THU ĐÃ THU (Cash Collected)            │
│  supplierPaymentStatus: "paid"                 │
│  supplierPaidAt: có giá trị                    │
│  ────────────────────────────────────────────  │
│  → ✅ TÍNH VÀO Bank Balance                   │
│  → ✅ Tiền đã THỰC SỰ về tài khoản             │
│  → ✅ Có thể chi tiêu ngay                     │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  PHẢI THU TỪ NCC (Receivable from Supplier)   │
│  supplierPaymentStatus: "pending"              │
│  orderStatus: "Giao thành công"                │
│  ────────────────────────────────────────────  │
│  → ❌ CHƯA tính vào Bank Balance               │
│  → ⏳ Chờ NCC thanh toán (đối soát)            │
│  → 📊 Theo dõi riêng (A/R - Accounts Receivable)│
│  → 💡 Khác với "doanh thu dự kiến"             │
└────────────────────────────────────────────────┘
```

**VÍ DỤ:**
```
Vốn ban đầu:        500,000,000 VNĐ
Doanh thu đã nhận:  300,000,000 VNĐ ✅ (NCC đã trả)
Doanh thu chờ NCC:  100,000,000 VNĐ ⏳ (chưa tính)
Chi phí ads:       -200,000,000 VNĐ
Lương:              -50,000,000 VNĐ
Vận hành:           -20,000,000 VNĐ
Đại lý:             -30,000,000 VNĐ
Owner rút:          -50,000,000 VNĐ
─────────────────────────────────────
Bank Balance:       450,000,000 VNĐ
─────────────────────────────────────

Ghi chú: 100M đang chờ NCC trả, khi nhận được 
sẽ tăng Bank Balance lên 550M
```

---

## 2. CÔNG THỨC BANK BALANCE

### 2.1. Công Thức Hoạt Động (Theo Ngày)

```typescript
// CÔNG THỨC HOẠT ĐỘNG (Daily Operational)
Bank Balance(t) = Bank Balance(t-1) + Cash In(t) - Cash Out(t) + Reconcile(t)

// Chi tiết:
Cash In(t) = Tiền VÀO trong ngày t
  + Vốn Vay giải ngân ngày t
  + Vốn Cá Nhân bổ sung ngày t
  + Doanh Thu đã thu ngày t (từ NCC)

Cash Out(t) = Tiền RA trong ngày t
  + Chi Phí Ads ngày t
  + Lương trả ngày t
  + Vận Hành trả ngày t
  + Hoa Hồng Đại Lý trả ngày t
  + Owner rút ngày t
  + Thuế đóng ngày t
  + Trả nợ ngày t (nếu có)

Reconcile(t) = Điều chỉnh đối soát ngày t
  ± Chênh lệch với bank statement
  ± Phí ngân hàng
  ± Lãi tiền gửi

// ⚠️ QUAN TRỌNG:
// - Bank Balance(t-1) = số dư cuối ngày hôm qua
// - Dùng công thức này cho HOẠT ĐỘNG HÀNG NGÀY
// - Reconcile đảm bảo khớp với thực tế ngân hàng
```

### 2.1A. Công Thức Audit (Tích Lũy - Kiểm Tra)

```typescript
// CÔNG THỨC AUDIT (Cumulative - For Verification)
Bank Balance(t) = Bank Balance(0) + Σ(Cash In) - Σ(Cash Out) + Σ(Reconcile)

// Chi tiết:
Σ(Cash In) = Tổng TÍCH LŨY tiền VÀO từ ngày 0 → t
Σ(Cash Out) = Tổng TÍCH LŨY tiền RA từ ngày 0 → t
Σ(Reconcile) = Tổng TÍCH LŨY điều chỉnh từ ngày 0 → t

// Mục đích:
// - AUDIT định kỳ (cuối tuần, cuối tháng)
// - KIỂM CHỨNG Bank Balance(t) có chính xác không
// - So sánh với bank statement

// ⚠️ KHÔNG dùng cho hoạt động hàng ngày
//    (vì phải tính lại toàn bộ, chậm và không hiệu quả)
```

### 2.2. QUAN TRỌNG: Phân Biệt "Đã" vs "Chưa"

#### A. TIỀN VÀO (Revenue - Doanh Thu)

```
✅ ĐÃ NHẬN → Cộng vào Bank Balance
   - Supplier Payment Status: "paid"
   - Supplier Paid At: có ngày tháng
   - Supplier Paid Amount: số tiền thực nhận
   
   → VÍ DỤ:
   Đơn hàng 10M, NCC đã chuyển tiền
   → Bank Balance +10M

❌ CHƯA NHẬN → KHÔNG vào Bank Balance
   - Supplier Payment Status: "pending"
   - Order Status: "Giao thành công"
   - Chờ NCC đối soát & thanh toán
   
   → VÍ DỤ:
   Đơn hàng 15M, đã giao nhưng NCC chưa trả
   → Bank Balance: không đổi
   → Theo dõi ở "Phải thu NCC" (A/R)
```

#### B. TIỀN RA (Expenses - Chi Phí)

```
✅ ĐÃ THANH TOÁN → Trừ khỏi Bank Balance
   - Lương đã trả (status: closed)
   - Vận hành đã xác nhận (isConfirmed: true)
   - Đại lý đã thanh toán (agentPaymentStatus: paid)

❌ CHƯA THANH TOÁN → KHÔNG trừ Bank Balance
   - Lương chưa trả (status: draft/open)
   - Vận hành chưa xác nhận (isConfirmed: false)
   - Đại lý chưa thanh toán (agentPaymentStatus: pending)
   
   → Những cái này vào COMMITTED CASH (Quỹ Đặt Chỗ)
```

#### C. VÍ DỤ TỔNG HỢP

```
TÌNH HUỐNG:
- 10 đơn giao thành công, tổng COD 100M
  ├─ 7 đơn: NCC đã trả = 70M ✅
  └─ 3 đơn: NCC chưa trả = 30M ⏳

- Lương tháng này 50M
  ├─ Đã trả: 0M (chưa đến ngày trả)
  └─ Chưa trả: 50M

KẾT QUẢ:
  Bank Balance:
    + 70M (doanh thu đã nhận) ✅
    - 0M (lương chưa trả)
  
  Committed Cash:
    + 50M (lương phải trả)
  
  Pending Revenue:
    + 30M (chờ NCC trả)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bank Balance: +70M
Committed Cash: 50M
Free Cash: 70M - 50M = 20M
Pending từ NCC: 30M (chưa về)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 3. 4 QUỸ TRONG HỆ THỐNG

### 3.1. QUỸ 1: COMMITTED CASH (Tiền Đã Cam Kết)

**Khái niệm**: Nghĩa vụ GIÁN HẠN cần thanh toán (subset của AP)

```
Committed Cash = SUBSET của Accounts Payable (AP)

CONFIGURATION:
  CommittedWindowDays = 14 ngày (cấu hình hệ thống)
  
  Lựa chọn theo doanh nghiệp:
  • 7 ngày: Rất cẩn trọng (startup, cashflow chặt)
  • 14 ngày: Cân bằng (khuyến nghị - default) ✅
  • 30 ngày: Linh hoạt (doanh nghiệp lớn, cashflow tốt)

Lọc theo:
  • Due date: Đến hạn trong CommittedWindowDays (14 ngày) tới
  • Payment status: "pending" hoặc "approved"
  • Priority: Không thể trì hoãn
  • Approved: Đã duyệt (isApproved: true)

Chi tiết:
  + Chi phí NCC (purchaseCost, đã duyệt, đến hạn ≤14 ngày)
  + Lương nhân công (chưa trả, đến hạn ≤14 ngày)
  + Hoa hồng đại lý (đơn đã giao, chờ trả, đến hạn ≤14 ngày)
  + Chi phí cố định (thuê mb, dịch vụ, đến hạn ≤14 ngày)
  + Trả nợ kỳ này (nếu có, đến hạn ≤14 ngày)

⚠️ CHÚ Ý:
  - Committed Cash ≠ Toàn bộ Accounts Payable
  - Chỉ là PHẦN ĐẾN HẠN TRONG 14 NGÀY và ĐÃ DUYỆT
  - AP dài hạn (>14 ngày) KHÔNG nằm trong Committed Cash
  - Có thể điều chỉnh CommittedWindowDays theo nhu cầu
```

**Đặc điểm**:
- ❌ KHÔNG phải tiền đã chi (nếu đã chi thì trừ Bank Balance rồi)
- ✅ Là NGHĨA VỤ phải trả trong vài ngày tới
- ⚠️ Phải "đặt chỗ" để đảm bảo có tiền trả khi đến hạn
- 📊 Chỉ tính các khoản ĐÃ DUYỆT, không tính dự kiến

**Ví dụ**:
```
Hôm nay 3/2/2026:
- Lương tháng 2: 50M (chưa trả, sẽ trả 5/2) ✅ GẦN HẠN
- Vận hành: 20M (đã duyệt, thanh toán 10/2) ✅ GẦN HẠN
- Đại lý: 30M (đơn đã giao, thanh toán 15/2) ✅ GẦN HẠN
- Chi phí NCC: 200M (chưa duyệt) ❌ KHÔNG TÍNH
- Lương tháng 3: 50M (thanh toán 5/3) ❌ QUÁ DÀI HẠN

→ Committed Cash = 100M (chỉ 3 khoản đầu)

Nghĩa: Phải dành 100M để trả các khoản ĐẾN HẠN GÍAN!
```

### 3.2. QUỸ 2: ADS FUND (Quỹ Quảng Cáo)

#### 3.2A. OPTIMAL ADS SPEND SUGGESTION (Kế Toán Quản Trị - Gợi Ý)

**Khái niệm**: Gợi ý chi phí ads TỐI ƯU dựa trên phân tích performance

```
┌─────────────────────────────────────────────────────────┐
│  📊 OPTIMAL ADS SPEND SUGGESTION                        │
│  (Management Accounting - GỢI Ý HIỆU QUẢ)              │
├─────────────────────────────────────────────────────────┤
│  Nguồn dữ liệu:                                         │
│  ├─ Chi phí ads thực tế của từng ad group              │
│  ├─ Lợi nhuận thuần từ ads của từng ad group           │
│  ├─ ROI của từng ad group                              │
│  └─ Thuật toán tối ưu hóa                              │
│                                                         │
│  Kết quả:                                               │
│  ├─ Hôm qua: Optimal spend hôm qua nên là bao nhiêu    │
│  └─ 7 ngày tới: Optimal spend cho 7 ngày tới           │
│                                                         │
│  ⚠️ KHÔNG liên quan đến DÒNG TIỀN                      │
│  → Chỉ là GỢI Ý dựa trên HIỆU QUẢ KINH DOANH           │
└─────────────────────────────────────────────────────────┘

Công thức cho mỗi Ad Group:

OptimalSpend(AdGroup) = f(ROI, Contribution, CAC, ...)

QUY TẮC BẢO VỆ (Safety Rule):
OptimalSpend(AdGroup, today) ≤ SpentYesterday(AdGroup) × 1.20

💡 Ý nghĩa:
  - Mỗi ad group chỉ gợi ý TĂNG tối đa 20% so với hôm qua
  - Tránh scale quá nhanh gây rủi ro
  - Nếu thuật toán suggest tăng 50% → chặn lại 20%
  
Ví dụ:
  Ad Group A hôm qua chi: 10M
  Thuật toán suggest: 15M (tăng 50%)
  → Chặn lại: 12M (tăng 20%) ✅
  
  Ad Group B hôm qua chi: 20M  
  Thuật toán suggest: 22M (tăng 10%)
  → OK: 22M (dưới 20%) ✅

Tổng Optimal Ads Suggestion:
OptimalAdsSuggestion(7D) = Σ OptimalSpend(AdGroup) for next 7 days
```

#### 3.2B. ADS BUDGET APPROVED (Cash Management - Ngân Sách Thực)

**Khái niệm**: Ngân sách ads ĐƯỢC DUYỆT dựa trên cash khả dụng

```
┌─────────────────────────────────────────────────────────┐
│  💰 ADS BUDGET APPROVED                                 │
│  (Cash Flow Management - NGÂN SÁCH THỰC)                │
├─────────────────────────────────────────────────────────┤
│  AdsBudgetApproved = min(                               │
│    OptimalAdsSuggestion,                                │
│    AvailableAfterSurvival                               │
│  )                                                      │
│                                                         │
│  Trong đó:                                              │
│  - OptimalAdsSuggestion: Gợi ý từ kế toán quản trị    │
│  - AvailableAfterSurvival: Tiền còn sau survival       │
│                                                         │
│  → Ads chỉ được chi trong giới hạn cash SAU KHI        │
│     đảm bảo SỐNG CÒN 3 tháng                           │
└─────────────────────────────────────────────────────────┘

Ví dụ:
  FreeCash: 500M
  SurvivalFloor (3mo): 210M
  AvailableAfterSurvival: 290M
  
  OptimalAdsSuggestion (7D): 350M (từ phân tích)
  
  → AdsBudgetApproved = min(350M, 290M) = 290M ✅
  → Chỉ được chi 290M dù gợi ý 350M (vì cash không đủ)

Max Daily Ads:
MaxDailyAds = AdsBudgetApproved / SupplierCashCycleDays

Ví dụ:
  AdsBudgetApproved: 290M
  SupplierCashCycleDays: 10 ngày
  → MaxDailyAds = 29M/ngày
```

#### 3.2C. ADS FUND (Legacy - Phân Bổ Lợi Nhuận)

**Khái niệm**: Ngân sách MỤC ĐÍCH cho marketing (theo phân bổ lợi nhuận)

```
Ads Fund (Allocation) = 
  45% Vốn ban đầu
  + 45% Lợi nhuận thuần tái đầu tư
  - Chi phí Ads đã chi
```

**Công thức chi tiết**:
```typescript
// 1. Từ vốn ban đầu
fromInitialCapital = Seed Capital × 0.45

// 2. Từ lợi nhuận
Lợi nhuận thuần = Doanh thu - Chi phí
fromReinvestment = Lợi nhuận thuần × 0.45

// 3. Tổng ngân sách
totalAdsBudget = fromInitialCapital + fromReinvestment

// 4. Còn lại
Ads Fund = totalAdsBudget - Ads đã chi
```

**Ví dụ**:
```
Seed Capital:      500M
→ 45% = 225M

Lợi nhuận thuần:   100M
→ 45% = 45M

Total Ads Budget:  270M
Ads đã chi:       -200M
─────────────────────
Ads Fund còn:      70M
```

**Đặc điểm**:
- ✅ Chỉ được dùng để chạy ads
- ❌ KHÔNG được dùng cho lương, vận hành
- 📊 Có daily budget suggestion

### 3.3. QUỸ 3: RESERVE FUND (Quỹ Dự Trữ)

**Khái niệm**: Quỹ AN TOÀN để duy trì hoạt động 3 tháng

**Tích lũy**:
```
Mỗi tháng có lợi nhuận → Phân bổ 20% vào Reserve
```

**Target**:
```
Reserve Target = (Lương TB + Vận hành TB) × 3 tháng
```

**Health**:
```
Reserve Health % = (Reserve hiện tại / Target) × 100%

Status:
├─ >= 100% → ✅ SUFFICIENT (đủ 3 tháng)
├─  50-99% → ⚠️  BUILDING (đang tích lũy)
└─  < 50%  → 🚨 CRITICAL (nguy hiểm)
```

**Ví dụ**:
```
Lương TB:          50M/tháng
Vận hành TB:       20M/tháng
Chi phí cố định:   70M/tháng

Target:            70M × 3 = 210M

Tháng 1: Lợi nhuận 100M → Reserve +20M = 20M
  Health: 20/210 = 9.5% 🚨 CRITICAL
  
Tháng 5: Reserve tích lũy = 100M
  Health: 100/210 = 48% 🚨 gần đạt

Tháng 10: Reserve = 210M
  Health: 210/210 = 100% ✅ SUFFICIENT
  Survival: 3.0 tháng
```

**Đặc điểm**:
- 🛡️ Chỉ dùng khi KHỦNG HOẢNG
- ❌ KHÔNG dùng cho ads, bonus, scale
- ⚠️ Cần Director approve nếu dùng

### 3.4. QUỸ 4: OWNER FUND (Quỹ Owner)

**Khái niệm**: Thu nhập chủ doanh nghiệp

**Phân bổ**:
```
Owner Fund Allocated = 35% Lợi nhuận thuần
(Phân bổ mục đích cho Owner - chưa rút)
```

**PHÂN BIỆT 3 KHÁI NIỆM**:
```
┌────────────────────────────────────────────────────────────┐
│  1️⃣ OWNER FUND ALLOCATED (Đã Phân Bổ)                     │
│  = 35% profit thuộc về Owner                              │
│  → Số tiền MỤC ĐÍCH cho Owner                             │
│  → KHÔNG thay đổi dù Owner có rút hay không               │
│                                                            │
│  2️⃣ OWNER FUND RETAINED (Đang Giữ Lại)                    │
│  = Allocated - Withdrawn                                  │
│  → Tiền Owner CHƯA RÚT, còn trong công ty                 │
│  → Giảm dần khi Owner rút tiền                            │
│                                                            │
│  3️⃣ OWNER WITHDRAWN (Đã Rút Ra)                           │
│  = Tổng tiền Owner đã rút về cá nhân                      │
│  → RA NGOÀI công ty, KHÔNG CÒN trong Bank Balance         │
│  → Tăng dần theo thời gian                                │
└────────────────────────────────────────────────────────────┘
```

**ĐẶC ĐIỂM QUAN TRỌNG**:
```
❗ Owner RÚT TIỀN = OUT khỏi hệ thống

Khi owner rút:
  Bank Balance ↓ (giảm)
  Owner Fund Retained ↓ (giảm)
  Owner Withdrawn ↑ (tăng)
  
  → Tiền đã RÁ KHỎI công ty!
  → Owner Fund Allocated KHÔNG ĐỔI (vẫn là 35% profit)
```

**Ví dụ Chi Tiết**:
```
Tháng 1: Lợi nhuận 100M
  Owner Fund Allocated: +35M (35% profit)
  Owner Fund Retained: 35M (chưa rút)
  Owner Withdrawn: 0M
  Bank Balance: không đổi

Tháng 2: Lợi nhuận 100M, Owner rút 20M
  Owner Fund Allocated: +35M (35% profit tháng 2)
  → Tổng Allocated: 70M (35M + 35M)
  
  Owner rút 20M:
  → Bank Balance: -20M
  → Owner Fund Retained: 70M - 20M = 50M
  → Owner Withdrawn: 20M (đã ra ngoài)

Tháng 3: Lợi nhuận 100M, Owner rút 30M
  Owner Fund Allocated: +35M (35% profit tháng 3)
  → Tổng Allocated: 105M (70M + 35M)
  
  Owner rút 30M:
  → Bank Balance: -30M
  → Owner Fund Retained: 105M - (20M + 30M) = 55M
  → Owner Withdrawn: 50M (20M + 30M)
```

**Công Thức Tổng Quát**:
```
Owner Fund Allocated = Σ(35% × Profit mỗi tháng)
Owner Fund Retained = Allocated - Total Withdrawn
Owner Withdrawn = Σ(Số tiền đã rút)

Kiểm chứng:
  Allocated = Retained + Withdrawn
```

**OWNER WITHDRAWABLE (Số Tiền Owner CÓ THỂ RÚT NGAY)**:
```
┌─────────────────────────────────────────────────────────────┐
│  👤 OWNER WITHDRAWABLE (Cash Flow Management)               │
├─────────────────────────────────────────────────────────────┤
│  OwnerWithdrawable = max(0,                                 │
│    AvailableAfterSurvival - AdsBudgetApproved               │
│  )                                                          │
│                                                             │
│  Giải thích:                                                │
│  1. Đảm bảo Survival (3 tháng) TRƯỚC                       │
│  2. Dành tiền cho Ads (theo budget approved) SAU           │
│  3. Phần còn lại → Owner có thể rút                        │
│                                                             │
│  ⚠️ RULE: Nếu Owner rút > OwnerWithdrawable                │
│     → Hệ thống CHẶN hoặc CẢNH BÁO ảnh hưởng sống còn/scale│
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  FreeCash: 500M
  SurvivalFloor: 210M
  → AvailableAfterSurvival: 290M
  
  AdsBudgetApproved: 200M (từ optimal suggestion)
  
  → OwnerWithdrawable = 290M - 200M = 90M ✅
  
Trường hợp không đủ:
  FreeCash: 300M
  SurvivalFloor: 280M
  → AvailableAfterSurvival: 20M
  
  AdsBudgetApproved: 50M
  → OwnerWithdrawable = max(0, 20M - 50M) = 0M ❌
  → Owner KHÔNG thể rút (cần giữ tiền cho survival + ads)
```

**Quản lý**:
- 📝 Module riêng: Owner Fund Management
- 🔄 Workflow: Tạo phiếu rút → Kiểm tra Withdrawable → Duyệt → Thanh toán
- 💰 Retained tính vào Bank Balance, Withdrawn RA NGOÀI
- 📊 Theo dõi: Allocated, Retained, Withdrawn, **Withdrawable** (real-time)
- ⚠️ Chặn rút nếu vượt Withdrawable (bảo vệ survival & growth)

---

## 4. CASH FLOW vs BUSINESS PERFORMANCE

### 4.1. CASH FLOW (Dòng Tiền) - Quyết Định SỰ SỐNG CÒN

**Mục đích**: 
- Quyết định SỰ SỐNG CÒN của doanh nghiệp
- Quyết định TỐC ĐỘ SCALE
- Xác định SỐ TIỀN CÓ THỂ RÚT mà không ảnh hưởng hoạt động
- DỰ BÁO dòng tiền

```
┌─────────────────────────────────────────────────────────────┐
│  💰 DÒNG TIỀN (CASH FLOW)                                   │
│  Quyết định: Sống còn • Tốc độ scale • Rút tiền • Dự báo   │
├─────────────────────────────────────────────────────────────┤
│  🏦 Số dư Ngân Hàng:      450M                              │
│  📌 Tiền đã Cam Kết:     -100M                              │
│  ─────────────────────────────────────────────────────────  │
│  🚀 TIỀN KHẢ DỤNG:        350M  ← CHỈ SỐ QUAN TRỌNG NHẤT!   │
└─────────────────────────────────────────────────────────────┘

Free Cash = Số dư Ngân hàng - Tiền đã Cam kết
```

#### AVAILABLE AFTER SURVIVAL (Tiền Còn Sau Sống Còn)

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ AVAILABLE AFTER SURVIVAL (Tiền Sau Khi Đảm Bảo Sống Còn)│
├─────────────────────────────────────────────────────────────┤
│  SurvivalFloor = 3 × MonthlyBurn                           │
│  (Tiền BẮT BUỘC giữ để sống còn 3 tháng)                  │
│                                                             │
│  AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)│
│  (Tiền CÓ THỂ dùng cho ads/owner sau khi đảm bảo sống còn)│
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  FreeCash: 500M
  MonthlyBurn: 70M
  SurvivalFloor: 210M (3 × 70M)
  
  → AvailableAfterSurvival = 500M - 210M = 290M ✅
  → Có 290M để phân bổ cho ads & owner
```

#### FREE CASH FOR GROWTH (Tiền Khả Dụng Cho Tăng Trưởng)

```
┌─────────────────────────────────────────────────────────────┐
│  💰 FREE CASH FOR GROWTH (Tiền Cho Tăng Trưởng)            │
├─────────────────────────────────────────────────────────────┤
│  Free Cash For Growth = Free Cash - Reserved Obligations   │
│                                                             │
│  Reserved Obligations = Dự trữ cho các nghĩa vụ cần thiết: │
│    - Survival Reserve (1-2 tháng burn rate)                │
│    - Tax Reserve (thuế ước tính sắp đóng)                  │
│    - Debt Payment Reserve (trả nợ sắp đến hạn)             │
│    - Risk Buffer (10-20% Free Cash cho bất ngờ)            │
├─────────────────────────────────────────────────────────────┤
│  = SỐ TIỀN THỰC SỰ CÓ THỂ DÙNG CHO SCALE/ĐẦU TƯ           │
└─────────────────────────────────────────────────────────────┘

💡 Công thức chi tiết:

Free Cash For Growth = Free Cash - (
  + Survival Reserve    // 1-2 tháng burn rate
  + Tax Reserve         // Thuế sắp đóng (VAT, CIT)
  + Debt Payment        // Trả nợ trong 30 ngày tới
  + Risk Buffer         // 10-20% Free Cash
)

Ví dụ:
  Free Cash: 500M
  - Survival Reserve: 140M (2 tháng × 70M burn rate)
  - Tax Reserve: 30M (thuế tháng sau)
  - Debt Payment: 20M (trả nợ tháng sau)
  - Risk Buffer: 50M (10% × 500M)
  ─────────────────────────────────────
  Free Cash For Growth: 260M ✅
  
  → Chỉ có 260M để scale ads, không phải 500M!

⚠️ Ý NGHĨA:
  - Free Cash = Khả dụng về mặt kế toán
  - Free Cash For Growth = Thực sự an toàn để tăng trưởng
  - Quyết định scale dựa trên Free Cash For Growth, không phải Free Cash
```

#### SURVIVAL RUNWAY (Thời Gian Sống Còn)

```
┌─────────────────────────────────────────────────────────────┐
│  🛡️ SURVIVAL RUNWAY (THỜI GIAN SỐNG CÒN)                    │
├─────────────────────────────────────────────────────────────┤
│  Survival Runway = Free Cash / Monthly Burn Rate           │
│                                                             │
│  Monthly Burn Rate = Lương nhân công + Chi phí vận hành    │
│                                                             │
│  = Số THÁNG còn chạy được nếu không có doanh thu mới       │
├─────────────────────────────────────────────────────────────┤
│  Phân loại:                                                 │
│  ├─ >= 6 tháng → 🟢 AN TOÀN (safe zone)                    │
│  ├─ 3-6 tháng  → 🟡 KHÁ ỔN (building buffer)               │
│  ├─ 1-3 tháng  → 🟠 CẢNH BÁO (warning zone)                │
│  └─ < 1 tháng  → 🔴 NGUY HIỂM (critical - hành động ngay!) │
└─────────────────────────────────────────────────────────────┘

💡 Ý nghĩa:
  - Đo khả năng chịu đựng SAI LẦM / KHỦNG HOẢNG
  - Nếu ads không hiệu quả, công ty còn chạy được bao lâu?
  - Thời gian để sửa sai, pivot, tận dụng cơ hội
```

**Ví dụ tính Survival Runway**:
```
Free Cash hiện tại: 280M
  (= Bank Balance 350M - Committed Cash 70M)

Chi phí cơ bản (Monthly Burn Rate):
  ├─ Lương nhân công: 50M/tháng
  └─ Vận hành khác:   20M/tháng
  → Tổng:             70M/tháng

Survival Runway = 280M / 70M = 4.0 tháng 🟡 KHÁ ỔN

→ Nếu doanh thu NGỪNG HOÀN TOÀN, công ty còn chạy được 4 tháng
```

#### RESERVE FUND HEALTH (Sức Khỏe Dự Trữ)

```
┌─────────────────────────────────────────────────────────────┐
│  🏦 RESERVE FUND HEALTH (SỨC KHỎE QUỸ DỰ TRỮ)               │
├─────────────────────────────────────────────────────────────┤
│  Reserve Health % = Reserve Fund / Target Reserve × 100%   │
│                                                             │
│  Target Reserve = 3 × Monthly Burn Rate                    │
│                 = 3 tháng vận hành (mục tiêu tích lũy)     │
├─────────────────────────────────────────────────────────────┤
│  Phân loại:                                                 │
│  ├─ >= 100% → 🟢 ĐÃ ĐẦY (reserve met)                      │
│  ├─  50-99% → 🟡 ĐANG TÍCH LŨY (building reserve)          │
│  └─  < 50%  → 🔴 CẦN NÂNG CAO (below target)                │
└─────────────────────────────────────────────────────────────┘
```

**Ví dụ tính Reserve Health**:
```
Target Reserve = 70M × 3 = 210M

Reserve Fund hiện tại: 100M (tích lũy từ 20% profit)
Reserve Health = 100M / 210M = 48% 🔴 CẦN NÂNG CAO

→ Cần tích lũy thêm 110M để đạt 100%
```

**⚠️ PHÂN BIỆT:**
```
┌─────────────────────┬────────────────────┬─────────────────┐
│                     │ Survival Runway    │ Reserve Health  │
├─────────────────────┼────────────────────┼─────────────────┤
│ Dùng số liệu gì?    │ Free Cash (toàn bộ)│ Reserve Fund    │
│                     │                    │ (20% profit)    │
├─────────────────────┼────────────────────┼─────────────────┤
│ Đo cái gì?          │ Khả năng sống còn  │ Sức khỏe quỹ dự │
│                     │ (số tháng còn chạy)│ trữ (% mục tiêu)│
├─────────────────────┼────────────────────┼─────────────────┤
│ Dùng khi nào?       │ Đánh giá rủi ro    │ Theo dõi tích   │
│                     │ toàn công ty       │ lũy dự trữ      │
└─────────────────────┴────────────────────┴─────────────────┘
```

**Ý nghĩa**:
- ✅ Free Cash = Tiền THỰC SỰ có thể chi
- 🚀 Nhiều Free Cash → Scale NHANH
- 🐢 Ít Free Cash → Scale CHẬM
- 🛡️ Survival Buffer = Bảo hiểm sống sót

**Ví dụ quyết định**:
```
Free Cash: 300M
  → Tăng ads budget 50% ✅

Free Cash: 50M
  → Tăng ads budget 5-10% ⚠️

Free Cash: 10M
  → KHÔNG scale, giữ nguyên 🚨
```

### 4.2. BUSINESS PERFORMANCE (P&L - HƯỚNG)

**Mục đích**: Biết có NÊN scale hay không

```
┌─────────────────────────────────────┐
│  P&L (Profit & Loss)                │
├─────────────────────────────────────┤
│  Doanh thu:           300M          │
│  Chi phí:            -200M          │
│  ─────────────────────────────────  │
│  Lợi nhuận:           100M  ← KEY!  │
└─────────────────────────────────────┘

Lợi nhuận = Doanh thu - Chi phí
```

**Ý nghĩa**:
- ✅ Lợi nhuận > 0 → Model hoạt động TỐT → NÊN scale
- ❌ Lợi nhuận ≤ 0 → Model LỖ → KHÔNG nên scale

**Phân bổ lợi nhuận**:
```
100M Lợi nhuận:
  ├─ 45M (45%) → Ads Fund
  ├─ 35M (35%) → Owner Fund
  └─ 20M (20%) → Reserve Fund
```

### 4.3. KẾT HỢP 2 YẾU TỐ

```
┌─────────────────┬──────────────┬──────────────┐
│                 │ P&L Dương ✅ │  P&L Âm ❌   │
├─────────────────┼──────────────┼──────────────┤
│ Free Cash Nhiều │ Scale NHANH  │ Tắt ads ngay │
│                 │ +50% budget  │ Sửa model    │
├─────────────────┼──────────────┼──────────────┤
│ Free Cash Ít    │ Scale CHẬM   │ Dừng hết     │
│                 │ +5-10% budget│ Cắt giảm     │
└─────────────────┴──────────────┴──────────────┘
```

---

## 5. QUYẾT ĐỊNH SCALE

### 5.1. QUY TRÌNH RA QUYẾT ĐỊNH

```
BƯỚC 1: Kiểm tra P&L
├─ Lợi nhuận > 0? 
│  ├─ ✅ YES → Tiếp bước 2
│  └─ ❌ NO  → STOP, không scale

BƯỚC 2: Kiểm tra Free Cash
├─ Free Cash > 100M?
│  ├─ ✅ YES → Scale NHANH
│  └─ ❌ NO  → Kiểm tra 50-100M
│
├─ Free Cash 50-100M?
│  ├─ ✅ YES → Scale VỪA
│  └─ ❌ NO  → Scale CHẬM hoặc giữ nguyên

BƯỚC 3: Kiểm tra Reserve Health
├─ Reserve Health >= 50%?
│  ├─ ✅ YES → OK để scale
│  └─ ❌ NO  → Ưu tiên tích lũy Reserve trước
```

### 5.2. BẢNG QUYẾT ĐỊNH

```
┌─────────────┬──────────┬─────────────┬────────────────┐
│ P&L         │ Free Cash│ Reserve     │ Decision       │
├─────────────┼──────────┼─────────────┼────────────────┤
│ +100M       │ 300M     │ 80% ✅      │ Scale +50%     │
│ Lợi nhuận   │ Nhiều    │ Đủ          │ Tăng mạnh!     │
├─────────────┼──────────┼─────────────┼────────────────┤
│ +100M       │ 80M      │ 60% ⚠️      │ Scale +20%     │
│ Lợi nhuận   │ Vừa      │ Gần đủ      │ Tăng ổn định   │
├─────────────┼──────────┼─────────────┼────────────────┤
│ +50M        │ 40M      │ 30% 🚨      │ Scale +5%      │
│ Lợi nhuận ít│ Ít       │ Thiếu       │ Cẩn thận       │
├─────────────┼──────────┼─────────────┼────────────────┤
│ -20M        │ 200M     │ 100% ✅     │ STOP!          │
│ Lỗ          │ (Nhiều)  │ (Đủ)        │ Sửa model      │
└─────────────┴──────────┴─────────────┴────────────────┘
```

---

## 4A. FORECAST 7 DAYS (Dự Báo Dòng Tiền 7 Ngày)

**Mục tiêu**: Biết 7 ngày tới có bị hụt tiền không, và "đáy tiền" xảy ra ngày nào

### 4A.1. Input Forecast

#### Expected Inflows (7D) - Tiền Dự Kiến VÀO

```
1. NCC dự kiến trả:
   ├─ Đơn đã success chưa nhận tiền (AR từ NCC)
   ├─ Profile NCC settlement (chu kỳ N ngày)
   ├─ Trừ rủi ro hoàn/boom theo SKU (ví dụ 20%)
   └─ RiskAdjustInflow = 0.8 (chỉ tính 80% để an toàn)

2. Vốn vay dự kiến giải ngân (chỉ tính nếu CHẮC CHẮN)

3. Refund dự kiến (nếu có)

ExpectedIn[d] = 
  NCCPayment[d] × 0.8 
  + LoanDisbursement[d] 
  + Refund[d]
```

#### Expected Outflows (7D) - Tiền Dự Kiến RA

```
1. Ads plan theo ngày:
   = AdsBudgetApproved / 7 (chia đều)
   hoặc theo lịch ads cụ thể

2. Các khoản due trong 7 ngày:
   ├─ Lương đến hạn
   ├─ Vận hành đến hạn  
   ├─ Đại lý đến hạn
   ├─ Thuế đến hạn
   └─ Trả nợ đến hạn
   (từ AP schedule)

ExpectedOut[d] = 
  AdsPlanned[d] 
  + PaymentsDue[d]
```

### 4A.2. Forecast Theo Ngày

```typescript
// Công thức forecast
ForecastBank[0] = BankBalance (hôm nay)

for (d = 1; d <= 7; d++) {
  ForecastBank[d] = ForecastBank[d-1] 
                  + ExpectedIn[d] 
                  - ExpectedOut[d]
}
```

### 4A.3. Low Point (Đáy Tiền) & Cảnh Báo

```
┌─────────────────────────────────────────────────────────────┐
│  📉 LOW POINT DETECTION (Phát Hiện Đáy Tiền)                │
├─────────────────────────────────────────────────────────────┤
│  LowPoint = min(ForecastBank[1..7])                        │
│  LowPointDay = ngày có ForecastBank thấp nhất              │
│                                                             │
│  Phân loại:                                                 │
│  ├─ LowPoint < 0 → 🔴 CASH CRUNCH (đứt tiền)              │
│  ├─ LowPoint < SurvivalFloor → 🟠 RỦI RO SỐNG CÒN         │
│  ├─ LowPoint < CommittedCash → 🟡 RỦI RO THANH TOÁN       │
│  └─ LowPoint >= FreeCash × 0.5 → 🟢 AN TOÀN               │
└─────────────────────────────────────────────────────────────┘

Ví dụ:
  Ngày 1: 500M
  Ngày 2: 450M
  Ngày 3: 350M ← LowPoint
  Ngày 4: 400M
  Ngày 5: 480M
  Ngày 6: 520M
  Ngày 7: 550M
  
  LowPoint = 350M (ngày 3)
  SurvivalFloor = 210M
  
  → 350M > 210M → 🟢 AN TOÀN
  → Nhưng gần survival, cần cẩn thận!
```

### 4A.4. Forecast Free Cash (7D)

```typescript
// Forecast Free Cash theo ngày
for (d = 0; d <= 7; d++) {
  ForecastCommitted[d] = calcCommittedAtDay(d, windowDays)
  ForecastFreeCash[d] = ForecastBank[d] - ForecastCommitted[d]
}

ForecastFreeCashLowPoint = min(ForecastFreeCash[1..7])
```

### 4A.5. Dashboard Forecast

```
┌─────────────────────────────────────────────────────────────┐
│  📅 FORECAST 7 DAYS                                         │
├──────┬──────────┬──────────┬──────────┬──────────────────┤
│ Ngày │ Tiền Vào │ Tiền Ra  │ Số Dư    │ Trạng Thái       │
├──────┼──────────┼──────────┼──────────┼──────────────────┤
│ T2   │ +50M     │ -30M     │ 520M     │ 🟢 OK            │
│ T3   │ +20M     │ -40M     │ 500M     │ 🟢 OK            │
│ T4   │ +10M     │ -60M     │ 450M     │ 🟢 OK            │
│ T5   │ +30M     │ -50M     │ 430M     │ 🟢 OK            │
│ T6   │ +80M     │ -40M     │ 470M     │ 🟢 OK            │
│ T7   │ +100M    │ -35M     │ 535M     │ 🟢 OK            │
│ CN   │ +0M      │ -20M     │ 515M     │ 🟢 OK            │
├──────┴──────────┴──────────┴──────────┴──────────────────┤
│ 📉 Low Point: T5 - 430M (> Survival 210M) ✅              │
│ 📊 End Balance: 515M                                       │
│ ⚠️ Cảnh báo: Không                                        │
└─────────────────────────────────────────────────────────────┘
```

### 4A.6. Configuration Mặc Định

```typescript
// Default config for forecast
const FORECAST_CONFIG = {
  forecastDays: 7,
  riskAdjustInflow: 0.8,        // Chỉ tính 80% expected NCC payout
  supplierCashCycleDays: 10,     // Default nếu chưa có data
  safetyMargin: 0.5              // Cảnh báo nếu LowPoint < FreeCash × 0.5
};
```

---

## 5A. DAYS CASH ON HAND (Ngày Tiền Mặt Còn Lại)

### 5A.1. Công Thức

```
Days Cash on Hand = (Free Cash / Monthly Burn Rate) × 30 ngày

Trong đó:
  Free Cash = Bank Balance - Committed Cash
  Monthly Burn Rate = Chi phí cố định mỗi tháng
  
Kết quả: Số NGÀY còn chạy được nếu doanh thu dừng hoàn toàn
```

### 5A.2. Benchmark & Phân Loại

```
┌────────────────────┬──────────────────────────────────┐
│ Days Cash on Hand  │ Đánh Giá                         │
├────────────────────┼──────────────────────────────────┤
│ >= 180 ngày (6mo)  │ 🟢 RẤT MẠNH - Có thể mạo hiểm    │
│ 90-180 ngày (3-6mo)│ 🟢 TỐT - An toàn để scale        │
│ 60-90 ngày (2-3mo) │ 🟡 CHẤP NHẬN ĐƯỢC - Cẩn thận     │
│ 30-60 ngày (1-2mo) │ 🟠 YẾU - Cần cải thiện           │
│ < 30 ngày (<1mo)   │ 🔴 NGUY HIỂM - Hành động ngay    │
└────────────────────┴──────────────────────────────────┘
```

### 5A.3. Ví Dụ

```
Tình huống:
  Bank Balance: 350M
  Committed Cash: 70M
  → Free Cash: 280M
  
  Monthly Burn Rate: 70M/tháng
  
Days Cash on Hand = (280M / 70M) × 30 = 120 ngày
→ 🟢 TỐT - Đủ 4 tháng vận hành
```

---

## 5B. CASH FLOW STATEMENT (Báo Cáo Dòng Tiền)

### 5B.1. Cấu Trúc 3 Loại Dòng Tiền

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣ OPERATING CASH FLOW (Dòng Tiền Hoạt Động)          │
├─────────────────────────────────────────────────────────┤
│  Cash Collected (Tiền ĐÃ THU):                         │
│    + Cash collected from suppliers (tiền NCC ĐÃ TRẢ)   │
│      → supplierPaymentStatus: "paid"                   │
│      → Tiền THỰC SỰ nhận được, không phải revenue      │
│                                                         │
│  Cash Paid (Tiền ĐÃ TRẢ):                              │
│    - Ads costs paid (chi phí ads ĐÃ CHI)               │
│    - Labor costs paid (lương ĐÃ TRẢ)                   │
│    - Operating costs paid (vận hành ĐÃ TRẢ)            │
│    - Commission paid (hoa hồng ĐÃ TRẢ)                 │
│    - Taxes paid (thuế ĐÃ ĐÓNG)                         │
│  ─────────────────────────────────────────────────────  │
│  = NET OPERATING CASH FLOW                              │
│  = Cash Collected - Cash Paid                          │
│                                                         │
│  ⚠️ CHÚ Ý:                                              │
│  - KHÔNG dùng Revenue (doanh thu kế toán)              │
│  - KHÔNG dùng Expenses (chi phí kế toán)               │
│  - CHỈ dùng CASH COLLECTED và CASH PAID (tiền thực)    │
│                                                         │
│  Ý nghĩa: Tiền THỰC TẾ tạo ra từ HOẠT ĐỘNG KINH DOANH  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  2️⃣ INVESTING CASH FLOW (Dòng Tiền Đầu Tư)             │
├─────────────────────────────────────────────────────────┤
│  Cash Out:                                              │
│    - Mua thiết bị, phần mềm (CapEx)                    │
│    - Đầu tư dài hạn                                     │
│  Cash In:                                               │
│    + Bán tài sản cũ (nếu có)                            │
│  ─────────────────────────────────────────────────────  │
│  = NET INVESTING CASH FLOW                              │
│                                                         │
│  Ý nghĩa: Tiền dùng cho ĐẦU TƯ TĂNG TRƯỞNG             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  3️⃣ FINANCING CASH FLOW (Dòng Tiền Tài Chính)          │
├─────────────────────────────────────────────────────────┤
│  Cash In:                                               │
│    + Vốn vay (đã giải ngân)                             │
│    + Vốn cá nhân (owner injection)                      │
│  Cash Out:                                              │
│    - Trả nợ vay (gốc + lãi)                             │
│    - Owner rút tiền                                     │
│  ─────────────────────────────────────────────────────  │
│  = NET FINANCING CASH FLOW                              │
│                                                         │
│  Ý nghĩa: Tiền từ VAY/OWNER và THANH TOÁN CHO HỌ       │
└─────────────────────────────────────────────────────────┘
```

### 5B.2. Công Thức Tổng Hợp

```
TOTAL CASH FLOW = Operating + Investing + Financing

Bank Balance Change = Beginning Balance + Total Cash Flow
```

### 5B.3. Ví Dụ Tháng 1/2026

```
┌─────────────────────────────────────────────────────────┐
│  OPERATING CASH FLOW (Hoạt động)                        │
├─────────────────────────────────────────────────────────┤
│  Cash Collected từ NCC:     +500M  (tiền ĐÃ THU)       │
│  Cash Paid - Ads:           -200M  (tiền ĐÃ CHI)       │
│  Cash Paid - Lương:          -50M  (tiền ĐÃ TRẢ)       │
│  Cash Paid - Vận hành:       -30M  (tiền ĐÃ TRẢ)       │
│  Cash Paid - Hoa hồng:       -20M  (tiền ĐÃ TRẢ)       │
│  ─────────────────────────────────────────────────────  │
│  Net Operating CF:          +200M  ✅ DƯƠNG             │
│                                                         │
│  ⚠️ Lưu ý: Tất cả là CASH thực tế, không phải kế toán │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  INVESTING CASH FLOW (Đầu tư)                           │
├─────────────────────────────────────────────────────────┤
│  Mua laptop, phần mềm:       -10M                       │
│  ─────────────────────────────────────────────────────  │
│  Net Investing CF:           -10M                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  FINANCING CASH FLOW (Tài chính)                        │
├─────────────────────────────────────────────────────────┤
│  Vốn vay giải ngân:         +100M                       │
│  Owner rút tiền:             -30M                       │
│  Trả nợ:                      -5M                       │
│  ─────────────────────────────────────────────────────  │
│  Net Financing CF:           +65M                       │
└─────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL CASH FLOW = +200M - 10M + 65M = +255M

Beginning Bank Balance:  100M
+ Total Cash Flow:      +255M
─────────────────────────────
Ending Bank Balance:     355M  ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5B.4. Phân Tích Dòng Tiền

```
┌─────────────────┬──────────┬─────────────────────────────┐
│ Cash Flow Type  │ Result   │ Ý Nghĩa                     │
├─────────────────┼──────────┼─────────────────────────────┤
│ Operating       │ +200M ✅ │ Kinh doanh sinh tiền tốt    │
│ Investing       │  -10M    │ Đầu tư phát triển (bình thg)│
│ Financing       │  +65M ✅ │ Có vốn hỗ trợ (tốt khi bđầu)│
└─────────────────┴──────────┴─────────────────────────────┘

🎯 Mục tiêu lâu dài:
  - Operating CF: DƯƠNG (tự sinh tiền)
  - Investing CF: ÂM (đầu tư tăng trưởng)
  - Financing CF: ÂM (trả nợ, ít phụ thuộc vay)
```

---

## 6. QUYẾT ĐỊNH SCALE

### 6.1. QUY TRÌNH RA QUYẾT ĐỊNH (Theo Chu Kỳ)

**CẤU HÌNH CHU KỲ ĐÁNH GIÁ**:
```
DecisionCycleDays = 7 ngày (default)

Lựa chọn:
  • 3 ngày: Review nhanh (startup mới, cần điều chỉnh liên tục)
  • 7 ngày: Cân bằng (khuyến nghị - default) ✅
  • 14 ngày: Ổn định (doanh nghiệp trưởng thành)
  • 30 ngày: Dài hạn (doanh nghiệp lớn, strategy focus)
```

**QUY TRÌNH 3 BƯỚC**:
```
BƯỚC 1: Kiểm tra P&L chu kỳ N ngày
├─ Profit(N-day cycle) > 0? 
│  ├─ ✅ YES → Tiếp bước 2
│  └─ ❌ NO  → STOP, không scale
│
│  Ví dụ (N=7):
│  - Revenue collected (7 ngày): 100M
│  - Cash paid (7 ngày): 80M
│  → Profit = 20M > 0 ✅

BƯỚC 2: Tính Daily Ads Capacity (Khả năng chi ads/ngày)
├─ Daily Ads Capacity = Free Cash For Growth / (N × SafetyFactor)
│  
│  SafetyFactor:
│  • 3.0: Rất cẩn trọng (survival runway <3mo)
│  • 2.0: Cân bằng (survival runway 3-6mo) ✅
│  • 1.5: Tích cực (survival runway >6mo)
│
│  Ví dụ (N=7, SafetyFactor=2.0):
│  Free Cash For Growth: 280M
│  → Daily Ads Capacity = 280M / (7 × 2.0) = 20M/ngày
│
├─ So sánh với Current Daily Ads:
│  ├─ Capacity > Current × 1.5 → Scale UP (+30-50%)
│  ├─ Capacity > Current × 1.2 → Scale UP (+10-20%)
│  ├─ Capacity ≈ Current → GIỮ NGUYÊN
│  └─ Capacity < Current → Scale DOWN (-20-30%)

BƯỚC 3: Kiểm tra Survival Runway (Safety Check)
├─ Survival Runway >= 3 tháng?
│  ├─ ✅ YES → OK để scale theo Bước 2
│  └─ ❌ NO  → Chỉ giữ nguyên hoặc giảm, KHÔNG tăng
```

### 6.2. BẢNG QUYẾT ĐỊNH (Daily Ads Based)

```
┌──────────┬────────────┬────────┬──────────┬────────────────┐
│ P&L      │ Free Cash  │ Runway │ Daily    │ Decision       │
│ (7 ngày) │ For Growth │        │ Capacity │                │
├──────────┼────────────┼────────┼──────────┼────────────────┤
│ +20M ✅  │ 280M       │ 6mo 🟢 │ 20M/ngày │ Scale +30-50%  │
│ Lợi nhuận│ Nhiều      │ An toàn│ vs 12M   │ Tăng mạnh!     │
│          │            │        │ (×1.67)  │                │
├──────────┼────────────┼────────┼──────────┼────────────────┤
│ +20M ✅  │ 140M       │ 4mo 🟡 │ 10M/ngày │ Scale +10-20%  │
│ Lợi nhuận│ Vừa        │ Khá ổn │ vs 8M    │ Tăng ổn định   │
│          │            │        │ (×1.25)  │                │
├──────────┼────────────┼────────┼──────────┼────────────────┤
│ +10M ⚠️  │ 70M        │ 2mo 🟠 │ 5M/ngày  │ Giữ nguyên     │
│ Lợi ít   │ Ít         │ Cảnh báo vs 5M   │ Cẩn thận       │
│          │            │        │ (×1.0)   │                │
├──────────┼────────────┼────────┼──────────┼────────────────┤
│ -5M ❌   │ 200M       │ 8mo 🟢 │ N/A      │ STOP!          │
│ Lỗ       │ (Nhiều)    │ (An toàn)        │ Sửa model      │
│          │            │        │          │ Không scale    │
└──────────┴────────────┴────────┴──────────┴────────────────┘

💡 Công thức:
Daily Ads Capacity = Free Cash For Growth / (DecisionCycleDays × SafetyFactor)

Ví dụ trên:
  280M / (7 × 2.0) = 20M/ngày
  Current: 12M/ngày
  → Ratio: 20/12 = 1.67 → Scale +30-50%
```

---

## 7. VÍ DỤ THỰC TẾ HOÀN CHỈNH

### Scenario: Tháng 3/2026

#### 6.1. TÌNH HÌNH BAN ĐẦU

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 NGUỒN TIỀN (Cash Inflows)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Vốn vay:               400,000,000 VNĐ
Vốn cá nhân:           100,000,000 VNĐ
Seed Capital:          500,000,000 VNĐ ✅

Doanh thu (đã nhận):   300,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TỔNG TIỀN VÀO:         800,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 CHI TIÊU (Cash Outflows)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ads đã chi:            200,000,000 VNĐ
Lương đã trả:           50,000,000 VNĐ
Vận hành đã trả:        20,000,000 VNĐ
Đại lý đã trả:          30,000,000 VNĐ
Owner đã rút:           50,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TỔNG TIỀN RA:          350,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏦 BANK BALANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
800M - 350M = 450,000,000 VNĐ ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 6.2. COMMITTED CASH (Nợ chưa trả)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 COMMITTED CASH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lương chưa trả:         50,000,000 VNĐ
Vận hành chưa trả:      20,000,000 VNĐ
Đại lý chưa trả:        30,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TỔNG:                  100,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 6.3. FREE CASH (Tiền khả dụng)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 FREE CASH FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bank Balance:          450,000,000 VNĐ
Committed Cash:       -100,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FREE CASH:             350,000,000 VNĐ ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ý nghĩa: Có 350M có thể chi ngay!
```

#### 6.4. P&L (Lợi nhuận)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PROFIT & LOSS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Doanh thu:             300,000,000 VNĐ
Chi phí:
  - Ads:               200,000,000 VNĐ
  - Lương:              50,000,000 VNĐ
  - Vận hành:           20,000,000 VNĐ
  - Đại lý:             30,000,000 VNĐ
  ─────────────────────────────────────
  Tổng chi phí:        300,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LỢI NHUẬN THUẦN:         0 VNĐ ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Ý nghĩa: Hòa vốn, chưa có lời!
```

#### 6.5. CÁC QUỸ

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 ADS FUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Từ Seed Capital (45%): 225,000,000 VNĐ
Từ Lợi nhuận (45%):              0 VNĐ
Tổng ngân sách:        225,000,000 VNĐ
Đã chi:               -200,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CÒN LẠI:                25,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ RESERVE FUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Từ lợi nhuận (20%):              0 VNĐ
Target (3 tháng):      210,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Health: 0% 🚨 CRITICAL
Survival: 0 tháng
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 OWNER FUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Từ lợi nhuận (35%):              0 VNĐ
Đã rút:                 50,000,000 VNĐ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Retained: 0 VNĐ (đã rút hết seed capital)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 6.6. QUYẾT ĐỊNH

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PHÂN TÍCH QUYẾT ĐỊNH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ P&L Check:
   Lợi nhuận: 0 VNĐ ⚠️
   → Hòa vốn, chưa tốt lắm
   → CẨN THẬN khi scale

2️⃣ Free Cash Check:
   Free Cash: 350M ✅
   → Nhiều tiền, CÓ THỂ scale nhanh
   
3️⃣ Reserve Check:
   Reserve: 0% 🚨
   → Rất nguy hiểm!
   → NÊN tích lũy Reserve trước

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUYẾT ĐỊNH CUỐI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ KHÔNG scale ads
✅ GIỮ NGUYÊN budget hiện tại
✅ TẬP TRUNG cải thiện P&L (tăng lợi nhuận)
✅ KHI CÓ lợi nhuận → Tích lũy Reserve trước
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scenario: 3 Tháng Sau (Tháng 6/2026)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 TÌNH HÌNH SAU 3 THÁNG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bank Balance:          650,000,000 VNĐ (+200M)
Committed Cash:        100,000,000 VNĐ
Free Cash:             550,000,000 VNĐ ✅

P&L:
  Doanh thu:           600,000,000 VNĐ
  Chi phí:            -500,000,000 VNĐ
  ─────────────────────────────────────
  Lợi nhuận:           100,000,000 VNĐ ✅

Phân bổ lợi nhuận:
  ├─ Ads Fund:          45,000,000 VNĐ
  ├─ Owner Fund:        35,000,000 VNĐ
  └─ Reserve Fund:      20,000,000 VNĐ

Reserve:
  Tích lũy:             60,000,000 VNĐ (3 tháng × 20M)
  Target:              210,000,000 VNĐ
  Health:               28% 🚨 CRITICAL
  Survival:             0.9 tháng

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 QUYẾT ĐỊNH MỚI:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ P&L: Dương (+100M) → OK để scale!
✅ Free Cash: 550M → Rất nhiều → Scale nhanh!
⚠️ Reserve: 28% → Vẫn thiếu, nhưng đang tích lũy

→ SCALE +30% ads budget ✅
→ TIẾP TỤC tích lũy Reserve
→ MỤC TIÊU: Đạt 50% Reserve trong 2 tháng nữa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. CÂU HỎI THƯỜNG GẶP

### Q1: Tại sao Free Cash ≠ Ads Fund?

```
A: Vì chúng là 2 KHÁI NIỆM KHÁC NHAU!

Free Cash = THỰC TẾ có bao nhiêu tiền có thể chi
  = Bank Balance - Committed Cash
  = Nhìn vào TÀI KHOẢN NGÂN HÀNG

Ads Fund = MỤC ĐÍCH được phân bổ cho ads
  = Theoretical budget dựa trên công thức
  = Nhìn vào KẾ TOÁN

Ví dụ:
  Free Cash: 350M (tiền thật trong bank)
  Ads Fund: 25M (ngân sách theo kế toán)
  
  → Chỉ được chi TỐI ĐA = MIN(350M, 25M) = 25M
  → Vì Ads Fund quy định MỤC ĐÍCH
```

### Q2: Owner rút tiền ảnh hưởng gì?

```
A: Ảnh hưởng Bank Balance và Free Cash!

Before Owner rút:
  Bank Balance: 450M
  Free Cash: 350M

Owner rút 50M:
  Bank Balance: 450M - 50M = 400M ↓
  Free Cash: 350M - 50M = 300M ↓
  
  → Giảm khả năng chi tiêu!
  → Nên cẩn thận khi rút nhiều
```

### Q3: Reserve đủ 100% rồi thì sao?

```
A: Có 3 lựa chọn:

1. GIỮ NGUYÊN (An toàn nhất)
   → Reserve dư = Bảo hiểm tốt hơn

2. ĐIỀU CHỈNH % phân bổ
   Lợi nhuận 100M:
   ├─ Ads: 50% (+5%) → 50M
   ├─ Owner: 40% (+5%) → 40M
   └─ Reserve: 10% (-10%) → 10M
   
   → Tăng Ads/Owner, giảm Reserve

3. TĂNG TARGET lên 6 tháng
   Target mới = 70M × 6 = 420M
   → Tiếp tục tích lũy đến 420M
```

### Q4: Committed Cash cao quá thì sao?

```
A: NGUY HIỂM! Cần hành động ngay:

Ví dụ:
  Bank Balance: 150M
  Committed Cash: 140M
  Free Cash: 10M ← RẤT ÍT!
  
Giải pháp:
  1. THANH TOÁN ngay các khoản committed
     → Giảm Committed, tăng Free Cash
     
  2. ĐỪNG phát sinh thêm nghĩa vụ mới
     → Tạm dừng hiring, tạm dừng chi tiêu lớn
     
  3. TẬP TRUNG thu tiền từ NCC
     → Tăng Bank Balance
```

### Q6: Phải thu NCC (Pending Revenue) là gì?

```
A: Tiền MÀ NCC NỢ chúng ta, chưa thanh toán

Định nghĩa:
  - Đơn hàng: Đã giao thành công
  - Order Status: "Giao thành công"
  - Supplier Status: "pending" (chưa trả)
  - Chờ: NCC đối soát & chuyển tiền

Đặc điểm:
  ❌ KHÔNG phải tiền trong Bank Balance
  ❌ KHÔNG tính vào Free Cash
  ⏳ Chờ NCC thanh toán → Mới vào Bank
  📊 Theo dõi riêng (Accounts Receivable)

Ví dụ:
  Tháng này giao 100 đơn, tổng 500M:
  ├─ 70 đơn: NCC đã trả = 350M ✅
  │  → Vào Bank Balance
  │  → Dùng để tính Free Cash
  │
  └─ 30 đơn: NCC chưa trả = 150M ⏳
     → CHƯA vào Bank Balance
     → Chỉ theo dõi riêng
     → Khi NCC trả → Bank +150M

Rủi ro:
  - NCC chậm trả → Thiếu tiền lưu động
  - NCC không trả → Mất doanh thu
  → Cần theo dõi sát, đôn đốc NCC
```

### Q7: Nếu NCC nợ nhiều thì sao?

```
A: NGUY HIỂM! Ảnh hưởng nghiêm trọng đến cashflow

Tình huống:
  Pending Revenue: 200M (NCC nợ)
  Bank Balance: 100M
  Committed Cash: 80M
  Free Cash: 20M ← RẤT ÍT!
  
Vấn đề:
  → Có doanh thu nhưng CHƯA NHẬN TIỀN
  → Bank Balance thấp
  → Free Cash ít, khó scale
  → Có thể không đủ tiền trả lương

Giải pháp:
  1. ĐÔN ĐỐC NCC gấp
     → Call, email, đến tận nơi
     → Yêu cầu thanh toán ngay
     
  2. ĐIỀU CHỈNH chính sách
     → Thu ngắn chu kỳ thanh toán
     → Yêu cầu trả trước 50%
     
  3. TẠM DỪNG scale
     → Chờ NCC trả tiền
     → Tăng Bank Balance lên đã
     
  4. XEM XÉT đổi NCC
     → Nếu NCC hay nợ lâu
     → Tìm NCC trả nhanh hơn

Công thức đánh giá:
  DSO = Pending Revenue / (Revenue/30)
  
  Ví dụ:
    Pending: 150M
    Revenue/tháng: 300M
    DSO = 150 / (300/30) = 15 ngày
    
  → NCC trả trung bình sau 15 ngày
  
  Benchmark:
  ├─ < 7 ngày: ✅ Tốt
  ├─ 7-15 ngày: ⚠️ Chấp nhận được
  └─ > 15 ngày: 🚨 Nguy hiểm
```

```
A: NGUY HIỂM! Đang ĂN VỐN!

Ví dụ:
  Free Cash: 300M (nhiều)
  P&L: -50M (lỗ)
  
Nguyên nhân:
  → Doanh thu < Chi phí
  → Đang tiêu vốn ban đầu
  
Hậu quả:
  → Free Cash sẽ cạn dần
  → 300M / 50M/tháng = 6 tháng là hết tiền
  
Hành động:
  ❌ KHÔNG scale (dù có tiền)
  ✅ TỐI ƯU chi phí
  ✅ TĂNG doanh thu
  ✅ CẢI THIỆN P&L về dương
```

---

## 🎯 TÓM TẮT CỐT LÕI

```
1. BANK BALANCE = Tiền THỰC TẾ trong tài khoản
   Công thức hoạt động: Bank(t) = Bank(t-1) + CashIn(t) - CashOut(t) + Reconcile(t)
   Công thức audit: Bank(t) = Bank(0) + Σ(CashIn) - Σ(CashOut) + Σ(Reconcile)
   → Dùng công thức theo ngày cho hoạt động, tích lũy cho audit

2. RECEIVABLE FROM SUPPLIER = Tiền NCC NỢ chưa trả
   = Đơn giao thành công nhưng NCC chưa thanh toán
   → CHƯA vào Bank Balance, chỉ theo dõi riêng

3. COMMITTED CASH = Nợ chưa trả (phải dành tiền)
   = SUBSET của AP, chỉ lấy đến hạn trong CommittedWindowDays (default 14 ngày)
   → Lương + Vận hành + Đại lý ĐẾN HẠN GẦN và ĐÃ DUYỆT

4. FREE CASH = Tiền CÓ THỂ CHI NGAY
   = Bank Balance - Committed Cash
   → Tiền khả dụng về mặt kế toán

5. FREE CASH FOR GROWTH = Tiền THỰC SỰ cho tăng trưởng
   = Free Cash - (Survival + Tax + Debt + Risk Buffer)
   → Số tiền AN TOÀN để scale/đầu tư
   ⚠️ Dùng để quyết định scale, không phải Free Cash!

6. SURVIVAL RUNWAY = Thời gian sống còn
   = Free Cash / Monthly Burn Rate
   = Số THÁNG còn chạy được nếu không có doanh thu
   ├─ >= 6 tháng: 🟢 AN TOÀN
   ├─ 3-6 tháng: 🟡 KHÁ ỔN
   ├─ 1-3 tháng: 🟠 CẢNH BÁO
   └─ < 1 tháng: 🔴 NGUY HIỂM!

7. RESERVE HEALTH = Sức khỏe dự trữ
   = Reserve Fund / (3 × Monthly Burn Rate) × 100%
   ├─ >= 100%: 🟢 Đã đầy
   ├─  50-99%: 🟡 Đang tích lũy
   └─  < 50%: 🔴 Cần nâng cao

8. P&L = Lợi nhuận thuần (theo chu kỳ N ngày)
   = Cash Collected - Cash Paid (trong N ngày)
   ⚠️ KHÔNG dùng Revenue/Expenses kế toán
   
9. PHÂN BỔ LỢI NHUẬN:
   ├─ 45% → Ads Fund
   ├─ 35% → Owner Fund (có thể rút)
   └─ 20% → Reserve Fund (target 3 tháng)

10. DAYS CASH ON HAND = Ngày tiền mặt còn lại
    = (Free Cash / Monthly Burn Rate) × 30
   
11. CASH FLOW STATEMENT = Báo cáo dòng tiền (CASH THỰC)
    ├─ Operating CF: Cash Collected - Cash Paid (đã thu/đã trả)
    ├─ Investing CF: Từ đầu tư (CapEx, assets)
    └─ Financing CF: Từ vay/owner (vay vào, trả nợ, rút tiền)

12. QUYẾT ĐỊNH SCALE (Theo chu kỳ N ngày):
    DecisionCycleDays = 7 ngày (default)
    CommittedWindowDays = 14 ngày (default)
    
    Bước 1: P&L(N-day) > 0? → Tiếp bước 2
    Bước 2: Daily Ads Capacity = Free Cash For Growth / (N × SafetyFactor)
            So với Current Daily Ads → Scale decision
    Bước 3: Survival Runway >= 3mo? → Safety check
    
    ⚠️ Dùng Daily Ads Capacity, không dùng ngưỡng tuyệt đối!
```

---

**🎓 HỌC THUỘC 7 CÂU NÀY:**

1. **Bank Balance theo ngày, tích lũy chỉ audit** (hoạt động dùng t-1, kiểm tra dùng cumulative)
2. **Free Cash For Growth = quyết định scale** (không phải Free Cash thôi!)
3. **Survival Runway đảm bảo AN TOÀN** (còn chạy được mấy tháng?)
4. **P&L theo chu kỳ N ngày quyết định HƯỚNG** (scale hay không scale)
5. **Daily Ads Capacity quyết định TỐC ĐỘ** (scale nhanh hay chậm)
6. **Receivable from Supplier = Tiền CHƯA VỀ** (đôn đốc NCC trả gấp!)
7. **Cash Flow Statement dùng CASH thực** (collected/paid, không dùng revenue/expense)

---

**⚠️ CHÚ Ý QUAN TRỌNG:**

```
Bank Balance - 2 công thức:
  ✅ Hoạt động: Bank(t) = Bank(t-1) + CashIn(t) - CashOut(t) + Reconcile(t)
  ✅ Audit: Bank(t) = Bank(0) + Σ(CashIn) - Σ(CashOut) + Σ(Reconcile)
  ❌ KHÔNG cộng "số dư cũ" (tránh double counting)
  ⚠️ Reconcile để khớp với bank statement

Committed Cash - Cấu hình quan trọng:
  ✅ CommittedWindowDays = 14 ngày (default, có thể điều chỉnh)
  ✅ Chỉ tính khoản ĐẾN HẠN TRONG 14 NGÀY
  ✅ Chỉ tính khoản ĐÃ DUYỆT, không thể trì hoãn
  ❌ KHÔNG tính toàn bộ AP (vì có khoản dài hạn)

Free Cash vs Free Cash For Growth:
  ⚠️ Free Cash = Khả dụng về mặt kế toán
  ✅ Free Cash For Growth = Thực sự an toàn để tăng trưởng
  ✅ Quyết định scale dựa trên Free Cash For Growth!

Owner Fund có 3 khái niệm:
  ✅ Allocated = 35% profit (không đổi)
  ✅ Retained = Allocated - Withdrawn (giảm khi rút)
  ✅ Withdrawn = Đã rút ra ngoài (RA khỏi Bank Balance)

Quyết định Scale - Theo chu kỳ:
  ✅ DecisionCycleDays = 7 ngày (default)
  ✅ Tính P&L theo 7 ngày, không phải tháng
  ✅ Daily Ads Capacity thay vì ngưỡng tuyệt đối
  ✅ So sánh Capacity vs Current → Scale decision

Nếu NCC nợ nhiều:
  → Số dư Ngân hàng thấp
  → Free Cash ít
  → Khó scale dù có doanh thu cao!
  
  → GIẢI PHÁP: Đôn đốc NCC trả nhanh!
```

---

**📊 PHÂN BIỆT CÁC KHÁI NIỆM:**

```
┌──────────────────────┬──────────────────────────────────┐
│ Bank Balance t-1     │ ≠ Bank Balance Tích Lũy          │
├──────────────────────┼──────────────────────────────────┤
│ Hoạt động hàng ngày  │   Audit định kỳ                    │
│ Bank(t) = Bank(t-1) │   Bank(t) = Bank(0) + Σ(In-Out)  │
│   + In(t) - Out(t)   │   Verify chính xác                  │
│ Nhanh, hiệu quả      │   Chậm, chỉ kiểm tra              │
└──────────────────────┴──────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────┐
│ Free Cash            │ ≠ Free Cash For Growth          │
├──────────────────────┼──────────────────────────────────┤
│ Khả dụng kế toán     │   An toàn để tăng trưởng         │
│ Bank - Committed     │   Free - (Survival+Tax+Debt+Risk)│
│ Để tham khảo          │   Để QUYẾT ĐỊNH SCALE ✅        │
└──────────────────────┴──────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────┐
│ Committed Cash       │ ≠ Accounts Payable (AP)          │
├──────────────────────┼──────────────────────────────────┤
│ SUBSET của AP        │   TOÀN BỘ nghĩa vụ phải trả      │
│ Chỉ đến hạn 14 ngày  │   Bao gồm cả dài hạn (>14 ngày) │
│ Đã duyệt, cứng       │   Có thể chưa duyệt              │
│ Không thể trì hoãn   │   Một số có thể thương lượng     │
└──────────────────────┴──────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────┐
│ Cash Collected/Paid  │ ≠ Revenue/Expenses              │
├──────────────────────┼──────────────────────────────────┤
│ Tiền THỰC thu/trả     │   Kế toán dồn tích                │
│ supplierPaidAt: paid │   Ghi nhận khi phát sinh          │
│ Chỉ tính tiền thực    │   Có thể chưa thu/chưa trả        │
│ Cash Flow Statement  │   Income Statement (P&L)        │
└──────────────────────┴──────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────┐
│ Scale theo chu kỳ    │ ≠ Scale theo ngưỡng tuyệt đối   │
├──────────────────────┼──────────────────────────────────┤
│ Daily Ads Capacity   │   Free Cash > 100M? Scale!     │
│ = FreeCash4Growth/   │   Không linh hoạt                 │
│   (N×SafetyFactor)    │   Không thích ngừ                   │
│ Linh hoạt theo tình  │   Cứng nhắc                        │
│ hình cụ thể           │                                  │
└──────────────────────┴──────────────────────────────────┘
```

---

✅ **Document này giải thích RÕ RÀNG tất cả logic Financial Control!**
