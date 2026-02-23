# 💰 Luồng Hoạt Động - Dashboard Quản Lý Vốn & Phân Bổ

## 1. Tổng Quan Kiến Trúc

```mermaid
flowchart TB
    User[👤 User] --> Dashboard[💰 Capital Management Dashboard]
    Dashboard --> Mode{Chọn Mode}
    Mode --> Conservative[🟢 Conservative<br/>An toàn]
    Mode --> Moderate[🟡 Moderate<br/>Cân bằng]
    Mode --> Aggressive[🔴 Aggressive<br/>Rủi ro]
    
    Conservative --> LoadData[📊 Load Dashboard Data]
    Moderate --> LoadData
    Aggressive --> LoadData
    
    LoadData --> API1[API: Available Funds]
    LoadData --> API2[API: Capital Allocation]
    LoadData --> API3[API: Budget Status]
    LoadData --> API4[API: Active Policy]
    
    API1 --> Render[🖼️ Render UI]
    API2 --> Render
    API3 --> Render
    API4 --> Render
    
    Render --> Tab1[📊 Tab: Tổng quan]
    Render --> Tab2[📑 Tab: Phân bổ lợi nhuận]
    Render --> Tab3[🎯 Tab: Phân bổ ngân sách]
```

## 2. Luồng API Call Chi Tiết

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant S as Service
    participant API as Backend API
    participant DB as MongoDB
    
    U->>C: Chọn mode (conservative/moderate/aggressive)
    C->>C: Set currentMode signal
    C->>S: loadDashboard(mode)
    
    par Parallel API Calls
        S->>API: GET /finance/available-funds/current?mode=conservative
        API->>DB: Query TestOrder2 collection
        DB-->>API: Orders data
        API-->>S: RealAvailableFunds
        
        S->>API: GET /capital-allocation/compute?mode=conservative
        API->>DB: Get active policy + orders
        DB-->>API: Policy + Orders
        API-->>S: AllocationComputation
        
        S->>API: GET /capital-allocation/policies/active
        API->>DB: Find active policy
        DB-->>API: Active policy
        API-->>S: CapitalAllocationPolicy
        
        S->>API: GET /budget-allocation/status
        API->>DB: Get ad groups + orders
        DB-->>API: Budget status
        API-->>S: BudgetAllocationStatus
    end
    
    S-->>C: DashboardData (forkJoin result)
    C->>C: Update signals (funds, allocation, budgetStatus, activePolicy)
    C->>U: Display dashboard with 3 tabs
```

## 3. Luồng Dữ Liệu Theo Mode

```mermaid
flowchart LR
    subgraph Backend
        Orders[(TestOrder2<br/>Collection)] --> Logic{Finance Logic}
        
        Logic --> C[Conservative Mode<br/>Chỉ đơn paid cả 2 bên]
        Logic --> M[Moderate Mode<br/>Chiết khấu 100%/70%/40%]
        Logic --> A[Aggressive Mode<br/>Ước tính + Vay]
        
        C --> CF1[realizedNetProfit<br/>pendingNetProfit<br/>realizedOrderCount]
        M --> CF2[realizedProfit 100%<br/>partialProfit 70%<br/>pendingProfit 40%]
        A --> CF3[estimatedProfit<br/>unrealizedProfit<br/>loanAvailable]
    end
    
    subgraph Frontend
        CF1 --> UI1[💰 Tiền Chắc Ăn<br/>Risk: LOW]
        CF2 --> UI2[💰 Tiền Khả Dụng<br/>Risk: MEDIUM]
        CF3 --> UI3[💰 Tổng Vốn<br/>Risk: HIGH]
    end
```

## 4. Tab 1: Tổng Quan - Luồng Hiển Thị

```mermaid
flowchart TB
    Tab1[📊 Tab Tổng quan] --> Cards[Summary Cards]
    
    Cards --> Card1[💵 Tiền Chắc Ăn<br/>safeAvailableFunds]
    Cards --> Card2[📈 Tổng Lợi Nhuận<br/>totalNetProfit]
    Cards --> Card3[✅ Đã Thực Hiện<br/>realizedNetProfit]
    Cards --> Card4[⏳ Đang Chờ<br/>pendingNetProfit]
    
    Tab1 --> CashFlow[💸 Chi Tiết Luồng Vốn]
    
    CashFlow --> Mode{Mode?}
    Mode -->|Conservative| Flow1[realizedNetProfit<br/>pendingNetProfit<br/>initialCapital<br/>netCashAvailable]
    Mode -->|Moderate| Flow2[realizedProfit 100%<br/>partialProfit 70%<br/>pendingProfit 40%<br/>discountedFunds]
    Mode -->|Aggressive| Flow3[estimatedProfit<br/>realizedProfit<br/>unrealizedProfit<br/>loanAvailable]
    
    Tab1 --> Risk[ℹ️ Risk Info Box]
    Risk --> Description[Description]
    Risk --> Warning[Warning]
    Risk --> Recommendation[Recommendation]
```

## 5. Tab 2: Phân Bổ Lợi Nhuận - Luồng Xử Lý

```mermaid
flowchart TB
    Tab2[📑 Tab Phân bổ lợi nhuận] --> Policy[Get Active Policy]
    Policy --> Ratios[📊 Policy Ratios<br/>Tái đầu tư: 45%<br/>Dự phòng: 25%<br/>Thu nhập: 20%<br/>Tài sản DH: 10%]
    
    Tab2 --> Compute[Compute Allocation]
    Compute --> Available[cashAvailable<br/>from selected mode]
    
    Available --> Calculate{Calculate}
    Calculate --> A1[Reinvestment<br/>= cashAvailable × 0.45]
    Calculate --> A2[Safety Reserve<br/>= cashAvailable × 0.25]
    Calculate --> A3[Personal Income<br/>= cashAvailable × 0.20]
    Calculate --> A4[Long-term Asset<br/>= cashAvailable × 0.10]
    
    A1 --> Chart[📊 Allocation Chart]
    A2 --> Chart
    A3 --> Chart
    A4 --> Chart
    
    Chart --> Visual[Visual Bar with %]
    Chart --> Cards2[4 Allocation Cards]
    
    Tab2 --> Action[📸 Capture Snapshot]
    Action --> Save[POST /capital-allocation/snapshots]
    Save --> DB[(MongoDB)]
```

## 6. Tab 3: Phân Bổ Ngân Sách Ads - Luồng ROI

```mermaid
flowchart TB
    Tab3[🎯 Tab Phân bổ ngân sách Ads] --> Status[Budget Status]
    
    Status --> Check{Check Budget}
    Check -->|Đủ| OK[✅ canAfford = true]
    Check -->|Thiếu| NOK[❌ canAfford = false<br/>Show deficit]
    
    Tab3 --> Preview[Load Budget Preview]
    Preview --> GetGroups[Get All Ad Groups]
    GetGroups --> Calc[Calculate for Each Group]
    
    Calc --> ROI{ROI Calculation}
    ROI --> High[ROI ≥ 2.0<br/>🟢 High priority]
    ROI --> Medium[1.0 ≤ ROI < 2.0<br/>🟡 Medium priority]
    ROI --> Low[ROI < 1.0<br/>🔴 Low priority]
    
    High --> Allocate1[Allocate more budget]
    Medium --> Allocate2[Maintain budget]
    Low --> Allocate3[Reduce budget]
    
    Allocate1 --> Table[📊 Allocation Table]
    Allocate2 --> Table
    Allocate3 --> Table
    
    Tab3 --> Apply{User clicks Apply?}
    Apply -->|Yes| Post[POST /budget-allocation/auto<br/>dryRun=false]
    Apply -->|No| Preview2[Preview only<br/>dryRun=true]
    
    Post --> Update[Update Ad Groups Budget]
    Update --> Refresh[Reload Dashboard]
```

## 7. Data Flow - Backend Logic

```mermaid
flowchart LR
    subgraph TestOrder2 Schema
        O1[supplierPaymentStatus]
        O2[agentPaymentStatus]
        O3[supplierPaidAmount]
        O4[agentPaidAmount]
        O5[realizedGrossProfit]
        O6[realizedNetProfit]
        O7[realizedAt]
    end
    
    subgraph Finance Service Logic
        O1 --> Check1{Both paid?}
        O2 --> Check1
        
        Check1 -->|Yes| Realized[✅ Realized<br/>supplierPaymentStatus='paid'<br/>agentPaymentStatus='paid'|'n/a']
        Check1 -->|No| Pending[⏳ Pending<br/>Chưa thanh toán đủ]
        
        Realized --> Calc1[realizedNetProfit<br/>= supplierPaidAmount - agentPaidAmount]
        Pending --> Calc2[pendingNetProfit<br/>= estimated based on orders]
    end
    
    subgraph Conservative Mode
        Calc1 --> Safe[💰 Safe Available Funds<br/>= Σ realizedNetProfit + initialCapital]
    end
    
    subgraph Moderate Mode
        Calc1 --> R100[Realized: 100%]
        Pending --> R70[Partial paid: 70%]
        Pending --> R40[Pending: 40%]
        R100 --> Discount[Discounted Funds]
        R70 --> Discount
        R40 --> Discount
    end
    
    subgraph Aggressive Mode
        Calc1 --> Est[Estimated Profit]
        Calc2 --> Est
        Est --> Loan[+ Loan Available]
        Loan --> Total[Total Funds<br/>⚠️ HIGH RISK]
    end
```

## 8. Error Handling Flow

```mermaid
flowchart TB
    Start[Load Dashboard] --> Parallel{forkJoin}
    
    Parallel --> API1[Available Funds]
    Parallel --> API2[Allocation]
    Parallel --> API3[Budget Status]
    Parallel --> API4[Active Policy]
    
    API1 --> Catch1{Error?}
    API2 --> Catch2{Error?}
    API3 --> Catch3{Error?}
    API4 --> Catch4{Error?}
    
    Catch1 -->|Yes| Null1[catchError → null]
    Catch2 -->|Yes| Null2[catchError → null]
    Catch3 -->|Yes| Null3[catchError → null]
    Catch4 -->|Yes| Null4[catchError → null]
    
    Catch1 -->|No| Data1[RealAvailableFunds]
    Catch2 -->|No| Data2[AllocationComputation]
    Catch3 -->|No| Data3[BudgetAllocationStatus]
    Catch4 -->|No| Data4[CapitalAllocationPolicy]
    
    Null1 --> Merge[Merge Results]
    Null2 --> Merge
    Null3 --> Merge
    Null4 --> Merge
    Data1 --> Merge
    Data2 --> Merge
    Data3 --> Merge
    Data4 --> Merge
    
    Merge --> Check{All null?}
    Check -->|Yes| Error[❌ Show error message]
    Check -->|No| Partial[⚠️ Show partial data<br/>+ warning message]
    
    Partial --> Render[Render available sections]
```

## 9. User Interaction Flow

```mermaid
stateDiagram-v2
    [*] --> Loading: Page Load
    Loading --> Overview: Data loaded
    
    Overview --> Overview: Change mode<br/>(Conservative/Moderate/Aggressive)
    Overview --> Allocation: Click tab "Phân bổ lợi nhuận"
    Overview --> Budget: Click tab "Phân bổ ngân sách"
    
    Allocation --> Overview: Click tab "Tổng quan"
    Allocation --> Budget: Click tab "Phân bổ ngân sách"
    Allocation --> Snapshot: Click "Lưu Snapshot"
    Snapshot --> Allocation: Snapshot saved
    
    Budget --> Overview: Click tab "Tổng quan"
    Budget --> Allocation: Click tab "Phân bổ lợi nhuận"
    Budget --> Preview: Load preview
    Preview --> Apply: Click "Áp dụng phân bổ"
    Apply --> Budget: Budget applied
    Apply --> Loading: Reload dashboard
    
    state Overview {
        [*] --> ShowCards
        ShowCards --> ShowCashFlow
        ShowCashFlow --> ShowRiskInfo
    }
    
    state Allocation {
        [*] --> ShowPolicy
        ShowPolicy --> ShowChart
        ShowChart --> ShowCards
    }
    
    state Budget {
        [*] --> ShowStatus
        ShowStatus --> ShowTable
        ShowTable --> ShowSummary
    }
```

## 10. Component Architecture

```mermaid
flowchart TB
    subgraph Component Layer
        Main[CapitalManagementComponent]
        Main --> Service[CapitalManagementService]
    end
    
    subgraph Service Layer
        Service --> HTTP[HttpClient]
        HTTP --> API1[FinanceController]
        HTTP --> API2[CapitalAllocationController]
        HTTP --> API3[BudgetAllocationController]
    end
    
    subgraph Backend Services
        API1 --> FS[FinanceService]
        API2 --> CAS[CapitalAllocationService]
        API3 --> BAS[BudgetAllocationService]
        
        FS --> Compute1[computeRealAvailableFunds]
        CAS --> Compute2[computeAllocation]
        BAS --> Compute3[getAllocationStatus]
    end
    
    subgraph Database
        Compute1 --> DB1[(TestOrder2)]
        Compute2 --> DB2[(CapitalAllocationPolicy)]
        Compute2 --> DB1
        Compute3 --> DB3[(AdGroup)]
        Compute3 --> DB1
    end
    
    subgraph UI Signals
        Main --> S1[funds signal]
        Main --> S2[allocation signal]
        Main --> S3[budgetStatus signal]
        Main --> S4[activePolicy signal]
        Main --> S5[currentMode signal]
        Main --> S6[activeTab signal]
    end
```

## 11. Key Features Summary

### ✅ Đã Hoàn Thành

1. **Dashboard Tích Hợp**
   - Gộp 4 features cũ thành 1 dashboard duy nhất
   - 3 tabs: Tổng quan, Phân bổ lợi nhuận, Phân bổ ngân sách

2. **Mode Selector**
   - 3 modes: Conservative (An toàn), Moderate (Cân bằng), Aggressive (Rủi ro)
   - Thay đổi mode → Reload tất cả data

3. **API Integration**
   - Parallel loading với forkJoin
   - Error handling với catchError
   - Graceful degradation (nếu 1 API fail, các API khác vẫn hoạt động)

4. **Responsive UI**
   - Summary cards với icons và badges
   - Visual allocation chart
   - ROI-based budget table
   - Mobile-friendly design

5. **Real-time Data**
   - Dữ liệu từ TestOrder2 collection
   - Chỉ tính đơn đã thanh toán (realized profit)
   - Hiển thị pending orders

### 🎯 Route & Navigation

```
/finance/capital-management  (Dashboard chính - default route)
  ├─ Tab: Tổng quan
  ├─ Tab: Phân bổ lợi nhuận
  └─ Tab: Phân bổ ngân sách

/finance/available-funds     (Cũ - ẩn trong sidebar)
/finance/capital-allocation  (Cũ - ẩn trong sidebar)
/finance/capital-flow        (Cũ - ẩn trong sidebar)
/finance/budget-allocation   (Cũ - ẩn trong sidebar)
```

### 📊 API Endpoints

```
GET  /api/finance/available-funds/current?mode=conservative
GET  /api/capital-allocation/policies/active
GET  /api/capital-allocation/compute?mode=conservative
GET  /api/budget-allocation/status
POST /api/capital-allocation/snapshots
POST /api/budget-allocation/auto
```

### 🔄 Data Sync Flow

```
User Action → Component → Service → HTTP → Backend API → Database
                ↓                                            ↓
            Update Signals ← Transform Data ← Query Results
                ↓
            Render UI (Reactive with Angular Signals)
```
