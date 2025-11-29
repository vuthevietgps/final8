param(
  [string]$BackendTag = "vutheviet/final8new:backend-version10.0",
  [string]$FrontendTag = "vutheviet/final8new:frontend-version10.0",
  [string]$OutRoot = "${PSScriptRoot}\..\final10"
)

$ErrorActionPreference = 'Stop'

function Ensure-Docker() {
  try {
    docker version --format '{{.Server.Version}}' | Out-Null
  } catch {
    Write-Host "Docker daemon is not running. Please start Docker Desktop and retry." -ForegroundColor Yellow
    exit 1
  }
}

function Safe-Remove-Container($name) {
  try { docker rm -f $name | Out-Null } catch { }
}

function Ensure-Dir($path) {
  if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null }
}

Ensure-Docker

$backendContainer = "extract-backend-v10"
$frontendContainer = "extract-frontend-v10"

$backendOut = (Resolve-Path -LiteralPath $OutRoot).ProviderPath
$backendOutDir = Join-Path $backendOut "backend-image"
$frontendOutDir = Join-Path $backendOut "frontend-static"

Ensure-Dir $backendOut
Ensure-Dir $backendOutDir
Ensure-Dir $frontendOutDir

Write-Host "Pulling images..." -ForegroundColor Cyan
docker pull $BackendTag
docker pull $FrontendTag

Write-Host "Creating temporary containers..." -ForegroundColor Cyan
Safe-Remove-Container $backendContainer
Safe-Remove-Container $frontendContainer

$null = docker create --name $backendContainer $BackendTag
$null = docker create --name $frontendContainer $FrontendTag

Write-Host "Copying backend /app -> $backendOutDir" -ForegroundColor Cyan
docker cp "$backendContainer:/app" "$backendOutDir" 

Write-Host "Copying frontend /usr/share/nginx/html -> $frontendOutDir" -ForegroundColor Cyan
docker cp "$frontendContainer:/usr/share/nginx/html" "$frontendOutDir" 

Write-Host "Cleaning up containers..." -ForegroundColor Cyan
Safe-Remove-Container $backendContainer
Safe-Remove-Container $frontendContainer

Write-Host "Done. Extracted to: $backendOut" -ForegroundColor Green
