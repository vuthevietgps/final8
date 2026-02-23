#!/usr/bin/env pwsh
# Test script for Google Sheet Sync endpoints

$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000/api"

Write-Host "=== TEST GOOGLE SHEET SYNC ENDPOINTS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Login
Write-Host "1. Login as director..." -ForegroundColor Yellow
$loginBody = '{"email":"director@test.com","password":"123456"}'
$loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).access_token
Write-Host "   [OK] Token: $($token.Substring(0,20))..." -ForegroundColor Green

# 2. Get status
Write-Host "`n2. GET /order-sheet-sync/status" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/order-sheet-sync/status" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   [OK] Response:" -ForegroundColor Green
    $resp.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red }
}

# 3. Get agents & suppliers list
Write-Host "`n3. GET /order-sheet-sync/agents-suppliers" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/order-sheet-sync/agents-suppliers" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    $data = $resp.Content | ConvertFrom-Json
    Write-Host "   [OK] Found $($data.agents.Count) agents, $($data.suppliers.Count) suppliers" -ForegroundColor Green
    
    if ($data.agents.Count -gt 0) {
        Write-Host "   Agents:" -ForegroundColor Cyan
        $data.agents | ForEach-Object { Write-Host "     - $($_.fullName): $($_.orderCount) orders, Sheet: $(if($_.googleDriveLink){'YES'}else{'NO'})" }
    }
    if ($data.suppliers.Count -gt 0) {
        Write-Host "   Suppliers:" -ForegroundColor Cyan
        $data.suppliers | ForEach-Object { Write-Host "     - $($_.fullName): $($_.orderCount) orders, Sheet: $(if($_.googleDriveLink){'YES'}else{'NO'})" }
    }
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Test credentials (with fake JSON - will fail but should return proper error)
Write-Host "`n4. POST /order-sheet-sync/test-credentials (fake)" -ForegroundColor Yellow
try {
    $fakeCredentials = '{"type":"service_account","client_email":"fake@test.iam.gserviceaccount.com","private_key":"-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----"}'
    $body = @{ credentialsJson = $fakeCredentials } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$baseUrl/order-sheet-sync/test-credentials" -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   Response:" -ForegroundColor Cyan
    $resp.Content
} catch {
    Write-Host "   [Expected Error] $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== DONE ===" -ForegroundColor Cyan
