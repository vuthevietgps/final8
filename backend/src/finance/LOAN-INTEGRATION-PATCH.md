# LOAN INTEGRATION PATCH - Tích hợp Vốn Vay với Bank Balance

## 🎯 MỤC TIÊU
Đồng bộ hóa chức năng khoản vay (Loan) với số dư tài khoản ngân hàng (Bank Balance) để:
1. Phân tách rõ **Vốn vay** vs **Vốn chủ sở hữu**
2. Tính toán Bank Balance chính xác dựa trên vốn vay đã giải ngân
3. Đồng bộ với `loanAvailable` trong finance.service.ts

## 📊 PHÂN TÍCH HIỆN TRẠNG

### Vấn đề 1: getSeedCapital() không phân biệt Vốn vay vs Vốn chủ
**File**: `backend/src/finance/funds.service.ts` (dòng 373-395)

**Code hiện tại**:
```typescript
private async getSeedCapital() {
  // Lấy từ funding sources
  const fundingSources = await this.fundingSourceModel.aggregate([
    { $match: { status: 'active' } },
    { 
      $group: { 
        _id: null, 
        total: { $sum: '$principal' },
        allocated: { $sum: { $ifNull: ['$allocatedAmount', 0] } }
      } 
    }
  ]);
  
  const total = fundingSources?.[0]?.total || 0;
  const allocated = fundingSources?.[0]?.allocated || 0;
  
  return {
    total,
    allocated,
    remaining: total - allocated
  };
}
```

**Vấn đề**: 
- Chỉ lấy từ `FundingSource`, không lấy từ `LoanContract`
- Không phân biệt rõ vốn vay (loan) và vốn chủ sở hữu (equity)

### Vấn đề 2: Interface FundsOverview.seedCapital thiếu thông tin
**File**: `backend/src/finance/funds.service.ts` (dòng 133-137)

**Code hiện tại**:
```typescript
seedCapital: {
  total: number;                // Tổng vốn vay/cá nhân
  allocated: number;            // Đã phân bổ
  remaining: number;            // Còn lại
};
```

**Vấn đề**: Thiếu `loan` và `equity` để phân tách rõ nguồn vốn

### Vấn đề 3: computeBankBalance() không hiển thị chi tiết vốn vay
**File**: `backend/src/finance/funds.service.ts` (dòng 707-713)

**Code hiện tại**:
```typescript
this.logger.log(`💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):`);
this.logger.log(`  ────────── TIỀN VÀO ──────────`);
this.logger.log(`  Vốn ban đầu / Tiền vay: ${seedCapital.toLocaleString('vi-VN')}đ`);
this.logger.log(`  Doanh thu (NCC gửi về): ${totalRevenue.toLocaleString('vi-VN')}đ`);
```

**Vấn đề**: Không phân tách rõ vốn vay vs vốn chủ trong log

## ✅ GIẢI PHÁP

### Bước 1: Thêm method getLoanDisbursed()
**Vị trí**: Thêm TRƯỚC method `getSeedCapital()` trong `funds.service.ts`

```typescript
/**
 * VỐN VAY ĐÃ GIẢI NGÂN (Loan Disbursed)
 * = Tổng tiền vay từ LoanContract (status active/draft)
 * Đây là số tiền THỰC SỰ đã vào tài khoản ngân hàng từ khoản vay
 */
private async getLoanDisbursed() {
  const loanResult = await this.loanModel.aggregate([
    { $match: { status: { $in: ['active', 'draft'] } } },
    { 
      $group: { 
        _id: null, 
        totalLoan: { $sum: '$principal' },
        totalRemaining: { $sum: { $ifNull: ['$principalRemaining', '$principal'] } }
      } 
    }
  ]);
  
  const totalLoan = loanResult?.[0]?.totalLoan || 0;
  const totalRemaining = loanResult?.[0]?.totalRemaining || 0;
  
  return {
    disbursed: totalLoan,              // Tổng vốn vay đã giải ngân
    remaining: totalRemaining,          // Còn phải trả
    repaid: totalLoan - totalRemaining  // Đã trả
  };
}
```

### Bước 2: Cập nhật getSeedCapital()
**Thay thế** method `getSeedCapital()` trong `funds.service.ts`

```typescript
/**
 * VỐN BAN ĐẦU (Seed Capital)
 * = Vốn vay (từ LoanContract) + Vốn chủ sở hữu (từ FundingSource)
 */
private async getSeedCapital() {
  // 1. Lấy vốn vay từ LoanContract
  const loan = await this.getLoanDisbursed();
  
  // 2. Lấy vốn chủ sở hữu từ FundingSource (không phải loan)
  const fundingSources = await this.fundingSourceModel.aggregate([
    { $match: { status: 'active', type: { $ne: 'loan' } } }, // Loại trừ type='loan'
    { 
      $group: { 
        _id: null, 
        total: { $sum: '$principal' },
        allocated: { $sum: { $ifNull: ['$allocatedAmount', 0] } }
      } 
    }
  ]);
  
  const equity = fundingSources?.[0]?.total || 0;
  const equityAllocated = fundingSources?.[0]?.allocated || 0;
  
  return {
    total: loan.disbursed + equity,     // Tổng vốn ban đầu = Vốn vay + Vốn chủ
    loan: loan.disbursed,               // Vốn vay đã giải ngân
    equity: equity,                     // Vốn chủ sở hữu
    allocated: equityAllocated,         // Vốn đã phân bổ (chỉ tính equity)
    remaining: equity - equityAllocated // Vốn chưa phân bổ (chỉ tính equity)
  };
}
```

### Bước 3: Cập nhật Interface FundsOverview
**Thay thế** interface `FundsOverview.seedCapital` (dòng 133-137)

```typescript
// Vốn ban đầu (Seed Capital) - NGUỒN, không phải quỹ
seedCapital: {
  total: number;                // Tổng vốn = Vốn vay + Vốn chủ
  loan: number;                 // Vốn vay đã giải ngân
  equity: number;               // Vốn chủ sở hữu
  allocated: number;            // Đã phân bổ
  remaining: number;            // Còn lại
};
```

### Bước 4: Cập nhật log trong computeBankBalance()
**Thay thế** phần log (dòng 707-712)

```typescript
this.logger.log(`💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):`);
this.logger.log(`  ────────── TIỀN VÀO ──────────`);
this.logger.log(`  Vốn ban đầu: ${seedCapital.toLocaleString('vi-VN')}đ`);

// Lấy thông tin chi tiết vốn vay
const loanInfo = await this.getLoanDisbursed();
this.logger.log(`    • Vốn vay đã giải ngân: ${loanInfo.disbursed.toLocaleString('vi-VN')}đ`);
this.logger.log(`    • Vốn chủ sở hữu: ${(seedCapital - loanInfo.disbursed).toLocaleString('vi-VN')}đ`);
this.logger.log(`  Doanh thu (NCC gửi về): ${totalRevenue.toLocaleString('vi-VN')}đ`);
this.logger.log(`  → Tổng tiền vào: ${totalCashIn.toLocaleString('vi-VN')}đ`);
```

## 🧪 TEST & VERIFY

### Test 1: Kiểm tra getSeedCapital()
```bash
# Tạo file test
node backend/test-seed-capital.js
```

### Test 2: Kiểm tra computeFundsOverview()
```bash
curl http://localhost:3000/api/funds/overview
```

**Kỳ vọng**: Response có `seedCapital.loan` và `seedCapital.equity`

### Test 3: Kiểm tra Bank Balance log
Xem log backend khi gọi `/api/funds/overview`:
```
💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):
  ────────── TIỀN VÀO ──────────
  Vốn ban đầu: 100,000,000đ
    • Vốn vay đã giải ngân: 70,000,000đ
    • Vốn chủ sở hữu: 30,000,000đ
  Doanh thu (NCC gửi về): 50,000,000đ
  → Tổng tiền vào: 150,000,000đ
```

## 📝 IMPLEMENTATION STATUS

- ✅ Method `getLoanDisbursed()` đã thêm vào `funds.service.ts`
- ⏳ Method `getSeedCapital()` cần thay thế thủ công (do encoding issue)
- ⏳ Interface `FundsOverview.seedCapital` cần cập nhật thủ công
- ⏳ Log trong `computeBankBalance()` cần cập nhật thủ công

## 🔧 HƯỚNG DẪN THỰC HIỆN THỦ CÔNG

Do vấn đề encoding UTF-8 trong file, bạn cần:

1. Mở file `backend/src/finance/funds.service.ts`
2. Tìm method `getSeedCapital()` (dòng ~373)
3. Thay thế toàn bộ method bằng code trong **Bước 2**
4. Tìm interface `FundsOverview` (dòng ~133)
5. Cập nhật `seedCapital` theo **Bước 3**
6. Tìm `computeBankBalance()` (dòng ~707)
7. Cập nhật log theo **Bước 4**
8. Save và restart backend

## 📚 TÀI LIỆU LIÊN QUAN

- Schema: `backend/src/finance/schemas/loan-contract.schema.ts`
- Service: `backend/src/finance/finance.service.ts` (có `getLoanRoomAvailable()`)
- Controller: `backend/src/finance/finance.controller.ts`
