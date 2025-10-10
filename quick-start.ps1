# Quick Development Setup for Final8
# Khởi động nhanh cho development

Write-Host "⚡ QUICK DEV START" -ForegroundColor Cyan  
Write-Host "==================" -ForegroundColor Cyan

# Navigate to correct directory
Set-Location "C:\Users\PC\Documents\code\final8-new"

# Kill existing processes
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Start Backend
Write-Host "🔧 Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run start:dev"

# Wait a bit
Start-Sleep -Seconds 3

# Start Frontend  
Write-Host "🎨 Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm start"

Write-Host ""
Write-Host "🚀 Servers starting..." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000" -ForegroundColor White
Write-Host "Frontend: http://localhost:4200" -ForegroundColor White
Write-Host "Login:    vutheviet@gmail.com / 123456" -ForegroundColor White