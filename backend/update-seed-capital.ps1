# Script cập nhật getSeedCapital() để lấy vốn từ cả LoanContract và FundingSource

$filePath = "src\finance\funds.service.ts"

Write-Host "🔧 Đang cập nhật getSeedCapital() trong $filePath..." -ForegroundColor Cyan

# Đọc file với UTF-8
$content = Get-Content $filePath -Raw -Encoding UTF8

# Tìm và thay thế method getSeedCapital()
$oldMethod = @'
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
'@

$newMethod = @'
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
'@

if ($content -match [regex]::Escape($oldMethod)) {
    Write-Host "✅ Tìm thấy method getSeedCapital() cũ" -ForegroundColor Green
    $content = $content -replace [regex]::Escape($oldMethod), $newMethod
    Set-Content $filePath -Value $content -Encoding UTF8 -NoNewline
    Write-Host "✅ Đã cập nhật thành công!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Không tìm thấy method cũ. Đang thử cách khác..." -ForegroundColor Yellow
    
    # Thử tìm với regex linh hoạt hơn
    $pattern = 'private async getSeedCapital\(\) \{[^}]+\}'
    if ($content -match $pattern) {
        Write-Host "✅ Tìm thấy method với regex" -ForegroundColor Green
        # Manual replacement needed
        Write-Host "❌ Cần cập nhật thủ công. Xem hướng dẫn trong MANUAL-UPDATE-GUIDE.md" -ForegroundColor Red
    } else {
        Write-Host "❌ Không tìm thấy method getSeedCapital()" -ForegroundColor Red
    }
}

Write-Host "`n📋 Kiểm tra kết quả:" -ForegroundColor Cyan
Write-Host "1. Mở file: $filePath" -ForegroundColor White
Write-Host "2. Tìm method: getSeedCapital()" -ForegroundColor White
Write-Host "3. Xác nhận có 'loanTotal' và 'fundingTotal'" -ForegroundColor White
Write-Host "4. Restart backend: npm run start:dev" -ForegroundColor White
