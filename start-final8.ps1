# Final8 Startup Script - Clean Version
# Khởi động Backend và Frontend

param(
    [string]$Mode = "dev"
)

Write-Host "🚀 FINAL8 STARTUP SCRIPT" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

# Function để hiển thị status
function Show-Status {
    param($message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function Show-Info {
    param($message) 
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

function Show-Error {
    param($message)
    Write-Host "❌ $message" -ForegroundColor Red
}

try {
    # Kiểm tra thư mục hiện tại
    $currentPath = Get-Location
    if ($currentPath.Path -notlike "*final8-new*") {
        Show-Info "Navigating to final8-new directory..."
        Set-Location "C:\Users\PC\Documents\code\final8-new"
    }

    # Kiểm tra Node.js
    Show-Info "Checking Node.js installation..."
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Show-Error "Node.js is not installed or not in PATH"
        exit 1
    }
    Show-Status "Node.js version: $nodeVersion"

    # Kill existing processes trên ports 3000 và 4200
    Show-Info "Cleaning up existing processes..."
    
    # Kill port 3000 (Backend)
    $port3000 = netstat -ano | findstr :3000 | Select-String "LISTENING"
    if ($port3000) {
        $pid3000 = ($port3000 -split '\s+')[-1]
        taskkill /PID $pid3000 /F 2>$null
        Show-Status "Cleaned port 3000"
    }

    # Kill port 4200 (Frontend) 
    $port4200 = netstat -ano | findstr :4200 | Select-String "LISTENING"
    if ($port4200) {
        $pid4200 = ($port4200 -split '\s+')[-1] 
        taskkill /PID $pid4200 /F 2>$null
        Show-Status "Cleaned port 4200"
    }

    # Kill all node processes để chắc chắn
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Start-Sleep -Seconds 2

    # Khởi động Backend
    Show-Info "Starting Backend server..."
    
    if ($Mode -eq "prod") {
        $backendCommand = "npm run start:prod"
    } else {
        $backendCommand = "npm run start:dev"
    }

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; $backendCommand; Write-Host 'Backend process completed' -ForegroundColor Yellow"
    
    Show-Status "Backend server starting on port 3000"
    
    # Đợi backend khởi động
    Show-Info "Waiting for backend to initialize..."
    Start-Sleep -Seconds 8

    # Test backend health
    $maxRetries = 5
    $retryCount = 0
    $backendReady = $false
    
    while ($retryCount -lt $maxRetries -and -not $backendReady) {
        try {
            $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
            if ($healthCheck.status -eq "ok") {
                $backendReady = $true
                Show-Status "Backend health check passed"
            }
        } catch {
            $retryCount++
            Show-Info "Backend not ready yet, retrying... ($retryCount/$maxRetries)"
            Start-Sleep -Seconds 3
        }
    }

    if (-not $backendReady) {
        Show-Error "Backend failed to start properly"
        Show-Info "Check the backend terminal for errors"
    }

    # Khởi động Frontend
    Show-Info "Starting Frontend server..."
    
    if ($Mode -eq "prod") {
        $frontendCommand = "npm run build"
    } else {
        $frontendCommand = "npm start"
    }

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; $frontendCommand; Write-Host 'Frontend process completed' -ForegroundColor Yellow"
    
    Show-Status "Frontend server starting on port 4200"
    
    # Đợi frontend khởi động
    Show-Info "Waiting for frontend to initialize..."
    Start-Sleep -Seconds 10

    # Display access information
    Write-Host ""
    Write-Host "🎉 FINAL8 SERVERS STARTED!" -ForegroundColor Green
    Write-Host "============================" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 ACCESS URLS:" -ForegroundColor Cyan
    Write-Host "Frontend:    http://localhost:4200" -ForegroundColor White
    Write-Host "Backend:     http://localhost:3000" -ForegroundColor White
    Write-Host "API Health:  http://localhost:3000/health" -ForegroundColor White
    Write-Host ""
    Write-Host "🔐 LOGIN CREDENTIALS:" -ForegroundColor Cyan
    Write-Host "Email:       vutheviet@gmail.com" -ForegroundColor White  
    Write-Host "Password:    123456" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 FEATURES TO TEST:" -ForegroundColor Magenta
    Write-Host "□ User Management (CRUD)" -ForegroundColor White
    Write-Host "□ Delivery Status Management" -ForegroundColor White  
    Write-Host "□ Product Category Management" -ForegroundColor White
    Write-Host "□ Authentication & Authorization" -ForegroundColor White
    Write-Host "□ Responsive Design (Mobile/Desktop)" -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  NOTES:" -ForegroundColor Yellow
    Write-Host "- Check both terminal windows for any errors" -ForegroundColor White
    Write-Host "- TypeScript warning in vision-ai.service.ts is non-critical" -ForegroundColor White
    Write-Host "- Press Ctrl+C in terminals to stop servers" -ForegroundColor White
    
    # Tự động mở browser sau 5 giây
    Show-Info "Opening browser in 5 seconds..."
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:4200"

} catch {
    Show-Error "Unexpected error: $($_.Exception.Message)"
    Show-Info "Please check the error details above and try again"
    exit 1
}

Write-Host ""
Write-Host "✨ Startup script completed successfully!" -ForegroundColor Green