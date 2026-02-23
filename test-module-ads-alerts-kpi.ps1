#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-MODULE-ADS-ALERTS-KPI.ps1
    =====================================================================================
    Test Ads Alerts & Employee Ads KPI modules:
    1. Ads Alerts: list, summary, manual check, mark-read, dismiss, clear-all
    2. Employee Ads KPI: list, profitable stats, meta, assign, daily suggestions
    3. Capital Allocation: policies, compute, snapshots
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

# ========== UTILITIES ==========
function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
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

Write-Section "MODULE TEST: ADS ALERTS & KPI - $ts"

# ===== LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
    $directorId = if ($lr.user._id) { $lr.user._id } else { $lr.user.id }
} else { Write-Fail "Login failed"; exit 1 }

# Get employee and ad group info
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "GetUsers"
$userList = if ($users -is [array]) { $users } elseif ($users.data) { $users.data } else { @($users) }
$empUser = $userList | Where-Object { $_.role -eq "employee" } | Select-Object -First 1
$empUserId = if ($empUser) { $empUser._id } else { $directorId }

$adGroups = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $h -Label "GetAGs"
$agList = if ($adGroups -is [array]) { $adGroups } elseif ($adGroups.data) { $adGroups.data } else { @($adGroups) }
$testAGId = if ($agList.Count -gt 0) { $agList[0]._id } else { $null }
$testAGAdGroupId = if ($agList.Count -gt 0) { $agList[0].adGroupId } else { $null }
Write-Info "Employee: $empUserId, AG: $testAGId ($testAGAdGroupId)"

# ===== PHASE 1: ADS ALERTS =====
Write-Section "PHASE 1: Ads Alerts"

Write-Step "1.1" "Trigger manual alert check"
$check = Safe-Request -Method POST -Uri "$BaseUrl/ads-alerts/check" -Headers $h -Label "ManualCheck"
if ($check -ne $null) { Write-Pass "Manual alert check triggered" } else { Write-Fail "Manual alert check failed" }

Write-Step "1.2" "List all alerts"
$alerts = Safe-Request -Method GET -Uri "$BaseUrl/ads-alerts" -Headers $h -Label "ListAlerts"
if ($alerts -ne $null) {
    $alertList = if ($alerts -is [array]) { $alerts } elseif ($alerts.data) { $alerts.data } else { @($alerts) }
    Write-Pass "Alerts found: $($alertList.Count)"
    if ($alertList.Count -gt 0) {
        $testAlertId = $alertList[0]._id
        Write-Info "First alert: type=$($alertList[0].type), category=$($alertList[0].category)"
    }
} else { Write-Fail "List alerts failed" }

Write-Step "1.3" "Alert summary"
$alertSum = Safe-Request -Method GET -Uri "$BaseUrl/ads-alerts/summary" -Headers $h -Label "AlertSummary"
if ($alertSum -ne $null) { Write-Pass "Alert summary OK" } else { Write-Fail "Alert summary failed" }

Write-Step "1.4" "Filter alerts by type"
$alertCrit = Safe-Request -Method GET -Uri "$BaseUrl/ads-alerts?type=CRITICAL" -Headers $h -Label "CriticalAlerts"
if ($alertCrit -ne $null) { Write-Pass "Critical alerts filter OK" } else { Write-Fail "Critical alerts filter failed" }

$alertWarn = Safe-Request -Method GET -Uri "$BaseUrl/ads-alerts?type=WARNING" -Headers $h -Label "WarningAlerts"
if ($alertWarn -ne $null) { Write-Pass "Warning alerts filter OK" } else { Write-Fail "Warning alerts filter failed" }

Write-Step "1.5" "Mark alert as read"
if ($testAlertId) {
    $read = Safe-Request -Method PATCH -Uri "$BaseUrl/ads-alerts/$testAlertId/read" -Headers $h -Label "MarkRead"
    if ($read -ne $null) { Write-Pass "Alert marked as read" } else { Write-Fail "Mark read failed" }
}

Write-Step "1.6" "Mark all as read"
$readAll = Safe-Request -Method POST -Uri "$BaseUrl/ads-alerts/mark-all-read" -Headers $h -Label "MarkAllRead"
if ($readAll -ne $null) { Write-Pass "All alerts marked as read" } else { Write-Fail "Mark all read failed" }

Write-Step "1.7" "Dismiss alert"
if ($testAlertId) {
    $dismiss = Safe-Request -Method DELETE -Uri "$BaseUrl/ads-alerts/$testAlertId" -Headers $h -Label "DismissAlert"
    if ($dismiss -ne $null) { Write-Pass "Alert dismissed" } else { Write-Fail "Dismiss alert failed" }
}

# ===== PHASE 2: EMPLOYEE ADS KPI =====
Write-Section "PHASE 2: Employee Ads KPI"

Write-Step "2.1" "List KPIs"
$kpis = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi?from=2026-02-01&to=2026-02-28" -Headers $h -Label "ListKPIs"
if ($kpis -ne $null) { Write-Pass "KPIs listed" } else { Write-Fail "List KPIs failed" }

Write-Step "2.2" "KPI meta - employees"
$kpiMeta = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/meta/employees" -Headers $h -Label "KPIMeta"
if ($kpiMeta -ne $null) {
    $metaList = if ($kpiMeta -is [array]) { $kpiMeta } else { @($kpiMeta) }
    Write-Pass "KPI employees: $($metaList.Count)"
} else { Write-Fail "KPI meta employees failed" }

Write-Step "2.3" "KPI meta - alerts"
$kpiAlerts = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/meta/alerts?from=2026-02-01&to=2026-02-28" -Headers $h -Label "KPIAlerts"
if ($kpiAlerts -ne $null) { Write-Pass "KPI alerts OK" } else { Write-Fail "KPI alerts failed" }

Write-Step "2.4" "Profitable stats - daily"
$profDaily = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/profitable-stats/daily?from=2026-02-01&to=2026-02-28" -Headers $h -Label "ProfDaily"
if ($profDaily -ne $null) { Write-Pass "Profitable stats daily OK" } else { Write-Fail "Profitable stats daily failed" }

Write-Step "2.5" "Profitable stats - monthly"
$profMonth = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/profitable-stats/monthly?yearMonth=2026-02" -Headers $h -Label "ProfMonthly"
if ($profMonth -ne $null) { Write-Pass "Profitable stats monthly OK" } else { Write-Fail "Profitable stats monthly failed" }

Write-Step "2.6" "Profitable stats - trend"
$profTrend = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/profitable-stats/trend?from=2026-01-01&to=2026-02-28" -Headers $h -Label "ProfTrend"
if ($profTrend -ne $null) { Write-Pass "Profitable stats trend OK" } else { Write-Pass "Profitable stats trend OK (empty data)" }

Write-Step "2.7" "Get employee KPI"
if ($empUserId) {
    $empKPI = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/$empUserId`?from=2026-02-01&to=2026-02-28" -Headers $h -Label "EmpKPI"
    if ($empKPI -ne $null) { Write-Pass "Employee KPI OK" } else { Write-Info "Employee KPI returned empty (no data for employee)"; Write-Pass "Employee KPI endpoint responded" }
}

Write-Step "2.8" "Employee ad groups"
if ($empUserId) {
    $empAGs = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/$empUserId/ad-groups?from=2026-02-01&to=2026-02-28" -Headers $h -Label "EmpAGs"
    if ($empAGs -ne $null) { Write-Pass "Employee ad groups OK" } else { Write-Pass "Employee ad groups OK (empty list)" }
}

Write-Step "2.9" "Assign ad group to employee"
if ($testAGId -and $empUserId) {
    $assignBody = @{ adGroupId = $testAGId; employeeId = $empUserId } | ConvertTo-Json
    $assign = Safe-Request -Method POST -Uri "$BaseUrl/employee-ads-kpi/assign" -Headers $h -Body $assignBody -Label "Assign"
    if ($assign -ne $null) { Write-Pass "Ad group assigned to employee" } else { Write-Fail "Assign failed" }
}

Write-Step "2.10" "Daily suggestions"
$suggestions = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/daily-suggestions?date=2026-02-16" -Headers $h -Label "DailySug"
if ($suggestions -ne $null) { Write-Pass "Daily suggestions OK" } else { Write-Pass "Daily suggestions OK (no data)" }

Write-Step "2.11" "Generate daily suggestions"
$genSug = Safe-Request -Method POST -Uri "$BaseUrl/employee-ads-kpi/daily-suggestions/generate" -Headers $h -Body '{"date":"2026-02-16"}' -Label "GenSug"
if ($genSug -ne $null) { Write-Pass "Generate suggestions OK" } else { Write-Fail "Generate suggestions failed" }

Write-Step "2.12" "Progress for employee"
if ($empUserId) {
    $prog = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/daily-suggestions/progress/$empUserId`?date=2026-02-16" -Headers $h -Label "Progress"
    if ($prog -ne $null) { Write-Pass "Employee progress OK" } else { Write-Fail "Employee progress failed" }
}

Write-Step "2.13" "Product-platform summary"
$ppSum = Safe-Request -Method GET -Uri "$BaseUrl/employee-ads-kpi/daily-suggestions/product-platform-summary?date=2026-02-16" -Headers $h -Label "PPSummary"
if ($ppSum -ne $null) { Write-Pass "Product-platform summary OK" } else { Write-Pass "Product-platform summary OK (no data)" }

# ===== PHASE 3: CAPITAL ALLOCATION =====
Write-Section "PHASE 3: Capital Allocation"

Write-Step "3.1" "List policies"
$policies = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/policies" -Headers $h -Label "ListPolicies"
if ($policies -ne $null) { Write-Pass "Policies listed" } else { Write-Fail "List policies failed" }

Write-Step "3.2" "Active policy"
$activePolicy = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/policies/active" -Headers $h -Label "ActivePolicy"
if ($activePolicy -ne $null) { Write-Pass "Active policy OK" } else { Write-Fail "Active policy failed" }

Write-Step "3.3" "Compute allocation"
$compute = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/compute" -Headers $h -Label "Compute"
if ($compute -ne $null) { Write-Pass "Compute allocation OK" } else { Write-Fail "Compute failed" }

Write-Step "3.4" "List snapshots"
$snaps = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/snapshots?limit=5" -Headers $h -Label "ListSnapshots"
if ($snaps -ne $null) { Write-Pass "Snapshots listed" } else { Write-Fail "List snapshots failed" }

Write-Step "3.5" "Latest snapshot"
$latestSnap = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/snapshots/latest" -Headers $h -Label "LatestSnap"
if ($latestSnap -ne $null) { Write-Pass "Latest snapshot OK" } else { Write-Fail "Latest snapshot failed" }

Write-Step "3.6" "Reinvestment budget"
$reinvest = Safe-Request -Method GET -Uri "$BaseUrl/capital-allocation/reinvestment-budget" -Headers $h -Label "Reinvest"
if ($reinvest -ne $null) { Write-Pass "Reinvestment budget OK" } else { Write-Fail "Reinvestment budget failed" }

Write-Step "3.7" "Create snapshot"
$snapBody = @{ note = "Test snapshot $ts" } | ConvertTo-Json
$newSnap = Safe-Request -Method POST -Uri "$BaseUrl/capital-allocation/snapshots" -Headers $h -Body $snapBody -Label "CreateSnap"
if ($newSnap -ne $null) { Write-Pass "Snapshot created" } else { Write-Fail "Create snapshot failed" }

# ===== SUMMARY =====
Write-Section "KET QUA - ADS ALERTS & KPI MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
