/**
 * PHÂN TÍCH CHI TIẾT 2 CHỨC NĂNG:
 * 1. Profit Forecast (http://localhost:4200/reports/profit-forecast)
 * 2. Advertising Cost Suggestion (http://localhost:4200/advertising-cost-suggestion)
 */

console.log(`
===================================================================
📊 CHỨC NĂNG 1: PROFIT FORECAST - DỰ KIẾN vs THỰC TẾ LỢI NHUẬN
===================================================================

🎯 TỔNG QUAN:
Route: /reports/profit-forecast
Mục đích: Phân tích và dự đoán lợi nhuận quảng cáo so với thực tế
Component: ProfitForecastComponent

📋 CÁCH LẤY DỮ LIỆU:

1. FRONTEND DATA FLOW:
   ├── profit-forecast.service.ts
   │   ├── getForecastWithCost() → /profit-forecast/ad-group-with-cost
   │   ├── getSummary() → /profit-forecast/summary  
   │   ├── getSnapshots() → /profit-forecast/snapshots
   │   └── runSnapshots() → /profit-forecast/snapshot/run
   │
   └── Component loads:
       ├── Forecast data (rows by date + adGroup)
       ├── Summary statistics (totals, ROAS, margins)
       └── Historical snapshots

2. BACKEND DATA PROCESSING:
   ├── profit-forecast.controller.ts
   │   ├── GET /ad-group-with-cost → forecastWithCost()
   │   ├── GET /summary → summaryAggregate()  
   │   ├── GET /snapshots → listSnapshots()
   │   └── GET /snapshot/run → runSnapshot()
   │
   └── profit-forecast.service.ts
       ├── Tính toán matured revenue/profit (dữ liệu thực)
       ├── Dự đoán projected revenue/profit
       ├── Tính blended metrics (thực + dự kiến)
       └── Tính ROAS, margins, confidence scores

📊 CÁC METRICS ĐƯỢC PHÂN TÍCH:

1. MATURED METRICS (Thực tế):
   • maturedRevenue: Doanh thu đã thực hiện
   • maturedProfit: Lợi nhuận đã thực hiện  
   • maturedROAS: Return on Ad Spend thực tế

2. PROJECTED METRICS (Dự kiến):
   • projectedRevenue: Doanh thu dự kiến
   • projectedProfit: Lợi nhuận dự kiến
   • confidence: Độ tin cậy của dự đoán (0-1)
   • calibrationError: Sai số hiệu chuẩn

3. BLENDED METRICS (Kết hợp):
   • blendedRevenue: maturedRevenue + projectedRevenue
   • blendedProfit: maturedProfit + projectedProfit
   • blendedROAS: (maturedRevenue + projectedRevenue) / spend
   • blendedMargin: blendedProfit / blendedRevenue

4. COST METRICS:
   • spend: Chi phí quảng cáo thực tế
   • Được lấy từ advertising-cost collection

🔄 QUY TRÌNH PHÂN TÍCH:

1. DATA AGGREGATION:
   • Group data by date + adGroupId
   • Calculate daily metrics for each ad group
   • Apply time-based filters (from/to dates)

2. PREDICTION ALGORITHM:
   • Sử dụng historical data để dự đoán
   • Tính confidence score based on data quality
   • Apply calibration để giảm bias

3. SUMMARY CALCULATION:
   • Aggregate across all ad groups
   • Calculate totals, averages
   • Generate period-based insights

4. SNAPSHOT SYSTEM:
   • Save periodic snapshots for comparison
   • Track prediction accuracy over time
   • Enable historical analysis

===================================================================

💰 CHỨC NĂNG 2: ADVERTISING COST SUGGESTION - ĐỀ XUẤT CHI PHÍ QC
===================================================================

🎯 TỔNG QUAN:  
Route: /advertising-cost-suggestion
Mục đích: Quản lý và đề xuất ngân sách quảng cáo tối ưu
Component: AdvertisingCostSuggestionComponent

📋 CÁCH LẤY DỮ LIỆU:

1. FRONTEND DATA INTEGRATION:
   ├── Multiple API calls trong loadData():
   │   ├── loadSuggestions() → /advertising-cost-suggestion
   │   ├── loadStatistics() → /advertising-cost-suggestion/statistics
   │   ├── loadAdGroups() → /ad-groups (tất cả ad groups)
   │   ├── loadAdvertisingCosts() → /advertising-cost-public/yesterday-spent
   │   └── loadRecommendedBudgets() → /profit-forecast/recommended-budget
   │
   └── Data Combination:
       ├── Merge ad groups với existing suggestions
       ├── Apply yesterday costs from advertising-cost
       ├── Calculate differences và percentages
       └── Apply recommended budgets from ML

2. BACKEND DATA SOURCES:
   ├── advertising-cost-suggestion collection (chính)
   │   ├── suggestedCost: Chi phí đề xuất (manual input)
   │   ├── dailyCost: Chi phí hàng ngày (auto-sync)
   │   ├── dailyDifference: Chênh lệch (calculated)
   │   └── adGroupId: Liên kết với ad groups
   │
   ├── advertising-cost collection (chi phí thực tế)
   │   ├── GET /yesterday-spent → chi phí hôm qua
   │   └── Đồng bộ với suggestion.dailyCost
   │
   └── profit-forecast service (ML recommendations)
       └── GET /recommended-budget → budget AI đề xuất

📊 CÁC METRICS ĐƯỢC PHÂN TÍCH:

1. SUGGESTION METRICS:
   • suggestedCost: Ngân sách đề xuất (manual)
   • dailyCost: Chi phí thực tế hôm qua  
   • dailyDifference: Chênh lệch (dailyCost - suggestedCost)
   • dailyDifferencePercent: % chênh lệch

2. STATISTICS:
   • totalSuggestions: Tổng số ad groups có đề xuất
   • activeSuggestions: Số đề xuất đang active
   • totalSuggestedCost: Tổng ngân sách đề xuất
   • totalDailyCost: Tổng chi phí thực tế
   • averageSuggestedCost: Chi phí đề xuất trung bình
   • averageDailyCost: Chi phí thực tế trung bình

3. ML RECOMMENDATIONS:
   • recommendedDailySpend: AI đề xuất (từ profit-forecast)
   • Based on 7-day performance history
   • Optimized cho ROAS và profit margins

🔄 QUY TRÌNH PHÂN TÍCH:

1. DATA COLLECTION:
   • Real-time costs từ advertising-cost hàng ngày
   • Manual suggestions từ user input
   • AI recommendations từ ML algorithms
   • Ad group performance metrics

2. CALCULATION ENGINE:
   • dailyDifference = dailyCost - suggestedCost
   • Percentage calculations for trending
   • Aggregate statistics across all groups
   • Color-coding based on performance thresholds

3. SUGGESTION WORKFLOW:
   • User input suggested costs per ad group
   • System auto-syncs actual daily costs
   • Calculate variance và performance indicators
   • Display recommendations với visual cues

4. OPTIMIZATION FEATURES:
   • Inline editing (updateSuggestedCost)
   • Auto-create suggestions khi chưa có
   • Bulk updates và batch operations
   • Export/reporting capabilities

===================================================================

🔍 SO SÁNH 2 CHỨC NĂNG:

PROFIT FORECAST:
• Focus: Dự đoán tương lai based on historical data
• Data: Revenue, profit, ROAS predictions
• Algorithm: ML forecasting với confidence scores
• Output: Projections, trends, accuracy metrics

ADVERTISING COST SUGGESTION:  
• Focus: Optimization ngân sách hiện tại
• Data: Suggested vs actual spending comparison
• Algorithm: Variance analysis + ML recommendations
• Output: Budget recommendations, variance alerts

LIÊN KẾT GIỮA 2 CHỨC NĂNG:
• Cost Suggestion sử dụng recommendedBudget từ Profit Forecast
• Profit Forecast predictions ảnh hưởng đến suggested costs
• Cả 2 đều analyze advertising performance data
• Integrated workflow: Predict → Optimize → Monitor

===================================================================

🎯 INSIGHTS VỀ ARCHITECTURE:

1. DATA PIPELINE:
   Raw Costs → Analysis → Predictions → Recommendations → Actions

2. SEPARATION OF CONCERNS:
   • Profit Forecast: Analytical & Predictive
   • Cost Suggestion: Operational & Optimization

3. INTEGRATION POINTS:
   • Shared data sources (advertising-cost, ad-groups)
   • Cross-service API calls (profit-forecast/recommended-budget)
   • Consistent UI patterns và error handling

4. SCALABILITY:
   • Modular service architecture
   • Cached API responses
   • Efficient data aggregation
   • Real-time sync capabilities

===================================================================
`);

// Technical implementation details
console.log(`
🔧 TECHNICAL IMPLEMENTATION DETAILS:

PROFIT FORECAST - Key Code Paths:
├── Frontend: profit-forecast.component.ts
│   ├── reload() → calls getForecastWithCost() + getSummary()
│   ├── Data binding: forecast() signal for table data
│   ├── summaryResult() signal for dashboard metrics
│   └── exportCsv() for data export
│
└── Backend: profit-forecast.service.ts
    ├── forecastWithCost() → complex aggregation pipeline
    ├── summaryAggregate() → calculates totals + averages
    └── Data sources: orders, ad-costs, historical performance

ADVERTISING COST SUGGESTION - Key Code Paths:
├── Frontend: advertising-cost-suggestion.component.ts
│   ├── loadData() → parallel API calls (5 endpoints)
│   ├── combinedDataComputed() → merges all data sources
│   ├── updateSuggestedCost() → inline editing with auto-save
│   └── Real-time variance calculations
│
└── Backend: advertising-cost-suggestion.service.ts
    ├── CRUD operations on suggestions collection
    ├── getStatistics() → aggregation pipeline for metrics
    ├── syncAllDailyCosts() → batch update từ advertising-cost
    └── Integration với profit-forecast cho recommendations

DATABASE SCHEMAS:
• profit_forecast: date, adGroupId, metrics, predictions
• advertising_cost_suggestions: adGroupId, costs, differences
• advertising_costs: daily actual spending per ad group
• ad_groups: master data cho all ad groups

API PATTERNS:
• RESTful endpoints với query parameters
• Aggregation pipelines cho complex calculations  
• Error handling với proper HTTP codes
• Response caching cho performance
`);