#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.LABOR-OTHER-COST.PS1
    =====================================================================================
    Test Labor Cost & Other Cost modules:
    1. Labor Cost CRUD (create, list, update, delete)
    2. Labor Statement lifecycle (create -> KPI -> confirm -> pay -> close -> reopen)
    3. Labor summaries (cashflow, cards, by-employee)
    4. Other Cost CRUD (create, list, update, confirm, delete)
    5. Other Cost summaries (summary, cashflow, export)
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

Write-Section "MODULE TEST: LABOR COST & OTHER COST - $ts"

# ===== LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
    $directorId = $lr.user._id
    Write-Info "Director ID: $directorId"
} else { Write-Fail "Login failed"; exit 1 }

# Get an employee user for labor cost
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "GetUsers"
$userList = if ($users -is [array]) { $users } elseif ($users.data) { $users.data } else { @($users) }
$empUser = $userList | Where-Object { $_.role -eq "employee" } | Select-Object -First 1
$empUserId = if ($empUser) { $empUser._id } else { $directorId }
Write-Info "Employee for labor: $empUserId ($($empUser.name))"

# ===== PHASE 1: LABOR COST CRUD =====
Write-Section "PHASE 1: Labor Cost CRUD"

Write-Step "1.1" "Create labor cost entry #1"
$lc1Body = @{
    date = "2026-02-10"
    userId = $empUserId
    startTime = "08:00"
    endTime = "17:00"
    notes = "Test labor cost - ca sang chieu"
} | ConvertTo-Json
$lc1 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $h -Body $lc1Body -Label "CreateLC1"
if ($lc1 -and $lc1._id) {
    $lc1Id = $lc1._id
    Write-Pass "Labor cost #1 created: $lc1Id"
} else { Write-Fail "Create labor cost #1 failed" }

Write-Step "1.2" "Create labor cost entry #2"
$lc2Body = @{
    date = "2026-02-11"
    userId = $empUserId
    startTime = "09:00"
    endTime = "18:00"
    notes = "Test labor cost day 2"
} | ConvertTo-Json
$lc2 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $h -Body $lc2Body -Label "CreateLC2"
if ($lc2 -and $lc2._id) {
    $lc2Id = $lc2._id
    Write-Pass "Labor cost #2 created: $lc2Id"
} else { Write-Fail "Create labor cost #2 failed" }

Write-Step "1.3" "Create labor cost entry #3"
$lc3Body = @{
    date = "2026-02-12"
    userId = $empUserId
    startTime = "08:30"
    endTime = "17:30"
    notes = "Test labor cost day 3"
} | ConvertTo-Json
$lc3 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $h -Body $lc3Body -Label "CreateLC3"
if ($lc3 -and $lc3._id) {
    $lc3Id = $lc3._id
    Write-Pass "Labor cost #3 created: $lc3Id"
} else { Write-Fail "Create labor cost #3 failed" }

Write-Step "1.4" "List labor costs"
$lcList = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1" -Headers $h -Label "ListLC"
if ($lcList) {
    $lcs = if ($lcList -is [array]) { $lcList } elseif ($lcList.data) { $lcList.data } else { @($lcList) }
    Write-Pass "Labor costs found: $($lcs.Count)"
} else { Write-Fail "List labor costs failed" }

Write-Step "1.5" "Update labor cost #1"
if ($lc1Id) {
    $lcUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/$lc1Id" -Headers $h -Body '{"notes":"Updated by test","endTime":"18:00"}' -Label "UpdateLC1"
    if ($lcUpd) { Write-Pass "Labor cost #1 updated" } else { Write-Fail "Update labor cost failed" }
}

Write-Step "1.6" "Delete labor cost #3"
if ($lc3Id) {
    $lcDel = Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/$lc3Id" -Headers $h -Label "DeleteLC3"
    if ($lcDel -ne $null) { Write-Pass "Labor cost #3 deleted" } else { Write-Fail "Delete labor cost failed" }
}

# ===== PHASE 2: LABOR STATEMENT LIFECYCLE =====
Write-Section "PHASE 2: Labor Statement Lifecycle"

# Pre-cleanup: try to delete any existing statement for this employee that might conflict
$existingStatements = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements" -Headers $h -Label "GetExistingStatements"
$existList = if ($existingStatements -is [array]) { $existingStatements } elseif ($existingStatements.data) { $existingStatements.data } else { @() }
foreach ($es in $existList) {
    if ($es.employeeId -eq $empUserId -or ($es.employee -and $es.employee._id -eq $empUserId)) {
        # Try to reopen if closed, then delete
        if ($es.status -eq "closed") {
            Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$($es._id)/reopen" -Headers $h -Label "PreReopen" | Out-Null
        }
        if ($es.status -ne "draft") {
            # Can only delete draft; skip non-draft
        } else {
            Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/statements/$($es._id)" -Headers $h -Label "PreCleanLS" | Out-Null
        }
    }
}

Write-Step "2.1" "Create labor statement"
# Use a unique statement date on each run so reruns do not collide with
# previously confirmed/closed statements for the same employee.
$statementDate = (Get-Date).AddDays(3650 + (Get-Random -Minimum 1 -Maximum 365))
$lsDate = $statementDate.ToString('yyyy-MM-dd')
$lsBody = @{
    employeeId = $empUserId
    periodFrom = $lsDate
    periodTo = $lsDate
    openingBalance = 0
    bonus = 500000
    deduction = 0
    notes = "Test labor statement $ts"
} | ConvertTo-Json
$ls1 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements" -Headers $h -Body $lsBody -Label "CreateLS"
if ($ls1 -and $ls1._id) {
    $ls1Id = $ls1._id
    Write-Pass "Labor statement created: $ls1Id"
    Write-Info "  opening=$($ls1.openingBalance), periodLaborCost=$($ls1.periodLaborCost), closing=$($ls1.closingBalance)"
} else { Write-Fail "Create labor statement failed" }

Write-Step "2.2" "Get labor statement"
if ($ls1Id) {
    $lsGet = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements/$ls1Id" -Headers $h -Label "GetLS"
    if ($lsGet -and $lsGet._id) { Write-Pass "Get statement OK: status=$($lsGet.status)" }
    else { Write-Fail "Get labor statement failed" }
}

Write-Step "2.3" "List labor statements"
$lsList = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements?employeeId=$empUserId" -Headers $h -Label "ListLS"
if ($lsList) {
    $stmts = if ($lsList -is [array]) { $lsList } elseif ($lsList.data) { $lsList.data } else { @($lsList) }
    Write-Pass "Labor statements found: $($stmts.Count)"
} else { Write-Fail "List labor statements failed" }

Write-Step "2.4" "Update KPI on statement"
if ($ls1Id) {
    $kpiBody = @{ kpiPercent = 85 } | ConvertTo-Json
    $kpiUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/kpi" -Headers $h -Body $kpiBody -Label "UpdateKPI"
    if ($kpiUpd) { Write-Pass "KPI updated: score=85" } else { Write-Fail "KPI update failed" }
}

Write-Step "2.5" "Confirm statement"
if ($ls1Id) {
    $confBody = @{ skipKpiCheck = $true } | ConvertTo-Json
    $conf = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/confirm" -Headers $h -Body $confBody -Label "ConfirmLS"
    if ($conf) { Write-Pass "Statement confirmed" } else { Write-Fail "Confirm statement failed" }
}

Write-Step "2.6" "Pay labor statement - Lan 1: 200K"
if ($ls1Id) {
    $payBody = @{ amount = 200000; paidAt = "2025-06-15T10:00:00.000Z"; notes = "Payment 1" } | ConvertTo-Json
    $pay1 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/payments" -Headers $h -Body $payBody -Label "PayLS1"
    if ($pay1) { Write-Pass "Labor statement paid 200K" } else { Write-Fail "Labor payment #1 failed" }
}

Write-Step "2.7" "Pay labor statement - Lan 2: 200K"
if ($ls1Id) {
    $pay2Body = @{ amount = 200000; paidAt = "2025-06-16T10:00:00.000Z"; notes = "Payment 2" } | ConvertTo-Json
    $pay2 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/payments" -Headers $h -Body $pay2Body -Label "PayLS2"
    if ($pay2) { Write-Pass "Labor statement paid +200K = 400K total" } else { Write-Fail "Labor payment #2 failed" }
}

Write-Step "2.8" "Close labor statement"
if ($ls1Id) {
    $close = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/close" -Headers $h -Body '{}' -Label "CloseLS"
    if ($close) { Write-Pass "Labor statement closed" } else { Write-Fail "Close statement failed" }
}

Write-Step "2.9" "Reopen labor statement"
if ($ls1Id) {
    $reopen = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/reopen" -Headers $h -Label "ReopenLS"
    if ($reopen) { Write-Pass "Labor statement reopened" } else { Write-Fail "Reopen statement failed" }
}

Write-Step "2.10" "Close again (final)"
if ($ls1Id) {
    $close2 = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$ls1Id/close" -Headers $h -Body '{}' -Label "CloseLS2"
    if ($close2) { Write-Pass "Labor statement closed (final)" } else { Write-Fail "Final close failed" }
}

# ===== PHASE 3: LABOR SUMMARIES =====
Write-Section "PHASE 3: Labor Cost Summaries"

Write-Step "3.1" "Total unpaid"
$unpaid = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements/summary/total-unpaid" -Headers $h -Label "TotalUnpaid"
if ($unpaid -ne $null) { Write-Pass "Total unpaid OK" } else { Write-Fail "Total unpaid failed" }

Write-Step "3.2" "Cashflow summary"
$lcCF = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cashflow" -Headers $h -Label "LaborCashflow"
if ($lcCF -ne $null) { Write-Pass "Labor cashflow summary OK" } else { Write-Fail "Labor cashflow failed" }

Write-Step "3.3" "Summary by employee"
$lcByEmp = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements/summary/by-employee" -Headers $h -Label "ByEmployee"
if ($lcByEmp -ne $null) { Write-Pass "Summary by employee OK" } else { Write-Fail "By employee failed" }

Write-Step "3.4" "Summary cards"
$lcCards = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cards" -Headers $h -Label "LaborCards"
if ($lcCards -ne $null) { Write-Pass "Labor cards OK" } else { Write-Fail "Labor cards failed" }

# ===== PHASE 4: OTHER COST CRUD =====
Write-Section "PHASE 4: Other Cost CRUD"

Write-Step "4.1" "Create other cost #1 (rent)"
$oc1Body = @{
    date = "2026-02-01"
    dueDate = "2026-02-28"
    amount = 15000000
    category = "rent"
    notes = "Thue kho thang 2/2026"
} | ConvertTo-Json
$oc1 = Safe-Request -Method POST -Uri "$BaseUrl/other-cost" -Headers $h -Body $oc1Body -Label "CreateOC1"
if ($oc1 -and $oc1._id) {
    $oc1Id = $oc1._id
    Write-Pass "Other cost #1 created: $oc1Id (rent, 15M)"
} else { Write-Fail "Create other cost #1 failed" }

Write-Step "4.2" "Create other cost #2 (utilities)"
$oc2Body = @{
    date = "2026-02-05"
    dueDate = "2026-02-20"
    amount = 3000000
    category = "utilities"
    notes = "Tien dien nuoc thang 2"
} | ConvertTo-Json
$oc2 = Safe-Request -Method POST -Uri "$BaseUrl/other-cost" -Headers $h -Body $oc2Body -Label "CreateOC2"
if ($oc2 -and $oc2._id) {
    $oc2Id = $oc2._id
    Write-Pass "Other cost #2 created: $oc2Id (utilities, 3M)"
} else { Write-Fail "Create other cost #2 failed" }

Write-Step "4.3" "Create other cost #3 (internet)"
$oc3Body = @{
    date = "2026-02-01"
    dueDate = "2026-02-15"
    amount = 800000
    category = "internet"
    notes = "Internet thang 2"
} | ConvertTo-Json
$oc3 = Safe-Request -Method POST -Uri "$BaseUrl/other-cost" -Headers $h -Body $oc3Body -Label "CreateOC3"
if ($oc3 -and $oc3._id) {
    $oc3Id = $oc3._id
    Write-Pass "Other cost #3 created: $oc3Id (internet, 800K)"
} else { Write-Fail "Create other cost #3 failed" }

Write-Step "4.4" "List other costs"
$ocList = Safe-Request -Method GET -Uri "$BaseUrl/other-cost?from=2026-02-01&to=2026-02-28" -Headers $h -Label "ListOC"
if ($ocList) {
    $ocs = if ($ocList -is [array]) { $ocList } elseif ($ocList.data) { $ocList.data } else { @($ocList) }
    Write-Pass "Other costs found: $($ocs.Count)"
} else { Write-Fail "List other costs failed" }

Write-Step "4.5" "Get single other cost"
if ($oc1Id) {
    $ocGet = Safe-Request -Method GET -Uri "$BaseUrl/other-cost/$oc1Id" -Headers $h -Label "GetOC"
    if ($ocGet -and $ocGet._id) { Write-Pass "Get other cost OK: $($ocGet.category) = $($ocGet.amount)" }
    else { Write-Fail "Get other cost failed" }
}

Write-Step "4.6" "Update other cost #1"
if ($oc1Id) {
    $ocUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/other-cost/$oc1Id" -Headers $h -Body '{"amount":16000000,"notes":"Updated rent amount"}' -Label "UpdateOC"
    if ($ocUpd) { Write-Pass "Other cost updated: 15M -> 16M" } else { Write-Fail "Update other cost failed" }
}

Write-Step "4.7" "Confirm other cost #2"
if ($oc2Id) {
    $ocConf = Safe-Request -Method PATCH -Uri "$BaseUrl/other-cost/$oc2Id/confirm" -Headers $h -Label "ConfirmOC"
    if ($ocConf) { Write-Pass "Other cost #2 confirmed" } else { Write-Fail "Confirm other cost failed" }
}

Write-Step "4.8" "Other cost summary"
$ocSum = Safe-Request -Method GET -Uri "$BaseUrl/other-cost/summary?from=2026-02-01&to=2026-02-28" -Headers $h -Label "OCSummary"
if ($ocSum) { Write-Pass "Other cost summary OK" } else { Write-Fail "Other cost summary failed" }

Write-Step "4.9" "Other cost cashflow"
$ocCF = Safe-Request -Method GET -Uri "$BaseUrl/other-cost/summary/cashflow" -Headers $h -Label "OCCashflow"
if ($ocCF -ne $null) { Write-Pass "Other cost cashflow OK" } else { Write-Fail "Other cost cashflow failed" }

Write-Step "4.10" "Export CSV"
$ocCSV = Safe-Request -Method GET -Uri "$BaseUrl/other-cost/export/csv?from=2026-02-01&to=2026-02-28" -Headers $h -Label "OCCSV"
if ($ocCSV -ne $null) { Write-Pass "Other cost CSV export OK" } else { Write-Fail "CSV export failed" }

Write-Step "4.11" "Delete other cost #3"
if ($oc3Id) {
    $ocDel = Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$oc3Id" -Headers $h -Label "DeleteOC3"
    if ($ocDel -ne $null) { Write-Pass "Other cost #3 deleted" } else { Write-Fail "Delete other cost failed" }
}

# ===== CLEANUP =====
Write-Section "PHASE 5: Cleanup"
Write-Step "5.1" "Cleanup test labor costs"
if ($lc1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/$lc1Id" -Headers $h -Label "CleanLC1" | Out-Null; Write-Info "Deleted lc1" }
if ($lc2Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/$lc2Id" -Headers $h -Label "CleanLC2" | Out-Null; Write-Info "Deleted lc2" }

Write-Step "5.2" "Cleanup test labor statement"
if ($ls1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/statements/$ls1Id" -Headers $h -Label "CleanLS1" | Out-Null; Write-Info "Deleted ls1" }

Write-Step "5.3" "Cleanup test other costs"
if ($oc1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$oc1Id" -Headers $h -Label "CleanOC1" | Out-Null; Write-Info "Deleted oc1" }
if ($oc2Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$oc2Id" -Headers $h -Label "CleanOC2" | Out-Null; Write-Info "Deleted oc2" }

# ===== SUMMARY =====
Write-Section "KET QUA - LABOR COST & OTHER COST MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
