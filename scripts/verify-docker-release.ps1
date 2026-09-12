$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$previousJwt = $env:JWT_SECRET
$previousApiSecret = $env:API_TOKEN_SECRET
try {
    # Ephemeral test secrets stay in process/container environment, never in files or output.
    $env:JWT_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
    $env:API_TOKEN_SECRET = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
    $composeArgs = @('compose', '--env-file', 'NUL', '-f', 'docker-compose.smoke.yml')
    & docker @composeArgs config --quiet
    if ($LASTEXITCODE) { throw 'Compose validation failed' }
    & docker @composeArgs up -d backend
    if ($LASTEXITCODE) { throw 'Backend startup failed' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $status = & curl.exe --max-time 3 -s -o NUL -w '%{http_code}' http://127.0.0.1:13090/health
        if ($status -eq '200') { $ready = $true; break }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Backend database health failed' }
    Get-Content backend/scripts/ensure-production-indexes.js -Raw |
        & docker @composeArgs exec -T backend node - --apply
    if ($LASTEXITCODE) { throw 'Isolated database index setup failed' }
    & docker @composeArgs up -d --wait --wait-timeout 120 frontend
    if ($LASTEXITCODE) { throw 'Container readiness failed' }
    $health = Invoke-RestMethod http://127.0.0.1:13090/health/ready
    if ($health.status -ne 'ok' -or -not $health.checks.transactions -or -not $health.checks.criticalIndexes) {
        throw 'Production database readiness failed'
    }
    foreach ($route in @('/', '/login')) {
        $status = & curl.exe --max-time 10 -s -o NUL -w '%{http_code}' "http://127.0.0.1:18090$route"
        if ($status -ne '200') { throw "Frontend route failed: $route" }
    }
    $authStatus = & curl.exe --max-time 10 -s -o NUL -w '%{http_code}' http://127.0.0.1:18090/api/auth/profile
    if ($authStatus -ne '401') { throw "Expected protected API 401; received $authStatus" }
    Write-Output 'PASS: frontend, SPA, API proxy/auth, MongoDB transactions and critical indexes.'
    & docker @composeArgs ps
} finally {
    $env:JWT_SECRET = $previousJwt
    $env:API_TOKEN_SECRET = $previousApiSecret
}
