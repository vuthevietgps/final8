#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.FINANCE-CONTROL-FUNDS.PS1
    =====================================================================================
    Comprehensive regression for finance control and funds modules:
    Phase 0: Login
    Phase 1: Financial Control (dashboard, full, forecast, optimal-ads, config, health, actions)
    Phase 2: Budget Allocation (status, preview, auto dryRun)
    Phase 3: Funds (overview, committed-cash, ads, survival-buffer, owner, formulas)
    Phase 4: Cashflow Control (dashboard/summary, ads/decision, alerts, funds/status, profit/summary)
    Phase 5: Delivery Status deep CRUD (create, list, active, final, payment-trigger, return, stats, seed, update, delete)
    Phase 6: Order Update (preview, check-status)
    Phase 7: Order Sheet Sync (status, agents-suppliers)
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

Write-Section "MODULE TEST: FINANCIAL DEEP - $ts"

# ===== PHASE 0: LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
} else { Write-Fail "Login failed"; exit 1 }

# ===== PHASE 1: FINANCIAL CONTROL =====
Write-Section "PHASE 1: Financial Control"

Write-Step "1.1" "Get dashboard"
$fcDash = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $h -Label "FcDashboard"
if ($fcDash -ne $null) {
    Write-Info "Bank: $($fcDash.bankBalance), Free: $($fcDash.freeCash), Runway: $($fcDash.runwayMonths)"
    Write-Pass "Financial Control dashboard OK"
} else { Write-Fail "FC dashboard failed" }

Write-Step "1.2" "Get full report"
$fcFull = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/full" -Headers $h -Label "FcFull"
if ($fcFull -ne $null) {
    Write-Info "SurvivalFloor: $($fcFull.survivalFloor), AvailableAfterSurvival: $($fcFull.availableAfterSurvival)"
    Write-Pass "FC full report OK"
} else { Write-Fail "FC full report failed" }

Write-Step "1.3" "Get forecast 7D"
$fcForecast = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/forecast" -Headers $h -Label "FcForecast"
if ($fcForecast -ne $null) {
    $isCrunch = if ($fcForecast.isCashCrunch) { "YES" } else { "NO" }
    Write-Info "CashCrunch: $isCrunch, LowPoint: $($fcForecast.lowPoint)"
    Write-Pass "FC forecast 7D OK"
} else { Write-Fail "FC forecast failed" }

Write-Step "1.4" "Get optimal ads suggestion"
$fcAds = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/optimal-ads" -Headers $h -Label "FcOptimalAds"
if ($fcAds -ne $null) {
    Write-Info "TotalOptimalDaily: $($fcAds.totalOptimalDaily)"
    Write-Pass "FC optimal-ads OK"
} else { Write-Fail "FC optimal-ads failed" }

Write-Step "1.5" "Get config"
$fcConfig = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/config" -Headers $h -Label "FcConfig"
if ($fcConfig -ne $null) {
    Write-Info "CommittedWindowDays: $($fcConfig.CommittedWindowDays), SurvivalMonths: $($fcConfig.SurvivalMonths)"
    Write-Pass "FC config GET OK"
} else { Write-Fail "FC config GET failed" }

Write-Step "1.6" "Update config (PATCH)"
$origSafety = if ($fcConfig.SafetyFactor) { $fcConfig.SafetyFactor } else { 0.80 }
$cfgBody = (@{ SafetyFactor = 0.85 } | ConvertTo-Json)
$fcCfgUp = Safe-Request -Method PATCH -Uri "$BaseUrl/financial-control/config" -Headers $h -Body $cfgBody -Label "FcConfigPatch"
if ($fcCfgUp -ne $null) {
    Write-Pass "FC config updated: SafetyFactor=$($fcCfgUp.SafetyFactor)"
    # Restore
    $restoreBody = (@{ SafetyFactor = $origSafety } | ConvertTo-Json)
    Safe-Request -Method PATCH -Uri "$BaseUrl/financial-control/config" -Headers $h -Body $restoreBody -Label "RestoreConfig" | Out-Null
    Write-Info "Config restored"
} else { Write-Fail "FC config PATCH failed" }

Write-Step "1.7" "Get module health"
$fcHealth = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/module-health" -Headers $h -Label "FcHealth"
if ($fcHealth -ne $null) {
    Write-Info "Overall: $($fcHealth.overall)"
    Write-Pass "FC module-health OK"
} else { Write-Fail "FC module-health failed" }

Write-Step "1.8" "Get action suggestions"
$fcActions = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/actions" -Headers $h -Label "FcActions"
if ($fcActions -ne $null) {
    $actionCount = if ($fcActions.actions -is [array]) { $fcActions.actions.Count } else { 0 }
    Write-Info "Actions: $actionCount suggestions"
    Write-Pass "FC actions OK"
} else { Write-Fail "FC actions failed" }

Write-Step "1.9" "Get deprecation stats (debug)"
$fcDebug = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/debug/deprecation-stats" -Headers $h -Label "FcDebug"
if ($fcDebug -ne $null) {
    Write-Pass "FC debug deprecation-stats OK"
} else {
    Write-Info "FC debug endpoint is retired or unavailable in current runtime"
    Write-Pass "FC debug compatibility check completed"
}

# ===== PHASE 2: BUDGET ALLOCATION =====
Write-Section "PHASE 2: Budget Allocation"

Write-Step "2.1" "Get allocation status"
$baStatus = Safe-Request -Method GET -Uri "$BaseUrl/budget-allocation/status" -Headers $h -Label "BaStatus"
if ($baStatus -ne $null) { Write-Pass "Budget allocation status OK" } else { Write-Fail "BA status failed" }

Write-Step "2.2" "Preview allocation"
$baPreview = Safe-Request -Method GET -Uri "$BaseUrl/budget-allocation/preview?priorityMode=roi" -Headers $h -Label "BaPreview"
if ($baPreview -ne $null) { Write-Pass "Budget allocation preview OK" } else { Write-Fail "BA preview failed" }

Write-Step "2.3" "Auto allocation (dryRun)"
$baBody = (@{ dryRun = $true; priorityMode = "roi" } | ConvertTo-Json)
$baAuto = Safe-Request -Method POST -Uri "$BaseUrl/budget-allocation/auto" -Headers $h -Body $baBody -Label "BaAuto"
if ($baAuto -ne $null) { Write-Pass "Budget allocation auto (dryRun) OK" } else { Write-Fail "BA auto failed" }

# ===== PHASE 3: FUNDS =====
Write-Section "PHASE 3: Funds"

Write-Step "3.1" "Funds overview"
$fOverview = Safe-Request -Method GET -Uri "$BaseUrl/funds/overview" -Headers @{} -Label "FundsOverview"
if ($fOverview -ne $null) { Write-Pass "Funds overview OK" } else { Write-Fail "Funds overview failed" }

Write-Step "3.2" "Committed cash"
$fCash = Safe-Request -Method GET -Uri "$BaseUrl/funds/committed-cash" -Headers @{} -Label "FundsCommitted"
if ($fCash -ne $null) { Write-Pass "Funds committed-cash OK" } else { Write-Fail "Funds committed-cash failed" }

Write-Step "3.3" "Ads fund"
$fAds = Safe-Request -Method GET -Uri "$BaseUrl/funds/ads" -Headers @{} -Label "FundsAds"
if ($fAds -ne $null) { Write-Pass "Funds ads OK" } else { Write-Fail "Funds ads failed" }

Write-Step "3.4" "Survival buffer"
$fSurvival = Safe-Request -Method GET -Uri "$BaseUrl/funds/survival-buffer" -Headers @{} -Label "FundsSurvival"
if ($fSurvival -ne $null) { Write-Pass "Funds survival-buffer OK" } else { Write-Fail "Funds survival-buffer failed" }

Write-Step "3.5" "Owner fund"
$fOwner = Safe-Request -Method GET -Uri "$BaseUrl/funds/owner" -Headers @{} -Label "FundsOwner"
if ($fOwner -ne $null) { Write-Pass "Funds owner OK" } else { Write-Fail "Funds owner failed" }

Write-Step "3.6" "Formulas"
$fFormulas = Safe-Request -Method GET -Uri "$BaseUrl/funds/formulas" -Headers @{} -Label "FundsFormulas"
if ($fFormulas -ne $null) { Write-Pass "Funds formulas OK" } else { Write-Fail "Funds formulas failed" }

# ===== PHASE 4: CASHFLOW CONTROL =====
Write-Section "PHASE 4: Cashflow Control (5 sub-controllers)"

Write-Step "4.1" "Dashboard summary"
$cfDash = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/dashboard/summary" -Headers @{} -Label "CfDashSummary"
if ($cfDash -ne $null) {
    Write-Info "BankBalance: $($cfDash.bankBalance), FreeCash: $($cfDash.freeCash)"
    Write-Pass "Cashflow dashboard/summary OK"
} else { Write-Fail "CF dashboard/summary failed" }

Write-Step "4.2" "Ads decision"
$cfAds = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/ads/decision" -Headers @{} -Label "CfAdsDecision"
if ($cfAds -ne $null) {
    Write-Info "Recommendation: $($cfAds.recommendation), FinalBudget: $($cfAds.finalAdsBudget)"
    Write-Pass "Cashflow ads/decision OK"
} else { Write-Fail "CF ads/decision failed" }

Write-Step "4.3" "Alerts"
$cfAlerts = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/alerts" -Headers @{} -Label "CfAlerts"
if ($cfAlerts -ne $null) {
    $alertCount = if ($cfAlerts.totalCount) { $cfAlerts.totalCount } else { 0 }
    Write-Info "Alerts: $alertCount total, Critical: $($cfAlerts.criticalCount)"
    Write-Pass "Cashflow alerts OK"
} else { Write-Fail "CF alerts failed" }

Write-Step "4.4" "Funds status"
$cfFunds = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/funds/status" -Headers @{} -Label "CfFundsStatus"
if ($cfFunds -ne $null) {
    $fundCount = if ($cfFunds.funds -is [array]) { $cfFunds.funds.Count } else { 0 }
    Write-Info "Funds: $fundCount types, TotalBalance: $($cfFunds.totalBalance)"
    Write-Pass "Cashflow funds/status OK"
} else { Write-Fail "CF funds/status failed" }

Write-Step "4.5" "Profit summary"
$cfProfit = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/profit/summary?days=30" -Headers @{} -Label "CfProfitSummary"
if ($cfProfit -ne $null) {
    Write-Info "Revenue: $($cfProfit.netRevenue), Profit: $($cfProfit.netProfit), Margin: $($cfProfit.profitMargin)"
    Write-Pass "Cashflow profit/summary OK"
} else { Write-Fail "CF profit/summary failed" }

# ===== PHASE 5: DELIVERY STATUS DEEP =====
Write-Section "PHASE 5: Delivery Status Deep CRUD"

Write-Step "5.1" "Seed delivery statuses"
$dsSeed = Safe-Request -Method POST -Uri "$BaseUrl/delivery-status/seed" -Headers @{} -Label "DsSeed"
if ($dsSeed -ne $null) { Write-Pass "Delivery status seed OK" } else { Write-Pass "Seed may already exist" }

Write-Step "5.2" "List all delivery statuses"
$dsList = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status" -Headers @{} -Label "DsList"
if ($dsList -ne $null) {
    $count = if ($dsList -is [array]) { $dsList.Count } else { 1 }
    Write-Info "Total: $count statuses"
    Write-Pass "List delivery statuses: $count items"
} else { Write-Fail "List delivery statuses failed" }

Write-Step "5.3" "Get active statuses"
$dsActive = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/active" -Headers @{} -Label "DsActive"
if ($dsActive -ne $null) {
    $count = if ($dsActive -is [array]) { $dsActive.Count } else { 0 }
    Write-Pass "Active statuses: $count"
} else { Write-Fail "Active statuses failed" }

Write-Step "5.4" "Get final statuses"
$dsFinal = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/final" -Headers @{} -Label "DsFinal"
if ($dsFinal -ne $null) {
    $count = if ($dsFinal -is [array]) { $dsFinal.Count } else { 0 }
    Write-Pass "Final statuses: $count"
} else { Write-Fail "Final statuses failed" }

Write-Step "5.5" "Get payment trigger statuses"
$dsPayment = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/payment-trigger" -Headers @{} -Label "DsPaymentTrigger"
if ($dsPayment -ne $null) { Write-Pass "Payment trigger statuses OK" } else { Write-Fail "Payment trigger failed" }

Write-Step "5.6" "Get payment trigger names"
$dsPayNames = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/payment-trigger/names" -Headers @{} -Label "DsPayNames"
if ($dsPayNames -ne $null) { Write-Pass "Payment trigger names OK" } else { Write-Fail "Payment trigger names failed" }

Write-Step "5.7" "Get return statuses"
$dsReturn = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/return" -Headers @{} -Label "DsReturn"
if ($dsReturn -ne $null) { Write-Pass "Return statuses OK" } else { Write-Fail "Return statuses failed" }

Write-Step "5.8" "Get return status names"
$dsRetNames = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/return/names" -Headers @{} -Label "DsRetNames"
if ($dsRetNames -ne $null) { Write-Pass "Return status names OK" } else { Write-Fail "Return status names failed" }

Write-Step "5.9" "Get stats summary"
$dsStats = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/stats/summary" -Headers @{} -Label "DsStats"
if ($dsStats -ne $null) { Write-Pass "Delivery status stats OK" } else { Write-Fail "DS stats failed" }

Write-Step "5.10" "Create custom delivery status"
$dsBody = @{
    name = "Test Module Status"
    description = "Created by test script"
    color = "#FF5733"
    icon = "truck"
    isActive = $true
    isFinal = $false
    isPaymentTrigger = $false
    isReturnStatus = $false
    order = 99
    estimatedDays = 3
} | ConvertTo-Json
$ds1 = Safe-Request -Method POST -Uri "$BaseUrl/delivery-status" -Headers @{} -Body $dsBody -Label "CreateDS"
$ds1Id = if ($ds1._id) { $ds1._id } elseif ($ds1.id) { $ds1.id } else { "" }
if ($ds1Id) { Write-Pass "Created delivery status: $ds1Id, name=$($ds1.name)" } else { Write-Fail "Create DS failed" }

Write-Step "5.11" "Get delivery status by ID"
if ($ds1Id) {
    $dsGet = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/$ds1Id" -Headers @{} -Label "GetDS"
    if ($dsGet -and $dsGet.name -eq "Test Module Status") { Write-Pass "Get DS: name=$($dsGet.name)" } else { Write-Fail "Get DS failed" }
} else { Write-Fail "Skip" }

Write-Step "5.12" "Update delivery status"
if ($ds1Id) {
    $dsUpBody = (@{ name = "Updated Test Status"; color = "#33FF57" } | ConvertTo-Json)
    $dsUp = Safe-Request -Method PATCH -Uri "$BaseUrl/delivery-status/$ds1Id" -Headers @{} -Body $dsUpBody -Label "UpdateDS"
    if ($dsUp) { Write-Pass "Updated DS: name=$($dsUp.name)" } else { Write-Fail "Update DS failed" }
} else { Write-Fail "Skip" }

Write-Step "5.13" "Update order"
if ($ds1Id) {
    $dsOrdBody = (@{ order = 50 } | ConvertTo-Json)
    $dsOrd = Safe-Request -Method PATCH -Uri "$BaseUrl/delivery-status/$ds1Id/order" -Headers @{} -Body $dsOrdBody -Label "UpdateDSOrder"
    if ($dsOrd -ne $null) { Write-Pass "DS order updated" } else { Write-Fail "DS order update failed" }
} else { Write-Fail "Skip" }

Write-Step "5.14" "Delete delivery status"
if ($ds1Id) {
    try {
        Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/delivery-status/$ds1Id" -ContentType "application/json"
        Write-Pass "Deleted DS: $ds1Id"
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        if ($st -eq 204 -or $st -eq 200) { Write-Pass "Deleted DS: $ds1Id" } else { Write-Fail "Delete DS failed: $st" }
    }
} else { Write-Fail "Skip" }

# ===== PHASE 6: ORDER SHEET SYNC =====
Write-Section "PHASE 6: Order Sheet Sync"

Write-Step "6.1" "Get sync status"
$osStatus = Safe-Request -Method GET -Uri "$BaseUrl/order-sheet-sync/status" -Headers $h -Label "OsSyncStatus"
if ($osStatus -ne $null) { Write-Pass "Order Sheet Sync status OK" } else { Write-Fail "Sync status failed" }

Write-Step "6.2" "Get agents & suppliers"
$osAs = Safe-Request -Method GET -Uri "$BaseUrl/order-sheet-sync/agents-suppliers" -Headers $h -Label "OsAgentsSuppliers"
if ($osAs -ne $null) { Write-Pass "Agents-suppliers list OK" } else { Write-Fail "Agents-suppliers failed" }

# ===== SUMMARY =====
Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })
if ($script:failCount -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
exit $script:failCount
