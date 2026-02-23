# 🚧 TODO: REBUILD MODULES FROM ORDERTEST2

> Created: 25/01/2026
> Status: In Progress

---

## ✅ COMPLETED

### Cleanup
- [x] Removed Summary4, Summary5 modules
- [x] Removed ad-group-profit, ad-group-profit-report, product-profit-report
- [x] Updated app.module.ts
- [x] Updated frontend routes
- [x] Commented out dependencies

---

## 🔧 MODULES NEED REFACTORING

### 1. **FinanceModule - BudgetAllocationService** ⚠️
**File:** `backend/src/finance/budget-allocation.service.ts`

**Lines to fix:**
- Line 72: `this.adGroupProfitService.getOptimalSpendSuggestions()`
- Line 210: `this.adGroupProfitService.getOptimalSpendSuggestions()`

**Solution:** Create new method in TestOrder2Service to get optimal spend suggestions

```typescript
// New method needed in TestOrder2Service
async getOptimalSpendSuggestions(params: {
  fromDate?: string;
  toDate?: string;
  minOrders?: number;
  targetRoi?: number;
}): Promise<OptimalSpendSuggestion[]> {
  // Aggregate from TestOrder2
  // Calculate ROI per adGroupId
  // Return suggestions
}
```

---

### 2. **AIOptimizationService** ⚠️
**File:** `backend/src/advertising-optimization/ai-optimization/ai-optimization.service.ts`

**Lines to fix:**
- Line 29: Constructor parameter `AdGroupProfitService`
- Line 212: `this.adGroupProfitService.getAdGroupProfitReport(...)`

**Solution:** Query directly from TestOrder2

```typescript
// Replace with:
const profitData = await this.testOrder2Model.aggregate([
  {
    $match: {
      orderDate: { $gte: startDate, $lte: endDate },
      adGroupId: { $exists: true }
    }
  },
  {
    $group: {
      _id: '$adGroupId',
      totalRevenue: { $sum: '$codAmount' },
      totalAdCost: { $sum: '$advertisingCost' },
      totalProfit: { $sum: '$netProfit' },
      orders: { $sum: 1 }
    }
  }
]);
```

---

### 3. **QualityControlService** ⚠️
**File:** `backend/src/advertising-optimization/quality-control/quality-control.service.ts`

**Lines to fix:**
- Line 27: Constructor parameter `AdGroupProfitService`
- Line 258: `this.adGroupProfitService.getAdGroupProfitReport(...)`
- Line 312: `this.adGroupProfitService.getAdGroupProfitReport(...)`

**Solution:** Same as AIOptimizationService

---

### 4. **AdvancedAnalyticsService** ⚠️
**File:** `backend/src/advertising-optimization/advanced-analytics/advanced-analytics.service.ts`

**Lines to fix:**
- Line 30: Constructor parameter `AdGroupProfitService`
- Line 256: `this.adGroupProfitService.getAdGroupProfitReport(...)`

**Solution:** Same as AIOptimizationService

---

## 🎯 NEW MODULES TO BUILD

### 1. **Ad Group Profit Report (NEW)** 🔨
**Endpoint:** `GET /api/reports/ad-group-profit-daily`

**Features:**
- Query from TestOrder2 collection
- Group by adGroupId + orderDate
- Calculate: revenue, costs, profit, ROI
- Support date range filter
- Export to CSV/Excel

**Implementation:**
```typescript
@Controller('reports/ad-group-profit')
export class AdGroupProfitReportController {
  @Get('daily')
  async getDailyReport(@Query() filter: ProfitReportFilterDto) {
    // Aggregate from TestOrder2
    // Return matrix format: adGroups × dates
  }
  
  @Get('summary')
  async getSummary(@Query() filter: ProfitReportFilterDto) {
    // Total profit, revenue, cost by ad group
  }
}
```

---

### 2. **Product Profit Report (NEW)** 🔨
**Endpoint:** `GET /api/reports/product-profit-daily`

**Features:**
- Query from TestOrder2 collection
- Group by productId + orderDate
- Calculate: revenue, costs, profit, margin
- Support product filter
- Export to CSV/Excel

---

### 3. **ROI Analysis Report (NEW)** 🔨
**Endpoint:** `GET /api/reports/roi-analysis`

**Features:**
- Calculate ROI per ad group
- Compare with target ROI
- Recommend scale up/down
- Trend analysis

---

### 4. **Ad Spend Optimization (NEW)** 🔨
**Endpoint:** `GET /api/reports/ad-spend-optimization`

**Features:**
- Budget allocation suggestions
- Based on historical ROI
- Consider delivery quality
- Optimal spend calculation

---

## 📊 DATA AVAILABLE IN ORDERTEST2

```typescript
TestOrder2 Schema {
  // Basic info
  orderDate: Date,
  adGroupId: string,
  productId: ObjectId,
  quantity: number,
  
  // Revenue
  codAmount: number,
  agentQuote: number,
  
  // Costs
  supplierQuote: number,
  advertisingCost: number,
  laborCostAllocation: number,
  otherCostAllocation: number,
  shippingFee: number,
  returnFee: number,
  
  // Profit
  grossProfit: number,
  netProfit: number,
  
  // Status
  orderStatus: string,
  productionStatus: string
}
```

---

## 📝 IMPLEMENTATION STEPS

### Phase 1: Quick Fix (1-2 hours)
1. [x] Comment out all AdGroupProfit dependencies
2. [ ] Create stub methods that return empty arrays
3. [ ] Ensure backend compiles and runs
4. [ ] Test existing features still work

### Phase 2: Core Reports (1 day)
1. [ ] Create AdGroupProfitReportModule (new)
2. [ ] Create ProductProfitReportModule (new)
3. [ ] Query directly from TestOrder2
4. [ ] Add proper aggregation pipelines
5. [ ] Test with real data

### Phase 3: Advanced Features (2-3 days)
1. [ ] ROI Analysis
2. [ ] Ad Spend Optimization
3. [ ] ML predictions (optional)
4. [ ] Export features

### Phase 4: Integration (1 day)
1. [ ] Update FinanceModule
2. [ ] Update AIOptimizationService
3. [ ] Update QualityControlService
4. [ ] Remove all TODO comments
5. [ ] Full testing

---

## 🎨 FRONTEND COMPONENTS

### New Routes to Create:
```typescript
{
  path: 'reports',
  children: [
    { path: 'ad-group-profit', component: AdGroupProfitReportComponent },
    { path: 'product-profit', component: ProductProfitReportComponent },
    { path: 'roi-analysis', component: RoiAnalysisComponent },
    { path: 'ad-optimization', component: AdOptimizationComponent },
  ]
}
```

---

## 🚀 QUICK WIN STRATEGY

**Option 1: Stub Methods (Fast)**
- Return empty arrays for now
- System compiles and runs
- Add real implementation later

**Option 2: Core Implementation (Better)**
- Implement basic aggregation first
- Just ad-group-profit daily report
- Other features can wait

**Recommendation:** Start with Option 1, then gradually implement Option 2

---

**Next Action:** Run the stub implementation script below

