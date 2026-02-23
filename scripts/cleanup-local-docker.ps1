$ErrorActionPreference = 'SilentlyContinue'
Write-Host "Stopping compose stack (if running)..."
try { docker compose down -v | Out-Null } catch {}

# Remove known containers
$containers = @('final8-backend','final8-frontend','final8-mongo','htxbachgia-shop-backend','htxbachgia-shop-frontend')
foreach($c in $containers){ try { docker rm -f $c | Out-Null } catch {} }

# Remove local build images
$localImages = @('final8-new-backend:latest','final8-new-frontend:latest')
foreach($img in $localImages){ try { docker image rm -f $img | Out-Null } catch {} }

# Remove all vutheviet/final8new images except version7.0
$keep = @('vutheviet/final8new:backend-version7.0','vutheviet/final8new:frontend-version7.0')
$repoImages = docker images --format '{{.Repository}}:{{.Tag}}' | Where-Object { $_ -like 'vutheviet/final8new:*' }
foreach($ri in $repoImages){ if($keep -notcontains $ri){ try { docker image rm -f $ri | Out-Null } catch {} } }

docker image prune -f | Out-Null
docker volume prune -f | Out-Null
docker network prune -f | Out-Null

Write-Host "Local Docker cleanup done. Keeping only:" -ForegroundColor Green
$keep | ForEach-Object { Write-Host "  $_" }
