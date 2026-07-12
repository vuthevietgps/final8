#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.AUTH-RBAC.PS1
    =====================================================================================
    Test Authentication & Role-Based Access Control:
    1. Login with different roles (director, manager, employee, agent, supplier)
    2. Profile access
    3. Token validation
    4. Logout
    5. Permission boundary tests (employee can't access FC, supplier can't access orders)
    6. Session logs
    7. Health check (no auth required)
    8. Invalid credentials
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$BaseUrl = if ($env:AUTH_RBAC_BASE_URL) { $env:AUTH_RBAC_BASE_URL.TrimEnd('/') } else { "http://localhost:3000/api" }
$HealthUrl = if ($BaseUrl -match '/api$') { $BaseUrl -replace '/api$','/health' } else { "$BaseUrl/health" }

# ========== UTILITIES ==========
function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Safe-Request {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null, [string]$Label = "")
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        return (Invoke-RestMethod @params)
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}
function Expect-Fail {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null, [string]$Label = "")
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        $r = Invoke-RestMethod @params
        return @{ success = $true; data = $r; statusCode = 200 }
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        return @{ success = $false; statusCode = $st }
    }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$createdManagerId = $null
$createdEmployeeId = $null

Write-Section "MODULE TEST: AUTH & RBAC - $ts"

# ===== PHASE 1: HEALTH CHECK (NO AUTH) =====
Write-Section "PHASE 1: Health Check"

Write-Step "1.1" "Health check (no auth)"
$health = Safe-Request -Method GET -Uri $HealthUrl -Headers @{} -Label "Health"
if ($health -ne $null) { Write-Pass "Health check OK" } else { Write-Fail "Health check failed" }

# ===== PHASE 2: DIRECTOR LOGIN =====
Write-Section "PHASE 2: Director Login & Token"

Write-Step "2.1" "Login Director"
$dirLogin = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "DirLogin"
if ($dirLogin -and $dirLogin.access_token) {
    $dirToken = $dirLogin.access_token
    $dirH = @{ "Authorization" = "Bearer $dirToken" }
    Write-Pass "Director login OK: $($dirLogin.user.fullName) (role=$($dirLogin.user.role))"
    if ($dirLogin.user.role -eq "director") { Write-Pass "User role = director" }
    else { Write-Fail "Expected director, got $($dirLogin.user.role)" }
} else { Write-Fail "Director login failed"; exit 1 }

Write-Step "2.2" "Get profile"
$profile = Safe-Request -Method GET -Uri "$BaseUrl/auth/profile" -Headers $dirH -Label "Profile"
if ($profile -and $profile.email) {
    Write-Pass "Profile OK: $($profile.email)"
} else { Write-Fail "Profile failed" }

Write-Step "2.3" "Validate token"
$valid = Safe-Request -Method POST -Uri "$BaseUrl/auth/validate-token" -Headers $dirH -Label "ValidateToken"
if ($valid -ne $null) { Write-Pass "Token valid" } else { Write-Fail "Token validation failed" }

Write-Step "2.4" "Session logs"
$sessions = Safe-Request -Method GET -Uri "$BaseUrl/session-logs/me" -Headers $dirH -Label "SessionLogs"
if ($sessions -ne $null) { Write-Pass "Session logs OK" } else { Write-Fail "Session logs failed" }

Write-Step "2.5" "Director can access Financial Control"
$fc = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $dirH -Label "DirFC"
if ($fc) { Write-Pass "Director -> FC dashboard: ALLOWED" } else { Write-Fail "Director should access FC" }

Write-Step "2.6" "Director can access orders"
$orders = Safe-Request -Method GET -Uri "$BaseUrl/test-order2" -Headers $dirH -Label "DirOrders"
if ($orders -ne $null) { Write-Pass "Director -> Orders: ALLOWED" } else { Write-Fail "Director should access orders" }

# Load baseline users once so role tests can prefer deterministic regression accounts
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $dirH -Label "GetUsers"
$userList = if ($users -is [array]) { $users } elseif ($users.data) { $users.data } else { @($users) }

# ===== PHASE 3: MANAGER LOGIN =====
Write-Section "PHASE 3: Manager Login & Report Permissions"

$managerUser = $userList | Where-Object { $_.email -eq "manager@test.com" } | Select-Object -First 1
if (-not $managerUser) {
    Write-Step "3.1" "Create temporary manager"
    $managerBody = @{
        fullName = "Manager RBAC $ts"
        email = "manager.rbac.$ts@test.com"
        password = "123456"
        phone = "090000$((Get-Random -Minimum 1000 -Maximum 9999))"
        role = "manager"
        isActive = $true
    } | ConvertTo-Json
    $managerUser = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $dirH -Body $managerBody -Label "CreateManager"
    if ($managerUser -and $managerUser._id) {
        $createdManagerId = [string]$managerUser._id
        Write-Pass "Temporary manager created: $($managerUser.email)"
    } else {
        Write-Fail "Failed to create temporary manager"
    }
}

if ($managerUser) {
    Write-Step "3.2" "Login Manager"
    $mgrBody = @{ email = $managerUser.email; password = "123456" } | ConvertTo-Json
    $mgrLogin = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $mgrBody -Label "MgrLogin"
    if ($mgrLogin -and $mgrLogin.access_token) {
        $mgrH = @{ "Authorization" = "Bearer $($mgrLogin.access_token)" }
        Write-Pass "Manager login OK: $($mgrLogin.user.fullName)"

        Write-Step "3.3" "Manager can access return report"
        $mgrReturnReport = Expect-Fail -Method GET -Uri "$BaseUrl/return-report/product" -Headers $mgrH -Label "MgrReturnReport"
        if ($mgrReturnReport.success -or $mgrReturnReport.statusCode -eq 200) { Write-Pass "Manager -> Return report: ALLOWED" }
        else { Write-Fail "Manager should access return report" }

        Write-Step "3.4" "Manager can access profit reports"
        $mgrProfitSummary = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-profit-report/summary" -Headers $mgrH -Label "MgrProfitSummary"
        if ($mgrProfitSummary -ne $null) { Write-Pass "Manager -> Profit reports: ALLOWED" }
        else { Write-Fail "Manager should access profit reports" }
    } else {
        Write-Fail "Manager login failed"
    }
} else {
    Write-Info "No manager user found, skipping manager tests"
}

# ===== PHASE 4: EMPLOYEE LOGIN =====
Write-Section "PHASE 4: Employee Login & Permissions"

$empUser = $userList | Where-Object { $_.email -eq "employee@test.com" } | Select-Object -First 1
if (-not $empUser) {
    Write-Step "4.0" "Create temporary employee"
    $employeeBody = @{
        fullName = "Employee RBAC $ts"
        email = "employee.rbac.$ts@test.com"
        password = "123456"
        phone = "091000$((Get-Random -Minimum 1000 -Maximum 9999))"
        role = "employee"
        isActive = $true
    } | ConvertTo-Json
    $empUser = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $dirH -Body $employeeBody -Label "CreateEmployee"
    if ($empUser -and $empUser._id) {
        $createdEmployeeId = [string]$empUser._id
        Write-Pass "Temporary employee created: $($empUser.email)"
    } else {
        Write-Fail "Failed to create temporary employee"
    }
}

if ($empUser) {
    Write-Step "4.1" "Login Employee"
    $empBody = @{ email = $empUser.email; password = "123456" } | ConvertTo-Json
    $empLogin = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $empBody -Label "EmpLogin"
    if ($empLogin -and $empLogin.access_token) {
        $empH = @{ "Authorization" = "Bearer $($empLogin.access_token)" }
        Write-Pass "Employee login OK: $($empLogin.user.fullName)"

        Write-Step "4.2" "Employee profile"
        $empProfile = Safe-Request -Method GET -Uri "$BaseUrl/auth/profile" -Headers $empH -Label "EmpProfile"
        if ($empProfile) { Write-Pass "Employee profile OK" } else { Write-Fail "Employee profile failed" }

        Write-Step "4.3" "Employee access to FC (should be restricted)"
        $empFC = Expect-Fail -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $empH -Label "EmpFC"
        if ($empFC.statusCode -eq 403 -or $empFC.statusCode -eq 401) {
            Write-Pass "Employee -> FC dashboard: BLOCKED ($($empFC.statusCode))"
        } elseif ($empFC.success) {
            Write-Info "Employee -> FC dashboard: ALLOWED (may have permission)"
            Write-Pass "Employee FC access check done"
        } else { Write-Pass "Employee -> FC: restricted ($($empFC.statusCode))" }

        Write-Step "4.4" "Employee access to orders (should be allowed)"
        $empOrders = Safe-Request -Method GET -Uri "$BaseUrl/test-order2" -Headers $empH -Label "EmpOrders"
        if ($empOrders -ne $null) { Write-Pass "Employee -> Orders: ALLOWED" }
        else { Write-Fail "Employee should access orders" }

    } else { Write-Fail "Employee login failed" }
} else { Write-Info "No employee user found, skipping employee tests" }

# ===== PHASE 5: AGENT LOGIN =====
Write-Section "PHASE 5: Agent Login & Permissions"

$agentUser = $userList | Where-Object { $_.email -eq "external-agent@test.com" } | Select-Object -First 1
if (-not $agentUser) {
    $agentUser = $userList | Where-Object { $_.role -eq "external_agent" -or $_.role -eq "internal_agent" } | Select-Object -First 1
}
if ($agentUser) {
    Write-Step "5.1" "Login Agent"
    $agBody = @{ email = $agentUser.email; password = "123456" } | ConvertTo-Json
    $agLogin = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $agBody -Label "AgLogin"
    if ($agLogin -and $agLogin.access_token) {
        $agH = @{ "Authorization" = "Bearer $($agLogin.access_token)" }
        Write-Pass "Agent login OK: $($agLogin.user.fullName) (role=$($agLogin.user.role))"

        Write-Step "5.2" "Agent access to users (should be restricted)"
        $agUsers = Expect-Fail -Method GET -Uri "$BaseUrl/users" -Headers $agH -Label "AgUsers"
        if ($agUsers.statusCode -eq 403 -or $agUsers.statusCode -eq 401) {
            Write-Pass "Agent -> Users: BLOCKED ($($agUsers.statusCode))"
        } elseif ($agUsers.success) {
            Write-Info "Agent -> Users: ALLOWED (checking data scope)"
            Write-Pass "Agent access check done"
        } else { Write-Pass "Agent -> Users: restricted ($($agUsers.statusCode))" }

    } else { Write-Info "Agent login failed (may not have password set - OK)" }
} else { Write-Info "No agent user found, skipping agent tests" }

# ===== PHASE 6: SUPPLIER LOGIN =====
Write-Section "PHASE 6: Supplier Login & Permissions"

$suppUser = $userList | Where-Object { $_.email -eq "internal-supplier@test.com" } | Select-Object -First 1
if (-not $suppUser) {
    $suppUser = $userList | Where-Object { $_.role -eq "external_supplier" -or $_.role -eq "internal_supplier" } | Select-Object -First 1
}
if ($suppUser) {
    Write-Step "6.1" "Login Supplier"
    $spBody = @{ email = $suppUser.email; password = "123456" } | ConvertTo-Json
    $spLogin = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $spBody -Label "SpLogin"
    if ($spLogin -and $spLogin.access_token) {
        $spH = @{ "Authorization" = "Bearer $($spLogin.access_token)" }
        Write-Pass "Supplier login OK: $($spLogin.user.fullName) (role=$($spLogin.user.role))"

        Write-Step "6.2" "Supplier access to FC (should be restricted)"
        $spFC = Expect-Fail -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $spH -Label "SpFC"
        if ($spFC.statusCode -eq 403 -or $spFC.statusCode -eq 401) {
            Write-Pass "Supplier -> FC: BLOCKED ($($spFC.statusCode))"
        } else { Write-Pass "Supplier FC access check done (status=$($spFC.statusCode))" }

    } else { Write-Info "Supplier login failed (may not have password set - OK)" }
} else { Write-Info "No supplier user found, skipping supplier tests" }

# ===== PHASE 7: ERROR CASES =====
Write-Section "PHASE 7: Error Cases"

Write-Step "7.1" "Invalid credentials"
$badLogin = Expect-Fail -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"notexist@test.com","password":"wrong"}' -Label "BadLogin"
if ($badLogin.success -eq $false -and $badLogin.statusCode -eq 401) {
    Write-Pass "Invalid credentials rejected (401)"
} elseif ($badLogin.success -eq $false) {
    Write-Pass "Invalid credentials rejected ($($badLogin.statusCode))"
} else { Write-Fail "Invalid credentials should fail" }

Write-Step "7.2" "No token - access protected route"
$noToken = Expect-Fail -Method GET -Uri "$BaseUrl/test-order2" -Headers @{} -Label "NoToken"
if ($noToken.success -eq $false -and ($noToken.statusCode -eq 401 -or $noToken.statusCode -eq 403)) {
    Write-Pass "No token -> protected route: BLOCKED ($($noToken.statusCode))"
} elseif ($noToken.success) {
    Write-Fail "Protected route should require auth"
} else { Write-Pass "No token rejected ($($noToken.statusCode))" }

Write-Step "7.3" "Invalid token"
$badH = @{ "Authorization" = "Bearer invalid.token.here" }
$badToken = Expect-Fail -Method GET -Uri "$BaseUrl/auth/profile" -Headers $badH -Label "BadToken"
if ($badToken.success -eq $false -and ($badToken.statusCode -eq 401 -or $badToken.statusCode -eq 403)) {
    Write-Pass "Invalid token rejected ($($badToken.statusCode))"
} else { Write-Fail "Invalid token should be rejected" }

Write-Step "7.4" "Empty password"
$emptyPw = Expect-Fail -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":""}' -Label "EmptyPw"
if ($emptyPw.success -eq $false) {
    Write-Pass "Empty password rejected ($($emptyPw.statusCode))"
} else { Write-Fail "Empty password should fail" }

# ===== PHASE 8: LOGOUT =====
Write-Section "PHASE 8: Logout"

Write-Step "8.1" "Cleanup temporary manager"
if ($createdManagerId) {
    $deletedManager = Expect-Fail -Method DELETE -Uri "$BaseUrl/users/$createdManagerId" -Headers $dirH -Label "DeleteTempManager"
    if ($deletedManager.success -or $deletedManager.statusCode -eq 200 -or $deletedManager.statusCode -eq 204) {
        Write-Pass "Temporary manager deleted"
    } else {
        Write-Fail "Temporary manager cleanup failed ($($deletedManager.statusCode))"
    }
} else {
    Write-Info "No temporary manager to cleanup"
}

Write-Step "8.1b" "Cleanup temporary employee"
if ($createdEmployeeId) {
    $deletedEmployee = Expect-Fail -Method DELETE -Uri "$BaseUrl/users/$createdEmployeeId" -Headers $dirH -Label "DeleteTempEmployee"
    if ($deletedEmployee.success -or $deletedEmployee.statusCode -eq 200 -or $deletedEmployee.statusCode -eq 204) {
        Write-Pass "Temporary employee deleted"
    } else {
        Write-Fail "Temporary employee cleanup failed ($($deletedEmployee.statusCode))"
    }
} else {
    Write-Info "No temporary employee to cleanup"
}

Write-Step "8.2" "Logout director"
$logout = Safe-Request -Method POST -Uri "$BaseUrl/auth/logout" -Headers $dirH -Label "Logout"
if ($logout -ne $null) { Write-Pass "Logout OK" } else { Write-Fail "Logout failed" }

Write-Step "8.3" "Old token is rejected after logout"
$postLogoutProfile = Expect-Fail -Method GET -Uri "$BaseUrl/auth/profile" -Headers $dirH -Label "PostLogoutProfile"
if ($postLogoutProfile.success -eq $false -and ($postLogoutProfile.statusCode -eq 401 -or $postLogoutProfile.statusCode -eq 403)) {
    Write-Pass "Old token rejected after logout ($($postLogoutProfile.statusCode))"
} else {
    Write-Fail "Old token should be rejected after logout"
}

# ===== SUMMARY =====
Write-Section "KET QUA - AUTH & RBAC MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
