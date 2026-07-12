# Phase 1: Smoke Test Script for SmartERP
# Date: 2026-02-14

$BaseUrl = "http://localhost:3000"
$results = @()
$passed = 0
$failed = 0

function Test-Api {
    param(
        [string]$TestId,
        [string]$Description,
        [string]$Method,
        [string]$Url,
        [string]$Body = $null,
        [string]$Token = $null,
        [int]$ExpectedStatus = 200,
        [scriptblock]$Validate = $null
    )
    
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 15
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }
        
        $response = Invoke-RestMethod @params
        $statusCode = 200
        
        # Run custom validation if provided
        $validationResult = ""
        if ($Validate) {
            $validationResult = & $Validate $response
        }
        
        $result = @{
            TestId = $TestId
            Description = $Description
            Status = "PASS"
            HttpStatus = $statusCode
            Details = if ($validationResult) { $validationResult } else { "OK" }
            Response = $response
        }
        Write-Host "  [PASS] $TestId - $Description" -ForegroundColor Green
        if ($validationResult) { Write-Host "         $validationResult" -ForegroundColor Gray }
        $script:passed++
        return $result
    }
    catch {
        $statusCode = 0
        $errorMsg = $_.Exception.Message
        
        # Try to get HTTP status code
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        
        # Check if we expected an error status
        if ($ExpectedStatus -ge 400 -and $statusCode -eq $ExpectedStatus) {
            $result = @{
                TestId = $TestId
                Description = $Description
                Status = "PASS"
                HttpStatus = $statusCode
                Details = "Got expected status $statusCode"
            }
            Write-Host "  [PASS] $TestId - $Description (Expected $statusCode)" -ForegroundColor Green
            $script:passed++
            return $result
        }
        
        # If we expected 200 but got error
        if ($ExpectedStatus -lt 400 -and $statusCode -ge 400) {
            $result = @{
                TestId = $TestId
                Description = $Description
                Status = "FAIL"
                HttpStatus = $statusCode
                Details = $errorMsg
            }
            Write-Host "  [FAIL] $TestId - $Description (Got $statusCode, expected $ExpectedStatus)" -ForegroundColor Red
            Write-Host "         $errorMsg" -ForegroundColor Yellow
            $script:failed++
            return $result
        }
        
        # General failure
        $result = @{
            TestId = $TestId
            Description = $Description
            Status = "FAIL"
            HttpStatus = $statusCode
            Details = $errorMsg
        }
        Write-Host "  [FAIL] $TestId - $Description" -ForegroundColor Red
        Write-Host "         $errorMsg" -ForegroundColor Yellow
        $script:failed++
        return $result
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PHASE 1: SMOKE TEST - SmartERP System" -ForegroundColor Cyan
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. HEALTH CHECK
# ============================================================
Write-Host "--- 1. SYSTEM HEALTH ---" -ForegroundColor Yellow

$r = Test-Api -TestId "TC-SYS-001" -Description "Health check (no auth required)" `
    -Method "GET" -Url "$BaseUrl/health" `
    -Validate { param($r) "status=$($r.status), timestamp=$($r.timestamp)" }
$results += $r

Write-Host ""

# ============================================================
# 2. AUTHENTICATION TESTS
# ============================================================
Write-Host "--- 2. AUTHENTICATION ---" -ForegroundColor Yellow

# TC-AUTH-001: Login thanh cong
$loginBody = '{"email":"vutheviet@gmail.com","password":"123456"}'
$r = Test-Api -TestId "TC-AUTH-001" -Description "Login thanh cong (Director)" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" -Body $loginBody `
    -Validate { 
        param($r) 
        $tokenOk = $r.access_token.Length -gt 20
        $emailOk = $r.user.email -eq "vutheviet@gmail.com"
        $roleOk = $r.user.role -eq "director"
        "token=$tokenOk, email=$emailOk, role=$roleOk, name=$($r.user.fullName)"
    }
$results += $r

# Save token for subsequent tests
$TOKEN = ""
if ($r.Status -eq "PASS" -and $r.Response.access_token) {
    $TOKEN = $r.Response.access_token
    Write-Host "         Token saved for subsequent tests (len=$($TOKEN.Length))" -ForegroundColor Gray
}

# TC-AUTH-002: Login sai password
$r = Test-Api -TestId "TC-AUTH-002" -Description "Login sai password" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"vutheviet@gmail.com","password":"wrongpassword"}' `
    -ExpectedStatus 401
$results += $r

# TC-AUTH-003: Login email khong ton tai
$r = Test-Api -TestId "TC-AUTH-003" -Description "Login email khong ton tai" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"nonexistent@test.com","password":"123456"}' `
    -ExpectedStatus 401
$results += $r

# TC-AUTH-004: Login thieu field (empty body)
$r = Test-Api -TestId "TC-AUTH-004a" -Description "Login body rong {}" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{}' `
    -ExpectedStatus 400
$results += $r

# TC-AUTH-004b: Login thieu password
$r = Test-Api -TestId "TC-AUTH-004b" -Description "Login thieu password" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"vutheviet@gmail.com"}' `
    -ExpectedStatus 400
$results += $r

# TC-AUTH-006: Xem profile (voi token)
if ($TOKEN) {
    $r = Test-Api -TestId "TC-AUTH-006" -Description "Xem profile (valid token)" `
        -Method "GET" -Url "$BaseUrl/api/auth/profile" -Token $TOKEN `
        -Validate {
            param($r)
            $hasEmail = [bool]$r.email
            $hasRole = [bool]$r.role
            $hasName = [bool]($r.fullName -or $r.name)
            "email=$($r.email), role=$($r.role), fullName=$($r.fullName)"
        }
    $results += $r
} else {
    Write-Host "  [SKIP] TC-AUTH-006 - No token available" -ForegroundColor DarkYellow
}

# TC-AUTH-007: Profile khong co token
$r = Test-Api -TestId "TC-AUTH-007" -Description "Profile khong co token" `
    -Method "GET" -Url "$BaseUrl/api/auth/profile" `
    -ExpectedStatus 401
$results += $r

# TC-AUTH-008: Validate token
if ($TOKEN) {
    $r = Test-Api -TestId "TC-AUTH-008" -Description "Validate token" `
        -Method "POST" -Url "$BaseUrl/api/auth/validate-token" -Token $TOKEN `
        -Validate { param($r) "valid=$($r.valid)" }
    $results += $r
}

# TC-SEC-001: API without token
$r = Test-Api -TestId "TC-SEC-001" -Description "API /users without token" `
    -Method "GET" -Url "$BaseUrl/api/users" `
    -ExpectedStatus 401
$results += $r

# TC-SEC-002: API with fake token
$r = Test-Api -TestId "TC-SEC-002" -Description "API /users with fake token" `
    -Method "GET" -Url "$BaseUrl/api/users" `
    -Token "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.token" `
    -ExpectedStatus 401
$results += $r

Write-Host ""

# ============================================================
# 3. MAIN API ENDPOINTS SMOKE (with valid token)
# ============================================================
Write-Host "--- 3. MAIN API ENDPOINTS (Smoke) ---" -ForegroundColor Yellow

if ($TOKEN) {
    # Users
    $r = Test-Api -TestId "TC-SMOKE-USERS" -Description "GET /api/users" `
        -Method "GET" -Url "$BaseUrl/api/users" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Orders (test-order2)
    $r = Test-Api -TestId "TC-SMOKE-ORDERS" -Description "GET /api/test-order2" `
        -Method "GET" -Url "$BaseUrl/api/test-order2" -Token $TOKEN `
        -Validate { 
            param($r) 
            if ($r.data) { "orders=$($r.data.Count), total=$($r.total)" }
            elseif ($r.Count -ge 0) { "count=$($r.Count)" }
            else { "response received" }
        }
    $results += $r

    # Products
    $r = Test-Api -TestId "TC-SMOKE-PRODUCTS" -Description "GET /api/products" `
        -Method "GET" -Url "$BaseUrl/api/products" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Product Categories
    $r = Test-Api -TestId "TC-SMOKE-PRODCAT" -Description "GET /api/product-category" `
        -Method "GET" -Url "$BaseUrl/api/product-category" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Customers
    $r = Test-Api -TestId "TC-SMOKE-CUSTOMERS" -Description "GET /api/customers" `
        -Method "GET" -Url "$BaseUrl/api/customers" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Delivery Status
    $r = Test-Api -TestId "TC-SMOKE-DELIVERY" -Description "GET /api/delivery-status" `
        -Method "GET" -Url "$BaseUrl/api/delivery-status" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Production Status
    $r = Test-Api -TestId "TC-SMOKE-PRODUCTION" -Description "GET /api/production-status" `
        -Method "GET" -Url "$BaseUrl/api/production-status" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Order Status
    $r = Test-Api -TestId "TC-SMOKE-ORDSTATUS" -Description "GET /api/order-status" `
        -Method "GET" -Url "$BaseUrl/api/order-status" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Ad Accounts
    $r = Test-Api -TestId "TC-SMOKE-ADACC" -Description "GET /api/ad-accounts" `
        -Method "GET" -Url "$BaseUrl/api/ad-accounts" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Ad Groups
    $r = Test-Api -TestId "TC-SMOKE-ADGRP" -Description "GET /api/ad-groups" `
        -Method "GET" -Url "$BaseUrl/api/ad-groups" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Ads Alerts
    $r = Test-Api -TestId "TC-SMOKE-ALERTS" -Description "GET /api/ads-alerts" `
        -Method "GET" -Url "$BaseUrl/api/ads-alerts" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Finance Summary
    $r = Test-Api -TestId "TC-SMOKE-FINSUMM" -Description "GET /api/finance/summary" `
        -Method "GET" -Url "$BaseUrl/api/finance/summary" -Token $TOKEN
    $results += $r

    # Financial Control Dashboard
    $r = Test-Api -TestId "TC-SMOKE-FCDASH" -Description "GET /api/financial-control/dashboard" `
        -Method "GET" -Url "$BaseUrl/api/financial-control/dashboard" -Token $TOKEN
    $results += $r

    # Cashflow Dashboard
    $r = Test-Api -TestId "TC-SMOKE-CFDASH" -Description "GET /api/cashflow/dashboard/summary" `
        -Method "GET" -Url "$BaseUrl/api/cashflow/dashboard/summary" -Token $TOKEN
    $results += $r

    # Owner Fund
    $r = Test-Api -TestId "TC-SMOKE-OWNFUND" -Description "GET /api/owner-fund/owners" `
        -Method "GET" -Url "$BaseUrl/api/owner-fund/owners" -Token $TOKEN `
        -Validate { param($r) "count=$($r.Count)" }
    $results += $r

    # Labor Cost
    $r = Test-Api -TestId "TC-SMOKE-LABOR" -Description "GET /api/labor-cost1" `
        -Method "GET" -Url "$BaseUrl/api/labor-cost1" -Token $TOKEN
    $results += $r

    # Other Cost
    $r = Test-Api -TestId "TC-SMOKE-OTHCOST" -Description "GET /api/other-cost" `
        -Method "GET" -Url "$BaseUrl/api/other-cost" -Token $TOKEN
    $results += $r

    # Supplier Quotes
    $r = Test-Api -TestId "TC-SMOKE-SUPQUOTE" -Description "GET /api/supplier-quotes" `
        -Method "GET" -Url "$BaseUrl/api/supplier-quotes" -Token $TOKEN
    $results += $r

    # Agent Receivables
    $r = Test-Api -TestId "TC-SMOKE-AGTREC" -Description "GET /api/agent-receivables" `
        -Method "GET" -Url "$BaseUrl/api/agent-receivables" -Token $TOKEN
    $results += $r

    # Quotes
    $r = Test-Api -TestId "TC-SMOKE-QUOTES" -Description "GET /api/quotes" `
        -Method "GET" -Url "$BaseUrl/api/quotes" -Token $TOKEN
    $results += $r

    # Salary Config
    $r = Test-Api -TestId "TC-SMOKE-SALARY" -Description "GET /api/salary-config" `
        -Method "GET" -Url "$BaseUrl/api/salary-config" -Token $TOKEN
    $results += $r

    # Fanpages
    $r = Test-Api -TestId "TC-SMOKE-FANPAGE" -Description "GET /api/fanpages" `
        -Method "GET" -Url "$BaseUrl/api/fanpages" -Token $TOKEN
    $results += $r

    # API Tokens
    $r = Test-Api -TestId "TC-SMOKE-APITOKEN" -Description "GET /api/api-tokens" `
        -Method "GET" -Url "$BaseUrl/api/api-tokens" -Token $TOKEN
    $results += $r

    # Session Logs
    $r = Test-Api -TestId "TC-SMOKE-SESSLOG" -Description "GET /api/session-logs" `
        -Method "GET" -Url "$BaseUrl/api/session-logs" -Token $TOKEN
    $results += $r

    # Employee Ads KPI
    $r = Test-Api -TestId "TC-SMOKE-ADSKPI" -Description "GET /api/employee-ads-kpi" `
        -Method "GET" -Url "$BaseUrl/api/employee-ads-kpi" -Token $TOKEN
    $results += $r

    # Financial Control Config
    $r = Test-Api -TestId "TC-SMOKE-FCCFG" -Description "GET /api/financial-control/config" `
        -Method "GET" -Url "$BaseUrl/api/financial-control/config" -Token $TOKEN
    $results += $r

    # Supplier Payables
    $r = Test-Api -TestId "TC-SMOKE-SUPPAY" -Description "GET /api/supplier-payables" `
        -Method "GET" -Url "$BaseUrl/api/supplier-payables" -Token $TOKEN
    $results += $r

    # Return Report
    $r = Test-Api -TestId "TC-SMOKE-RETURN" -Description "GET /api/return-report" `
        -Method "GET" -Url "$BaseUrl/api/return-report" -Token $TOKEN
    $results += $r

    # Loans
    $r = Test-Api -TestId "TC-SMOKE-LOANS" -Description "GET /api/finance/loans" `
        -Method "GET" -Url "$BaseUrl/api/finance/loans" -Token $TOKEN
    $results += $r

    # Advertising Cost
    $r = Test-Api -TestId "TC-SMOKE-ADSCOST" -Description "GET /api/advertising-cost" `
        -Method "GET" -Url "$BaseUrl/api/advertising-cost" -Token $TOKEN
    $results += $r
}

Write-Host ""

# ============================================================
# 4. FRONTEND CHECK
# ============================================================
Write-Host "--- 4. FRONTEND CHECK ---" -ForegroundColor Yellow

$r = Test-Api -TestId "TC-UI-FE-LOAD" -Description "Frontend loads (http://localhost:4200)" `
    -Method "GET" -Url "http://localhost:4200"
$results += $r

Write-Host ""

# ============================================================
# 5. LOGOUT TEST
# ============================================================
Write-Host "--- 5. LOGOUT ---" -ForegroundColor Yellow

if ($TOKEN) {
    $r = Test-Api -TestId "TC-AUTH-005" -Description "Logout" `
        -Method "POST" -Url "$BaseUrl/api/auth/logout" -Token $TOKEN
    $results += $r
}

Write-Host ""

# ============================================================
# SUMMARY
# ============================================================
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  PHASE 1 SMOKE TEST RESULTS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Total tests: $($results.Count)" -ForegroundColor White
Write-Host "  PASSED:      $passed" -ForegroundColor Green
Write-Host "  FAILED:      $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failed -gt 0) {
    Write-Host "  FAILED TESTS:" -ForegroundColor Red
    foreach ($r in $results) {
        if ($r.Status -eq "FAIL") {
            Write-Host "    - $($r.TestId): $($r.Description)" -ForegroundColor Red
            Write-Host "      Status: $($r.HttpStatus) | $($r.Details)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "  Detailed Results:" -ForegroundColor White
foreach ($r in $results) {
    $color = if ($r.Status -eq "PASS") { "Green" } else { "Red" }
    $icon = if ($r.Status -eq "PASS") { "OK" } else { "XX" }
    Write-Host "    [$icon] $($r.TestId.PadRight(22)) $($r.Description)" -ForegroundColor $color
}
Write-Host ""
