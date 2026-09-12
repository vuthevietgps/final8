$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $repo '.local-ledger'
foreach ($service in 'demo','backend','mongo') {
  $pidFile = Join-Path $localDir "$service.pid"
  if (-not (Test-Path -LiteralPath $pidFile)) { continue }
  $processId = [int](Get-Content -LiteralPath $pidFile)
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $expected = switch ($service) {
    'demo' { 'scripts/local-ledger-demo.cjs' }
    'backend' { './scripts/local-ledger-guard.cjs' }
    'mongo' { (Join-Path $localDir 'mongo') }
  }
  if (-not $process.CommandLine.Contains($expected)) { throw "PID $processId no longer belongs to local $service; refusing to stop it." }
  Stop-Process -Id $processId
  Write-Output "Stopped local $service. Data files preserved."
}
