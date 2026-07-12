#!/usr/bin/env pwsh
<#
  =====================================================================================
  MODULE.SALARY-LABOR-FINANCE-LINK.PS1
  =====================================================================================
  Integration test for relationship:
  1) Salary Config -> affects labor-cost calculations and labor statement bonuses
  2) Labor Statement / Payments -> affects labor cashflow summary
  3) Financial Control -> consumes labor summary into committed cash / monthly burn

  This script creates test data, validates cross-module relationships,
  then cleans up created records and restores config.
  =====================================================================================
#>

$ErrorActionPreference = "Continue"

function Get-BackendBaseUrl {
  $baseUrl = $env:BACKEND_BASE_URL
  if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
    return $baseUrl.TrimEnd('/')
  }
  return "http://localhost:3000/api"
}

$BaseUrl = Get-BackendBaseUrl

# ========== UTILITIES ==========
function Write-Section($title) {
  Write-Host ""
  Write-Host ("=" * 95) -ForegroundColor Cyan
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host ("=" * 95) -ForegroundColor Cyan
}

function Write-Step($step, $desc) {
  Write-Host ""
  Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow
}

function Write-Pass($msg) {
  Write-Host "  [PASS] $msg" -ForegroundColor Green
  $script:passCount++
}

function Write-Fail($msg) {
  Write-Host "  [FAIL] $msg" -ForegroundColor Red
  $script:failCount++
  $script:failDetails += $msg
}

function Write-Info($msg) {
  Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Safe-Request {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [string]$Label = ""
  )
  try {
    $params = @{
      Method      = $Method
      Uri         = $Uri
      Headers     = $Headers
      ContentType = "application/json; charset=utf-8"
    }
    if ($Body -and $Method -ne "GET") {
      $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
    }
    return (Invoke-RestMethod @params)
  } catch {
    $status = $null
    $errBody = ""
    try {
      $status = $_.Exception.Response.StatusCode.value__
      $errBody = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
    } catch { }
    Write-Host "  [ERROR] $Label - HTTP $status : $errBody" -ForegroundColor Red
    return $null
  }
}

function To-JsonBody($obj) {
  return ($obj | ConvertTo-Json -Depth 12)
}

function Get-IdString($val) {
  if ($null -eq $val) { return $null }
  if ($val -is [string]) { return $val }
  if ($val._id) { return [string]$val._id }
  return [string]$val
}

function Assert-Approx {
  param(
    [double]$Actual,
    [double]$Expected,
    [double]$Tolerance = 1,
    [string]$Label = ""
  )
  $diff = [Math]::Abs($Actual - $Expected)
  if ($diff -le $Tolerance) {
    Write-Pass "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
    return $true
  } else {
    Write-Fail "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
    return $false
  }
}

function Get-FinancialFullFresh {
  param(
    [hashtable]$Headers,
    [string]$Label = "FinancialFullFresh"
  )
  # financial-control has 30s cache TTL
  Write-Info "Wait 35s for Financial Control cache TTL..."
  Start-Sleep -Seconds 35
  return Safe-Request -Method GET -Uri "$BaseUrl/financial-control/full" -Headers $Headers -Label $Label
}

# ========== RUNTIME ==========
$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$createdLaborIds = @()
$createdStatementId = $null
$createdConfigId = $null
$employeeId = $null
$origSalaryConfig = $null
$origCommittedWindowDays = $null
$headers = @{}

# Dynamic period in old years to reduce collision risk while still counted as due/overdue
$now = Get-Date
$periodYear = 2000 + (($now.Minute % 20) + 1)    # 2001..2020
$periodMonth = (($now.Second % 12) + 1)          # 1..12
$periodDay1 = (($now.Minute % 20) + 1)           # 1..21
$periodDay2 = $periodDay1 + 1
$periodFrom = "{0:D4}-{1:D2}-{2:D2}" -f $periodYear, $periodMonth, $periodDay1
$periodTo   = "{0:D4}-{1:D2}-{2:D2}" -f $periodYear, $periodMonth, $periodDay2

Write-Section "INTEGRATION TEST: Salary Config -> Labor -> Financial Control ($ts)"
Write-Info "Period test: $periodFrom -> $periodTo"

try {
  # ===== 0) LOGIN =====
  Write-Section "PHASE 0: Login"
  Write-Step "0.1" "Login director account"
  $loginBody = '{"email":"director@test.com","password":"123456"}'
  $loginRes = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body $loginBody -Label "Login"
  if (-not $loginRes -or -not $loginRes.access_token) {
    Write-Fail "Cannot login with director@test.com"
    throw "Login failed"
  }
  $headers = @{ "Authorization" = "Bearer $($loginRes.access_token)" }
  Write-Pass "Login OK"

  # ===== 1) PREPARE SUBJECT USER =====
  Write-Section "PHASE 1: Prepare employee + backup configs"
  Write-Step "1.1" "Find employee user"
  $usersRes = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $headers -Label "GetUsers"
  $users = if ($usersRes -is [array]) { $usersRes } elseif ($usersRes.data) { $usersRes.data } else { @($usersRes) }
  $emp = $users | Where-Object { $_.role -eq "employee" } | Select-Object -First 1
  if (-not $emp) {
    $emp = $users | Where-Object { $_.role -ne "director" } | Select-Object -First 1
  }
  if (-not $emp) {
    Write-Fail "No suitable user found for labor test"
    throw "No employee user"
  }
  $employeeId = [string]$emp._id
  Write-Pass "Using employee: $employeeId ($($emp.fullName))"

  Write-Step "1.2" "Backup current salary config for selected employee"
  $cfgListRes = Safe-Request -Method GET -Uri "$BaseUrl/salary-config" -Headers $headers -Label "GetSalaryConfigList"
  $cfgList = if ($cfgListRes -is [array]) { $cfgListRes } elseif ($cfgListRes.data) { $cfgListRes.data } else { @($cfgListRes) }
  $origSalaryConfig = $cfgList | Where-Object {
    (Get-IdString $_.userId) -eq $employeeId
  } | Select-Object -First 1
  if ($origSalaryConfig) {
    Write-Pass "Backed up existing salary config: $($origSalaryConfig._id)"
  } else {
    Write-Info "No prior salary config for this employee"
  }

  Write-Step "1.3" "Backup financial-control config (CommittedWindowDays)"
  $fcConfig = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/config" -Headers $headers -Label "GetFcConfig"
  if ($fcConfig -and $fcConfig.CommittedWindowDays -ne $null) {
    $origCommittedWindowDays = [int]$fcConfig.CommittedWindowDays
    Write-Pass "Backup CommittedWindowDays=$origCommittedWindowDays"
  } else {
    Write-Fail "Cannot read financial-control config"
    throw "Cannot read financial-control config"
  }

  # ===== 2) SET TEST SALARY CONFIG =====
  Write-Section "PHASE 2: Set test Salary Config and create labor sessions"
  Write-Step "2.1" "Upsert salary config with deterministic rules"
  $testSalaryConfig = @{
    userId = $employeeId
    hourlyRate = 100000
    payrollCycle = "monthly"
    paymentDays = @(1)
    attendanceTiers = @(
      @{ minHours = 0; maxHours = 10; bonusAmount = 0 },
      @{ minHours = 10; maxHours = 1000; bonusAmount = 300000 }
    )
    kpiBonusTiers = @(
      @{ minPercent = 0; maxPercent = 80; bonusAmount = 0 },
      @{ minPercent = 80; maxPercent = 101; bonusAmount = 200000 }
    )
    punctualityRules = @{
      checkInDeadline = "08:00"
      onTimeBonus = 50000
      latePenalty = 20000
      gracePeriodMinutes = 0
    }
    notes = "Integration test $ts"
  }
  $cfgUpsert = Safe-Request -Method POST -Uri "$BaseUrl/salary-config" -Headers $headers -Body (To-JsonBody $testSalaryConfig) -Label "UpsertSalaryConfig"
  if (-not $cfgUpsert -or -not $cfgUpsert._id) {
    Write-Fail "Upsert salary config failed"
    throw "Salary config setup failed"
  }
  $createdConfigId = [string]$cfgUpsert._id
  Write-Pass "Salary config upserted: $createdConfigId"

  Write-Step "2.2" "Create labor-cost record #1 (on-time, 8h)"
  $lc1Body = @{
    date = $periodFrom
    userId = $employeeId
    startTime = "07:50"
    endTime = "15:50"
    notes = "IT salary-financial link #1 $ts"
  }
  $lc1 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $headers -Body (To-JsonBody $lc1Body) -Label "CreateLabor1"
  if (-not $lc1 -or -not $lc1._id) {
    Write-Fail "Create labor #1 failed"
    throw "Labor #1 failed"
  }
  $createdLaborIds += [string]$lc1._id
  Write-Pass "Labor #1 created: $($lc1._id)"
  Assert-Approx -Actual ([double]$lc1.workHours) -Expected 8 -Tolerance 0.01 -Label "Labor #1 workHours"
  Assert-Approx -Actual ([double]$lc1.cost) -Expected 800000 -Tolerance 1 -Label "Labor #1 cost from hourlyRate"

  Write-Step "2.3" "Create labor-cost record #2 (late, 8h)"
  $lc2Body = @{
    date = $periodTo
    userId = $employeeId
    startTime = "08:10"
    endTime = "16:10"
    notes = "IT salary-financial link #2 $ts"
  }
  $lc2 = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $headers -Body (To-JsonBody $lc2Body) -Label "CreateLabor2"
  if (-not $lc2 -or -not $lc2._id) {
    Write-Fail "Create labor #2 failed"
    throw "Labor #2 failed"
  }
  $createdLaborIds += [string]$lc2._id
  Write-Pass "Labor #2 created: $($lc2._id)"
  Assert-Approx -Actual ([double]$lc2.workHours) -Expected 8 -Tolerance 0.01 -Label "Labor #2 workHours"
  Assert-Approx -Actual ([double]$lc2.cost) -Expected 800000 -Tolerance 1 -Label "Labor #2 cost from hourlyRate"

  # ===== 3) CREATE STATEMENT + KPI =====
  Write-Section "PHASE 3: Labor statement reflects Salary Config rules"
  Write-Step "3.1" "Create labor statement from the two sessions"
  $stmtCreateBody = @{
    employeeId = $employeeId
    periodFrom = $periodFrom
    periodTo = $periodTo
    openingBalance = 0
    bonus = 0
    deduction = 0
    notes = "IT integration statement $ts"
  }
  $stmt = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements" -Headers $headers -Body (To-JsonBody $stmtCreateBody) -Label "CreateStatement"
  if (-not $stmt -or -not $stmt._id) {
    Write-Fail "Create statement failed (possible duplicate period or validation issue)"
    throw "Create statement failed"
  }
  $createdStatementId = [string]$stmt._id
  Write-Pass "Statement created: $createdStatementId"

  # Validate salary-config driven fields before KPI
  Assert-Approx -Actual ([double]$stmt.periodCost) -Expected 1600000 -Tolerance 1 -Label "periodCost = sum(workHours * hourlyRate)"
  Assert-Approx -Actual ([double]$stmt.totalWorkHours) -Expected 16 -Tolerance 0.01 -Label "totalWorkHours = 16h"
  Assert-Approx -Actual ([double]$stmt.attendanceBonus) -Expected 300000 -Tolerance 1 -Label "attendanceBonus from attendanceTiers"
  Assert-Approx -Actual ([double]$stmt.punctualityBonus) -Expected 30000 -Tolerance 1 -Label "punctualityBonus = onTimeBonus - latePenalty"
  Assert-Approx -Actual ([double]$stmt.closingBalance) -Expected 1930000 -Tolerance 1 -Label "closingBalance before KPI"

  Write-Step "3.2" "Update KPI to trigger KPI bonus from salary config"
  $kpiBody = @{ kpiPercent = 85; updatedBy = "integration-test" }
  $stmtAfterKpi = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/statements/$createdStatementId/kpi" -Headers $headers -Body (To-JsonBody $kpiBody) -Label "UpdateKPI"
  if (-not $stmtAfterKpi) {
    Write-Fail "Update KPI failed"
    throw "Update KPI failed"
  }
  Write-Pass "KPI updated"
  Assert-Approx -Actual ([double]$stmtAfterKpi.kpiBonus) -Expected 200000 -Tolerance 1 -Label "kpiBonus from kpiBonusTiers"
  Assert-Approx -Actual ([double]$stmtAfterKpi.closingBalance) -Expected 2130000 -Tolerance 1 -Label "closingBalance after KPI"

  # ===== 4) LABOR SUMMARY <-> FINANCIAL CONTROL =====
  Write-Section "PHASE 4: Labor summary propagates to Financial Control"
  Write-Step "4.1" "Set Financial Control CommittedWindowDays = 14 (supported snapshot window)"
  $fcPatch = Safe-Request -Method PATCH -Uri "$BaseUrl/financial-control/config" -Headers $headers -Body (To-JsonBody @{ CommittedWindowDays = 14 }) -Label "PatchFcConfig"
  if ($fcPatch -and $fcPatch.CommittedWindowDays -eq 14) {
    Write-Pass "CommittedWindowDays patched to 14"
  } else {
    Write-Fail "Failed to patch CommittedWindowDays"
    throw "FC config patch failed"
  }

  Write-Step "4.2" "Read labor cashflow summary before payment"
  $laborBeforePay = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cashflow?windowDays=14" -Headers $headers -Label "LaborSummaryBeforePay"
  if (-not $laborBeforePay) {
    Write-Fail "Cannot read labor summary before payment"
    throw "Labor summary before payment failed"
  }
  Write-Pass "Labor summary before payment fetched"
  $paidBefore = [double]$laborBeforePay.totalPayrollPaid
  $unpaidBefore = [double]$laborBeforePay.totalPayrollUnpaid
  $dueBefore = [double]$laborBeforePay.totalPayrollDue14d
  $laborBeforePay30 = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cashflow?windowDays=30" -Headers $headers -Label "LaborSummaryBeforePay30"
  $dueBefore30 = if ($laborBeforePay30) { [double]$laborBeforePay30.totalPayrollDue14d } else { $dueBefore }
  Write-Info "Before pay: paid=$paidBefore unpaid=$unpaidBefore due=$dueBefore"

  Write-Step "4.3" "Read Financial Control full before payment (fresh)"
  $fcBeforePay = Get-FinancialFullFresh -Headers $headers -Label "FcFullBeforePay"
  if (-not $fcBeforePay) {
    Write-Fail "Cannot read financial-control/full before payment"
    throw "FC before payment failed"
  }
  Write-Pass "Financial Control full before payment fetched"
  $fcLaborBefore = [double]$fcBeforePay.committedBreakdown.labor
  $fcBurnLaborBefore = [double]$fcBeforePay.monthlyBurnBreakdown.laborCore
  Write-Info "FC before pay: committed.labor=$fcLaborBefore burn.laborCore=$fcBurnLaborBefore"

  # FC committed labor should follow labor summary due
  Assert-Approx -Actual $fcLaborBefore -Expected $dueBefore -Tolerance 2 -Label "FC committedBreakdown.labor follows labor summary due"

  Write-Step "4.4" "Add labor payment 200,000 to statement"
  $payAmount = 200000
  $payBody = @{
    amount = $payAmount
    paidAt = (Get-Date).ToString("o")
    method = "bank_transfer"
    notes = "Integration payment $ts"
    createdBy = "integration-test"
  }
  $payRes = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1/statements/$createdStatementId/payments" -Headers $headers -Body (To-JsonBody $payBody) -Label "AddPayment"
  if (-not $payRes) {
    Write-Fail "Add payment failed"
    throw "Add payment failed"
  }
  Write-Pass "Payment added to statement"

  Write-Step "4.5" "Validate statement and labor summary after payment"
  $stmtAfterPay = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/statements/$createdStatementId" -Headers $headers -Label "GetStatementAfterPay"
  if (-not $stmtAfterPay) {
    Write-Fail "Cannot fetch statement after payment"
    throw "Cannot fetch statement after payment"
  }
  Assert-Approx -Actual ([double]$stmtAfterPay.statementPaymentTotal) -Expected $payAmount -Tolerance 1 -Label "statementPaymentTotal updated"
  Assert-Approx -Actual ([double]$stmtAfterPay.closingBalance) -Expected 1930000 -Tolerance 1 -Label "closingBalance reduced by payment"

  $laborAfterPay = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cashflow?windowDays=14" -Headers $headers -Label "LaborSummaryAfterPay"
  if (-not $laborAfterPay) {
    Write-Fail "Cannot read labor summary after payment"
    throw "Labor summary after payment failed"
  }
  $paidAfter = [double]$laborAfterPay.totalPayrollPaid
  $unpaidAfter = [double]$laborAfterPay.totalPayrollUnpaid
  $dueAfter = [double]$laborAfterPay.totalPayrollDue14d
  $laborAfterPay30 = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1/summary/cashflow?windowDays=30" -Headers $headers -Label "LaborSummaryAfterPay30"
  $dueAfter30 = if ($laborAfterPay30) { [double]$laborAfterPay30.totalPayrollDue14d } else { $dueAfter }
  Write-Info "After pay: paid=$paidAfter unpaid=$unpaidAfter due=$dueAfter"

  Assert-Approx -Actual ($paidAfter - $paidBefore) -Expected $payAmount -Tolerance 2 -Label "Labor summary paid delta equals payment"
  Assert-Approx -Actual ($unpaidBefore - $unpaidAfter) -Expected $payAmount -Tolerance 2 -Label "Labor summary unpaid delta equals payment"
  Assert-Approx -Actual ($dueBefore - $dueAfter) -Expected $payAmount -Tolerance 2 -Label "Labor summary due delta equals payment"

  Write-Step "4.6" "Read Financial Control full after payment (fresh)"
  $fcAfterPay = Get-FinancialFullFresh -Headers $headers -Label "FcFullAfterPay"
  if (-not $fcAfterPay) {
    Write-Fail "Cannot read financial-control/full after payment"
    throw "FC after payment failed"
  }
  $fcLaborAfter = [double]$fcAfterPay.committedBreakdown.labor
  $fcBurnLaborAfter = [double]$fcAfterPay.monthlyBurnBreakdown.laborCore
  Write-Info "FC after pay: committed.labor=$fcLaborAfter burn.laborCore=$fcBurnLaborAfter"

  Assert-Approx -Actual $fcLaborAfter -Expected $dueAfter -Tolerance 2 -Label "FC committedBreakdown.labor follows updated labor summary due"
  Assert-Approx -Actual $fcBurnLaborAfter -Expected $dueAfter30 -Tolerance 2 -Label "FC monthlyBurnBreakdown.laborCore follows updated labor summary due30"

} finally {
  # ===== CLEANUP =====
  Write-Section "CLEANUP: Restore configs and delete test data"

  # 1) Delete statement if created (only draft can be deleted - this script keeps draft)
  if ($createdStatementId) {
    Write-Step "C1" "Delete created labor statement"
    $delStmt = Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/statements/$createdStatementId" -Headers $headers -Label "DeleteStatement"
    if ($delStmt -ne $null) {
      Write-Pass "Deleted statement: $createdStatementId"
    } else {
      Write-Fail "Failed to delete statement: $createdStatementId"
    }
  }

  # 2) Delete created labor costs
  if ($createdLaborIds.Count -gt 0) {
    Write-Step "C2" "Delete created labor-cost records"
    foreach ($id in $createdLaborIds) {
      $delLc = Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/$id" -Headers $headers -Label "DeleteLaborCost:$id"
      if ($delLc -ne $null) {
        Write-Pass "Deleted labor-cost: $id"
      } else {
        Write-Fail "Failed to delete labor-cost: $id"
      }
    }
  }

  # 3) Restore salary config
  if ($headers.Count -gt 0 -and $employeeId) {
    Write-Step "C3" "Restore salary config"
    if ($origSalaryConfig) {
      $restoreBody = @{
        userId = $employeeId
        hourlyRate = [double]$origSalaryConfig.hourlyRate
      }
      if ($null -ne $origSalaryConfig.payrollCycle) { $restoreBody.payrollCycle = $origSalaryConfig.payrollCycle }
      if ($null -ne $origSalaryConfig.paymentDays) { $restoreBody.paymentDays = $origSalaryConfig.paymentDays }
      if ($null -ne $origSalaryConfig.attendanceTiers) {
        $restoreBody.attendanceTiers = @(
          $origSalaryConfig.attendanceTiers | ForEach-Object {
            @{
              minHours = [double]$_.minHours
              maxHours = [double]$_.maxHours
              bonusAmount = [double]$_.bonusAmount
            }
          }
        )
      }
      if ($null -ne $origSalaryConfig.kpiBonusTiers) {
        $restoreBody.kpiBonusTiers = @(
          $origSalaryConfig.kpiBonusTiers | ForEach-Object {
            @{
              minPercent = [double]$_.minPercent
              maxPercent = [double]$_.maxPercent
              bonusAmount = [double]$_.bonusAmount
            }
          }
        )
      }
      if ($null -ne $origSalaryConfig.punctualityRules) {
        $restoreBody.punctualityRules = @{
          checkInDeadline = [string]$origSalaryConfig.punctualityRules.checkInDeadline
          onTimeBonus = [double]$origSalaryConfig.punctualityRules.onTimeBonus
          latePenalty = [double]$origSalaryConfig.punctualityRules.latePenalty
          gracePeriodMinutes = [int]$origSalaryConfig.punctualityRules.gracePeriodMinutes
        }
      }
      if ($null -ne $origSalaryConfig.notes) { $restoreBody.notes = $origSalaryConfig.notes } else { $restoreBody.notes = "restored by integration test" }

      $restoreCfg = Safe-Request -Method POST -Uri "$BaseUrl/salary-config" -Headers $headers -Body (To-JsonBody $restoreBody) -Label "RestoreSalaryConfig"
      if ($restoreCfg -and $restoreCfg._id) {
        Write-Pass "Salary config restored to original state"
      } else {
        Write-Fail "Failed to restore original salary config"
      }
    } elseif ($createdConfigId) {
      $rmCfg = Safe-Request -Method DELETE -Uri "$BaseUrl/salary-config/$createdConfigId" -Headers $headers -Label "DeleteCreatedSalaryConfig"
      if ($rmCfg -ne $null) {
        Write-Pass "Deleted temporary salary config: $createdConfigId"
      } else {
        Write-Fail "Failed to delete temporary salary config: $createdConfigId"
      }
    }
  }

  # 4) Restore Financial Control CommittedWindowDays
  if ($headers.Count -gt 0 -and $origCommittedWindowDays -ne $null) {
    Write-Step "C4" "Restore Financial Control CommittedWindowDays"
    $restoreFc = Safe-Request -Method PATCH -Uri "$BaseUrl/financial-control/config" -Headers $headers -Body (To-JsonBody @{ CommittedWindowDays = $origCommittedWindowDays }) -Label "RestoreFcConfig"
    if ($restoreFc -and $restoreFc.CommittedWindowDays -eq $origCommittedWindowDays) {
      Write-Pass "CommittedWindowDays restored to $origCommittedWindowDays"
    } else {
      Write-Fail "Failed to restore CommittedWindowDays"
    }
  }
}

# ===== FINAL SUMMARY =====
Write-Section "FINAL SUMMARY"
Write-Host "  PASS : $script:passCount" -ForegroundColor Green
Write-Host "  FAIL : $script:failCount" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Red" })
if ($script:failDetails.Count -gt 0) {
  Write-Host "  Failure details:" -ForegroundColor Yellow
  foreach ($f in $script:failDetails) {
    Write-Host "   - $f" -ForegroundColor Yellow
  }
}
Write-Host ""
if ($script:failCount -eq 0) {
  Write-Host "  RESULT: RELATION TEST PASSED" -ForegroundColor Green
} else {
  Write-Host "  RESULT: RELATION TEST HAS FAILURES" -ForegroundColor Red
}
Write-Host ""
