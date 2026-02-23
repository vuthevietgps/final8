# Financial Control v1 - Release Note

**Ngày phát hành**: 2026-02-03  
**Trạng thái**: ✅ PRODUCTION READY  
**CFO Sign-off**: Đã xác nhận

---

## 1. Phạm Vi v1

### Modules Đã Hoàn Thành (1-6)

| # | Module | Summary API | Status |
|---|--------|-------------|--------|
| 1 | Labor (Payroll) | `GET /api/labor-statement/fc-summary` | ✅ Stable |
| 2 | Operational Costs | `GET /api/operational-costs/fc-summary` | ✅ Stable |
| 3 | Agent Commissions | `GET /api/agent-commissions/fc-summary` | ✅ Stable |
| 4 | Supplier (AR/AP) | `GET /api/supplier-payables/fc-summary` | ✅ Stable |
| 5 | Ads (Proxy) | `GET /api/ad-group-daily-report/optimal-spend` | ✅ Proxy |
| 6 | Debt Management | `GET /api/debt/fc-summary` | ✅ Stable |

### Financial Control Dashboard

| Endpoint | Mô tả | Response Time |
|----------|-------|---------------|
| `GET /api/financial-control/dashboard` | 8 số chính | ~6.4s |
| `GET /api/financial-control/full` | Full metrics + alerts | ~6.4s |
| `GET /api/financial-control/debug/deprecation-stats` | Fallback tracking | <100ms |

---

## 2. 8 Key Metrics (Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  FINANCIAL CONTROL DASHBOARD v1                             │
├─────────────────────────────────────────────────────────────┤
│  1. Bank Balance          │  Số dư tài khoản hiện tại       │
│  2. Committed Cash (14D)  │  Cam kết chi 14 ngày tới        │
│  3. Free Cash             │  = Bank - Committed             │
│  4. Monthly Burn          │  Chi phí tháng (30d paid)       │
│  5. Runway (months)       │  = FreeCash / MonthlyBurn       │
│  6. Survival Floor        │  = 3 × MonthlyBurn              │
│  7. Ads Budget Approved   │  = min(Optimal, Available)      │
│  8. Owner Withdrawable    │  = Available - AdsBudget        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Safety Features (Bắt Buộc v1)

### ✅ Đã Triển Khai

| Feature | Implementation | Mô tả |
|---------|----------------|-------|
| Parallel Calls | `Promise.allSettled()` | Gọi 4 summary APIs song song |
| Cycle Guard | `isCalculating` flag | Chặn recursive calls |
| Fail-soft Timeout | `withTimeout()` 3s | Fallback khi summary chậm |
| Sanity Rules | null/0 handling | runway=null khi burn=0 |
| Deprecation Tracking | Counter + endpoint | Monitor fallback usage |

### ⚠️ Khuyến Nghị v1.1 (Không Bắt Buộc)

| Feature | Priority | Mô tả |
|---------|----------|-------|
| Response Cache | Medium | Cache 30-60s theo asOfDate |
| Tiered Timeout | Low | Hard 3-5s, Soft 1-2s |
| Request-scoped Guard | Low | Thay global flag khi scale |

---

## 4. Cảnh Báo Vận Hành

### 4.1 Runway Status Thresholds

| Status | Condition | Action |
|--------|-----------|--------|
| 🟢 SAFE | runway ≥ 3 months | Có thể scale ads |
| 🟡 WARNING | 1 ≤ runway < 3 | Cân nhắc, giảm risk |
| 🔴 DANGER | runway < 1 month | KHÔNG scale, tăng inflow |

### 4.2 Khi Runway Danger

1. **Không scale ads** - Cashflow không đủ buffer
2. **Ưu tiên thu hồi AR** - Tăng cash inflow từ NCC
3. **Giảm committed** - Hoãn chi phí không cấp bách
4. **Giảm burn** - Cắt giảm operational costs

### 4.3 Alert Types

| Alert | Source Prefix | Severity |
|-------|---------------|----------|
| `[LABOR] ...` | Labor module | Varies |
| `[OPS] ...` | Operational | Varies |
| `[AGENT] ...` | Agent commission | Varies |
| `[SUPPLIER] ...` | Supplier AR/AP | Varies |
| `[DEBT] ...` | Debt management | Varies |
| `[FC] BURN_ZERO...` | Financial Control | INFO |
| `[FC] NEGATIVE_FREE_CASH` | Financial Control | CRITICAL |

---

## 5. Deprecated Fallbacks

### Deadline: 2026-02-17

| Fallback Method | Điều kiện xóa |
|-----------------|---------------|
| `getCommittedLaborFallback()` | 0 calls trong 7 ngày |
| `getCommittedOpsFallback()` | 0 calls trong 7 ngày |
| `getCommittedAgentFallback()` | 0 calls trong 7 ngày |
| `estimateSupplierPaymentFallback()` | 0 calls trong 7 ngày |

### Monitoring

```powershell
# Kiểm tra hàng ngày
Invoke-RestMethod -Uri "http://localhost:3000/api/financial-control/debug/deprecation-stats"
```

**Kỳ vọng**: Tất cả counters = 0

---

## 6. Definition of Done (v1)

- [x] Modules 1-6 stable với Summary APIs
- [x] FC full/dashboard stable + fail-soft
- [x] Parallel calls với Promise.allSettled
- [x] Cycle guard chống recursive
- [x] Timeout 3s per call
- [x] Sanity rules cho edge cases
- [ ] No fallbacks used 7 ngày liên tục (monitoring)
- [ ] Remove fallbacks sau 2026-02-17

---

## 7. Roadmap v2

| Priority | Feature | Mô tả |
|----------|---------|-------|
| P0 | Ads Payments Module | Real cash-out thay proxy |
| P1 | Tax Summary | Thêm vào committed cash |
| P2 | `paidByMonthLast3` | Burn calculation chuẩn hơn |
| P3 | Remove Fallbacks | Sau 14 ngày stable |

---

## 8. API Contract Reference

Xem chi tiết: [FINANCIAL-MODULES-API-CONTRACT.md](./FINANCIAL-MODULES-API-CONTRACT.md)

---

## 9. Technical Notes

### Core Formulas

```typescript
FreeCash = BankBalance - CommittedCash(14D)
SurvivalFloor = 3 × MonthlyBurn
AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)
AdsBudgetApproved = min(OptimalAdsSuggestion, AvailableAfterSurvival)
OwnerWithdrawable = max(0, AvailableAfterSurvival - AdsBudgetApproved)
```

### Optimal Ads Rule 20%

```typescript
BaselineSpend = max(SpendYesterday, AvgSpendLast3Days, MinStartBudget)
UpperCap = BaselineSpend × 1.20  // Tăng tối đa 20%
LowerCap = BaselineSpend × 0.70  // Giảm tối đa 30%
OptimalSuggested = clamp(OptimalRaw, LowerCap, UpperCap)
```

### Config Defaults

| Config | Value | Mô tả |
|--------|-------|-------|
| `CommittedWindowDays` | 14 | Cửa sổ committed cash |
| `SurvivalMonths` | 3 | Buffer runway tối thiểu |
| `SupplierCashCycleDays` | 10 | AR collection cycle |
| `RiskAdjustInflow` | 0.80 | Điều chỉnh risk cho inflow |
| `MinStartBudget` | 200,000 VNĐ | Budget khởi điểm ads |

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-03  
**Author**: Development Team  
**Approved By**: CFO
