#!/usr/bin/env pwsh
<#
    =====================================================================================
    RUN-LOAD03-WRITE-CONTENTION.ps1
    =====================================================================================
    Strict wrapper for LOAD-03 write-contention.
    - Uses the host-visible backend URL for regression-user setup and fixture generation.
    - Uses native k6 when available.
    - Falls back to Docker grafana/k6 when native k6 is unavailable.
    - Requires a Docker-visible perf URL when Docker is used against a loopback-only host URL.

    Exit codes:
      0 = PASSED
      1 = FAILED
      2 = BLOCKED
    =====================================================================================
#>
param(
    [string]$ManifestPath = $null,
    [string]$BackendBaseUrl,
    [string]$BackendHealthUrl,
    [string]$PerfBackendBaseUrl,
    [string]$PerfBackendHealthUrl,
    [string]$Email = $null,
    [string]$Password = $null,
    [string]$FixturePath = $null,
    [string]$SummaryPath = $null,
    [string]$K6Image = 'grafana/k6',
    [switch]$SkipEnsureUsers,
    [switch]$ForceDocker
)

$ErrorActionPreference = 'Stop'
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$testsRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..\..')).Path
$artifactsDir = Join-Path $testsRoot 'artifacts\results'
$setupScript = Join-Path $testsRoot 'setup\ensure-regression-users.ps1'
$runtimeManifestScript = Join-Path $testsRoot 'setup\backend-runtime-manifest.ps1'
$fixtureScript = Join-Path $testsRoot 'perf\create-write-contention-fixture.js'
$k6Script = Join-Path $testsRoot 'perf\perf.write-contention.k6.js'
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

function Complete-Load03Run {
    param(
        [ValidateSet('PASSED', 'FAILED', 'BLOCKED')]
        [string]$Status,
        [string]$Message,
        [int]$ExitCode
    )

    $color =
        switch ($Status) {
            'PASSED' { 'Green' }
            'FAILED' { 'Red' }
            'BLOCKED' { 'Yellow' }
        }

    Write-Host ''
    Write-Host ('=' * 90) -ForegroundColor $color
    Write-Host "  LOAD-03 WRITE CONTENTION : $Status" -ForegroundColor $color
    Write-Host ('=' * 90) -ForegroundColor $color
    if (-not [string]::IsNullOrWhiteSpace($Message)) {
        Write-Host "  $Message" -ForegroundColor $color
    }
    exit $ExitCode
}

function Normalize-Url {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    return $Value.Trim().TrimEnd('/')
}

function Resolve-HealthUrl {
    param(
        [string]$BaseUrl,
        [string]$ExplicitHealthUrl
    )

    $normalizedHealthUrl = Normalize-Url -Value $ExplicitHealthUrl
    if (-not [string]::IsNullOrWhiteSpace($normalizedHealthUrl)) {
        return $normalizedHealthUrl
    }

    $normalizedBaseUrl = Normalize-Url -Value $BaseUrl
    if ([string]::IsNullOrWhiteSpace($normalizedBaseUrl)) {
        return $null
    }

    if ($normalizedBaseUrl -match '/api$') {
        return $normalizedBaseUrl -replace '/api$','/health'
    }

    return "$normalizedBaseUrl/health"
}

function Resolve-DbHealthUrl {
    param(
        [string]$BaseUrl,
        [string]$HealthUrl
    )

    $normalizedBaseUrl = Normalize-Url -Value $BaseUrl
    if (-not [string]::IsNullOrWhiteSpace($normalizedBaseUrl) -and $normalizedBaseUrl -match '/api$') {
        return "$normalizedBaseUrl/health/db"
    }

    $normalizedHealthUrl = Normalize-Url -Value $HealthUrl
    if (-not [string]::IsNullOrWhiteSpace($normalizedHealthUrl)) {
        return "$normalizedHealthUrl/db"
    }

    return $null
}

function Invoke-HealthProbe {
    param(
        [string]$Url,
        [int]$TimeoutSec = 5
    )

    $invokeParams = @{
        Uri = $Url
        Method = 'GET'
        TimeoutSec = $TimeoutSec
        ErrorAction = 'Stop'
    }

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $invokeParams.UseBasicParsing = $true
    }

    return Invoke-WebRequest @invokeParams
}

function Resolve-ProbedBackendBaseUrl {
    foreach ($candidate in @('http://localhost:3000/api', 'http://localhost:3000')) {
        $healthUrl = Resolve-HealthUrl -BaseUrl $candidate -ExplicitHealthUrl $null
        try {
            $response = Invoke-HealthProbe -Url $healthUrl -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                return (Normalize-Url -Value $candidate)
            }
        } catch {
        }
    }

    return $null
}

function Test-UrlIsLoopback {
    param(
        [string]$Url
    )

    $normalizedUrl = Normalize-Url -Value $Url
    if ([string]::IsNullOrWhiteSpace($normalizedUrl)) {
        return $true
    }

    try {
        $uri = [System.Uri]$normalizedUrl
    } catch {
        return $true
    }

    $hostName = $uri.DnsSafeHost
    if ([string]::IsNullOrWhiteSpace($hostName)) {
        return $true
    }

    $hostName = $hostName.ToLowerInvariant()
    if ($hostName -eq 'localhost' -or $hostName -eq '0.0.0.0') {
        return $true
    }

    $ipAddress = $null
    if ([System.Net.IPAddress]::TryParse($hostName, [ref]$ipAddress)) {
        if ($hostName -eq '0.0.0.0') {
            return $true
        }

        return [System.Net.IPAddress]::IsLoopback($ipAddress)
    }

    return $false
}

function Resolve-OutputPath {
    param(
        [string]$Candidate
    )

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $null
    }

    return [System.IO.Path]::GetFullPath($Candidate)
}

function Write-JsonArtifact {
    param(
        [string]$Path,
        [object]$Payload
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    (($Payload | ConvertTo-Json -Depth 6) + [Environment]::NewLine) |
        Set-Content -Path $Path -Encoding UTF8
}

function Invoke-JsonProbe {
    param(
        [string]$Url,
        [int]$TimeoutSec = 5
    )

    $invokeParams = @{
        Uri = $Url
        Method = 'GET'
        TimeoutSec = $TimeoutSec
        ErrorAction = 'Stop'
    }

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $invokeParams.UseBasicParsing = $true
    }

    $response = Invoke-WebRequest @invokeParams
    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }

    return ($response.Content | ConvertFrom-Json)
}

function Convert-ToDockerWorkspacePath {
    param(
        [string]$Path,
        [string]$WorkspaceRoot
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $workspaceFullPath = [System.IO.Path]::GetFullPath($WorkspaceRoot)
    $workspaceUri = [System.Uri]($workspaceFullPath.TrimEnd('\') + '\')
    $pathUri = [System.Uri]$fullPath

    if (-not $workspaceUri.IsBaseOf($pathUri)) {
        return $null
    }

    $relativePath = [System.Uri]::UnescapeDataString($workspaceUri.MakeRelativeUri($pathUri).ToString())
    $relativePath = $relativePath -replace '\\', '/'
    return "/workspace/$relativePath"
}

function Invoke-ExternalCommand {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [ValidateSet('FAILED', 'BLOCKED')]
        [string]$FailureStatus,
        [string]$FailureMessage
    )

    & $Command @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($FailureStatus -eq 'BLOCKED') {
            Complete-Load03Run -Status 'BLOCKED' -Message "$FailureMessage (exit code $exitCode)." -ExitCode 2
        }

        Complete-Load03Run -Status 'FAILED' -Message "$FailureMessage (exit code $exitCode)." -ExitCode 1
    }
}

if (-not (Test-Path -LiteralPath $runtimeManifestScript)) {
    Complete-Load03Run -Status 'FAILED' -Message "Runtime manifest helper is missing: $runtimeManifestScript" -ExitCode 1
}

. $runtimeManifestScript

$manifest = $null
$runtimeManifestUsage = $null
try {
    $manifest = Import-BackendRuntimeManifest -ManifestPath $ManifestPath
    $runtimeManifestUsage = Use-BackendRuntimeManifest -ManifestPath $ManifestPath
} catch {
    Complete-Load03Run -Status 'BLOCKED' -Message "Runtime manifest load failed: $($_.Exception.Message)" -ExitCode 2
}

if (-not [string]::IsNullOrWhiteSpace($BackendBaseUrl)) {
    $env:BACKEND_BASE_URL = Normalize-Url -Value $BackendBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($BackendHealthUrl)) {
    $env:BACKEND_HEALTH_URL = Normalize-Url -Value $BackendHealthUrl
}
if (-not [string]::IsNullOrWhiteSpace($PerfBackendBaseUrl)) {
    $env:PERF_BACKEND_BASE_URL = Normalize-Url -Value $PerfBackendBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($PerfBackendHealthUrl)) {
    $env:PERF_BACKEND_HEALTH_URL = Normalize-Url -Value $PerfBackendHealthUrl
}

$resolvedEmail =
    if (-not [string]::IsNullOrWhiteSpace($Email)) { $Email.Trim() }
    elseif (-not [string]::IsNullOrWhiteSpace($env:BACKEND_EMAIL)) { $env:BACKEND_EMAIL.Trim() }
    else { 'director@test.com' }
$resolvedPassword =
    if (-not [string]::IsNullOrWhiteSpace($Password)) { $Password.Trim() }
    elseif (-not [string]::IsNullOrWhiteSpace($env:BACKEND_PASSWORD)) { $env:BACKEND_PASSWORD.Trim() }
    else { '123456' }

$hostBaseUrl =
    if (-not [string]::IsNullOrWhiteSpace($env:BACKEND_BASE_URL)) { Normalize-Url -Value $env:BACKEND_BASE_URL }
    else { Resolve-ProbedBackendBaseUrl }
if ([string]::IsNullOrWhiteSpace($hostBaseUrl)) {
    Complete-Load03Run -Status 'BLOCKED' -Message 'Host-visible BACKEND_BASE_URL could not be resolved. Provide BACKEND_BASE_URL or BACKEND_RUNTIME_MANIFEST.' -ExitCode 2
}

$hostHealthUrl = Resolve-HealthUrl -BaseUrl $hostBaseUrl -ExplicitHealthUrl $env:BACKEND_HEALTH_URL
if ([string]::IsNullOrWhiteSpace($hostHealthUrl)) {
    Complete-Load03Run -Status 'BLOCKED' -Message 'Host-visible BACKEND_HEALTH_URL could not be resolved.' -ExitCode 2
}

$env:BACKEND_BASE_URL = $hostBaseUrl
$env:BACKEND_HEALTH_URL = $hostHealthUrl
$env:BACKEND_EMAIL = $resolvedEmail
$env:BACKEND_PASSWORD = $resolvedPassword

$fixtureOutputCandidate =
    if (-not [string]::IsNullOrWhiteSpace($FixturePath)) { $FixturePath }
    else { Join-Path $artifactsDir "perf.write-contention-fixture-$ts.json" }
$summaryOutputCandidate =
    if (-not [string]::IsNullOrWhiteSpace($SummaryPath)) { $SummaryPath }
    else { Join-Path $artifactsDir "perf.write-contention-summary-$ts.json" }

$fixtureOutputPath = Resolve-OutputPath -Candidate $fixtureOutputCandidate
$summaryOutputPath = Resolve-OutputPath -Candidate $summaryOutputCandidate
$contractCheckPath = Join-Path $artifactsDir "load03-runtime-contract-check-$ts.json"

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fixtureOutputPath) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $summaryOutputPath) | Out-Null

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    Complete-Load03Run -Status 'BLOCKED' -Message 'Node.js is required for regression-user setup and fixture generation.' -ExitCode 2
}

$nativeK6Command = $null
if (-not $ForceDocker) {
    $nativeK6Command = Get-Command k6 -ErrorAction SilentlyContinue
}
$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$useDocker = $ForceDocker -or -not $nativeK6Command

if ($useDocker -and -not $dockerCommand) {
    Complete-Load03Run -Status 'BLOCKED' -Message 'Native k6 is unavailable and Docker is not installed or not on PATH.' -ExitCode 2
}

$dockerBaseUrl = $null
$dockerHealthUrl = $null
if ($useDocker) {
    $dockerBaseUrl =
        if (-not [string]::IsNullOrWhiteSpace($env:PERF_BACKEND_BASE_URL)) { Normalize-Url -Value $env:PERF_BACKEND_BASE_URL }
        elseif (-not [string]::IsNullOrWhiteSpace($manifest.PerfBackendBaseUrl)) { Normalize-Url -Value $manifest.PerfBackendBaseUrl }
        elseif (-not (Test-UrlIsLoopback -Url $hostBaseUrl)) { $hostBaseUrl }
        else { $null }

    if ([string]::IsNullOrWhiteSpace($dockerBaseUrl)) {
        Complete-Load03Run -Status 'BLOCKED' -Message 'Native k6 is unavailable. Docker fallback requires PERF_BACKEND_BASE_URL or manifest perfBackendBaseUrl when the host backend URL is loopback-only.' -ExitCode 2
    }

    $dockerHealthUrl =
        if (-not [string]::IsNullOrWhiteSpace($env:PERF_BACKEND_HEALTH_URL)) { Normalize-Url -Value $env:PERF_BACKEND_HEALTH_URL }
        elseif (-not [string]::IsNullOrWhiteSpace($manifest.PerfBackendHealthUrl)) { Normalize-Url -Value $manifest.PerfBackendHealthUrl }
        else { Resolve-HealthUrl -BaseUrl $dockerBaseUrl -ExplicitHealthUrl $null }

    if ([string]::IsNullOrWhiteSpace($dockerHealthUrl)) {
        Complete-Load03Run -Status 'BLOCKED' -Message 'Docker fallback could not resolve PERF_BACKEND_HEALTH_URL.' -ExitCode 2
    }
}

Write-Host ''
Write-Host ('=' * 90) -ForegroundColor White
Write-Host "  LOAD-03 WRITE CONTENTION - $ts" -ForegroundColor White
Write-Host ('=' * 90) -ForegroundColor White
Write-Host ''
Write-Host "  Host base URL    : $hostBaseUrl" -ForegroundColor DarkGray
Write-Host "  Host health URL  : $hostHealthUrl" -ForegroundColor DarkGray
Write-Host "  Execution mode   : $(if ($useDocker) { 'docker-k6' } else { 'native-k6' })" -ForegroundColor DarkGray
if ($useDocker) {
    Write-Host "  Perf base URL    : $dockerBaseUrl" -ForegroundColor DarkGray
    Write-Host "  Perf health URL  : $dockerHealthUrl" -ForegroundColor DarkGray
}
Write-Host "  Fixture path     : $fixtureOutputPath" -ForegroundColor DarkGray
Write-Host "  Summary path     : $summaryOutputPath" -ForegroundColor DarkGray
Write-Host "  Contract check   : $contractCheckPath" -ForegroundColor DarkGray
Write-Host "  Runtime manifest : $(if ($manifest) { $manifest.Path } else { '<none>' })" -ForegroundColor DarkGray
if ($runtimeManifestUsage) {
    Write-Host "  Manifest applied : $(if (@($runtimeManifestUsage.Applied).Count -gt 0) { @($runtimeManifestUsage.Applied) -join ', ' } else { 'none (shell env already had explicit values)' })" -ForegroundColor DarkGray
}
Write-Host ''

try {
    $healthResponse = Invoke-HealthProbe -Url $hostHealthUrl -TimeoutSec 10
    if ($healthResponse.StatusCode -ne 200) {
        Complete-Load03Run -Status 'BLOCKED' -Message "Backend health probe returned HTTP $($healthResponse.StatusCode) for $hostHealthUrl." -ExitCode 2
    }
} catch {
    Complete-Load03Run -Status 'BLOCKED' -Message "Backend health probe failed for ${hostHealthUrl}: $($_.Exception.Message)" -ExitCode 2
}

if ($manifest) {
    if ([string]::IsNullOrWhiteSpace($manifest.MongodbUri) -or [string]::IsNullOrWhiteSpace($manifest.MongodbDbName)) {
        $contractPayload = [pscustomobject]@{
            checkedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
            status = 'BLOCKED'
            reason = 'runtime_manifest_missing_mongodb_identity'
            hostBaseUrl = $hostBaseUrl
            hostHealthUrl = $hostHealthUrl
            runtimeManifestPath = $manifest.Path
            manifestMongoUri = $manifest.MongodbUri
            manifestDbName = $manifest.MongodbDbName
        }
        Write-JsonArtifact -Path $contractCheckPath -Payload $contractPayload
        Complete-Load03Run -Status 'BLOCKED' -Message 'Runtime manifest must include mongodbUri with a concrete database name before LOAD-03 can verify the backend/DB contract.' -ExitCode 2
    }

    $dbHealthUrl = Resolve-DbHealthUrl -BaseUrl $hostBaseUrl -HealthUrl $hostHealthUrl
    $dbHealthPayload = $null
    try {
        $dbHealthPayload = Invoke-JsonProbe -Url $dbHealthUrl -TimeoutSec 10
    } catch {
        $contractPayload = [pscustomobject]@{
            checkedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
            status = 'BLOCKED'
            reason = 'backend_db_health_probe_failed'
            hostBaseUrl = $hostBaseUrl
            hostHealthUrl = $hostHealthUrl
            dbHealthUrl = $dbHealthUrl
            runtimeManifestPath = $manifest.Path
            manifestMongoUri = $manifest.MongodbUri
            manifestDbName = $manifest.MongodbDbName
            error = $_.Exception.Message
        }
        Write-JsonArtifact -Path $contractCheckPath -Payload $contractPayload
        Complete-Load03Run -Status 'BLOCKED' -Message "Backend DB health probe failed for ${dbHealthUrl}: $($_.Exception.Message)" -ExitCode 2
    }

    $actualDbName = [string]$dbHealthPayload.dbName
    if ([string]::IsNullOrWhiteSpace($actualDbName)) {
        $contractPayload = [pscustomobject]@{
            checkedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
            status = 'BLOCKED'
            reason = 'backend_db_health_missing_dbname'
            hostBaseUrl = $hostBaseUrl
            hostHealthUrl = $hostHealthUrl
            dbHealthUrl = $dbHealthUrl
            runtimeManifestPath = $manifest.Path
            manifestMongoUri = $manifest.MongodbUri
            manifestDbName = $manifest.MongodbDbName
            dbHealthPayload = $dbHealthPayload
        }
        Write-JsonArtifact -Path $contractCheckPath -Payload $contractPayload
        Complete-Load03Run -Status 'BLOCKED' -Message "Backend DB health probe at ${dbHealthUrl} did not return dbName; refusing to run LOAD-03 without a verifiable backend/DB contract." -ExitCode 2
    }

    $contractPayload = [pscustomobject]@{
        checkedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
        status = if ($actualDbName -eq $manifest.MongodbDbName) { 'PASSED' } else { 'FAILED_HARNESS' }
        hostBaseUrl = $hostBaseUrl
        hostHealthUrl = $hostHealthUrl
        dbHealthUrl = $dbHealthUrl
        runtimeManifestPath = $manifest.Path
        manifestMongoUri = $manifest.MongodbUri
        manifestDbName = $manifest.MongodbDbName
        actualDbName = $actualDbName
        dbHealthPayload = $dbHealthPayload
    }
    Write-JsonArtifact -Path $contractCheckPath -Payload $contractPayload

    if ($actualDbName -ne $manifest.MongodbDbName) {
        Complete-Load03Run -Status 'FAILED' -Message "FAILED_HARNESS: runtime manifest mongodbUri db '$($manifest.MongodbDbName)' does not match backend /health/db db '$actualDbName' for $hostBaseUrl; refusing to run LOAD-03 against a mismatched backend contract." -ExitCode 1
    }
}

if (-not $SkipEnsureUsers) {
    if (-not (Test-Path -LiteralPath $setupScript)) {
        Complete-Load03Run -Status 'BLOCKED' -Message "Regression user setup script is missing: $setupScript" -ExitCode 2
    }

    Invoke-ExternalCommand -Command 'powershell' -Arguments @(
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $setupScript
    ) -FailureStatus 'BLOCKED' -FailureMessage 'Regression user setup failed'
}

if (-not (Test-Path -LiteralPath $fixtureScript)) {
    Complete-Load03Run -Status 'FAILED' -Message "Fixture generator is missing: $fixtureScript" -ExitCode 1
}

Invoke-ExternalCommand -Command $nodeCommand.Source -Arguments @(
    $fixtureScript,
    $fixtureOutputPath
) -FailureStatus 'FAILED' -FailureMessage 'LOAD-03 fixture generation failed'

if (-not (Test-Path -LiteralPath $fixtureOutputPath)) {
    Complete-Load03Run -Status 'FAILED' -Message "Fixture generation completed without producing $fixtureOutputPath." -ExitCode 1
}

if (-not (Test-Path -LiteralPath $k6Script)) {
    Complete-Load03Run -Status 'FAILED' -Message "k6 scenario script is missing: $k6Script" -ExitCode 1
}

if ($useDocker) {
    $dockerFixturePath = Convert-ToDockerWorkspacePath -Path $fixtureOutputPath -WorkspaceRoot $repoRoot
    $dockerSummaryPath = Convert-ToDockerWorkspacePath -Path $summaryOutputPath -WorkspaceRoot $repoRoot
    if ([string]::IsNullOrWhiteSpace($dockerFixturePath) -or [string]::IsNullOrWhiteSpace($dockerSummaryPath)) {
        Complete-Load03Run -Status 'BLOCKED' -Message 'Docker execution requires fixture and summary paths to stay inside the repository workspace.' -ExitCode 2
    }

    Invoke-ExternalCommand -Command $dockerCommand.Source -Arguments @(
        'run',
        '--rm',
        '-i',
        '-v',
        "${repoRoot}:/workspace",
        '-w',
        '/workspace',
        '-e',
        "BACKEND_BASE_URL=$dockerBaseUrl",
        '-e',
        "BACKEND_HEALTH_URL=$dockerHealthUrl",
        '-e',
        "BACKEND_EMAIL=$resolvedEmail",
        '-e',
        "BACKEND_PASSWORD=$resolvedPassword",
        '-e',
        "WRITE_CONTENTION_FIXTURE=$dockerFixturePath",
        '-e',
        "WRITE_CONTENTION_SUMMARY_PATH=$dockerSummaryPath",
        $K6Image,
        'run',
        'tests/backend/perf/perf.write-contention.k6.js'
    ) -FailureStatus 'FAILED' -FailureMessage 'Docker k6 execution failed'
} else {
    Invoke-ExternalCommand -Command $nativeK6Command.Source -Arguments @(
        'run',
        '-e',
        "BACKEND_BASE_URL=$hostBaseUrl",
        '-e',
        "BACKEND_HEALTH_URL=$hostHealthUrl",
        '-e',
        "BACKEND_EMAIL=$resolvedEmail",
        '-e',
        "BACKEND_PASSWORD=$resolvedPassword",
        '-e',
        "WRITE_CONTENTION_FIXTURE=$fixtureOutputPath",
        '-e',
        "WRITE_CONTENTION_SUMMARY_PATH=$summaryOutputPath",
        $k6Script
    ) -FailureStatus 'FAILED' -FailureMessage 'Native k6 execution failed'
}

if (-not (Test-Path -LiteralPath $summaryOutputPath)) {
    Complete-Load03Run -Status 'FAILED' -Message "LOAD-03 completed without producing summary output at $summaryOutputPath." -ExitCode 1
}

Complete-Load03Run -Status 'PASSED' -Message 'LOAD-03 fixture generation and k6 execution completed successfully.' -ExitCode 0
