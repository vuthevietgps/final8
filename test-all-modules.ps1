#!/usr/bin/env pwsh
<#
Compatibility entrypoint.
Default local QA bootstrap lives at tests/backend/runners/run-backend-module-regression-local.ps1
#>
$runner = Join-Path $PSScriptRoot 'tests\backend\runners\run-backend-module-regression-local.ps1'
& powershell -ExecutionPolicy Bypass -File $runner @args
exit $LASTEXITCODE
