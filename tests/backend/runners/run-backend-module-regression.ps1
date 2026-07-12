#!/usr/bin/env pwsh
<#
    =====================================================================================
    RUN-BACKEND-MODULE-REGRESSION.ps1
    =====================================================================================
    Canonical backend module regression runner.
    Executes active module suites from tests/backend/suites/modules/*
    and writes fresh results into tests/backend/artifacts/results/.
    
    Usage:
      powershell -ExecutionPolicy Bypass -File .\tests\backend\runners\run-backend-module-regression.ps1
      powershell -ExecutionPolicy Bypass -File .\tests\backend\runners\run-module-regression.ps1
      powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$testsRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$artifactsDir = Join-Path $testsRoot 'artifacts\results'
$setupScript = Join-Path $testsRoot 'setup\ensure-regression-users.ps1'
$runtimeManifestScript = Join-Path $testsRoot 'setup\backend-runtime-manifest.ps1'
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

if (Test-Path $runtimeManifestScript) {
    . $runtimeManifestScript
}

$runtimeManifestUsage = $null
if (Get-Command Use-BackendRuntimeManifest -ErrorAction SilentlyContinue) {
    try {
        $runtimeManifestUsage = Use-BackendRuntimeManifest
    } catch {
        Write-Host "  [ERROR] Runtime manifest load failed: $_" -ForegroundColor Red
        exit 1
    }
}

function Resolve-BackendBaseUrl {
    if ($env:BACKEND_BASE_URL) {
        return $env:BACKEND_BASE_URL.TrimEnd('/')
    }

    foreach ($candidate in @("http://localhost:3000/api", "http://localhost:3000")) {
        try {
            $resp = Invoke-WebRequest -Uri "$candidate/users" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -in 200, 401, 403) {
                return $candidate.TrimEnd('/')
            }
        } catch {
            $status = 0
            try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
            if ($status -in 200, 401, 403) {
                return $candidate.TrimEnd('/')
            }
        }
    }

    return "http://localhost:3000"
}

$backendBaseUrl = Resolve-BackendBaseUrl
$backendHealthUrl =
    if ($env:BACKEND_HEALTH_URL) { $env:BACKEND_HEALTH_URL.TrimEnd('/') }
    elseif ($backendBaseUrl -match '/api$') { $backendBaseUrl -replace '/api$','/health' }
    else { "$backendBaseUrl/health" }

if (-not $env:AUTH_RBAC_BASE_URL) {
    $env:AUTH_RBAC_BASE_URL = $backendBaseUrl
}
if (-not $env:AUTH_HARDENING_BASE_URL) {
    $env:AUTH_HARDENING_BASE_URL = $backendBaseUrl
}
if (-not $env:BACKEND_HEALTH_URL) {
    $env:BACKEND_HEALTH_URL = $backendHealthUrl
}

$runnerAliasedDb06MediaDir = $false
if ($env:BACKEND_BASE_URL -and [string]::IsNullOrWhiteSpace($env:DB06_MEDIA_DIR) -and -not [string]::IsNullOrWhiteSpace($env:MEDIA_DIR)) {
    $env:DB06_MEDIA_DIR = $env:MEDIA_DIR
    $runnerAliasedDb06MediaDir = $true
}

Write-Host ""
Write-Host ("=" * 90) -ForegroundColor White
Write-Host "  BACKEND MODULE REGRESSION - $ts" -ForegroundColor White
Write-Host ("=" * 90) -ForegroundColor White
Write-Host ""
Write-Host "  Backend base URL : $backendBaseUrl" -ForegroundColor DarkGray
Write-Host "  Backend health   : $backendHealthUrl" -ForegroundColor DarkGray
Write-Host "  Mongo URI        : $(if ($env:MONGODB_URI) { $env:MONGODB_URI } else { '<from backend/.env>' })" -ForegroundColor DarkGray
if ($runtimeManifestUsage) {
    Write-Host "  Runtime manifest : $($runtimeManifestUsage.Path)" -ForegroundColor DarkGray
    if (@($runtimeManifestUsage.Applied).Count -gt 0) {
        Write-Host "  Manifest applied : $(@($runtimeManifestUsage.Applied) -join ', ')" -ForegroundColor DarkGray
    } else {
        Write-Host "  Manifest applied : none (shell env already provided explicit values)" -ForegroundColor DarkGray
    }
}
if ($runnerAliasedDb06MediaDir) {
    Write-Host "  DB06 media root  : aliased from MEDIA_DIR for canonical external-backend flow" -ForegroundColor DarkGray
} elseif ($env:BACKEND_BASE_URL -and [string]::IsNullOrWhiteSpace($env:DB06_MEDIA_DIR)) {
    Write-Host "  DB06 media root  : <not provided>; standalone DB-06 suite may BLOCK in external-backend mode" -ForegroundColor Yellow
}
Write-Host ""

if (Test-Path $setupScript) {
    try {
        & powershell -ExecutionPolicy Bypass -File $setupScript
        if ($LASTEXITCODE -ne 0) {
            throw "Regression setup exited with code $LASTEXITCODE"
        }
    } catch {
        Write-Host "  [ERROR] Regression setup failed: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  [WARN] Setup script not found: $setupScript" -ForegroundColor Yellow
}

$modules = @(
    @{ Name = "Auth & RBAC";                     Script = "suites\modules\core\module.auth-rbac.ps1" }
    @{ Name = "Auth Hardening";                  Script = "suites\modules\core\module.auth-hardening.ps1" }
    @{ Name = "Customer Management";             Script = "suites\modules\core\module.customer.ps1" }
    @{ Name = "User Import & Export";            Script = "suites\modules\core\module.user-import-export.ps1" }
    @{ Name = "Ad Account & Ad Group";           Script = "suites\modules\core\module.ad-account-ad-group.ps1" }
    @{ Name = "API Token & Timezone";            Script = "suites\modules\core\module.api-token-timezone.ps1" }
    @{ Name = "Labor Cost & Other Cost";         Script = "suites\modules\core\module.labor-other-cost.ps1" }
    @{ Name = "Owner Fund & Loan";               Script = "suites\modules\core\module.owner-fund-loan.ps1" }
    @{ Name = "Ads Alerts & KPI";                Script = "suites\modules\core\module.ads-alerts-kpi.ps1" }
    @{ Name = "Reports, Products & Config";      Script = "suites\modules\core\module.reports-products-config.ps1" }
    @{ Name = "Supply Chain";                    Script = "suites\modules\core\module.supply-chain.ps1" }
    @{ Name = "Agent & Supplier Quotes";        Script = "suites\modules\core\module.agent-supplier-quotes.ps1" }
    @{ Name = "Media, Chat & Config";            Script = "suites\modules\core\module.media-chat-config.ps1" }
    @{ Name = "Finance Control & Funds";         Script = "suites\modules\core\module.finance-control-funds.ps1" }
    @{ Name = "DB Consistency";                  Script = "suites\modules\extended\module.db-consistency.ps1" }
    @{ Name = "DB Seed Cleanup";                 Script = "suites\modules\extended\module.db-seed-cleanup.ps1" }
    @{ Name = "Owner Fund Ledger Reconcile";     Script = "suites\modules\extended\module.owner-fund-ledger-reconcile.ps1" }
    @{ Name = "Owner Fund ObjectId Normalize";   Script = "suites\modules\extended\module.owner-fund-objectid-normalize.ps1" }
    @{ Name = "Purchase Inventory";              Script = "suites\modules\extended\module.purchase-inventory.ps1" }
    @{ Name = "Order Sheet Sync & Ops";          Script = "suites\modules\extended\module.order-sheet-sync-ops.ps1" }
    @{ Name = "Net Profit & Ad Group";           Script = "suites\modules\extended\module.net-profit-ad-group.ps1" }
    @{ Name = "Finance Survival Alerts";         Script = "suites\modules\extended\module.finance-survival-alerts.ps1" }
    @{ Name = "Return Report Product Rate";      Script = "suites\modules\extended\module.return-report-product-rate.ps1" }
    @{ Name = "Salary Labor Financial Link";     Script = "suites\modules\extended\module.salary-labor-finance-link.ps1" }
    @{ Name = "Ads Budget Product-X vs Legacy";  Script = "suites\modules\extended\module.ads-budget-product-x-vs-legacy.ps1" }
    @{ Name = "Ads Budget Ripple Updates";       Script = "suites\modules\extended\module.ads-budget-ripple-updates.ps1" }
    @{ Name = "Ads Budget X Emergency";          Script = "suites\modules\extended\module.ads-budget-x-emergency.ps1" }
)

$results = @()
$totalPass = 0
$totalFail = 0
$totalBlocked = 0
$moduleIndex = 0

foreach ($mod in $modules) {
    $moduleIndex++
    $scriptPath = Join-Path $testsRoot $mod.Script

    Write-Host ""
    Write-Host ("=" * 90) -ForegroundColor Magenta
    Write-Host "  [$moduleIndex/$($modules.Count)] RUNNING: $($mod.Name)" -ForegroundColor Magenta
    Write-Host "  Script: $($mod.Script)" -ForegroundColor DarkGray
    Write-Host ("=" * 90) -ForegroundColor Magenta

    if (-not (Test-Path $scriptPath)) {
        Write-Host "  [SKIP] Script not found: $scriptPath" -ForegroundColor Yellow
        $results += @{ Name = $mod.Name; Status = "SKIP"; Pass = 0; Fail = 0; Duration = "0s" }
        continue
    }

    $startTime = Get-Date
    $scriptExitCode = 0
    try {
        # Capture output and extract PASS/FAIL counts
        $output = & powershell -ExecutionPolicy Bypass -File $scriptPath 2>&1
        $scriptExitCode = if ($LASTEXITCODE -eq $null) { 0 } else { $LASTEXITCODE }
        $output | ForEach-Object { Write-Host $_ }
    } catch {
        Write-Host "  [ERROR] Script execution failed: $_" -ForegroundColor Red
        $scriptExitCode = 1
    }
    $duration = (Get-Date) - $startTime
    $durationStr = "{0:mm}m {0:ss}s" -f $duration

    # Parse output for PASS/FAIL counts (handles both "PASS: 18" and "PASS           : 18")
    $passLine = $output | Select-String "PASS\s*:\s*(\d+)" | Select-Object -Last 1
    $failLine = $output | Select-String "FAIL\s*:\s*(\d+)" | Select-Object -Last 1
    $blockedLine = $output | Select-String "BLOCKED\s*:\s*(\d+)" | Select-Object -Last 1
    $modPass = if ($passLine) { [int]$passLine.Matches[0].Groups[1].Value } else { @($output | Select-String '^\s*\[PASS\]').Count }
    $modFail = if ($failLine) { [int]$failLine.Matches[0].Groups[1].Value } else { @($output | Select-String '^\s*\[FAIL\]').Count }
    $modBlocked =
        if ($blockedLine) { [int]$blockedLine.Matches[0].Groups[1].Value }
        else { @($output | Select-String '^\s*\[BLOCKED\]').Count }
    if ($scriptExitCode -ne 0 -and $modFail -eq 0 -and $modBlocked -eq 0) {
        if ($scriptExitCode -eq 2) {
            $modBlocked = 1
        } else {
            $modFail = 1
        }
    }

    $totalPass += $modPass
    $totalFail += $modFail
    $totalBlocked += $modBlocked

    if ($modFail -gt 0) {
        $status = "FAIL"
    } elseif ($modBlocked -gt 0) {
        $status = "BLOCKED"
    } else {
        $status = "PASS"
    }
    $results += @{ Name = $mod.Name; Status = $status; Pass = $modPass; Fail = $modFail; Blocked = $modBlocked; Duration = $durationStr }

    Write-Host ""
    $statusColor =
        if ($modFail -gt 0) { "Red" }
        elseif ($modBlocked -gt 0) { "Yellow" }
        else { "Green" }
    Write-Host "  >>> $($mod.Name): $status (pass=$modPass, fail=$modFail, blocked=$modBlocked) [$durationStr]" -ForegroundColor $statusColor
}

# ===== FINAL SUMMARY =====
Write-Host ""
Write-Host ("=" * 90) -ForegroundColor White
Write-Host "  FINAL SUMMARY - MODULE REGRESSION" -ForegroundColor White
Write-Host ("=" * 90) -ForegroundColor White
Write-Host ""
Write-Host ("  {0,-35} {1,-10} {2,-8} {3,-8} {4,-10} {5,-10}" -f "Module", "Status", "Pass", "Fail", "Blocked", "Duration") -ForegroundColor Gray
Write-Host ("  " + ("-" * 89)) -ForegroundColor Gray

foreach ($r in $results) {
    $color = switch ($r.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "BLOCKED" { "Yellow" }
        "SKIP" { "Yellow" }
        default { "Gray" }
    }
    Write-Host ("  {0,-35} {1,-10} {2,-8} {3,-8} {4,-10} {5,-10}" -f $r.Name, $r.Status, $r.Pass, $r.Fail, $r.Blocked, $r.Duration) -ForegroundColor $color
}

Write-Host ""
Write-Host ("  " + ("-" * 89)) -ForegroundColor Gray
Write-Host ("  {0,-35} {1,-10} {2,-8} {3,-8} {4,-10}" -f "TOTAL", "", $totalPass, $totalFail, $totalBlocked) -ForegroundColor $(if ($totalFail -eq 0 -and $totalBlocked -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($totalFail -eq 0 -and $totalBlocked -eq 0) {
    Write-Host "  ALL MODULE TESTS PASSED!" -ForegroundColor Green
} elseif ($totalFail -eq 0) {
    Write-Host "  MODULE TESTS BLOCKED! ($totalBlocked blocked)" -ForegroundColor Yellow
} else {
    Write-Host "  SOME TESTS FAILED! ($totalFail failures)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Timestamp: $ts" -ForegroundColor DarkGray
Write-Host "  Total modules: $($modules.Count)" -ForegroundColor DarkGray
Write-Host "  Total assertions: $($totalPass + $totalFail)" -ForegroundColor DarkGray
Write-Host "  Total blocked: $totalBlocked" -ForegroundColor DarkGray
Write-Host ""

# Save results to JSON
$jsonResults = @{
    timestamp = $ts
    modules = $results
    totalPass = $totalPass
    totalFail = $totalFail
    totalBlocked = $totalBlocked
    totalModules = $modules.Count
} | ConvertTo-Json -Depth 3
$latestResultPath = Join-Path $artifactsDir 'module-regression-latest.json'
$timestampedResultPath = Join-Path $artifactsDir ("module-regression-$ts.json")
$jsonResults | Set-Content -Path $latestResultPath -Encoding UTF8
$jsonResults | Set-Content -Path $timestampedResultPath -Encoding UTF8
Write-Host "  Results saved:" -ForegroundColor DarkGray
Write-Host "    - $latestResultPath" -ForegroundColor DarkGray
Write-Host "    - $timestampedResultPath" -ForegroundColor DarkGray

if ($totalFail -gt 0) {
    exit 1
}
if ($totalBlocked -gt 0) {
    exit 2
}
