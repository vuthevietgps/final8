# Stop Final8 Servers
Write-Host "Stopping Final8 servers..." -ForegroundColor Red

# Stop Backend (port 3000)
$backend = netstat -ano | findstr :3000 | Select-String "LISTENING"
if ($backend) {
    $backendPid = ($backend -split '\s+')[-1]
    taskkill /PID $backendPid /F 2>$null
    Write-Host "Backend stopped" -ForegroundColor Green
}

# Stop Frontend (port 4200)  
$frontend = netstat -ano | findstr :4200 | Select-String "LISTENING"
if ($frontend) {
    $frontendPid = ($frontend -split '\s+')[-1]
    taskkill /PID $frontendPid /F 2>$null
    Write-Host "Frontend stopped" -ForegroundColor Green
}

# Kill all Node processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "All Node processes cleaned" -ForegroundColor Green

Write-Host "Final8 servers stopped successfully!" -ForegroundColor Yellow