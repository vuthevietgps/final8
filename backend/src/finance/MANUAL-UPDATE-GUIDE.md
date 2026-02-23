# 🛠️ HƯỚNG DẪN CẬP NHẬT THỦ CÔNG - LOAN INTEGRATION

## 📋 TỔNG QUAN
Do vấn đề encoding UTF-8, bạn cần cập nhật thủ công 3 phần trong file `backend/src/finance/funds.service.ts`

## ✅ TEST KẾT QUẢ
```bash
cd backend
node test-seed-capital-integration.js
```

**Kết quả hiện tại**:
- ✅ LoanContract: 100M vốn vay (còn phải trả 70M)
- ✅ FundingSource: 50M vốn chủ sở hữu
- ✅ Seed Capital = 150M (66.7% vay + 33.3% chủ)
- ✅ Method `getLoanDisbursed()` đã được thêm vào

## 🔧 BƯỚC 1: CẬP NHẬT INTERFACE `FundsOverview`

### Vị trí: Dòng ~133-137
### Tìm:
```typescript
  // Vốn ban đầu (Seed Capital) - NGUỒN, không phải quỹ
  seedCapital: {
    total: number;                // Tổng vốn vay/cá nhân
    allocated: number;            // Đã phân bổ
    remaining: number;            // Còn lại
  };
```

### Thay bằng:
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

---

## 🔧 BƯỚC 2: CẬP NHẬT METHOD `getSeedCapital()`

### Vị trí: Dòng ~373-395
### Tìm TOÀN BỘ method:
```typescript
  /**
   * VỐN BAN ĐẦU (Seed Capital)
   * = Vốn vay + Vốn cá nhân bỏ vào
   */
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

### Thay bằng:
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

**⚠️ LƯU Ý**: Method `getLoanDisbursed()` đã được thêm vào trước đó (dòng ~370)

---

## 🔧 BƯỚC 3: CẬP NHẬT LOG TRONG `computeBankBalance()`

### Vị trí: Dòng ~707-712
### Tìm:
```typescript
    this.logger.log(`💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):`);
    this.logger.log(`  ────────── TIỀN VÀO ──────────`);
    this.logger.log(`  Vốn ban đầu / Tiền vay: ${seedCapital.toLocaleString('vi-VN')}đ`);
    this.logger.log(`  Doanh thu (NCC gửi về): ${totalRevenue.toLocaleString('vi-VN')}đ`);
    this.logger.log(`  → Tổng tiền vào: ${totalCashIn.toLocaleString('vi-VN')}đ`);
```

### Thay bằng:
```typescript
    // Lấy thông tin chi tiết vốn vay
    const loanInfo = await this.getLoanDisbursed();
    
    this.logger.log(`💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):`);
    this.logger.log(`  ────────── TIỀN VÀO ──────────`);
    this.logger.log(`  Vốn ban đầu: ${seedCapital.toLocaleString('vi-VN')}đ`);
    this.logger.log(`    • Vốn vay đã giải ngân: ${loanInfo.disbursed.toLocaleString('vi-VN')}đ`);
    this.logger.log(`    • Vốn chủ sở hữu: ${(seedCapital - loanInfo.disbursed).toLocaleString('vi-VN')}đ`);
    this.logger.log(`  Doanh thu (NCC gửi về): ${totalRevenue.toLocaleString('vi-VN')}đ`);
    this.logger.log(`  → Tổng tiền vào: ${totalCashIn.toLocaleString('vi-VN')}đ`);
```

---

## 🧪 KIỂM TRA SAU KHI CẬP NHẬT

### 1. Restart Backend
```bash
# Stop backend nếu đang chạy (Ctrl+C)
cd backend
npm run start:dev
```

### 2. Test API
```bash
# PowerShell
$response = Invoke-RestMethod -Uri "http://localhost:3000/api/funds/overview" -Method Get
$response.seedCapital
```

**Kỳ vọng output**:
```json
{
  "total": 150000000,
  "loan": 100000000,
  "equity": 50000000,
  "allocated": 0,
  "remaining": 50000000
}
```

### 3. Kiểm tra log backend
Khi gọi `/api/funds/overview`, log phải hiển thị:
```
💰 Bank Balance Calculation (Tiền Trong Ngân Hàng):
  ────────── TIỀN VÀO ──────────
  Vốn ban đầu: 150,000,000đ
    • Vốn vay đã giải ngân: 100,000,000đ
    • Vốn chủ sở hữu: 50,000,000đ
  Doanh thu (NCC gửi về): ...
```

---

## 📊 KIỂM TRA TƯƠNG THÍCH

### API endpoints cần verify:
1. ✅ `GET /api/funds/overview` - Phải có `seedCapital.loan` và `seedCapital.equity`
2. ✅ `GET /finance/available-funds/current` - loanAvailable từ finance.service
3. ✅ `GET /finance/loans` - Danh sách LoanContract

### Tính nhất quán:
- `funds.service.ts` → `getLoanDisbursed().disbursed` = Vốn vay đã giải ngân
- `finance.service.ts` → `getLoanRoomAvailable()` = Vốn vay còn lại (để vay thêm)
- Mối quan hệ: `disbursed - remaining = repaid` (số tiền đã trả)

---

## 🎯 CHECKLIST HOÀN THÀNH

- [ ] **Bước 1**: Cập nhật interface `FundsOverview.seedCapital`
- [ ] **Bước 2**: Thay thế method `getSeedCapital()`
- [ ] **Bước 3**: Cập nhật log trong `computeBankBalance()`
- [ ] **Test 1**: Restart backend không lỗi
- [ ] **Test 2**: API `/api/funds/overview` trả về `seedCapital.loan`
- [ ] **Test 3**: Log hiển thị chi tiết vốn vay vs vốn chủ
- [ ] **Test 4**: Chạy `node test-seed-capital-integration.js` thành công

---

## ❓ XỬ LÝ LỖI

### Lỗi: "Cannot read property 'disbursed' of undefined"
**Nguyên nhân**: Chưa thêm method `getLoanDisbursed()`

**Giải pháp**: Kiểm tra lại xem method `getLoanDisbursed()` đã được thêm vào chưa (dòng ~370)

### Lỗi: "seedCapital.loan is undefined"
**Nguyên nhân**: Interface `FundsOverview` chưa được cập nhật

**Giải pháp**: Thực hiện lại **Bước 1**

### Lỗi: TypeScript compilation failed
**Nguyên nhân**: Interface không khớp với implementation

**Giải pháp**: 
1. Kiểm tra lại `FundsOverview` interface (Bước 1)
2. Kiểm tra return type của `getSeedCapital()` (Bước 2)
3. Run `npm run build` để xem lỗi chi tiết

---

## 📚 TÀI LIỆU THAM KHẢO

- **Loan Schema**: `backend/src/finance/schemas/loan-contract.schema.ts`
- **FundingSource Schema**: `backend/src/finance/schemas/funding-source.schema.ts`
- **Finance Service**: `backend/src/finance/finance.service.ts` (có `getLoanRoomAvailable()`)
- **Test Script**: `backend/test-seed-capital-integration.js`
- **Tài liệu đầy đủ**: `backend/src/finance/LOAN-INTEGRATION-PATCH.md`

---

## 🎉 KẾT QUẢ MONG ĐỢI

Sau khi hoàn thành:
- ✅ Vốn vay được tách rõ khỏi vốn chủ sở hữu
- ✅ Bank Balance tính toán chính xác dựa trên vốn vay + vốn chủ
- ✅ API trả về đầy đủ thông tin `seedCapital.loan` và `seedCapital.equity`
- ✅ Đồng bộ với chức năng `loanAvailable` trong finance.service
- ✅ Log hiển thị chi tiết nguồn vốn
