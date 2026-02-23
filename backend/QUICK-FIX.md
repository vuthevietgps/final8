# HƯỚNG DẪN CẬP NHẬT NHANH

## ✅ ĐÃ HOÀN THÀNH
- ✅ Xóa log phân tách vốn vay/vốn chủ trong `computeBankBalance()`
- ✅ Log hiện tại: "Vốn ban đầu (Loan + Funding): XXXđ"

## ⏳ CÒN LẠI: Cập nhật method getSeedCapital()

### Mở file:
`backend/src/finance/funds.service.ts`

### Tìm dòng ~373 - method `getSeedCapital()`:
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

### THAY BẰNG code này:
```typescript
private async getSeedCapital() {
  // 1. Lấy vốn từ LoanContract (khoản vay)
  const loanResult = await this.loanModel.aggregate([
    { $match: { status: { $in: ['active', 'draft'] } } },
    { $group: { _id: null, total: { $sum: '$principal' } } }
  ]);
  const loanTotal = loanResult?.[0]?.total || 0;
  
  // 2. Lấy vốn từ FundingSource
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

  const fundingTotal = fundingSources?.[0]?.total || 0;
  const allocated = fundingSources?.[0]?.allocated || 0;

  return {
    total: loanTotal + fundingTotal,
    allocated,
    remaining: loanTotal + fundingTotal - allocated
  };
}
```

## KIỂM TRA
```bash
# 1. Build backend
npm run build

# 2. Restart backend
npm run start:dev

# 3. Test
node test-seed-capital-integration.js
```

**Kỳ vọng**: Seed Capital total = 150,000,000đ (100M loan + 50M funding)
