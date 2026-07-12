#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.AUTH-HARDENING.PS1
    =====================================================================================
    Targeted auth hardening regression:
    1. Register validation and duplicate rules
    2. Account state protections (inactive / deleted)
    3. Token lifecycle hardening (query token, logout revocation, repeated logout safety)
    4. IP restriction matrix with AUTH_ENABLE_IP_RESTRICTION=true on a dedicated instance
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$DefaultBaseUrl = if ($env:AUTH_HARDENING_BASE_URL) { $env:AUTH_HARDENING_BASE_URL.TrimEnd('/') } else { "http://localhost:3000/api" }
$IpBaseUrl = if ($env:AUTH_HARDENING_IP_BASE_URL) { $env:AUTH_HARDENING_IP_BASE_URL.TrimEnd('/') } else { "http://localhost:3100/api" }
$ConvertFromJsonSupportsDepth = (Get-Command ConvertFrom-Json).Parameters.ContainsKey("Depth")
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ArtifactsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'

function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

function Get-ErrorBody([object]$Exception) {
    try {
        if ($Exception.Response -and $Exception.Response.GetResponseStream) {
            return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
        }
    } catch {}
    return ""
}

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$Label = ""
    )

    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($null -ne $Body -and $Method -ne "GET") {
            $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
        }
        $response = Invoke-WebRequest @params
        $parsed = $null
        if ($response.Content) {
            try {
                if ($ConvertFromJsonSupportsDepth) {
                    $parsed = $response.Content | ConvertFrom-Json -Depth 20
                } else {
                    $parsed = $response.Content | ConvertFrom-Json
                }
            } catch { $parsed = $response.Content }
        }
        return @{ success = $true; statusCode = [int]$response.StatusCode; data = $parsed; raw = $response.Content }
    } catch {
        $statusCode = 0
        try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        $errorBody = Get-ErrorBody $_.Exception
        Write-Host "  [ERROR] $Label - HTTP $statusCode : $errorBody" -ForegroundColor Red
        return @{ success = $false; statusCode = $statusCode; data = $null; raw = $errorBody }
    }
}

function Expect-Status {
    param(
        [hashtable]$Result,
        [int[]]$AllowedStatusCodes,
        [string]$PassMessage,
        [string]$FailMessage
    )
    if ($AllowedStatusCodes -contains [int]$Result.statusCode) {
        Write-Pass $PassMessage
        return $true
    }
    Write-Fail "$FailMessage (status=$($Result.statusCode))"
    return $false
}

function Login-User {
    param(
        [string]$BaseUrl,
        [string]$Email,
        [string]$Password,
        [hashtable]$ExtraHeaders = @{},
        [string]$Label = "Login"
    )
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/auth/login" -Headers $ExtraHeaders -Body @{ email = $Email; password = $Password } -Label $Label
}

function Get-AuthHeaders {
    param([string]$Token)
    return @{ Authorization = "Bearer $Token" }
}

function Wait-HttpHealthy {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 25
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $probe = Invoke-JsonRequest -Method GET -Uri $Uri -Label "HealthProbe"
        if ($probe.success -and $probe.statusCode -eq 200) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Ensure-IpRestrictionInstance {
    param([string]$HealthUri)

    $probe = Invoke-JsonRequest -Method GET -Uri $HealthUri -Label "HealthIpBootstrap"
    if ($probe.success -and $probe.statusCode -eq 200) {
        return $false
    }

    $listener = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        try {
            $procId = $listener.OwningProcess
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$procId"
            if ($proc -and $proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'dist/main') {
                Stop-Process -Id $procId -Force
                Start-Sleep -Seconds 2
            }
        } catch {}
    }

    $mongoUri =
        if ($env:AUTH_HARDENING_MONGODB_URI) { $env:AUTH_HARDENING_MONGODB_URI }
        elseif ($env:MONGODB_URI) { $env:MONGODB_URI }
        else { 'mongodb://127.0.0.1:27017/htxbachgia' }

    New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
    $outLog = Join-Path $ArtifactsDir 'tmp-auth-hardening-inline-3100.out.log'
    $errLog = Join-Path $ArtifactsDir 'tmp-auth-hardening-inline-3100.err.log'
    if (Test-Path $outLog) { Remove-Item $outLog -Force }
    if (Test-Path $errLog) { Remove-Item $errLog -Force }

    $cmd = "set ""PORT=3100"" && set ""MONGODB_URI=$mongoUri"" && set ""PLAN_TYPE=enterprise"" && set ""AUTH_ENABLE_IP_RESTRICTION=true"" && node dist/main"
    $proc = Start-Process cmd.exe -ArgumentList '/c', $cmd -WorkingDirectory $BackendDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    $script:StartedIpBackend = $true
    $script:StartedIpBackendWrapperPid = $proc.Id
    $script:StartedIpBackendPid = $proc.Id
    Write-Info "Started dedicated IP restriction backend on PID $($proc.Id)"

    if (Wait-HttpHealthy -Uri $HealthUri -TimeoutSeconds 30) {
        $listener = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener -and $listener.OwningProcess) {
            $script:StartedIpBackendPid = $listener.OwningProcess
            Write-Info "Detected dedicated IP restriction node PID $($listener.OwningProcess)"
        }
        return $true
    }

    Write-Info "IP restriction backend failed to become healthy. See: $outLog"
    return $true
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$script:StartedIpBackend = $false
$script:StartedIpBackendPid = $null
$script:StartedIpBackendWrapperPid = $null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$tempUserIds = New-Object System.Collections.Generic.List[string]

Write-Section "MODULE TEST: AUTH HARDENING - $ts"

Write-Step "0.1" "Health check - default auth instance"
$healthDefault = Invoke-JsonRequest -Method GET -Uri ($DefaultBaseUrl -replace '/api$','/health') -Label "HealthDefault"
if ($healthDefault.success -and $healthDefault.statusCode -eq 200) { Write-Pass "Default auth instance is healthy" } else { Write-Fail "Default auth instance is not healthy"; exit 1 }

Write-Step "0.2" "Health check - IP restriction auth instance"
$null = Ensure-IpRestrictionInstance -HealthUri ($IpBaseUrl -replace '/api$','/health')
$healthIp = Invoke-JsonRequest -Method GET -Uri ($IpBaseUrl -replace '/api$','/health') -Label "HealthIp"
if ($healthIp.success -and $healthIp.statusCode -eq 200) { Write-Pass "IP restriction auth instance is healthy" } else { Write-Fail "IP restriction auth instance is not healthy"; exit 1 }

Write-Step "0.3" "Login director on default instance"
$dirLogin = Login-User -BaseUrl $DefaultBaseUrl -Email "director@test.com" -Password "123456" -Label "DirectorLogin"
if (-not ($dirLogin.success -and $dirLogin.data.access_token)) {
    Write-Fail "Director login failed on default instance"
    exit 1
}
$dirToken = $dirLogin.data.access_token
$dirHeaders = Get-AuthHeaders -Token $dirToken
Write-Pass "Director login OK on default instance"

Write-Step "0.4" "Login director on IP restriction instance"
$dirLoginIp = Login-User -BaseUrl $IpBaseUrl -Email "director@test.com" -Password "123456" -Label "DirectorLoginIp"
if (-not ($dirLoginIp.success -and $dirLoginIp.data.access_token)) {
    Write-Fail "Director login failed on IP instance"
    exit 1
}
$dirIpHeaders = Get-AuthHeaders -Token $dirLoginIp.data.access_token
Write-Pass "Director login OK on IP restriction instance"

$registerEmail = "register.auth.$ts@test.com"
$registerPassword = "123456"
$inactiveEmail = "inactive.auth.$ts@test.com"
$inactivePassword = "123456"
$deleteEmail = "delete.auth.$ts@test.com"
$deletePassword = "123456"
$ipManagerEmail = "manager.ip.$ts@test.com"
$ipEmployeeEmail = "employee.ip.$ts@test.com"

Write-Section "PHASE 1: Register Validation And Duplicate Rules"

Write-Step "1.1" "Register valid user"
$registerOk = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = $registerEmail
    password = $registerPassword
    fullName = "Auth Register $ts"
    role = "employee"
    phone = "0933000001"
    address = "QA Register"
} -Label "RegisterValid"
if ($registerOk.success -and $registerOk.statusCode -eq 201 -and $registerOk.data._id) {
    $tempUserIds.Add([string]$registerOk.data._id)
    Write-Pass "Valid register created user $registerEmail"
} else {
    Write-Fail "Valid register failed"
}

Write-Step "1.2" "Duplicate email via register is rejected"
$registerDuplicate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = $registerEmail
    password = $registerPassword
    fullName = "Auth Register Duplicate $ts"
    role = "employee"
} -Label "RegisterDuplicate"
[void](Expect-Status -Result $registerDuplicate -AllowedStatusCodes @(401) -PassMessage "Duplicate register rejected" -FailMessage "Duplicate register should be rejected")

Write-Step "1.3" "Register rejects extra fields and privilege injection"
$registerExtra = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = "extra.auth.$ts@test.com"
    password = $registerPassword
    fullName = "Auth Register Extra $ts"
    role = "employee"
    isActive = $false
    allowedLoginIps = @("127.0.0.1")
} -Label "RegisterExtraFields"
[void](Expect-Status -Result $registerExtra -AllowedStatusCodes @(400) -PassMessage "Register extra-field injection rejected" -FailMessage "Register extra-field injection should fail validation")

Write-Step "1.4" "Register rejects invalid email"
$registerInvalidEmail = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = "invalid-email"
    password = $registerPassword
    fullName = "Invalid Email $ts"
    role = "employee"
} -Label "RegisterInvalidEmail"
[void](Expect-Status -Result $registerInvalidEmail -AllowedStatusCodes @(400) -PassMessage "Invalid email rejected" -FailMessage "Invalid email should fail validation")

Write-Step "1.5" "Register rejects short password"
$registerShortPassword = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = "shortpw.auth.$ts@test.com"
    password = "12345"
    fullName = "Short Password $ts"
    role = "employee"
} -Label "RegisterShortPassword"
[void](Expect-Status -Result $registerShortPassword -AllowedStatusCodes @(400) -PassMessage "Short password rejected" -FailMessage "Short password should fail validation")

Write-Step "1.6" "Register rejects invalid role"
$registerInvalidRole = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/register" -Body @{
    email = "invalidrole.auth.$ts@test.com"
    password = $registerPassword
    fullName = "Invalid Role $ts"
    role = "superadmin"
} -Label "RegisterInvalidRole"
[void](Expect-Status -Result $registerInvalidRole -AllowedStatusCodes @(400) -PassMessage "Invalid role rejected" -FailMessage "Invalid role should fail validation")

Write-Step "1.7" "Registered user can login"
$registeredLogin = Login-User -BaseUrl $DefaultBaseUrl -Email $registerEmail -Password $registerPassword -Label "RegisteredLogin"
if ($registeredLogin.success -and $registeredLogin.data.access_token) {
    $registeredToken = $registeredLogin.data.access_token
    Write-Pass "Registered user login OK"
} else {
    Write-Fail "Registered user login failed"
}

Write-Section "PHASE 2: Account State Hardening"

Write-Step "2.1" "Create inactive user via admin API"
$inactiveCreate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/users" -Headers $dirHeaders -Body @{
    fullName = "Inactive Auth $ts"
    email = $inactiveEmail
    password = $inactivePassword
    phone = "0933000002"
    role = "employee"
    isActive = $false
} -Label "CreateInactiveUser"
if ($inactiveCreate.success -and $inactiveCreate.data._id) {
    $tempUserIds.Add([string]$inactiveCreate.data._id)
    Write-Pass "Inactive user created"
} else {
    Write-Fail "Failed to create inactive user"
}

Write-Step "2.2" "Inactive user login is rejected"
$inactiveLogin = Login-User -BaseUrl $DefaultBaseUrl -Email $inactiveEmail -Password $inactivePassword -Label "InactiveLogin"
[void](Expect-Status -Result $inactiveLogin -AllowedStatusCodes @(401) -PassMessage "Inactive login rejected" -FailMessage "Inactive user should not login")

Write-Step "2.3" "Deleted user login is rejected"
$deleteCreate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/users" -Headers $dirHeaders -Body @{
    fullName = "Delete Auth $ts"
    email = $deleteEmail
    password = $deletePassword
    phone = "0933000003"
    role = "employee"
    isActive = $true
} -Label "CreateDeleteUser"
if ($deleteCreate.success -and $deleteCreate.data._id) {
    $deleteUserId = [string]$deleteCreate.data._id
    $deleteRemoved = Invoke-JsonRequest -Method DELETE -Uri "$DefaultBaseUrl/users/$deleteUserId" -Headers $dirHeaders -Label "DeleteTempUser"
    if ($deleteRemoved.success -and ($deleteRemoved.statusCode -eq 200 -or $deleteRemoved.statusCode -eq 204)) {
        Write-Pass "Temporary deletable user removed"
        $deletedUserLogin = Login-User -BaseUrl $DefaultBaseUrl -Email $deleteEmail -Password $deletePassword -Label "DeletedUserLogin"
        [void](Expect-Status -Result $deletedUserLogin -AllowedStatusCodes @(401) -PassMessage "Deleted user login rejected" -FailMessage "Deleted user should not login")
    } else {
        Write-Fail "Failed to delete temporary user before login check"
    }
} else {
    Write-Fail "Failed to create temporary deletable user"
}

Write-Section "PHASE 3: Token And Session Lifecycle"

Write-Step "3.1" "Header token grants protected access"
$profileByHeader = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/auth/profile" -Headers (Get-AuthHeaders -Token $registeredToken) -Label "ProfileByHeader"
if ($profileByHeader.success -and $profileByHeader.data.email -eq $registerEmail) {
    Write-Pass "Protected profile access by header token OK"
} else {
    Write-Fail "Header token should access profile"
}

Write-Step "3.2" "Query token grants protected access"
$profileByQuery = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/auth/profile?access_token=$registeredToken" -Label "ProfileByQuery"
if ($profileByQuery.success -and $profileByQuery.data.email -eq $registerEmail) {
    Write-Pass "Protected profile access by query token OK"
} else {
    Write-Fail "Query token should access profile"
}

Write-Step "3.3" "Session log exists after login"
$sessionBeforeLogout = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/session-logs/me" -Headers (Get-AuthHeaders -Token $registeredToken) -Label "SessionBeforeLogout"
if ($sessionBeforeLogout.success -and @($sessionBeforeLogout.data).Count -ge 1) {
    Write-Pass "Session log present after login"
} else {
    Write-Fail "Session log should exist after login"
}

Write-Step "3.4" "Auth logout succeeds"
$logoutRegistered = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/logout" -Headers (Get-AuthHeaders -Token $registeredToken) -Label "AuthLogout"
if ($logoutRegistered.success -and $logoutRegistered.statusCode -eq 201) {
    Write-Pass "Auth logout OK"
} else {
    Write-Fail "Auth logout failed"
}

Write-Step "3.5" "Old token is rejected after logout"
$profileAfterLogout = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/auth/profile" -Headers (Get-AuthHeaders -Token $registeredToken) -Label "ProfileAfterLogout"
[void](Expect-Status -Result $profileAfterLogout -AllowedStatusCodes @(401) -PassMessage "Old token rejected after logout" -FailMessage "Old token should be rejected after logout")

Write-Step "3.6" "Repeated auth/logout with revoked token is rejected"
$logoutAgain = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/logout" -Headers (Get-AuthHeaders -Token $registeredToken) -Label "AuthLogoutAgain"
[void](Expect-Status -Result $logoutAgain -AllowedStatusCodes @(401) -PassMessage "Repeated logout with revoked token rejected" -FailMessage "Repeated logout with revoked token should be rejected")

Write-Step "3.7" "Fresh login after logout returns usable token"
$registeredLogin2 = Login-User -BaseUrl $DefaultBaseUrl -Email $registerEmail -Password $registerPassword -Label "RegisteredLoginAfterLogout"
if ($registeredLogin2.success -and $registeredLogin2.data.access_token) {
    $registeredToken2 = $registeredLogin2.data.access_token
    $validateToken2 = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/auth/validate-token" -Headers (Get-AuthHeaders -Token $registeredToken2) -Label "ValidateFreshToken"
    if ($validateToken2.success -and $validateToken2.data.valid -eq $true) {
        Write-Pass "Fresh token after logout is valid"
    } else {
        Write-Fail "Fresh token after logout should validate"
    }
} else {
    Write-Fail "Fresh login after logout failed"
}

Write-Step "3.8" "Session-logs/logout closes session and remains safe"
$sessionLogout = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/session-logs/logout" -Headers (Get-AuthHeaders -Token $registeredToken2) -Label "SessionLogout"
if ($sessionLogout.success -and $sessionLogout.data.ok -eq $true) {
    Write-Pass "Session-logs/logout OK"
} else {
    Write-Fail "Session-logs/logout failed"
}
$sessionLogoutAgain = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/session-logs/logout" -Headers (Get-AuthHeaders -Token $registeredToken2) -Label "SessionLogoutAgain"
if ($sessionLogoutAgain.success -and $sessionLogoutAgain.data.ok -eq $true) {
    Write-Pass "Repeated session-logs/logout remains safe"
} else {
    Write-Fail "Repeated session-logs/logout should remain safe"
}

Write-Section "PHASE 4: IP Restriction Matrix"

Write-Step "4.1" "Regression manager without allowedLoginIps is blocked when IP restriction is enabled"
$managerNoIp = Login-User -BaseUrl $IpBaseUrl -Email "manager@test.com" -Password "123456" -Label "ManagerNoAllowedIp"
[void](Expect-Status -Result $managerNoIp -AllowedStatusCodes @(401) -PassMessage "Manager without allowedLoginIps is blocked" -FailMessage "Manager without allowedLoginIps should be blocked when IP restriction is enabled")

Write-Step "4.2" "Create dedicated manager and employee for IP tests"
$ipManagerCreate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/users" -Headers $dirHeaders -Body @{
    fullName = "IP Manager $ts"
    email = $ipManagerEmail
    password = "123456"
    phone = "0933000004"
    role = "manager"
    isActive = $true
    allowedLoginIps = @("127.0.0.1")
} -Label "CreateIpManager"
$ipEmployeeCreate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/users" -Headers $dirHeaders -Body @{
    fullName = "IP Employee $ts"
    email = $ipEmployeeEmail
    password = "123456"
    phone = "0933000005"
    role = "employee"
    isActive = $true
    allowedLoginIps = @("127.0.0.1")
} -Label "CreateIpEmployee"
if ($ipManagerCreate.success -and $ipManagerCreate.data._id -and $ipEmployeeCreate.success -and $ipEmployeeCreate.data._id) {
    $tempUserIds.Add([string]$ipManagerCreate.data._id)
    $tempUserIds.Add([string]$ipEmployeeCreate.data._id)
    Write-Pass "IP test users created"
} else {
    Write-Fail "Failed to create IP test users"
}

Write-Step "4.3" "IP restriction allows localhost manager login"
$ipManagerAllowed = Login-User -BaseUrl $IpBaseUrl -Email $ipManagerEmail -Password "123456" -Label "IpManagerAllowed"
if ($ipManagerAllowed.success -and $ipManagerAllowed.data.access_token) {
    Write-Pass "Allowed IP manager login succeeded"
} else {
    Write-Fail "Allowed IP manager login should succeed"
}

Write-Step "4.4" "IP restriction rejects disallowed forwarded IP"
$ipManagerRejected = Login-User -BaseUrl $IpBaseUrl -Email $ipManagerEmail -Password "123456" -ExtraHeaders @{ "x-forwarded-for" = "203.0.113.10" } -Label "IpManagerRejected"
[void](Expect-Status -Result $ipManagerRejected -AllowedStatusCodes @(401) -PassMessage "Disallowed forwarded IP rejected" -FailMessage "Disallowed forwarded IP should be rejected")

Write-Step "4.5" "X-Forwarded-For chain accepts later allowed IP"
$ipManagerChainAllowed = Login-User -BaseUrl $IpBaseUrl -Email $ipManagerEmail -Password "123456" -ExtraHeaders @{ "x-forwarded-for" = "203.0.113.10, 127.0.0.1" } -Label "IpManagerChainAllowed"
if ($ipManagerChainAllowed.success -and $ipManagerChainAllowed.data.access_token) {
    Write-Pass "Forwarded IP chain with allowed hop succeeded"
} else {
    Write-Fail "Forwarded IP chain with allowed hop should succeed"
}

Write-Step "4.6" "IPv4-mapped IPv6 address is normalized"
$ipEmployeeIpv6Mapped = Login-User -BaseUrl $IpBaseUrl -Email $ipEmployeeEmail -Password "123456" -ExtraHeaders @{ "x-forwarded-for" = "::ffff:127.0.0.1" } -Label "IpEmployeeIpv6Mapped"
if ($ipEmployeeIpv6Mapped.success -and $ipEmployeeIpv6Mapped.data.access_token) {
    Write-Pass "IPv4-mapped IPv6 login succeeded"
} else {
    Write-Fail "IPv4-mapped IPv6 should be normalized and allowed"
}

Write-Step "4.7" "Director bypasses IP restriction by role design"
$directorBypass = Login-User -BaseUrl $IpBaseUrl -Email "director@test.com" -Password "123456" -ExtraHeaders @{ "x-forwarded-for" = "198.51.100.50" } -Label "DirectorBypass"
if ($directorBypass.success -and $directorBypass.data.access_token) {
    Write-Pass "Director bypasses IP restriction as expected"
} else {
    Write-Fail "Director should bypass IP restriction"
}

Write-Section "PHASE 5: Cleanup"

foreach ($userId in $tempUserIds) {
    $cleanup = Invoke-JsonRequest -Method DELETE -Uri "$DefaultBaseUrl/users/$userId" -Headers $dirHeaders -Label "CleanupUser"
    if ($cleanup.success -and ($cleanup.statusCode -eq 200 -or $cleanup.statusCode -eq 204)) {
        Write-Pass "Cleanup OK for user $userId"
    } else {
        Write-Fail "Cleanup failed for user $userId"
    }
}

if ($script:StartedIpBackend -and $script:StartedIpBackendPid) {
    try {
        Stop-Process -Id $script:StartedIpBackendPid -Force -ErrorAction Stop
        Write-Info "Stopped dedicated IP restriction backend PID $($script:StartedIpBackendPid)"
    } catch {
        Write-Info "Failed to stop dedicated IP restriction backend PID $($script:StartedIpBackendPid)"
    }
}
if ($script:StartedIpBackendWrapperPid -and $script:StartedIpBackendWrapperPid -ne $script:StartedIpBackendPid) {
    try {
        Stop-Process -Id $script:StartedIpBackendWrapperPid -Force -ErrorAction Stop
        Write-Info "Stopped dedicated IP restriction wrapper PID $($script:StartedIpBackendWrapperPid)"
    } catch {}
}

Write-Section "KET QUA - AUTH HARDENING MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}
if ($script:failCount -gt 0) { exit 1 }
