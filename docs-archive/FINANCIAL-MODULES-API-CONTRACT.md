# FINANCIAL MODULES API CONTRACT
## Chuẩn hóa interface giữa các module với Financial Control

> **Nguyên tắc**: Mỗi module tự tính tổng (rollup), Financial Control chỉ đọc số đã chuẩn hóa.

---

## 1. Module: Thanh Toán NCC (Supplier Settlement)

### Endpoint: `GET /api/supplier-payables/statements/summary/cashflow`

> **Legacy naming note**: Route dùng `supplier-payables` nhưng đây là AR (tiền NCC trả cho mình). 
> Giữ nguyên để không break existing clients.

**Mục đích**: Tiền NCC trả cho mình (Account Receivable - AR)

```typescript
interface SupplierCashflowSummary {
  // === TỔNG HỢP (cho Dashboard) ===
  totalCommissionReceived: number;      // Hoa hồng đã thu (cash-in đã xảy ra)
  totalCommissionUnreceived: number;    // Hoa hồng đã earned nhưng chưa thu
  totalCommissionExpected7d: number;    // Dự kiến thu 7 ngày tới (sum of netAmount)
  totalAdjustments: number;             // Điều chỉnh (hoàn/boom/phí)
  
  // === FORECAST THEO NGÀY (cho dự báo) ===
  expectedInflowByDay: {
    date: string;          // YYYY-MM-DD
    grossAmount: number;   // Số tiền gross trước điều chỉnh
    riskAdjustment: number;    // Risk adj (80% factor)
    onTimeAdjustment: number;  // On-time adj (delay penalty)
    netAmount: number;     // = gross + riskAdj + onTimeAdj — FC DÙNG FIELD NÀY
    orderCount: number;    // Số đơn
  }[];
  
  // === METADATA ===
  lastReconciliationDate: string | null;
  settlementCycleDays: number;          // Chu kỳ đối soát NCC (7-14 ngày)
}
```

**Logic tính `expectedInflowByDay`**:
```
expected_pay_date = order.deliveredDate + settlement_cycle_days
grossAmount = order.codAmount - order.supplierCost
riskAdjustment = grossAmount * (RiskAdjustInflow - 1)  // e.g. * -0.20
netAmount = grossAmount + riskAdjustment + onTimeAdjustment
```

> **FC reads**: `expectedInflowByDay[].netAmount` (đã discount risk)

---

## 2. Module: Thanh Toán Đại Lý (Agent Commission Payables)

### Endpoint: `GET /api/agent-payables/summary/cashflow` (NEW)
> **Note**: `/api/agent-receivables/summary/cashflow` deprecated - có header `Deprecation: true`

**Mục đích**: Tiền mình phải trả đại lý (Account Payable - AP)

```typescript
interface AgentCashflowSummary {
  // === TỔNG HỢP GROSS ===
  totalAgentCommissionIncurred: number; // Tổng commission đã phát sinh (gross)
  totalAgentAdjustments: number;        // Điều chỉnh từ Hoàn/Boom chưa trả (âm)
  totalAgentClawback: number;           // Hoàn sau khi đã trả → agent nợ lại (dương)
  
  // === TỔNG HỢP NET ===
  totalAgentNetPayable: number;         // = incurred + adjustments - clawback
  totalAgentPaid: number;               // Hoa hồng đã trả đại lý
  totalAgentUnpaid: number;             // Hoa hồng chưa trả đại lý
  totalAgentDue14d: number;             // Đến hạn trong 14 ngày (Committed)
  
  // === CHI TIẾT THEO ĐẠI LÝ ===
  byAgent: {
    agentId: string;
    agentName: string;
    unpaid: number;
    due14d: number;
    clawback: number;                   // Agent nợ lại từ hoàn sau trả
    nextDueDate?: string;               // Ngày thanh toán tiếp theo
    lastPaymentDate?: string;           // Lần trả gần nhất
  }[];
  
  // === SCHEDULE ===
  paymentPolicy: 'weekly' | 'biweekly' | 'monthly' | 'on_demand';
  defaultPayDaysOfMonth?: number[];     // [1, 15] hoặc [5]
  
  // === METADATA ===
  asOfDate: string;
  timezone: string;
  windowDays: number;
  generatedAt: string;
  totalStatements: number;
  openStatements: number;
  
  // === WARNINGS (v1) ===
  clawbackByAgentIncomplete: boolean;   // true nếu có clawback nhưng byAgent chưa chính xác
  alerts: string[];                     // Cảnh báo cho FC dashboard
}
```

---

## 3. Module: Chi Phí Nhân Công (Payroll Expense)

### Endpoint: `GET /api/labor-cost1/statements/summary/cashflow`

**Mục đích**: Nghĩa vụ lương (AP)

```typescript
interface PayrollCashflowSummary {
  // === TỔNG HỢP GROSS ===
  totalPayrollIncurred: number;     // Lương phát sinh (gross trước khấu trừ)
  totalPayrollBonus: number;        // Thưởng thêm
  totalPayrollDeduction: number;    // Khấu trừ (BHXH, phạt, tạm ứng)
  
  // === TỔNG HỢP NET ===
  totalPayrollNetPayable: number;   // = incurred + bonus - deduction
  totalPayrollPaid: number;         // Lương đã trả
  totalPayrollUnpaid: number;       // Lương chưa trả = netPayable - paid
  totalPayrollDue14d: number;       // Đến hạn trong 14 ngày (Committed)
  
  // === CHI TIẾT THEO NHÂN VIÊN ===
  byEmployee: {
    employeeId: string;
    employeeName: string;
    grossAmount: number;            // Lương gross
    deduction: number;              // Khấu trừ
    netAmount: number;              // Net
    unpaid: number;                 // Chưa trả
    due14d: number;                 // Due trong window
    nextDueDate?: string;           // Ngày thanh toán tiếp theo
    lastPaymentDate?: string;       // Lần trả gần nhất
  }[];
  
  // === SCHEDULE ===
  paymentPolicy: 'biweekly' | 'monthly';
  defaultPayDaysOfMonth: number[];  // [5] hoặc [5, 20]
  
  // === METADATA ===
  asOfDate: string;
  timezone: string;
  windowDays: number;
  generatedAt: string;
  totalStatements: number;
  openStatements: number;
  
  // === WARNINGS ===
  alerts: string[];                 // Cảnh báo (quá hạn, tổng cao)
}
```

---

## 4. Module: Chi Phí Vận Hành (Operating Expenses)

### Endpoint: `GET /api/other-cost/summary/cashflow?windowDays=14`

**Mục đích**: Chi phí vận hành khác (AP) - CFO v3.1

```typescript
interface OpsCashflowSummary {
  // === TỔNG HỢP ===
  totalOpsPaid: number;             // Chi phí đã trả (cash-out)
  totalOpsUnpaid: number;           // Chi phí chưa trả (AP)
  totalOpsDue14d: number;           // Đến hạn trong windowDays (Committed)
  
  // === FORECAST 7 NGÀY ===
  dueByDay7d: {
    date: string;                   // YYYY-MM-DD
    amount: number;
    count: number;
  }[];
  
  // === PHÂN LOẠI ===
  byCategory: {
    category: string;               // rent, utilities, internet, tools, shipping-fee, other...
    paid: number;
    unpaid: number;
    due14d: number;
    nextDueDate?: string;
  }[];
  
  // === METADATA ===
  metadata: {
    asOfDate: string;
    timezone: string;
    windowDays: number;
    generatedAt: string;
  };
  
  // === ALERTS ===
  alerts: string[];                 // Missing dueDate, overdue items
}
```

**Schema fields (CFO v3.1 update)**:
- `dueDate: Date` (REQUIRED) - Ngày đến hạn thanh toán
- `category: string` (default 'other') - Phân loại chi phí
- `isConfirmed: boolean` - false = unpaid (AP), true = paid (cash-out)

**Rule tính due14d**:
```
due14d = sum(amount where !isConfirmed && dueDate <= today + windowDays)
```

**Backfill rule cho data cũ**:
- `dueDate = date` (ngày phát sinh)
- `category = 'other'`

---

## 5. Module: Chi Phí Quảng Cáo (Ads Spend)

### Endpoint: `GET /api/advertising-cost/summary/cashflow`

**Mục đích**: Tracking chi ads (Cash Out Proxy)

```typescript
interface AdsCashflowSummary {
  // === TỔNG HỢP ===
  totalAdsSpentAllTime: number;     // Tổng chi từ trước đến nay
  totalAdsSpent7d: number;          // Tổng 7 ngày gần nhất
  totalAdsSpentYesterday: number;   // Chi ngày hôm qua
  avgDailySpend7d: number;          // Trung bình/ngày (7d)
  
  // === PHÂN LOẠI THEO PLATFORM ===
  spendByPlatform: {
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';
    spent7d: number;
    spentYesterday: number;
  }[];
  
  // === THEO NGÀY (cho baseline cap 20%) ===
  spendByDay: {
    date: string;                   // YYYY-MM-DD
    totalSpent: number;
    adGroupCount: number;           // Số ad groups có spend
  }[];
  
  // === THEO AD GROUP (cho cap 20% từng group) ===
  spendByAdGroup: {
    adGroupId: string;
    adGroupName: string;
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';
    spent7d: number;
    spentYesterday: number;
    avgSpent3d: number;
    baseline: number;               // = max(yesterday, avg3d, minBudget)
    upperCap: number;               // = baseline * 1.20
    lowerCap: number;               // = baseline * 0.70
  }[];
  
  // === SYNC STATUS ===
  lastSyncAt?: string;              // ISO timestamp của record gần nhất
  dataFreshnessHours: number;       // Số giờ từ lastSyncAt
  syncStatus: 'ok' | 'delayed' | 'failed'; // ok < 12h, delayed < 24h, failed > 24h
  
  // === FLAGS ===
  cashOutProxy: true;               // Flag: spend là proxy cho cash-out (chưa có Ads Payment module)
  
  // === METADATA ===
  asOfDate: string;
  timezone: string;
  generatedAt: string;
}
```

**Important CFO Notes**:
- `cashOutProxy: true` nghĩa là Ads Spend ≠ Cash Out thực tế (đặc biệt với prepaid accounts)
- Khi có `AdsPaymentModule` trong tương lai, FC sẽ đọc từ đó thay vì AdvertisingCost
- **KHÔNG dùng Ads Spend proxy để tính Survival/Burn cứng** - chỉ dùng cho growth optimization

---

## 6. Module: Nghĩa Vụ Nợ Vay (Debt Summary)

### Endpoint: `GET /api/finance/loan-contracts/summary/cashflow?windowDays=14`

**Mục đích**: Quản lý vốn vay + nghĩa vụ trả nợ (AP) - CFO v1

```typescript
interface DebtCashflowSummary {
  // === CASH-IN (Financing Inflow) ===
  totalLoanDisbursed: number;       // Tổng tiền vay đã giải ngân

  // === CASH-OUT (Debt Service Paid) ===
  totalDebtPaid: number;            // Tổng đã trả (gốc+lãi+phí)
  totalInterestPaid: number;        // Chi tiết: lãi đã trả
  totalPrincipalPaid: number;       // Chi tiết: gốc đã trả

  // === OBLIGATIONS (AP-like) ===
  totalDebtOutstanding: number;     // Dư nợ gốc còn lại
  totalDebtDue14d: number;          // Số tiền trả nợ đến hạn trong windowDays (Committed)
  nextDebtDueDate: string | null;   // Kỳ gần nhất sắp tới

  // === FORECAST 7 NGÀY ===
  dueByDay7d: {
    date: string;                   // YYYY-MM-DD
    amount: number;
    count: number;
  }[];

  // === PHÂN LOẠI THEO KHOẢN VAY ===
  byLoan: {
    loanId: string;
    lenderName: string;
    outstanding: number;            // Dư nợ còn lại
    due14d: number;                 // Đến hạn trong windowDays
    nextDueDate: string | null;
    status: 'active' | 'draft' | 'closed';
  }[];

  // === METADATA ===
  metadata: {
    asOfDate: string;
    timezone: string;
    windowDays: number;
    generatedAt: string;
  };

  // === ALERTS ===
  alerts: string[];                 // Missing schedule, overdue, high due 7d
}
```

**Schema fields đang có**:
- `LoanContract`: loanId, lenderName, principal, principalRemaining, interestRate, repaymentCycle, startDate, endDate, status
- `LoanRepayment`: loanId, dueDate, amountPrincipal, amountInterest, paid, paidDate

**Rule tính due14d (committed)**:
```
totalDebtDue14d = sum(installment.amountPrincipal + installment.amountInterest
  where installment.paid != true
  and installment.dueDate <= today + windowDays
  and loan.status = 'active'
)
```

**Alert types**:
- `[MISSING_SCHEDULE]`: Active loan không có repayment schedule
- `[OVERDUE]`: Có kỳ trả quá hạn chưa trả
- `[HIGH_DUE_7D]`: Tổng nợ đến hạn 7 ngày > 50M

---

## 7. FINANCIAL CONTROL - Unified Dashboard

### Endpoint: `GET /api/financial-control/dashboard`

**Financial Control chỉ "đọc" từ các module, không tự query:**

```typescript
interface FinancialControlDashboard {
  // === 8 SỐ CHÍNH ===
  bankBalance: number;              // Từ funding-sources
  committedCash14d: number;         // = agent.due14d + payroll.due14d + ops.due14d + loan.due14d
  freeCash: number;                 // = bankBalance - committedCash14d
  monthlyBurn: number;              // = avg(payroll + ops + loan) last 3 months
  runwayMonths: number;             // = freeCash / monthlyBurn
  adsBudgetApproved7d: number;      // = min(optimalAds, availableAfterSurvival)
  ownerWithdrawable: number;        // = max(0, availableAfterSurvival - adsBudgetApproved)
  forecast7dLowPoint: number;       // = min(forecastBank[1..7])
  
  // === CHI TIẾT COMMITTED ===
  committedBreakdown: {
    agents: number;                 // Từ agent-receivables/summary/cashflow
    payroll: number;                // Từ labor-cost1/summary/cashflow
    operations: number;             // Từ other-costs/summary/cashflow
    loanPayment: number;            // Từ loan-contracts
    tax: number;                    // Từ tax module (TODO)
  };
  
  // === FORECAST 7 NGÀY ===
  forecast7d: {
    day: number;                    // 1-7
    date: string;
    expectedIn: number;             // Từ supplier.expectedInflowByDay[date]
    expectedOut: number;            // = ads + payroll + ops + agent (nếu due)
    forecastBank: number;           // = prev + in - out
  }[];
  
  // === ALERTS ===
  alerts: {
    isCashCrunch: boolean;          // lowPoint < 0
    isSurvivalRisk: boolean;        // lowPoint < 3 * monthlyBurn
    runwayStatus: 'safe' | 'ok' | 'warning' | 'danger';
  };
}
```

---

## 7. SEQUENCE DIAGRAM - Financial Control gọi các module

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Financial       │     │ Supplier-Payable │     │ Agent-Receivable │
│ Control         │     │ Module           │     │ Module           │
└────────┬────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                       │                        │
         │ GET /summary/cashflow │                        │
         │──────────────────────>│                        │
         │   SupplierCashflow    │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ GET /summary/cashflow │                        │
         │───────────────────────────────────────────────>│
         │                        AgentCashflow           │
         │<───────────────────────────────────────────────│
         │                       │                        │
    ┌────┴────┐                  │                        │
    │ Tổng hợp │                  │                        │
    │ Dashboard│                  │                        │
    └────┬────┘                  │                        │
         │                       │                        │
```

---

## 8. MIGRATION CHECKLIST

### Phase 1: Sửa Naming (Ưu tiên cao) ✅ DONE
- [x] Supplier-Payable: Đổi `totalPaid` → `totalCommissionReceived`
- [x] Supplier-Payable: Đổi `totalUnpaid` → `totalCommissionUnreceived`
- [x] Thêm `totalCommissionExpected7d` với logic forecast
- [x] Agent-Payables: New endpoint `/api/agent-payables/...` 
- [x] Agent-Receivables: Deprecated with headers

### Phase 2: Thêm trường `due14d` (Cho Committed) ✅ DONE
- [x] Agent-Receivable: Thêm `totalAgentDue14d`
- [x] Labor-Statement: Thêm `totalPayrollDue14d`
- [x] Other-Cost: Thêm `totalOpsDue14d` + dueByDay7d + byCategory ✅ Module 5 DONE

### Phase 3: Gross/Net Distinction ✅ DONE
- [x] Agent: `totalAgentCommissionIncurred`, `totalAgentAdjustments`, `totalAgentClawback`
- [x] Payroll: `totalPayrollIncurred`, `totalPayrollBonus`, `totalPayrollDeduction`
- [x] Agent: Clawback handling (paid orders that later returned)

### Phase 4: Ads Spend Tracking ✅ DONE
- [x] Thêm `spendByDay[7]` với `adGroupCount`
- [x] Thêm `spendByAdGroup` với cap info + `platform`
- [x] Thêm `spendByPlatform` breakdown
- [x] Thêm `lastSyncAt`, `syncStatus`, `dataFreshnessHours`
- [x] Thêm `cashOutProxy: true` flag

### Phase 5: Financial Control Integration ✅ DONE (2026-02-03)
- [x] P0: Inject FinanceService + dùng debtSummary.totalDebtDue14d cho Committed
- [x] P1: Refactor `getExpectedOutflow()` → dùng cached dueByDay7d từ ops/debt summaries
- [x] P2: Refactor `getMonthlyBurn()` → dùng paid cash-out 30d từ summaries
- [x] P3: Mark fallback methods as @deprecated với warning logs
- [x] Thay `getCommittedCash()` query trực tiếp → gọi summary API ✅
- [x] Thay `getExpectedOutflow()` → cache dueByDay7d từ module summaries ✅
- [x] FC không còn query trực tiếp vào raw collections ✅

**Implementation Pattern**:
```typescript
// FC injects module services (không gọi HTTP)
constructor(
  @Inject(forwardRef(() => LaborStatementService)) private laborService,
  @Inject(forwardRef(() => OtherCostService)) private otherCostService,
  @Inject(forwardRef(() => FinanceService)) private financeService,
) {}

// FC calls summary methods
const laborSummary = await this.laborService.getCashflowSummary(windowDays);
const opsSummary = await this.otherCostService.getCashflowSummary(windowDays);
const debtSummary = await this.financeService.getDebtCashflowSummary(windowDays);

// Committed = sum of due14d
committed = laborSummary.totalPayrollDue14d
          + opsSummary.totalOpsDue14d
          + debtSummary.totalDebtDue14d
          + agentPayablesSummary.totalAgentDue14d;

// Burn = paid cash-out last 30d
burn = laborSummary.totalPayrollPaid
     + opsSummary.totalOpsPaid
     + debtSummary.totalDebtPaid;
// Note: Ads spend NOT included in burn (proxy only)
```

**Fallback Deprecation**:
- `getCommittedLaborFallback()` → @deprecated, use laborService.getCashflowSummary()
- `getCommittedOpsFallback()` → @deprecated, use otherCostService.getCashflowSummary()
- `getCommittedAgentFallback()` → @deprecated, use agentPayablesService.getCashflowSummary()
- `estimateSupplierPaymentFallback()` → @deprecated, use supplierPayablesService

**Removal Timeline**: Fallbacks to be removed after 2 weeks of stable operation (target: 2026-02-17)

### Phase 6: Remaining Modules ✅ DONE
- [x] Module 5: Ops Payables (`other-cost`) ✅ DONE
- [x] Module 6: Debt Summary (`loan-contract`) ✅ DONE
- [ ] Tax Summary (v2)

---

## 9. FIELD NAMING CONVENTION

| Hướng tiền | Tiếng Việt | Tiếng Anh | Prefix |
|------------|------------|-----------|--------|
| Tiền VÀO   | Đã thu / Chưa thu / Dự kiến thu | Received / Unreceived / Expected | `total*Received`, `total*Expected` |
| Tiền RA    | Đã trả / Chưa trả / Đến hạn | Paid / Unpaid / Due | `total*Paid`, `total*Due14d` |

---

## 10. KẾT LUẬN

**Code hiện tại đạt ~100%** so với spec CFO v3.1:
- ✅ Kiến trúc module đúng hướng
- ✅ Đã có summary endpoints với cấu trúc chuẩn
- ✅ Naming chuẩn AR/AP từ góc nhìn công ty
- ✅ Gross/Net distinction với adjustments
- ✅ `due14d` cho Committed cash (tất cả modules)
- ✅ Clawback handling cho Agent
- ✅ Platform breakdown + sync status cho Ads
- ✅ Ops Payables với dueDate + category + dueByDay7d
- ✅ Debt Summary với byLoan + dueByDay7d + alerts
- ✅ FC đọc từ module summaries thay vì query trực tiếp ✅ Phase 5 DONE

**Completed Modules**:
1. ✅ Supplier Settlement (AR) - v3.1
2. ✅ Agent Payables (AP) - v3.1 with clawback
3. ✅ Ads Spend (Proxy) - v3.1 with sync status
4. ✅ Payroll Payables (AP) - v3.1 with gross/net
5. ✅ Ops Payables (AP) - v3.1 with dueDate + category
6. ✅ Debt Summary (AP) - v1 with byLoan + forecast
7. ✅ FC Integration - v3.1 (read from summaries, fallbacks deprecated)

**Remaining**:
8. ⏳ Tax Summary (v2 - low priority)
9. ⏳ Remove deprecated fallbacks (target: 2026-02-17)

**Last Updated**: 2026-02-03
