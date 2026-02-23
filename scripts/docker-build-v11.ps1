param()
$ErrorActionPreference = 'Stop'

docker build --no-cache -t vutheviet/final8new:backend-version11.0 -f backend/Dockerfile backend
if ($LASTEXITCODE -ne 0) { throw "Backend image build failed" }

docker build --no-cache -t vutheviet/final8new:frontend-version11.0 -f frontend/Dockerfile frontend
if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed" }

Write-Host "Built backend & frontend images tagged version11.0" -ForegroundColor Green
