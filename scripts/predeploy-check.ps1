param(
  [switch]$NoBuild,
  [int]$TimeoutSec = 150,
  [int]$RetryIntervalSec = 3,
  [switch]$PackageOnSuccess,
  [switch]$DownAfter
)

$ErrorActionPreference = 'Stop'

function Get-ComposeCmd {
  try {
    & docker compose version *> $null
    return 'docker compose'
  } catch {
    return 'docker-compose'
  }
}

function Invoke-HttpOk($url, $method = 'GET') {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $url -Method $method -TimeoutSec 10
    return ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300)
  } catch {
    return $false
  }
}

# Paths
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $projectRoot 'docker-compose.server.full.yml'
if (!(Test-Path $composeFile)) { throw "Not found: $composeFile" }

$compose = Get-ComposeCmd
$projName = 'final8local'

Write-Host "Using compose: $compose" -ForegroundColor Cyan
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Bring up stack
if ($NoBuild) {
  Write-Host "Starting containers (no build)..." -ForegroundColor Yellow
  & $compose -p $projName -f $composeFile up -d
} else {
  Write-Host "Building and starting containers..." -ForegroundColor Yellow
  & $compose -p $projName -f $composeFile up -d --build
}

# Poll health endpoints
$frontendUrl = 'http://127.0.0.1:8088/'
$healthUrl   = 'http://127.0.0.1:8088/api/health'

Write-Host "Waiting for frontend: $frontendUrl and API: $healthUrl" -ForegroundColor Cyan

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$frontendOk = $false
$apiOk = $false

while ((Get-Date) -lt $deadline) {
  if (-not $frontendOk) { $frontendOk = Invoke-HttpOk $frontendUrl 'HEAD' }
  if (-not $apiOk)      { $apiOk      = Invoke-HttpOk $healthUrl 'GET' }

  if ($frontendOk -and $apiOk) { break }
  Start-Sleep -Seconds $RetryIntervalSec
}

Write-Host ("Frontend OK: {0} | API OK: {1}" -f $frontendOk, $apiOk) -ForegroundColor Green

if (-not ($frontendOk -and $apiOk)) {
  Write-Host "Predeploy check FAILED." -ForegroundColor Red
  if ($DownAfter) { & $compose -p $projName -f $composeFile down }
  exit 1
}

Write-Host "Predeploy check PASSED." -ForegroundColor Green

if ($PackageOnSuccess) {
  Write-Host "Packaging deploy zip..." -ForegroundColor Cyan
  & powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'scripts/make-deploy-zip.ps1')
}

if ($DownAfter) {
  Write-Host "Bringing down containers..." -ForegroundColor Yellow
  & $compose -p $projName -f $composeFile down
}

exit 0
