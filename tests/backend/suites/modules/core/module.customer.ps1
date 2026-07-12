#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.CUSTOMER.PS1
    =====================================================================================
    Test Customer Management module:
    1. Sync customers from orders
    2. List customers, stats
    3. Update customer
    4. Disable / Enable customer
    5. Notifications: expiring, calendar, export
    6. Delete customer
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
function Get-BackendBaseUrl {
    $override = [string]$env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}
$BaseUrl = Get-BackendBaseUrl

# ========== UTILITIES ==========
function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Check($msg) { Write-Host "  [CHECK] $msg" -ForegroundColor Magenta }
function Safe-Request {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null, [string]$Label = "")
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        return (Invoke-RestMethod @params)
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Section "MODULE TEST: CUSTOMER MANAGEMENT - $ts"

# ===== PHASE 0: LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK: $($lr.user.fullName) ($($lr.user.role))"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
} else { Write-Fail "Login failed"; exit 1 }

# ===== PHASE 1: SYNC CUSTOMERS =====
Write-Section "PHASE 1: Sync Customers from Orders"

Write-Step "1.1" "Trigger customer sync"
$sync = Safe-Request -Method POST -Uri "$BaseUrl/customers/sync" -Headers $h -Label "SyncCustomers"
if ($sync -ne $null) { Write-Pass "Customer sync triggered" } else { Write-Fail "Customer sync failed" }

Write-Step "1.2" "Get customer stats"
$stats = Safe-Request -Method GET -Uri "$BaseUrl/customers/stats" -Headers $h -Label "CustomerStats"
if ($stats) {
    Write-Pass "Customer stats: total=$($stats.total), active=$($stats.active)"
} else { Write-Fail "Customer stats failed" }

# ===== PHASE 2: LIST & SEARCH =====
Write-Section "PHASE 2: List & Search Customers"

Write-Step "2.1" "List all customers"
$custs = Safe-Request -Method GET -Uri "$BaseUrl/customers" -Headers $h -Label "ListCustomers"
if ($custs) {
    $custList = if ($custs -is [array]) { $custs } elseif ($custs.data) { $custs.data } else { @($custs) }
    Write-Pass "Customers found: $($custList.Count)"
    if ($custList.Count -gt 0) {
        $testCust = $custList[0]
        $testCustId = $testCust._id
        Write-Info "First customer: $($testCust.customerName) (ID=$testCustId)"
    }
} else { Write-Fail "List customers failed" }

Write-Step "2.2" "Get single customer"
if ($testCustId) {
    $c1 = Safe-Request -Method GET -Uri "$BaseUrl/customers/$testCustId" -Headers $h -Label "GetCustomer"
    if ($c1 -and $c1._id) { Write-Pass "Get customer OK: $($c1.customerName)" }
    else { Write-Fail "Get single customer failed" }
}

# ===== PHASE 3: UPDATE CUSTOMER =====
Write-Section "PHASE 3: Update Customer"

Write-Step "3.1" "Update customer notes"
if ($testCustId) {
    $upd = Safe-Request -Method PATCH -Uri "$BaseUrl/customers/$testCustId" -Headers $h -Body '{"notes":"Test update from automation"}' -Label "UpdateCustomer"
    if ($upd) { Write-Pass "Customer updated OK" } else { Write-Fail "Customer update failed" }
}

# ===== PHASE 4: DISABLE / ENABLE =====
Write-Section "PHASE 4: Disable & Enable Customer"

Write-Step "4.1" "Disable customer"
if ($testCustId) {
    $dis = Safe-Request -Method PATCH -Uri "$BaseUrl/customers/$testCustId/disable" -Headers $h -Label "DisableCustomer"
    if ($dis -ne $null) { Write-Pass "Customer disabled" } else { Write-Fail "Disable failed" }
}

Write-Step "4.2" "Verify disabled"
if ($testCustId) {
    $c2 = Safe-Request -Method GET -Uri "$BaseUrl/customers/$testCustId" -Headers $h -Label "VerifyDisabled"
    if ($c2 -and $c2.isDisabled -eq $true) { Write-Pass "Customer is disabled" }
    else { Write-Fail "Customer not marked as disabled" }
}

Write-Step "4.3" "Enable customer"
if ($testCustId) {
    $en = Safe-Request -Method PATCH -Uri "$BaseUrl/customers/$testCustId/enable" -Headers $h -Label "EnableCustomer"
    if ($en -ne $null) { Write-Pass "Customer enabled" } else { Write-Fail "Enable failed" }
}

Write-Step "4.4" "Verify enabled"
if ($testCustId) {
    $c3 = Safe-Request -Method GET -Uri "$BaseUrl/customers/$testCustId" -Headers $h -Label "VerifyEnabled"
    if ($c3 -and ($c3.isDisabled -eq $false -or $c3.isDisabled -eq $null)) { Write-Pass "Customer is enabled" }
    else { Write-Fail "Customer not re-enabled" }
}

# ===== PHASE 5: NOTIFICATIONS =====
Write-Section "PHASE 5: Customer Notifications"

Write-Step "5.1" "Expiring customers (30 days)"
$expiring = Safe-Request -Method GET -Uri "$BaseUrl/customers/notifications/expiring?days=30" -Headers $h -Label "Expiring"
if ($expiring -ne $null) { 
    $expList = if ($expiring -is [array]) { $expiring } else { @($expiring) }
    Write-Pass "Expiring notifications: $($expList.Count) records"
} else { Write-Fail "Expiring notifications failed" }

Write-Step "5.2" "Calendar notifications"
$cal = Safe-Request -Method GET -Uri "$BaseUrl/customers/notifications/calendar" -Headers $h -Label "Calendar"
if ($cal -ne $null) { Write-Pass "Calendar notifications OK" } else { Write-Fail "Calendar notifications failed" }

Write-Step "5.3" "Export expiring"
$export = Safe-Request -Method GET -Uri "$BaseUrl/customers/notifications/export?days=30" -Headers $h -Label "Export"
if ($export -ne $null) { Write-Pass "Export OK" } else { Write-Fail "Export failed" }

Write-Step "5.4" "Update remaining days"
$urd = Safe-Request -Method POST -Uri "$BaseUrl/customers/update-remaining-days" -Headers $h -Label "UpdateRemainingDays"
if ($urd -ne $null) { Write-Pass "Update remaining days OK" } else { Write-Fail "Update remaining days failed" }

# ===== SUMMARY =====
Write-Section "KET QUA - CUSTOMER MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
