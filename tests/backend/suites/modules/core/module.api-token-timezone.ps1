#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.API-TOKEN-TIMEZONE.PS1
    =====================================================================================
    Target coverage:
    - BE-ADS-05: api-token permission boundaries, provider settings, lifecycle operations
    - BE-ADS-06: ad-account timezone matrix with strict/non-strict backend behavior
    =====================================================================================
#>

$ErrorActionPreference = "Continue"
$DefaultBaseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { "http://localhost:3000/api" }
$StrictBaseUrl = if ($env:API_TOKEN_TIMEZONE_STRICT_BASE_URL) { $env:API_TOKEN_TIMEZONE_STRICT_BASE_URL.TrimEnd('/') } else { "http://localhost:3610/api" }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ArtifactsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'

function Write-Section($title) { Write-Host ""; Write-Host ("=" * 90) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 90) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Blocked($msg) { Write-Host "  [BLOCKED] $msg" -ForegroundColor DarkYellow; $script:blockCount++; $script:blockDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

function Get-ErrorBody([object]$Exception) {
    try {
        if ($Exception.Response -and $Exception.Response.GetResponseStream) {
            return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
        }
    } catch {}
    return ""
}

function Convert-ResponseJson {
    param([string]$Text)
    if ($null -eq $Text) { return $null }
    $clean = $Text.Trim()
    if ($clean.StartsWith([char]0xFEFF)) { $clean = $clean.TrimStart([char]0xFEFF) }
    if (-not $clean) { return $null }
    try { return $clean | ConvertFrom-Json } catch { return $clean }
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
        $params = @{
            Method = $Method
            Uri = $Uri
            Headers = $Headers
            ContentType = "application/json; charset=utf-8"
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        if ($null -ne $Body -and $Method -ne "GET") {
            $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 12 }
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
        }
        $response = Invoke-WebRequest @params
        $parsed = Convert-ResponseJson -Text $response.Content
        return @{
            success = $true
            statusCode = [int]$response.StatusCode
            data = $parsed
            raw = $response.Content
        }
    } catch {
        $statusCode = 0
        try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        $errorBody = Get-ErrorBody $_.Exception
        Write-Host "  [ERROR] $Label - HTTP $statusCode : $errorBody" -ForegroundColor Red
        return @{
            success = $false
            statusCode = $statusCode
            data = $null
            raw = $errorBody
        }
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
    param([string]$BaseUrl, [string]$Email, [string]$Password, [string]$Label = "Login")
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/auth/login" -Body @{ email = $Email; password = $Password } -Label $Label
}

function Get-AuthHeaders {
    param([string]$Token)
    return @{ Authorization = "Bearer $Token" }
}

function Wait-Healthy {
    param([string]$Uri, [int]$TimeoutSeconds = 35)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $probe = Invoke-JsonRequest -Method GET -Uri $Uri -Label "HealthProbe"
        if ($probe.success -and $probe.statusCode -eq 200) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Ensure-StrictBackend {
    param([string]$HealthUri)

    $probe = Invoke-JsonRequest -Method GET -Uri $HealthUri -Label "StrictHealthProbe"
    if ($probe.success -and $probe.statusCode -eq 200) {
        return $false
    }

    $listener = Get-NetTCPConnection -LocalPort 3610 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        try {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
            if ($proc -and $proc.Name -eq 'node.exe' -and $proc.CommandLine -match 'dist/main') {
                Stop-Process -Id $listener.OwningProcess -Force
                Start-Sleep -Seconds 2
            }
        } catch {}
    }

    $mongoUri =
        if ($env:API_TOKEN_TIMEZONE_MONGODB_URI) { $env:API_TOKEN_TIMEZONE_MONGODB_URI }
        elseif ($env:MONGODB_URI) { $env:MONGODB_URI }
        else { 'mongodb://127.0.0.1:27017/htxbachgia' }

    New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
    $outLog = Join-Path $ArtifactsDir 'tmp-api-token-timezone-3610.out.log'
    $errLog = Join-Path $ArtifactsDir 'tmp-api-token-timezone-3610.err.log'
    if (Test-Path $outLog) { Remove-Item $outLog -Force }
    if (Test-Path $errLog) { Remove-Item $errLog -Force }

    $cmd = "set ""PORT=3610"" && set ""MONGODB_URI=$mongoUri"" && set ""PLAN_TYPE=enterprise"" && set ""ENFORCE_AD_ACCOUNT_TIMEZONE=true"" && node dist/main"
    $proc = Start-Process cmd.exe -ArgumentList '/c', $cmd -WorkingDirectory $BackendDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    $script:StrictWrapperPid = $proc.Id
    $script:StrictStarted = $true
    Write-Info "Started strict backend wrapper PID $($proc.Id)"

    if (Wait-Healthy -Uri $HealthUri -TimeoutSeconds 40) {
        $listener = Get-NetTCPConnection -LocalPort 3610 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            $script:StrictNodePid = $listener.OwningProcess
            Write-Info "Detected strict node PID $($listener.OwningProcess)"
        }
        return $true
    }

    return $true
}

function Stop-StrictBackend {
    if ($script:StrictNodePid) {
        try { Stop-Process -Id $script:StrictNodePid -Force -ErrorAction SilentlyContinue } catch {}
    }
    if ($script:StrictWrapperPid) {
        try { Stop-Process -Id $script:StrictWrapperPid -Force -ErrorAction SilentlyContinue } catch {}
    }
}

function New-UniqueEmail {
    param([string]$Prefix)
    return "$Prefix.$(Get-Date -Format 'yyyyMMdd.HHmmss')@test.com"
}

function New-TestFanpage {
    param([hashtable]$Headers, [string]$LabelPrefix)
    $ts = Get-Date -Format 'HHmmss'
    $body = @{
        pageId = "page_${LabelPrefix}_$ts"
        name = "QA $LabelPrefix Fanpage $ts"
        accessToken = "EAAtoken_$LabelPrefix_$ts"
        status = "active"
        description = "Created by api-token-timezone suite"
    }
    $res = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/fanpages" -Headers $Headers -Body $body -Label "CreateFanpage"
    if ($res.success -and $res.data -and ($res.data._id -or $res.data.id)) {
        return $res.data
    }
    return $null
}

$script:passCount = 0
$script:failCount = 0
$script:blockCount = 0
$script:failDetails = @()
$script:blockDetails = @()
$script:StrictStarted = $false
$script:StrictWrapperPid = $null
$script:StrictNodePid = $null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$tempIds = New-Object System.Collections.Generic.List[string]
$tempFanpageIds = New-Object System.Collections.Generic.List[string]
$tempAdAccountIds = New-Object System.Collections.Generic.List[string]
$tempTokenIds = New-Object System.Collections.Generic.List[string]

Write-Section "MODULE TEST: API TOKEN + TIMEZONE MATRIX - $ts"

try {
    Write-Section "PHASE 0: Login and base contracts"
    Write-Step "0.1" "Login director / manager / employee"
    $dirLogin = Login-User -BaseUrl $DefaultBaseUrl -Email "director@test.com" -Password "123456" -Label "DirectorLogin"
    $manLogin = Login-User -BaseUrl $DefaultBaseUrl -Email "manager@test.com" -Password "123456" -Label "ManagerLogin"
    $empLogin = Login-User -BaseUrl $DefaultBaseUrl -Email "employee@test.com" -Password "123456" -Label "EmployeeLogin"
    if (-not ($dirLogin.success -and $dirLogin.data.access_token)) { Write-Fail "Director login failed"; throw "director-login" }
    if (-not ($manLogin.success -and $manLogin.data.access_token)) { Write-Fail "Manager login failed"; throw "manager-login" }
    if (-not ($empLogin.success -and $empLogin.data.access_token)) { Write-Fail "Employee login failed"; throw "employee-login" }
    $dirHeaders = Get-AuthHeaders -Token $dirLogin.data.access_token
    $manHeaders = Get-AuthHeaders -Token $manLogin.data.access_token
    $empHeaders = Get-AuthHeaders -Token $empLogin.data.access_token
    Write-Pass "Logged in director, manager, employee"

    Write-Step "0.2" "Permission boundary - api-tokens/settings"
    $settingsEmployee = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/settings" -Headers $empHeaders -Label "SettingsEmployee"
    [void](Expect-Status -Result $settingsEmployee -AllowedStatusCodes @(401,403) -PassMessage "Employee blocked from api-tokens/settings" -FailMessage "Employee should be blocked from api-tokens/settings")
    $settingsManager = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/settings" -Headers $manHeaders -Label "SettingsManager"
    if ($settingsManager.success -and $settingsManager.statusCode -eq 200) { Write-Pass "Manager can read api-tokens/settings" } else { Write-Fail "Manager should read api-tokens/settings" }
    $settingsDirector = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/settings" -Headers $dirHeaders -Label "SettingsDirector"
    if ($settingsDirector.success -and $settingsDirector.statusCode -eq 200) { Write-Pass "Director can read api-tokens/settings" } else { Write-Fail "Director should read api-tokens/settings" }

    Write-Step "0.3" "Permission boundary - ad-accounts"
    $adEmployee = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/ad-accounts" -Headers $empHeaders -Label "AdAccountsEmployee"
    [void](Expect-Status -Result $adEmployee -AllowedStatusCodes @(401,403) -PassMessage "Employee blocked from ad-accounts" -FailMessage "Employee should be blocked from ad-accounts")
    $adDirector = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/ad-accounts" -Headers $dirHeaders -Label "AdAccountsDirector"
    if ($adDirector.success -and $adDirector.statusCode -eq 200) { Write-Pass "Director can read ad-accounts" } else { Write-Fail "Director should read ad-accounts" }

    Write-Section "PHASE 1: API token settings and lifecycle"
    Write-Step "1.1" "Baseline settings"
    if ($settingsDirector.success -and $settingsDirector.data) {
        Write-Pass "GET /api-tokens/settings returned payload"
    } else {
        Write-Fail "GET /api-tokens/settings baseline failed"
    }

    Write-Step "1.2" "POST google settings then GET settings reflects masked DB source"
    $googleSettings = @{
        clientId = "google-client-$ts.apps.googleusercontent.com"
        clientSecret = "google-secret-$ts"
        refreshToken = "1//refresh-token-$ts"
        developerToken = "dev-token-$ts"
        loginCustomerId = "123-456-7890"
        apiVersion = "v15"
    }
    $googleSave = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/settings/google" -Headers $dirHeaders -Body $googleSettings -Label "SaveGoogleSettings"
    if ($googleSave.success -and $googleSave.data.ok -eq $true) {
        Write-Pass "Saved Google settings"
    } else {
        Write-Fail "Saving Google settings failed"
    }
    $googleRead = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/settings" -Headers $dirHeaders -Label "ReadGoogleSettings"
    if ($googleRead.success -and $googleRead.data.google.configSource -eq 'database' -and $googleRead.data.google.refreshTokenSource -eq 'database') {
        if ($googleRead.data.google.clientId -like 'google-client-*' -and $googleRead.data.google.developerToken -like 'dev-token-*') {
            Write-Pass "Google settings reflected masked database source"
        } else {
            Write-Fail "Google settings masking mismatch"
        }
    } else {
        Write-Fail "Google settings source should be database"
    }

    Write-Step "1.3" "POST google test endpoint with fake creds returns handled failure"
    $googleTest = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/test/google" -Headers $dirHeaders -Body @{
        clientId = "fake-client-$ts"
        clientSecret = "fake-secret-$ts"
        refreshToken = "fake-refresh-$ts"
        developerToken = "fake-dev-$ts"
        customerId = "1234567890"
    } -Label "TestGoogle"
    if ($googleTest.success -and $googleTest.data -and $googleTest.data.ok -eq $false) {
        Write-Pass "Google test returned handled failure payload"
    } else {
        Write-Fail "Google test should return handled failure payload"
    }

    Write-Step "1.4" "POST TikTok settings without access token returns handled failure"
    $tiktokSave = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/settings/tiktok" -Headers $dirHeaders -Body @{
        appId = "tiktok-app-$ts"
        appSecret = "tiktok-secret-$ts"
        advertiserIds = @('1234567890')
    } -Label "SaveTikTokSettings"
    if ($tiktokSave.success -and $tiktokSave.data -and $tiktokSave.data.ok -eq $false) {
        Write-Pass "TikTok settings without access token returned handled failure"
    } else {
        Write-Fail "TikTok settings without access token should fail gracefully"
    }

    Write-Step "1.5" "POST TikTok test without access token returns handled failure"
    $tiktokTest = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/test/tiktok" -Headers $dirHeaders -Body @{
        advertiserId = "1234567890"
    } -Label "TestTikTok"
    if ($tiktokTest.success -and $tiktokTest.data -and $tiktokTest.data.ok -eq $false) {
        Write-Pass "TikTok test without access token returned handled failure"
    } else {
        Write-Fail "TikTok test without access token should fail gracefully"
    }

    Write-Step "1.6" "Create fanpage and sync one Facebook token"
    $fanpage = New-TestFanpage -Headers $dirHeaders -LabelPrefix 'sync'
    if (-not $fanpage) { Write-Fail "Failed to create fanpage for sync" } else {
        $fanpageId = if ($fanpage._id) { [string]$fanpage._id } else { [string]$fanpage.id }
        $tempFanpageIds.Add($fanpageId)
        $sync = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/sync/from-fanpages" -Headers $dirHeaders -Label "SyncFromFanpages"
        if ($sync.success -and $sync.data -and [int]$sync.data.imported -ge 1) {
            foreach ($item in @($sync.data.items)) {
                $itemId = if ($item._id) { [string]$item._id } elseif ($item.id) { [string]$item.id } else { "" }
                if ($itemId) { $tempTokenIds.Add($itemId) }
            }
            Write-Pass "Sync from fanpages imported at least 1 token"
        } else {
            Write-Fail "Sync from fanpages should import 1 token"
        }
    }

    Write-Step "1.7" "Set primary flips deterministically across two tokens on same fanpage"
    if ($fanpageId) {
        $fpToken1 = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens" -Headers $dirHeaders -Body @{
            name = "Primary Token A $ts"
            token = "EAAtoken-primary-a-$ts"
            provider = "facebook"
            fanpageId = $fanpageId
            status = "active"
        } -Label "CreateTokenA"
        $fpToken2 = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens" -Headers $dirHeaders -Body @{
            name = "Primary Token B $ts"
            token = "EAAtoken-primary-b-$ts"
            provider = "facebook"
            fanpageId = $fanpageId
            status = "active"
        } -Label "CreateTokenB"
        $tokenAId = if ($fpToken1.success -and $fpToken1.data) { if ($fpToken1.data._id) { [string]$fpToken1.data._id } else { [string]$fpToken1.data.id } } else { "" }
        $tokenBId = if ($fpToken2.success -and $fpToken2.data) { if ($fpToken2.data._id) { [string]$fpToken2.data._id } else { [string]$fpToken2.data.id } } else { "" }
        if ($tokenAId) { $tempTokenIds.Add($tokenAId) }
        if ($tokenBId) { $tempTokenIds.Add($tokenBId) }
        if ($tokenAId -and $tokenBId) {
            $spA = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/$tokenAId/set-primary" -Headers $dirHeaders -Body @{ fanpageId = $fanpageId } -Label "SetPrimaryA"
            $spB = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/$tokenBId/set-primary" -Headers $dirHeaders -Body @{ fanpageId = $fanpageId } -Label "SetPrimaryB"
            $tokA = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/$tokenAId" -Headers $dirHeaders -Label "GetTokenA"
            $tokB = Invoke-JsonRequest -Method GET -Uri "$DefaultBaseUrl/api-tokens/$tokenBId" -Headers $dirHeaders -Label "GetTokenB"
            if ($spA.success -and $spB.success -and $tokA.data.isPrimary -eq $false -and $tokB.data.isPrimary -eq $true) {
                Write-Pass "Primary token flip is deterministic"
            } else {
                Write-Fail "Primary token flip should leave only the last token primary"
            }
        } else {
            Write-Fail "Unable to create both tokens for primary test"
        }
    }

    Write-Step "1.8" "Rotate Google token creates linked fresh token"
    $googleToken = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens" -Headers $dirHeaders -Body @{
        name = "Google Rotate $ts"
        token = "1//google-refresh-$ts"
        provider = "google"
        status = "active"
    } -Label "CreateGoogleToken"
        $googleTokenId = if ($googleToken.success -and $googleToken.data) { if ($googleToken.data._id) { [string]$googleToken.data._id } else { [string]$googleToken.data.id } } else { "" }
    if ($googleTokenId) {
        $tempTokenIds.Add($googleTokenId)
        $rot = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/$googleTokenId/rotate" -Headers $dirHeaders -Body @{ newToken = "1//google-refresh-rotated-$ts"; notes = "rotated by qa" } -Label "RotateGoogle"
        if ($rot.success -and $rot.data -and $rot.data.old -and $rot.data.fresh -and $rot.data.old.rotatedTo -and $rot.data.fresh.rotatedFrom) {
            Write-Pass "Google token rotation linked rotatedFrom/rotatedTo"
            $freshRotatedId = if ($rot.data.fresh._id) { [string]$rot.data.fresh._id } else { [string]$rot.data.fresh.id }
            $tempTokenIds.Add($freshRotatedId)
        } else {
            Write-Fail "Google token rotation should return linked old/fresh documents"
        }
    } else {
        Write-Fail "Failed to create Google token for rotation"
    }

    Write-Step "1.9" "Validate deterministic Google refresh token format updates status"
    if ($googleTokenId) {
        $validate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/api-tokens/$googleTokenId/validate" -Headers $dirHeaders -Body @{ force = $true } -Label "ValidateGoogle"
        if ($validate.success -and $validate.data -and $validate.data.lastCheckStatus) {
            Write-Pass "Google validate updated lastCheckStatus"
        } else {
            Write-Fail "Google validate should update lastCheckStatus"
        }
    }

    Write-Step "1.10" "Cleanup api-token fixtures and fanpages"
    foreach ($id in @($tempTokenIds)) {
        if ($id) { Invoke-JsonRequest -Method DELETE -Uri "$DefaultBaseUrl/api-tokens/$id" -Headers $dirHeaders -Label "DeleteToken" | Out-Null }
    }
    foreach ($id in @($tempFanpageIds)) {
        if ($id) { Invoke-JsonRequest -Method DELETE -Uri "$DefaultBaseUrl/fanpages/$id" -Headers $dirHeaders -Label "DeleteFanpage" | Out-Null }
    }
    Write-Pass "Token/fanpage cleanup completed"

    Write-Section "PHASE 2: Strict timezone matrix"
    Write-Step "2.1" "Boot strict backend if needed"
    $strictHealthUri = ($StrictBaseUrl -replace '/api$','/health')
    $strictBootstrapped = Ensure-StrictBackend -HealthUri $strictHealthUri
    $strictHealth = Invoke-JsonRequest -Method GET -Uri $strictHealthUri -Label "StrictHealth"
    if ($strictHealth.success -and $strictHealth.statusCode -eq 200) {
        Write-Pass "Strict backend is healthy"
    } elseif ($strictBootstrapped) {
        Write-Blocked "Strict backend failed to become healthy"
    } else {
        Write-Fail "Strict backend is not healthy"
    }

    Write-Step "2.2" "Strict instance blocks provider lookup unavailable"
    if ($strictHealth.success -and $strictHealth.statusCode -eq 200) {
        $strictDir = Login-User -BaseUrl $StrictBaseUrl -Email "director@test.com" -Password "123456" -Label "StrictDirectorLogin"
        if ($strictDir.success -and $strictDir.data.access_token) {
            $strictHeaders = Get-AuthHeaders -Token $strictDir.data.access_token
            $blockFb = Invoke-JsonRequest -Method POST -Uri "$StrictBaseUrl/ad-accounts" -Headers $strictHeaders -Body @{
                name = "Strict FB $ts"
                accountId = "act_1234567890"
                accountType = "facebook"
                isActive = $true
            } -Label "StrictCreateFacebook"
            $blockGoogle = Invoke-JsonRequest -Method POST -Uri "$StrictBaseUrl/ad-accounts" -Headers $strictHeaders -Body @{
                name = "Strict Google $ts"
                accountId = "1234567890"
                accountType = "google"
                loginCustomerId = "1234567890"
                isActive = $true
            } -Label "StrictCreateGoogle"
            $blockTikTok = Invoke-JsonRequest -Method POST -Uri "$StrictBaseUrl/ad-accounts" -Headers $strictHeaders -Body @{
                name = "Strict TikTok $ts"
                accountId = "1234567890"
                accountType = "tiktok"
                businessCenterId = "1234567890"
                isActive = $true
            } -Label "StrictCreateTikTok"
            if (($blockFb.statusCode -eq 400) -and ($blockGoogle.statusCode -eq 400) -and ($blockTikTok.statusCode -eq 400)) {
                Write-Pass "Strict instance blocked unavailable provider lookups"
            } else {
                Write-Fail "Strict instance should block facebook/google/tiktok creation when lookup unavailable"
            }
        } else {
            Write-Blocked "Could not login director on strict instance"
        }
    }

    Write-Step "2.3" "Strict instance blocks PATCH bypass from non-validated type to provider-backed type"
    if ($strictHealth.success -and $strictHealth.statusCode -eq 200 -and $strictDir -and $strictDir.data.access_token) {
        $strictHeaders = Get-AuthHeaders -Token $strictDir.data.access_token
        $strictBaseCreate = Invoke-JsonRequest -Method POST -Uri "$StrictBaseUrl/ad-accounts" -Headers $strictHeaders -Body @{
            name = "Strict Base $ts"
            accountId = "base_$ts"
            accountType = "zalo"
            isActive = $true
        } -Label "StrictCreateBaseAccount"
        $strictBaseId = if ($strictBaseCreate.success -and $strictBaseCreate.data) { if ($strictBaseCreate.data._id) { [string]$strictBaseCreate.data._id } else { [string]$strictBaseCreate.data.id } } else { "" }
        if ($strictBaseId) {
            $tempAdAccountIds.Add($strictBaseId)
            $patchFb = Invoke-JsonRequest -Method PATCH -Uri "$StrictBaseUrl/ad-accounts/$strictBaseId" -Headers $strictHeaders -Body @{
                accountType = "facebook"
                accountId = "act_9999999999"
            } -Label "StrictPatchFacebook"
            if ($patchFb.statusCode -eq 400) {
                Write-Pass "Strict PATCH bypass blocked"
            } else {
                Write-Fail "Strict PATCH bypass should be blocked"
            }
        } else {
            Write-Blocked "Could not create base ad account for strict PATCH test"
        }
    }

    Write-Step "2.4" "Non-strict instance allows create path when lookup is unavailable"
    $defaultDir = $dirHeaders
    $nonStrictCreate = Invoke-JsonRequest -Method POST -Uri "$DefaultBaseUrl/ad-accounts" -Headers $defaultDir -Body @{
        name = "Default FB $ts"
        accountId = "act_7777777777"
        accountType = "facebook"
        isActive = $true
    } -Label "DefaultCreateFacebook"
    if ($nonStrictCreate.statusCode -eq 201 -or $nonStrictCreate.statusCode -eq 200) {
        Write-Pass "Non-strict create path allowed when lookup unavailable"
        $defaultAdId = if ($nonStrictCreate.data) { if ($nonStrictCreate.data._id) { [string]$nonStrictCreate.data._id } else { [string]$nonStrictCreate.data.id } } else { "" }
        if ($defaultAdId) { $tempAdAccountIds.Add($defaultAdId) }
    } else {
        Write-Fail "Non-strict create path should be allowed when lookup unavailable"
    }

    Write-Step "2.5" "Cleanup ad-account fixtures"
    foreach ($id in @($tempAdAccountIds)) {
        if ($id) { Invoke-JsonRequest -Method DELETE -Uri "$DefaultBaseUrl/ad-accounts/$id" -Headers $dirHeaders -Label "DeleteAdAccount" | Out-Null }
    }
    Write-Pass "Ad-account cleanup completed"
}
catch {
    Write-Fail "Suite aborted: $($_.Exception.Message)"
}
finally {
    Stop-StrictBackend
}

Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount + $script:blockCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" }) -NoNewline
Write-Host " | " -NoNewline
Write-Host "BLOCKED: $($script:blockCount)" -ForegroundColor $(if ($script:blockCount -gt 0) { "DarkYellow" } else { "Green" })
if ($script:failCount -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
if ($script:blockCount -gt 0) {
    Write-Host "`nBlocked tests:" -ForegroundColor DarkYellow
    $script:blockDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor DarkYellow }
}
exit ($script:failCount + $script:blockCount)
