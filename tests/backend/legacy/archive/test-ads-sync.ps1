# =============================================
# TEST ADS SYNC ENDPOINTS
# Kiểm tra đồng bộ chi phí từ các nền tảng quảng cáo
# =============================================

$baseUrl = "http://localhost:3000/api"

# Đăng nhập
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "DANG NHAP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$loginBody = @{
    email = "director@test.com"
    password = "123456"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.accessToken
    Write-Host "  [PASS] Dang nhap thanh cong!" -ForegroundColor Green
} catch {
    Write-Host "  [FAIL] Loi dang nhap: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

# =============================================
# TEST 1: FACEBOOK SYNC
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "1. FACEBOOK ADS SYNC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "[1.1] Sync Facebook Ads cho ngay $yesterday"
try {
    $fbResult = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/fetch/facebook?date=$yesterday" -Method Post -Headers $headers
    Write-Host "  [PASS] Facebook sync completed" -ForegroundColor Green
    Write-Host "  [INFO] Updated: $($fbResult.Count) records" -ForegroundColor Yellow
    foreach ($r in $fbResult) {
        Write-Host "    - Date: $($r.date), Updated: $($r.updated) ad groups" -ForegroundColor Gray
    }
} catch {
    $err = $_.Exception.Message
    if ($err -match "Missing FB_ADS_ACCESS_TOKEN") {
        Write-Host "  [WARN] Chua cau hinh FB_ADS_ACCESS_TOKEN" -ForegroundColor Yellow
        Write-Host "  [INFO] Xem huong dan: docs/ADS-API-SETUP-GUIDE.md" -ForegroundColor Gray
    } else {
        Write-Host "  [FAIL] Loi: $err" -ForegroundColor Red
    }
}

# =============================================
# TEST 2: GOOGLE ADS SYNC
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "2. GOOGLE ADS SYNC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "[2.1] Sync Google Ads cho ngay $yesterday"
try {
    $ggResult = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/fetch/google?date=$yesterday" -Method Post -Headers $headers
    Write-Host "  [PASS] Google Ads sync completed" -ForegroundColor Green
    Write-Host "  [INFO] Updated: $($ggResult.Count) records" -ForegroundColor Yellow
    foreach ($r in $ggResult) {
        Write-Host "    - Date: $($r.date), Updated: $($r.updated) ad groups, Accounts: $($r.accounts)" -ForegroundColor Gray
    }
} catch {
    $err = $_.Exception.Message
    if ($err -match "GOOGLE_ADS") {
        Write-Host "  [WARN] Chua cau hinh GOOGLE_ADS credentials" -ForegroundColor Yellow
        Write-Host "  [INFO] Can: GOOGLE_ADS_DEVELOPER_TOKEN, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN" -ForegroundColor Gray
        Write-Host "  [INFO] Xem huong dan: docs/ADS-API-SETUP-GUIDE.md" -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] Result: $ggResult" -ForegroundColor Gray
    }
}

# =============================================
# TEST 3: TIKTOK ADS SYNC
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "3. TIKTOK ADS SYNC" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "[3.1] Sync TikTok Ads cho ngay $yesterday"
try {
    $tkResult = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/fetch/tiktok?date=$yesterday" -Method Post -Headers $headers
    Write-Host "  [PASS] TikTok Ads sync completed" -ForegroundColor Green
    Write-Host "  [INFO] Updated: $($tkResult.Count) records" -ForegroundColor Yellow
    foreach ($r in $tkResult) {
        Write-Host "    - Date: $($r.date), Updated: $($r.updated) ad groups, Advertisers: $($r.advertisers)" -ForegroundColor Gray
    }
} catch {
    $err = $_.Exception.Message
    if ($err -match "TIKTOK") {
        Write-Host "  [WARN] Chua cau hinh TIKTOK_ACCESS_TOKEN" -ForegroundColor Yellow
        Write-Host "  [INFO] Xem huong dan: docs/ADS-API-SETUP-GUIDE.md" -ForegroundColor Gray
    } else {
        Write-Host "  [INFO] Result: $tkResult" -ForegroundColor Gray
    }
}

# =============================================
# TEST 4: KIEM TRA AD ACCOUNTS
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "4. KIEM TRA AD ACCOUNTS DA TAO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

try {
    $accounts = Invoke-RestMethod -Uri "$baseUrl/ad-accounts" -Method Get -Headers $headers
    Write-Host "  [PASS] Tong so tai khoan: $($accounts.Count)" -ForegroundColor Green
    
    $fbAccounts = $accounts | Where-Object { $_.accountType -eq "facebook" }
    $ggAccounts = $accounts | Where-Object { $_.accountType -eq "google" }
    $tkAccounts = $accounts | Where-Object { $_.accountType -eq "tiktok" }
    
    Write-Host "`n  Facebook Accounts: $($fbAccounts.Count)" -ForegroundColor Yellow
    foreach ($acc in $fbAccounts) {
        $status = if ($acc.isActive) { "Active" } else { "Inactive" }
        Write-Host "    - $($acc.name) ($($acc.accountId)) - $status" -ForegroundColor Gray
    }
    
    Write-Host "`n  Google Accounts: $($ggAccounts.Count)" -ForegroundColor Yellow
    foreach ($acc in $ggAccounts) {
        $status = if ($acc.isActive) { "Active" } else { "Inactive" }
        Write-Host "    - $($acc.name) ($($acc.accountId)) - $status" -ForegroundColor Gray
    }
    
    Write-Host "`n  TikTok Accounts: $($tkAccounts.Count)" -ForegroundColor Yellow
    foreach ($acc in $tkAccounts) {
        $status = if ($acc.isActive) { "Active" } else { "Inactive" }
        Write-Host "    - $($acc.name) ($($acc.accountId)) - $status" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "  [FAIL] Loi: $_" -ForegroundColor Red
}

# =============================================
# TEST 5: KIEM TRA API TOKENS
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "5. KIEM TRA API TOKENS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

try {
    $tokens = Invoke-RestMethod -Uri "$baseUrl/api-tokens" -Method Get -Headers $headers
    Write-Host "  [PASS] Tong so tokens: $($tokens.Count)" -ForegroundColor Green
    
    $fbTokens = $tokens | Where-Object { $_.provider -eq "facebook" }
    $ggTokens = $tokens | Where-Object { $_.provider -eq "google" }
    $tkTokens = $tokens | Where-Object { $_.provider -eq "tiktok" }
    
    Write-Host "`n  Facebook Tokens: $($fbTokens.Count)" -ForegroundColor Yellow
    foreach ($t in $fbTokens) {
        $status = $t.status
        $check = $t.lastCheckStatus
        Write-Host "    - $($t.name): $status (Check: $check)" -ForegroundColor Gray
    }
    
    Write-Host "`n  Google Tokens: $($ggTokens.Count)" -ForegroundColor Yellow
    foreach ($t in $ggTokens) {
        Write-Host "    - $($t.name): $($t.status)" -ForegroundColor Gray
    }
    
    Write-Host "`n  TikTok Tokens: $($tkTokens.Count)" -ForegroundColor Yellow
    foreach ($t in $tkTokens) {
        Write-Host "    - $($t.name): $($t.status)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "  [INFO] Chua co API tokens trong database" -ForegroundColor Yellow
}

# =============================================
# TONG KET
# =============================================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TONG KET" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host @"

CRONJOBS TU DONG:
  - Facebook Sync: 6:00 AM hang ngay
  - Google Sync:   6:15 AM hang ngay
  - TikTok Sync:   6:30 AM hang ngay

DE KICH HOAT:
  1. Cau hinh API credentials trong file .env
  2. Tao Ad Account voi dung accountType (facebook/google/tiktok)
  3. Tao Ad Group lien ket voi Ad Account
  
XEM HUONG DAN CHI TIET:
  docs/ADS-API-SETUP-GUIDE.md

"@ -ForegroundColor White

Write-Host "Thoi gian: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
