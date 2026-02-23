# Test Agent Payment UI/UX Elements
# Chạy script này để verify tất cả elements đã có trong UI

Write-Host "🔍 Kiểm tra UI Elements trong Agent Payment Component..." -ForegroundColor Cyan
Write-Host ""

$htmlFile = "d:\code\final8\final8-version14.0\frontend\src\app\features\payment-management\agent-payment.component.html"
$tsFile = "d:\code\final8\final8-version14.0\frontend\src\app\features\payment-management\agent-payment.component.ts"
$cssFile = "d:\code\final8\final8-version14.0\frontend\src\app\features\payment-management\agent-payment.component.css"

# Check HTML elements
Write-Host "📄 HTML Template:" -ForegroundColor Yellow

$checks = @(
    @{ Name = "Top 10 Agent Breakdown"; Pattern = "Theo Đại Lý \(Top" },
    @{ Name = "Selected Summary Bar"; Pattern = "selected-summary-bar" },
    @{ Name = "Tabs Navigation"; Pattern = "tabs-container" },
    @{ Name = "Quick Date Filters"; Pattern = "quick-filters" },
    @{ Name = "Aging Filter Select"; Pattern = "Lọc Aging" },
    @{ Name = "Sort Dropdown"; Pattern = "sort-select" },
    @{ Name = "Banner >5M Warning"; Pattern = "Cảnh báo: Vượt Ngưỡng" },
    @{ Name = "Modal Checkbox >5M"; Pattern = "confirmOverThreshold" },
    @{ Name = "Debt Orders Section"; Pattern = "ĐL Nợ Công Ty" },
    @{ Name = "Export Debt Report"; Pattern = "exportDebtReport" },
    @{ Name = "Date VN Format Input"; Pattern = "dd/mm/yyyy" },
    @{ Name = "Clickable Cards"; Pattern = "filterByCard" }
)

foreach ($check in $checks) {
    $found = Select-String -Path $htmlFile -Pattern $check.Pattern -Quiet
    if ($found) {
        Write-Host "  ✅ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "📝 TypeScript Component:" -ForegroundColor Yellow

$tsChecks = @(
    @{ Name = "activeTab property"; Pattern = "activeTab.*payable.*debt" },
    @{ Name = "payableOnlyOrders getter"; Pattern = "get payableOnlyOrders" },
    @{ Name = "debtOrders getter"; Pattern = "get debtOrders" },
    @{ Name = "filterByCard method"; Pattern = "filterByCard\(cardType" },
    @{ Name = "setQuickDateFilter method"; Pattern = "setQuickDateFilter" },
    @{ Name = "formatDateVN method"; Pattern = "formatDateVN" },
    @{ Name = "parseDateInput method"; Pattern = "parseDateInput" },
    @{ Name = "resetFilters method"; Pattern = "resetFilters\(\)" },
    @{ Name = "sortOrders method"; Pattern = "sortOrders\(\)" },
    @{ Name = "selectAllPayable method"; Pattern = "selectAllPayable" },
    @{ Name = "deselectAll method"; Pattern = "deselectAll\(\)" },
    @{ Name = "exportDebtReport method"; Pattern = "exportDebtReport" },
    @{ Name = "periodLabel getter"; Pattern = "get periodLabel" },
    @{ Name = "totalDebtAmount getter"; Pattern = "get totalDebtAmount" }
)

foreach ($check in $tsChecks) {
    $found = Select-String -Path $tsFile -Pattern $check.Pattern -Quiet
    if ($found) {
        Write-Host "  ✅ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎨 CSS Styles:" -ForegroundColor Yellow

$cssChecks = @(
    @{ Name = "Clickable card styles"; Pattern = "\.clickable" },
    @{ Name = "Selected summary bar"; Pattern = "\.selected-summary-bar" },
    @{ Name = "Tabs container"; Pattern = "\.tabs-container" },
    @{ Name = "Quick filters"; Pattern = "\.quick-filters" },
    @{ Name = "Amount box styles"; Pattern = "\.amount-box" },
    @{ Name = "Threshold box animation"; Pattern = "\.threshold-box" },
    @{ Name = "Info box"; Pattern = "\.info-box" },
    @{ Name = "Sort select"; Pattern = "\.sort-select" }
)

foreach ($check in $cssChecks) {
    $found = Select-String -Path $cssFile -Pattern $check.Pattern -Quiet
    if ($found) {
        Write-Host "  ✅ $($check.Name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.Name)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🔧 TypeScript Compilation Check:" -ForegroundColor Yellow

Push-Location "d:\code\final8\final8-version14.0\frontend"
$compileResult = npx tsc --noEmit --skipLibCheck 2>&1
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -eq 0) {
    Write-Host "  ✅ TypeScript compilation successful (no errors)" -ForegroundColor Green
} else {
    Write-Host "  ❌ TypeScript compilation failed" -ForegroundColor Red
    Write-Host $compileResult
}

Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
$htmlPass = ($checks | Where-Object { Select-String -Path $htmlFile -Pattern $_.Pattern -Quiet }).Count
$tsPass = ($tsChecks | Where-Object { Select-String -Path $tsFile -Pattern $_.Pattern -Quiet }).Count
$cssPass = ($cssChecks | Where-Object { Select-String -Path $cssFile -Pattern $_.Pattern -Quiet }).Count

Write-Host "  HTML: $htmlPass/$($checks.Count) elements found"
Write-Host "  TypeScript: $tsPass/$($tsChecks.Count) methods/properties found"
Write-Host "  CSS: $cssPass/$($cssChecks.Count) styles found"

if ($htmlPass -eq $checks.Count -and $tsPass -eq $tsChecks.Count -and $cssPass -eq $cssChecks.Count -and $exitCode -eq 0) {
    Write-Host ""
    Write-Host "✅ ALL CHECKS PASSED! UI/UX upgrade is complete." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Restart frontend dev server (npm start)" -ForegroundColor White
    Write-Host "  2. Hard reload browser (Ctrl+Shift+R)" -ForegroundColor White
    Write-Host "  3. Navigate to http://localhost:4200/payment/agent" -ForegroundColor White
    Write-Host "  4. Test all features listed in AGENT-PAYMENT-UX-UPGRADE.md" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "⚠️ Some checks failed. Review the output above." -ForegroundColor Yellow
}

Write-Host ""
