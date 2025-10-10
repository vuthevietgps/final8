# Quick Stop Script for Final8
# Dừng tất cả Backend và Frontend processes

Write-Host "🛑 STOPPING FINAL8 SERVERS" -ForegroundColor Red
Write-Host "===========================" -ForegroundColor Red

function Show-Status {
    param($message)
    Write-Host "✅ $message" -ForegroundColor Green
}

function Show-Info {
    param($message)
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

try {
    # Stop port 3000 (Backend)
    Show-Info "Stopping Backend server (port 3000)..."
    $port3000 = netstat -ano | findstr :3000 | Select-String "LISTENING"
    if ($port3000) {
        $pid3000 = ($port3000 -split '\s+')[-1]
        taskkill /PID $pid3000 /F 2>$null
        Show-Status "Backend server stopped"
    } else {
        Show-Info "No process found on port 3000"
    }

    # Stop port 4200 (Frontend)
    Show-Info "Stopping Frontend server (port 4200)..."
    $port4200 = netstat -ano | findstr :4200 | Select-String "LISTENING"
    if ($port4200) {
        $pid4200 = ($port4200 -split '\s+')[-1]
        taskkill /PID $pid4200 /F 2>$null
        Show-Status "Frontend server stopped"
    } else {
        Show-Info "No process found on port 4200"
    }

    # Kill all Node.js processes để chắc chắn
    Show-Info "Cleaning up all Node.js processes..."
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Show-Status "All Node.js processes cleaned up"
    } else {
        Show-Info "No Node.js processes found"
    }

    Write-Host ""
    Write-Host "🎉 All Final8 servers stopped successfully!" -ForegroundColor Green

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}