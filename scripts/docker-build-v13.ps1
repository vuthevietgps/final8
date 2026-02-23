$ErrorActionPreference = 'Stop'

Write-Host "Building version14.0 images (no-cache)..." -ForegroundColor Cyan

# Build backend
docker build --no-cache -t vutheviet/final8new:backend-version14.0 -f backend/Dockerfile backend
if ($LASTEXITCODE -ne 0) { throw "Backend image build failed" }

# Build frontend
docker build --no-cache -t vutheviet/final8new:frontend-version14.0 -f frontend/Dockerfile frontend
if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed" }

Write-Host "Built backend & frontend images tagged version14.0 (no-cache)" -ForegroundColor Green

# Show images
Write-Host "\nLocal images:" -ForegroundColor Yellow
$images = docker images --format '{{.Repository}}:{{.Tag}}' | Select-String -Pattern 'vutheviet/final8new:backend-version14.0|vutheviet/final8new:frontend-version14.0'
$images | ForEach-Object { Write-Host $_ -ForegroundColor White }
