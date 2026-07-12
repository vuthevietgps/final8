#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.OWNER-FUND-LOAN.PS1
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
function Number-OrZero($value) {
    if ($null -eq $value -or $value -eq '') { return 0 }
    return [double]$value
}
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

function Cleanup-OwnerFundFixtures {
    param(
        [string]$MongoUri,
        [string[]]$OwnerIds
    )

    $ids = @($OwnerIds | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ([string]::IsNullOrWhiteSpace($MongoUri) -or $ids.Count -eq 0) {
        return $null
    }

    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $ownerIdsJson = ($ids | ConvertTo-Json -Compress)
    $nodeScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = $mongoUriJson;
const ownerIds = $ownerIdsJson;

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const dbName = (() => {
    try {
      const parsed = new URL(mongoUri);
      return parsed.pathname.replace(/^\//, '') || 'htxbachgia';
    } catch {
      return 'htxbachgia';
    }
  })();
  const db = client.db(dbName);
  const ownerObjectIds = ownerIds.map((id) => new ObjectId(id));
  const ownerValues = ownerObjectIds.concat(ownerIds);

  const fundTransactionsResult = await db.collection('fund_transactions').deleteMany({
    ownerId: { `$in: ownerValues }
  });
  const withdrawalsResult = await db.collection('withdrawals').deleteMany({
    ownerId: { `$in: ownerValues }
  });
  const ownersResult = await db.collection('owners').deleteMany({
    _id: { `$in: ownerObjectIds }
  });

  console.log(JSON.stringify({
    deletedFundTransactions: fundTransactionsResult.deletedCount || 0,
    deletedWithdrawals: withdrawalsResult.deletedCount || 0,
    deletedOwners: ownersResult.deletedCount || 0,
  }, null, 2));

  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    $output = @($nodeScript | node - 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-Host ($output -join "`n") -ForegroundColor Red
        return $null
    }

    try {
        return ($output -join "`n") | ConvertFrom-Json
    } catch {
        Write-Host ($output -join "`n") -ForegroundColor Red
        return $null
    }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$runDate = Get-Date
function Get-RunDateString([int]$daysOffset) {
    return $runDate.AddDays($daysOffset).ToString('yyyy-MM-dd')
}
$paidRepaymentDueDate = Get-RunDateString -daysOffset -7
$upcomingRepaymentDueDate = Get-RunDateString -daysOffset 14

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

Write-Step "2.0a" "Capture owner ledger baseline after deposit"
if ($ow1Id) {
    $ownerAfterDeposit = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id" -Headers $h -Label "OwnerAfterDeposit"
    $owTxBaseline = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTxBaseline"
    $fundSumBaseline = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummaryBaseline"
    if ($ownerAfterDeposit -and $owTxBaseline -and $fundSumBaseline) {
        $baselineOwnerAvailableBalance = Number-OrZero $ownerAfterDeposit.availableBalance
        $baselineOwnerTotalWithdrawn = Number-OrZero $ownerAfterDeposit.totalWithdrawn
        $baselineOwnerTxSummaryOut = Number-OrZero $owTxBaseline.summary.totalOut
        $baselineFundSummaryOut = Number-OrZero $fundSumBaseline.summary.totalOut
        $baselineFundSummaryWithdrawn = Number-OrZero $fundSumBaseline.summary.totalWithdrawn
        Write-Pass "Captured owner ledger baseline after deposit"
    } else {
        Write-Fail "Capture owner ledger baseline after deposit failed"
    }
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

Write-Step "2.2a" "Approved withdrawal writes owner ledger exactly once"
if ($ow1Id -and $wd1Id) {
    $ownerAfterApprove = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id" -Headers $h -Label "OwnerAfterApprove"
    $owTxAfterApprove = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTxAfterApprove"
    $fundSumAfterApprove = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummaryAfterApprove"
    if ($ownerAfterApprove -eq $null -or $owTxAfterApprove -eq $null -or $fundSumAfterApprove -eq $null) {
        Write-Fail "Approved withdrawal ledger verification failed"
    } else {
        $ownerAvailableAfterApprove = Number-OrZero $ownerAfterApprove.availableBalance
        $ownerWithdrawnAfterApprove = Number-OrZero $ownerAfterApprove.totalWithdrawn
        $approveTxList = if ($owTxAfterApprove.transactions -is [array]) { $owTxAfterApprove.transactions } elseif ($owTxAfterApprove.transactions) { @($owTxAfterApprove.transactions) } else { @() }
        $approvedWithdrawalTx = @($approveTxList | Where-Object { "$($_.referenceId)" -eq "$wd1Id" })
        $txSummaryOutAfterApprove = Number-OrZero $owTxAfterApprove.summary.totalOut
        $fundSummaryOutAfterApprove = Number-OrZero $fundSumAfterApprove.summary.totalOut
        $fundSummaryWithdrawnAfterApprove = Number-OrZero $fundSumAfterApprove.summary.totalWithdrawn

        if (($baselineOwnerAvailableBalance - $ownerAvailableAfterApprove) -eq 5000000) {
            Write-Pass "Approve reduces owner available balance by 5M"
        } else {
            Write-Fail "Approve should reduce owner available balance by 5M (actual delta=$($baselineOwnerAvailableBalance - $ownerAvailableAfterApprove))"
        }

        if (($ownerWithdrawnAfterApprove - $baselineOwnerTotalWithdrawn) -eq 5000000) {
            Write-Pass "Approve increments owner totalWithdrawn by 5M"
        } else {
            Write-Fail "Approve should increment owner totalWithdrawn by 5M (actual delta=$($ownerWithdrawnAfterApprove - $baselineOwnerTotalWithdrawn))"
        }

        if ($approvedWithdrawalTx.Count -eq 1) {
            Write-Pass "Approved withdrawal appears exactly once in owner transaction history before completion"
        } else {
            Write-Fail "Approved withdrawal should appear exactly once in owner transaction history before completion but found $($approvedWithdrawalTx.Count)"
        }

        if (($txSummaryOutAfterApprove - $baselineOwnerTxSummaryOut) -eq 5000000) {
            Write-Pass "Owner transaction history totalOut reflects approved withdrawal"
        } else {
            Write-Fail "Owner transaction history totalOut should increase by 5M on approve (actual delta=$($txSummaryOutAfterApprove - $baselineOwnerTxSummaryOut))"
        }

        if (($fundSummaryOutAfterApprove - $baselineFundSummaryOut) -eq 5000000) {
            Write-Pass "Fund summary totalOut reflects approved withdrawal"
        } else {
            Write-Fail "Fund summary totalOut should increase by 5M on approve (actual delta=$($fundSummaryOutAfterApprove - $baselineFundSummaryOut))"
        }

        if (($fundSummaryWithdrawnAfterApprove - $baselineFundSummaryWithdrawn) -eq 5000000) {
            Write-Pass "Fund summary totalWithdrawn reflects approved withdrawal"
        } else {
            Write-Fail "Fund summary totalWithdrawn should increase by 5M on approve (actual delta=$($fundSummaryWithdrawnAfterApprove - $baselineFundSummaryWithdrawn))"
        }

        if ($approvedWithdrawalTx.Count -eq 1) {
            $approvedWithdrawalTxAmount = Number-OrZero $approvedWithdrawalTx[0].amount
            if ($approvedWithdrawalTxAmount -eq 5000000) {
                Write-Pass "Approved withdrawal ledger entry amount is 5M"
            } else {
                Write-Fail "Approved withdrawal ledger entry amount mismatch (actual=$approvedWithdrawalTxAmount)"
            }

            if ("$($approvedWithdrawalTx[0].type)" -eq "out") {
                Write-Pass "Approved withdrawal ledger entry direction is out"
            } else {
                Write-Fail "Approved withdrawal ledger entry should be type=out (actual=$($approvedWithdrawalTx[0].type))"
            }

            if ("$($approvedWithdrawalTx[0].category)" -eq "withdrawal_profit") {
                Write-Pass "Approved withdrawal ledger entry category maps to withdrawal_profit"
            } else {
                Write-Fail "Approved withdrawal ledger entry should map to withdrawal_profit (actual=$($approvedWithdrawalTx[0].category))"
            }
        }
    }
}

Write-Step "2.3" "Complete withdrawal"
if ($wd1Id) {
    $compBody = @{ transactionReference = "TXN-TEST-$ts" } | ConvertTo-Json
    $comp = Safe-Request -Method POST -Uri "$BaseUrl/owner-fund/withdrawals/$wd1Id/complete" -Headers $h -Body $compBody -Label "CompleteWD"
    if ($comp) { Write-Pass "Withdrawal completed" } else { Write-Fail "Complete withdrawal failed" }
}

Write-Step "2.3a" "Owner transaction history reflects completed withdrawal"
if ($ow1Id -and $wd1Id) {
    $owTxAfterComplete = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTxAfterComplete"
    $fundSumAfterComplete = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummaryAfterComplete"
    if ($owTxAfterComplete -eq $null -or $fundSumAfterComplete -eq $null) {
        Write-Fail "Owner transaction history after completed withdrawal failed"
    } else {
        $txList = if ($owTxAfterComplete.transactions -is [array]) { $owTxAfterComplete.transactions } elseif ($owTxAfterComplete.transactions) { @($owTxAfterComplete.transactions) } else { @() }
        $withdrawTx = @($txList | Where-Object { "$($_.referenceId)" -eq "$wd1Id" -or "$($_.reference)" -eq "TXN-TEST-$ts" })
        if ($withdrawTx.Count -eq 1) {
            Write-Pass "Completed withdrawal appears exactly once in owner transaction history"
        } else {
            Write-Fail "Completed withdrawal should appear exactly once in owner transaction history but found $($withdrawTx.Count)"
        }

        $txSummaryOut = Number-OrZero $owTxAfterComplete.summary.totalOut
        if (($txSummaryOut - $baselineOwnerTxSummaryOut) -eq 5000000) {
            Write-Pass "Owner transaction history totalOut includes completed withdrawal exactly once"
        } else {
            Write-Fail "Owner transaction history totalOut should increase by 5M exactly once after complete (actual delta=$($txSummaryOut - $baselineOwnerTxSummaryOut))"
        }

        if ($withdrawTx.Count -eq 1) {
            $withdrawTxAmount = Number-OrZero $withdrawTx[0].amount
            if ($withdrawTxAmount -eq 5000000) {
                Write-Pass "Completed withdrawal transaction amount is 5M"
            } else {
                Write-Fail "Completed withdrawal transaction amount mismatch (actual=$withdrawTxAmount)"
            }

            if ("$($withdrawTx[0].category)" -eq "withdrawal_profit") {
                Write-Pass "Completed withdrawal transaction category remains withdrawal_profit"
            } else {
                Write-Fail "Completed withdrawal transaction category mismatch (actual=$($withdrawTx[0].category))"
            }
        }

        $summaryTotalOutAfterComplete = Number-OrZero $fundSumAfterComplete.summary.totalOut
        if (($summaryTotalOutAfterComplete - $baselineFundSummaryOut) -eq 5000000) {
            Write-Pass "Fund summary totalOut includes completed withdrawal exactly once"
        } else {
            Write-Fail "Fund summary totalOut should increase by 5M exactly once after complete (actual delta=$($summaryTotalOutAfterComplete - $baselineFundSummaryOut))"
        }
    }
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

Write-Step "2.5a" "Rejected withdrawal does not leak into owner ledger"
if ($ow1Id -and $wd2Id) {
    $owTxAfterReject = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTxAfterReject"
    $fundSumAfterReject = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummaryAfterReject"
    if ($owTxAfterReject -eq $null -or $fundSumAfterReject -eq $null) {
        Write-Fail "Rejected withdrawal ledger verification failed"
    } else {
        $txListAfterReject = if ($owTxAfterReject.transactions -is [array]) { $owTxAfterReject.transactions } elseif ($owTxAfterReject.transactions) { @($owTxAfterReject.transactions) } else { @() }
        $rejectedWithdrawalTx = @($txListAfterReject | Where-Object { "$($_.referenceId)" -eq "$wd2Id" })
        if ($rejectedWithdrawalTx.Count -eq 0) {
            Write-Pass "Rejected withdrawal does not create owner transaction history entry"
        } else {
            Write-Fail "Rejected withdrawal should not create owner transaction history entry but found $($rejectedWithdrawalTx.Count)"
        }

        $rejectTxSummaryOut = Number-OrZero $owTxAfterReject.summary.totalOut
        if (($rejectTxSummaryOut - $baselineOwnerTxSummaryOut) -eq 5000000) {
            Write-Pass "Rejected withdrawal does not change owner transaction history totalOut"
        } else {
            Write-Fail "Rejected withdrawal should not change owner transaction history totalOut beyond the approved withdrawal (actual delta=$($rejectTxSummaryOut - $baselineOwnerTxSummaryOut))"
        }

        $rejectFundSummaryOut = Number-OrZero $fundSumAfterReject.summary.totalOut
        if (($rejectFundSummaryOut - $baselineFundSummaryOut) -eq 5000000) {
            Write-Pass "Rejected withdrawal does not change fund summary totalOut"
        } else {
            Write-Fail "Rejected withdrawal should not change fund summary totalOut beyond the approved withdrawal (actual delta=$($rejectFundSummaryOut - $baselineFundSummaryOut))"
        }
    }
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

Write-Step "2.7a" "Cancelled withdrawal does not leak into owner ledger"
if ($ow1Id -and $wd3Id) {
    $owTxAfterCancel = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ow1Id/transactions" -Headers $h -Label "OwnerTxAfterCancel"
    $fundSumAfterCancel = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $h -Label "FundSummaryAfterCancel"
    if ($owTxAfterCancel -eq $null -or $fundSumAfterCancel -eq $null) {
        Write-Fail "Cancelled withdrawal ledger verification failed"
    } else {
        $txListAfterCancel = if ($owTxAfterCancel.transactions -is [array]) { $owTxAfterCancel.transactions } elseif ($owTxAfterCancel.transactions) { @($owTxAfterCancel.transactions) } else { @() }
        $cancelledWithdrawalTx = @($txListAfterCancel | Where-Object { "$($_.referenceId)" -eq "$wd3Id" })
        if ($cancelledWithdrawalTx.Count -eq 0) {
            Write-Pass "Cancelled withdrawal does not create owner transaction history entry"
        } else {
            Write-Fail "Cancelled withdrawal should not create owner transaction history entry but found $($cancelledWithdrawalTx.Count)"
        }

        $cancelTxSummaryOut = Number-OrZero $owTxAfterCancel.summary.totalOut
        if (($cancelTxSummaryOut - $baselineOwnerTxSummaryOut) -eq 5000000) {
            Write-Pass "Cancelled withdrawal does not change owner transaction history totalOut"
        } else {
            Write-Fail "Cancelled withdrawal should not change owner transaction history totalOut beyond the approved withdrawal (actual delta=$($cancelTxSummaryOut - $baselineOwnerTxSummaryOut))"
        }

        $cancelFundSummaryOut = Number-OrZero $fundSumAfterCancel.summary.totalOut
        if (($cancelFundSummaryOut - $baselineFundSummaryOut) -eq 5000000) {
            Write-Pass "Cancelled withdrawal does not change fund summary totalOut"
        } else {
            Write-Fail "Cancelled withdrawal should not change fund summary totalOut beyond the approved withdrawal (actual delta=$($cancelFundSummaryOut - $baselineFundSummaryOut))"
        }
    }
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
if ($fundSum -ne $null) {
    Write-Pass "Fund summary OK"
    $summaryTotalOut = Number-OrZero $fundSum.summary.totalOut
    if (($summaryTotalOut - $baselineFundSummaryOut) -eq 5000000) {
        Write-Pass "Fund summary totalOut includes only the approved/completed withdrawal"
    } else {
        Write-Fail "Fund summary totalOut should increase by 5M exactly once across approve/complete/reject/cancel (actual delta=$($summaryTotalOut - $baselineFundSummaryOut))"
    }

    $summaryWithdrawn = Number-OrZero $fundSum.summary.totalWithdrawn
    if (($summaryWithdrawn - $baselineFundSummaryWithdrawn) -eq 5000000) {
        Write-Pass "Fund summary totalWithdrawn matches single approved/completed withdrawal"
    } else {
        Write-Fail "Fund summary totalWithdrawn should increase by 5M exactly once across approve/complete/reject/cancel (actual delta=$($summaryWithdrawn - $baselineFundSummaryWithdrawn))"
    }
} else { Write-Fail "Fund summary failed" }

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
        dueDate = $paidRepaymentDueDate
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
        paidDate = $runDate.ToString('yyyy-MM-dd')
        notes = "Paid early"
    } | ConvertTo-Json
    $payRep = Safe-Request -Method POST -Uri "$BaseUrl/finance/repayments/$repay1Id/pay" -Headers $h -Body $payRepBody -Label "PayRepay"
    if ($payRep) { Write-Pass "Repayment paid" } else { Write-Fail "Pay repayment failed" }
}

Write-Step "4.9" "Loan summary"
$loanSum = Safe-Request -Method GET -Uri "$BaseUrl/finance/loans/summary" -Headers $h -Label "LoanSummary"
if ($loanSum) { Write-Pass "Loan summary OK" } else { Write-Fail "Loan summary failed" }

Write-Step "4.10" "Create upcoming repayment"
if ($loan1Id) {
    $upcomingBody = @{
        loanId = $loan1Id
        amountPrincipal = 12000000
        amountInterest = 1500000
        dueDate = $upcomingRepaymentDueDate
        notes = "Upcoming repayment within 30-day window"
    } | ConvertTo-Json
    $upcomingRepay = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans/$loan1Id/repayments" -Headers $h -Body $upcomingBody -Label "CreateUpcomingRepay"
    if ($upcomingRepay -and $upcomingRepay._id) {
        $upcomingRepayId = $upcomingRepay._id
        Write-Pass "Upcoming repayment created: $upcomingRepayId (due=$upcomingRepaymentDueDate)"
    } else { Write-Fail "Create upcoming repayment failed" }
}

Write-Step "4.11" "Upcoming repayments"
$upcoming = Safe-Request -Method GET -Uri "$BaseUrl/finance/repayments/upcoming?days=30" -Headers $h -Label "Upcoming"
$upcomingList = if ($upcoming -is [array]) { $upcoming } elseif ($upcoming.data) { $upcoming.data } elseif ($upcoming -ne $null) { @($upcoming) } else { @() }
$upcomingCount = @($upcomingList | Where-Object { $_ -and $_._id }).Count
$containsUpcoming = if ($upcomingRepayId) { @($upcomingList | Where-Object { $_._id -eq $upcomingRepayId }).Count -gt 0 } else { $false }
if ($containsUpcoming) { Write-Pass "Upcoming repayments OK (records=$upcomingCount)" } else { Write-Fail "Upcoming repayments failed" }

Write-Step "4.12" "Loan cashflow summary"
$loanCF = Safe-Request -Method GET -Uri "$BaseUrl/finance/loan-contracts/summary/cashflow" -Headers $h -Label "LoanCashflow"
if ($loanCF -ne $null) { Write-Pass "Loan cashflow OK" } else { Write-Fail "Loan cashflow failed" }

Write-Step "4.13" "Loan management dashboard"
$lmDash = Safe-Request -Method GET -Uri "$BaseUrl/loan-management/dashboard" -Headers $h -Label "LMDash"
if ($lmDash) { Write-Pass "Loan management dashboard OK" } else { Write-Fail "Loan management dashboard failed" }

Write-Step "4.14" "Payment options"
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
try {
    $avFundsResp = Invoke-WebRequest -Method GET -Uri "$BaseUrl/finance/available-funds" -Headers $h
    $avFundsRaw = [string]$avFundsResp.Content
    $avFundsParsed = if ([string]::IsNullOrWhiteSpace($avFundsRaw)) { @() } else { $avFundsRaw | ConvertFrom-Json }
    if ($avFundsRaw.TrimStart().StartsWith('[')) {
        $snapshotCount = if ($avFundsParsed -is [array]) { $avFundsParsed.Count } elseif ($null -eq $avFundsParsed) { 0 } else { 1 }
        Write-Pass "Available funds OK (snapshots=$snapshotCount)"
    } else {
        Write-Fail "Available funds returned unexpected payload shape"
    }
} catch {
    $st = $_.Exception.Response.StatusCode.value__
    $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
    Write-Host "  [ERROR] AvailFunds - HTTP $st : $eb" -ForegroundColor Red
    Write-Fail "Available funds failed"
}

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

Write-Step "6.1" "Delete test owner-fund fixtures"
$cleanupResult = Cleanup-OwnerFundFixtures -MongoUri $env:MONGODB_URI -OwnerIds @($ow1Id, $ow2Id)
if ($cleanupResult) {
    Write-Info "Deleted owner-fund fixtures: owners=$($cleanupResult.deletedOwners), withdrawals=$($cleanupResult.deletedWithdrawals), fundTransactions=$($cleanupResult.deletedFundTransactions)"
} else {
    Write-Fail "Owner-fund fixture cleanup failed"
}

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
