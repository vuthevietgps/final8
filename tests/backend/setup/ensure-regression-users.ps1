#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$jsPath = Join-Path $scriptDir 'ensure-regression-users.js'

if (-not (Test-Path $jsPath)) {
    throw "Missing regression setup script: $jsPath"
}

Write-Host ""
Write-Host ("=" * 90) -ForegroundColor DarkCyan
Write-Host "  REGRESSION SETUP: ENSURE BASELINE USERS" -ForegroundColor DarkCyan
Write-Host ("=" * 90) -ForegroundColor DarkCyan

& node $jsPath
if ($LASTEXITCODE -ne 0) {
    throw "Regression user setup failed with exit code $LASTEXITCODE"
}
