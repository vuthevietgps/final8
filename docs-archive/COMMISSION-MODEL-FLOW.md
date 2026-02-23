# Commission Model - Cash Flow Documentation

## 🎯 Mô Hình Hoạt Động

### Tổng Quan
Đây là **Commission Model** - User KHÔNG trả COGS cho supplier trước, supplier tự fulfillment và thu COD.

```
┌─────────┐      ┌──────────┐      ┌──────────┐      ┌────────┐
│  User   │ ───> │ Supplier │ ───> │ Customer │ ───> │ Agent  │
│(Quảng cáo)│      │(Ship COD)│      │(Trả tiền)│      │(Chia %)│
└─────────┘      └──────────┘      └──────────┘      └────────┘
    │                  │                  │                │
    │ 1. Chuyển order  │                  │                │
    │ ─────────────────>                  │                │
    │                  │ 2. Ship + Thu COD│                │
    │                  │ <─────────────────                │
    │                  │ [Supplier GIỮ TIỀN]              │
    │                  │                                    │
    │ 3. Reconcile     │                                    │
    │    (mỗi 10 ngày) │                                    │
    │ <─────────────────                                    │
    │ [Nhận Commission]│                                    │
    │                  │                                    │
    │ 4. Trả agent     │                                    │
    │ ───────────────────────────────────────────────────>
```

---

## 💰 Cash Flow Timeline

### Day 1-9: Tạo Đơn & Fulfillment

```typescript
// User chi ads
User balance: 100M → 90M (chi 10M ads)

// Order được tạo
Order {
  orderId: 'ORD001',
  cod: 1_000_000,
  cogs: 700_000,
  netProfit: 300_000,
  orderStatus: 'Mới tạo',
  supplierId: 'SUP001',
  agentId: 'AGENT001' // Nếu là đơn của agent
}

// Supplier ship và thu COD
Order.orderStatus → 'Đang giao' → 'Giao thành công'
Supplier thu được: 1_000_000 đ từ khách hàng
Supplier GIỮ TIỀN (chưa trả user)

User balance: VẪN 90M (chưa nhận tiền từ supplier)
```

### Day 10: Reconciliation Cycle

```typescript
// BATCH reconciliation: Tất cả đơn "Giao thành công" đến ngày hôm nay

// 1. Supplier tính toán
const ordersToReconcile = await db.ordertest2s.find({
  orderStatus: 'Giao thành công',
  reconciled: { $ne: true },
  createdAt: { $lte: new Date('2026-01-10') }
});

// Giả sử: 100 orders, mỗi order netProfit = 300k
const totalCommission = 100 * 300_000 = 30_000_000; // 30M

// 2. Supplier trả user
// (Trong thực tế: chuyển khoản hoặc ghi nhận thanh toán)
await db.ordertest2s.updateMany(
  { _id: { $in: orderIds } },
  { 
    $set: { 
      reconciled: true,
      reconciledAt: new Date(),
      codCollectedBySupplier: /* actual COD */
    }
  }
);

// 3. User nhận tiền
User balance: 90M → 120M (+30M từ supplier)

// 4. Track trong supplier-payable (OPTIONAL - để monitoring)
// Collection này GHI NHẬN supplier ĐÃ TRẢ, không phải user NỢ!
```

### Day 11: Trả Agent Commission

```typescript
// Giả sử: 50 orders trong 100 orders là của agent
// Agent commission rate: 20% of netProfit

const agentOrders = ordersToReconcile.filter(o => o.agentId === 'AGENT001');
const agentProfit = 50 * 300_000 = 15_000_000; // 15M
const agentCommission = 15_000_000 * 0.20 = 3_000_000; // 3M

// User trả agent
await db.agentstatements.updateOne(
  { agentId: 'AGENT001', status: 'open' },
  { 
    $inc: { 
      statementPaymentTotal: 3_000_000,
    },
    $set: {
      closingBalance: closingBalance - 3_000_000
    }
  }
);

User balance: 120M → 117M (-3M trả agent)
```

### Day 12: Phân Bổ Vào Quỹ

```typescript
// Profit sau khi trả agent
const netProfitAfterAgent = 30_000_000 - 3_000_000 = 27_000_000;

// Phân bổ theo policy 45-25-20-10
const allocation = {
  reinvestment: 27M * 0.45 = 12.15M,    // Quỹ tái đầu tư (ads)
  safetyReserve: 27M * 0.25 = 6.75M,    // Quỹ dự phòng
  personalIncome: 27M * 0.20 = 5.4M,    // Thu nhập cá nhân
  longTermAsset: 27M * 0.10 = 2.7M      // Đầu tư dài hạn
};

// Update capital allocation
await db.capital_allocation_snapshots.create({
  date: new Date(),
  totalNetProfit: 27_000_000,
  reinvestmentAmount: 12_150_000,
  safetyReserveAmount: 6_750_000,
  personalIncomeAmount: 5_400_000,
  longTermAssetAmount: 2_700_000
});

User balance breakdown:
├─ Operating cash: 117M
├─ Reinvestment fund: 12.15M
├─ Safety reserve: 6.75M
└─ Available to withdraw: 5.4M (personal income)
```

---

## 📊 Database Collections Explained

### 1. SupplierPayable (supplier-payable)

**⚠️ TÊN GÂY HIỂU NHẦM!**
- ❌ **Không phải**: User NỢ supplier
- ✅ **Đúng là**: Supplier NỢ user (tracking receivables FROM supplier)

```typescript
{
  supplierId: ObjectId('SUP001'),
  orderId: ObjectId('ORD001'),
  status: 'unpaid',  // Supplier CHƯA TRẢ user
  totalAmount: 300_000,  // Supplier NỢ user 300k
  amountPaid: 0,  // Supplier đã trả: 0
  balance: 300_000,  // Supplier còn nợ: 300k
  dueDate: new Date('2026-01-10')  // Ngày reconcile kế tiếp
}

// Sau reconcile day 10:
{
  status: 'paid',  // Supplier ĐÃ TRẢ
  amountPaid: 300_000,
  balance: 0
}
```

**Mục đích**: 
- Monitoring: Supplier nào chậm trả?
- Analytics: Bao nhiêu tiền đang pending reconciliation?
- Alert: Supplier quá 15 ngày chưa trả → Warning!

### 2. AgentStatement (agent-receivable)

**⚠️ COLLECTION NAME MISLEADING!**
- ✅ **Đúng**: User NỢ agent (user must PAY agent)

```typescript
{
  agentId: ObjectId('AGENT001'),
  periodFrom: new Date('2026-01-01'),
  periodTo: new Date('2026-01-10'),
  status: 'open',  // Chưa trả xong
  openingBalance: 0,
  periodReceivables: 3_000_000,  // Agent được hưởng 3M
  statementPaymentTotal: 0,  // User chưa trả
  closingBalance: 3_000_000  // User còn nợ 3M
}

// Sau khi user trả:
{
  status: 'closed',
  statementPaymentTotal: 3_000_000,
  closingBalance: 0
}
```

**Mục đích**:
- Tracking: User nợ agent bao nhiêu?
- Payment: Lịch sử thanh toán cho agent
- Reconciliation: Khớp số liệu với agent

### 3. TestOrder2 (ordertest2s)

```typescript
{
  orderId: 'ORD001',
  cod: 1_000_000,
  cogs: 700_000,
  netProfit: 300_000,
  orderStatus: 'Giao thành công',
  
  // Fields quan trọng cho reconciliation
  reconciled: false,  // Chưa reconcile
  reconciledAt: null,
  codCollectedBySupplier: 0,  // Supplier chưa trả
  
  // Tracking
  supplierId: ObjectId('SUP001'),
  agentId: ObjectId('AGENT001'),  // Null nếu không có agent
  orderDate: new Date('2026-01-05')
}
```

---

## 🔍 Finance Service Logic

### 1. Conservative Mode (An toàn tuyệt đối)

```typescript
// CHỈ tính tiền ĐÃ NHẬN từ supplier
const realizedProfit = await orderModel.aggregate([
  {
    $match: {
      orderStatus: 'Giao thành công',
      codCollectedBySupplier: { $gt: 0 },  // ✅ ĐÃ NHẬN TIỀN
      reconciled: true
    }
  },
  { $group: { _id: null, total: { $sum: '$netProfit' } } }
]);

// Cộng vốn đầu
const initialCapital = await getInitialCapital();
const safeAvailableFunds = realizedProfit + initialCapital;

// ✅ 100% AN TOÀN - Không có credit risk
```

### 2. Moderate Mode (Cân bằng tốc độ & an toàn)

```typescript
// Phân loại orders
const breakdown = {
  realizedProfit: 40M,  // Đã reconcile → 100% weight
  pendingProfit: 50M,   // Chưa reconcile → 82% weight (dynamic)
  riskyProfit: 10M      // Đang giao → 35% weight (dynamic)
};

// Dynamic weights dựa trên success rate
const weights = {
  pendingWeight: 0.82,  // 82% orders cuối cùng được reconcile
  riskyWeight: 0.35     // 35% orders đang giao → thành công
};

// Tính discounted funds
const discounted = 
  40M * 1.0 +     // 100% realized
  50M * 0.82 +    // 82% pending
  10M * 0.35;     // 35% risky
  = 40M + 41M + 3.5M = 84.5M

// Cộng vốn đầu
const available = 84.5M + 50M = 134.5M;

// ✅ CÂN BẰNG - Cho phép scale nhưng vẫn safe
```

---

## ⚠️ Common Misconceptions

### ❌ SAI: "User nợ supplier COGS"
```
User → Phải trả supplier 50M COGS
     → Available funds = Profit - 50M
```

**Sự thật**: User KHÔNG nợ supplier COGS!
- Supplier tự bỏ COGS
- Supplier fulfillment
- Supplier thu COD
- Supplier trả user commission

### ❌ SAI: "Supplier-payable là khoản phải trả"
```
totalAmount = 30M → User phải trả supplier 30M
```

**Sự thật**: Supplier phải trả user 30M!
- Collection name misleading
- Thực chất là "receivable" (phải thu)
- Tracking tiền supplier đang giữ chưa trả

### ❌ SAI: "Cần trừ unpaidToSuppliers từ available funds"
```typescript
available = profit - unpaidToSuppliers; // ❌ SAI!
```

**Sự thật**: Dynamic weights đã handle reconciliation timing risk!
- Pending orders → 82% weight
- Đã tính risk chưa reconcile
- Không cần trừ thêm

---

## ✅ Correct Implementation

### Finance Service

```typescript
// ✅ ĐÚNG: Không trừ supplier payables
const safeAvailableFunds = discountedFunds + initialCapital;

// ❌ SAI: Trừ supplier payables
const safeAvailableFunds = discountedFunds - unpaidToSuppliers + initialCapital;
```

### Capital Allocation

```typescript
// ✅ ĐÚNG: Dùng safeAvailableFunds (cash-based)
const fundsData = await financeService.computeRealAvailableFunds('moderate');
const cashAvailable = fundsData.safeAvailableFunds;
const reinvestment = cashAvailable * 0.45;

// ❌ SAI: Dùng totalNetProfit (accrual-based)
const totalProfit = fundsData.totalNetProfit;
const reinvestment = totalProfit * 0.45;
```

---

## 📈 Monitoring & Alerts

### 1. Supplier Credit Risk

```typescript
// Alert: Supplier chậm trả > 15 ngày
const overdue = await supplierPayableModel.find({
  status: { $in: ['unpaid', 'partial'] },
  dueDate: { $lt: new Date(Date.now() - 15 * 86400000) }
});

if (overdue.length > 0) {
  alert(`⚠️ ${overdue.length} suppliers chậm trả > 15 ngày!`);
}
```

### 2. Agent Payment Tracking

```typescript
// Track: User còn nợ agent bao nhiêu?
const agentDebt = await agentStatementModel.aggregate([
  { $match: { status: 'open' } },
  { $group: { _id: null, total: { $sum: '$closingBalance' } } }
]);

console.log(`User đang nợ agents: ${agentDebt[0].total} đ`);
```

### 3. Cash Flow Health

```typescript
// Monitor: Dòng tiền có đủ trả agent không?
const pendingToAgents = await getPendingToAgents();
const currentCash = await getCurrentCash();

if (currentCash < pendingToAgents) {
  alert('🚨 CRITICAL: Không đủ tiền trả agents!');
}
```

---

## 🎯 Summary

| Item | Thực Tế | Collection | Direction |
|------|---------|------------|-----------|
| **Supplier reconcile** | Supplier NỢ user | supplier-payable | User receives (receivable) |
| **Agent commission** | User NỢ agent | agent-statement | User pays (payable) |
| **COGS** | Supplier tự bỏ | N/A | No debt |
| **COD** | Supplier thu | N/A | Supplier holds temporarily |

**Key Takeaway**:
- User KHÔNG nợ supplier COGS
- Supplier giữ tiền, reconcile 10 ngày/lần, trả user
- User nhận tiền → Trả agent → Phân bổ quỹ
- Dynamic weights handle reconciliation timing risk
- Initial capital provides working capital buffer

---

**Last Updated**: January 26, 2026  
**Version**: 1.0
