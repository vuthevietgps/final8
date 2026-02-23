param()
$ErrorActionPreference = 'Stop'

docker compose -f docker-compose.version11.0.yml down -v

docker compose -f docker-compose.version11.0.yml up -d

# Show containers
Start-Sleep -Seconds 2

docker ps --format 'table {{.Names}}	{{.Status}}	{{.Ports}}' | findstr final8-
