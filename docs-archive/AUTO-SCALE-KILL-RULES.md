# 🎯 AUTO SCALE & KILL RULES - Quy Tắc Tự Động Điều Chỉnh Ads

## 📋 Tổng Quan

Hệ thống tự động **Scale Up** (tăng ngân sách) hoặc **Kill** (giảm/tắt ngân sách) dựa trên:
1. **Báo cáo chi phí và lợi nhuận thuần** từ AdGroupDailyReport
2. **Vốn phân bổ 45% tái đầu tư** từ Capital Allocation
3. **Performance metrics**: ROI, ROAS, Profit Margin, Success Rate

---

## 🔄 Luồng Vốn & Decision Making

```
Vốn Ban Đầu + Vay
    ↓
[Phân Bổ Ngân Sách] → Chạy Ads (Chi phí đi trước)
    ↓
Đơn Hàng → Doanh Thu → Lợi Nhuận Thuần (Tiền về sau)
    ↓
[Phân Bổ Lợi Nhuận Thuần - MODERATE MODE]
    ↓
├─ 45% Tái Đầu Tư → Reinvestment Fund
│  └─ Chia theo performance → Ad Groups
├─ 25% Dự Phòng → Safety Reserve
├─ 20% Thu Nhập Cá Nhân
└─ 10% Tài Sản Dài Hạn

Reinvestment Fund → Auto Scale/Kill Decision
    ↓
SCALE UP (tăng ngân sách nếu ROI cao)
SCALE DOWN (giảm ngân sách nếu ROI thấp)
KILL (tắt hoàn toàn nếu lỗ nặng)
```

---

## 📊 Metrics Định Nghĩa

### 1. ROI (Return on Investment)
```typescript
ROI = (netProfit / adCost) × 100%

Ví dụ:
- Chi phí ads: 1,000,000 VND
- Lợi nhuận thuần: 2,500,000 VND
- ROI = (2,500,000 / 1,000,000) × 100% = 250%
```

**Phân loại:**
- 🟢 **Excellent**: ROI ≥ 300% → Scale mạnh
- 🟢 **Good**: 200% ≤ ROI < 300% → Scale vừa phải
- 🟡 **Acceptable**: 100% ≤ ROI < 200% → Maintain
- 🟠 **Poor**: 50% ≤ ROI < 100% → Giảm budget
- 🔴 **Very Poor**: ROI < 50% → Kill

### 2. ROAS (Return on Ad Spend)
```typescript
ROAS = revenue / adCost

Ví dụ:
- Chi phí ads: 1,000,000 VND
- Doanh thu: 5,000,000 VND
- ROAS = 5,000,000 / 1,000,000 = 5.0
```

**Target:**
- Minimum ROAS: 2.0 (mỗi 1đ chi → 2đ doanh thu)
- Good ROAS: 4.0+

### 3. Profit Margin (Tỷ suất lợi nhuận)
```typescript
Profit Margin = (netProfit / revenue) × 100%

Ví dụ:
- Doanh thu: 5,000,000 VND
- Lợi nhuận thuần: 2,000,000 VND
- Profit Margin = (2,000,000 / 5,000,000) × 100% = 40%
```

**Phân loại:**
- 🟢 **Excellent**: ≥ 30%
- 🟢 **Good**: 20-29%
- 🟡 **Acceptable**: 10-19%
- 🟠 **Poor**: 5-9%
- 🔴 **Very Poor**: < 5%

### 4. Success Rate (Tỷ lệ giao hàng thành công)
```typescript
Success Rate = (deliveredOrders / totalOrders) × 100%

Ví dụ:
- Tổng đơn: 100 đơn
- Giao thành công: 85 đơn
- Success Rate = 85%
```

**Target:**
- Minimum: 60%
- Good: 80%+

### 5. CPA (Cost Per Acquisition)
```typescript
CPA = adCost / totalOrders

Ví dụ:
- Chi phí ads: 1,000,000 VND
- Số đơn: 20 đơn
- CPA = 1,000,000 / 20 = 50,000 VND/đơn
```

### 6. Average Order Value (AOV)
```typescript
AOV = totalRevenue / totalOrders
```

---

## ⚡ RULES - QUY TẮC TỰ ĐỘNG

### 🟢 RULE 1: SCALE UP (Tăng Ngân Sách) - AGGRESSIVE GROWTH

**Điều kiện (TẤT CẢ phải thỏa):**
```typescript
{
  // Performance metrics
  roi >= 250,                    // ROI >= 250%
  profitMargin >= 20,            // Lợi nhuận >= 20%
  successRate >= 80,             // Tỷ lệ giao thành công >= 80%
  
  // Volume metrics
  totalOrders_7days >= 10,       // Ít nhất 10 đơn/7 ngày
  
  // Trend analysis
  profitTrend: 'INCREASING',     // Lợi nhuận đang tăng
  
  // Risk check
  riskLevel: 'LOW',              // Rủi ro thấp
  
  // Budget availability
  reinvestmentFundAvailable > 0  // Còn vốn 45% tái đầu tư
}
```

**Action:**
```typescript
// Scale up 20-30% budget
newBudget = currentBudget * (1 + scaleUpRate);

scaleUpRate = {
  roi >= 400: 0.30,  // +30% nếu ROI cực cao
  roi >= 300: 0.25,  // +25% nếu ROI rất cao
  roi >= 250: 0.20   // +20% nếu ROI cao
};

// Guardrails
maxDailyBudget = 10_000_000;  // Max 10M/ngày
newBudget = Math.min(newBudget, maxDailyBudget);
```

**Example:**
```
Ad Group: iPhone_15_Campaign_1
Current Budget: 1,000,000 VND/ngày
ROI: 320%
Profit Margin: 25%
Success Rate: 85%
→ SCALE UP: 1,000,000 × 1.25 = 1,250,000 VND/ngày
```

---

### 🟢 RULE 2: SCALE UP MODERATE (Tăng Ngân Sách Vừa Phải)

**Điều kiện:**
```typescript
{
  roi >= 150 && roi < 250,
  profitMargin >= 15 && profitMargin < 20,
  successRate >= 70,
  totalOrders_7days >= 5,
  riskLevel: 'LOW' | 'MEDIUM'
}
```

**Action:**
```typescript
// Scale up 10-15%
newBudget = currentBudget × 1.15;
```

---

### 🟡 RULE 3: MAINTAIN (Giữ Nguyên)

**Điều kiện:**
```typescript
{
  roi >= 100 && roi < 150,
  profitMargin >= 10 && profitMargin < 15,
  successRate >= 60,
  riskLevel: 'MEDIUM'
}
```

**Action:**
```typescript
// Không thay đổi budget
newBudget = currentBudget;

// Nhưng monitoring chặt chẽ
monitoringFrequency = 'DAILY';
```

---

### 🟠 RULE 4: SCALE DOWN (Giảm Ngân Sách)

**Điều kiện:**
```typescript
{
  roi >= 50 && roi < 100,      // ROI dương nhưng thấp
  OR
  profitMargin >= 5 && profitMargin < 10,
  OR
  successRate >= 50 && successRate < 60,
  OR
  riskLevel: 'MEDIUM' | 'HIGH'
}
```

**Action:**
```typescript
// Giảm 20-30% budget
newBudget = currentBudget × 0.75;

// Minimum budget floor
minDailyBudget = 100_000;  // Không giảm dưới 100k/ngày
newBudget = Math.max(newBudget, minDailyBudget);
```

**Example:**
```
Ad Group: Samsung_Galaxy_Campaign
Current Budget: 2,000,000 VND/ngày
ROI: 80%
Profit Margin: 8%
Success Rate: 55%
→ SCALE DOWN: 2,000,000 × 0.75 = 1,500,000 VND/ngày
```

---

### 🔴 RULE 5: KILL - PAUSE (Tắt Hoàn Toàn)

**Điều kiện (BẤT KỲ điều kiện nào):**
```typescript
{
  // Critical performance
  roi < 50,                      // ROI < 50% (lỗ nặng)
  OR
  profitMargin < 5,              // Profit < 5%
  OR
  successRate < 50,              // Giao thành công < 50%
  
  // Continuous losses
  OR
  consecutiveLossDays >= 3,      // Lỗ liên tục 3 ngày
  
  // High risk
  OR
  riskLevel === 'HIGH' && predictionAccuracy < 50,
  
  // Quality issues
  OR
  returnRate > 30                // Tỷ lệ hoàn hàng > 30%
}
```

**Action:**
```typescript
// Tắt hoàn toàn
newBudget = 0;
adGroupStatus = 'PAUSED';
pauseReason = 'Auto-killed due to poor performance';

// Gửi alert
sendAlert({
  type: 'CRITICAL',
  message: `Ad Group ${adGroupId} đã bị tắt tự động`,
  metrics: { roi, profitMargin, successRate }
});
```

**Example:**
```
Ad Group: Low_Quality_Product
Current Budget: 500,000 VND/ngày
ROI: 30%
Profit Margin: 3%
Success Rate: 40%
Consecutive Loss Days: 4
→ KILL: Budget = 0, Status = PAUSED
```

---

## 🎯 ADVANCED RULES - Tình Huống Đặc Biệt

### Rule A: Testing Phase Labels (Gắn Nhãn Testing)

**Vấn đề:** Ad groups mới cần testing period riêng với rules khác biệt

**Solution: Testing Labels**
```typescript
interface AdGroup {
  adGroupId: string;
  testingPhase?: 'TESTING' | 'GROWTH' | 'MATURE' | 'STABLE';
  testingStartDate?: Date;
  daysSinceLaunch?: number;
  isManualOverride?: boolean;  // Không auto scale nếu true
}
```

**Testing Phase Rules:**

#### Phase 1: TESTING (0-7 ngày)
```typescript
{
  label: 'TESTING',
  initialBudget: 300_000,        // Bắt đầu với 300k/ngày
  maxBudget: 1_000_000,          // KHÔNG vượt 1M trong phase này
  minOrders: 5,                  // Cần ít nhất 5 đơn để đánh giá
  
  // ⚠️ Rules khác biệt:
  scaleUpRate: 0.10,             // CHỈ scale +10% (thay vì +20-30%)
  scaleDownRate: 0.85,           // Scale down ít hơn: -15% (thay vì -25%)
  
  // Kill threshold khác:
  minROI: 30,                    // Chấp nhận ROI thấp hơn (30% thay vì 50%)
  minSuccessRate: 40,            // Chấp nhận success rate thấp hơn
  
  // Đánh giá sau 7 ngày:
  evaluationCriteria: {
    if (roi >= 100 && totalOrders >= 5) {
      → Promote to GROWTH phase
    } else if (roi < 30) {
      → KILL
    } else {
      → Extend TESTING for 7 more days with lower budget
    }
  }
}
```

#### Phase 2: GROWTH (8-30 ngày)
```typescript
{
  label: 'GROWTH',
  maxBudget: 3_000_000,          // Tăng cap lên 3M
  scaleUpRate: 0.15,             // Scale +15% (vẫn thận trọng)
  
  // Áp dụng standard thresholds
  minROI: 50,
  minSuccessRate: 60,
  
  // Weekly incremental scaling
  weeklyGrowthCap: 0.50,         // Tối đa tăng 50% so với tuần trước
  
  if (roi >= 200 && daysSinceLaunch >= 21) {
    → Promote to MATURE phase
  }
}
```

#### Phase 3: MATURE (30+ ngày)
```typescript
{
  label: 'MATURE',
  maxBudget: 10_000_000,         // Full cap 10M
  
  // Áp dụng FULL standard rules
  applyStandardRules: true,
  
  // Nhưng giới hạn scale rate để tránh learning reset
  maxDailyScaleUp: 0.20          // ⚠️ MAX +20%/ngày
}
```

#### Phase 4: STABLE (90+ ngày, ROI ổn định)
```typescript
{
  label: 'STABLE',
  // Ưu tiên cao cho horizontal scaling thay vì vertical
  preferHorizontalScaling: true,
  
  // Chỉ scale up nếu thực sự cần
  scaleUpThreshold: roi >= 300  // ROI phải rất cao mới scale
}
```

---

### Rule B: Learning Phase Protection (Bảo Vệ Giai Đoạn Học)

**⚠️ VẤN ĐỀ NGHIÊM TRỌNG:**
Facebook Ads reset learning phase nếu thay đổi budget >20% trong 1 ngày
→ Performance bất ổn, CPA tăng cao, waste budget

**Solution: Scale Rate Caps**
```typescript
const LEARNING_PHASE_PROTECTION = {
  // Facebook's learning phase rules
  maxDailyBudgetIncrease: 0.20,      // ⚠️ MAX +20%/ngày
  maxDailyBudgetDecrease: 0.30,      // Có thể giảm nhiều hơn
  
  // Split large increases over multiple days
  if (suggestedIncrease > 0.20) {
    // Ví dụ: Cần tăng 50%
    // Day 1: +20% (1.0M → 1.2M)
    // Day 2: +20% (1.2M → 1.44M)
    // Day 3: +8%  (1.44M → 1.55M) ≈ 50% total
    
    const days = Math.ceil(Math.log(1 + suggestedIncrease) / Math.log(1.20));
    return {
      action: 'GRADUAL_SCALE',
      dailyIncrease: 0.20,
      totalDays: days,
      message: `Scale +${(suggestedIncrease * 100).toFixed(0)}% over ${days} days to avoid learning reset`
    };
  }
};
```

**Implementation:**
```typescript
function safeScaleUp(
  currentBudget: number,
  targetBudget: number,
  adGroupAge: number
): ScaleDecision {
  const increaseRate = (targetBudget - currentBudget) / currentBudget;
  
  // Ad groups mới (<30 ngày) càng nhạy cảm với learning reset
  const maxSafeIncrease = adGroupAge < 30 ? 0.15 : 0.20;
  
  if (increaseRate > maxSafeIncrease) {
    // Split increase
    const newBudget = currentBudget * (1 + maxSafeIncrease);
    
    return {
      action: 'SCALE_UP_GRADUAL',
      newBudget,
      reason: `Gradual scale to avoid learning reset. Day 1 of ${Math.ceil(increaseRate / maxSafeIncrease)}`,
      remainingIncrease: targetBudget - newBudget,
      scheduleNextIncrease: true  // Flag để scale tiếp ngày mai
    };
  }
  
  return {
    action: 'SCALE_UP',
    newBudget: targetBudget,
    reason: 'Safe increase within learning phase limits'
  };
}
```

---

### Rule C: Frequency-Based Scaling (Kiểm Tra Tần Suất)

**Vấn đề:** Frequency >2 → Audience bão hòa → Scale thêm = waste money

**Frequency Metrics từ Facebook API:**
```typescript
interface FrequencyMetrics {
  frequency: number;           // Số lần trung bình 1 người thấy ad
  reach: number;               // Số người unique đã thấy
  impressions: number;         // Tổng số lượt hiển thị
  // frequency = impressions / reach
}
```

**Frequency-Based Rules:**
```typescript
function checkFrequencyBeforeScale(
  frequency: number,
  reach: number,
  audienceSize: number
): FrequencyCheck {
  
  // RULE 1: High Frequency = Audience Fatigue
  if (frequency >= 2.5) {
    return {
      canScale: false,
      reason: `Frequency quá cao (${frequency.toFixed(2)}). Audience đã bão hòa`,
      recommendation: 'HORIZONTAL_SCALE',  // Tạo ad group mới
      action: 'MAINTAIN'  // Giữ nguyên budget
    };
  }
  
  // RULE 2: Medium Frequency + Low Reach = Có thể scale
  if (frequency >= 1.5 && frequency < 2.5) {
    const reachRate = reach / audienceSize;
    
    if (reachRate < 0.3) {
      // Chưa reach 30% audience → Có thể scale moderate
      return {
        canScale: true,
        maxScaleRate: 0.15,  // Chỉ +15%
        reason: `Frequency ${frequency.toFixed(2)}, reach ${(reachRate * 100).toFixed(0)}% - scale thận trọng`,
        action: 'SCALE_UP_MODERATE'
      };
    } else {
      // Đã reach >30% → Không scale
      return {
        canScale: false,
        reason: 'Đã reach >30% audience với frequency cao',
        recommendation: 'HORIZONTAL_SCALE',
        action: 'MAINTAIN'
      };
    }
  }
  
  // RULE 3: Low Frequency = Healthy, có thể scale
  if (frequency < 1.5) {
    return {
      canScale: true,
      maxScaleRate: 0.25,  // Có thể scale mạnh
      reason: `Frequency thấp (${frequency.toFixed(2)}) - audience còn fresh`,
      action: 'SCALE_UP_AGGRESSIVE'
    };
  }
  
  return {
    canScale: true,
    maxScaleRate: 0.20,
    action: 'SCALE_UP_MODERATE'
  };
}
```

**Integration vào Main Decision:**
```typescript
async makeDecision(adGroupId: string): Promise<ScaleDecision> {
  // 1. Get performance metrics
  const metrics = await this.getAggregatedMetrics(adGroupId);
  
  // 2. Get frequency metrics từ Facebook API
  const frequencyMetrics = await this.getFrequencyMetrics(adGroupId);
  
  // 3. Check frequency TRƯỚC KHI apply rules
  const frequencyCheck = this.checkFrequencyBeforeScale(
    frequencyMetrics.frequency,
    frequencyMetrics.reach,
    frequencyMetrics.audienceSize
  );
  
  if (!frequencyCheck.canScale) {
    return {
      action: frequencyCheck.action,
      newBudget: metrics.currentBudget,
      reason: frequencyCheck.reason,
      recommendation: frequencyCheck.recommendation,  // HORIZONTAL_SCALE
      confidence: 95
    };
  }
  
  // 4. Apply standard rules NHƯNG giới hạn scale rate
  const standardDecision = this.applyRules(metrics);
  
  if (standardDecision.action.includes('SCALE_UP')) {
    // Limit scale rate theo frequency check
    const maxIncrease = metrics.currentBudget * frequencyCheck.maxScaleRate;
    const cappedBudget = Math.min(
      standardDecision.newBudget,
      metrics.currentBudget + maxIncrease
    );
    
    return {
      ...standardDecision,
      newBudget: cappedBudget,
      reason: `${standardDecision.reason} (Capped by frequency check: max +${(frequencyCheck.maxScaleRate * 100).toFixed(0)}%)`
    };
  }
  
  return standardDecision;
}
```

---

### Rule D: Horizontal Scaling Strategy (Mở Rộng Theo Chiều Ngang)

**Khi nào Horizontal Scaling?**
```typescript
const HORIZONTAL_SCALING_TRIGGERS = {
  // Trigger 1: Frequency cao
  frequencyTooHigh: frequency >= 2.5,
  
  // Trigger 2: Ad group đã ở max budget
  reachedBudgetCap: currentBudget >= 10_000_000,
  
  // Trigger 3: ROI tốt + Reinvestment fund nhiều
  goodPerformanceWithFunds: roi >= 200 && reinvestmentFund > 5_000_000,
  
  // Trigger 4: Ad group ở STABLE phase
  stablePhase: testingPhase === 'STABLE' && daysSinceLaunch > 90
};
```

**Horizontal Scaling Decision:**
```typescript
async considerHorizontalScaling(
  adGroupId: string,
  metrics: AggregatedMetrics,
  frequencyCheck: FrequencyCheck,
  reinvestmentFund: number
): Promise<HorizontalScaleDecision> {
  
  // Kiểm tra điều kiện
  const shouldHorizontalScale = (
    frequencyCheck.recommendation === 'HORIZONTAL_SCALE' ||
    metrics.currentBudget >= 10_000_000 ||
    (metrics.roi >= 200 && reinvestmentFund > 5_000_000)
  );
  
  if (!shouldHorizontalScale) {
    return { action: 'NONE' };
  }
  
  // Lấy thông tin ad group hiện tại
  const adGroup = await this.adGroupModel.findOne({ adGroupId });
  const productCategory = adGroup.productCategoryId;
  const products = adGroup.selectedProducts;
  
  // Tìm các ad groups khác cùng product category
  const siblingAdGroups = await this.adGroupModel.find({
    productCategoryId: productCategory,
    isActive: true,
    adGroupId: { $ne: adGroupId }
  });
  
  // Kiểm tra xem có thể tạo ad group mới không
  const maxAdGroupsPerCategory = 5;  // Giới hạn 5 ad groups/category
  
  if (siblingAdGroups.length >= maxAdGroupsPerCategory) {
    return {
      action: 'CANNOT_SCALE',
      reason: `Đã đạt max ${maxAdGroupsPerCategory} ad groups cho category ${productCategory}`
    };
  }
  
  // Tính budget cho ad group mới
  const newAdGroupBudget = Math.min(
    metrics.currentBudget * 0.5,  // 50% budget của ad group hiện tại
    1_000_000  // Max 1M cho ad group mới
  );
  
  return {
    action: 'CREATE_NEW_AD_GROUP',
    reason: `Horizontal scaling: ${frequencyCheck.reason}`,
    newAdGroupConfig: {
      productCategoryId: productCategory,
      selectedProducts: products,  // Cùng sản phẩm
      initialBudget: newAdGroupBudget,
      testingPhase: 'TESTING',
      basedOnAdGroup: adGroupId,  // Reference đến ad group gốc
      targetingStrategy: 'LOOKALIKE',  // Targeting khác để tránh overlap
      note: `Horizontal scale from ${adGroupId} due to ${frequencyCheck.reason}`
    },
    estimatedROI: metrics.roi * 0.8,  // Expect 80% ROI của ad group gốc
    confidence: 75
  };
}
```

**Targeting Strategies cho Ad Groups Mới:**
```typescript
const TARGETING_STRATEGIES = [
  {
    name: 'LOOKALIKE_1',
    description: 'Lookalike 1% từ customers hiện tại',
    audienceSize: 500_000,
    expectedPerformance: 0.9  // 90% so với ad group gốc
  },
  {
    name: 'LOOKALIKE_2_3',
    description: 'Lookalike 2-3% mở rộng',
    audienceSize: 1_500_000,
    expectedPerformance: 0.7  // 70%
  },
  {
    name: 'INTEREST_TARGETING',
    description: 'Interest-based targeting (related products)',
    audienceSize: 2_000_000,
    expectedPerformance: 0.6  // 60%
  },
  {
    name: 'BROAD_TARGETING',
    description: 'Broad targeting để Facebook tự optimize',
    audienceSize: 5_000_000,
    expectedPerformance: 0.5  // 50%
  }
];
```

**Auto-Create New Ad Group:**
```typescript
async createHorizontalAdGroup(
  config: NewAdGroupConfig
): Promise<AdGroup> {
  
  // 1. Tạo ad group trong database
  const newAdGroup = await this.adGroupModel.create({
    name: `${config.basedOnAdGroup}_Horizontal_${Date.now()}`,
    productCategoryId: config.productCategoryId,
    selectedProducts: config.selectedProducts,
    budget: config.initialBudget,
    testingPhase: 'TESTING',
    basedOnAdGroup: config.basedOnAdGroup,
    targetingStrategy: config.targetingStrategy,
    isActive: true,
    createdAt: new Date(),
    autoCreated: true,
    autoCreatedReason: config.note
  });
  
  // 2. Tạo campaign trên Facebook (via API)
  const parentAdGroup = await this.adGroupModel.findOne({ 
    adGroupId: config.basedOnAdGroup 
  });
  
  const facebookCampaign = await this.createFacebookCampaign({
    name: newAdGroup.name,
    objective: 'OUTCOME_SALES',  // hoặc CONVERSIONS
    dailyBudget: config.initialBudget,
    targeting: this.getTargetingConfig(config.targetingStrategy),
    adCreative: parentAdGroup.adCreativeId,  // Dùng creative của ad group gốc
    pixelId: parentAdGroup.pixelId
  });
  
  // 3. Update adGroupId từ Facebook
  await this.adGroupModel.updateOne(
    { _id: newAdGroup._id },
    { $set: { adGroupId: facebookCampaign.id } }
  );
  
  // 4. Log
  this.logger.log(`✅ Created horizontal ad group: ${facebookCampaign.id} from ${config.basedOnAdGroup}`);
  
  return newAdGroup;
}
```

---

### Rule E: New Ad Group Bootstrap (Ad Group Mới)

**→ Xem Rule A: Testing Phase Labels cho chi tiết**

Quick Summary:
- **Phase 1: TESTING (0-7 ngày)**: Max budget 1M, scale +10%, ROI threshold thấp hơn
- **Phase 2: GROWTH (8-30 ngày)**: Max budget 3M, scale +15%, weekly growth cap 50%
- **Phase 3: MATURE (30+ ngày)**: Max budget 10M, full rules, max scale +20%/day
- **Phase 4: STABLE (90+ ngày)**: Prefer horizontal scaling, scale chỉ khi ROI >= 300%

---

### Rule B: Seasonal/Event Boost (Theo Mùa/Sự Kiện)

```typescript
// Tự động tăng budget trong dịp đặc biệt
const specialPeriods = {
  'TET': {
    dateRange: ['2026-01-20', '2026-02-10'],
    budgetMultiplier: 1.5,       // Tăng 50% budget
    minROI: 150                  // Chấp nhận ROI thấp hơn
  },
  'BLACK_FRIDAY': {
    dateRange: ['2026-11-20', '2026-11-30'],
    budgetMultiplier: 2.0,       // Tăng 100% budget
    minROI: 120
  },
  '11_11': {
    dateRange: ['2026-11-05', '2026-11-15'],
    budgetMultiplier: 1.8,
    minROI: 130
  }
};

// Trong dịp đặc biệt:
if (isSpecialPeriod) {
  newBudget = currentBudget × specialPeriod.budgetMultiplier;
  minAcceptableROI = specialPeriod.minROI;
}
```

---

### Rule C: Competitor Activity Detection (Phát Hiện Đối Thủ)

```typescript
// Nếu phát hiện đối thủ tăng giá mạnh
{
  cpcIncreaseRate > 30,          // CPC tăng > 30%
  impressionShareDecrease > 20,  // Impression share giảm > 20%
  
  // Có 2 lựa chọn:
  
  // Option 1: Tăng budget để cạnh tranh
  if (roi >= 200 && reinvestmentFundAvailable > 1_000_000) {
    newBudget = currentBudget × 1.3;  // Tăng 30%
  }
  
  // Option 2: Giảm budget tạm thời, chờ đối thủ hết tiền
  else {
    newBudget = currentBudget × 0.7;  // Giảm 30%
    waitPeriod = 3; // days
  }
}
```

---

### Rule D: Budget Reallocation (Phân Bổ Lại Ngân Sách)

```typescript
// Mỗi ngày, lấy budget từ ad groups kém → chuyển sang ad groups tốt

// Bước 1: Lấy lại budget từ ad groups kém
const poorPerformers = adGroups.filter(ag => 
  ag.roi < 100 && ag.profitMargin < 10
);

const reclaimedBudget = poorPerformers.reduce((sum, ag) => 
  sum + (ag.currentBudget × 0.5), // Lấy lại 50% budget
  0
);

// Bước 2: Phân bổ lại cho ad groups tốt
const topPerformers = adGroups
  .filter(ag => ag.roi >= 200 && ag.profitMargin >= 20)
  .sort((a, b) => b.roi - a.roi)
  .slice(0, 5);  // Top 5

const additionalBudgetPerAd = reclaimedBudget / topPerformers.length;

topPerformers.forEach(ag => {
  ag.newBudget = ag.currentBudget + additionalBudgetPerAd;
});
```

---

## 🤖 IMPLEMENTATION - Code Structure

### 1. Data Collection (Thu Thập Dữ Liệu)

```typescript
// File: backend/src/finance/ad-group-daily-report.service.ts

interface AdGroupMetrics {
  adGroupId: string;
  date: Date;
  
  // Cost metrics
  adsCost: number;
  
  // Revenue & Profit
  totalRevenue: number;
  netProfit: number;
  
  // Performance
  roi: number;                    // (netProfit / adsCost) * 100
  roas: number;                   // totalRevenue / adsCost
  profitMargin: number;           // (netProfit / totalRevenue) * 100
  
  // Volume
  totalOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  
  // Quality
  successRate: number;            // deliveredOrders / totalOrders
  returnRate: number;             // returnedOrders / totalOrders
  
  // Cost efficiency
  cpa: number;                    // adsCost / totalOrders
  aov: number;                    // totalRevenue / totalOrders
}

async getAdGroupMetrics(
  adGroupId: string, 
  days: number = 7
): Promise<AdGroupMetrics[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  
  // Query từ AdGroupDailyReport collection
  const metrics = await this.adGroupDailyReportModel.find({
    adGroupId,
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
  
  return metrics;
}
```

---

### 2. Decision Engine (Ra Quyết Định)

```typescript
// File: backend/src/finance/auto-scale-decision.service.ts

@Injectable()
export class AutoScaleDecisionService {
  
  /**
   * Quyết định scale/kill cho một ad group
   */
  async makeDecision(adGroupId: string): Promise<ScaleDecision> {
    // 1. Lấy metrics 7 ngày
    const metrics = await this.getAdGroupMetrics(adGroupId, 7);
    
    // 2. Tính aggregate metrics
    const aggregated = this.aggregateMetrics(metrics);
    
    // 3. Check reinvestment fund available
    const reinvestmentFund = await this.getReinvestmentFundAvailable();
    
    // 4. Áp dụng rules
    const decision = this.applyRules(aggregated, reinvestmentFund);
    
    return decision;
  }
  
  /**
   * Áp dụng rules
   */
  private applyRules(
    metrics: AggregatedMetrics, 
    fundAvailable: number
  ): ScaleDecision {
    
    // RULE 5: KILL - Highest priority
    if (this.shouldKill(metrics)) {
      return {
        action: 'KILL',
        newBudget: 0,
        reason: 'Poor performance - auto killed',
        confidence: 95,
        metrics
      };
    }
    
    // RULE 4: SCALE DOWN
    if (this.shouldScaleDown(metrics)) {
      return {
        action: 'SCALE_DOWN',
        newBudget: metrics.currentBudget * 0.75,
        reason: 'Below target ROI - reducing budget',
        confidence: 85,
        metrics
      };
    }
    
    // RULE 3: MAINTAIN
    if (this.shouldMaintain(metrics)) {
      return {
        action: 'MAINTAIN',
        newBudget: metrics.currentBudget,
        reason: 'Performance acceptable - maintaining',
        confidence: 70,
        metrics
      };
    }
    
    // RULE 1: SCALE UP AGGRESSIVE
    if (this.shouldScaleUpAggressive(metrics) && fundAvailable > 1_000_000) {
      const scaleRate = metrics.roi >= 400 ? 0.30 :
                       metrics.roi >= 300 ? 0.25 : 0.20;
      
      return {
        action: 'SCALE_UP_AGGRESSIVE',
        newBudget: Math.min(
          metrics.currentBudget * (1 + scaleRate),
          10_000_000  // Max daily budget
        ),
        reason: `Excellent ROI ${metrics.roi.toFixed(0)}% - scaling up ${(scaleRate * 100).toFixed(0)}%`,
        confidence: 90,
        metrics
      };
    }
    
    // RULE 2: SCALE UP MODERATE
    if (this.shouldScaleUpModerate(metrics) && fundAvailable > 500_000) {
      return {
        action: 'SCALE_UP_MODERATE',
        newBudget: metrics.currentBudget * 1.15,
        reason: `Good ROI ${metrics.roi.toFixed(0)}% - moderate scale`,
        confidence: 80,
        metrics
      };
    }
    
    // Default: MAINTAIN
    return {
      action: 'MAINTAIN',
      newBudget: metrics.currentBudget,
      reason: 'No clear signal - maintaining current budget',
      confidence: 60,
      metrics
    };
  }
  
  /**
   * Check if should KILL
   */
  private shouldKill(m: AggregatedMetrics): boolean {
    return (
      m.roi < 50 ||
      m.profitMargin < 5 ||
      m.successRate < 50 ||
      m.consecutiveLossDays >= 3 ||
      (m.riskLevel === 'HIGH' && m.predictionAccuracy < 50) ||
      m.returnRate > 30
    );
  }
  
  /**
   * Check if should SCALE DOWN
   */
  private shouldScaleDown(m: AggregatedMetrics): boolean {
    return (
      (m.roi >= 50 && m.roi < 100) ||
      (m.profitMargin >= 5 && m.profitMargin < 10) ||
      (m.successRate >= 50 && m.successRate < 60) ||
      m.riskLevel === 'HIGH'
    );
  }
  
  /**
   * Check if should MAINTAIN
   */
  private shouldMaintain(m: AggregatedMetrics): boolean {
    return (
      (m.roi >= 100 && m.roi < 150) &&
      (m.profitMargin >= 10 && m.profitMargin < 15) &&
      m.successRate >= 60
    );
  }
  
  /**
   * Check if should SCALE UP MODERATE
   */
  private shouldScaleUpModerate(m: AggregatedMetrics): boolean {
    return (
      (m.roi >= 150 && m.roi < 250) &&
      (m.profitMargin >= 15 && m.profitMargin < 20) &&
      m.successRate >= 70 &&
      m.totalOrders_7days >= 5 &&
      (m.riskLevel === 'LOW' || m.riskLevel === 'MEDIUM')
    );
  }
  
  /**
   * Check if should SCALE UP AGGRESSIVE
   */
  private shouldScaleUpAggressive(m: AggregatedMetrics): boolean {
    return (
      m.roi >= 250 &&
      m.profitMargin >= 20 &&
      m.successRate >= 80 &&
      m.totalOrders_7days >= 10 &&
      m.riskLevel === 'LOW' &&
      m.profitTrend === 'INCREASING'
    );
  }
}
```

---

### 3. Execution (Thực Thi)

```typescript
// File: backend/src/finance/auto-scale-execution.service.ts

@Injectable()
export class AutoScaleExecutionService {
  
  /**
   * Cronjob chạy mỗi ngày 02:00 AM
   */
  @Cron('0 2 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyAutoScale() {
    this.logger.log('🚀 Starting daily auto scale/kill process...');
    
    try {
      // 1. Lấy reinvestment fund từ Capital Allocation
      const capitalAllocation = await this.capitalAllocationService.computeAllocation();
      const reinvestmentFund = capitalAllocation.reinvestmentAmount;
      
      this.logger.log(`💰 Reinvestment fund available: ${reinvestmentFund.toLocaleString()} VND`);
      
      // 2. Lấy tất cả active ad groups
      const adGroups = await this.adGroupModel.find({ 
        isActive: true 
      });
      
      this.logger.log(`📊 Processing ${adGroups.length} ad groups`);
      
      let scaled = 0;
      let killed = 0;
      let maintained = 0;
      
      // 3. Process từng ad group
      for (const adGroup of adGroups) {
        try {
          // Make decision
          const decision = await this.autoScaleDecisionService.makeDecision(
            adGroup.adGroupId
          );
          
          this.logger.log(`Ad Group ${adGroup.adGroupId}: ${decision.action} - ${decision.reason}`);
          
          // Execute decision
          switch (decision.action) {
            case 'KILL':
              await this.killAdGroup(adGroup, decision);
              killed++;
              break;
            
            case 'SCALE_DOWN':
              await this.scaleDownAdGroup(adGroup, decision);
              scaled++;
              break;
            
            case 'SCALE_UP_MODERATE':
            case 'SCALE_UP_AGGRESSIVE':
              await this.scaleUpAdGroup(adGroup, decision);
              scaled++;
              break;
            
            case 'MAINTAIN':
              maintained++;
              break;
          }
          
          // Log decision to database
          await this.logDecision(adGroup, decision);
          
        } catch (error) {
          this.logger.error(`Failed to process ${adGroup.adGroupId}:`, error);
        }
      }
      
      this.logger.log(`✅ Auto scale completed: Scaled=${scaled}, Killed=${killed}, Maintained=${maintained}`);
      
      // Send daily report
      await this.sendDailyReport({ scaled, killed, maintained });
      
    } catch (error) {
      this.logger.error('Auto scale process failed:', error);
    }
  }
  
  /**
   * Kill ad group
   */
  private async killAdGroup(
    adGroup: AdGroupDocument, 
    decision: ScaleDecision
  ) {
    // 1. Update database
    await this.adGroupModel.updateOne(
      { _id: adGroup._id },
      {
        $set: {
          isActive: false,
          budget: 0,
          pausedAt: new Date(),
          pauseReason: decision.reason,
          autoKilled: true
        }
      }
    );
    
    // 2. Pause on platform (Facebook/Google/TikTok)
    await this.budgetApplyService.pauseAdGroup(adGroup);
    
    // 3. Send critical alert
    await this.alertService.sendCritical({
      type: 'AD_GROUP_KILLED',
      adGroupId: adGroup.adGroupId,
      reason: decision.reason,
      metrics: decision.metrics
    });
  }
  
  /**
   * Scale up ad group
   */
  private async scaleUpAdGroup(
    adGroup: AdGroupDocument,
    decision: ScaleDecision
  ) {
    // 1. Update database
    await this.adGroupModel.updateOne(
      { _id: adGroup._id },
      {
        $set: {
          budget: decision.newBudget,
          lastScaledAt: new Date(),
          scaleAction: decision.action
        }
      }
    );
    
    // 2. Apply to platform
    await this.budgetApplyService.updateAdGroupBudget(
      adGroup,
      decision.newBudget
    );
    
    // 3. Log success
    this.logger.log(`✅ Scaled up ${adGroup.adGroupId}: ${adGroup.budget} → ${decision.newBudget}`);
  }
  
  /**
   * Scale down ad group
   */
  private async scaleDownAdGroup(
    adGroup: AdGroupDocument,
    decision: ScaleDecision
  ) {
    // Similar to scaleUpAdGroup
    await this.adGroupModel.updateOne(
      { _id: adGroup._id },
      {
        $set: {
          budget: decision.newBudget,
          lastScaledAt: new Date(),
          scaleAction: decision.action
        }
      }
    );
    
    await this.budgetApplyService.updateAdGroupBudget(
      adGroup,
      decision.newBudget
    );
  }
}
```

---

## 📈 Monitoring & Alerts

### Dashboard Metrics

```typescript
// Real-time monitoring dashboard
interface AutoScaleDashboard {
  // Summary
  totalAdGroups: number;
  activeAdGroups: number;
  pausedAdGroups: number;
  
  // Budget allocation
  totalBudgetAllocated: number;
  reinvestmentFundUsed: number;
  reinvestmentFundAvailable: number;
  
  // Performance
  avgROI: number;
  avgProfitMargin: number;
  avgSuccessRate: number;
  
  // Actions taken today
  scaledUp: number;
  scaledDown: number;
  killed: number;
  maintained: number;
  
  // Risk
  highRiskAdGroups: number;
  mediumRiskAdGroups: number;
  lowRiskAdGroups: number;
  
  // Top performers
  topPerformers: AdGroupMetrics[];  // Top 10 by ROI
  poorPerformers: AdGroupMetrics[]; // Bottom 10 by ROI
}
```

### Alert System

```typescript
// Critical alerts
const alertRules = {
  // Budget depletion
  reinvestmentFundLow: {
    condition: reinvestmentFund < 1_000_000,
    severity: 'HIGH',
    message: 'Reinvestment fund < 1M VND - cần bổ sung vốn'
  },
  
  // Mass killings
  massKilling: {
    condition: killedToday > 5,
    severity: 'CRITICAL',
    message: `${killedToday} ad groups killed today - check system`
  },
  
  // Performance drop
  avgROIDropping: {
    condition: avgROI_today < avgROI_yesterday * 0.8,
    severity: 'MEDIUM',
    message: 'Average ROI dropped 20% - investigate'
  }
};
```

---

## 🎓 Best Practices

### 1. Gradual Changes
```typescript
// Không thay đổi budget quá đột ngột
maxDailyChange = currentBudget * 0.30;  // Max ±30%/ngày
```

### 2. Testing Period
```typescript
// Ad groups mới cần 7 ngày testing trước khi scale mạnh
if (adGroupAge < 7) {
  maxBudget = 1_000_000;  // Giới hạn 1M/ngày
}
```

### 3. Human Override
```typescript
// Cho phép manual override
if (adGroup.manualOverride) {
  skipAutoScaling = true;
}
```

### 4. Budget Caps
```typescript
// Giới hạn tổng budget
const budgetCaps = {
  dailyPerAdGroup: 10_000_000,     // Max 10M/ad group/ngày
  dailyTotal: 50_000_000,          // Max 50M tổng/ngày
  weeklyTotal: 300_000_000         // Max 300M/tuần
};
```

---

## � CASHFLOW SURVIVAL RULES - Rules Sống Còn

> **⚠️ CRITICAL WARNING:**  
> Đây là phần **QUAN TRỌNG NHẤT** - thiếu phần này dẫn đến **PHÁ SẢN** dù ROI cao!  
> **"Lợi nhuận trên giấy ≠ Tiền mặt trong tay"**

### ⚡ Vấn Đề "Chết Tiền Trước Khi Thấy Lãi"

**Case Study Thực Tế:**
```
📊 Trên Giấy (Accrual Accounting):
├─ Ads cost: 100M/ngày × 14 ngày = 1,400M
├─ Doanh thu (giấy): 200M/ngày × 14 ngày = 2,800M
├─ Lợi nhuận (giấy): 700M (25% margin)
└─ ROI: 50% → TUYỆT VỜI! 🎉

💰 Thực Tế Dòng Tiền (Cash Flow):
├─ Tiền ads phải trả: 1,400M (NGAY)
├─ Tiền đại lý thu về: 0đ (Chưa về - trả sau 14 ngày)
├─ Return rate: 25% → Mất thêm 350M
└─ Cash balance: -1,400M → 💀 PHÁ SẢN

👉 Dù ROI 50%, bạn chết vì hết tiền TRƯỚC KHI thấy lãi!
```

**Root Causes:**
1. **Timing Mismatch**: Ads cost trả trước, revenue thu sau
2. **Return/Refund**: 25-35% đơn hoàn → mất thêm tiền
3. **Agent Payment Terms**: Đại lý trả sau 7-15 ngày
4. **Supplier Payment**: Nhà cung cấp đòi tiền ngay

---

### Rule F: Return Protection (Bảo Vệ Khỏi Hoàn Hàng)

**📊 Return Rate Metrics:**
```typescript
returnRate = (returnedOrders / totalOrders) × 100%

Nguy hiểm khi:
- returnRate > 25%: Mất 1/4 doanh thu
- returnRate > 35%: Catastrophic - mất 1/3 doanh thu
```

**🛡️ Protection Rules:**

#### Level 1: Return Rate > 25%
```typescript
if (returnRate > 25%) {
  return {
    action: 'SCALE_PROTECTION_LEVEL_1',
    decisions: [
      'Tắt SCALE UP cho tất cả ad groups',
      'Kill threshold tăng gấp đôi: ROI < 100% → KILL (thay vì < 50%)',
      'Ưu tiên optimize chất lượng thay vì scale volume',
      'Enable stricter quality control',
      'Freeze budget cho ad groups có return rate > 30%'
    ],
    reason: `Return rate ${returnRate.toFixed(1)}% quá cao - risk cao`,
    confidence: 95
  };
}
```

**Impact:**
- ✅ Chỉ MAINTAIN hoặc SCALE DOWN
- ✅ Kill aggressive hơn
- ✅ Focus vào chất lượng > số lượng

#### Level 2: Return Rate > 35%
```typescript
if (returnRate > 35%) {
  // 🚨 EMERGENCY MODE
  const topPerformer = adGroups
    .filter(ag => ag.returnRate < 20% && ag.roi > 150%)
    .sort((a, b) => b.netProfit - a.netProfit)[0];

  return {
    action: 'EMERGENCY_RETURN_PROTECTION',
    decisions: [
      'KILL tất cả ad groups NGOẠI TRỪ top performer',
      `Chỉ giữ: ${topPerformer.name} (ROI ${topPerformer.roi}%, Return ${topPerformer.returnRate}%)`,
      'Tạm dừng mở ad groups mới',
      'Review toàn bộ product quality & targeting'
    ],
    reason: `Return rate ${returnRate.toFixed(1)}% - CATASTROPHIC LEVEL`,
    confidence: 99,
    alert: 'URGENT: Manual review required immediately!'
  };
}
```

---

### Rule G: Receivable Control (Kiểm Soát Công Nợ Đại Lý)

**📈 DSO (Days Sales Outstanding):**
```typescript
DSO = (Total Accounts Receivable / Total Credit Sales) × Number of Days

Mục tiêu: DSO ≤ 7 ngày
Nguy hiểm: DSO > 10 ngày
Khẩn cấp: DSO > 15 ngày
```

**KPI Sống Còn: DSO ≤ 7 ngày**

#### Level 1: DSO > 10 ngày
```typescript
async checkDSO(): Promise<DSORiskLevel> {
  const receivables = await this.agentStatementModel.find({
    status: { $in: ['pending', 'partial'] }
  });

  const totalReceivable = receivables.reduce((sum, r) => sum + r.amount, 0);
  const avgDailySales = await this.getAvgDailySales(30); // 30 days
  const DSO = totalReceivable / avgDailySales;

  if (DSO > 10 && DSO <= 15) {
    return {
      level: 'WARNING',
      DSO,
      action: 'REDUCE_BUDGET',
      reductionRate: DSO > 12 ? 0.50 : 0.30,  // 50% or 30%
      reason: `DSO ${DSO.toFixed(1)} ngày - Tiền đại lý chậm về`,
      recommendations: [
        'Giảm 30-50% tổng ngân sách ads',
        'Tạm dừng scale up',
        'Đôn đốc đại lý thanh toán',
        'Review payment terms'
      ]
    };
  }

  return { level: 'SAFE', DSO };
}
```

**Actions:**
```typescript
if (DSO > 10) {
  const reductionRate = DSO > 12 ? 0.50 : 0.30;
  
  for (const adGroup of allAdGroups) {
    const newBudget = adGroup.currentBudget * (1 - reductionRate);
    await this.scaleDownAdGroup(adGroup.id, newBudget, 
      `DSO ${DSO.toFixed(1)} days - Cashflow protection`
    );
  }
}
```

#### Level 2: DSO > 15 ngày
```typescript
if (DSO > 15) {
  return {
    level: 'CRITICAL',
    DSO,
    action: 'STOP_ALL_SCALING',
    reason: `DSO ${DSO.toFixed(1)} ngày - CRITICAL: Tiền không về kịp`,
    decisions: [
      '🚨 STOP toàn bộ SCALE UP trong hệ thống',
      'CHỈ cho phép MAINTAIN hoặc SCALE DOWN',
      'Freeze mở ad groups mới',
      'Focus 100% vào thu hồi công nợ',
      'Review & tighten credit policies'
    ],
    alert: 'URGENT: Cashflow crisis - manual intervention required!'
  };
}
```

---

### Rule H: Payable Control (Kiểm Soát Công Nợ NCC)

**📉 DPO (Days Payable Outstanding):**
```typescript
DPO = (Total Accounts Payable / Cost of Goods Sold) × Number of Days

Mục tiêu: DPO ≥ DSO (Trả tiền sau hoặc bằng khi thu tiền)
Lý tưởng: DPO > DSO + 3 days (buffer)
```

**⚠️ Nguy Cơ: DPO < DSO**

```typescript
async checkCashflowRisk(): Promise<CashflowRiskLevel> {
  const DSO = await this.calculateDSO();
  const DPO = await this.calculateDPO();
  
  const gap = DSO - DPO;  // Positive = Nguy hiểm

  if (gap > 0) {
    // DSO > DPO = Thu tiền sau nhưng phải trả tiền trước
    return {
      level: 'CASHFLOW_RISK',
      DSO,
      DPO,
      gap,
      reason: `DPO ${DPO.toFixed(1)} < DSO ${DSO.toFixed(1)} → Cashflow gap ${gap.toFixed(1)} days`,
      impact: {
        dailyCashGap: gap * avgDailyRevenue,
        totalCashNeeded: gap * avgDailyRevenue,
        description: `Cần ${(gap * avgDailyRevenue / 1_000_000).toFixed(1)}M working capital để cover gap`
      },
      actions: [
        'Kích hoạt CASHFLOW RISK MODE',
        'Giảm 20% tổng budget',
        'Negotiate longer payment terms với suppliers',
        'Negotiate shorter collection từ agents',
        'Prepare emergency credit line'
      ]
    };
  }

  return { level: 'SAFE', DSO, DPO, gap };
}
```

**CASHFLOW RISK MODE:**
```typescript
if (DPO < DSO) {
  // Emergency cashflow management
  return {
    mode: 'CASHFLOW_RISK',
    restrictions: [
      'Giảm 20% tổng ngân sách ads',
      'Tạm dừng SCALE UP aggressive',
      'Only scale moderate nếu ROI > 200%',
      'Prioritize ad groups với fast collection (COD)',
      'Increase reserve fund from 25% → 35%'
    ],
    focus: 'Optimize cashflow velocity > profit maximization'
  };
}
```

---

### Rule I: Cashflow Safety Index (CSI)

**💰 CSI Formula:**
```typescript
CSI = Available Cash / (Avg Daily Ads Cost × Collection Days)

Trong đó:
- Available Cash: Tiền mặt + credit line available
- Avg Daily Ads Cost: Chi phí ads trung bình/ngày
- Collection Days: Số ngày trung bình thu tiền (DSO)
```

**📊 CSI Thresholds:**

| CSI Value | Status | Action | Description |
|-----------|--------|--------|-------------|
| **> 1.5** | ✅ AN TOÀN | Full operations | Đủ tiền cho 1.5× collection cycle |
| **1.0 - 1.5** | ⚠️ CẢNH BÁO | Moderate caution | Giảm 20% new spend, monitor daily |
| **0.7 - 1.0** | 🚨 NGUY HIỂM | Stop scaling | STOP SCALE, maintain only |
| **< 0.7** | 💀 CRITICAL | Emergency mode | Giảm 50% toàn hệ thống |

**Implementation:**
```typescript
async calculateCSI(): Promise<CSIResult> {
  // 1. Get available cash
  const cashAccounts = await this.fundingSourceModel.find({ 
    type: 'bank_account' 
  });
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.balance, 0);
  
  const creditLines = await this.loanContractModel.find({
    status: 'active',
    type: 'credit_line'
  });
  const availableCredit = creditLines.reduce(
    (sum, l) => sum + (l.amount - l.usedAmount), 
    0
  );
  
  const availableCash = totalCash + availableCredit;

  // 2. Get avg daily ads cost (30 days)
  const last30Days = await this.adGroupDailyReportModel.aggregate([
    {
      $match: {
        date: { 
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
        }
      }
    },
    {
      $group: {
        _id: null,
        totalAdsCost: { $sum: '$adsCost' },
        days: { $sum: 1 }
      }
    }
  ]);

  const avgDailyAdsCost = last30Days[0].totalAdsCost / last30Days[0].days;

  // 3. Get collection days (DSO)
  const DSO = await this.calculateDSO();

  // 4. Calculate CSI
  const CSI = availableCash / (avgDailyAdsCost * DSO);

  return {
    CSI,
    availableCash,
    avgDailyAdsCost,
    collectionDays: DSO,
    status: this.getCSIStatus(CSI),
    daysUntilCashout: CSI * DSO,  // Số ngày có thể hoạt động
    recommendation: this.getCSIRecommendation(CSI)
  };
}

private getCSIStatus(CSI: number): CSIStatus {
  if (CSI > 1.5) return { level: 'SAFE', color: 'green' };
  if (CSI >= 1.0) return { level: 'WARNING', color: 'yellow' };
  if (CSI >= 0.7) return { level: 'DANGER', color: 'orange' };
  return { level: 'CRITICAL', color: 'red' };
}

private getCSIRecommendation(CSI: number): CSIAction {
  if (CSI > 1.5) {
    return {
      action: 'FULL_OPERATIONS',
      scaleAllowed: true,
      message: 'Cashflow healthy - can scale aggressively'
    };
  }
  
  if (CSI >= 1.0) {
    return {
      action: 'MODERATE_CAUTION',
      budgetReduction: 0.20,  // Giảm 20%
      scaleAllowed: false,
      message: 'CSI cảnh báo - giảm 20% new spend, monitor daily'
    };
  }
  
  if (CSI >= 0.7) {
    return {
      action: 'STOP_SCALING',
      budgetReduction: 0,
      scaleAllowed: false,
      message: 'CSI nguy hiểm - STOP SCALE, maintain current only'
    };
  }
  
  // CSI < 0.7
  return {
    action: 'EMERGENCY_REDUCTION',
    budgetReduction: 0.50,  // Giảm 50%
    scaleAllowed: false,
    killLowPerformers: true,
    message: 'CSI critical - giảm 50% toàn hệ thống, kill ad groups ROI < 150%'
  };
}
```

---

### Rule J: Auto Budget Reduction theo CSI

**Workflow:**
```typescript
async enforceCSILimits(): Promise<void> {
  const csiResult = await this.calculateCSI();
  
  this.logger.warn(`
    ╔════════════════════════════════════════╗
    ║   CASHFLOW SAFETY INDEX (CSI)          ║
    ╠════════════════════════════════════════╣
    ║ CSI: ${csiResult.CSI.toFixed(2)}                            ║
    ║ Status: ${csiResult.status.level.padEnd(20)} ║
    ║ Available Cash: ${(csiResult.availableCash / 1_000_000).toFixed(1)}M        ║
    ║ Daily Ads Cost: ${(csiResult.avgDailyAdsCost / 1_000_000).toFixed(1)}M        ║
    ║ Days Until Cashout: ${csiResult.daysUntilCashout.toFixed(1)}       ║
    ╚════════════════════════════════════════╝
  `);

  const action = csiResult.recommendation;

  if (action.action === 'EMERGENCY_REDUCTION') {
    // CSI < 0.7 → Giảm 50%
    await this.emergencyBudgetReduction(0.50);
    
    // Kill low performers
    if (action.killLowPerformers) {
      await this.killAdGroupsBelow(150);  // ROI < 150%
    }
    
    this.logger.error(`🚨 EMERGENCY: CSI ${csiResult.CSI.toFixed(2)} - Reduced 50% system budget`);
  }
  
  if (action.action === 'STOP_SCALING') {
    // CSI 0.7-1.0 → Stop scale
    await this.setSystemScalingMode('DISABLED');
    this.logger.warn(`⚠️ WARNING: CSI ${csiResult.CSI.toFixed(2)} - Scaling DISABLED`);
  }
  
  if (action.action === 'MODERATE_CAUTION' && action.budgetReduction) {
    // CSI 1.0-1.5 → Giảm 20%
    await this.reduceNewSpend(action.budgetReduction);
    this.logger.warn(`⚠️ CAUTION: CSI ${csiResult.CSI.toFixed(2)} - Reduced 20% new spend`);
  }
}

private async emergencyBudgetReduction(rate: number): Promise<void> {
  const allAdGroups = await this.adGroupModel.find({ isActive: true });
  
  for (const adGroup of allAdGroups) {
    const newBudget = adGroup.dailyBudget * (1 - rate);
    
    await this.budgetApplyService.applyBudgetToProvider({
      adGroupId: adGroup.adGroupId,
      budget: newBudget,
      platform: adGroup.platform,
      reason: `CSI Emergency Reduction -${(rate * 100).toFixed(0)}%`
    });
    
    await this.adGroupModel.updateOne(
      { _id: adGroup._id },
      { 
        $set: { 
          dailyBudget: newBudget,
          lastAutoControlAt: new Date(),
          autoPausedReason: `CSI < 0.7 - Emergency cashflow protection`
        } 
      }
    );
  }
  
  this.logger.error(`🚨 Emergency: Reduced ${allAdGroups.length} ad groups by ${(rate * 100)}%`);
}

private async killAdGroupsBelow(minROI: number): Promise<void> {
  const lowPerformers = await this.adGroupDailyReportService.getAdGroupsWithROIBelow(minROI);
  
  for (const adGroup of lowPerformers) {
    await this.killAdGroup(adGroup.adGroupId, 
      `CSI Emergency: ROI ${adGroup.roi.toFixed(0)}% < ${minROI}%`
    );
  }
  
  this.logger.error(`🚨 Killed ${lowPerformers.length} ad groups with ROI < ${minROI}%`);
}
```

---

### 📊 Cashflow Dashboard Metrics

**Real-time Monitoring:**
```typescript
interface CashflowHealthDashboard {
  // Core Metrics
  CSI: number;                    // Cashflow Safety Index
  DSO: number;                    // Days Sales Outstanding
  DPO: number;                    // Days Payable Outstanding
  returnRate: number;             // Return rate %
  
  // Cash Position
  availableCash: number;          // Total available cash
  daysUntilCashout: number;       // Days can operate
  dailyCashBurn: number;          // Avg daily ads cost
  
  // Warnings
  cashflowRiskLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
  activeWarnings: string[];
  
  // Actions Taken
  lastCSICheck: Date;
  autoActionsToday: {
    budgetReductions: number;
    adGroupsKilled: number;
    scalingDisabled: boolean;
  };
  
  // Projections
  projectedCashIn7Days: number;   // Expected cash in 7 days
  projectedCashOut7Days: number;  // Expected cash out 7 days
  netCashFlow7Days: number;       // Net position
}
```

**Alert Thresholds:**
```typescript
const CASHFLOW_ALERTS = {
  CSI_CRITICAL: 0.7,
  CSI_DANGER: 1.0,
  CSI_WARNING: 1.5,
  
  DSO_WARNING: 10,
  DSO_CRITICAL: 15,
  
  RETURN_RATE_WARNING: 25,
  RETURN_RATE_CRITICAL: 35,
  
  DPO_GAP_WARNING: 3,   // DPO < DSO - 3
  DPO_GAP_CRITICAL: 0   // DPO < DSO
};
```

---

### 🔄 Integration vào Auto Scale Decision

**Priority Order:**
```
1. Check CSI → STOP ALL nếu CSI < 0.7
2. Check DSO → STOP SCALE nếu DSO > 15
3. Check Return Rate → STOP SCALE nếu > 35%
4. Check DPO vs DSO → RISK MODE nếu DPO < DSO
5. Apply standard ROI-based rules
```

**Modified Decision Flow:**
```typescript
async makeDecisionWithCashflowProtection(
  adGroupId: string
): Promise<ScaleDecision> {
  
  // STEP 0: Cashflow Safety Checks (HIGHEST PRIORITY)
  const csiResult = await this.cashflowSafetyService.calculateCSI();
  
  if (csiResult.CSI < 0.7) {
    return {
      action: 'SCALE_DOWN',
      newBudget: currentBudget * 0.50,
      reason: `CSI ${csiResult.CSI.toFixed(2)} CRITICAL - Emergency 50% reduction`,
      confidence: 99,
      cashflowProtection: true,
      alert: '🚨 CASHFLOW EMERGENCY'
    };
  }
  
  if (csiResult.CSI < 1.0) {
    return {
      action: 'MAINTAIN',
      newBudget: currentBudget,
      reason: `CSI ${csiResult.CSI.toFixed(2)} - Scaling DISABLED`,
      confidence: 95,
      cashflowProtection: true
    };
  }
  
  // STEP 1: DSO Check
  const dsoResult = await this.cashflowSafetyService.checkDSO();
  if (dsoResult.level === 'CRITICAL') {
    return {
      action: 'MAINTAIN',
      newBudget: currentBudget,
      reason: `DSO ${dsoResult.DSO.toFixed(1)} days > 15 - STOP SCALE`,
      confidence: 95,
      cashflowProtection: true
    };
  }
  
  // STEP 2: Return Rate Check
  const returnRate = await this.getAdGroupReturnRate(adGroupId);
  if (returnRate > 35) {
    return {
      action: 'KILL',
      newBudget: 0,
      reason: `Return rate ${returnRate.toFixed(1)}% > 35% - EMERGENCY KILL`,
      confidence: 99,
      cashflowProtection: true
    };
  }
  
  if (returnRate > 25) {
    // Double kill threshold
    const decision = await this.makeStandardDecision(adGroupId);
    if (decision.metrics.roi < 100) {  // Instead of < 50
      return {
        action: 'KILL',
        newBudget: 0,
        reason: `Return rate ${returnRate.toFixed(1)}% > 25% + ROI ${decision.metrics.roi.toFixed(0)}% < 100%`,
        confidence: 90,
        cashflowProtection: true
      };
    }
    // Block scale up
    if (decision.action.includes('SCALE_UP')) {
      decision.action = 'MAINTAIN';
      decision.reason = `Return rate ${returnRate.toFixed(1)}% > 25% - SCALE BLOCKED`;
    }
    return decision;
  }
  
  // STEP 3: DPO vs DSO Check
  const cashflowRisk = await this.cashflowSafetyService.checkCashflowRisk();
  if (cashflowRisk.level === 'CASHFLOW_RISK') {
    const decision = await this.makeStandardDecision(adGroupId);
    // Cap scale up to moderate only
    if (decision.action === 'SCALE_UP_AGGRESSIVE') {
      decision.action = 'SCALE_UP_MODERATE';
      decision.newBudget = currentBudget * 1.10;  // Max +10%
      decision.reason = `${decision.reason} (Capped by cashflow risk: DPO < DSO)`;
    }
    return decision;
  }
  
  // STEP 4: Standard Decision (if all cashflow checks pass)
  return this.makeStandardDecision(adGroupId);
}
```

---

## 📚 Tham Khảo

- [CASH-FLOW-VS-ACCRUAL-ACCOUNTING.md](./CASH-FLOW-VS-ACCRUAL-ACCOUNTING.md) - Quản lý cash flow
- [BUDGET-ALLOCATION-GUIDE.md](./BUDGET-ALLOCATION-GUIDE.md) - Hướng dẫn phân bổ ngân sách
- [finance-insights.md](./finance-insights.md) - Phân tích tài chính

---

**Tác giả:** Auto Scale Engine  
**Ngày tạo:** 2026-01-26  
**Ngày cập nhật:** 2026-01-26  
**Version:** 2.0 - Added Cashflow Survival Rules
