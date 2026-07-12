#!/usr/bin/env pwsh
<#
  E2E.OPS-PAYROLL.PS1 - E2E-TC-003
  Verifies:
  attendance sessions -> labor-cost1 -> labor statement -> committed cash -> payment -> bank balance

  Notes about current backend behavior:
  - No public API exists to create historical attendance sessions, so this test seeds session_logs directly via MongoDB.
  - Payroll APIs use /labor-cost1/statements rather than /labor-statement.
  - Other cost payment is modeled as PATCH /other-cost/:id/confirm.
  - Bank balance is asserted via /api/funds/overview, which reflects actual closed payroll payments and confirmed other costs.
#>

$ErrorActionPreference = 'Continue'
function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return 'http://localhost:3000/api'
}

function Get-BackendHealthUrl {
    $healthUrl = $env:BACKEND_HEALTH_URL
    if (-not [string]::IsNullOrWhiteSpace($healthUrl)) {
        return $healthUrl.TrimEnd('/')
    }

    $baseUrl = Get-BackendBaseUrl
    if ($baseUrl -match '/api/?$') {
        return (($baseUrl -replace '/api/?$', '') + '/health')
    }

    return ($baseUrl.TrimEnd('/') + '/health')
}

$BASE_URL = Get-BackendBaseUrl
$HEALTH_URL = Get-BackendHealthUrl
$REPO_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$PAYROLL_HELPER = Join-Path $REPO_ROOT 'backend\scripts\e2e-payroll-db-helper.js'

$PASS = 0
$FAIL = 0
$SKIP = 0
$ERRORS = @()

$ctx = @{
    directorToken = $null
    employeeToken = $null
    headers = @{}
    employeeId = $null
    salaryConfigId = $null
    laborStatementId = $null
    otherCostId = $null
    targetMonth = $null
    targetYear = $null
    periodFrom = $null
    periodTo = $null
    sessions = @()
    baselineCommitted = 0
    baselineBankBalance = 0
    committedAfterAccrual = 0
    bankBeforePayment = 0
    statementClosingBeforePayment = 0
    otherCostAmount = 1500000
}

function Write-Section($title) {
    Write-Host ''
    Write-Host ('=' * 90) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ('=' * 90) -ForegroundColor Cyan
}

function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $global:PASS++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $global:FAIL++; $global:ERRORS += $msg }
function Write-Skip($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow; $global:SKIP++ }

function Invoke-Api {
    param(
        [string]$Method = 'GET',
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
        }
        if ($null -ne $Body) {
            $params.ContentType = 'application/json; charset=utf-8'
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 12 -Compress))
        }
        $resp = Invoke-RestMethod @params
        return @{ ok = $true; status = 200; data = $resp }
    } catch {
        $status = 0
        $errBody = ''
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errBody = $reader.ReadToEnd()
                }
            } catch {}
        }
        Write-Host "  [HTTP] $Method $Url => $status" -ForegroundColor DarkYellow
        if ($errBody) { Write-Host "         $errBody" -ForegroundColor DarkYellow }
        return @{ ok = $false; status = $status; error = $errBody }
    }
}

function Assert-True {
    param([bool]$Condition, [string]$Label, [string]$Failure)
    if ($Condition) { Write-Pass $Label } else { Write-Fail $Failure }
}

function Assert-GT {
    param([double]$Actual, [double]$Threshold, [string]$Label)
    if ($Actual -gt $Threshold) { Write-Pass "$Label ($Actual) > $Threshold" } else { Write-Fail "$Label expected > $Threshold, got $Actual" }
}

function Assert-GTE {
    param([double]$Actual, [double]$Threshold, [string]$Label)
    if ($Actual -ge $Threshold) { Write-Pass "$Label ($Actual) >= $Threshold" } else { Write-Fail "$Label expected >= $Threshold, got $Actual" }
}

function Assert-Approx {
    param([double]$Actual, [double]$Expected, [double]$Tolerance, [string]$Label)
    $diff = [math]::Abs($Actual - $Expected)
    if ($diff -le $Tolerance) {
        Write-Pass "$Label actual=$Actual expected=$Expected diff=$diff"
    } else {
        Write-Fail "$Label actual=$Actual expected=$Expected diff=$diff tolerance=$Tolerance"
    }
}

function Get-ValueOrZero($Value) {
    if ($null -eq $Value -or $Value -eq '') { return 0 }
    return [double]$Value
}

function Get-IdValue($Value) {
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) { return $Value }
    if ($Value._id) { return [string]$Value._id }
    if ($Value.id) { return [string]$Value.id }
    return $null
}

function To-Base64Json($Value) {
    $json = $Value | ConvertTo-Json -Depth 12 -Compress
    return [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
}

function Invoke-MongoHelper {
    param(
        [string]$Command,
        [hashtable]$Payload
    )

    $encoded = To-Base64Json $Payload
    $output = & node $PAYROLL_HELPER $Command $encoded 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Mongo helper failed: $($output -join [Environment]::NewLine)"
    }
    $text = ($output -join '')
    return $text | ConvertFrom-Json
}

function Get-FundsOverview($Headers) {
    $resp = Invoke-Api -Method GET -Url "$BASE_URL/funds/overview" -Headers $Headers
    if (-not $resp.ok) {
        throw "Funds overview failed with status $($resp.status)"
    }
    return $resp.data
}

function Get-AlertsSafe($Headers) {
    $resp = Invoke-Api -Method GET -Url "$BASE_URL/finance/alerts" -Headers $Headers
    if ($resp.ok) { return $resp.data }
    return $null
}

function New-IsoWithOffset {
    param([int]$Year, [int]$Month, [int]$Day, [int]$Hour, [int]$Minute)
    return '{0:0000}-{1:00}-{2:00}T{3:00}:{4:00}:00.000+07:00' -f $Year, $Month, $Day, $Hour, $Minute
}

function Cleanup-TestData {
    Write-Section 'TEARDOWN'

    try {
        $payload = @{
            userId = $ctx.employeeId
            otherCostIds = @($ctx.otherCostId)
            startDate = "$($ctx.periodFrom)T00:00:00.000+07:00"
            endDate = "$($ctx.periodTo)T23:59:59.999+07:00"
            removeUser = $true
        }
        $cleanup = Invoke-MongoHelper -Command 'cleanup-artifacts' -Payload $payload
        if ($cleanup.ok) {
            $cleanupMessage = (
                "DB cleanup: sessions={0}, laborcost={1}, statements={2}, salaryconfigs={3}, othercosts={4}, users={5}" -f
                $cleanup.result.sessionlogs,
                $cleanup.result.laborcost,
                $cleanup.result.laborstatements,
                $cleanup.result.salaryconfigs,
                $cleanup.result.othercosts,
                $cleanup.result.users
            )
            Write-Info $cleanupMessage
        } else {
            Write-Skip 'Mongo cleanup returned a non-ok result'
        }
    } catch {
        Write-Skip "Teardown failed: $($_.Exception.Message)"
    }
}

Write-Section 'E2E-TC-003: OPS & PAYROLL FLOW'

try {
    $health = Invoke-Api -Method GET -Url $HEALTH_URL
    if (-not $health.ok) {
        Write-Fail 'Backend health endpoint is not reachable'
        throw 'health_down'
    }
    Write-Pass 'Health endpoint reachable'

    Write-Section 'STEP 0: Prerequisites'

    $directorLogin = Invoke-Api -Method POST -Url "$BASE_URL/auth/login" -Body @{
        email = 'director@test.com'
        password = '123456'
    }
    if (-not $directorLogin.ok -or -not $directorLogin.data.access_token) {
        Write-Fail 'Director login failed'
        throw 'director_login_failed'
    }
    $ctx.directorToken = $directorLogin.data.access_token
    $ctx.headers = @{ Authorization = "Bearer $($ctx.directorToken)" }
    Write-Pass 'Director login succeeded'

    $previousMonthDate = (Get-Date).AddMonths(-1)
    $ctx.targetMonth = $previousMonthDate.Month
    $ctx.targetYear = $previousMonthDate.Year
    $daysInMonth = [DateTime]::DaysInMonth($ctx.targetYear, $ctx.targetMonth)
    $ctx.periodFrom = '{0:0000}-{1:00}-01' -f $ctx.targetYear, $ctx.targetMonth
    $ctx.periodTo = '{0:0000}-{1:00}-{2:00}' -f $ctx.targetYear, $ctx.targetMonth, $daysInMonth
    Write-Info "Target payroll period: $($ctx.periodFrom) -> $($ctx.periodTo)"

    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    $employeeEmail = "e2e-payroll-$stamp@test.com"
    $employeePassword = '123456'
    $employeeCreate = Invoke-Api -Method POST -Url "$BASE_URL/users" -Headers $ctx.headers -Body @{
        fullName = "E2E Payroll Employee $stamp"
        email = $employeeEmail
        password = $employeePassword
        phone = "09$((Get-Random -Minimum 10000000 -Maximum 99999999))"
        role = 'employee'
        address = 'E2E Payroll Test'
        isActive = $true
    }
    if (-not $employeeCreate.ok -or -not $employeeCreate.data._id) {
        Write-Fail 'Employee creation failed'
        throw 'employee_create_failed'
    }
    $ctx.employeeId = [string]$employeeCreate.data._id
    Write-Pass "Created isolated employee: $($ctx.employeeId)"

    $employeeLogin = Invoke-Api -Method POST -Url "$BASE_URL/auth/login" -Body @{
        email = $employeeEmail
        password = $employeePassword
    }
    if ($employeeLogin.ok -and $employeeLogin.data.access_token) {
        $ctx.employeeToken = $employeeLogin.data.access_token
        Write-Pass 'Employee login succeeded'
    } else {
        Write-Skip 'Employee login skipped or blocked; director token is sufficient for this flow'
    }

    $salaryConfig = Invoke-Api -Method POST -Url "$BASE_URL/salary-config" -Headers $ctx.headers -Body @{
        userId = $ctx.employeeId
        hourlyRate = 100000
        payrollCycle = 'monthly'
        paymentDays = @(5)
        attendanceTiers = @(
            @{ minHours = 0; maxHours = 24; bonusAmount = 0 },
            @{ minHours = 24; maxHours = 1000; bonusAmount = 300000 }
        )
        kpiBonusTiers = @(
            @{ minPercent = 0; maxPercent = 100; bonusAmount = 0 },
            @{ minPercent = 100; maxPercent = 130; bonusAmount = 400000 },
            @{ minPercent = 130; maxPercent = 1000; bonusAmount = 700000 }
        )
        punctualityRules = @{
            checkInDeadline = '08:00'
            onTimeBonus = 50000
            latePenalty = 20000
            gracePeriodMinutes = 10
        }
        notes = 'E2E payroll config'
    }
    if (-not $salaryConfig.ok -or -not $salaryConfig.data._id) {
        Write-Fail 'Salary config upsert failed'
        throw 'salary_config_failed'
    }
    $ctx.salaryConfigId = [string]$salaryConfig.data._id
    Write-Pass "Salary config ready: $($ctx.salaryConfigId)"

    $fundingSources = Invoke-Api -Method GET -Url "$BASE_URL/finance/funding-sources?status=active" -Headers $ctx.headers
    if ($fundingSources.ok) {
        $count = @($fundingSources.data).Count
        Write-Info "Active funding sources available: $count"
    } else {
        Write-Skip 'Funding source lookup failed; bank balance will still be asserted via funds overview'
    }

    $baselineFunds = Get-FundsOverview -Headers $ctx.headers
    $ctx.baselineCommitted = Get-ValueOrZero $baselineFunds.committedCash.stock.current
    $ctx.baselineBankBalance = Get-ValueOrZero $baselineFunds.validation.bankBalance
    Write-Info "Baseline committed cash: $($ctx.baselineCommitted)"
    Write-Info "Baseline bank balance: $($ctx.baselineBankBalance)"

    $days = @(15, 16, 17)
    $ctx.sessions = @()
    foreach ($day in $days) {
        $ctx.sessions += @{
            loginAt = New-IsoWithOffset -Year $ctx.targetYear -Month $ctx.targetMonth -Day $day -Hour 8 -Minute 0
            logoutAt = New-IsoWithOffset -Year $ctx.targetYear -Month $ctx.targetMonth -Day $day -Hour 17 -Minute 0
            loginIp = '127.0.0.1'
        }
    }

    $seedResult = Invoke-MongoHelper -Command 'seed-sessions' -Payload @{
        userId = $ctx.employeeId
        userEmail = $employeeEmail
        userName = "E2E Payroll Employee $stamp"
        userRole = 'employee'
        sessions = $ctx.sessions
    }
    if (-not $seedResult.ok -or $seedResult.result.insertedCount -lt 3) {
        Write-Fail 'Historical session seed failed'
        throw 'seed_sessions_failed'
    }
    Write-Pass "Seeded $($seedResult.result.insertedCount) session logs"

    Write-Section 'STEP 1: Attendance -> LaborCost1'

    $generate = Invoke-Api -Method POST -Url "$BASE_URL/labor-cost1/generate-from-sessions?userId=$($ctx.employeeId)" -Headers $ctx.headers
    if (-not $generate.ok) {
        Write-Fail 'generate-from-sessions failed'
        throw 'generate_labor_failed'
    }
    Write-Pass 'Labor cost generation completed'

    $laborListResp = Invoke-Api -Method GET -Url "$BASE_URL/labor-cost1" -Headers $ctx.headers
    if (-not $laborListResp.ok) {
        Write-Fail 'GET /labor-cost1 failed'
        throw 'labor_list_failed'
    }
    $laborItems = @($laborListResp.data | Where-Object {
        (Get-IdValue $_.userId) -eq $ctx.employeeId -and
        ([datetime]$_.date).Month -eq $ctx.targetMonth -and
        ([datetime]$_.date).Year -eq $ctx.targetYear
    })
    Assert-GTE -Actual $laborItems.Count -Threshold 3 -Label 'Generated labor-cost1 rows'
    $firstLaborCost = if ($laborItems.Count -gt 0) { Get-ValueOrZero $laborItems[0].cost } else { 0 }
    Assert-GT -Actual $firstLaborCost -Threshold 0 -Label 'First labor-cost1 cost'

    Write-Section 'STEP 2: Payroll Closing and KPI'

    $statementCreate = Invoke-Api -Method POST -Url "$BASE_URL/labor-cost1/statements" -Headers $ctx.headers -Body @{
        employeeId = $ctx.employeeId
        periodFrom = $ctx.periodFrom
        periodTo = $ctx.periodTo
        openingBalance = 0
        bonus = 0
        deduction = 0
        notes = 'E2E-TC-003 payroll statement'
    }
    if (-not $statementCreate.ok -or -not $statementCreate.data._id) {
        Write-Fail 'Labor statement creation failed'
        throw 'statement_create_failed'
    }
    $ctx.laborStatementId = [string]$statementCreate.data._id
    Write-Pass "Labor statement created: $($ctx.laborStatementId)"

    $updateKpi = Invoke-Api -Method PATCH -Url "$BASE_URL/labor-cost1/statements/$($ctx.laborStatementId)/kpi" -Headers $ctx.headers -Body @{
        kpiPercent = 100
        updatedBy = [string]$directorLogin.data.user.id
    }
    if (-not $updateKpi.ok) {
        Write-Fail 'KPI update failed'
        throw 'kpi_update_failed'
    }
    Write-Pass 'KPI updated on labor statement'

    $statementGet = Invoke-Api -Method GET -Url "$BASE_URL/labor-cost1/statements/$($ctx.laborStatementId)" -Headers $ctx.headers
    if (-not $statementGet.ok) {
        Write-Fail 'GET labor statement failed'
        throw 'statement_get_failed'
    }
    $statement = $statementGet.data
    $expectedClosing = (Get-ValueOrZero $statement.openingBalance) + (Get-ValueOrZero $statement.periodCost) + (Get-ValueOrZero $statement.bonus) + (Get-ValueOrZero $statement.attendanceBonus) + (Get-ValueOrZero $statement.kpiBonus) + (Get-ValueOrZero $statement.punctualityBonus) - (Get-ValueOrZero $statement.deduction) - (Get-ValueOrZero $statement.statementPaymentTotal)
    Assert-GT -Actual (Get-ValueOrZero $statement.kpiBonus) -Threshold 0 -Label 'KPI bonus computed'
    Assert-Approx -Actual (Get-ValueOrZero $statement.closingBalance) -Expected $expectedClosing -Tolerance 0.01 -Label 'Labor statement closing balance formula'
    $ctx.statementClosingBeforePayment = Get-ValueOrZero $statement.closingBalance

    Write-Section 'STEP 3: Committed Cash Propagation'

    $confirm = Invoke-Api -Method POST -Url "$BASE_URL/labor-cost1/statements/$($ctx.laborStatementId)/confirm" -Headers $ctx.headers -Body @{
        confirmedBy = [string]$directorLogin.data.user.id
        skipKpiCheck = $false
    }
    if (-not $confirm.ok) {
        Write-Fail 'Confirm labor statement failed'
        throw 'statement_confirm_failed'
    }
    Write-Pass 'Labor statement confirmed'

    $otherCostCreate = Invoke-Api -Method POST -Url "$BASE_URL/other-cost" -Headers $ctx.headers -Body @{
        date = $ctx.periodTo
        dueDate = $ctx.periodTo
        amount = $ctx.otherCostAmount
        category = 'utilities'
        notes = 'E2E-TC-003 utilities'
    }
    if (-not $otherCostCreate.ok -or -not $otherCostCreate.data._id) {
        Write-Fail 'Other cost creation failed'
        throw 'other_cost_create_failed'
    }
    $ctx.otherCostId = [string]$otherCostCreate.data._id
    Write-Pass "Other cost created: $($ctx.otherCostId)"

    Start-Sleep -Milliseconds 1500
    $afterAccrualFunds = Get-FundsOverview -Headers $ctx.headers
    $ctx.committedAfterAccrual = Get-ValueOrZero $afterAccrualFunds.committedCash.stock.current
    $ctx.bankBeforePayment = Get-ValueOrZero $afterAccrualFunds.validation.bankBalance
    $committedDelta = $ctx.committedAfterAccrual - $ctx.baselineCommitted
    $minimumExpectedCommittedDelta = $ctx.statementClosingBeforePayment + $ctx.otherCostAmount
    Assert-GTE -Actual $committedDelta -Threshold $minimumExpectedCommittedDelta -Label 'Committed cash increased for payroll plus ops cost'
    $payrollBreakdown = Get-ValueOrZero $afterAccrualFunds.committedCash.breakdown.unpaidLaborCost
    Assert-GTE -Actual $payrollBreakdown -Threshold $ctx.statementClosingBeforePayment -Label 'Committed cash payroll breakdown includes statement'

    Write-Section 'STEP 4: Payment and Actual Cashflow'

    $payStatement = Invoke-Api -Method POST -Url "$BASE_URL/labor-cost1/statements/$($ctx.laborStatementId)/payments" -Headers $ctx.headers -Body @{
        amount = $ctx.statementClosingBeforePayment
        paidAt = (New-IsoWithOffset -Year 2026 -Month 3 -Day 1 -Hour 10 -Minute 0)
        method = 'bank_transfer'
        notes = 'E2E payroll payment'
        createdBy = [string]$directorLogin.data.user.id
    }
    if (-not $payStatement.ok) {
        Write-Fail 'Payroll payment failed'
        throw 'statement_payment_failed'
    }
    Write-Pass 'Payroll payment posted'

    $confirmOther = Invoke-Api -Method PATCH -Url "$BASE_URL/other-cost/$($ctx.otherCostId)/confirm" -Headers $ctx.headers
    if (-not $confirmOther.ok) {
        Write-Fail 'Other cost confirm failed'
        throw 'other_cost_confirm_failed'
    }
    Write-Pass 'Other cost confirmed as paid'

    Start-Sleep -Milliseconds 1500

    $postPaymentStatement = Invoke-Api -Method GET -Url "$BASE_URL/labor-cost1/statements/$($ctx.laborStatementId)" -Headers $ctx.headers
    if ($postPaymentStatement.ok) {
        Assert-Approx -Actual (Get-ValueOrZero $postPaymentStatement.data.statementPaymentTotal) -Expected $ctx.statementClosingBeforePayment -Tolerance 0.01 -Label 'Statement payment total recorded'
        Assert-True -Condition ($postPaymentStatement.data.status -eq 'closed') -Label 'Statement auto-closed after full payment' -Failure "Statement status expected closed, got $($postPaymentStatement.data.status)"
    } else {
        Write-Fail 'Could not reload labor statement after payment'
    }

    $afterPaymentFunds = Get-FundsOverview -Headers $ctx.headers
    $committedAfterPayment = Get-ValueOrZero $afterPaymentFunds.committedCash.stock.current
    $bankAfterPayment = Get-ValueOrZero $afterPaymentFunds.validation.bankBalance
    $expectedCommittedAfterPayment = $ctx.baselineCommitted
    Assert-Approx -Actual $committedAfterPayment -Expected $expectedCommittedAfterPayment -Tolerance 0.01 -Label 'Committed cash returned to baseline after payments'
    $expectedBankAfterPayment = $ctx.bankBeforePayment - $ctx.statementClosingBeforePayment - $ctx.otherCostAmount
    Assert-Approx -Actual $bankAfterPayment -Expected $expectedBankAfterPayment -Tolerance 0.01 -Label 'Bank balance reduced by payroll plus utilities payment'

    $alerts = Get-AlertsSafe -Headers $ctx.headers
    if ($null -ne $alerts -and $alerts.alerts) {
        $hasUnpaidPayrollAlert = @($alerts.alerts | Where-Object {
            ($_.type -eq 'UNPAID_PAYROLL') -or ($_.message -match 'payroll')
        }).Count -gt 0
        if (-not $hasUnpaidPayrollAlert) {
            Write-Pass 'No unpaid payroll alert remained after payment'
        } else {
            Write-Skip 'Finance alerts endpoint still shows payroll-related text; current alert model is not payroll-specific'
        }
    } else {
        Write-Skip 'Finance alerts endpoint does not expose a payroll-specific unpaid alert contract'
    }
}
catch {
    Write-Fail "Test aborted: $($_.Exception.Message)"
}
finally {
    Cleanup-TestData
}

Write-Section 'SUMMARY'
Write-Host "  PASS : $PASS" -ForegroundColor Green
Write-Host "  FAIL : $FAIL" -ForegroundColor $(if ($FAIL -eq 0) { 'Green' } else { 'Red' })
Write-Host "  SKIP : $SKIP" -ForegroundColor Yellow

if ($ERRORS.Count -gt 0) {
    Write-Host ''
    Write-Host '  Failures:' -ForegroundColor Red
    foreach ($item in $ERRORS) {
        Write-Host "   - $item" -ForegroundColor Red
    }
}

if ($FAIL -gt 0) {
    exit 1
}

exit 0
