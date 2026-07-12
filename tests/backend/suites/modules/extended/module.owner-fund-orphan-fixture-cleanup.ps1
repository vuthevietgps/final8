#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.OWNER-FUND-ORPHAN-FIXTURE-CLEANUP.PS1
    =====================================================================================
    Validate snapshot-scoped cleanup-owner-fund-orphan-fixtures.js:
    1. Seed exact orphan fixture bundles plus one unknown orphan bundle in an isolated DB
    2. Dry-run classification must report 2 eligible clusters + 1 unknown cluster
    3. Apply must BLOCK while unknown cluster exists and delete nothing
    4. After removing the unknown cluster, apply must delete only the exact orphan fixtures
    5. Follow-up audit + apply must be idempotent no-op
    =====================================================================================
#>
$ErrorActionPreference = "Continue"

function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Assert-Equal($name, $expected, $actual) {
    if ("$expected" -eq "$actual") { Write-Pass "$name = $actual" } else { Write-Fail "$name expected '$expected' but got '$actual'" }
}
function Assert-True($name, $condition, $failureMessage = "") {
    if ($condition) { Write-Pass $name } else { Write-Fail ($(if ($failureMessage) { "$name - $failureMessage" } else { $name })) }
}

function Read-JsonFile {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path $Path)) {
        return $null
    }

    try {
        return (Get-Content -Raw -Path $Path | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Invoke-NodeInlineJson {
    param(
        [string]$Script,
        [string]$Label
    )

    $tempPath = Join-Path $artifactsRoot ("tmp-inline-" + [guid]::NewGuid().ToString("N") + ".js")
    Set-Content -Path $tempPath -Value $Script -Encoding UTF8
    try {
        $output = & node $tempPath 2>&1
        $exitCode = $LASTEXITCODE
        $raw = ($output | ForEach-Object { "$_" }) -join "`n"
        $json = $null
        if (-not [string]::IsNullOrWhiteSpace($raw)) {
            try { $json = $raw | ConvertFrom-Json } catch { }
        }
    } finally {
        Remove-Item -LiteralPath $tempPath -ErrorAction SilentlyContinue
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Raw = $raw
        Json = $json
        Label = $Label
    }
}

function Invoke-NodeFileJson {
    param(
        [string]$ScriptPath,
        [string[]]$Arguments,
        [string]$Label,
        [string]$JsonPath = ""
    )

    $output = & node $ScriptPath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $raw = ($output | ForEach-Object { "$_" }) -join "`n"
    $json = $null
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        try { $json = $raw | ConvertFrom-Json } catch { }
    }
    if ($null -eq $json -and -not [string]::IsNullOrWhiteSpace($JsonPath)) {
        $json = Read-JsonFile -Path $JsonPath
    }

    [pscustomobject]@{
        ExitCode = $exitCode
        Raw = $raw
        Json = $json
        Label = $Label
    }
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")).Path
$artifactsRoot = Join-Path $repoRoot "tests\backend\artifacts\results"
$auditScript = Join-Path $repoRoot "backend\scripts\audit-owner-fund-orphan-owners.js"
$cleanupScript = Join-Path $repoRoot "backend\scripts\cleanup-owner-fund-orphan-fixtures.js"
$dbName = "htxbachgia_beown07_$ts"
$mongoUri = "mongodb://127.0.0.1:27017/$dbName"

$audit1Path = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-audit1-$ts.json"
$dryRunPath = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-dryrun-$ts.json"
$blockedApplyPath = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-blocked-$ts.json"
$audit2Path = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-audit2-$ts.json"
$applyPassPath = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-apply-$ts.json"
$audit3Path = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-audit3-$ts.json"
$idempotentPath = Join-Path $artifactsRoot "owner-fund-orphan-fixture-cleanup-idempotent-$ts.json"

Write-Section "MODULE TEST: OWNER FUND ORPHAN FIXTURE CLEANUP - $ts"

Write-Step "0.1" "Seed isolated owner-fund orphan fixtures"
$seedScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = '$mongoUri';
const dbName = '$dbName';

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  await db.dropDatabase();

  const controlOwnerId = new ObjectId();
  await db.collection('owners').insertOne({
    _id: controlOwnerId,
    name: 'Control Owner $ts',
    email: 'control.owner.$ts@example.com',
    isActive: true,
    createdAt: new Date('2026-04-25T00:00:00.000Z'),
    updatedAt: new Date('2026-04-25T00:00:00.000Z'),
  });

  await db.collection('fund_transactions').insertOne({
    ownerId: controlOwnerId,
    type: 'in',
    category: 'capital_contribution',
    amount: 999999,
    date: new Date('2026-04-25T00:01:00.000Z'),
    description: 'Control owner deposit',
    createdAt: new Date('2026-04-25T00:01:00.000Z'),
    updatedAt: new Date('2026-04-25T00:01:00.000Z'),
  });

  const moduleOwnerId = new ObjectId();
  const moduleCompletedId = new ObjectId();
  const moduleRejectedId = new ObjectId();
  const moduleCancelledId = new ObjectId();
  await db.collection('withdrawals').insertMany([
    {
      _id: moduleCompletedId,
      ownerId: moduleOwnerId,
      amount: 5000000,
      type: 'profit_share',
      status: 'completed',
      requestDate: new Date('2026-04-18T00:00:00.000Z'),
      approvedDate: new Date('2026-04-18T00:01:00.000Z'),
      completedDate: new Date('2026-04-18T00:02:00.000Z'),
      bankAccount: '1234567890',
      bankName: 'Vietcombank',
      createdAt: new Date('2026-04-18T00:00:00.000Z'),
      updatedAt: new Date('2026-04-18T00:02:00.000Z'),
    },
    {
      _id: moduleRejectedId,
      ownerId: moduleOwnerId,
      amount: 3000000,
      type: 'emergency',
      status: 'rejected',
      requestDate: new Date('2026-04-18T00:03:00.000Z'),
      approvedDate: new Date('2026-04-18T00:04:00.000Z'),
      createdAt: new Date('2026-04-18T00:03:00.000Z'),
      updatedAt: new Date('2026-04-18T00:04:00.000Z'),
    },
    {
      _id: moduleCancelledId,
      ownerId: moduleOwnerId,
      amount: 2000000,
      type: 'advance',
      status: 'cancelled',
      requestDate: new Date('2026-04-18T00:05:00.000Z'),
      createdAt: new Date('2026-04-18T00:05:00.000Z'),
      updatedAt: new Date('2026-04-18T00:06:00.000Z'),
    },
  ]);
  await db.collection('fund_transactions').insertMany([
    {
      ownerId: moduleOwnerId,
      type: 'in',
      category: 'capital_contribution',
      amount: 50000000,
      date: new Date('2026-04-18T00:00:30.000Z'),
      description: 'Initial capital deposit for test',
      createdAt: new Date('2026-04-18T00:00:30.000Z'),
      updatedAt: new Date('2026-04-18T00:00:30.000Z'),
    },
    {
      ownerId: moduleOwnerId,
      type: 'out',
      category: 'withdrawal_profit',
      amount: 5000000,
      date: new Date('2026-04-18T00:02:00.000Z'),
      description: 'Rut loi nhuan thang 2',
      notes: 'Approved by test',
      referenceId: String(moduleCompletedId),
      reference: 'TXN-TEST-LOCAL-BEOWN07',
      referenceType: 'withdrawal',
      createdAt: new Date('2026-04-18T00:02:00.000Z'),
      updatedAt: new Date('2026-04-18T00:02:00.000Z'),
    },
  ]);

  const syntheticOwnerId = new ObjectId();
  const syntheticWithdrawalId = new ObjectId();
  const syntheticSuffix = '1775005114747';
  await db.collection('withdrawals').insertOne({
    _id: syntheticWithdrawalId,
    ownerId: syntheticOwnerId,
    amount: 120000,
    type: 'emergency',
    status: 'completed',
    requestDate: new Date('2026-04-01T00:58:35.939Z'),
    approvedDate: new Date('2026-04-01T00:58:37.251Z'),
    completedDate: new Date('2026-04-01T00:58:38.475Z'),
    notes: 'E2E owner-fund note ' + syntheticSuffix,
    createdAt: new Date('2026-04-01T00:58:35.939Z'),
    updatedAt: new Date('2026-04-01T00:58:38.475Z'),
  });
  await db.collection('fund_transactions').insertOne({
    ownerId: syntheticOwnerId,
    type: 'out',
    category: 'withdrawal_emergency',
    amount: 120000,
    date: new Date('2026-04-01T00:58:38.475Z'),
    description: 'E2E owner-fund reason ' + syntheticSuffix,
    notes: 'E2E owner-fund note ' + syntheticSuffix,
    referenceId: String(syntheticWithdrawalId),
    reference: 'WITHDRAWAL_' + String(syntheticWithdrawalId),
    referenceType: 'withdrawal',
    createdAt: new Date('2026-04-01T00:58:38.475Z'),
    updatedAt: new Date('2026-04-01T00:58:38.475Z'),
  });

  const unknownOwnerId = new ObjectId();
  const unknownWithdrawalId = new ObjectId();
  await db.collection('withdrawals').insertOne({
    _id: unknownWithdrawalId,
    ownerId: unknownOwnerId,
    amount: 777,
    type: 'emergency',
    status: 'completed',
    requestDate: new Date('2026-04-20T00:00:00.000Z'),
    approvedDate: new Date('2026-04-20T00:01:00.000Z'),
    completedDate: new Date('2026-04-20T00:02:00.000Z'),
    notes: 'Unknown orphan note',
    createdAt: new Date('2026-04-20T00:00:00.000Z'),
    updatedAt: new Date('2026-04-20T00:02:00.000Z'),
  });
  await db.collection('fund_transactions').insertOne({
    ownerId: unknownOwnerId,
    type: 'out',
    category: 'withdrawal_emergency',
    amount: 777,
    date: new Date('2026-04-20T00:02:00.000Z'),
    description: 'Unknown orphan reason',
    notes: 'Unknown orphan note',
    referenceId: String(unknownWithdrawalId),
    reference: 'WITHDRAWAL_' + String(unknownWithdrawalId),
    referenceType: 'withdrawal',
    createdAt: new Date('2026-04-20T00:02:00.000Z'),
    updatedAt: new Date('2026-04-20T00:02:00.000Z'),
  });

  console.log(JSON.stringify({
    controlOwnerId: String(controlOwnerId),
    moduleOwnerId: String(moduleOwnerId),
    syntheticOwnerId: String(syntheticOwnerId),
    unknownOwnerId: String(unknownOwnerId),
  }, null, 2));
  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@
$seedResult = Invoke-NodeInlineJson -Script $seedScript -Label "SeedFixtures"
if ($null -ne $seedResult.Json) {
    $controlOwnerId = "$($seedResult.Json.controlOwnerId)"
    $moduleOwnerId = "$($seedResult.Json.moduleOwnerId)"
    $syntheticOwnerId = "$($seedResult.Json.syntheticOwnerId)"
    $unknownOwnerId = "$($seedResult.Json.unknownOwnerId)"
    Write-Pass "Seeded isolated DB $dbName"
} else {
    Write-Fail "Seeding isolated DB failed"
    if ($seedResult.Raw) { Write-Host $seedResult.Raw -ForegroundColor Red }
}

Write-Step "0.2" "Audit seeded orphan fixtures"
$audit1Result = Invoke-NodeFileJson -ScriptPath $auditScript -Arguments @("--mongo-uri", $mongoUri, "--db-name", $dbName, "--sample-limit", "50", "--out", $audit1Path) -Label "Audit1" -JsonPath $audit1Path
if ($null -ne $audit1Result.Json) {
    Assert-Equal "Audit1 orphan owner refs" "3" "$($audit1Result.Json.orphanOwnerIdCount)"
    Assert-Equal "Audit1 orphan withdrawals" "5" "$($audit1Result.Json.targets.withdrawals.orphanDocumentCount)"
    Assert-Equal "Audit1 orphan fund transactions" "4" "$($audit1Result.Json.targets.fund_transactions.orphanDocumentCount)"
} else {
    Write-Fail "Audit1 failed"
    if ($audit1Result.Raw) { Write-Host $audit1Result.Raw -ForegroundColor Red }
}

Write-Step "1.1" "Dry-run cleanup classification"
$dryRunResult = Invoke-NodeFileJson -ScriptPath $cleanupScript -Arguments @("--mongo-uri", $mongoUri, "--db-name", $dbName, "--audit-file", $audit1Path, "--out", $dryRunPath) -Label "CleanupDryRun" -JsonPath $dryRunPath
if ($null -ne $dryRunResult.Json) {
    Assert-Equal "Dry-run eligible clusters" "2" "$($dryRunResult.Json.counts.eligibleClusters)"
    Assert-Equal "Dry-run blocked clusters" "0" "$($dryRunResult.Json.counts.blockedClusters)"
    Assert-Equal "Dry-run unknown clusters" "1" "$($dryRunResult.Json.counts.unknownClusters)"
    Assert-Equal "Dry-run module fixture family count" "1" "$($dryRunResult.Json.counts.byFamily.'module.owner-fund-loan')"
    Assert-Equal "Dry-run synthetic emergency family count" "1" "$($dryRunResult.Json.counts.byFamily.'synthetic.emergency-owner-fund')"
    Assert-Equal "Dry-run candidate withdrawals" "4" "$($dryRunResult.Json.counts.totalCandidateDocs.withdrawals)"
    Assert-Equal "Dry-run candidate fund transactions" "3" "$($dryRunResult.Json.counts.totalCandidateDocs.fund_transactions)"
    Assert-Equal "Dry-run candidate total docs" "7" "$($dryRunResult.Json.counts.totalCandidateDocs.total)"
    Assert-Equal "Dry-run deleted docs" "0" "$($dryRunResult.Json.apply.deleted.total)"
} else {
    Write-Fail "Dry-run cleanup classification failed"
    if ($dryRunResult.Raw) { Write-Host $dryRunResult.Raw -ForegroundColor Red }
}

Write-Step "1.2" "Apply must block while unknown cluster exists"
$blockedApplyResult = Invoke-NodeFileJson -ScriptPath $cleanupScript -Arguments @("--apply", "--mongo-uri", $mongoUri, "--db-name", $dbName, "--audit-file", $audit1Path, "--out", $blockedApplyPath) -Label "CleanupBlockedApply" -JsonPath $blockedApplyPath
if ($null -ne $blockedApplyResult.Json) {
    Assert-True "Blocked apply flagged blocked state" ($blockedApplyResult.Json.apply.blocked -eq $true) "cleanup apply should have blocked"
    Assert-Equal "Blocked apply deleted docs" "0" "$($blockedApplyResult.Json.apply.deleted.total)"
} else {
    Write-Fail "Cleanup apply did not block with unknown cluster present"
    if ($blockedApplyResult.Raw) { Write-Host $blockedApplyResult.Raw -ForegroundColor Red }
}

Write-Step "1.3" "Verify no collateral deletion after blocked apply"
$verifyBlockedScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = '$mongoUri';
const dbName = '$dbName';

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const moduleOwnerId = new ObjectId('$moduleOwnerId');
  const syntheticOwnerId = new ObjectId('$syntheticOwnerId');
  const unknownOwnerId = new ObjectId('$unknownOwnerId');
  const controlOwnerId = new ObjectId('$controlOwnerId');

  const [moduleWithdrawals, moduleTransactions, syntheticWithdrawals, syntheticTransactions, unknownWithdrawals, unknownTransactions, controlOwners, controlTransactions] = await Promise.all([
    db.collection('withdrawals').countDocuments({ ownerId: moduleOwnerId }),
    db.collection('fund_transactions').countDocuments({ ownerId: moduleOwnerId }),
    db.collection('withdrawals').countDocuments({ ownerId: syntheticOwnerId }),
    db.collection('fund_transactions').countDocuments({ ownerId: syntheticOwnerId }),
    db.collection('withdrawals').countDocuments({ ownerId: unknownOwnerId }),
    db.collection('fund_transactions').countDocuments({ ownerId: unknownOwnerId }),
    db.collection('owners').countDocuments({ _id: controlOwnerId }),
    db.collection('fund_transactions').countDocuments({ ownerId: controlOwnerId }),
  ]);

  console.log(JSON.stringify({
    moduleWithdrawals,
    moduleTransactions,
    syntheticWithdrawals,
    syntheticTransactions,
    unknownWithdrawals,
    unknownTransactions,
    controlOwners,
    controlTransactions,
  }, null, 2));

  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@
$verifyBlockedResult = Invoke-NodeInlineJson -Script $verifyBlockedScript -Label "VerifyBlockedApply"
if ($null -ne $verifyBlockedResult.Json) {
    Assert-Equal "Blocked apply preserved module withdrawals" "3" "$($verifyBlockedResult.Json.moduleWithdrawals)"
    Assert-Equal "Blocked apply preserved module transactions" "2" "$($verifyBlockedResult.Json.moduleTransactions)"
    Assert-Equal "Blocked apply preserved synthetic withdrawals" "1" "$($verifyBlockedResult.Json.syntheticWithdrawals)"
    Assert-Equal "Blocked apply preserved synthetic transactions" "1" "$($verifyBlockedResult.Json.syntheticTransactions)"
    Assert-Equal "Blocked apply preserved unknown withdrawals" "1" "$($verifyBlockedResult.Json.unknownWithdrawals)"
    Assert-Equal "Blocked apply preserved unknown transactions" "1" "$($verifyBlockedResult.Json.unknownTransactions)"
    Assert-Equal "Blocked apply preserved control owner" "1" "$($verifyBlockedResult.Json.controlOwners)"
    Assert-Equal "Blocked apply preserved control transaction" "1" "$($verifyBlockedResult.Json.controlTransactions)"
} else {
    Write-Fail "Verification after blocked apply failed"
    if ($verifyBlockedResult.Raw) { Write-Host $verifyBlockedResult.Raw -ForegroundColor Red }
}

Write-Step "2.1" "Remove unknown orphan cluster only"
$removeUnknownScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = '$mongoUri';
const dbName = '$dbName';
const ownerId = '$unknownOwnerId';

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const [withdrawalsResult, transactionsResult] = await Promise.all([
    db.collection('withdrawals').deleteMany({ ownerId: new ObjectId(ownerId) }),
    db.collection('fund_transactions').deleteMany({ ownerId: new ObjectId(ownerId) }),
  ]);
  console.log(JSON.stringify({
    deletedWithdrawals: withdrawalsResult.deletedCount || 0,
    deletedFundTransactions: transactionsResult.deletedCount || 0,
  }, null, 2));
  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@
$removeUnknownResult = Invoke-NodeInlineJson -Script $removeUnknownScript -Label "RemoveUnknownCluster"
if ($null -ne $removeUnknownResult.Json) {
    Assert-Equal "Removed unknown withdrawals" "1" "$($removeUnknownResult.Json.deletedWithdrawals)"
    Assert-Equal "Removed unknown fund transactions" "1" "$($removeUnknownResult.Json.deletedFundTransactions)"
} else {
    Write-Fail "Removing unknown orphan cluster failed"
    if ($removeUnknownResult.Raw) { Write-Host $removeUnknownResult.Raw -ForegroundColor Red }
}

Write-Step "2.2" "Re-audit after removing unknown cluster"
$audit2Result = Invoke-NodeFileJson -ScriptPath $auditScript -Arguments @("--mongo-uri", $mongoUri, "--db-name", $dbName, "--sample-limit", "50", "--out", $audit2Path) -Label "Audit2" -JsonPath $audit2Path
if ($null -ne $audit2Result.Json) {
    Assert-Equal "Audit2 orphan owner refs" "2" "$($audit2Result.Json.orphanOwnerIdCount)"
    Assert-Equal "Audit2 orphan withdrawals" "4" "$($audit2Result.Json.targets.withdrawals.orphanDocumentCount)"
    Assert-Equal "Audit2 orphan fund transactions" "3" "$($audit2Result.Json.targets.fund_transactions.orphanDocumentCount)"
} else {
    Write-Fail "Audit2 failed"
    if ($audit2Result.Raw) { Write-Host $audit2Result.Raw -ForegroundColor Red }
}

Write-Step "2.3" "Apply cleanup after unknown cluster is gone"
$applyPassResult = Invoke-NodeFileJson -ScriptPath $cleanupScript -Arguments @("--apply", "--mongo-uri", $mongoUri, "--db-name", $dbName, "--audit-file", $audit2Path, "--out", $applyPassPath) -Label "CleanupApplyPass" -JsonPath $applyPassPath
if ($null -ne $applyPassResult.Json) {
    Assert-True "Successful apply did not block" ($applyPassResult.Json.apply.blocked -eq $false) "cleanup apply should not have blocked"
    Assert-Equal "Successful apply deleted withdrawals" "4" "$($applyPassResult.Json.apply.deleted.withdrawals)"
    Assert-Equal "Successful apply deleted fund transactions" "3" "$($applyPassResult.Json.apply.deleted.fund_transactions)"
    Assert-Equal "Successful apply deleted total docs" "7" "$($applyPassResult.Json.apply.deleted.total)"
} else {
    Write-Fail "Cleanup apply after removing unknown cluster failed"
    if ($applyPassResult.Raw) { Write-Host $applyPassResult.Raw -ForegroundColor Red }
}

Write-Step "2.4" "Verify cleanup removed only eligible orphan fixture rows"
$verifyCleanupScript = @"
const { MongoClient, ObjectId } = require('mongodb');
const mongoUri = '$mongoUri';
const dbName = '$dbName';

(async () => {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const moduleOwnerId = '$moduleOwnerId';
  const syntheticOwnerId = '$syntheticOwnerId';
  const controlOwnerId = new ObjectId('$controlOwnerId');

  const [moduleWithdrawals, moduleTransactions, syntheticWithdrawals, syntheticTransactions, controlOwners, controlTransactions] = await Promise.all([
    db.collection('withdrawals').countDocuments({ ownerId: new ObjectId(moduleOwnerId) }),
    db.collection('fund_transactions').countDocuments({ ownerId: new ObjectId(moduleOwnerId) }),
    db.collection('withdrawals').countDocuments({ ownerId: new ObjectId(syntheticOwnerId) }),
    db.collection('fund_transactions').countDocuments({ ownerId: new ObjectId(syntheticOwnerId) }),
    db.collection('owners').countDocuments({ _id: controlOwnerId }),
    db.collection('fund_transactions').countDocuments({ ownerId: controlOwnerId }),
  ]);

  console.log(JSON.stringify({
    moduleWithdrawals,
    moduleTransactions,
    syntheticWithdrawals,
    syntheticTransactions,
    controlOwners,
    controlTransactions,
  }, null, 2));

  await client.close();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@
$verifyCleanupResult = Invoke-NodeInlineJson -Script $verifyCleanupScript -Label "VerifyCleanup"
if ($null -ne $verifyCleanupResult.Json) {
    Assert-Equal "Cleanup removed module withdrawals" "0" "$($verifyCleanupResult.Json.moduleWithdrawals)"
    Assert-Equal "Cleanup removed module transactions" "0" "$($verifyCleanupResult.Json.moduleTransactions)"
    Assert-Equal "Cleanup removed synthetic withdrawals" "0" "$($verifyCleanupResult.Json.syntheticWithdrawals)"
    Assert-Equal "Cleanup removed synthetic transactions" "0" "$($verifyCleanupResult.Json.syntheticTransactions)"
    Assert-Equal "Cleanup preserved control owner" "1" "$($verifyCleanupResult.Json.controlOwners)"
    Assert-Equal "Cleanup preserved control transaction" "1" "$($verifyCleanupResult.Json.controlTransactions)"
} else {
    Write-Fail "Verification after successful cleanup failed"
    if ($verifyCleanupResult.Raw) { Write-Host $verifyCleanupResult.Raw -ForegroundColor Red }
}

Write-Step "3.1" "Final audit after cleanup"
$audit3Result = Invoke-NodeFileJson -ScriptPath $auditScript -Arguments @("--mongo-uri", $mongoUri, "--db-name", $dbName, "--sample-limit", "50", "--out", $audit3Path) -Label "Audit3" -JsonPath $audit3Path
if ($null -ne $audit3Result.Json) {
    Assert-Equal "Audit3 orphan owner refs" "0" "$($audit3Result.Json.orphanOwnerIdCount)"
    Assert-Equal "Audit3 orphan withdrawals" "0" "$($audit3Result.Json.targets.withdrawals.orphanDocumentCount)"
    Assert-Equal "Audit3 orphan fund transactions" "0" "$($audit3Result.Json.targets.fund_transactions.orphanDocumentCount)"
} else {
    Write-Fail "Audit3 failed"
    if ($audit3Result.Raw) { Write-Host $audit3Result.Raw -ForegroundColor Red }
}

Write-Step "3.2" "Idempotent apply on zero-orphan audit"
$idempotentResult = Invoke-NodeFileJson -ScriptPath $cleanupScript -Arguments @("--apply", "--mongo-uri", $mongoUri, "--db-name", $dbName, "--audit-file", $audit3Path, "--out", $idempotentPath) -Label "CleanupIdempotent" -JsonPath $idempotentPath
if ($null -ne $idempotentResult.Json) {
    Assert-Equal "Idempotent eligible clusters" "0" "$($idempotentResult.Json.counts.eligibleClusters)"
    Assert-Equal "Idempotent unknown clusters" "0" "$($idempotentResult.Json.counts.unknownClusters)"
    Assert-Equal "Idempotent deleted docs" "0" "$($idempotentResult.Json.apply.deleted.total)"
} else {
    Write-Fail "Idempotent cleanup run failed"
    if ($idempotentResult.Raw) { Write-Host $idempotentResult.Raw -ForegroundColor Red }
}

Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount) | PASS: $($script:passCount) | FAIL: $($script:failCount)"
if ($script:failCount -gt 0) {
    Write-Host ""
    Write-Host "Failed checks:" -ForegroundColor Red
    foreach ($failure in $script:failDetails) {
        Write-Host "  - $failure" -ForegroundColor Red
    }
    exit 1
}

exit 0
