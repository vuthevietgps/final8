param([switch]$Verify)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$localDir = Join-Path $repo '.local-ledger'
New-Item -ItemType Directory -Force -Path $localDir | Out-Null
$nodeExe = (Get-Command node.exe).Source
$mongoExe = Get-ChildItem 'C:/Program Files/MongoDB/Server' -Filter mongod.exe -Recurse | Select-Object -Last 1 -ExpandProperty FullName
if (-not $mongoExe) { throw 'Install MongoDB locally before starting this rehearsal.' }
if (-not (Test-Path (Join-Path $backend 'dist/main.js'))) { throw 'Run npm run build in backend first.' }
if (-not (Test-Path (Join-Path $repo 'frontend/dist/management-frontend/browser/index.html'))) { throw 'Run npm run build in frontend first.' }
foreach ($port in 27027,3001,4300) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $port is occupied. Stop the previous local rehearsal before restarting."
  }
}
$dataDir = Join-Path $localDir 'mongo'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$mongoLog = Join-Path $localDir 'mongo.log'
$mongo = Start-Process -FilePath $mongoExe -ArgumentList @('--bind_ip','127.0.0.1','--port','27027','--replSet','erp-local-ledger','--dbpath',('"' + $dataDir + '"'),'--logpath',('"' + $mongoLog + '"'),'--logappend') -WindowStyle Hidden -PassThru
$mongo.Id | Set-Content (Join-Path $localDir 'mongo.pid')
Push-Location $backend
try {
  & $nodeExe --require ./scripts/local-ledger-guard.cjs scripts/init-local-ledger-replica.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Local MongoDB transaction setup failed; backend was not started.' }
  if ($Verify) {
    & $nodeExe --require ./scripts/local-ledger-guard.cjs scripts/audit-business-model-local.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Local business model verification failed; backend was not started.' }
  }
} finally { Pop-Location }
$api = Start-Process -FilePath $nodeExe -ArgumentList @('--require','./scripts/local-ledger-guard.cjs','dist/main.js') -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'backend.log') -RedirectStandardError (Join-Path $localDir 'backend.err.log') -PassThru
$api.Id | Set-Content (Join-Path $localDir 'backend.pid')
$ready = $false
for ($attempt = 0; $attempt -lt 90; $attempt++) {
  if ($api.HasExited) { throw 'Local backend stopped; inspect .local-ledger/backend.err.log.' }
  try { Invoke-WebRequest 'http://127.0.0.1:3001/health/live' -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true; break } catch {}
  Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Local backend did not become ready.' }
$demoArgs = @('--require','./scripts/local-ledger-guard.cjs','scripts/local-ledger-demo.cjs')
$web = Start-Process -FilePath $nodeExe -ArgumentList $demoArgs -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localDir 'demo.log') -RedirectStandardError (Join-Path $localDir 'demo.err.log') -PassThru
$web.Id | Set-Content (Join-Path $localDir 'demo.pid')
Write-Output 'Local rehearsal starting: http://127.0.0.1:4300/__local'
Write-Output 'MongoDB: separate process on 127.0.0.1:27027; no existing .env loaded.'
