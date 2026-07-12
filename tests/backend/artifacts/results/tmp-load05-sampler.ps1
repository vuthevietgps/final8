param([int]$PidToWatch,[int]$Port,[string]$Path)
for ($i = 0; $i -lt 125; $i++) {
  $stamp = (Get-Date).ToString('o')
  $proc = Get-Process -Id $PidToWatch -ErrorAction SilentlyContinue
  $db = $null
  $dbError = $null
  try { $db = Invoke-RestMethod -Uri "http://localhost:$Port/api/health/db" -TimeoutSec 10 } catch { $dbError = $_.Exception.Message }
  $row = [ordered]@{
    timestamp = $stamp
    pid = $PidToWatch
    running = [bool]$proc
    workingSetMB = if ($proc) { [math]::Round($proc.WorkingSet64 / 1MB, 2) } else { $null }
    privateMemoryMB = if ($proc) { [math]::Round($proc.PrivateMemorySize64 / 1MB, 2) } else { $null }
    cpu = if ($proc) { [math]::Round($proc.CPU, 2) } else { $null }
    handles = if ($proc) { $proc.Handles } else { $null }
    dbStatus = if ($db) { $db.status } else { $null }
    dbState = if ($db) { $db.state } else { $null }
    dbName = if ($db) { $db.dbName } else { $null }
    dbError = $dbError
  }
  Add-Content -LiteralPath $Path -Value (($row | ConvertTo-Json -Compress))
  if (-not $proc) { break }
  Start-Sleep -Seconds 60
}
