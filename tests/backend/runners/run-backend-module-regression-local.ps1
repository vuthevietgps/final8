#!/usr/bin/env pwsh
<#
    =====================================================================================
    RUN-BACKEND-MODULE-REGRESSION-LOCAL.ps1
    =====================================================================================
    Local QA bootstrap runner.
    Builds the backend, starts a dedicated local backend with isolated Mongo/media config,
    then delegates to the canonical module runner.

    Usage:
      powershell -ExecutionPolicy Bypass -File .\test-all-modules.ps1
      powershell -ExecutionPolicy Bypass -File .\tests\backend\runners\run-backend-module-regression-local.ps1

    Notes:
      - If BACKEND_BASE_URL is already provided, this wrapper delegates directly to the
        canonical runner and does not start its own backend.
      - DB06 media-root coupling stays strict for direct suite invocation; this wrapper
        only standardizes the local full-regression flow.
    =====================================================================================
#>
param(
    [int]$Port = 0,
    [string]$MongoUri,
    [string]$MediaDir
)

$ErrorActionPreference = 'Stop'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$tsDigits = $ts -replace '[^0-9]', ''
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$testsRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$repoRoot = (Resolve-Path (Join-Path $testsRoot '..\..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$artifactsDir = Join-Path $testsRoot 'artifacts\results'
$canonicalRunner = Join-Path $scriptDir 'run-backend-module-regression.ps1'
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

$backendStdOut = Join-Path $artifactsDir "tmp-local-module-regression-backend-$ts.out.log"
$backendStdErr = Join-Path $artifactsDir "tmp-local-module-regression-backend-$ts.err.log"
$script:BackendProcess = $null
$script:BackendPid = $null
$script:BackendWrapperPid = $null

function Get-EnvValue([string]$Name) {
    $item = Get-Item "Env:$Name" -ErrorAction SilentlyContinue
    if ($item) { return [string]$item.Value }
    return $null
}

function Set-Or-ClearEnv([string]$Name, [string]$Value) {
    if ($null -ne $Value) {
        Set-Item -Path "Env:$Name" -Value $Value
    } else {
        Remove-Item "Env:$Name" -ErrorAction SilentlyContinue
    }
}

function Get-FreePort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    try {
        $listener.Start()
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

function Resolve-FullPath([string]$PathValue) {
    $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction SilentlyContinue
    if ($resolved) { return $resolved.Path }
    return [System.IO.Path]::GetFullPath($PathValue)
}

function Wait-BackendHealthy([string]$HealthUrl, [int]$PortNumber) {
    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 2
        try {
            Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop | Out-Null
            $listener = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($listener -and $listener.OwningProcess) {
                $script:BackendPid = $listener.OwningProcess
            }
            return $true
        } catch {}
    } while ((Get-Date) -lt $deadline)
    return $false
}

function Stop-LocalBackend {
    if ($script:BackendPid) {
        try { Stop-Process -Id $script:BackendPid -Force -ErrorAction Stop } catch {}
    }
    if ($script:BackendWrapperPid -and $script:BackendWrapperPid -ne $script:BackendPid) {
        try { Stop-Process -Id $script:BackendWrapperPid -Force -ErrorAction Stop } catch {}
    } elseif ($script:BackendProcess -and -not $script:BackendProcess.HasExited) {
        try { Stop-Process -Id $script:BackendProcess.Id -Force -ErrorAction Stop } catch {}
    }
}

$previousEnv = @{
    BACKEND_BASE_URL = Get-EnvValue 'BACKEND_BASE_URL'
    BACKEND_HEALTH_URL = Get-EnvValue 'BACKEND_HEALTH_URL'
    AUTH_RBAC_BASE_URL = Get-EnvValue 'AUTH_RBAC_BASE_URL'
    AUTH_HARDENING_BASE_URL = Get-EnvValue 'AUTH_HARDENING_BASE_URL'
    MONGODB_URI = Get-EnvValue 'MONGODB_URI'
    MEDIA_DIR = Get-EnvValue 'MEDIA_DIR'
    DB06_MEDIA_DIR = Get-EnvValue 'DB06_MEDIA_DIR'
}

$canonicalExitCode = 1
$delegateToExistingBackend = -not [string]::IsNullOrWhiteSpace($env:BACKEND_BASE_URL)

try {
    if ($delegateToExistingBackend) {
        Write-Host ""
        Write-Host ("=" * 90) -ForegroundColor White
        Write-Host "  LOCAL QA BOOTSTRAP WRAPPER - DELEGATE TO EXISTING BACKEND" -ForegroundColor White
        Write-Host ("=" * 90) -ForegroundColor White
        Write-Host ""
        Write-Host "  Existing backend base URL detected: $($env:BACKEND_BASE_URL)" -ForegroundColor DarkGray
        & powershell -ExecutionPolicy Bypass -File $canonicalRunner
        $canonicalExitCode = if ($LASTEXITCODE -eq $null) { 0 } else { $LASTEXITCODE }
    } else {
        $effectivePort = if ($Port -gt 0) { $Port } else { Get-FreePort }
        $effectiveMongoUri =
            if (-not [string]::IsNullOrWhiteSpace($MongoUri)) { $MongoUri.Trim() }
            elseif (-not [string]::IsNullOrWhiteSpace($env:MONGODB_URI)) { $env:MONGODB_URI.Trim() }
            else { "mongodb://127.0.0.1:27017/htxbachgia_module_regression_local_$tsDigits" }
        $effectiveMediaDir =
            if (-not [string]::IsNullOrWhiteSpace($MediaDir)) { Resolve-FullPath $MediaDir }
            else { Join-Path $artifactsDir "tmp-local-module-regression-media-$tsDigits" }

        New-Item -ItemType Directory -Force -Path $effectiveMediaDir | Out-Null

        Write-Host ""
        Write-Host ("=" * 90) -ForegroundColor White
        Write-Host "  LOCAL QA BOOTSTRAP - $ts" -ForegroundColor White
        Write-Host ("=" * 90) -ForegroundColor White
        Write-Host ""
        Write-Host "  Backend port     : $effectivePort" -ForegroundColor DarkGray
        Write-Host "  Mongo URI        : $effectiveMongoUri" -ForegroundColor DarkGray
        Write-Host "  Media dir        : $effectiveMediaDir" -ForegroundColor DarkGray
        Write-Host ""

        Push-Location $backendDir
        try {
            & npm.cmd run build
            if ($LASTEXITCODE -ne 0) {
                throw "Backend build exited with code $LASTEXITCODE"
            }
        } finally {
            Pop-Location
        }

        $command = "Set-Location '$backendDir'; `$env:PORT='$effectivePort'; `$env:MONGODB_URI='$effectiveMongoUri'; `$env:MEDIA_DIR='$effectiveMediaDir'; node dist/main.js"
        $script:BackendProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-Command',$command -WindowStyle Hidden -RedirectStandardOutput $backendStdOut -RedirectStandardError $backendStdErr -PassThru
        $script:BackendWrapperPid = $script:BackendProcess.Id
        $script:BackendPid = $script:BackendProcess.Id

        $backendBaseUrl = "http://localhost:$effectivePort/api"
        $backendHealthUrl = "http://localhost:$effectivePort/health"

        if (-not (Wait-BackendHealthy -HealthUrl $backendHealthUrl -PortNumber $effectivePort)) {
            throw "Dedicated local backend did not become healthy. See $backendStdOut and $backendStdErr"
        }

        Set-Or-ClearEnv 'BACKEND_BASE_URL' $backendBaseUrl
        Set-Or-ClearEnv 'BACKEND_HEALTH_URL' $backendHealthUrl
        Set-Or-ClearEnv 'AUTH_RBAC_BASE_URL' $backendBaseUrl
        Set-Or-ClearEnv 'AUTH_HARDENING_BASE_URL' $backendBaseUrl
        Set-Or-ClearEnv 'MONGODB_URI' $effectiveMongoUri
        Set-Or-ClearEnv 'MEDIA_DIR' $effectiveMediaDir
        Set-Or-ClearEnv 'DB06_MEDIA_DIR' $null

        & powershell -ExecutionPolicy Bypass -File $canonicalRunner
        $canonicalExitCode = if ($LASTEXITCODE -eq $null) { 0 } else { $LASTEXITCODE }
    }
} finally {
    Stop-LocalBackend

    foreach ($entry in $previousEnv.GetEnumerator()) {
        Set-Or-ClearEnv $entry.Key $entry.Value
    }
}

exit $canonicalExitCode
