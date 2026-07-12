#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.OWNER-FUND-LEDGER-RECONCILE.PS1
    =====================================================================================
    Target coverage:
    - historical owner-withdrawal ledger reconciliation on legacy approved/completed rows
    - dry-run detection, apply repair, API-visible history/fund-summary recovery, idempotence
    =====================================================================================
#>

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

function Get-BackendBaseUrl {
    $override = [string]$env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override.TrimEnd('/')
    }
    return 'http://localhost:3000/api'
}

function Get-SuiteMongoUri {
    $override = [string]$env:MONGODB_URI
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override.Trim()
    }
    return $null
}

$BaseUrl = Get-BackendBaseUrl
$MongoUri = Get-SuiteMongoUri
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:passCount = 0
$script:failCount = 0
$script:blockedCount = 0
$script:failDetails = @()
$script:blockedDetails = @()
$script:Fixture = $null

function Write-Section($Title) {
    Write-Host ''
    Write-Host ('=' * 96) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 96) -ForegroundColor Cyan
}

function Write-Step($Step, $Title) {
    Write-Host ''
    Write-Host "--- Step $Step : $Title ---" -ForegroundColor Yellow
}

function Write-Pass($Message) {
    Write-Host "  [PASS] $Message" -ForegroundColor Green
    $script:passCount++
}

function Write-Fail($Message) {
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $script:failCount++
    $script:failDetails += $Message
}

function Write-Blocked($Message) {
    Write-Host "  [BLOCKED] $Message" -ForegroundColor Magenta
    $script:blockedCount++
    $script:blockedDetails += $Message
}

function Write-Info($Message) {
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

function Number-OrZero($Value) {
    if ($null -eq $Value -or $Value -eq '') { return 0 }
    return [double]$Value
}

function Get-ErrorBody([object]$Exception) {
    try {
        if ($Exception.Response -and $Exception.Response.GetResponseStream) {
            return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
        }
    } catch {}
    return ''
}

function Safe-Request {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body = $null,
        [string]$Label = ''
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Uri
            Headers = $Headers
            ContentType = 'application/json; charset=utf-8'
            ErrorAction = 'Stop'
        }
        if ($Body -and $Method -ne 'GET') {
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }
        return Invoke-RestMethod @params
    } catch {
        $statusCode = 0
        try { $statusCode = $_.Exception.Response.StatusCode.value__ } catch {}
        $errorBody = Get-ErrorBody $_.Exception
        Write-Host "  [ERROR] $Label - HTTP $statusCode : $errorBody" -ForegroundColor Red
        return $null
    }
}

function Invoke-NodeJson {
    param(
        [string]$Script,
        [string]$Label
    )

    $output = $Script | node -
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "$Label failed"
        return $null
    }

    try {
        return ($output -join "`n") | ConvertFrom-Json
    } catch {
        Write-Fail "$Label returned invalid JSON"
        return $null
    }
}

function Seed-LegacyOwnerWithdrawalFixture {
    param(
        [string]$MongoUri,
        [string]$RunTag,
        [string]$DirectorId
    )

    $backendDirJson = $BackendDir | ConvertTo-Json -Compress
    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $runTagJson = $RunTag | ConvertTo-Json -Compress
    $directorIdJson = $DirectorId | ConvertTo-Json -Compress
    $nodeScript = @"
const path = require('path');
const { createRequire } = require('module');
const backendDir = $backendDirJson;
const mongoUri = $mongoUriJson;
const runTag = $runTagJson;
const directorId = $directorIdJson;
const backendRequire = createRequire(path.join(backendDir, 'package.json'));
const { MongoClient, ObjectId } = backendRequire('mongodb');

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
  const now = new Date();
  const ownerId = new ObjectId();
  const owner = {
    _id: ownerId,
    name: 'Legacy Backfill Owner ' + runTag,
    email: 'legacy.backfill.' + runTag + '@test.com',
    phone: '09' + runTag.slice(-8),
    profitSharePercentage: 55,
    totalWithdrawn: 2500000,
    availableBalance: 7500000,
    bankAccount: '1234567890',
    bankName: 'Vietcombank',
    bankAccountName: 'LEGACY BACKFILL ' + runTag,
    isActive: true,
    notes: 'legacy-backfill:' + runTag,
    createdAt: now,
    updatedAt: now,
  };

  const capitalInId = new ObjectId();
  const capitalInDate = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000));
  const capitalIn = {
    _id: capitalInId,
    ownerId,
    type: 'in',
    category: 'capital_contribution',
    amount: 10000000,
    date: capitalInDate,
    description: 'Legacy capital funding ' + runTag,
    notes: 'legacy-backfill:' + runTag,
    referenceId: 'legacy-capital-' + runTag,
    reference: 'LEGACY-CAPITAL-' + runTag,
    referenceType: 'manual',
    createdBy: new ObjectId(directorId),
    balanceAfter: 10000000,
    createdAt: capitalInDate,
    updatedAt: capitalInDate,
  };

  const completedProfitId = new ObjectId();
  const completedEmergencyId = new ObjectId();
  const rejectedId = new ObjectId();
  const cancelledId = new ObjectId();
  const completedProfitDate = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
  const completedEmergencyDate = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
  const rejectedDate = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000));

  const withdrawals = [
    {
      _id: completedProfitId,
      ownerId,
      amount: 2000000,
      type: 'profit_share',
      status: 'completed',
      requestDate: new Date(completedProfitDate.getTime() - 90 * 1000),
      approvedDate: new Date(completedProfitDate.getTime() - 60 * 1000),
      completedDate: completedProfitDate,
      approvedBy: new ObjectId(directorId),
      approvalNotes: 'legacy complete profit ' + runTag,
      reason: 'Legacy profit withdrawal ' + runTag,
      notes: 'legacy-backfill:' + runTag,
      bankAccount: '1234567890',
      bankName: 'Vietcombank',
      bankAccountName: 'LEGACY BACKFILL ' + runTag,
      transactionReference: 'LEGACY-TXN-' + runTag,
      createdAt: new Date(completedProfitDate.getTime() - 90 * 1000),
      updatedAt: completedProfitDate,
    },
    {
      _id: completedEmergencyId,
      ownerId,
      amount: 500000,
      type: 'emergency',
      status: 'completed',
      requestDate: new Date(completedEmergencyDate.getTime() - 90 * 1000),
      approvedDate: new Date(completedEmergencyDate.getTime() - 60 * 1000),
      completedDate: completedEmergencyDate,
      approvedBy: new ObjectId(directorId),
      approvalNotes: 'legacy complete emergency ' + runTag,
      reason: 'Legacy emergency withdrawal ' + runTag,
      notes: 'legacy-backfill:' + runTag,
      bankAccount: '1234567890',
      bankName: 'Vietcombank',
      bankAccountName: 'LEGACY BACKFILL ' + runTag,
      createdAt: new Date(completedEmergencyDate.getTime() - 90 * 1000),
      updatedAt: completedEmergencyDate,
    },
    {
      _id: rejectedId,
      ownerId,
      amount: 300000,
      type: 'profit_share',
      status: 'rejected',
      requestDate: new Date(rejectedDate.getTime() - 90 * 1000),
      approvedDate: new Date(rejectedDate.getTime() - 60 * 1000),
      approvedBy: new ObjectId(directorId),
      approvalNotes: 'legacy rejected ' + runTag,
      reason: 'Legacy rejected withdrawal ' + runTag,
      notes: 'legacy-backfill:' + runTag,
      createdAt: new Date(rejectedDate.getTime() - 90 * 1000),
      updatedAt: rejectedDate,
    },
    {
      _id: cancelledId,
      ownerId,
      amount: 400000,
      type: 'advance',
      status: 'cancelled',
      requestDate: new Date(rejectedDate.getTime() + 5 * 60 * 1000),
      reason: 'Legacy cancelled withdrawal ' + runTag,
      notes: 'legacy-backfill:' + runTag,
      createdAt: new Date(rejectedDate.getTime() + 5 * 60 * 1000),
      updatedAt: new Date(rejectedDate.getTime() + 6 * 60 * 1000),
    },
  ];

  await db.collection('owners').insertOne(owner);
  await db.collection('fund_transactions').insertOne(capitalIn);
  await db.collection('withdrawals').insertMany(withdrawals);

  console.log(JSON.stringify({
    dbName,
    runTag,
    ownerId: String(ownerId),
    capitalInId: String(capitalInId),
    completedWithdrawalIds: [String(completedProfitId), String(completedEmergencyId)],
    rejectedWithdrawalId: String(rejectedId),
    cancelledWithdrawalId: String(cancelledId),
  }, null, 2));
  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    return Invoke-NodeJson -Script $nodeScript -Label 'Seed legacy owner-withdrawal fixture'
}

function Remove-LegacyOwnerWithdrawalFixture {
    param(
        [string]$MongoUri,
        [object]$Fixture
    )

    if ($null -eq $Fixture -or -not $Fixture.ownerId) {
        return
    }

    $backendDirJson = $BackendDir | ConvertTo-Json -Compress
    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $ownerIdJson = $Fixture.ownerId | ConvertTo-Json -Compress
    $completedWithdrawalIdsJson = ($Fixture.completedWithdrawalIds | ConvertTo-Json -Compress)
    $rejectedIdJson = $Fixture.rejectedWithdrawalId | ConvertTo-Json -Compress
    $cancelledIdJson = $Fixture.cancelledWithdrawalId | ConvertTo-Json -Compress
    $capitalInIdJson = $Fixture.capitalInId | ConvertTo-Json -Compress
    $nodeScript = @"
const path = require('path');
const { createRequire } = require('module');
const backendDir = $backendDirJson;
const mongoUri = $mongoUriJson;
const ownerId = $ownerIdJson;
const completedWithdrawalIds = $completedWithdrawalIdsJson;
const rejectedId = $rejectedIdJson;
const cancelledId = $cancelledIdJson;
const capitalInId = $capitalInIdJson;
const backendRequire = createRequire(path.join(backendDir, 'package.json'));
const { MongoClient, ObjectId } = backendRequire('mongodb');

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
  const ownerObjectId = new ObjectId(ownerId);
  const withdrawalIds = completedWithdrawalIds.concat([rejectedId, cancelledId]).map((value) => new ObjectId(value));
  await db.collection('fund_transactions').deleteMany({
    `$or: [
      { ownerId: ownerObjectId },
      { referenceId: { `$in: completedWithdrawalIds } },
      { _id: new ObjectId(capitalInId) },
    ],
  });
  await db.collection('withdrawals').deleteMany({ _id: { `$in: withdrawalIds } });
  await db.collection('owners').deleteOne({ _id: ownerObjectId });
  console.log(JSON.stringify({ ok: true }, null, 2));
  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    $cleanup = Invoke-NodeJson -Script $nodeScript -Label 'Cleanup legacy owner-withdrawal fixture'
    if ($cleanup -and $cleanup.ok) {
        Write-Info "Cleaned up owner-fund legacy fixture"
    }
}

function Invoke-ReconcileScript {
    param(
        [string]$MongoUri,
        [string]$OutPath,
        [switch]$Apply
    )

    $scriptPath = Join-Path $BackendDir 'scripts\reconcile-owner-withdrawal-ledger.js'
    $args = @($scriptPath, '--mongo-uri', $MongoUri, '--out', $OutPath)
    if ($Apply) {
        $args = @($scriptPath, '--apply', '--mongo-uri', $MongoUri, '--out', $OutPath)
    }
    $output = & node @args
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) {
        Write-Fail "Reconcile owner withdrawal ledger command failed"
        return $null
    }
    try {
        return ($output -join "`n") | ConvertFrom-Json
    } catch {
        Write-Fail "Reconcile owner withdrawal ledger returned invalid JSON"
        return $null
    }
}

function Finish-Suite {
    Write-Host ''
    Write-Host ('=' * 96) -ForegroundColor White
    Write-Host '  SUMMARY' -ForegroundColor White
    Write-Host ('=' * 96) -ForegroundColor White
    Write-Host ''
    Write-Host "Total: $($script:passCount + $script:failCount + $script:blockedCount) | PASS: $($script:passCount) | FAIL: $($script:failCount) | BLOCKED: $($script:blockedCount)"
    if ($script:failCount -gt 0) {
        Write-Host ''
        Write-Host 'Failed checks:' -ForegroundColor Red
        $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    if ($script:blockedCount -gt 0) {
        Write-Host ''
        Write-Host 'Blocked checks:' -ForegroundColor Magenta
        $script:blockedDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Magenta }
    }

    if ($script:failCount -gt 0) {
        exit 1
    }
    if ($script:blockedCount -gt 0) {
        exit 2
    }
    exit 0
}

Write-Section "MODULE TEST: OWNER FUND LEDGER RECONCILIATION - $ts"

if ([string]::IsNullOrWhiteSpace($MongoUri)) {
    Write-Blocked 'MONGODB_URI is required for historical owner-fund ledger reconciliation suite'
    Finish-Suite
}

Write-Step '0.1' 'Login Director'
$login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label 'Login'
if (-not $login -or -not $login.access_token) {
    Write-Blocked "Director login failed against $BaseUrl"
    Finish-Suite
}
$headers = @{ Authorization = "Bearer $($login.access_token)" }
$directorId = if ($login.user._id) { $login.user._id } else { $login.user.id }
Write-Pass "Director login OK: $directorId"

try {
    Write-Step '1.1' 'Capture baseline fund summary before legacy seed'
    $fundSummaryBaseline = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $headers -Label 'FundSummaryBaseline'
    if ($fundSummaryBaseline -eq $null) {
        Write-Fail 'Baseline fund summary failed'
    } else {
        $baselineTotalIn = Number-OrZero $fundSummaryBaseline.summary.totalIn
        $baselineTotalOut = Number-OrZero $fundSummaryBaseline.summary.totalOut
        $baselineTotalWithdrawn = Number-OrZero $fundSummaryBaseline.summary.totalWithdrawn
        Write-Pass 'Captured baseline fund summary'
    }

    Write-Step '1.2' 'Seed historical owner withdrawal gap directly into Mongo'
    $runTag = "owner-ledger-reconcile-$ts"
    $script:Fixture = Seed-LegacyOwnerWithdrawalFixture -MongoUri $MongoUri -RunTag $runTag -DirectorId $directorId
    if ($null -eq $script:Fixture -or -not $script:Fixture.ownerId) {
        Write-Fail 'Legacy owner withdrawal fixture seed failed'
        Finish-Suite
    }
    $ownerId = $script:Fixture.ownerId
    $completedWithdrawalIds = @($script:Fixture.completedWithdrawalIds)
    Write-Pass "Seeded legacy owner fixture: $ownerId"

    Write-Step '2.1' 'Baseline API visibility shows history/fund-summary drift before repair'
    $ownerTxBefore = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ownerId/transactions" -Headers $headers -Label 'OwnerTxBeforeRepair'
    $fundSummaryBeforeRepair = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $headers -Label 'FundSummaryBeforeRepair'
    if ($ownerTxBefore -eq $null -or $fundSummaryBeforeRepair -eq $null) {
        Write-Fail 'Could not read owner/fund summary before repair'
    } else {
        $txListBefore = if ($ownerTxBefore.transactions -is [array]) { $ownerTxBefore.transactions } elseif ($ownerTxBefore.transactions) { @($ownerTxBefore.transactions) } else { @() }
        $withdrawalRowsBefore = @($txListBefore | Where-Object { "$($_.referenceType)" -eq 'withdrawal' })
        if ($withdrawalRowsBefore.Count -eq 0) {
            Write-Pass 'Historical completed withdrawals are absent from owner transaction history before repair'
        } else {
            Write-Fail "Expected 0 historical withdrawal ledger rows before repair but found $($withdrawalRowsBefore.Count)"
        }

        if ((Number-OrZero $ownerTxBefore.summary.totalOut) -eq 0) {
            Write-Pass 'Owner transaction history totalOut is still missing legacy withdrawals before repair'
        } else {
            Write-Fail "Expected owner transaction history totalOut=0 before repair but found $($ownerTxBefore.summary.totalOut)"
        }

        if (((Number-OrZero $fundSummaryBeforeRepair.summary.totalIn) - $baselineTotalIn) -eq 10000000) {
            Write-Pass 'Legacy seed increased fund summary totalIn by 10M before repair'
        } else {
            Write-Fail "Expected fund summary totalIn delta=10M before repair but found $((Number-OrZero $fundSummaryBeforeRepair.summary.totalIn) - $baselineTotalIn)"
        }

        if (((Number-OrZero $fundSummaryBeforeRepair.summary.totalOut) - $baselineTotalOut) -eq 0) {
            Write-Pass 'Fund summary totalOut is still missing legacy withdrawals before repair'
        } else {
            Write-Fail "Expected fund summary totalOut delta=0 before repair but found $((Number-OrZero $fundSummaryBeforeRepair.summary.totalOut) - $baselineTotalOut)"
        }

        if (((Number-OrZero $fundSummaryBeforeRepair.summary.totalWithdrawn) - $baselineTotalWithdrawn) -eq 2500000) {
            Write-Pass 'Fund summary totalWithdrawn reflects the seeded owner state before repair'
        } else {
            Write-Fail "Expected fund summary totalWithdrawn delta=2500000 before repair but found $((Number-OrZero $fundSummaryBeforeRepair.summary.totalWithdrawn) - $baselineTotalWithdrawn)"
        }
    }

    Write-Step '3.1' 'Dry-run reconciliation detects exactly the historical gap'
    $dryRunPath = Join-Path $ResultsDir "module.owner-fund-ledger-reconcile-dryrun-$ts.json"
    $dryRun = Invoke-ReconcileScript -MongoUri $MongoUri -OutPath $dryRunPath
    if ($null -eq $dryRun) {
        Write-Fail 'Dry-run reconciliation failed'
    } else {
        if ($dryRun.before.anomalyCount -eq 2) {
            Write-Pass 'Dry-run reports 2 missing historical withdrawal ledger rows'
        } else {
            Write-Fail "Dry-run should report 2 anomalies but found $($dryRun.before.anomalyCount)"
        }

        if ($dryRun.before.totalMissingAmount -eq 2500000) {
            Write-Pass 'Dry-run reports 2.5M missing withdrawal ledger amount'
        } else {
            Write-Fail "Dry-run should report missing amount 2500000 but found $($dryRun.before.totalMissingAmount)"
        }

        if ($dryRun.before.duplicateCount -eq 0) {
            Write-Pass 'Dry-run reports no duplicate withdrawal ledger rows'
        } else {
            Write-Fail "Dry-run should report 0 duplicate rows but found $($dryRun.before.duplicateCount)"
        }

        if ($dryRun.after.anomalyCount -eq 2) {
            Write-Pass 'Dry-run leaves the DB unchanged'
        } else {
            Write-Fail "Dry-run should leave 2 anomalies in place but found $($dryRun.after.anomalyCount)"
        }
    }

    Write-Step '4.1' 'Apply reconciliation'
    $applyPath = Join-Path $ResultsDir "module.owner-fund-ledger-reconcile-apply-$ts.json"
    $applyRun = Invoke-ReconcileScript -MongoUri $MongoUri -OutPath $applyPath -Apply
    if ($null -eq $applyRun) {
        Write-Fail 'Apply reconciliation failed'
    } else {
        if (-not $applyRun.apply.blocked) {
            Write-Pass 'Apply reconciliation was not blocked'
        } else {
            Write-Fail "Apply reconciliation should not be blocked (reason=$($applyRun.apply.blockedReason))"
        }

        if ($applyRun.apply.insertedCount -eq 2) {
            Write-Pass 'Apply reconciliation inserted exactly 2 missing ledger rows'
        } else {
            Write-Fail "Apply reconciliation should insert 2 rows but inserted $($applyRun.apply.insertedCount)"
        }

        if ($applyRun.after.anomalyCount -eq 0) {
            Write-Pass 'Apply reconciliation closes all historical withdrawal ledger anomalies'
        } else {
            Write-Fail "Expected 0 anomalies after apply but found $($applyRun.after.anomalyCount)"
        }
    }

    Write-Step '5.1' 'API visibility is repaired after apply'
    $ownerTxAfter = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ownerId/transactions" -Headers $headers -Label 'OwnerTxAfterRepair'
    $fundSummaryAfterRepair = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/fund-summary" -Headers $headers -Label 'FundSummaryAfterRepair'
    if ($ownerTxAfter -eq $null -or $fundSummaryAfterRepair -eq $null) {
        Write-Fail 'Could not read owner/fund summary after repair'
    } else {
        $txListAfter = if ($ownerTxAfter.transactions -is [array]) { $ownerTxAfter.transactions } elseif ($ownerTxAfter.transactions) { @($ownerTxAfter.transactions) } else { @() }
        $withdrawalRowsAfter = @($txListAfter | Where-Object { "$($_.referenceType)" -eq 'withdrawal' })
        if ($withdrawalRowsAfter.Count -eq 2) {
            Write-Pass 'Owner transaction history now shows exactly 2 repaired withdrawal ledger rows'
        } else {
            Write-Fail "Expected 2 repaired withdrawal rows but found $($withdrawalRowsAfter.Count)"
        }

        if ((Number-OrZero $ownerTxAfter.summary.totalOut) -eq 2500000) {
            Write-Pass 'Owner transaction history totalOut now reflects 2.5M repaired withdrawals'
        } else {
            Write-Fail "Expected owner transaction history totalOut=2500000 after repair but found $($ownerTxAfter.summary.totalOut)"
        }

        if ((Number-OrZero $ownerTxAfter.summary.totalIn) -eq 10000000) {
            Write-Pass 'Owner transaction history totalIn keeps the seeded 10M capital entry'
        } else {
            Write-Fail "Expected owner transaction history totalIn=10000000 after repair but found $($ownerTxAfter.summary.totalIn)"
        }

        if ((Number-OrZero $fundSummaryAfterRepair.summary.totalOut) - $baselineTotalOut -eq 2500000) {
            Write-Pass 'Fund summary totalOut delta is repaired to 2.5M'
        } else {
            Write-Fail "Expected fund summary totalOut delta=2500000 after repair but found $((Number-OrZero $fundSummaryAfterRepair.summary.totalOut) - $baselineTotalOut)"
        }

        if ((Number-OrZero $fundSummaryAfterRepair.summary.totalWithdrawn) - $baselineTotalWithdrawn -eq 2500000) {
            Write-Pass 'Fund summary totalWithdrawn remains 2.5M after repair'
        } else {
            Write-Fail "Expected fund summary totalWithdrawn delta=2500000 after repair but found $((Number-OrZero $fundSummaryAfterRepair.summary.totalWithdrawn) - $baselineTotalWithdrawn)"
        }

        $profitRow = @($withdrawalRowsAfter | Where-Object { "$($_.referenceId)" -eq "$($completedWithdrawalIds[0])" })
        $emergencyRow = @($withdrawalRowsAfter | Where-Object { "$($_.referenceId)" -eq "$($completedWithdrawalIds[1])" })
        if ($profitRow.Count -eq 1 -and "$($profitRow[0].category)" -eq 'withdrawal_profit') {
            Write-Pass 'Profit-share withdrawal was backfilled with withdrawal_profit category'
        } else {
            Write-Fail 'Profit-share withdrawal category mismatch after repair'
        }

        if ($emergencyRow.Count -eq 1 -and "$($emergencyRow[0].category)" -eq 'withdrawal_emergency') {
            Write-Pass 'Emergency withdrawal was backfilled with withdrawal_emergency category'
        } else {
            Write-Fail 'Emergency withdrawal category mismatch after repair'
        }

        if ($profitRow.Count -eq 1 -and "$($profitRow[0].reference)" -eq "LEGACY-TXN-$runTag") {
            Write-Pass 'Backfilled profit-share row preserved the historical transaction reference'
        } else {
            Write-Fail 'Backfilled profit-share row should preserve the historical transaction reference'
        }

        if ($emergencyRow.Count -eq 1 -and "$($emergencyRow[0].reference)" -eq "WITHDRAWAL_$($completedWithdrawalIds[1])") {
            Write-Pass 'Backfilled emergency row uses the deterministic fallback reference'
        } else {
            Write-Fail 'Backfilled emergency row should use the deterministic fallback reference'
        }
    }

    Write-Step '6.1' 'Re-apply is idempotent'
    $reapplyPath = Join-Path $ResultsDir "module.owner-fund-ledger-reconcile-reapply-$ts.json"
    $reapply = Invoke-ReconcileScript -MongoUri $MongoUri -OutPath $reapplyPath -Apply
    if ($null -eq $reapply) {
        Write-Fail 'Re-apply reconciliation failed'
    } else {
        if ($reapply.apply.insertedCount -eq 0) {
            Write-Pass 'Second apply inserts 0 rows'
        } else {
            Write-Fail "Second apply should insert 0 rows but inserted $($reapply.apply.insertedCount)"
        }

        if ($reapply.after.anomalyCount -eq 0) {
            Write-Pass 'Second apply keeps anomaly count at 0'
        } else {
            Write-Fail "Second apply should keep anomalies at 0 but found $($reapply.after.anomalyCount)"
        }
    }
}
finally {
    Remove-LegacyOwnerWithdrawalFixture -MongoUri $MongoUri -Fixture $script:Fixture
}

Finish-Suite
