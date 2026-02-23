#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-ALL-MODULES.ps1
    =====================================================================================
    Master runner that executes all module test scripts sequentially.
    Each module runs independently and reports PASS/FAIL counts.
    Final summary aggregates all results.
    
    Usage:
      powershell -ExecutionPolicy Bypass -File test-all-modules.ps1
      powershell -ExecutionPolicy Bypass -File test-all-modules.ps1 2>&1 | Tee-Object -FilePath test-all-modules-output.txt
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

Write-Host ""
Write-Host ("=" * 90) -ForegroundColor White
Write-Host "  MASTER TEST RUNNER - ALL MODULES - $ts" -ForegroundColor White
Write-Host ("=" * 90) -ForegroundColor White
Write-Host ""

$modules = @(
    @{ Name = "Auth & RBAC";              Script = "test-module-auth-rbac.ps1" }
    @{ Name = "Customer Management";      Script = "test-module-customer.ps1" }
    @{ Name = "Ad Account & Ad Group";    Script = "test-module-ad-account-group.ps1" }
    @{ Name = "Labor Cost & Other Cost";  Script = "test-module-labor-other-cost.ps1" }
    @{ Name = "Owner Fund & Loan";        Script = "test-module-owner-fund-loan.ps1" }
    @{ Name = "Ads Alerts & KPI";         Script = "test-module-ads-alerts-kpi.ps1" }
    @{ Name = "Reports, Products & Config"; Script = "test-module-reports-products-config.ps1" }
    @{ Name = "Supply Chain";             Script = "test-module-supply-chain.ps1" }
    @{ Name = "Quotes";                   Script = "test-module-quotes.ps1" }
    @{ Name = "Media, Chat & Config";     Script = "test-module-media-chat-config.ps1" }
    @{ Name = "Financial Deep";           Script = "test-module-financial-deep.ps1" }
)

$results = @()
$totalPass = 0
$totalFail = 0
$moduleIndex = 0

foreach ($mod in $modules) {
    $moduleIndex++
    $scriptPath = Join-Path $scriptDir $mod.Script

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
    try {
        # Capture output and extract PASS/FAIL counts
        $output = & powershell -ExecutionPolicy Bypass -File $scriptPath 2>&1
        $output | ForEach-Object { Write-Host $_ }
    } catch {
        Write-Host "  [ERROR] Script execution failed: $_" -ForegroundColor Red
    }
    $duration = (Get-Date) - $startTime
    $durationStr = "{0:mm}m {0:ss}s" -f $duration

    # Parse output for PASS/FAIL counts (handles both "PASS: 18" and "PASS           : 18")
    $passLine = $output | Select-String "PASS\s*:\s*(\d+)" | Select-Object -Last 1
    $failLine = $output | Select-String "FAIL\s*:\s*(\d+)" | Select-Object -Last 1
    $modPass = if ($passLine) { [int]$passLine.Matches[0].Groups[1].Value } else { 0 }
    $modFail = if ($failLine) { [int]$failLine.Matches[0].Groups[1].Value } else { 0 }

    $totalPass += $modPass
    $totalFail += $modFail

    $status = if ($modFail -eq 0) { "PASS" } else { "FAIL" }
    $results += @{ Name = $mod.Name; Status = $status; Pass = $modPass; Fail = $modFail; Duration = $durationStr }

    Write-Host ""
    Write-Host "  >>> $($mod.Name): $status (pass=$modPass, fail=$modFail) [$durationStr]" -ForegroundColor $(if ($modFail -eq 0) { "Green" } else { "Red" })
}

# ===== FINAL SUMMARY =====
Write-Host ""
Write-Host ("=" * 90) -ForegroundColor White
Write-Host "  FINAL SUMMARY - ALL MODULE TESTS" -ForegroundColor White
Write-Host ("=" * 90) -ForegroundColor White
Write-Host ""
Write-Host ("  {0,-35} {1,-8} {2,-8} {3,-8} {4,-10}" -f "Module", "Status", "Pass", "Fail", "Duration") -ForegroundColor Gray
Write-Host ("  " + ("-" * 75)) -ForegroundColor Gray

foreach ($r in $results) {
    $color = switch ($r.Status) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "SKIP" { "Yellow" }
        default { "Gray" }
    }
    Write-Host ("  {0,-35} {1,-8} {2,-8} {3,-8} {4,-10}" -f $r.Name, $r.Status, $r.Pass, $r.Fail, $r.Duration) -ForegroundColor $color
}

Write-Host ""
Write-Host ("  " + ("-" * 75)) -ForegroundColor Gray
Write-Host ("  {0,-35} {1,-8} {2,-8} {3,-8}" -f "TOTAL", "", $totalPass, $totalFail) -ForegroundColor $(if ($totalFail -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($totalFail -eq 0) {
    Write-Host "  ALL MODULE TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  SOME TESTS FAILED! ($totalFail failures)" -ForegroundColor Red
}

Write-Host ""
Write-Host "  Timestamp: $ts" -ForegroundColor DarkGray
Write-Host "  Total modules: $($modules.Count)" -ForegroundColor DarkGray
Write-Host "  Total assertions: $($totalPass + $totalFail)" -ForegroundColor DarkGray
Write-Host ""

# Save results to JSON
$jsonResults = @{
    timestamp = $ts
    modules = $results
    totalPass = $totalPass
    totalFail = $totalFail
    totalModules = $modules.Count
} | ConvertTo-Json -Depth 3
$jsonResults | Set-Content -Path (Join-Path $scriptDir "test-all-modules-results.json") -Encoding UTF8
Write-Host "  Results saved: test-all-modules-results.json" -ForegroundColor DarkGray
