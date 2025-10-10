# Final8 Quick Start Script
Write-Host "Starting Final8 Development Servers..." -ForegroundColor Green

# Navigate to project directory
Set-Location "C:\Users\PC\Documents\code\final8-new"

# Kill existing Node processes
Write-Host "Cleaning existing processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill processes on specific ports
$processes3000 = netstat -ano | findstr :3000
if ($processes3000) {
    $pid3000 = ($processes3000 -split '\s+')[-1] 
    taskkill /PID $pid3000 /F 2>$null
}

$processes4200 = netstat -ano | findstr :4200  
if ($processes4200) {
    $pid4200 = ($processes4200 -split '\s+')[-1]
    taskkill /PID $pid4200 /F 2>$null
}

Start-Sleep -Seconds 2

# Start Backend
Write-Host "Starting Backend server..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$env:MEDIA_DIR='C:\\Users\\PC\\Documents\\code\\final8-new\\backend\\uploads\\media'; $env:MEDIA_PUBLIC_BASE='/media'; Set-Location 'C:\\Users\\PC\\Documents\\code\\final8-new\\backend'; npm run start:dev"

Start-Sleep -Seconds 5

# Start Frontend
Write-Host "Starting Frontend server..." -ForegroundColor Blue  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location 'C:\Users\PC\Documents\code\final8-new\frontend'; npm start"

Write-Host ""
Write-Host "Servers are starting..." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:4200" -ForegroundColor Cyan  
Write-Host "Login:    vutheviet@gmail.com / 123456" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check the new terminal windows for server status." -ForegroundColor White