# 🎯 HƯỚNG DẪN TỰ ĐỘNG PHÂN BỔ NGÂN SÁCH VÀO AD ACCOUNT & AD GROUP

## 📋 Tổng Quan Hệ Thống

Hệ thống có **3 cách phân bổ ngân sách** tự động:

### 1️⃣ **Phân bổ theo AI Optimization** (Tự động hoàn toàn)
### 2️⃣ **Phân bổ theo Optimal Spend Suggestion** (Dựa vào phân tích dữ liệu)
### 3️⃣ **Phân bổ theo Budget Buckets** (Quản lý theo nhóm sản phẩm)

---

## 🤖 PHƯƠNG PHÁP 1: AI OPTIMIZATION (Tự động)

### Cách hoạt động:
1. AI phân tích performance của từng ad group (ROI, profit, spend)
2. Đưa ra khuyến nghị: INCREASE, DECREASE, PAUSE, MAINTAIN
3. Tự động apply ngân sách lên Facebook/Google/TikTok nếu bật chế độ AUTO

### Các bước thiết lập:

#### Bước 1: Tạo Ad Group Suggestion
```typescript
// Backend: advertising-cost-suggestion.service.ts
POST /advertising-cost-suggestions
Body: {
  "adGroupId": "123456789",
  "adGroupName": "iPhone 15 - Campaign 1",
  "suggestedCost": 500000, // Ngân sách hiện tại
  "enableAutoMode": true,  // Bật tự động
  "enableAIAnalysis": true // Bật phân tích AI
}
```

#### Bước 2: AI Tự Động Phân Tích
```typescript
// Chạy cronjob mỗi ngày 2:00 AM
@Cron('0 2 * * *')
async analyzeAllAutoAdGroups() {
  // 1. Lấy tất cả ad groups có enableAutoMode = true
  const autoSuggestions = await this.suggestionModel.find({
    enableAutoMode: true,
    enableAIAnalysis: true
  });

  // 2. Phân tích từng ad group
  for (const suggestion of autoSuggestions) {
    const analysis = await this.aiOptimizationService.analyzeAdGroupWithAI(suggestion);
    
    // 3. Tự động apply nếu confidence > 70%
    if (analysis.confidence >= 70) {
      await this.applyBudgetChange(suggestion, analysis);
    }
  }
}
```

#### Bước 3: Apply Ngân Sách Lên Platform
```typescript
// Backend: budget-apply.service.ts
async applyBudgetToProvider(adGroup, adAccount, newBudget) {
  switch (adGroup.platform) {
    case 'facebook':
      // Gọi Facebook API
      await axios.post(`https://graph.facebook.com/v19.0/${adGroupId}`, {
        daily_budget: newBudget,
        access_token: facebookToken
      });
      break;
      
    case 'google':
      // Gọi Google Ads API
      const googleAds = google.ads('v14');
      await googleAds.customers.campaigns.mutate({
        customerId: adAccountId,
        operations: [{
          update: {
            resourceName: campaignResourceName,
            campaignBudget: { amountMicros: newBudget * 1000000 }
          }
        }]
      });
      break;
      
    case 'tiktok':
      // Gọi TikTok API
      await axios.post(`https://ads.tiktok.com/open_api/v1.3/campaign/update/`, {
        advertiser_id: adAccountId,
        campaign_id: adGroupId,
        budget: newBudget
      });
      break;
  }
}
```

### Frontend: Quản lý AI Optimization

**File:** `frontend/src/app/features/advertising-cost-suggestion/ai-optimization-panel.component.ts`

```typescript
// Bật/tắt chế độ tự động
async toggleAutoMode(adGroupId: string) {
  await this.http.patch(`/advertising-cost-suggestions/${adGroupId}`, {
    enableAutoMode: true
  });
}

// Xem danh sách đề xuất đang chờ
async loadPendingRecommendations() {
  const recommendations = await this.http.get('/ai-optimization/recommendations');
  // recommendations = [{
  //   adGroupId: "123",
  //   recommendedAction: "INCREASE",
  //   suggestedBudget: 600000,
  //   confidence: 85,
  //   reasoning: "ROI cao và stable"
  // }]
}

// Phê duyệt thủ công
async approveRecommendation(recId: string) {
  await this.http.post(`/ai-optimization/approve/${recId}`);
}
```

---

## 📊 PHƯƠNG PHÁP 2: OPTIMAL SPEND SUGGESTION

### Cách hoạt động:
1. Phân tích lịch sử chi phí & lợi nhuận 60 ngày
2. Chia thành 4 buckets chi phí (theo quantile)
3. Chọn bucket có ROI cao nhất
4. Đề xuất optimal spend với guardrail ±20%

### API Endpoint:
```bash
GET /ad-group-profit-report/optimal-spend

Response:
[
  {
    "adGroupId": "123456789",
    "adGroupName": "iPhone 15 - Campaign 1",
    "lastSpend": 500000,    // Chi phí hiện tại
    "lastProfit": 1200000,  // Lợi nhuận hiện tại
    "optimalSpend": 650000, // Đề xuất tối ưu
    "appliedSpend": 600000  // Sau khi áp guardrail ±20%
  }
]
```

### Logic tính toán:

```typescript
// Backend: ad-group-profit-report.service.ts
async getOptimalSpendSuggestions() {
  // 1. Lấy dữ liệu 60 ngày
  const hist = await Summary5.aggregate([
    { $match: { orderDate: { $gte: last60Days } } },
    { $group: {
      _id: { adGroupId: "$adGroupId", date: "$orderDate" },
      adCost: { $sum: "$adCost" },
      profit: { $sum: "$profit" }
    }}
  ]);

  // 2. Với mỗi ad group, chia thành 4 buckets
  const quantiles = [0.25, 0.5, 0.75, 1.0];
  const buckets = calculateBuckets(hist, quantiles);
  
  // 3. Chọn bucket có ROI cao nhất
  const bestBucket = buckets.reduce((max, b) => 
    b.roi > max.roi ? b : max
  );
  
  // 4. Apply guardrail ±20%
  const candidate = bestBucket.meanSpend;
  const lastSpend = getCurrentSpend(adGroupId);
  const optimalSpend = clamp(candidate, lastSpend * 0.8, lastSpend * 1.2);
  
  return { adGroupId, lastSpend, optimalSpend };
}
```

### Cách sử dụng trong Frontend:

```typescript
// Load optimal spend suggestions
this.http.get('/ad-group-profit-report/optimal-spend').subscribe(data => {
  // Hiển thị bảng đề xuất
  this.optimalSpends = data;
  
  // Tự động apply vào form
  data.forEach(item => {
    this.updateAdGroupBudget(item.adGroupId, item.appliedSpend);
  });
});
```

---

## 🗂️ PHƯƠNG PHÁP 3: BUDGET BUCKETS (Quản lý theo nhóm)

### Cách hoạt động:
1. Tạo Budget Buckets theo nhóm sản phẩm (iPhone, Samsung, iPad...)
2. Gán funding sources vào từng bucket
3. Đặt giới hạn daily/weekly/monthly cap
4. Ad groups thuộc bucket sẽ dùng ngân sách từ đó

### Schema:
```typescript
// Backend: budget-bucket.schema.ts
interface BudgetBucket {
  name: string;                    // "iPhone Products"
  code: string;                    // "IPHONE_2024"
  productGroupIds: string[];       // ["prod_001", "prod_002"]
  dailyCap: number;                // 5,000,000 VND/ngày
  weeklyCap: number;               // 30,000,000 VND/tuần
  monthlyCap: number;              // 120,000,000 VND/tháng
  linkedSources: [{
    sourceId: ObjectId;            // Ref to FundingSource
    allocated: number;             // Số tiền phân bổ
    restricted: boolean;           // Chỉ dùng cho bucket này?
  }];
  active: boolean;
}
```

### Các bước thiết lập:

#### Bước 1: Tạo Funding Sources
```bash
POST /finance/funding-sources
Body: {
  "name": "Vốn Quảng Cáo Q1",
  "type": "advertising",
  "principal": 100000000,        // 100 triệu
  "availableBalance": 100000000,
  "notes": "Ngân sách ads Q1 2026"
}
```

#### Bước 2: Tạo Budget Bucket
```bash
POST /finance/budget-buckets
Body: {
  "name": "iPhone Campaigns",
  "code": "IPHONE_Q1",
  "productGroupIds": ["prod_iphone_15", "prod_iphone_14"],
  "dailyCap": 5000000,    // 5 triệu/ngày
  "weeklyCap": 30000000,  // 30 triệu/tuần
  "monthlyCap": 120000000, // 120 triệu/tháng
  "linkedSources": [{
    "sourceId": "6789abcd...",  // ID của Funding Source
    "allocated": 50000000,       // Phân bổ 50 triệu từ 100 triệu
    "restricted": true           // Chỉ dùng cho bucket này
  }]
}
```

#### Bước 3: Gán Ad Groups vào Bucket
```bash
PATCH /ad-groups/:adGroupId
Body: {
  "budgetBucketId": "bucket_001" // Gán ad group vào bucket
}
```

#### Bước 4: Tự Động Phân Bổ
```typescript
// Backend: budget-bucket.service.ts
async allocateBudgetToAdGroups(bucketId: string) {
  const bucket = await BudgetBucket.findById(bucketId);
  const adGroups = await AdGroup.find({ budgetBucketId: bucketId });
  
  // 1. Tính tổng budget available
  const totalAvailable = bucket.linkedSources.reduce((sum, src) => 
    sum + src.allocated, 0
  );
  
  // 2. Kiểm tra daily cap
  const todaySpent = await getTodaySpent(bucketId);
  const remainingDaily = bucket.dailyCap - todaySpent;
  
  if (remainingDaily <= 0) {
    throw new Error('Đã hết ngân sách hàng ngày');
  }
  
  // 3. Phân bổ đều hoặc theo trọng số
  const budgetPerGroup = remainingDaily / adGroups.length;
  
  for (const adGroup of adGroups) {
    await applyBudgetToProvider(adGroup, budgetPerGroup);
  }
}
```

---

## 🎨 GIAO DIỆN FRONTEND

### Component: Available Funds (Vốn Khả Dụng)
**File:** `frontend/src/app/features/finance/available-funds.component.ts`

```html
<div class="page">
  <h2>💰 Nguồn Vốn Khả Dụng: {{ availableFunds | currency }}</h2>
  
  <!-- Hiển thị các nguồn vốn -->
  <div class="funding-sources">
    <div *ngFor="let source of fundingSources">
      {{ source.name }}: {{ source.availableBalance | currency }}
    </div>
  </div>
  
  <!-- Nút phân bổ tự động -->
  <button (click)="autoAllocateBudget()">
    🤖 Tự động phân bổ ngân sách
  </button>
</div>
```

### Component: Budget Allocation Dashboard
**Tạo mới:** `frontend/src/app/features/budget-allocation/`

```typescript
export class BudgetAllocationComponent {
  // Hiển thị cây phân bổ
  // Available Funds
  //  ├─ Budget Bucket 1 (iPhone)
  //  │   ├─ Ad Account 1
  //  │   │   ├─ Ad Group 1: 500k/day
  //  │   │   └─ Ad Group 2: 700k/day
  //  │   └─ Ad Account 2
  //  └─ Budget Bucket 2 (Samsung)
  
  async autoDistribute() {
    // 1. Lấy vốn khả dụng
    const funds = await this.financeService.getAvailableFunds();
    
    // 2. Lấy đề xuất optimal spend
    const optimalSpends = await this.http.get('/ad-group-profit-report/optimal-spend');
    
    // 3. Phân bổ theo tỷ lệ ROI
    const totalOptimal = optimalSpends.reduce((sum, s) => sum + s.appliedSpend, 0);
    
    if (totalOptimal > funds.available) {
      // Scale down theo tỷ lệ
      optimalSpends.forEach(s => {
        s.finalBudget = s.appliedSpend * (funds.available / totalOptimal);
      });
    }
    
    // 4. Apply từng ad group
    for (const spend of optimalSpends) {
      await this.applyBudget(spend.adGroupId, spend.finalBudget);
    }
  }
}
```

---

## 🔄 QUY TRÌNH TỰ ĐỘNG HOÀN CHỈNH

### Cronjobs

#### 1. Daily Budget Allocation (Mỗi ngày 1:00 AM)
```typescript
@Cron('0 1 * * *')
async dailyBudgetAllocation() {
  // 1. Tính vốn khả dụng
  const funds = await this.financeService.computeAvailableFunds();
  
  // 2. Lấy optimal spend suggestions
  const suggestions = await this.adGroupProfitService.getOptimalSpendSuggestions();
  
  // 3. Lọc theo budget buckets
  const buckets = await this.budgetBucketModel.find({ active: true });
  
  for (const bucket of buckets) {
    // Check daily cap
    const todaySpent = await this.getTodaySpent(bucket._id);
    const remaining = bucket.dailyCap - todaySpent;
    
    if (remaining <= 0) continue;
    
    // Phân bổ cho ad groups trong bucket
    const adGroups = await this.adGroupModel.find({ budgetBucketId: bucket._id });
    const bucketSuggestions = suggestions.filter(s => 
      adGroups.some(ag => ag.adGroupId === s.adGroupId)
    );
    
    await this.allocateToBucket(bucket, bucketSuggestions, remaining);
  }
}
```

#### 2. AI Analysis (Mỗi ngày 2:00 AM)
```typescript
@Cron('0 2 * * *')
async aiAnalysisJob() {
  const autoSuggestions = await this.suggestionModel.find({
    enableAutoMode: true,
    enableAIAnalysis: true
  });
  
  for (const suggestion of autoSuggestions) {
    const analysis = await this.aiOptimizationService.analyzeAdGroupWithAI(suggestion);
    
    if (analysis.confidence >= 70) {
      await this.applyAIRecommendation(suggestion, analysis);
    } else {
      // Lưu vào pending recommendations để admin review
      await this.savePendingRecommendation(suggestion, analysis);
    }
  }
}
```

---

## 📈 DASHBOARD & MONITORING

### Metrics cần theo dõi:

1. **Vốn khả dụng realtime**
2. **Ngân sách đã phân bổ hôm nay**
3. **ROI trung bình của các ad groups**
4. **Số lượng ad groups đang auto mode**
5. **Pending recommendations cần review**

### API cho Dashboard:
```bash
GET /budget-allocation/dashboard

Response: {
  "availableFunds": 50000000,
  "allocatedToday": 12000000,
  "remainingBudget": 38000000,
  "activeAdGroups": 25,
  "autoModeGroups": 15,
  "avgROI": 2.5,
  "pendingRecommendations": 5,
  "buckets": [
    {
      "name": "iPhone Campaigns",
      "dailyCap": 5000000,
      "spentToday": 3500000,
      "remaining": 1500000,
      "adGroupCount": 8
    }
  ]
}
```

---

## ✅ CHECKLIST TRIỂN KHAI

- [ ] Tạo Funding Sources (nguồn vốn)
- [ ] Tạo Budget Buckets (nhóm ngân sách)
- [ ] Link Funding Sources → Budget Buckets
- [ ] Gán Ad Groups → Budget Buckets
- [ ] Bật AI Optimization cho ad groups muốn tự động
- [ ] Setup cronjobs cho daily allocation
- [ ] Tạo dashboard monitoring
- [ ] Test với số tiền nhỏ trước
- [ ] Monitor 1 tuần đầu, sau đó scale up

---

## 🚨 LƯU Ý AN TOÀN

1. **Guardrail**: Chỉ thay đổi tối đa ±20% mỗi lần
2. **Daily Cap**: Đặt giới hạn hàng ngày để tránh vượt ngân sách
3. **Confidence Threshold**: Chỉ auto apply khi confidence >= 70%
4. **Manual Review**: Luôn có pending recommendations để admin kiểm tra
5. **Rollback**: Lưu lịch sử thay đổi để có thể rollback

---

## 📞 HỖ TRỢ

Nếu cần thêm chi tiết về bất kỳ phần nào, hãy hỏi cụ thể!
