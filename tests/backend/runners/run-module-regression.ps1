#!/usr/bin/env pwsh
<#
Compatibility wrapper.
Canonical runner lives at tests/backend/runners/run-backend-module-regression.ps1
#>
$runner = Join-Path $PSScriptRoot 'run-backend-module-regression.ps1'
& powershell -ExecutionPolicy Bypass -File $runner @args
exit $LASTEXITCODE
