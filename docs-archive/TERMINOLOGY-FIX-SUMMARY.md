# Quick Reference: Terminology Fix

## ⚠️ CRITICAL: Collection Names Are Misleading!

### Before Understanding (Confusing):
```
supplier-payable → User nợ supplier? ❌ SAI!
agent-receivable → User phải thu từ agent? ❌ SAI!
```

### After Clarification (Correct):
```
supplier-payable → Supplier nợ user ✅ (should be "supplier-receivable")
agent-receivable → User nợ agent ✅ (should be "agent-payable")
```

---

## 🔄 Actual Cash Flow

```
1. User chi ads: 10M
   ├─ Balance: 100M → 90M

2. Order created → Supplier fulfills
   ├─ User: KHÔNG chi gì
   ├─ Supplier: Tự bỏ COGS
   ├─ Balance: 90M (unchanged)

3. Supplier thu COD: 15M
   ├─ Supplier GIỮ TIỀN
   ├─ Balance: 90M (unchanged)

4. Day 10 - Reconcile:
   ├─ Supplier trả user: 7M (COD - COGS)
   ├─ Balance: 90M → 97M ✅

5. User trả agent: 2M
   ├─ Balance: 97M → 95M

6. Phân bổ quỹ: 5M còn lại
   ├─ Reinvest: 2.25M
   ├─ Reserve: 1.25M
   ├─ Income: 1M
   └─ Asset: 0.5M
```

---

## 📊 Collections Purpose

### SupplierPayable
**Tracks**: Money supplier OWES user (pending reconciliation)
```typescript
{
  totalAmount: 7_000_000,    // Supplier nợ user 7M
  amountPaid: 0,             // Chưa trả
  balance: 7_000_000,        // Còn nợ 7M
  status: 'unpaid'           // Chưa reconcile
}
```

### AgentStatement
**Tracks**: Money user OWES agent
```typescript
{
  periodReceivables: 2_000_000,  // User nợ agent 2M
  statementPaymentTotal: 0,      // Chưa trả
  closingBalance: 2_000_000,     // Còn nợ 2M
  status: 'open'                 // Chưa thanh toán
}
```

---

## 🎯 Finance Logic (Correct)

### Conservative Mode
```typescript
// CHỈ tính tiền ĐÃ NHẬN
const realized = orders.filter(o => 
  o.codCollectedBySupplier > 0  // ✅ Supplier đã trả
);
const available = sum(realized.netProfit) + initialCapital;
```

### Moderate Mode
```typescript
// Dynamic weights handle timing risk
const available = 
  realized * 1.0 +      // 100% đã nhận
  pending * 0.82 +      // 82% sẽ nhận (dynamic)
  risky * 0.35 +        // 35% sẽ nhận (dynamic)
  initialCapital;       // + Vốn đầu

// ❌ KHÔNG TRỪ supplier payables!
// Dynamic weights ĐÃ xử lý reconciliation timing
```

---

## ✅ Summary

| What | Who Owes | Collection | Type |
|------|----------|------------|------|
| Reconcile payment | Supplier → User | supplier-payable | Receivable ✅ |
| Agent commission | User → Agent | agent-statement | Payable ✅ |
| COGS | No debt | N/A | Supplier bears |

**Remember**: 
- Supplier fulfills + collects COD → Pays user later
- User receives commission → Pays agent → Allocates to funds
- No COGS debt pressure on user!
