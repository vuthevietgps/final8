#!/usr/bin/env pwsh
<#
    =====================================================================================
    WRITE-BACKEND-RUNTIME-MANIFEST.ps1
    =====================================================================================
    Writes a backend runtime manifest that can be consumed by the canonical
    regression runner and DB-06 suite when the backend is running in another
    shell or container.

    Usage:
      powershell -ExecutionPolicy Bypass -File .\tests\backend\runners\write-backend-runtime-manifest.ps1 `
        -Path .\tests\backend\artifacts\results\external-runtime.json `
        -BackendBaseUrl http://localhost:3884/api `
        -Db06MediaDir C:\path\to\media
    =====================================================================================
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$BackendBaseUrl,
    [string]$BackendHealthUrl,
    [string]$PerfBackendBaseUrl,
    [string]$PerfBackendHealthUrl,
    [string]$AuthRbacBaseUrl,
    [string]$AuthHardeningBaseUrl,
    [string]$MongoUri,
    [string]$MediaDir,
    [string]$Db06MediaDir
)

$ErrorActionPreference = 'Stop'

function Resolve-ManifestOutputPath([string]$Candidate) {
    $resolved = Resolve-Path -LiteralPath $Candidate -ErrorAction SilentlyContinue
    if ($resolved) {
        return $resolved.Path
    }
    return [System.IO.Path]::GetFullPath($Candidate)
}

function Resolve-OptionalPath([string]$Candidate) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $null
    }
    $resolved = Resolve-Path -LiteralPath $Candidate -ErrorAction SilentlyContinue
    if ($resolved) {
        return $resolved.Path
    }
    return [System.IO.Path]::GetFullPath($Candidate)
}

function Resolve-HealthUrl([string]$BaseUrl, [string]$ExplicitHealthUrl) {
    if (-not [string]::IsNullOrWhiteSpace($ExplicitHealthUrl)) {
        return $ExplicitHealthUrl.TrimEnd('/')
    }

    if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
        return $null
    }

    $trimmedBaseUrl = $BaseUrl.TrimEnd('/')
    if ($trimmedBaseUrl -match '/api$') {
        return $trimmedBaseUrl -replace '/api$','/health'
    }

    return "$trimmedBaseUrl/health"
}

$outputPath = Resolve-ManifestOutputPath $Path
$outputDir = Split-Path -Parent $outputPath
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$baseUrl = $BackendBaseUrl.TrimEnd('/')
$healthUrl = Resolve-HealthUrl -BaseUrl $baseUrl -ExplicitHealthUrl $BackendHealthUrl
$perfBaseUrl =
    if (-not [string]::IsNullOrWhiteSpace($PerfBackendBaseUrl)) { $PerfBackendBaseUrl.TrimEnd('/') }
    else { $null }
$perfHealthUrl = Resolve-HealthUrl -BaseUrl $perfBaseUrl -ExplicitHealthUrl $PerfBackendHealthUrl

$authRbacUrl =
    if (-not [string]::IsNullOrWhiteSpace($AuthRbacBaseUrl)) { $AuthRbacBaseUrl.TrimEnd('/') }
    else { $baseUrl }
$authHardeningUrl =
    if (-not [string]::IsNullOrWhiteSpace($AuthHardeningBaseUrl)) { $AuthHardeningBaseUrl.TrimEnd('/') }
    else { $baseUrl }

$payload = [ordered]@{
    backendBaseUrl = $baseUrl
    backendHealthUrl = $healthUrl
    authRbacBaseUrl = $authRbacUrl
    authHardeningBaseUrl = $authHardeningUrl
}
if (-not [string]::IsNullOrWhiteSpace($perfBaseUrl)) {
    $payload.perfBackendBaseUrl = $perfBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($perfHealthUrl)) {
    $payload.perfBackendHealthUrl = $perfHealthUrl
}

if (-not [string]::IsNullOrWhiteSpace($MongoUri)) {
    $payload.mongodbUri = $MongoUri.Trim()
}
$resolvedMediaDir = Resolve-OptionalPath $MediaDir
if (-not [string]::IsNullOrWhiteSpace($resolvedMediaDir)) {
    $payload.mediaDir = $resolvedMediaDir
}
$resolvedDb06MediaDir = Resolve-OptionalPath $Db06MediaDir
if (-not [string]::IsNullOrWhiteSpace($resolvedDb06MediaDir)) {
    $payload.db06MediaDir = $resolvedDb06MediaDir
}

$json = ($payload | ConvertTo-Json -Depth 4) + [Environment]::NewLine
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host $outputPath
