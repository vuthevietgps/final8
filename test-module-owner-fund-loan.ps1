#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-MODULE-OWNER-FUND-LOAN.ps1
    =====================================================================================
    Test Owner Fund & Loan Management modules:
    1. Owner CRUD (create, list, get, update, delete)
    2. Withdrawal lifecycle (create -> approve -> complete / reject / cancel)
    3. Fund account operations (transfer-in, transfer-out, withdraw)
    4. Owner statistics, fund summary
    5. Loan lifecycle (create -> disburse -> repay -> close)
    6. Loan summaries & upcoming repayments
    7. Funding Sources & Cashflow entries
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

Write-Section "MODULE TEST: OWNER FUND & LOAN MANAGEMENT - $ts"

# ===== LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
    $directorId = if ($lr.user._id) { $lr.user._id } else { $lr.user.id }
} else { Write-Fail "Login failed"; exit 1 }

# ===== PHASE 1: OWNER CRUD =====
Write-Section "PHASE 1: Owner CRUD"

Write-Step "1.1" "Create Owner #1"
$ow1Body = @{
    name = "Test Owner Alpha $ts"
    email = "owner.alpha.test@example.com"
    phone = "0901111111"
    profitSharePercentage = 60
    bankAccount = "1234567890"
    bankName = "Vietcombank"
    bankAccountName = "TEST OWNER ALPHA"
    isActive = $true
    notes = "Test owner created by automation"
} | ConvertTo-Json
$ow1 = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/owners" -Headers $h -Body $ow1Body -Label "CreateOwner1"
if ($ow1 -and $ow1._id) {
    $ow1Id = $ow1._id
    Write-Pass "Owner #1 created: $ow1Id ($($ow1.name))"
} else { Write-Fail "Create owner #1 failed" }

Write-Step "1.2" "Create Owner #2"
$ow2Body = @{
    name = "Test Owner Beta $ts"
    email = "owner.beta.test@example.com"
    profitSharePercentage = 40
    isActive = $true
} | ConvertTo-Json
$ow2 = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/owners" -Headers $h -Body $ow2Body -Label "CreateOwner2"
if ($ow2 -and $ow2._id) {
    $ow2Id = $ow2._id
    Write-Pass "Owner #2 created: $ow2Id"
} else { Write-Fail "Create owner #2 failed" }

Write-Step "1.3" "List owners"
$owList = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners" -Headers $h -Label "ListOwners"
if ($owList) {
    $owners = if ($owList -is [array]) { $owList } elseif ($owList.data) { $owList.data } else { @($owList) }
    Write-Pass "Owners found: $($owners.Count)"
} else { Write-Fail "List owners failed" }

Write-Step "1.4" "Get owner #1"
if ($ow1Id) {
    $owGet = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id" -Headers $h -Label "GetOwner"
    if ($owGet -and $owGet._id) { Write-Pass "Get owner OK: $($owGet.name), share=$($owGet.profitSharePercentage)%" }
    else { Write-Fail "Get owner failed" }
}

Write-Step "1.5" "Update owner #1"
if ($ow1Id) {
    $owUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/owner-fund/owners/$ow1Id" -Headers $h -Body '{"notes":"Updated by automation test","profitSharePercentage":55}' -Label "UpdateOwner"
    if ($owUpd) { Write-Pass "Owner updated: share 60% -> 55%" } else { Write-Fail "Update owner failed" }
}

Write-Step "1.6" "Owner statistics"
if ($ow1Id) {
    $owStats = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/statistics" -Headers $h -Label "OwnerStats"
    if ($owStats -ne $null) { Write-Pass "Owner statistics OK" } else { Write-Fail "Owner statistics failed" }
}

Write-Step "1.7" "Owner transactions"
if ($ow1Id) {
    $owTx = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTx"
    if ($owTx -ne $null) { Write-Pass "Owner transactions OK" } else { Write-Fail "Owner transactions failed" }
}

# ===== PHASE 2: WITHDRAWAL LIFECYCLE =====
Write-Section "PHASE 2: Withdrawal Lifecycle"

# First, deposit money into the owner's fund so there's balance for withdrawal
Write-Step "2.0" "Deposit funds into owner (pre-requisite)"
if ($ow1Id) {
    $depositBody = @{
        ownerId = $ow1Id
        type = "in"
        category = "capital_contribution"
        amount = 50000000
        description = "Initial capital deposit for test"
    } | ConvertTo-Json
    $deposit = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/transactions" -Headers $h -Body $depositBody -Label "DepositFund"
    if ($deposit -and $deposit._id) { Write-Pass "Deposited 50M into owner fund" }
    else { Write-Info "Deposit may have failed - withdrawals may fail" }
}

Write-Step "2.1" "Create withdrawal request"
if ($ow1Id) {
    $wdBody = @{
        ownerId = $ow1Id
        amount = 5000000
        type = "profit_share"
        reason = "Rut loi nhuan thang 2"
        bankAccount = "1234567890"
        bankName = "Vietcombank"
    } | ConvertTo-Json
    $wd1 = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals" -Headers $h -Body $wdBody -Label "CreateWithdrawal"
    if ($wd1 -and $wd1._id) {
        $wd1Id = $wd1._id
        Write-Pass "Withdrawal created: $wd1Id (5M, status=$($wd1.status))"
    } else { Write-Fail "Create withdrawal failed" }
}

Write-Step "2.2" "Approve withdrawal"
if ($wd1Id) {
    $appBody = @{ approvedBy = $directorId; approvalNotes = "Approved by test" } | ConvertTo-Json
    $app = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals/$wd1Id/approve" -Headers $h -Body $appBody -Label "ApproveWD"
    if ($app) { Write-Pass "Withdrawal approved" } else { Write-Fail "Approve withdrawal failed" }
}

Write-Step "2.3" "Complete withdrawal"
if ($wd1Id) {
    $compBody = @{ transactionReference = "TXN-TEST-$ts" } | ConvertTo-Json
    $comp = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals/$wd1Id/complete" -Headers $h -Body $compBody -Label "CompleteWD"
    if ($comp) { Write-Pass "Withdrawal completed" } else { Write-Fail "Complete withdrawal failed" }
}

Write-Step "2.4" "Create second withdrawal (to reject)"
if ($ow1Id) {
    $wd2Body = @{
        ownerId = $ow1Id
        amount = 3000000
        type = "emergency"
        reason = "Emergency withdrawal - will reject"
    } | ConvertTo-Json
    $wd2 = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals" -Headers $h -Body $wd2Body -Label "CreateWD2"
    if ($wd2 -and $wd2._id) {
        $wd2Id = $wd2._id
        Write-Pass "Withdrawal #2 created: $wd2Id (3M)"
    } else { Write-Fail "Create withdrawal #2 failed" }
}

Write-Step "2.5" "Reject withdrawal #2"
if ($wd2Id) {
    $rejBody = @{ approvedBy = $directorId; approvalNotes = "Amount too high - rejected by test" } | ConvertTo-Json
    $rej = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals/$wd2Id/reject" -Headers $h -Body $rejBody -Label "RejectWD"
    if ($rej) { Write-Pass "Withdrawal #2 rejected" } else { Write-Fail "Reject withdrawal failed" }
}

Write-Step "2.6" "Create third withdrawal (to cancel)"
if ($ow1Id) {
    $wd3Body = @{
        ownerId = $ow1Id
        amount = 2000000
        type = "advance"
        reason = "Advance withdrawal - will cancel"
    } | ConvertTo-Json
    $wd3 = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals" -Headers $h -Body $wd3Body -Label "CreateWD3"
    if ($wd3 -and $wd3._id) {
        $wd3Id = $wd3._id
        Write-Pass "Withdrawal #3 created: $wd3Id"
    } else { Write-Fail "Create withdrawal #3 failed" }
}

Write-Step "2.7" "Cancel withdrawal #3"
if ($wd3Id) {
    $can = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals/$wd3Id/cancel" -Headers $h -Label "CancelWD"
    if ($can) { Write-Pass "Withdrawal #3 cancelled" } else { Write-Fail "Cancel withdrawal failed" }
}

Write-Step "2.8" "List withdrawals"
$wdList = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/withdrawals" -Headers $h -Label "ListWD"
if ($wdList) {
    $wds = if ($wdList -is [array]) { $wdList } elseif ($wdList.data) { $wdList.data } else { @($wdList) }
    Write-Pass "Withdrawals found: $($wds.Count)"
} else { Write-Fail "List withdrawals failed" }

# ===== PHASE 3: FUND ACCOUNT =====
Write-Section "PHASE 3: Fund Account"

Write-Step "3.1" "Get fund account"
$fa = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-account" -Headers $h -Label "GetFundAccount"
if ($fa -ne $null) { Write-Pass "Fund account OK" } else { Write-Fail "Get fund account failed" }

Write-Step "3.2" "System statistics"
$sysStat = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/statistics/system" -Headers $h -Label "SysStats"
if ($sysStat -ne $null) { Write-Pass "System statistics OK" } else { Write-Fail "System stats failed" }

Write-Step "3.3" "Fund summary"
$fundSum = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummary"
if ($fundSum -ne $null) { Write-Pass "Fund summary OK" } else { Write-Fail "Fund summary failed" }

# ===== PHASE 4: LOAN MANAGEMENT =====
Write-Section "PHASE 4: Loan Management"

Write-Step "4.1" "Create loan contract"
$loanBody = @{
    name = "Test Loan VCB $ts"
    lenderName = "Vietcombank"
    principal = 100000000
    interestRate = 12
    repaymentCycle = "monthly"
    startDate = "2026-02-01"
    endDate = "2027-02-01"
    status = "active"
    notes = "Test loan created by automation"
} | ConvertTo-Json
$loan1 = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans" -Headers $h -Body $loanBody -Label "CreateLoan"
if ($loan1 -and $loan1._id) {
    $loan1Id = $loan1._id
    Write-Pass "Loan created: $loan1Id ($($loan1.name), principal=$($loan1.principal))"
} else { Write-Fail "Create loan failed" }

Write-Step "4.2" "List loans"
$loanList = Safe-Request -Method GET -Uri "$BaseUrl/finance/loans" -Headers $h -Label "ListLoans"
if ($loanList) {
    $loans = if ($loanList -is [array]) { $loanList } elseif ($loanList.data) { $loanList.data } else { @($loanList) }
    Write-Pass "Loans found: $($loans.Count)"
} else { Write-Fail "List loans failed" }

Write-Step "4.3" "Get loan details"
if ($loan1Id) {
    $loanGet = Safe-Request -Method GET -Uri "$BaseUrl/finance/loans/$loan1Id" -Headers $h -Label "GetLoan"
    if ($loanGet -and $loanGet._id) { Write-Pass "Loan details OK: status=$($loanGet.status)" }
    else { Write-Fail "Get loan failed" }
}

Write-Step "4.4" "Disburse loan"
if ($loan1Id) {
    $disbBody = @{
        amount = 50000000
        date = "2026-02-05"
        notes = "First disbursement 50M"
    } | ConvertTo-Json
    $disb = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans/$loan1Id/disburse" -Headers $h -Body $disbBody -Label "DisburseLoan"
    if ($disb) { Write-Pass "Loan disbursed: 50M" } else { Write-Fail "Disburse loan failed" }
}

Write-Step "4.5" "Disburse remaining"
if ($loan1Id) {
    $disb2Body = @{
        amount = 50000000
        date = "2026-02-10"
        notes = "Second disbursement 50M"
    } | ConvertTo-Json
    $disb2 = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans/$loan1Id/disburse" -Headers $h -Body $disb2Body -Label "DisburseLoan2"
    if ($disb2) { Write-Pass "Loan fully disbursed: 100M total" } else { Write-Fail "Second disbursement failed" }
}

Write-Step "4.6" "Create loan repayment"
if ($loan1Id) {
    $repayBody = @{
        loanId = $loan1Id
        amountPrincipal = 8000000
        amountInterest = 2000000
        dueDate = "2026-03-01"
        notes = "Monthly repayment March"
    } | ConvertTo-Json
    $repay = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans/$loan1Id/repayments" -Headers $h -Body $repayBody -Label "Repay"
    if ($repay -and $repay._id) {
        $repay1Id = $repay._id
        Write-Pass "Repayment created: $repay1Id (principal=8M, interest=2M)"
    } else { Write-Fail "Create repayment failed" }
}

Write-Step "4.7" "List loan repayments"
if ($loan1Id) {
    $repayList = Safe-Request -Method GET -Uri "$BaseUrl/finance/loans/$loan1Id/repayments" -Headers $h -Label "ListRepay"
    if ($repayList -ne $null) { Write-Pass "Loan repayments listed" } else { Write-Fail "List repayments failed" }
}

Write-Step "4.8" "Pay repayment"
if ($repay1Id) {
    $payRepBody = @{
        paidDate = "2026-02-28"
        notes = "Paid early"
    } | ConvertTo-Json
    $payRep = Safe-Request -Method POST -Uri "$BaseUrl/finance/repayments/$repay1Id/pay" -Headers $h -Body $payRepBody -Label "PayRepay"
    if ($payRep) { Write-Pass "Repayment paid" } else { Write-Fail "Pay repayment failed" }
}

Write-Step "4.9" "Loan summary"
$loanSum = Safe-Request -Method GET -Uri "$BaseUrl/finance/loans/summary" -Headers $h -Label "LoanSummary"
if ($loanSum) { Write-Pass "Loan summary OK" } else { Write-Fail "Loan summary failed" }

Write-Step "4.10" "Upcoming repayments"
$upcoming = Safe-Request -Method GET -Uri "$BaseUrl/finance/repayments/upcoming?days=30" -Headers $h -Label "Upcoming"
if ($upcoming -ne $null) { Write-Pass "Upcoming repayments OK" } else { Write-Fail "Upcoming repayments failed" }

Write-Step "4.11" "Loan cashflow summary"
$loanCF = Safe-Request -Method GET -Uri "$BaseUrl/finance/loan-contracts/summary/cashflow" -Headers $h -Label "LoanCashflow"
if ($loanCF -ne $null) { Write-Pass "Loan cashflow OK" } else { Write-Fail "Loan cashflow failed" }

Write-Step "4.12" "Loan management dashboard"
$lmDash = Safe-Request -Method GET -Uri "$BaseUrl/loan-management/dashboard" -Headers $h -Label "LMDash"
if ($lmDash) { Write-Pass "Loan management dashboard OK" } else { Write-Fail "Loan management dashboard failed" }

Write-Step "4.13" "Payment options"
if ($loan1Id) {
    $payOpt = Safe-Request -Method GET -Uri "$BaseUrl/loan-management/loans/$loan1Id/payment-options" -Headers $h -Label "PayOptions"
    if ($payOpt -ne $null) { Write-Pass "Payment options OK" } else { Write-Fail "Payment options failed" }
}

# ===== PHASE 5: FUNDING SOURCES & CASHFLOW ENTRIES =====
Write-Section "PHASE 5: Funding Sources & Cashflow Entries"

Write-Step "5.1" "Create funding source (equity)"
$fsBody = @{
    name = "Test Equity Source $ts"
    type = "equity"
    lenderOrInvestor = "Test Investor"
    principal = 500000000
    availableBalance = 500000000
    status = "active"
} | ConvertTo-Json
$fs1 = Safe-Request -Method POST -Uri "$BaseUrl/finance/funding-sources" -Headers $h -Body $fsBody -Label "CreateFS"
if ($fs1 -and $fs1._id) {
    $fs1Id = $fs1._id
    Write-Pass "Funding source created: $fs1Id"
} else { Write-Fail "Create funding source failed" }

Write-Step "5.2" "List funding sources"
$fsList = Safe-Request -Method GET -Uri "$BaseUrl/finance/funding-sources" -Headers $h -Label "ListFS"
if ($fsList) { Write-Pass "Funding sources listed" } else { Write-Fail "List funding sources failed" }

Write-Step "5.3" "Create cashflow entry (in - COD)"
$cfBody = @{
    direction = "in"
    sourceType = "cod"
    amount = 5000000
    date = "2026-02-15"
    description = "Test COD collection"
} | ConvertTo-Json
$cf1 = Safe-Request -Method POST -Uri "$BaseUrl/finance/cashflows" -Headers $h -Body $cfBody -Label "CreateCF1"
if ($cf1 -and $cf1._id) {
    $cf1Id = $cf1._id
    Write-Pass "Cashflow entry (in) created: $cf1Id"
} else { Write-Fail "Create cashflow (in) failed" }

Write-Step "5.4" "Create cashflow entry (out - other)"
$cf2Body = @{
    direction = "out"
    sourceType = "other"
    amount = 2000000
    date = "2026-02-15"
    description = "Test expense payment"
} | ConvertTo-Json
$cf2 = Safe-Request -Method POST -Uri "$BaseUrl/finance/cashflows" -Headers $h -Body $cf2Body -Label "CreateCF2"
if ($cf2 -and $cf2._id) {
    $cf2Id = $cf2._id
    Write-Pass "Cashflow entry (out) created: $cf2Id"
} else { Write-Fail "Create cashflow (out) failed" }

Write-Step "5.5" "List cashflows"
$cfList = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflows" -Headers $h -Label "ListCF"
if ($cfList) { Write-Pass "Cashflows listed" } else { Write-Fail "List cashflows failed" }

Write-Step "5.6" "Finance summary"
$finSum = Safe-Request -Method GET -Uri "$BaseUrl/finance/summary" -Headers $h -Label "FinSummary"
if ($finSum) { Write-Pass "Finance summary OK" } else { Write-Fail "Finance summary failed" }

Write-Step "5.7" "Available funds"
$avFunds = Safe-Request -Method GET -Uri "$BaseUrl/finance/available-funds" -Headers $h -Label "AvailFunds"
if ($avFunds -ne $null) { Write-Pass "Available funds OK" } else { Write-Fail "Available funds failed" }

Write-Step "5.8" "Available funds (conservative)"
$avFC = Safe-Request -Method GET -Uri "$BaseUrl/finance/available-funds/current?mode=conservative" -Headers $h -Label "AvailFundsC"
if ($avFC -ne $null) { Write-Pass "Available funds (conservative) OK" } else { Write-Fail "Available funds (conservative) failed" }

Write-Step "5.9" "Finance dashboard"
$finDash = Safe-Request -Method GET -Uri "$BaseUrl/finance/dashboard" -Headers $h -Label "FinDash"
if ($finDash) { Write-Pass "Finance dashboard OK" } else { Write-Fail "Finance dashboard failed" }

Write-Step "5.10" "Finance alerts"
$finAlerts = Safe-Request -Method GET -Uri "$BaseUrl/finance/alerts" -Headers $h -Label "FinAlerts"
if ($finAlerts -ne $null) { Write-Pass "Finance alerts OK" } else { Write-Fail "Finance alerts failed" }

# ===== CLEANUP =====
Write-Section "PHASE 6: Cleanup"

Write-Step "6.1" "Delete test owners"
if ($ow1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/owner-fund/owners/$ow1Id" -Headers $h -Label "CleanOW1" | Out-Null; Write-Info "Deleted owner1" }
if ($ow2Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/owner-fund/owners/$ow2Id" -Headers $h -Label "CleanOW2" | Out-Null; Write-Info "Deleted owner2" }

Write-Step "6.2" "Delete test funding source"
if ($fs1Id) { Safe-Request -Method PATCH -Uri "$BaseUrl/finance/funding-sources/$fs1Id" -Headers $h -Body '{"status":"closed"}' -Label "CloseFS" | Out-Null; Write-Info "Closed fs1" }

Write-Step "6.3" "Update loan to closed"
if ($loan1Id) { Safe-Request -Method PATCH -Uri "$BaseUrl/finance/loans/$loan1Id" -Headers $h -Body '{"status":"closed"}' -Label "CloseLoan" | Out-Null; Write-Info "Closed loan1" }

# ===== SUMMARY =====
Write-Section "KET QUA - OWNER FUND & LOAN MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
