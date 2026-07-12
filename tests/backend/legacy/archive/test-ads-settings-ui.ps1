#!/usr/bin/env pwsh
# Test script for Ads Settings UI endpoints

$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000/api"

Write-Host "=== TEST ADS SETTINGS ENDPOINTS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Login
Write-Host "1. Login as director..." -ForegroundColor Yellow
$loginBody = '{"email":"director@test.com","password":"123456"}'
$loginResp = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).access_token
Write-Host "   [OK] Token: $($token.Substring(0,20))..." -ForegroundColor Green

# 2. Get Settings
Write-Host "`n2. GET /api-tokens/settings" -ForegroundColor Yellow
try {
    $resp = Invoke-WebRequest -Uri "$baseUrl/api-tokens/settings" -Method GET -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   [OK] Response:" -ForegroundColor Green
    $resp.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} catch {
    Write-Host "   [ERROR] $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red }
}

# 3. Test Google Ads (will fail with fake credentials)
Write-Host "`n3. POST /api-tokens/test/google (fake credentials)" -ForegroundColor Yellow
try {
    $body = '{"clientId":"fake-client","clientSecret":"fake-secret","refreshToken":"fake-refresh","developerToken":"fake-dev","customerId":"1234567890"}'
    $resp = Invoke-WebRequest -Uri "$baseUrl/api-tokens/test/google" -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   Response:" -ForegroundColor Cyan
    $resp.Content
} catch {
    Write-Host "   [Expected Error] $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

# 4. Test TikTok (will fail with fake credentials)
Write-Host "`n4. POST /api-tokens/test/tiktok (fake credentials)" -ForegroundColor Yellow
try {
    $body = '{"accessToken":"fake-token","advertiserId":"7123456789012345678"}'
    $resp = Invoke-WebRequest -Uri "$baseUrl/api-tokens/test/tiktok" -Method POST -Body $body -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   Response:" -ForegroundColor Cyan
    $resp.Content
} catch {
    Write-Host "   [Expected Error] $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

# 5. Test Facebook Sync
Write-Host "`n5. POST /advertising-cost/fetch/facebook" -ForegroundColor Yellow
try {
    $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $resp = Invoke-WebRequest -Uri "$baseUrl/advertising-cost/fetch/facebook?date=$yesterday" -Method POST -Headers @{Authorization="Bearer $token"} -UseBasicParsing
    Write-Host "   [OK] Response:" -ForegroundColor Green
    $resp.Content
} catch {
    Write-Host "   [Expected Error - no token] $($_.ErrorDetails.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
