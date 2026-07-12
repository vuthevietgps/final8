# Test Financial Control API
Write-Host "Testing Financial Control API..." -ForegroundColor Cyan

# Test Dashboard endpoint
Write-Host "`n1. Testing /api/financial-control/dashboard..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/financial-control/dashboard" -Method Get
    Write-Host "✅ Success!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

# Test Full endpoint
Write-Host "`n2. Testing /api/financial-control/full..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/financial-control/full" -Method Get
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Bank Balance: $($response.bankBalance | Format-Number)"
    Write-Host "Free Cash: $($response.freeCash | Format-Number)"
    Write-Host "Monthly Burn: $($response.monthlyBurn | Format-Number)"
    Write-Host "Runway: $($response.runwayMonths) months"
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

# Test Forecast endpoint
Write-Host "`n3. Testing /api/financial-control/forecast..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/financial-control/forecast" -Method Get
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Low Point: $($response.lowPoint | Format-Number) on Day $($response.lowPointDay)"
    Write-Host "Cash Crunch: $($response.isCashCrunch)"
    Write-Host "Survival Risk: $($response.isSurvivalRisk)"
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host "`nTest completed!" -ForegroundColor Cyan
