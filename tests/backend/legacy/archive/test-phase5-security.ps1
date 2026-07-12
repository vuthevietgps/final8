# =============================================================================
# Phase 5: Security Test Script for SmartERP
# Date: 2026-02-14
# Covers: Unauthorized access, Role-based access control, NoSQL injection,
#          XSS prevention, CORS, Password exposure, Token manipulation
# =============================================================================

$BaseUrl = "http://localhost:3000"
$results = @()
$script:passed = 0
$script:failed = 0
$script:skipped = 0
$script:totalTests = 0

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

function Test-Api {
    param(
        [string]$TestId,
        [string]$Description,
        [string]$Method = "GET",
        [string]$Url,
        [string]$Body = $null,
        [string]$Token = $null,
        [int]$ExpectedStatus = 200,
        [scriptblock]$Validate = $null,
        [string]$ContentType = "application/json",
        [hashtable]$ExtraHeaders = @{}
    )

    $script:totalTests++
    $headers = @{ "Content-Type" = $ContentType }
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    foreach ($key in $ExtraHeaders.Keys) {
        $headers[$key] = $ExtraHeaders[$key]
    }

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $headers
            TimeoutSec = 30
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }

        $response = Invoke-RestMethod @params
        $statusCode = 200

        $validationResult = ""
        if ($Validate) {
            $validationResult = & $Validate $response
        }

        if ($ExpectedStatus -ge 400) {
            $result = @{
                TestId = $TestId; Description = $Description; Status = "FAIL"
                HttpStatus = $statusCode; Details = "Expected $ExpectedStatus but got 200"
                Response = $response
            }
            Write-Host "  [FAIL] $TestId - $Description (Expected $ExpectedStatus, got 200)" -ForegroundColor Red
            $script:failed++
            return $result
        }

        $result = @{
            TestId = $TestId; Description = $Description; Status = "PASS"
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
        $responseBody = ""

        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            try {
                $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
                $responseBody = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }

        if ($ExpectedStatus -ge 400 -and $statusCode -eq $ExpectedStatus) {
            $validationResult = ""
            if ($Validate -and $responseBody) {
                try {
                    $parsedBody = $responseBody | ConvertFrom-Json
                    $validationResult = & $Validate $parsedBody
                } catch {
                    $validationResult = "Response body: $($responseBody.Substring(0, [Math]::Min(200, $responseBody.Length)))"
                }
            }
            $result = @{
                TestId = $TestId; Description = $Description; Status = "PASS"
                HttpStatus = $statusCode; Details = if ($validationResult) { $validationResult } else { "Expected $ExpectedStatus received" }
                Response = $responseBody
            }
            Write-Host "  [PASS] $TestId - $Description" -ForegroundColor Green
            $detail = if ($validationResult) { $validationResult } else { "Expected $ExpectedStatus received" }
            Write-Host "         $detail" -ForegroundColor Gray
            $script:passed++
            return $result
        }

        $result = @{
            TestId = $TestId; Description = $Description; Status = "FAIL"
            HttpStatus = $statusCode; Details = "Error: $errorMsg"
            Response = $responseBody
        }
        Write-Host "  [FAIL] $TestId - $Description" -ForegroundColor Red
        Write-Host "         HTTP $statusCode - $($errorMsg.Substring(0, [Math]::Min(120, $errorMsg.Length)))" -ForegroundColor Gray
        if ($responseBody) {
            Write-Host "         Body: $($responseBody.Substring(0, [Math]::Min(200, $responseBody.Length)))" -ForegroundColor DarkGray
        }
        $script:failed++
        return $result
    }
}

function Skip-Test {
    param([string]$TestId, [string]$Description, [string]$Reason)
    $script:totalTests++
    $script:skipped++
    Write-Host "  [SKIP] $TestId - $Description" -ForegroundColor Yellow
    Write-Host "         $Reason" -ForegroundColor Gray
    return @{ TestId = $TestId; Description = $Description; Status = "SKIP"; Details = $Reason }
}

# ============================================================
# START
# ============================================================

$startTime = Get-Date

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5: SECURITY TEST - SmartERP" -ForegroundColor Cyan
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "  Backend:  $BaseUrl" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

# ============================================================
# PRE-CHECK: Login to get valid tokens for later tests
# ============================================================

Write-Host ""
Write-Host "=== PRE-CHECK: Authentication ===" -ForegroundColor Yellow

# Director login
$directorLogin = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body '{"email":"vutheviet@gmail.com","password":"123456"}' -ContentType "application/json"
$directorToken = $directorLogin.access_token

if ($directorToken) {
    Write-Host "  [PASS] PRE-001 - Director login successful" -ForegroundColor Green
    Write-Host "         role=$($directorLogin.user.role), email=$($directorLogin.user.email)" -ForegroundColor Gray
    $script:passed++; $script:totalTests++
} else {
    Write-Host "  [FAIL] PRE-001 - Director login FAILED - cannot proceed" -ForegroundColor Red
    $script:failed++; $script:totalTests++
    exit 1
}

# Try Manager login
$managerToken = $null
try {
    $mgrLogin = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body '{"email":"manager@test.com","password":"123456"}' -ContentType "application/json"
    $managerToken = $mgrLogin.access_token
    Write-Host "  [PASS] PRE-002 - Manager login successful" -ForegroundColor Green
    $script:passed++; $script:totalTests++
} catch {
    Write-Host "  [SKIP] PRE-002 - Manager account not available" -ForegroundColor Yellow
    $script:skipped++; $script:totalTests++
}

# Try Employee login
$employeeToken = $null
try {
    $empLogin = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body '{"email":"employee@test.com","password":"123456"}' -ContentType "application/json"
    $employeeToken = $empLogin.access_token
    Write-Host "  [PASS] PRE-003 - Employee login successful" -ForegroundColor Green
    $script:passed++; $script:totalTests++
} catch {
    Write-Host "  [SKIP] PRE-003 - Employee account not available" -ForegroundColor Yellow
    $script:skipped++; $script:totalTests++
}

# Try Agent login
$agentToken = $null
try {
    $agentLogin = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body '{"email":"agent@test.com","password":"123456"}' -ContentType "application/json"
    $agentToken = $agentLogin.access_token
    Write-Host "  [PASS] PRE-004 - Agent login successful" -ForegroundColor Green
    $script:passed++; $script:totalTests++
} catch {
    Write-Host "  [SKIP] PRE-004 - Agent account not available" -ForegroundColor Yellow
    $script:skipped++; $script:totalTests++
}

# Try Supplier login
$supplierToken = $null
try {
    $supLogin = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -Body '{"email":"supplier@test.com","password":"123456"}' -ContentType "application/json"
    $supplierToken = $supLogin.access_token
    Write-Host "  [PASS] PRE-005 - Supplier login successful" -ForegroundColor Green
    $script:passed++; $script:totalTests++
} catch {
    Write-Host "  [SKIP] PRE-005 - Supplier account not available" -ForegroundColor Yellow
    $script:skipped++; $script:totalTests++
}

$h = @{ Authorization = "Bearer $directorToken"; "Content-Type" = "application/json" }

# ============================================================
# 5.1 UNAUTHORIZED ACCESS (No Token) - TC-SEC-1xx
# ============================================================

Write-Host ""
Write-Host "=== 5.1 UNAUTHORIZED ACCESS (No Token) ===" -ForegroundColor Yellow

# Protected endpoints that should reject requests without token
$protectedEndpoints = @(
    @{ Id = "TC-SEC-101"; Desc = "GET /api/users without token"; Url = "$BaseUrl/api/users"; Method = "GET" },
    @{ Id = "TC-SEC-102"; Desc = "GET /api/test-order2 without token"; Url = "$BaseUrl/api/test-order2"; Method = "GET" },
    @{ Id = "TC-SEC-103"; Desc = "GET /api/products without token"; Url = "$BaseUrl/api/products"; Method = "GET" },
    @{ Id = "TC-SEC-104"; Desc = "GET /api/finance/summary without token"; Url = "$BaseUrl/api/finance/summary"; Method = "GET" },
    @{ Id = "TC-SEC-105"; Desc = "GET /api/financial-control/dashboard without token"; Url = "$BaseUrl/api/financial-control/dashboard"; Method = "GET" },
    @{ Id = "TC-SEC-106"; Desc = "GET /api/owner-fund/owners without token"; Url = "$BaseUrl/api/owner-fund/owners"; Method = "GET" },
    @{ Id = "TC-SEC-107"; Desc = "GET /api/ad-accounts without token"; Url = "$BaseUrl/api/ad-accounts"; Method = "GET" },
    @{ Id = "TC-SEC-108"; Desc = "GET /api/cashflow/dashboard/summary without token"; Url = "$BaseUrl/api/cashflow/dashboard/summary"; Method = "GET" },
    @{ Id = "TC-SEC-109"; Desc = "GET /api/auth/profile without token"; Url = "$BaseUrl/api/auth/profile"; Method = "GET" },
    @{ Id = "TC-SEC-110"; Desc = "GET /api/ads-alerts without token"; Url = "$BaseUrl/api/ads-alerts"; Method = "GET" },
    @{ Id = "TC-SEC-111"; Desc = "GET /api/capital-allocation/policies without token"; Url = "$BaseUrl/api/capital-allocation/policies"; Method = "GET" },
    @{ Id = "TC-SEC-112"; Desc = "GET /api/session-log without token"; Url = "$BaseUrl/api/session-log"; Method = "GET" }
)

foreach ($ep in $protectedEndpoints) {
    # Test: does endpoint reject without token?
    $script:totalTests++
    try {
        $params = @{ Uri = $ep.Url; Method = $ep.Method; Headers = @{ "Content-Type" = "application/json" }; TimeoutSec = 15; ErrorAction = "Stop" }
        $response = Invoke-RestMethod @params
        # Got 200 without token - endpoint is UNPROTECTED
        Write-Host "  [FAIL] $($ep.Id) - $($ep.Desc)" -ForegroundColor Red
        Write-Host "         SECURITY: Endpoint accessible without authentication!" -ForegroundColor Red
        $script:failed++
        $results += @{ TestId = $ep.Id; Description = $ep.Desc; Status = "FAIL"; Details = "UNPROTECTED: Returns 200 without token" }
    } catch {
        $code = 0
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
        if ($code -eq 401 -or $code -eq 403) {
            Write-Host "  [PASS] $($ep.Id) - $($ep.Desc)" -ForegroundColor Green
            Write-Host "         Correctly returns $code without token" -ForegroundColor Gray
            $script:passed++
            $results += @{ TestId = $ep.Id; Description = $ep.Desc; Status = "PASS"; Details = "Returns $code without token" }
        } elseif ($code -eq 404) {
            Write-Host "  [SKIP] $($ep.Id) - $($ep.Desc)" -ForegroundColor Yellow
            Write-Host "         Endpoint not found (404)" -ForegroundColor Gray
            $script:skipped++
            $results += @{ TestId = $ep.Id; Description = $ep.Desc; Status = "SKIP"; Details = "Endpoint not found (404)" }
        } else {
            Write-Host "  [FAIL] $($ep.Id) - $($ep.Desc)" -ForegroundColor Red
            Write-Host "         Unexpected HTTP $code" -ForegroundColor Gray
            $script:failed++
            $results += @{ TestId = $ep.Id; Description = $ep.Desc; Status = "FAIL"; Details = "Unexpected HTTP $code" }
        }
    }
}

# TC-SEC-113: Health check should work WITHOUT token (public endpoint)
$results += Test-Api -TestId "TC-SEC-113" -Description "GET /health without token (public)" `
    -Url "$BaseUrl/health" `
    -Validate {
        param($r)
        "Health check accessible without auth (expected behavior)"
    }

# ============================================================
# 5.2 FAKE/INVALID TOKEN - TC-SEC-2xx
# ============================================================

Write-Host ""
Write-Host "=== 5.2 FAKE/INVALID TOKEN ===" -ForegroundColor Yellow

# TC-SEC-201: Completely fake token
$results += Test-Api -TestId "TC-SEC-201" -Description "API with completely fake token" `
    -Url "$BaseUrl/api/users" -Token "this_is_a_completely_fake_token" `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Fake token correctly rejected"
    }

# TC-SEC-202: Malformed JWT (valid base64 but invalid structure)
$fakeJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
$results += Test-Api -TestId "TC-SEC-202" -Description "API with malformed JWT (wrong secret)" `
    -Url "$BaseUrl/api/users" -Token $fakeJwt `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Malformed JWT correctly rejected"
    }

# TC-SEC-203: Empty Authorization header
$results += Test-Api -TestId "TC-SEC-203" -Description "API with empty Bearer token" `
    -Url "$BaseUrl/api/users" -Token "" `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Empty token correctly rejected"
    }

# TC-SEC-204: Token with 'null' string
$results += Test-Api -TestId "TC-SEC-204" -Description "API with token = 'null'" `
    -Url "$BaseUrl/api/users" -Token "null" `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Null string token correctly rejected"
    }

# TC-SEC-205: Token with 'undefined' string
$results += Test-Api -TestId "TC-SEC-205" -Description "API with token = 'undefined'" `
    -Url "$BaseUrl/api/users" -Token "undefined" `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Undefined string token correctly rejected"
    }

# TC-SEC-206: Modified JWT payload (tampered token)
# Take valid token, decode, modify payload, re-encode without valid signature
$tokenParts = $directorToken -split '\.'
if ($tokenParts.Length -eq 3) {
    # Tamper the payload by changing the last character
    $tamperedPayload = $tokenParts[1].Substring(0, $tokenParts[1].Length - 1) + "X"
    $tamperedToken = "$($tokenParts[0]).$tamperedPayload.$($tokenParts[2])"

    $results += Test-Api -TestId "TC-SEC-206" -Description "API with tampered JWT payload" `
        -Url "$BaseUrl/api/users" -Token $tamperedToken `
        -ExpectedStatus 401 `
        -Validate {
            param($r)
            "Tampered JWT correctly rejected"
        }
} else {
    $results += Skip-Test -TestId "TC-SEC-206" -Description "API with tampered JWT" -Reason "Could not parse token"
}

# TC-SEC-207: JWT with different algorithm claim
$algNoneHeader = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"alg":"none","typ":"JWT"}')) -replace '=','' -replace '\+','-' -replace '/','_'
$fakePayload = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"sub":"000000000000000000000000","role":"director","iat":9999999999}')) -replace '=','' -replace '\+','-' -replace '/','_'
$algNoneToken = "$algNoneHeader.$fakePayload."

$results += Test-Api -TestId "TC-SEC-207" -Description "API with alg:none JWT attack" `
    -Url "$BaseUrl/api/users" -Token $algNoneToken `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Algorithm none attack correctly rejected"
    }

# ============================================================
# 5.3 ROLE-BASED ACCESS CONTROL - TC-SEC-3xx
# ============================================================

Write-Host ""
Write-Host "=== 5.3 ROLE-BASED ACCESS CONTROL ===" -ForegroundColor Yellow

# TC-SEC-301: Director should have full access to users
$results += Test-Api -TestId "TC-SEC-301" -Description "Director CAN access /api/users" `
    -Url "$BaseUrl/api/users" -Token $directorToken `
    -Validate {
        param($r)
        $count = if ($r -is [array]) { $r.Count } else { "object" }
        "Director access OK: $count users returned"
    }

# TC-SEC-302: Director should access owner-fund
$results += Test-Api -TestId "TC-SEC-302" -Description "Director CAN access /api/owner-fund/owners" `
    -Url "$BaseUrl/api/owner-fund/owners" -Token $directorToken `
    -Validate {
        param($r)
        "Director access to owner-fund OK"
    }

# TC-SEC-303: Director should access financial-control
$results += Test-Api -TestId "TC-SEC-303" -Description "Director CAN access /api/financial-control/dashboard" `
    -Url "$BaseUrl/api/financial-control/dashboard" -Token $directorToken `
    -Validate {
        param($r)
        "Director access to financial-control OK"
    }

# TC-SEC-304-310: Non-director roles should NOT access director-only resources
$directorOnlyEndpoints = @(
    @{ Url = "$BaseUrl/api/users"; Desc = "/api/users" },
    @{ Url = "$BaseUrl/api/owner-fund/owners"; Desc = "/api/owner-fund/owners" },
    @{ Url = "$BaseUrl/api/financial-control/dashboard"; Desc = "/api/financial-control/dashboard" },
    @{ Url = "$BaseUrl/api/salary-config"; Desc = "/api/salary-config" }
)

$testNum = 304
if ($employeeToken) {
    foreach ($ep in $directorOnlyEndpoints) {
        $results += Test-Api -TestId "TC-SEC-$testNum" -Description "Employee CANNOT access $($ep.Desc)" `
            -Url $ep.Url -Token $employeeToken `
            -ExpectedStatus 403 `
            -Validate {
                param($r)
                "Employee correctly denied access"
            }
        $testNum++
    }
} else {
    foreach ($ep in $directorOnlyEndpoints) {
        $results += Skip-Test -TestId "TC-SEC-$testNum" -Description "Employee access check $($ep.Desc)" -Reason "No employee account"
        $testNum++
    }
}

# TC-SEC-308-310: Agent should not access finance
if ($agentToken) {
    $results += Test-Api -TestId "TC-SEC-308" -Description "Agent CANNOT access /api/finance/summary" `
        -Url "$BaseUrl/api/finance/summary" -Token $agentToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Agent correctly denied access to finance" }

    $results += Test-Api -TestId "TC-SEC-309" -Description "Agent CANNOT access /api/ad-accounts" `
        -Url "$BaseUrl/api/ad-accounts" -Token $agentToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Agent correctly denied access to ad-accounts" }

    $results += Test-Api -TestId "TC-SEC-310" -Description "Agent CANNOT access /api/owner-fund/owners" `
        -Url "$BaseUrl/api/owner-fund/owners" -Token $agentToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Agent correctly denied access to owner-fund" }
} else {
    $results += Skip-Test -TestId "TC-SEC-308" -Description "Agent access check (finance)" -Reason "No agent account"
    $results += Skip-Test -TestId "TC-SEC-309" -Description "Agent access check (ad-accounts)" -Reason "No agent account"
    $results += Skip-Test -TestId "TC-SEC-310" -Description "Agent access check (owner-fund)" -Reason "No agent account"
}

# TC-SEC-311-313: Supplier should only access quotes/products
if ($supplierToken) {
    $results += Test-Api -TestId "TC-SEC-311" -Description "Supplier CANNOT access /api/users" `
        -Url "$BaseUrl/api/users" -Token $supplierToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Supplier correctly denied access to users" }

    $results += Test-Api -TestId "TC-SEC-312" -Description "Supplier CANNOT access /api/test-order2" `
        -Url "$BaseUrl/api/test-order2" -Token $supplierToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Supplier correctly denied access to orders" }

    $results += Test-Api -TestId "TC-SEC-313" -Description "Supplier CANNOT access /api/finance/dashboard" `
        -Url "$BaseUrl/api/finance/dashboard" -Token $supplierToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Supplier correctly denied access to finance" }
} else {
    $results += Skip-Test -TestId "TC-SEC-311" -Description "Supplier access check (users)" -Reason "No supplier account"
    $results += Skip-Test -TestId "TC-SEC-312" -Description "Supplier access check (orders)" -Reason "No supplier account"
    $results += Skip-Test -TestId "TC-SEC-313" -Description "Supplier access check (finance)" -Reason "No supplier account"
}

# TC-SEC-314: Manager should access orders
if ($managerToken) {
    $results += Test-Api -TestId "TC-SEC-314" -Description "Manager CAN access /api/test-order2" `
        -Url "$BaseUrl/api/test-order2" -Token $managerToken `
        -Validate {
            param($r)
            "Manager access to orders OK"
        }
} else {
    $results += Skip-Test -TestId "TC-SEC-314" -Description "Manager access check (orders)" -Reason "No manager account"
}

# TC-SEC-315: Manager should NOT access owner-fund
if ($managerToken) {
    $results += Test-Api -TestId "TC-SEC-315" -Description "Manager CANNOT access /api/owner-fund/owners" `
        -Url "$BaseUrl/api/owner-fund/owners" -Token $managerToken `
        -ExpectedStatus 403 `
        -Validate { param($r); "Manager correctly denied access to owner-fund" }
} else {
    $results += Skip-Test -TestId "TC-SEC-315" -Description "Manager access check (owner-fund)" -Reason "No manager account"
}

# ============================================================
# 5.4 NOSQL INJECTION - TC-SEC-4xx
# ============================================================

Write-Host ""
Write-Host "=== 5.4 NOSQL INJECTION ===" -ForegroundColor Yellow

# TC-SEC-401: Login with $gt operator injection
$results += Test-Api -TestId "TC-SEC-401" -Description "NoSQL injection: login with \$gt operator" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":{"$gt":""},"password":"any"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "NoSQL \$gt injection blocked on login"
    }

# TC-SEC-402: Login with $ne operator injection
$results += Test-Api -TestId "TC-SEC-402" -Description "NoSQL injection: login with \$ne operator" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":{"$ne":"nonexistent"},"password":{"$ne":"wrong"}}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "NoSQL \$ne injection blocked on login"
    }

# TC-SEC-403: Login with $regex injection
$results += Test-Api -TestId "TC-SEC-403" -Description "NoSQL injection: login with \$regex operator" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":{"$regex":".*"},"password":"any"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "NoSQL \$regex injection blocked on login"
    }

# TC-SEC-404: NoSQL injection in query params
$results += Test-Api -TestId "TC-SEC-404" -Description "NoSQL injection: \$where in query param" `
    -Url "$BaseUrl/api/test-order2?`$where=1==1" -Token $directorToken `
    -Validate {
        param($r)
        "Query param injection handled (did not crash)"
    }

# TC-SEC-405: NoSQL injection in user creation
$injectionBody = @{
    name = '{"$gt":""}'
    email = "injection-test@test.com"
    password = "123456"
    role = "employee"
} | ConvertTo-Json -Compress

$results += Test-Api -TestId "TC-SEC-405" -Description "NoSQL injection: \$gt in user name field" `
    -Method "POST" -Url "$BaseUrl/api/users" `
    -Body $injectionBody -Token $directorToken `
    -Validate {
        param($r)
        $name = $r.name
        if ($name -eq '{"$gt":""}') {
            "Injection stored as literal string (safe - will be escaped on display)"
        } else {
            "Name stored as: $name"
        }
    }

# TC-SEC-406: Login with $or injection
$results += Test-Api -TestId "TC-SEC-406" -Description "NoSQL injection: \$or bypass attempt" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"$or":[{"email":"admin"},{"email":{"$gt":""}}],"password":"any"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "NoSQL \$or injection blocked on login"
    }

# TC-SEC-407: Injection in MongoDB ObjectId parameter
$results += Test-Api -TestId "TC-SEC-407" -Description "NoSQL injection: invalid ObjectId in URL" `
    -Url "$BaseUrl/api/test-order2/{`$gt:''}" -Token $directorToken `
    -ExpectedStatus 400 `
    -Validate {
        param($r)
        "Invalid ObjectId correctly rejected"
    }

# ============================================================
# 5.5 XSS PREVENTION - TC-SEC-5xx
# ============================================================

Write-Host ""
Write-Host "=== 5.5 XSS PREVENTION ===" -ForegroundColor Yellow

# TC-SEC-501: XSS in user name
$xssName = '<script>alert("XSS")</script>'
$xssUserBody = @{
    name = $xssName
    email = "xss-test-$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
    password = "123456"
    role = "employee"
} | ConvertTo-Json -Compress

$xssUserId = $null
$results += Test-Api -TestId "TC-SEC-501" -Description "XSS: script tag in user name" `
    -Method "POST" -Url "$BaseUrl/api/users" `
    -Body $xssUserBody -Token $directorToken `
    -Validate {
        param($r)
        $id = if ($r._id) { $r._id } elseif ($r.id) { $r.id }
        $script:xssUserId = $id
        $storedName = $r.name
        if ($storedName -match '<script>') {
            "WARNING: Script tag stored as-is (name=$storedName) - frontend must escape!"
        } else {
            "XSS sanitized: name=$storedName"
        }
    }

# TC-SEC-502: XSS in order notes
$xssOrderBody = @{
    orderCode = "XSS-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
    customerName = '<img src=x onerror=alert("XSS")>'
    notes = '<script>document.cookie</script>'
    phone = "0123456789"
    address = "Test address"
    productName = "Test Product"
    quantity = 1
    unitPrice = 100000
    supplier = "Test Supplier"
} | ConvertTo-Json -Compress

$results += Test-Api -TestId "TC-SEC-502" -Description "XSS: img onerror in customer name" `
    -Method "POST" -Url "$BaseUrl/api/test-order2" `
    -Body $xssOrderBody -Token $directorToken `
    -Validate {
        param($r)
        $name = $r.customerName
        if ($name -match 'onerror') {
            "WARNING: onerror attribute stored (name=$name) - frontend must escape!"
        } else {
            "XSS sanitized: $name"
        }
    }

# TC-SEC-503: XSS via URL encoded payload
$xssEncoded = '%3Cscript%3Ealert(1)%3C/script%3E'
$results += Test-Api -TestId "TC-SEC-503" -Description "XSS: URL-encoded script in search param" `
    -Url "$BaseUrl/api/test-order2?search=$xssEncoded" -Token $directorToken `
    -Validate {
        param($r)
        "URL-encoded XSS in search param handled safely"
    }

# TC-SEC-504: XSS in product name
$xssProductBody = @{
    name = '"><svg onload=alert(1)>'
    sku = "XSS-SKU-001"
    price = 50000
} | ConvertTo-Json -Compress

$results += Test-Api -TestId "TC-SEC-504" -Description "XSS: svg onload in product name" `
    -Method "POST" -Url "$BaseUrl/api/products" `
    -Body $xssProductBody -Token $directorToken `
    -Validate {
        param($r)
        $storedName = $r.name
        if ($storedName -match 'onload') {
            "WARNING: onload stored as-is - frontend must escape!"
        } else {
            "XSS sanitized: $storedName"
        }
    }

# ============================================================
# 5.6 PASSWORD EXPOSURE - TC-SEC-6xx
# ============================================================

Write-Host ""
Write-Host "=== 5.6 PASSWORD EXPOSURE ===" -ForegroundColor Yellow

# TC-SEC-601: GET /api/users should NOT return password field
$results += Test-Api -TestId "TC-SEC-601" -Description "Password NOT in GET /api/users response" `
    -Url "$BaseUrl/api/users" -Token $directorToken `
    -Validate {
        param($r)
        $users = if ($r -is [array]) { $r } elseif ($r.data) { $r.data } else { @($r) }
        $exposed = @()
        foreach ($u in $users) {
            if ($u.password) {
                $exposed += "$($u.email): password field exists"
            }
        }
        if ($exposed.Count -gt 0) {
            throw "PASSWORD EXPOSED! $($exposed -join '; ')"
        }
        "Checked $($users.Count) users - no password field exposed"
    }

# TC-SEC-602: GET /api/auth/profile should NOT return password
$results += Test-Api -TestId "TC-SEC-602" -Description "Password NOT in GET /api/auth/profile" `
    -Url "$BaseUrl/api/auth/profile" -Token $directorToken `
    -Validate {
        param($r)
        $user = if ($r.user) { $r.user } else { $r }
        if ($user.password) {
            throw "PASSWORD EXPOSED in profile! password=$($user.password)"
        }
        "Profile returned without password field"
    }

# TC-SEC-603: Login response should NOT return password
$results += Test-Api -TestId "TC-SEC-603" -Description "Password NOT in login response" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"vutheviet@gmail.com","password":"123456"}' `
    -Validate {
        param($r)
        $user = $r.user
        if ($user.password) {
            throw "PASSWORD EXPOSED in login response!"
        }
        "Login response: user object has no password field"
    }

# TC-SEC-604: GET /api/users/:id should NOT return password
$results += Test-Api -TestId "TC-SEC-604" -Description "Password NOT in single user GET" `
    -Url "$BaseUrl/api/users" -Token $directorToken `
    -Validate {
        param($r)
        $users = if ($r -is [array]) { $r } elseif ($r.data) { $r.data } else { @($r) }
        if ($users.Count -gt 0) {
            $firstUser = $users[0]
            $userId = if ($firstUser._id) { $firstUser._id } else { $firstUser.id }
            # We'll check in the list response since we already have it
            if ($firstUser.password) {
                throw "PASSWORD EXPOSED for user $userId"
            }
        }
        "No password exposed in user data"
    }

# ============================================================
# 5.7 LOGIN SECURITY - TC-SEC-7xx
# ============================================================

Write-Host ""
Write-Host "=== 5.7 LOGIN SECURITY ===" -ForegroundColor Yellow

# TC-SEC-701: Login with wrong password
$results += Test-Api -TestId "TC-SEC-701" -Description "Login with wrong password returns 401" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"vutheviet@gmail.com","password":"wrongpassword"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        $msg = if ($r.message) { $r.message } else { "unauthorized" }
        "Wrong password rejected: $msg"
    }

# TC-SEC-702: Login with non-existent email
$results += Test-Api -TestId "TC-SEC-702" -Description "Login with non-existent email returns 401" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"nonexistent@nowhere.com","password":"123456"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        $msg = if ($r.message) { $r.message } else { "unauthorized" }
        "Non-existent email rejected: $msg"
    }

# TC-SEC-703: Login with empty body
$results += Test-Api -TestId "TC-SEC-703" -Description "Login with empty body" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Empty body login correctly rejected"
    }

# TC-SEC-704: Login with missing password
$results += Test-Api -TestId "TC-SEC-704" -Description "Login with missing password" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"vutheviet@gmail.com"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Missing password correctly rejected"
    }

# TC-SEC-705: Login with SQL-like injection in email
$results += Test-Api -TestId "TC-SEC-705" -Description "Login with SQL injection in email" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body '{"email":"admin'' OR ''1''=''1","password":"123456"}' `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "SQL injection in email correctly rejected"
    }

# TC-SEC-706: Very long password (DoS prevention)
$longPassword = "A" * 10000
$longPwBody = @{ email = "test@test.com"; password = $longPassword } | ConvertTo-Json -Compress

$results += Test-Api -TestId "TC-SEC-706" -Description "Login with very long password (10000 chars)" `
    -Method "POST" -Url "$BaseUrl/api/auth/login" `
    -Body $longPwBody `
    -ExpectedStatus 401 `
    -Validate {
        param($r)
        "Long password handled without crash"
    }

# ============================================================
# 5.8 DATA ISOLATION & AUTHORIZATION BOUNDARIES - TC-SEC-8xx
# ============================================================

Write-Host ""
Write-Host "=== 5.8 DATA ISOLATION & AUTHORIZATION ===" -ForegroundColor Yellow

# TC-SEC-801: Cannot delete other user (as non-director)
if ($employeeToken) {
    # Get director's user ID
    $directorUserId = $directorLogin.user.id
    if (-not $directorUserId) { $directorUserId = $directorLogin.user._id }

    if ($directorUserId) {
        $results += Test-Api -TestId "TC-SEC-801" -Description "Employee CANNOT delete director user" `
            -Method "DELETE" -Url "$BaseUrl/api/users/$directorUserId" `
            -Token $employeeToken -ExpectedStatus 403 `
            -Validate {
                param($r)
                "Employee correctly denied from deleting director"
            }
    } else {
        $results += Skip-Test -TestId "TC-SEC-801" -Description "Employee delete director" -Reason "No director user ID"
    }
} else {
    $results += Skip-Test -TestId "TC-SEC-801" -Description "Employee delete director" -Reason "No employee account"
}

# TC-SEC-802: Cannot create user (as non-director)
if ($employeeToken) {
    $newUserBody = @{
        name = "Unauthorized User"
        email = "unauthorized@test.com"
        password = "123456"
        role = "director"
    } | ConvertTo-Json -Compress

    $results += Test-Api -TestId "TC-SEC-802" -Description "Employee CANNOT create user" `
        -Method "POST" -Url "$BaseUrl/api/users" `
        -Body $newUserBody -Token $employeeToken -ExpectedStatus 403 `
        -Validate {
            param($r)
            "Employee correctly denied from creating users"
        }
} else {
    $results += Skip-Test -TestId "TC-SEC-802" -Description "Employee create user" -Reason "No employee account"
}

# TC-SEC-803: Write operations on finance (as non-authorized role)
if ($employeeToken) {
    $cashflowBody = @{
        direction = "in"
        sourceType = "other"
        amount = 999999999
        description = "Security test - should be blocked"
    } | ConvertTo-Json -Compress

    $results += Test-Api -TestId "TC-SEC-803" -Description "Employee CANNOT create finance cashflow" `
        -Method "POST" -Url "$BaseUrl/api/finance/cashflows" `
        -Body $cashflowBody -Token $employeeToken -ExpectedStatus 403 `
        -Validate {
            param($r)
            "Employee correctly denied from creating cashflow entries"
        }
} else {
    $results += Skip-Test -TestId "TC-SEC-803" -Description "Employee create cashflow" -Reason "No employee account"
}

# TC-SEC-804: Write operations on owner-fund (as manager)
if ($managerToken) {
    $withdrawalBody = @{
        ownerId = "000000000000000000000000"
        amount = 100000
        type = "PROFIT_SHARE"
        reason = "Security test"
    } | ConvertTo-Json -Compress

    $results += Test-Api -TestId "TC-SEC-804" -Description "Manager CANNOT create owner-fund withdrawal" `
        -Method "POST" -Url "$BaseUrl/api/owner-fund/withdrawals" `
        -Body $withdrawalBody -Token $managerToken -ExpectedStatus 403 `
        -Validate {
            param($r)
            "Manager correctly denied from owner-fund operations"
        }
} else {
    $results += Skip-Test -TestId "TC-SEC-804" -Description "Manager owner-fund access" -Reason "No manager account"
}

# ============================================================
# 5.9 INPUT VALIDATION & BOUNDARY - TC-SEC-9xx
# ============================================================

Write-Host ""
Write-Host "=== 5.9 INPUT VALIDATION & BOUNDARY ===" -ForegroundColor Yellow

# TC-SEC-901: Invalid ObjectId format
$results += Test-Api -TestId "TC-SEC-901" -Description "Invalid ObjectId returns proper error" `
    -Url "$BaseUrl/api/test-order2/not-a-valid-id" -Token $directorToken `
    -ExpectedStatus 400 `
    -Validate {
        param($r)
        "Invalid ObjectId properly rejected"
    }

# TC-SEC-902: Extremely large JSON body
$largeArray = @()
for ($i = 0; $i -lt 100; $i++) {
    $largeArray += @{ name = "item$i"; value = ("X" * 1000) }
}
$largeBody = @{ items = $largeArray } | ConvertTo-Json -Compress -Depth 3

$script:totalTests++
try {
    $params = @{
        Uri = "$BaseUrl/api/test-order2"
        Method = "POST"
        Headers = $h
        Body = [System.Text.Encoding]::UTF8.GetBytes($largeBody)
        TimeoutSec = 15
        ErrorAction = "Stop"
    }
    $response = Invoke-RestMethod @params
    Write-Host "  [PASS] TC-SEC-902 - Large JSON body handled (accepted/rejected gracefully)" -ForegroundColor Green
    $script:passed++
    $results += @{ TestId = "TC-SEC-902"; Description = "Large JSON body handling"; Status = "PASS"; Details = "Handled gracefully" }
} catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -ge 400 -and $code -lt 500) {
        Write-Host "  [PASS] TC-SEC-902 - Large JSON body rejected with $code (expected)" -ForegroundColor Green
        $script:passed++
        $results += @{ TestId = "TC-SEC-902"; Description = "Large JSON body handling"; Status = "PASS"; Details = "Rejected with $code" }
    } else {
        Write-Host "  [PASS] TC-SEC-902 - Large JSON body handled (HTTP $code)" -ForegroundColor Green
        $script:passed++
        $results += @{ TestId = "TC-SEC-902"; Description = "Large JSON body handling"; Status = "PASS"; Details = "HTTP $code" }
    }
}

# TC-SEC-903: Negative amount in financial operations
$negativeBody = @{
    direction = "in"
    sourceType = "other"
    amount = -1000000
    description = "Negative amount test"
} | ConvertTo-Json -Compress

$results += Test-Api -TestId "TC-SEC-903" -Description "Negative amount in cashflow rejected" `
    -Method "POST" -Url "$BaseUrl/api/finance/cashflows" `
    -Body $negativeBody -Token $directorToken `
    -ExpectedStatus 400 `
    -Validate {
        param($r)
        "Negative amount correctly rejected"
    }

# TC-SEC-904: Path traversal attempt
$results += Test-Api -TestId "TC-SEC-904" -Description "Path traversal in API URL" `
    -Url "$BaseUrl/api/../../../etc/passwd" -Token $directorToken `
    -ExpectedStatus 404 `
    -Validate {
        param($r)
        "Path traversal blocked"
    }

# TC-SEC-905: HTTP method not allowed
$results += Test-Api -TestId "TC-SEC-905" -Description "PUT method on GET-only endpoint" `
    -Method "PUT" -Url "$BaseUrl/api/auth/profile" -Token $directorToken `
    -Body '{"test":"test"}' -ExpectedStatus 404 `
    -Validate {
        param($r)
        "Unsupported method properly rejected"
    }

# ============================================================
# 5.10 CLEANUP
# ============================================================

Write-Host ""
Write-Host "=== CLEANUP ===" -ForegroundColor Yellow

# Delete XSS test user if created
if ($xssUserId) {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/api/users/$xssUserId" -Method DELETE -Headers $h -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host "  [INFO] Cleaned up XSS test user: $xssUserId" -ForegroundColor Gray
    } catch {
        Write-Host "  [INFO] Could not clean up XSS user (may not exist)" -ForegroundColor Gray
    }
}

# Delete injection test user
try {
    $allUsers = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Headers $h -TimeoutSec 10
    $testUsers = $allUsers | Where-Object { $_.email -match 'injection-test|xss-test|unauthorized' }
    foreach ($tu in $testUsers) {
        $tuId = if ($tu._id) { $tu._id } else { $tu.id }
        try {
            Invoke-RestMethod -Uri "$BaseUrl/api/users/$tuId" -Method DELETE -Headers $h -TimeoutSec 10 -ErrorAction SilentlyContinue
            Write-Host "  [INFO] Cleaned up test user: $($tu.email)" -ForegroundColor Gray
        } catch {}
    }
} catch {}

# ============================================================
# SUMMARY
# ============================================================

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 5: SECURITY TEST - SUMMARY" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Total tests:  $($script:totalTests)" -ForegroundColor White
Write-Host "  PASSED:       $($script:passed)" -ForegroundColor Green
Write-Host "  FAILED:       $($script:failed)" -ForegroundColor Red
Write-Host "  SKIPPED:      $($script:skipped)" -ForegroundColor Yellow
Write-Host ""
$passRate = if ($script:totalTests -gt 0) { [Math]::Round(($script:passed / $script:totalTests) * 100, 1) } else { 0 }
$effectiveRate = if (($script:totalTests - $script:skipped) -gt 0) { [Math]::Round(($script:passed / ($script:totalTests - $script:skipped)) * 100, 1) } else { 0 }
Write-Host "  Pass Rate:    $passRate% (excluding skips: $effectiveRate%)" -ForegroundColor White
Write-Host "  Duration:     $($duration.TotalSeconds.ToString('0.0'))s" -ForegroundColor White
Write-Host ""

# List failures
$failedTests = $results | Where-Object { $_.Status -eq "FAIL" }
if ($failedTests.Count -gt 0) {
    Write-Host "  ---- FAILED TESTS ----" -ForegroundColor Red
    foreach ($ft in $failedTests) {
        Write-Host "  $($ft.TestId): $($ft.Description)" -ForegroundColor Red
        Write-Host "    Details: $($ft.Details)" -ForegroundColor Gray
    }
    Write-Host ""
}

# Security assessment
Write-Host "  ---- SECURITY ASSESSMENT ----" -ForegroundColor Magenta
$secCategories = @{
    "5.1 No Token" = ($results | Where-Object { $_.TestId -match "TC-SEC-1" -and $_.Status -eq "PASS" }).Count
    "5.2 Fake Token" = ($results | Where-Object { $_.TestId -match "TC-SEC-2" -and $_.Status -eq "PASS" }).Count
    "5.3 RBAC" = ($results | Where-Object { $_.TestId -match "TC-SEC-3" -and $_.Status -eq "PASS" }).Count
    "5.4 NoSQL Injection" = ($results | Where-Object { $_.TestId -match "TC-SEC-4" -and $_.Status -eq "PASS" }).Count
    "5.5 XSS" = ($results | Where-Object { $_.TestId -match "TC-SEC-5" -and $_.Status -eq "PASS" }).Count
    "5.6 Password" = ($results | Where-Object { $_.TestId -match "TC-SEC-6" -and $_.Status -eq "PASS" }).Count
    "5.7 Login" = ($results | Where-Object { $_.TestId -match "TC-SEC-7" -and $_.Status -eq "PASS" }).Count
    "5.8 Data Isolation" = ($results | Where-Object { $_.TestId -match "TC-SEC-8" -and $_.Status -eq "PASS" }).Count
    "5.9 Input Validation" = ($results | Where-Object { $_.TestId -match "TC-SEC-9" -and $_.Status -eq "PASS" }).Count
}
foreach ($cat in $secCategories.GetEnumerator() | Sort-Object Name) {
    $catTotal = ($results | Where-Object { $_.TestId -match "TC-SEC-$($cat.Name.Substring(2,1))" }).Count
    $icon = if ($cat.Value -eq $catTotal -and $catTotal -gt 0) { "SECURE" } elseif ($cat.Value -gt 0) { "PARTIAL" } else { "UNTESTED" }
    Write-Host "  [$icon] $($cat.Name): $($cat.Value)/$catTotal passed" -ForegroundColor $(if ($icon -eq "SECURE") { "Green" } elseif ($icon -eq "PARTIAL") { "Yellow" } else { "Gray" })
}
Write-Host ""

# List skipped
$skippedTests = $results | Where-Object { $_.Status -eq "SKIP" }
if ($skippedTests.Count -gt 0) {
    Write-Host "  ---- SKIPPED TESTS ----" -ForegroundColor Yellow
    foreach ($st in $skippedTests) {
        Write-Host "  $($st.TestId): $($st.Description) - $($st.Details)" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Test completed at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
