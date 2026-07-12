# TÀI LIỆU KỸ THUẬT: Sự bất nhất trong công thức Lợi nhuận (Profit Calculation Inconsistency)

**Mức độ**: 🔴 CRITICAL — Ảnh hưởng trực tiếp đến tài chính, báo cáo CEO, và thanh toán hoa hồng đại lý  
**Ngày phát hiện**: 15/03/2026  
**Trạng thái**: ✅ ĐÃ SỬA — PO xác nhận nghiệp vụ ngày 15/03/2026, code được vá cùng ngày  
**Người viết**: AI Code Review  

---

> **TÓM TẮT QUYẾT ĐỊNH PO (15/03/2026):**
> - **Company Gross Profit** = `agentQuote×qty − supplierQuote×qty − shippingFee − returnFee`
> - **Agent Commission** = `COD − agentQuote×qty`  *(phí ship do Công ty chịu, không trừ vào hoa hồng)*
>
> **Files đã được sửa:**
> - `backend/src/test-order2/services/order-calculation.service.ts` — `calculateGrossProfit()` + thêm mới `calculateAgentCommission()`
> - `backend/src/test-order2/test-order2.service.ts` — `handleOrderStatusChange()` (agentPaidAmount)
> - `backend/src/test-order2/services/order-payment.service.ts` — `getOrdersPendingAgentPayment()` + `createAgentPaymentBatch()`
>
> **Cần làm thêm:**
> - [ ] Migration script: recalculate `agentPaidAmount`, `grossProfit`, `realizedGrossProfit` cho các đơn cũ
> - [ ] Cập nhật test scripts: `test-module-supply-chain.ps1`, `test-module-financial-deep.ps1`, `test-ripple-order-to-finance.ps1`



---

## 1. TÓM TẮT VẤN ĐỀ

Hệ thống hiện tại có **2 luồng tính lợi nhuận song song** nhưng sử dụng **công thức KHÁC NHAU**, dẫn đến số liệu "vênh" giữa:

| Luồng | Công thức | Có trừ supplierQuote? |
|--------|-----------|:---------------------:|
| **Gross Profit** (CEO Dashboard) | `COD - agentQuote×qty - shippingFee - returnFee - supplierQuote×qty` | ✅ CÓ |
| **Agent Commission** (Hoa hồng đại lý) | `COD - agentQuote×qty - shippingFee` | ❌ KHÔNG |
| **Agent Commission Cashflow** (getCashflowSummary) | `agentQuote × qty` (chỉ lấy phần hoa hồng thuần) | ❌ KHÔNG |

### Hệ quả:
- **agentPaidAmount** (số tiền trả đại lý) = `COD - agentQuote×qty - shippingFee` → **KHÔNG trừ supplierQuote**
- **grossProfit** = `COD - agentQuote×qty - shippingFee - returnFee - supplierQuote×qty` → **CÓ trừ supplierQuote**
- **realizedGrossProfit** = `supplierPaidAmount - agentPaidAmount` → công thức gián tiếp, phụ thuộc vào cả 2 giá trị trên

---

## 2. PHÂN TÍCH CHI TIẾT TỪNG FILE

### 2.1 Hàm `calculateGrossProfit()` — Tính Lợi nhuận gộp cho CEO Dashboard

**File**: [`backend/src/test-order2/services/order-calculation.service.ts`](../backend/src/test-order2/services/order-calculation.service.ts#L511-L555)

```typescript
// Dòng 511-555
async calculateGrossProfit(order: TestOrder2Document): Promise<number> {
  const quantity = order.quantity || 1;
  const shippingFee = order.shippingFee || 0;
  const returnFee = order.returnFee || 0;
  const supplierQuote = order.supplierQuote || 0;      // ← CÓ dùng supplierQuote
  const agentQuote = order.agentQuote || 0;

  // ...kiểm tra payment trigger...

  const isReturnable = order.supplierIsReturnableSnapshot ?? true;
  const supplierCost = (isReturn && isReturnable) ? 0 : (supplierQuote * quantity);  // ← CÓ tính

  if (isExternalAgent) {
    // Đại lý ngoài: COD - agentCommission - shipping - returnFee - COGS(supplierCost)
    return effectiveCod - (agentQuote * quantity) - shippingFee - returnFee - supplierCost;
  } else {
    // Nội bộ/Không agent: COD - COGS - shipping - returnFee
    return effectiveCod - supplierCost - shippingFee - returnFee;
  }
}
```

**Kết quả**: `grossProfit` field trên mỗi order, hiển thị trên CEO Dashboard, daily profit report.

---

### 2.2 Hàm `handleOrderStatusChange()` — Tính agentPaidAmount (Hoa hồng đại lý)

**File**: [`backend/src/test-order2/test-order2.service.ts`](../backend/src/test-order2/test-order2.service.ts#L168-L210)

```typescript
// Dòng 168-210 — Tính agentPaidAmount
if (isExternalAgent) {
  const codAmount = doc.codAmount || 0;
  const agentQuote = doc.agentQuote || 0;
  const quantity = doc.quantity || 1;
  const shippingFee = doc.shippingFee || 0;
  const returnFee = doc.returnFee || 0;
  // ⚠️ KHÔNG CÓ supplierQuote ở đây!

  if (isReturn) {
    doc.agentPaidAmount = 0 - (agentQuote * quantity) - shippingFee - returnFee;
  } else {
    doc.agentPaidAmount = codAmount - (agentQuote * quantity) - shippingFee;
    // ⚠️ = COD - hoa hồng dai lý - phí ship
    // ⚠️ KHÔNG TRỪ supplierQuote × quantity (tiền hàng)
  }
}
```

**Kết quả**: `agentPaidAmount` = số tiền công ty phải trả cho đại lý. Số này sau đó được snapshot vào `agentCommissionFinal`.

---

### 2.3 Hàm `handleOrderStatusChange()` — Tính supplierPaidAmount (Thanh toán NCC)

**File**: [`backend/src/test-order2/test-order2.service.ts`](../backend/src/test-order2/test-order2.service.ts#L144-L166)

```typescript
// Dòng 144-166
if (doc.supplierId) {
  const codAmount = doc.codAmount || 0;
  const supplierQuote = doc.supplierQuote || 0;
  const quantity = doc.quantity || 1;
  const shippingFee = doc.shippingFee || 0;
  const returnFee = doc.returnFee || 0;
  const isReturnable = doc.supplierIsReturnableSnapshot ?? true;

  if (isReturn) {
    const supplierCostOnReturn = isReturnable ? 0 : (supplierQuote * quantity);
    doc.supplierPaidAmount = 0 - supplierCostOnReturn - shippingFee - returnFee;
  } else {
    doc.supplierPaidAmount = codAmount - (supplierQuote * quantity) - shippingFee;
    // = COD - tiền hàng NCC - phí ship
  }
}
```

**Kết quả**: `supplierPaidAmount` = số tiền NCC trả lại công ty (COD trừ giá hàng NCC và phí ship).

---

### 2.4 Hàm `calculateRealizedProfitIfReady()` — Lợi nhuận thực tế

**File**: [`backend/src/test-order2/services/order-calculation.service.ts`](../backend/src/test-order2/services/order-calculation.service.ts#L558-L580)

```typescript
// Dòng 558-580
order.realizedGrossProfit = supplierPaidAmount - agentPaidAmount;
order.realizedNetProfit = order.realizedGrossProfit - advertisingCost - laborCost - otherCost;
```

**Phân tích toán học** (đơn giao thành công, external agent):
```
supplierPaidAmount = COD - supplierQuote×qty - shippingFee
agentPaidAmount    = COD - agentQuote×qty - shippingFee          // ← KHÔNG trừ supplierQuote

realizedGrossProfit = supplierPaidAmount - agentPaidAmount
                    = (COD - supplierQuote×qty - ship) - (COD - agentQuote×qty - ship)
                    = -supplierQuote×qty + agentQuote×qty
                    = (agentQuote - supplierQuote) × qty
```

Trong khi đó:
```
grossProfit (estimated) = COD - agentQuote×qty - shippingFee - returnFee - supplierQuote×qty
```

**→ `realizedGrossProfit` ≠ `grossProfit`** — Hai con số này đo lường HAI thứ khác nhau hoàn toàn.

---

### 2.5 Agent Commission Cashflow (getCashflowSummary)

**File**: [`backend/src/agent-receivable/agent-receivable.service.ts`](../backend/src/agent-receivable/agent-receivable.service.ts#L630-L660)

```typescript
// Dòng ~650 — Commission Incurred
totalAgentCommissionIncurred = SUM(agentQuote × qty)
  // Chỉ lấy agentQuote × quantity, KHÔNG liên quan supplierQuote

// Dòng ~680 — Adjustments (Hoàn/Boom chưa trả)
totalAgentAdjustments = SUM(-(agentQuote × qty))

// Dòng ~700 — Clawback (Hoàn/Boom đã trả)  
totalAgentClawback = SUM(agentQuote × qty)

// Net Payable
totalAgentNetPayable = Incurred + Adjustments - Clawback
```

**Vấn đề**: Luồng này tính hoa hồng đại lý **thuần túy dựa trên `agentQuote × qty`**, hoàn toàn KHÔNG xét đến `supplierQuote`. Đây là luồng tách biệt so với `agentPaidAmount` (= COD - agentQuote×qty - shippingFee).

---

### 2.6 Agent Receivable Summary (getAgentReceivableSummary)

**File**: [`backend/src/agent-receivable/agent-receivable.service.ts`](../backend/src/agent-receivable/agent-receivable.service.ts#L30-L100)

```javascript
// Pipeline aggregation
quoteAmount = agentQuote > 0 ? agentQuote × qty : codAmount
collected = orderStatus=='Giao thành công' ? quoteAmount : 0
receivableBase = isReturn ? (isReturnable ? 0 : quoteAmount) : max(quoteAmount - collected, 0)
receivable = max(receivableBase + shippingFee + returnFee, 0)
```

**Vấn đề**: Tính công nợ đại lý dựa trên `agentQuote × qty` hoặc `codAmount`, **KHÔNG có supplierQuote** trong phép tính.

---

## 3. VÍ DỤ SỐ CỤ THỂ

### Kịch bản: Đơn hàng dropship External Agent
| Field | Giá trị |
|-------|---------|
| codAmount (COD thu từ KH) | 1,000,000 VNĐ |
| supplierQuote (giá nhập NCC/đơn vị) | 300,000 VNĐ |
| agentQuote (giá đại lý/đơn vị) | 100,000 VNĐ |
| quantity | 2 |
| shippingFee | 30,000 VNĐ |
| returnFee | 0 VNĐ |

### Kết quả tính toán hiện tại:

| Metric | Công thức | Kết quả |
|--------|-----------|---------|
| **grossProfit** (CEO thấy) | 1,000,000 - 100,000×2 - 30,000 - 0 - 300,000×2 | **= 170,000 VNĐ** |
| **supplierPaidAmount** | 1,000,000 - 300,000×2 - 30,000 | **= 370,000 VNĐ** |
| **agentPaidAmount** (trả đại lý) | 1,000,000 - 100,000×2 - 30,000 | **= 770,000 VNĐ** |
| **realizedGrossProfit** | 370,000 - 770,000 | **= -400,000 VNĐ** ❌ |

### Phân tích sai lệch:

- **CEO Dashboard** cho thấy lợi nhuận gộp = **+170,000 VNĐ** (có lãi)
- **Realized Profit** (khi thanh toán xong) = **-400,000 VNĐ** (lỗ nặng!)
- **agentPaidAmount = 770,000 VNĐ** — Công ty đang trả đại lý 770k từ 1 triệu COD, chỉ giữ lại 230k, trong khi giá hàng NCC là 600k → Công ty thực sự lỗ 370k

### Nguyên nhân gốc:
`agentPaidAmount` hiện tại = `COD - agentQuote×qty - shippingFee` = **số tiền TOÀN BỘ còn lại sau khi trừ hoa hồng và phí ship**, bao gồm cả phần tiền hàng NCC. Tức là **đại lý đang nhận luôn phần tiền hàng NCC** trong agentPaidAmount.

---

## 4. SƠ ĐỒ DÒNG TIỀN (FLOW DIAGRAM)

```
                           COD = 1,000,000
                                |
                    ┌───────────┴───────────┐
                    |                       |
           NCC nhận (supplierPaidAmount)   Công ty giữ
           = COD - COGS - ship             = COGS + ship + agent hoa hồng???
           = 1,000,000 - 600,000 - 30,000  
           = 370,000                        
                                           |
                               ┌───────────┴───────────┐
                               |                       |
                      Trả Đại lý                  Lợi nhuận công ty
                      (agentPaidAmount)            = ???
                      = 770,000 ← ⚠️ SAI          
                      (= COD - agentQuote×qty - ship)
                      
                      Số đúng nên là:
                      agentPaidAmount = agentQuote × qty = 200,000
                      HOẶC
                      agentPaidAmount = COD - COGS - ship - profit = ???
```

### Vấn đề logic nghiệp vụ:

`agentPaidAmount` đang mang 2 ý nghĩa khác nhau:

1. **Ý nghĩa hiện tại trong code**: Số tiền NÊN chuyển khoản cho đại lý = `COD - agentQuote×qty - shippingFee`  
   → Đây thực chất là **số tiền đại lý giữ hộ công ty** (vì agent thu COD, trừ hoa hồng, rồi trả lại)

2. **Ý nghĩa mà tên biến gợi ý**: Hoa hồng / phí dịch vụ đại lý = `agentQuote × qty`  
   → Đây là **chi phí** đại lý thực tế

---

## 5. DANH SÁCH FILE CẦN SỬA (CHỜ QUYẾT ĐỊNH PO)

### 5.1 Các file trực tiếp liên quan:

| # | File | Hàm/Dòng | Vai trò |
|---|------|----------|---------|
| 1 | `backend/src/test-order2/test-order2.service.ts` | `handleOrderStatusChange()` L168-210 | Tính `agentPaidAmount` |
| 2 | `backend/src/test-order2/services/order-calculation.service.ts` | `calculateGrossProfit()` L511-555 | Tính `grossProfit` |
| 3 | `backend/src/test-order2/services/order-calculation.service.ts` | `calculateRealizedProfitIfReady()` L558-580 | Tính `realizedGrossProfit` |
| 4 | `backend/src/test-order2/services/order-payment.service.ts` | `getOrdersPendingAgentPayment()` L208+ | Tính `totalCommission` |
| 5 | `backend/src/agent-receivable/agent-receivable.service.ts` | `getAgentReceivableSummary()` L30-100 | Tính công nợ đại lý |
| 6 | `backend/src/agent-receivable/agent-receivable.service.ts` | `calculateBalances()` L260-360 | Tính số dư đại lý |
| 7 | `backend/src/agent-receivable/agent-receivable.service.ts` | `getCashflowSummary()` L630-950 | Commission cho CFO |
| 8 | `backend/src/test-order2/services/order-report.service.ts` | `getDailyProfitReport()` L19-70 | Báo cáo lợi nhuận ngày |
| 9 | `backend/src/finance/finance.service.ts` | Dashboard aggregation L165-227 | CFO Dashboard |
| 10 | `backend/src/finance/funds.service.ts` | `computeNetProfit()` L511-541 | Available Funds |
| 11 | `backend/src/finance/financial-control.service.ts` | Revenue calculation L350-370 | Financial Control |
| 12 | `backend/src/finance/capital-allocation.service.ts` | Allocation L165-206 | Capital Allocation |
| 13 | `backend/src/ad-group-profit-report/ad-group-profit-report.service.ts` | Performance report L60-110 | ROI calculation |
| 14 | `backend/src/finance/ad-group-daily-report.service.ts` | Daily report L129-172 | Ad group daily profit |

### 5.2 Schema liên quan (có thể cần thêm field):

| # | File | Lý do |
|---|------|-------|
| 15 | `backend/src/test-order2/schemas/test-order2.schema.ts` | Có thể cần thêm field `agentCommission` (thuần hoa hồng) tách biệt `agentPaidAmount` (số tiền chuyển khoản) |

---

## 6. CÁC PHƯƠNG ÁN SỬA (3 OPTIONS — CẦN PO QUYẾT ĐỊNH)

### Option A: "Đại lý PHẢI chịu phí nhập hàng" (Agent bears COGS)

**Logic nghiệp vụ**: Đại lý dropship tự tìm khách, bán giá tự chọn. Họ phải trả tiền hàng NCC + phí ship. Phần dư là hoa hồng / lợi nhuận của đại lý.

**Thay đổi code**:

```typescript
// File: test-order2.service.ts — handleOrderStatusChange()
// TRƯỚC (hiện tại):
doc.agentPaidAmount = codAmount - (agentQuote * quantity) - shippingFee;

// SAU (Option A):
const supplierQuote = doc.supplierQuote || 0;
doc.agentPaidAmount = codAmount - (agentQuote * quantity) - (supplierQuote * quantity) - shippingFee;
```

**Impact**:
- `agentPaidAmount` giảm đi (agent nhận ít hơn)
- `realizedGrossProfit = supplierPaidAmount - agentPaidAmount` sẽ tăng, khớp hơn với `grossProfit`
- Cần cập nhật tất cả 14 file liên quan
- Cần migration script cho đơn hàng cũ

**Kiểm chứng toán học**:
```
agentPaidAmount = 1,000,000 - 200,000 - 600,000 - 30,000 = 170,000 VNĐ
supplierPaidAmount = 1,000,000 - 600,000 - 30,000 = 370,000 VNĐ
realizedGrossProfit = 370,000 - 170,000 = 200,000 VNĐ ≈ grossProfit (170,000)
// Sai lệch 30,000 do returnFee trong grossProfit nhưng không trong agentPaidAmount
```

---

### Option B: "Đại lý KHÔNG chịu phí nhập hàng" (Company bears COGS, agent gets fixed commission)

**Logic nghiệp vụ**: Đại lý chỉ là người bán hộ, nhận hoa hồng cố định = `agentQuote × qty`. Công ty chịu mọi chi phí (nhập hàng, shipping).

**Thay đổi code**:

```typescript
// File: test-order2.service.ts — handleOrderStatusChange()
// TRƯỚC (hiện tại):
doc.agentPaidAmount = codAmount - (agentQuote * quantity) - shippingFee;

// SAU (Option B) — agent chỉ nhận hoa hồng thuần:
doc.agentPaidAmount = agentQuote * quantity;
// "agentPaidAmount" giờ = hoa hồng thuần, không phải số tiền chuyển khoản
```

**Impact**:
- `agentPaidAmount` = hoa hồng thuần (200,000 VNĐ thay vì 770,000)
- `realizedGrossProfit = supplierPaidAmount - agentPaidAmount = 370,000 - 200,000 = 170,000` → khớp `grossProfit`!
- Nhưng phải XEM LẠI ý nghĩa business: ai là người thu COD? Nếu đại lý thu COD rồi chuyển lại → dòng tiền thực tế khác
- Cần thêm field mới `agentTransferAmount` (= COD - agentCommission - ship) để track dòng tiền thực tế

**Kiểm chứng toán học**:
```
agentPaidAmount = agentQuote × qty = 100,000 × 2 = 200,000 VNĐ
supplierPaidAmount = 370,000 VNĐ
realizedGrossProfit = 370,000 - 200,000 = 170,000 VNĐ ✅ = grossProfit
```

---

### Option C: "Tách 2 field" — Giữ nguyên logic, bổ sung field tính đúng (Recommended for safety)

**Logic nghiệp vụ**: Giữ nguyên `agentPaidAmount` là "số tiền chuyển khoản cho agent" (dòng tiền thực), nhưng thêm field mới `agentCommissionAmount` = hoa hồng thuần.

**Thay đổi code**:

```typescript
// Schema: Thêm field mới
agentCommissionAmount: number;  // = agentQuote × qty (hoa hồng thuần)

// File: test-order2.service.ts — handleOrderStatusChange()
// GIỮ NGUYÊN agentPaidAmount (dòng tiền thực tế):
doc.agentPaidAmount = codAmount - (agentQuote * quantity) - shippingFee;

// THÊM MỚI agentCommissionAmount (hoa hồng thuần):
doc.agentCommissionAmount = agentQuote * quantity;

// File: order-calculation.service.ts — Sửa realizedGrossProfit:
// TRƯỚC: order.realizedGrossProfit = supplierPaidAmount - agentPaidAmount;
// SAU:
order.realizedGrossProfit = supplierPaidAmount - (order.agentCommissionAmount || agentPaidAmount);
// Hoặc tính lại đúng:
order.realizedGrossProfit = effectiveCod - supplierCost - agentCommission - fees;
```

**Impact**:
- Không break existing logic (agentPaidAmount vẫn track dòng tiền thực)
- Thêm `agentCommissionAmount` cho báo cáo lợi nhuận
- `realizedGrossProfit` sửa lại cho khớp `grossProfit`
- getCashflowSummary dùng `agentCommissionAmount` thay vì aggregate `agentQuote×qty`
- Cần migration backfill `agentCommissionAmount` cho đơn cũ

---

## 7. BẢNG SO SÁNH 3 PHƯƠNG ÁN

| Tiêu chí | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| **Thay đổi logic** | Sửa agentPaidAmount | Sửa agentPaidAmount | Thêm field mới |
| **Risk** | Cao (đổi ý nghĩa field) | Cao (đổi ý nghĩa field) | Thấp (backward compatible) |
| **Dòng tiền chính xác** | ❌ agentPaidAmount ≠ số tiền chuyển khoản | ❌ agentPaidAmount ≠ số tiền chuyển khoản | ✅ Cả 2 đều chính xác |
| **grossProfit ≈ realizedGrossProfit** | ≈ (sai lệch nhỏ do returnFee) | ✅ Khớp chính xác | ✅ Khớp chính xác |
| **Số file sửa** | ~14 files | ~14 files | ~14 files + schema |
| **Migration data cũ** | Cần recalc agentPaidAmount | Cần recalc agentPaidAmount | Chỉ cần backfill field mới |
| **Recommended** | Nếu PO nói "agent chịu COGS" | Nếu PO nói "agent chỉ nhận commission" | ✅ **An toàn nhất** |

---

## 8. CÂU HỎI CẦN PO TRẢ LỜI

### Câu hỏi chính (BLOCKING):

> **Q1**: Trong mô hình dropship, khi Đại lý ngoài (External Agent) bán hàng, **ai chịu chi phí nhập hàng** (supplierQuote)?
> - **(a)** Đại lý chịu → Agent nhận: `COD - agentCommission - COGS - shippingFee` → **Option A**
> - **(b)** Công ty chịu → Agent nhận hoa hồng thuần: `agentQuote × qty` → **Option B** 
> - **(c)** Phức tạp hơn → Cần tách biệt dòng tiền và hoa hồng → **Option C**

### Câu hỏi phụ (nên hỏi luôn):

> **Q2**: `agentPaidAmount` hiện tại = số tiền chuyển khoản cho agent hay là chi phí hoa hồng?
> - Nếu agent thu COD → `agentPaidAmount` = số tiền agent chuyển lại công ty (nên đổi tên?)
> - Nếu công ty thu COD → `agentPaidAmount` = số tiền công ty trả agent

> **Q3**: Dòng tiền thực tế (cash flow):
> - Agent thu COD từ khách → giữ lại hoa hồng → chuyển phần còn lại cho công ty?
> - Hay công ty thu COD → trả hoa hồng cho agent theo kỳ?

> **Q4**: Khi đơn hoàn (Return), ai chịu phí ship/return? Agent hay công ty?

---

## 9. HƯỚNG DẪN CODER IMPLEMENT (SAU KHI PO QUYẾT ĐỊNH)

### Bước 1: Cập nhật Schema (nếu Option C)
```typescript
// File: backend/src/test-order2/schemas/test-order2.schema.ts
// Thêm field sau agentPaidAmount:
@Prop({ type: Number, default: 0 })
agentCommissionAmount: number;  // Hoa hồng đại lý thuần = agentQuote × qty
```

### Bước 2: Sửa handleOrderStatusChange
```typescript
// File: backend/src/test-order2/test-order2.service.ts
// Trong section "2. Tính số tiền công ty trả đại lý (agentPaidAmount)"
// Thêm/sửa theo Option đã chọn
```

### Bước 3: Sửa calculateRealizedProfitIfReady
```typescript
// File: backend/src/test-order2/services/order-calculation.service.ts
// Đảm bảo realizedGrossProfit khớp với grossProfit
```

### Bước 4: Sửa getOrdersPendingAgentPayment
```typescript
// File: backend/src/test-order2/services/order-payment.service.ts
// Cập nhật totalCommission cho khớp với Option đã chọn
```

### Bước 5: Sửa Agent Receivable Service
```typescript
// File: backend/src/agent-receivable/agent-receivable.service.ts
// Cập nhật 3 hàm: getAgentReceivableSummary, calculateBalances, getCashflowSummary
```

### Bước 6: Viết migration script
```bash
# Tạo file: backend/scripts/migrate-profit-recalculation.js
# Chạy: node scripts/migrate-profit-recalculation.js
# Nội dung: 
#   1. Tìm tất cả orders đã completed
#   2. Recalculate agentPaidAmount / agentCommissionAmount
#   3. Recalculate grossProfit, realizedGrossProfit
#   4. Log trước/sau để audit
```

### Bước 7: Cập nhật test scripts
```
test-module-supply-chain.ps1      — agent payment tests
test-module-financial-deep.ps1    — profit calculation tests
test-ripple-order-to-finance.ps1  — end-to-end flow
```

### Bước 8: Verify trên Dashboard
- [ ] CEO Dashboard: grossProfit khớp realized khi thanh toán xong
- [ ] Agent Payment: Số tiền trả đại lý đúng với thỏa thuận
- [ ] Financial Control: Committed cash và cashflow forecast đúng
- [ ] Daily Profit Report: estimated vs realized gần nhau
- [ ] Ad Group ROI: netProfit phản ánh đúng COGS

---

## 10. IMPACT ANALYSIS — CÁC BÁO CÁO BỊ ẢNH HƯỞNG

| Báo cáo | Endpoint | Field dùng | Bị ảnh hưởng? |
|---------|----------|------------|:-------------:|
| CEO Dashboard | `/api/finance/dashboard` | `realizedNetProfit`, `realizedGrossProfit` | ✅ |
| Daily Profit | `/api/test-order2/daily-profit-report` | `grossProfit`, `netProfit`, `realizedGrossProfit` | ✅ |
| Product Profit | `/api/test-order2/product-profit-report` | `grossProfit`, `netProfit` | ✅ |
| Ad Group ROI | `/api/ad-group-profit-report` | `netProfit`, `advertisingCost` | ✅ |
| Ad Group Daily | `/api/finance/ad-group-daily-report` | `grossProfit`, `netProfit` | ✅ |
| Agent Payable | `/api/agent-payables/cashflow-summary` | `agentQuote×qty` | ⚠️ Partial |
| Agent Receivable | `/api/agent-receivables` | `agentQuote×qty`, `codAmount` | ⚠️ Partial |
| Financial Control | `/api/finance/financial-control` | `agentPaidAmount` | ✅ |
| Capital Allocation | `/api/finance/capital-allocation` | `realizedNetProfit` | ✅ |
| Available Funds | `/api/finance/funds` | `realizedNetProfit`, `supplierPaidAmount` | ✅ |
| Owner Fund | `/api/owner-fund` | Depends on Available Funds | ✅ Indirect |

---

## 11. RISK ASSESSMENT

| Risk | Xác suất | Impact | Mitigation |
|------|:--------:|:------:|------------|
| Trả thừa hoa hồng đại lý | 🔴 Cao | 🔴 Mất tiền | Fix urgent sau khi PO quyết định |
| CEO ra quyết định sai vì số liệu vênh | 🔴 Cao | 🔴 Strategic error | Cảnh báo CEO ngay |
| realizedGrossProfit âm khi grossProfit dương | 🔴 Hiện tại | 🟡 Confusing | Document và explain |
| Migration script break data cũ | 🟡 Trung bình | 🔴 Data loss | Backup trước, dry-run, audit log |
| Agent khiếu nại hoa hồng giảm | 🟡 Trung bình | 🟡 Relationship | Communicate trước khi sửa |

---

## 12. APPENDIX: FULL FORMULA MAP

```
┌──────────────────────────────────────────────────────────────────┐
│                    ESTIMATED (Accrual-based)                      │
│                                                                    │
│  grossProfit = effectiveCod                                       │
│              - (agentQuote × qty)  [if external agent]            │
│              - shippingFee                                        │
│              - returnFee                                          │
│              - supplierCost  ← ✅ CÓ trừ                         │
│                                                                    │
│  netProfit = grossProfit - advertisingCost - laborCost - otherCost│
├──────────────────────────────────────────────────────────────────┤
│                    CASH-BASED (When both paid)                    │
│                                                                    │
│  supplierPaidAmount = COD - supplierQuote×qty - shippingFee      │
│                   [return: 0 - supplierCost - ship - returnFee]   │
│                                                                    │
│  agentPaidAmount = COD - agentQuote×qty - shippingFee            │
│                   [return: 0 - agentQuote×qty - ship - returnFee] │
│                   ← ⚠️ KHÔNG trừ supplierQuote                    │
│                                                                    │
│  realizedGrossProfit = supplierPaidAmount - agentPaidAmount       │
│                      = (agentQuote - supplierQuote) × qty         │
│                      ← ⚠️ KHÁC grossProfit                       │
│                                                                    │
│  realizedNetProfit = realizedGrossProfit - ads - labor - other    │
├──────────────────────────────────────────────────────────────────┤
│                    AGENT COMMISSION (Receivable/Payable)           │
│                                                                    │
│  commissionIncurred = SUM(agentQuote × qty)  ← thuần hoa hồng   │
│  agentPaidAmount = COD - agentQuote×qty - ship ← dòng tiền      │
│                   ← ⚠️ HAI SỐ KHÁC NHAU                         │
└──────────────────────────────────────────────────────────────────┘
```

---

**Kết luận**: Đây là lỗi thiết kế (design bug) phát sinh từ việc `agentPaidAmount` vừa đại diện cho "dòng tiền thực tế" (cash flow) vừa được dùng trong công thức tính "lợi nhuận" (profit). Cần PO quyết định mô hình nghiệp vụ chính xác trước khi sửa code.
