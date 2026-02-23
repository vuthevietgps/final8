# ✅ AUTO SCALE & KILL SYSTEM - HOÀN THÀNH

## 📋 Tổng Quan

Đã xây dựng **hệ thống tự động scale/kill ads** dựa trên:
- ✅ Báo cáo chi phí và lợi nhuận thuần (AdGroupDailyReport)
- ✅ Vốn phân bổ 45% tái đầu tư (Capital Allocation)  
- ✅ Performance metrics: ROI, ROAS, Profit Margin, Success Rate
- ✅ Risk assessment từ Quality Control

---

## 🎯 Files Đã Tạo

### 1. Documentation
📄 **[docs/AUTO-SCALE-KILL-RULES.md](./AUTO-SCALE-KILL-RULES.md)**
- Quy tắc chi tiết cho 5 actions: KILL, SCALE_DOWN, MAINTAIN, SCALE_UP_MODERATE, SCALE_UP_AGGRESSIVE
- Metrics definitions: ROI, ROAS, Profit Margin, Success Rate, CPA, AOV
- Advanced rules: New ad group bootstrap, Seasonal boost, Competitor detection, Budget reallocation
- Best practices và monitoring

### 2. Backend Services

📄 **[backend/src/finance/auto-scale-decision.service.ts](d:/code/final8/final8-version14.0/backend/src/finance/auto-scale-decision.service.ts)**
- Decision engine: Áp dụng rules để ra quyết định
- Methods:
  - `makeDecision(adGroupId, currentBudget)` → ScaleDecision
  - `getAggregatedMetrics()` → Tính toán metrics từ 7 ngày
  - `applyRules()` → Áp dụng 5 rules theo priority
  - `shouldKill()`, `shouldScaleDown()`, `shouldMaintain()`, `shouldScaleUp()`

📄 **[backend/src/finance/auto-scale-execution.service.ts](d:/code/final8/final8-version14.0/backend/src/finance/auto-scale-execution.service.ts)**
- Execution engine: Thực thi quyết định
- Cronjob: Chạy mỗi ngày 02:00 AM
- Methods:
  - `runDailyAutoScale()` → Process tất cả ad groups
  - `killAdGroup()` → Tắt ad group
  - `scaleUpAdGroup()` → Tăng budget
  - `scaleDownAdGroup()` → Giảm budget
  - `runManualAutoScale()` → Manual trigger cho testing

### 3. Module Updates

📄 **[backend/src/finance/finance.module.ts](d:/code/final8/final8-version14.0/backend/src/finance/finance.module.ts)**
- Đã thêm `AutoScaleDecisionService` và `AutoScaleExecutionService` vào providers
- Exported để có thể dùng ở modules khác

---

## 🔄 Luồng Hoạt Động

```
1. CRONJOB (Mỗi ngày 02:00 AM)
   ↓
2. Lấy Reinvestment Fund (45% từ Capital Allocation)
   ↓
3. Lấy danh sách Active Ad Groups
   ↓
4. Với mỗi Ad Group:
   ├─ Lấy metrics 7 ngày (AdGroupDailyReport)
   ├─ Tính: ROI, ROAS, Profit Margin, Success Rate
   ├─ Check: Risk Level (Quality Control)
   ├─ Áp dụng Rules → Decision
   │  ├─ KILL (ROI < 50%)
   │  ├─ SCALE_DOWN (50% ≤ ROI < 100%)
   │  ├─ MAINTAIN (100% ≤ ROI < 150%)
   │  ├─ SCALE_UP_MODERATE (150% ≤ ROI < 250%)
   │  └─ SCALE_UP_AGGRESSIVE (ROI ≥ 250%)
   ├─ Execute Decision
   │  ├─ Update Database
   │  └─ Apply to Platform (Facebook/Google/TikTok)
   └─ Log Result
   ↓
5. Summary Report
   ├─ Scaled Up: X
   ├─ Scaled Down: Y
   ├─ Killed: Z
   └─ Maintained: W
```

---

## 📊 Rules Summary

| Condition | ROI | Profit Margin | Success Rate | Action | Budget Change |
|-----------|-----|---------------|--------------|--------|---------------|
| 🔴 Very Poor | < 50% | < 5% | < 50% | **KILL** | 0 |
| 🟠 Poor | 50-99% | 5-9% | 50-59% | **SCALE_DOWN** | -25% |
| 🟡 Acceptable | 100-149% | 10-14% | 60-69% | **MAINTAIN** | 0% |
| 🟢 Good | 150-249% | 15-19% | 70-79% | **SCALE_UP_MODERATE** | +15% |
| 🟢 Excellent | ≥ 250% | ≥ 20% | ≥ 80% | **SCALE_UP_AGGRESSIVE** | +20-30% |

**Điều kiện bổ sung:**
- SCALE_UP_AGGRESSIVE: Cần `profitTrend = INCREASING` và `riskLevel = LOW`
- SCALE_UP_MODERATE: Cần ít nhất 5 đơn/7 ngày
- KILL: Kích hoạt nếu lỗ liên tục 3 ngày hoặc return rate > 30%

---

## 🚀 Cách Sử Dụng

### 1. Tự Động (Production)
```bash
# Cronjob tự động chạy mỗi ngày 02:00 AM
# Không cần làm gì, hệ thống tự chạy
```

### 2. Manual Trigger (Testing)
```bash
# API endpoint để trigger manually
POST /finance/auto-scale/run
Body: {
  "adGroupId": "optional - để trống nếu muốn chạy all"
}
```

### 3. Monitor Results
```bash
# Xem logs trong console
# Hoặc query database auto_scale_logs collection
```

---

## 🔧 Configuration

### Budget Limits (trong auto-scale-decision.service.ts)
```typescript
const CONFIG = {
  // Daily budget caps
  minDailyBudget: 100_000,        // Không giảm dưới 100k/ngày
  maxDailyBudget: 10_000_000,     // Không vượt 10M/ngày
  maxDailyBudgetModerate: 5_000_000,  // Max 5M cho moderate scale
  
  // Scale rates
  scaleUpAggressive: {
    roi_400: 0.30,  // +30% nếu ROI ≥ 400%
    roi_300: 0.25,  // +25% nếu ROI ≥ 300%
    roi_250: 0.20   // +20% nếu ROI ≥ 250%
  },
  scaleUpModerate: 0.15,   // +15%
  scaleDown: 0.75,         // -25%
  
  // Minimum fund requirements
  minFundForAggressive: 1_000_000,  // Cần ít nhất 1M trong fund
  minFundForModerate: 500_000,      // Cần ít nhất 500k trong fund
  
  // Data requirements
  minOrders7Days_Moderate: 5,
  minOrders7Days_Aggressive: 10
};
```

### Thresholds
```typescript
const THRESHOLDS = {
  roi: {
    kill: 50,
    scaleDown: 100,
    maintain: 150,
    scaleUpModerate: 250,
    scaleUpAggressive: 250
  },
  profitMargin: {
    kill: 5,
    scaleDown: 10,
    maintain: 15,
    scaleUpModerate: 20,
    scaleUpAggressive: 20
  },
  successRate: {
    kill: 50,
    scaleDown: 60,
    maintain: 70,
    scaleUpModerate: 80,
    scaleUpAggressive: 80
  },
  returnRate: {
    kill: 30  // Kill nếu hoàn hàng > 30%
  },
  consecutiveLossDays: 3  // Kill nếu lỗ liên tục 3 ngày
};
```

---

## 📈 Expected Results

### Ví Dụ Thực Tế

**Scenario 1: Ad Group Tốt → Scale Up**
```
Ad Group: iPhone_15_Pro_Campaign
Current Budget: 2,000,000 VND/ngày
ROI: 320%
Profit Margin: 28%
Success Rate: 87%
Risk Level: LOW
Trend: INCREASING

→ Decision: SCALE_UP_AGGRESSIVE (+25%)
→ New Budget: 2,500,000 VND/ngày
→ Expected Profit: +156,000 VND/ngày
```

**Scenario 2: Ad Group Kém → Kill**
```
Ad Group: Low_Quality_Product
Current Budget: 500,000 VND/ngày
ROI: 35%
Profit Margin: 3%
Success Rate: 42%
Consecutive Loss: 4 days

→ Decision: KILL
→ New Budget: 0 VND
→ Saved: 500,000 VND/ngày
```

**Scenario 3: Ad Group Trung Bình → Maintain**
```
Ad Group: Samsung_Galaxy_S24
Current Budget: 1,500,000 VND/ngày
ROI: 125%
Profit Margin: 12%
Success Rate: 65%

→ Decision: MAINTAIN
→ New Budget: 1,500,000 VND (unchanged)
```

---

## ⚠️ Lưu Ý Quan Trọng

### 1. Cash Flow Safety
```typescript
// System LUÔN check reinvestment fund trước khi scale up
if (reinvestmentFund < 500_000) {
  // Không scale up, chỉ maintain hoặc scale down
}
```

### 2. Gradual Changes
```typescript
// Không thay đổi budget quá đột ngột
// Max ±30% mỗi ngày để tránh shock
```

### 3. Quality Control Integration
```typescript
// Check risk level từ Quality Control
if (riskLevel === 'HIGH' && predictionAccuracy < 50) {
  // → KILL ngay lập tức
}
```

### 4. Platform API Errors
```typescript
// Nếu fail khi apply lên Facebook/Google/TikTok
// Database vẫn update → Có thể manual apply sau
```

---

## 🔮 Next Steps

### Phase 1: Testing (1-2 tuần)
- [ ] Test với 1-2 ad groups trước
- [ ] Monitor kết quả hàng ngày
- [ ] Điều chỉnh thresholds nếu cần

### Phase 2: Rollout (2-4 tuần)
- [ ] Áp dụng cho tất cả ad groups
- [ ] Setup alerting qua Telegram/Email
- [ ] Tạo dashboard monitoring real-time

### Phase 3: Optimization (1-2 tháng)
- [ ] ML model để predict ROI
- [ ] Dynamic thresholds dựa trên historical data
- [ ] A/B testing different strategies

---

## 📞 Support

Nếu có vấn đề:
1. Check logs: Console output của cronjob
2. Check database: `auto_scale_logs` collection
3. Manual trigger: POST `/finance/auto-scale/run`
4. Disable auto scale: Comment out `@Cron` decorator

---

## 📚 Related Documents

- [CASH-FLOW-VS-ACCRUAL-ACCOUNTING.md](./CASH-FLOW-VS-ACCRUAL-ACCOUNTING.md) - Quản lý cash flow
- [BUDGET-ALLOCATION-GUIDE.md](./BUDGET-ALLOCATION-GUIDE.md) - Hướng dẫn phân bổ ngân sách
- [finance-insights.md](./finance-insights.md) - Phân tích tài chính
- [AUTO-SCALE-KILL-RULES.md](./AUTO-SCALE-KILL-RULES.md) - Quy tắc chi tiết

---

**Status:** ✅ READY FOR TESTING  
**Version:** 1.0  
**Date:** 2026-01-26
