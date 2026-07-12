#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'

$script:passCount = 0
$script:failCount = 0
$script:blockedCount = 0
$script:failDetails = New-Object System.Collections.Generic.List[string]
$script:blockedDetails = New-Object System.Collections.Generic.List[string]
$script:Fixture = $null

$SuiteTs = Get-Date -Format 'yyyyMMdd-HHmmss'
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$TestsRoot = (Resolve-Path (Join-Path $ScriptDir '..\..\..')).Path
$RepoRoot = (Resolve-Path (Join-Path $TestsRoot '..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $TestsRoot 'artifacts\results'
$NormalizeScriptPath = Join-Path $BackendDir 'scripts\normalize-owner-fund-objectids.js'
$BaseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { 'http://localhost:3000/api' }
$MongoUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { $null }

New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

function Write-Step([string]$Id, [string]$Title) {
    Write-Host ""
    Write-Host ("--- Step ${Id} : ${Title} ---") -ForegroundColor Cyan
}

function Write-Pass([string]$Message) {
    $script:passCount++
    Write-Host "  [PASS] $Message" -ForegroundColor Green
}

function Write-Fail([string]$Message) {
    $script:failCount++
    $script:failDetails.Add($Message) | Out-Null
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
}

function Write-Blocked([string]$Message) {
    $script:blockedCount++
    $script:blockedDetails.Add($Message) | Out-Null
    Write-Host "  [BLOCKED] $Message" -ForegroundColor Magenta
}

function Number-OrZero($Value) {
    if ($null -eq $Value -or $Value -eq '') { return 0 }
    return [double]$Value
}

function Safe-Request {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body,
        [string]$Label
    )

    try {
        if ($Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body $Body -TimeoutSec 60
        }
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -TimeoutSec 60
    } catch {
        $statusCode = 0
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        Write-Host "  [ERROR] $Label - HTTP $statusCode : $($_.Exception.Message)" -ForegroundColor DarkYellow
        return $null
    }
}

function Invoke-NodeJson {
    param(
        [string]$Script,
        [string]$Label
    )

    $output = @($Script | node - 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "$Label command failed"
        return $null
    }

    try {
        return ($output -join "`n") | ConvertFrom-Json
    } catch {
        Write-Fail "$Label returned invalid JSON"
        return $null
    }
}

function Seed-MixedOwnerFundFixture {
    param(
        [string]$MongoUri,
        [string]$RunTag,
        [string]$DirectorId
    )

    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $runTagJson = $RunTag | ConvertTo-Json -Compress
    $directorIdJson = $DirectorId | ConvertTo-Json -Compress
    $nodeScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = $mongoUriJson;
const runTag = $runTagJson;
const directorId = $directorIdJson;

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
  const completedWithdrawalId = new ObjectId();
  const rejectedWithdrawalId = new ObjectId();
  const capitalTxId = new ObjectId();
  const withdrawalTxId = new ObjectId();
  const completedDate = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000));
  const rejectedDate = new Date(now.getTime() - (1 * 24 * 60 * 60 * 1000));

  await db.collection('owners').insertOne({
    _id: ownerId,
    name: 'Owner Normalize ' + runTag,
    email: 'owner.normalize.' + runTag + '@test.com',
    phone: '091' + runTag.slice(-7),
    profitSharePercentage: 60,
    totalWithdrawn: 2000000,
    availableBalance: 8000000,
    bankAccount: '123456789',
    bankName: 'VCB',
    bankAccountName: 'OWNER NORMALIZE ' + runTag,
    isActive: true,
    notes: 'owner-normalize:' + runTag,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('withdrawals').insertMany([
    {
      _id: completedWithdrawalId,
      ownerId: String(ownerId),
      amount: 2000000,
      type: 'profit_share',
      status: 'completed',
      requestDate: new Date(completedDate.getTime() - 120000),
      approvedDate: new Date(completedDate.getTime() - 60000),
      completedDate,
      approvedBy: directorId,
      approvalNotes: 'normalize completed ' + runTag,
      reason: 'Normalize completed withdrawal ' + runTag,
      notes: 'owner-normalize:' + runTag,
      bankAccount: '123456789',
      bankName: 'VCB',
      bankAccountName: 'OWNER NORMALIZE ' + runTag,
      transactionReference: 'NORMALIZE-TXN-' + runTag,
      createdAt: new Date(completedDate.getTime() - 120000),
      updatedAt: completedDate,
    },
    {
      _id: rejectedWithdrawalId,
      ownerId: String(ownerId),
      amount: 1500000,
      type: 'advance',
      status: 'rejected',
      requestDate: new Date(rejectedDate.getTime() - 120000),
      approvedDate: new Date(rejectedDate.getTime() - 60000),
      approvedBy: directorId,
      approvalNotes: 'normalize rejected ' + runTag,
      reason: 'Normalize rejected withdrawal ' + runTag,
      notes: 'owner-normalize:' + runTag,
      createdAt: new Date(rejectedDate.getTime() - 120000),
      updatedAt: rejectedDate,
    }
  ]);

  await db.collection('fund_transactions').insertMany([
    {
      _id: capitalTxId,
      ownerId: String(ownerId),
      type: 'in',
      category: 'capital_contribution',
      amount: 10000000,
      date: new Date(completedDate.getTime() - (24 * 60 * 60 * 1000)),
      description: 'Owner normalize capital ' + runTag,
      notes: 'owner-normalize:' + runTag,
      referenceId: 'OWNER-NORMALIZE-CAPITAL-' + runTag,
      reference: 'OWNER-NORMALIZE-CAPITAL-' + runTag,
      referenceType: 'manual',
      createdBy: directorId,
      balanceAfter: 10000000,
      createdAt: new Date(completedDate.getTime() - (24 * 60 * 60 * 1000)),
      updatedAt: new Date(completedDate.getTime() - (24 * 60 * 60 * 1000)),
    },
    {
      _id: withdrawalTxId,
      ownerId: String(ownerId),
      type: 'out',
      category: 'withdrawal_profit',
      amount: 2000000,
      date: completedDate,
      description: 'Owner normalize withdrawal ' + runTag,
      notes: 'owner-normalize:' + runTag,
      referenceId: String(completedWithdrawalId),
      reference: 'NORMALIZE-TXN-' + runTag,
      referenceType: 'withdrawal',
      createdBy: directorId,
      balanceAfter: 8000000,
      createdAt: completedDate,
      updatedAt: completedDate,
    }
  ]);

  console.log(JSON.stringify({
    ownerId: String(ownerId),
    directorId,
    completedWithdrawalId: String(completedWithdrawalId),
    rejectedWithdrawalId: String(rejectedWithdrawalId),
    capitalTxId: String(capitalTxId),
    withdrawalTxId: String(withdrawalTxId),
  }, null, 2));

  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    return Invoke-NodeJson -Script $nodeScript -Label 'Seed mixed owner-fund fixture'
}

function Inspect-MixedOwnerFundFixture {
    param(
        [string]$MongoUri,
        [pscustomobject]$Fixture
    )

    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $fixtureJson = $Fixture | ConvertTo-Json -Compress
    $nodeScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = $mongoUriJson;
const fixture = $fixtureJson;

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
  const withdrawalIds = [fixture.completedWithdrawalId, fixture.rejectedWithdrawalId].map((id) => new ObjectId(id));
  const fundTxIds = [fixture.capitalTxId, fixture.withdrawalTxId].map((id) => new ObjectId(id));
  const withdrawals = await db.collection('withdrawals').find({ _id: { `$in: withdrawalIds } }).toArray();
  const fundTransactions = await db.collection('fund_transactions').find({ _id: { `$in: fundTxIds } }).toArray();

  const countType = (rows, field, type) => rows.filter((row) => {
    const value = row[field];
    if (value === undefined || value === null) {
      return false;
    }
    if (type === 'string') {
      return typeof value === 'string';
    }
    return value && value._bsontype === 'ObjectId';
  }).length;

  console.log(JSON.stringify({
    withdrawals: {
      ownerIdStringCount: countType(withdrawals, 'ownerId', 'string'),
      ownerIdObjectIdCount: countType(withdrawals, 'ownerId', 'objectId'),
      approvedByStringCount: countType(withdrawals, 'approvedBy', 'string'),
      approvedByObjectIdCount: countType(withdrawals, 'approvedBy', 'objectId'),
    },
    fundTransactions: {
      ownerIdStringCount: countType(fundTransactions, 'ownerId', 'string'),
      ownerIdObjectIdCount: countType(fundTransactions, 'ownerId', 'objectId'),
      createdByStringCount: countType(fundTransactions, 'createdBy', 'string'),
      createdByObjectIdCount: countType(fundTransactions, 'createdBy', 'objectId'),
    }
  }, null, 2));

  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    return Invoke-NodeJson -Script $nodeScript -Label 'Inspect mixed owner-fund fixture'
}

function Remove-MixedOwnerFundFixture {
    param(
        [string]$MongoUri,
        [pscustomobject]$Fixture
    )

    if ($null -eq $Fixture -or -not $Fixture.ownerId) {
        return
    }

    $mongoUriJson = $MongoUri | ConvertTo-Json -Compress
    $fixtureJson = $Fixture | ConvertTo-Json -Compress
    $nodeScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = $mongoUriJson;
const fixture = $fixtureJson;

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
  await db.collection('fund_transactions').deleteMany({
    _id: { `$in: [fixture.capitalTxId, fixture.withdrawalTxId].map((id) => new ObjectId(id)) }
  });
  await db.collection('withdrawals').deleteMany({
    _id: { `$in: [fixture.completedWithdrawalId, fixture.rejectedWithdrawalId].map((id) => new ObjectId(id)) }
  });
  await db.collection('owners').deleteOne({ _id: new ObjectId(fixture.ownerId) });
  console.log(JSON.stringify({ cleaned: true }, null, 2));
  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    $cleanup = Invoke-NodeJson -Script $nodeScript -Label 'Cleanup mixed owner-fund fixture'
    if ($cleanup -and $cleanup.cleaned) {
        Write-Host '  [INFO] Cleaned up owner-fund normalize fixture' -ForegroundColor DarkGray
    }
}

function Invoke-NormalizeScript {
    param(
        [string]$MongoUri,
        [string]$OutPath,
        [switch]$Apply
    )

    $args = @($NormalizeScriptPath, '--mongo-uri', $MongoUri, '--out', $OutPath)
    if ($Apply) {
        $args = @($NormalizeScriptPath, '--apply', '--mongo-uri', $MongoUri, '--out', $OutPath)
    }

    $output = & node @args
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 2) {
        Write-Fail 'Owner-fund ObjectId normalization command failed'
        return $null
    }

    try {
        return ($output -join "`n") | ConvertFrom-Json
    } catch {
        Write-Fail 'Owner-fund ObjectId normalization returned invalid JSON'
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

    if ($script:failCount -gt 0) { exit 1 }
    if ($script:blockedCount -gt 0) { exit 2 }
    exit 0
}

Write-Host ''
Write-Host ('=' * 96) -ForegroundColor White
Write-Host "  MODULE TEST: OWNER FUND OBJECTID NORMALIZATION - $SuiteTs" -ForegroundColor White
Write-Host ('=' * 96) -ForegroundColor White

if (-not $MongoUri) {
    Write-Blocked 'MONGODB_URI is required for owner-fund ObjectId normalization suite'
    Finish-Suite
}

if (-not (Test-Path $NormalizeScriptPath)) {
    Write-Blocked "Missing normalization script: $NormalizeScriptPath"
    Finish-Suite
}

$runTag = "owner-objectid-normalize-$SuiteTs"
$directorId = $null

try {
    Write-Step '0.1' 'Login Director'
    $loginBody = @{ email = 'director@test.com'; password = '123456' } | ConvertTo-Json
    $login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body $loginBody -Label 'LoginDirector'
    if ($null -eq $login -or -not $login.access_token) {
        Write-Fail 'Director login failed'
        Finish-Suite
    }

    $directorId = "$($login.user.id)"
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    Write-Pass "Director login OK: $directorId"

    Write-Step '1.1' 'Seed mixed-type owner-fund fixture directly into Mongo'
    $script:Fixture = Seed-MixedOwnerFundFixture -MongoUri $MongoUri -RunTag $runTag -DirectorId $directorId
    if ($null -eq $script:Fixture -or -not $script:Fixture.ownerId) {
        Write-Fail 'Could not seed mixed owner-fund fixture'
        Finish-Suite
    }

    $ownerId = "$($script:Fixture.ownerId)"
    Write-Pass "Seeded mixed owner-fund fixture: $ownerId"

    Write-Step '1.2' 'Pre-normalization raw fixture state is string-typed'
    $preState = Inspect-MixedOwnerFundFixture -MongoUri $MongoUri -Fixture $script:Fixture
    if ($null -eq $preState) {
        Write-Fail 'Could not inspect mixed owner-fund fixture before normalization'
    } else {
        if ($preState.withdrawals.ownerIdStringCount -eq 2) { Write-Pass 'Withdrawal ownerId fields start as 2 strings' } else { Write-Fail "Expected 2 string withdrawals.ownerId before normalize but found $($preState.withdrawals.ownerIdStringCount)" }
        if ($preState.withdrawals.approvedByStringCount -eq 2) { Write-Pass 'Withdrawal approvedBy fields start as 2 strings' } else { Write-Fail "Expected 2 string withdrawals.approvedBy before normalize but found $($preState.withdrawals.approvedByStringCount)" }
        if ($preState.fundTransactions.ownerIdStringCount -eq 2) { Write-Pass 'Fund transaction ownerId fields start as 2 strings' } else { Write-Fail "Expected 2 string fund_transactions.ownerId before normalize but found $($preState.fundTransactions.ownerIdStringCount)" }
        if ($preState.fundTransactions.createdByStringCount -eq 2) { Write-Pass 'Fund transaction createdBy fields start as 2 strings' } else { Write-Fail "Expected 2 string fund_transactions.createdBy before normalize but found $($preState.fundTransactions.createdByStringCount)" }
    }

    Write-Step '2.1' 'Dry-run normalization reports exact candidates and leaves DB unchanged'
    $dryRunPath = Join-Path $ResultsDir "module.owner-fund-objectid-normalize-dryrun-$SuiteTs.json"
    $dryRun = Invoke-NormalizeScript -MongoUri $MongoUri -OutPath $dryRunPath
    if ($null -eq $dryRun) {
        Write-Fail 'Dry-run normalization failed'
    } else {
        if (-not $dryRun.apply.blocked) { Write-Pass 'Dry-run normalization is not blocked' } else { Write-Fail "Dry-run normalization should not be blocked (reason=$($dryRun.apply.blockedReason))" }

        $expectedFields = @(
            'withdrawals.ownerId',
            'withdrawals.approvedBy',
            'fund_transactions.ownerId',
            'fund_transactions.createdBy'
        )

        foreach ($fieldName in $expectedFields) {
            $fieldBefore = $dryRun.before.fields.$fieldName
            $fieldAfter = $dryRun.after.fields.$fieldName
            if ((Number-OrZero $fieldBefore.convertibleCount) -eq 2) {
                Write-Pass "Dry-run reports 2 convertible values for $fieldName"
            } else {
                Write-Fail "Dry-run should report 2 convertible values for $fieldName but found $($fieldBefore.convertibleCount)"
            }
            if ((Number-OrZero $fieldBefore.invalidCount) -eq 0) {
                Write-Pass "Dry-run reports 0 invalid values for $fieldName"
            } else {
                Write-Fail "Dry-run should report 0 invalid values for $fieldName but found $($fieldBefore.invalidCount)"
            }
            if ((Number-OrZero $fieldAfter.stringCount) -eq 2) {
                Write-Pass "Dry-run leaves string count unchanged for $fieldName"
            } else {
                Write-Fail "Dry-run should leave 2 string values for $fieldName but found $($fieldAfter.stringCount)"
            }
        }
    }

    Write-Step '3.1' 'Apply normalization converts legacy string ObjectIds'
    $applyPath = Join-Path $ResultsDir "module.owner-fund-objectid-normalize-apply-$SuiteTs.json"
    $applyRun = Invoke-NormalizeScript -MongoUri $MongoUri -OutPath $applyPath -Apply
    if ($null -eq $applyRun) {
        Write-Fail 'Apply normalization failed'
    } else {
        if (-not $applyRun.apply.blocked) { Write-Pass 'Apply normalization is not blocked' } else { Write-Fail "Apply normalization should not be blocked (reason=$($applyRun.apply.blockedReason))" }
        if ((Number-OrZero $applyRun.apply.totalUpdatedCount) -eq 8) {
            Write-Pass 'Apply normalization updates exactly 8 legacy string ObjectId fields'
        } else {
            Write-Fail "Apply normalization should update 8 fields but updated $($applyRun.apply.totalUpdatedCount)"
        }

        foreach ($fieldResult in @($applyRun.apply.fields)) {
            if ((Number-OrZero $fieldResult.updatedCount) -eq 2) {
                Write-Pass "Apply normalization updated 2 values for $($fieldResult.collection).$($fieldResult.field)"
            } else {
                Write-Fail "Apply normalization should update 2 values for $($fieldResult.collection).$($fieldResult.field) but updated $($fieldResult.updatedCount)"
            }
        }
    }

    Write-Step '3.2' 'Independent raw inspection confirms BSON types are normalized'
    $postState = Inspect-MixedOwnerFundFixture -MongoUri $MongoUri -Fixture $script:Fixture
    if ($null -eq $postState) {
        Write-Fail 'Could not inspect mixed owner-fund fixture after normalization'
    } else {
        if ($postState.withdrawals.ownerIdStringCount -eq 0 -and $postState.withdrawals.ownerIdObjectIdCount -eq 2) {
            Write-Pass 'Withdrawal ownerId fields are fully normalized to ObjectId'
        } else {
            Write-Fail "Withdrawal ownerId normalization mismatch (string=$($postState.withdrawals.ownerIdStringCount), objectId=$($postState.withdrawals.ownerIdObjectIdCount))"
        }
        if ($postState.withdrawals.approvedByStringCount -eq 0 -and $postState.withdrawals.approvedByObjectIdCount -eq 2) {
            Write-Pass 'Withdrawal approvedBy fields are fully normalized to ObjectId'
        } else {
            Write-Fail "Withdrawal approvedBy normalization mismatch (string=$($postState.withdrawals.approvedByStringCount), objectId=$($postState.withdrawals.approvedByObjectIdCount))"
        }
        if ($postState.fundTransactions.ownerIdStringCount -eq 0 -and $postState.fundTransactions.ownerIdObjectIdCount -eq 2) {
            Write-Pass 'Fund transaction ownerId fields are fully normalized to ObjectId'
        } else {
            Write-Fail "Fund transaction ownerId normalization mismatch (string=$($postState.fundTransactions.ownerIdStringCount), objectId=$($postState.fundTransactions.ownerIdObjectIdCount))"
        }
        if ($postState.fundTransactions.createdByStringCount -eq 0 -and $postState.fundTransactions.createdByObjectIdCount -eq 2) {
            Write-Pass 'Fund transaction createdBy fields are fully normalized to ObjectId'
        } else {
            Write-Fail "Fund transaction createdBy normalization mismatch (string=$($postState.fundTransactions.createdByStringCount), objectId=$($postState.fundTransactions.createdByObjectIdCount))"
        }
    }

    Write-Step '4.1' 'API surface remains coherent after normalization'
    $ownerHistory = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ownerId/transactions" -Headers $headers -Label 'OwnerHistory'
    $allTransactions = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/transactions?ownerId=$ownerId" -Headers $headers -Label 'TransactionList'
    $allWithdrawals = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/withdrawals?ownerId=$ownerId" -Headers $headers -Label 'WithdrawalList'
    if ($null -eq $ownerHistory -or $null -eq $allTransactions -or $null -eq $allWithdrawals) {
        Write-Fail 'Could not read owner-fund APIs after normalization'
    } else {
        if ((Number-OrZero $ownerHistory.summary.totalIn) -eq 10000000) { Write-Pass 'Owner history totalIn remains 10M after normalization' } else { Write-Fail "Expected owner history totalIn=10000000 after normalization but found $($ownerHistory.summary.totalIn)" }
        if ((Number-OrZero $ownerHistory.summary.totalOut) -eq 2000000) { Write-Pass 'Owner history totalOut remains 2M after normalization' } else { Write-Fail "Expected owner history totalOut=2000000 after normalization but found $($ownerHistory.summary.totalOut)" }

        $txRows = if ($allTransactions -is [array]) { $allTransactions } elseif ($allTransactions) { @($allTransactions) } else { @() }
        $withdrawRows = if ($allWithdrawals -is [array]) { $allWithdrawals } elseif ($allWithdrawals) { @($allWithdrawals) } else { @() }

        if ($txRows.Count -eq 2) { Write-Pass 'Transactions endpoint still returns 2 normalized rows' } else { Write-Fail "Expected 2 transaction rows after normalization but found $($txRows.Count)" }
        $createdByPopulated = @($txRows | Where-Object { $_.createdBy -and "$($_.createdBy._id)" -eq $directorId }).Count
        if ($createdByPopulated -eq 2) { Write-Pass 'Transactions endpoint populates createdBy for all normalized rows' } else { Write-Fail "Expected createdBy populated on 2 rows after normalization but found $createdByPopulated" }

        if ($withdrawRows.Count -eq 2) { Write-Pass 'Withdrawals endpoint still returns 2 normalized rows' } else { Write-Fail "Expected 2 withdrawal rows after normalization but found $($withdrawRows.Count)" }
        $ownerPopulateCount = @($withdrawRows | Where-Object { $_.ownerId -and "$($_.ownerId._id)" -eq $ownerId }).Count
        if ($ownerPopulateCount -eq 2) { Write-Pass 'Withdrawals endpoint populates ownerId for all normalized rows' } else { Write-Fail "Expected ownerId populated on 2 withdrawal rows after normalization but found $ownerPopulateCount" }
        $approvedByPopulateCount = @($withdrawRows | Where-Object { $_.approvedBy -and "$($_.approvedBy._id)" -eq $directorId }).Count
        if ($approvedByPopulateCount -eq 2) { Write-Pass 'Withdrawals endpoint populates approvedBy for all normalized rows' } else { Write-Fail "Expected approvedBy populated on 2 withdrawal rows after normalization but found $approvedByPopulateCount" }
    }

    Write-Step '4.2' 'Owner deletion is blocked while financial history exists'
    $deleteStatus = 0
    try {
        Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/owner-fund/owners/$ownerId" -Headers $headers -TimeoutSec 60 | Out-Null
        $deleteStatus = 200
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $deleteStatus = [int]$_.Exception.Response.StatusCode
        } else {
            $deleteStatus = -1
        }
    }

    if (@(400, 409) -contains $deleteStatus) {
        Write-Pass "Owner delete with history is blocked by HTTP $deleteStatus"
    } else {
        Write-Fail "Owner delete with history should be blocked with HTTP 400/409 but got $deleteStatus"
    }

    $ownerAfterDeleteAttempt = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerAfterDeleteAttempt'
    if ($ownerAfterDeleteAttempt -and "$($ownerAfterDeleteAttempt._id)" -eq $ownerId) {
        Write-Pass 'Owner record remains readable after blocked delete attempt'
    } else {
        Write-Fail 'Owner record should remain after blocked delete attempt'
    }

    Write-Step '5.1' 'Re-apply is idempotent'
    $reapplyPath = Join-Path $ResultsDir "module.owner-fund-objectid-normalize-reapply-$SuiteTs.json"
    $reapply = Invoke-NormalizeScript -MongoUri $MongoUri -OutPath $reapplyPath -Apply
    if ($null -eq $reapply) {
        Write-Fail 'Re-apply normalization failed'
    } else {
        if ((Number-OrZero $reapply.apply.totalUpdatedCount) -eq 0) { Write-Pass 'Second apply updates 0 fields' } else { Write-Fail "Second apply should update 0 fields but updated $($reapply.apply.totalUpdatedCount)" }
        foreach ($fieldName in @('withdrawals.ownerId','withdrawals.approvedBy','fund_transactions.ownerId','fund_transactions.createdBy')) {
            if ((Number-OrZero $reapply.after.fields.$fieldName.stringCount) -eq 0) {
                Write-Pass "Second apply keeps string count at 0 for $fieldName"
            } else {
                Write-Fail "Second apply should keep string count 0 for $fieldName but found $($reapply.after.fields.$fieldName.stringCount)"
            }
        }
    }
}
finally {
    Remove-MixedOwnerFundFixture -MongoUri $MongoUri -Fixture $script:Fixture
}

Finish-Suite
