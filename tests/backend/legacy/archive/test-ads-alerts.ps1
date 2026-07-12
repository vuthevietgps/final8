# Test script for Ads Alerts Real-time Feature
# Run: .\test-ads-alerts.ps1

$baseUrl = "http://localhost:3000"

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "   TEST ADS ALERTS REAL-TIME FEATURE" -ForegroundColor White
Write-Host ("=" * 60) -ForegroundColor Cyan

# Login
Write-Host "`n[1] Logging in..." -ForegroundColor Yellow
$headers = @{ "Content-Type" = "application/json" }
$loginBody = '{"email":"director@test.com","password":"123456"}'
try {
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Headers $headers -Body $loginBody
    $token = $loginRes.access_token
    Write-Host "    [OK] Login successful!" -ForegroundColor Green
} catch {
    Write-Host "    [FAIL] Login failed: $_" -ForegroundColor Red
    exit 1
}

$authHeaders = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }

# Test 1: GET /ads-alerts
Write-Host "`n[2] GET /ads-alerts (initial state)..." -ForegroundColor Yellow
try {
    $alerts = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts" -Method Get -Headers $authHeaders
    Write-Host "    [OK] Success: Total=$($alerts.total), Unread=$($alerts.unread)" -ForegroundColor Green
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

# Test 2: GET /ads-alerts/summary
Write-Host "`n[3] GET /ads-alerts/summary..." -ForegroundColor Yellow
try {
    $summary = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts/summary" -Method Get -Headers $authHeaders
    Write-Host "    [OK] Summary:" -ForegroundColor Green
    Write-Host "       Critical: $($summary.critical)"
    Write-Host "       Warning: $($summary.warning)"
    Write-Host "       Info: $($summary.info)"
    Write-Host "       Success: $($summary.success)"
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

# Test 3: POST /ads-alerts/check (trigger manual check)
Write-Host "`n[4] POST /ads-alerts/check (trigger alert generation)..." -ForegroundColor Yellow
try {
    $check = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts/check" -Method Post -Headers $authHeaders
    Write-Host "    [OK] $($check.message)" -ForegroundColor Green
    Write-Host "       Alerts created: $($check.alertsCreated)" -ForegroundColor Cyan
    Write-Host "       Ad groups checked: $($check.adGroupsChecked)" -ForegroundColor Cyan
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

# Test 4: GET /ads-alerts (after check)
Write-Host "`n[5] GET /ads-alerts (after check)..." -ForegroundColor Yellow
try {
    $alertsAfter = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts" -Method Get -Headers $authHeaders
    Write-Host "    [OK] Total=$($alertsAfter.total), Unread=$($alertsAfter.unread)" -ForegroundColor Green
    
    if ($alertsAfter.alerts.Count -gt 0) {
        Write-Host "`n    Alerts List:" -ForegroundColor Cyan
        $alertsAfter.alerts | Select-Object -First 5 | ForEach-Object {
            Write-Host "       [$($_.type)] $($_.title)"
            Write-Host "          $($_.message)" -ForegroundColor Gray
        }
    } else {
        Write-Host "    No alerts (no ad groups with spend data)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

# Test 5: Mark all as read
Write-Host "`n[6] POST /ads-alerts/mark-all-read..." -ForegroundColor Yellow
try {
    $markRead = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts/mark-all-read" -Method Post -Headers $authHeaders
    Write-Host "    [OK] $($markRead.message)" -ForegroundColor Green
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

# Test 6: Verify unread count
Write-Host "`n[7] GET /ads-alerts/summary (verify mark as read)..." -ForegroundColor Yellow
try {
    $finalSummary = Invoke-RestMethod -Uri "$baseUrl/api/ads-alerts/summary" -Method Get -Headers $authHeaders
    Write-Host "    [OK] Unread count: $($finalSummary.unread)" -ForegroundColor Green
} catch {
    Write-Host "    [FAIL] Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host "   ALL TESTS COMPLETED" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Cyan
Write-Host ""
Write-Host "UI Location: Notification bell in sidebar header"
Write-Host "Only visible for users with 'ad-groups' permission"
Write-Host "(Director, Manager roles)"
Write-Host ""
