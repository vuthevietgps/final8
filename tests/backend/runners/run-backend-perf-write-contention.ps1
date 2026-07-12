#!/usr/bin/env pwsh
<#
    =====================================================================================
    RUN-BACKEND-PERF-WRITE-CONTENTION.ps1
    =====================================================================================
    Strict LOAD-03 entrypoint.

    Modes:
      1. Existing backend / external manifest:
         - Reuses BACKEND_BASE_URL or the supplied runtime manifest.
      2. Local bootstrap (default when no backend contract is supplied):
         - Builds backend
         - Starts a dedicated local backend on a free port
         - Uses isolated Mongo/media roots
         - Writes a runtime manifest for canonical LOAD-03 execution

    This closes the harness class where LOAD-03 accidentally targets a stale
    localhost backend from a previous run.
    =====================================================================================
#>
param(
    [string]$ManifestPath,
    [string]$FixturePath,
    [string]$SummaryPath,
    [string]$BackendEmail = 'director@test.com',
    [string]$BackendPassword = '123456',
    [string]$K6Image = 'grafana/k6',
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
$canonicalRunner = Join-Path $scriptDir 'run-load03-write-contention.ps1'
$manifestWriter = Join-Path $scriptDir 'write-backend-runtime-manifest.ps1'
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

$backendStdOut = Join-Path $artifactsDir "tmp-load03-local-backend-$ts.out.log"
$backendStdErr = Join-Path $artifactsDir "tmp-load03-local-backend-$ts.err.log"
$statePath = Join-Path $artifactsDir "tmp-load03-local-backend-$ts.json"
$localManifestPath = Join-Path $artifactsDir "runtime-contract-load03-local-$ts.json"
$script:BackendProcess = $null
$script:BackendPid = $null
$script:BackendWrapperPid = $null

function Get-EnvValue([string]$Name) {
    $item = Get-Item "Env:$Name" -ErrorAction SilentlyContinue
    if ($item) { return [string]$item.Value }
    return $null
}

function Set-Or-ClearEnv([string]$Name, [string]$Value) {
    if ($null -ne $Value -and $Value -ne '') {
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

function Resolve-FullPath([string]$Candidate) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $null
    }

    $resolved = Resolve-Path -LiteralPath $Candidate -ErrorAction SilentlyContinue
    if ($resolved) {
        return $resolved.Path
    }

    return [System.IO.Path]::GetFullPath($Candidate)
}

function Get-ManifestMongoUri([string]$Path) {
    $resolved = Resolve-FullPath $Path
    if ([string]::IsNullOrWhiteSpace($resolved) -or -not (Test-Path -LiteralPath $resolved)) {
        return $null
    }

    $raw = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8
    $json = $raw | ConvertFrom-Json
    return [string]$json.mongodbUri
}

function Get-ListeningProcessId([int]$PortNumber) {
    $listener = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener -and $listener.OwningProcess) {
        return [int]$listener.OwningProcess
    }
    return $null
}

function Wait-BackendHealthy([string]$HealthUrl, [int]$PortNumber) {
    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 2
        try {
            Invoke-WebRequest -Uri $HealthUrl -Method GET -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop | Out-Null
            $listenerPid = Get-ListeningProcessId -PortNumber $PortNumber
            if ($listenerPid) {
                $script:BackendPid = $listenerPid
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

$previousEnv = @{}
foreach ($name in @(
    'BACKEND_RUNTIME_MANIFEST',
    'BACKEND_BASE_URL',
    'BACKEND_HEALTH_URL',
    'PERF_BACKEND_BASE_URL',
    'PERF_BACKEND_HEALTH_URL',
    'BACKEND_EMAIL',
    'BACKEND_PASSWORD',
    'WRITE_CONTENTION_FIXTURE',
    'WRITE_CONTENTION_SUMMARY_PATH',
    'MONGODB_URI',
    'MEDIA_DIR',
    'DB06_MEDIA_DIR'
)) {
    $previousEnv[$name] = Get-EnvValue $name
}

$exitCode = 1
$resolvedManifestPath = Resolve-FullPath $ManifestPath
$delegateToExistingBackend =
    -not [string]::IsNullOrWhiteSpace($resolvedManifestPath) -or
    -not [string]::IsNullOrWhiteSpace((Get-EnvValue 'BACKEND_RUNTIME_MANIFEST')) -or
    -not [string]::IsNullOrWhiteSpace((Get-EnvValue 'BACKEND_BASE_URL'))

try {
    if ($delegateToExistingBackend) {
        $effectiveManifestPath =
            if (-not [string]::IsNullOrWhiteSpace($resolvedManifestPath)) { $resolvedManifestPath }
            else { Resolve-FullPath (Get-EnvValue 'BACKEND_RUNTIME_MANIFEST') }

        if ([string]::IsNullOrWhiteSpace($effectiveManifestPath)) {
            throw 'FAILED_HARNESS: external LOAD-03 execution requires BACKEND_RUNTIME_MANIFEST with mongodbUri so the backend/DB contract can be verified before k6.'
        }

        $manifestMongoUri = Get-ManifestMongoUri -Path $effectiveManifestPath
        if ([string]::IsNullOrWhiteSpace($manifestMongoUri)) {
            throw "FAILED_HARNESS: runtime manifest is missing mongodbUri: $effectiveManifestPath"
        }

        $resolvedManifestPath = $effectiveManifestPath
    }

    if (-not $delegateToExistingBackend) {
        $effectivePort = if ($Port -gt 0) { $Port } else { Get-FreePort }
        if (Get-ListeningProcessId -PortNumber $effectivePort) {
            throw "Selected LOAD-03 bootstrap port $effectivePort is already in use."
        }

        $effectiveMongoUri =
            if (-not [string]::IsNullOrWhiteSpace($MongoUri)) { $MongoUri.Trim() }
            else { "mongodb://127.0.0.1:27017/htxbachgia_load03_local_$tsDigits" }
        $effectiveMediaDir =
            if (-not [string]::IsNullOrWhiteSpace($MediaDir)) { Resolve-FullPath $MediaDir }
            else { Join-Path $artifactsDir "tmp-load03-local-media-$tsDigits" }

        New-Item -ItemType Directory -Force -Path $effectiveMediaDir | Out-Null

        Write-Host ''
        Write-Host ('=' * 90) -ForegroundColor White
        Write-Host "  LOAD-03 LOCAL BOOTSTRAP - $ts" -ForegroundColor White
        Write-Host ('=' * 90) -ForegroundColor White
        Write-Host ''
        Write-Host "  Backend port     : $effectivePort" -ForegroundColor DarkGray
        Write-Host "  Mongo URI        : $effectiveMongoUri" -ForegroundColor DarkGray
        Write-Host "  Media dir        : $effectiveMediaDir" -ForegroundColor DarkGray
        Write-Host "  Runtime manifest : $localManifestPath" -ForegroundColor DarkGray
        Write-Host ''

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
        $perfBaseUrl = "http://host.docker.internal:$effectivePort/api"
        $perfHealthUrl = "http://host.docker.internal:$effectivePort/health"

        if (-not (Wait-BackendHealthy -HealthUrl $backendHealthUrl -PortNumber $effectivePort)) {
            throw "Dedicated LOAD-03 backend did not become healthy. See $backendStdOut and $backendStdErr"
        }

        @(
            [pscustomobject]@{
                port = $effectivePort
                base = $backendBaseUrl
                health = $backendHealthUrl
                mongoUri = $effectiveMongoUri
                mediaDir = $effectiveMediaDir
                pid = $script:BackendPid
                stdout = $backendStdOut
                stderr = $backendStdErr
                manifestPath = $localManifestPath
            }
        ) | ConvertTo-Json -Depth 4 | Set-Content -Path $statePath -Encoding UTF8

        & powershell -ExecutionPolicy Bypass -File $manifestWriter `
            -Path $localManifestPath `
            -BackendBaseUrl $backendBaseUrl `
            -BackendHealthUrl $backendHealthUrl `
            -PerfBackendBaseUrl $perfBaseUrl `
            -PerfBackendHealthUrl $perfHealthUrl `
            -AuthRbacBaseUrl $backendBaseUrl `
            -AuthHardeningBaseUrl $backendBaseUrl `
            -MongoUri $effectiveMongoUri `
            -MediaDir $effectiveMediaDir `
            -Db06MediaDir $effectiveMediaDir | Out-Null

        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $localManifestPath)) {
            throw "LOAD-03 runtime manifest was not written: $localManifestPath"
        }

        $resolvedManifestPath = $localManifestPath
    }

    $runnerArgs = @(
        '-ExecutionPolicy', 'Bypass',
        '-File', $canonicalRunner,
        '-ManifestPath', $resolvedManifestPath,
        '-BackendEmail', $BackendEmail,
        '-BackendPassword', $BackendPassword,
        '-K6Image', $K6Image
    )
    if (-not [string]::IsNullOrWhiteSpace($FixturePath)) {
        $runnerArgs += @('-FixturePath', $FixturePath)
    }
    if (-not [string]::IsNullOrWhiteSpace($SummaryPath)) {
        $runnerArgs += @('-SummaryPath', $SummaryPath)
    }

    & powershell @runnerArgs
    $exitCode = if ($LASTEXITCODE -eq $null) { 0 } else { $LASTEXITCODE }
} finally {
    Stop-LocalBackend

    foreach ($entry in $previousEnv.GetEnumerator()) {
        Set-Or-ClearEnv $entry.Key $entry.Value
    }
}

exit $exitCode
