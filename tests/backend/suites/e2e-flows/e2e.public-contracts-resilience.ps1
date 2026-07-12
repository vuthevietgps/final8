#!/usr/bin/env pwsh
$ErrorActionPreference = "Continue"

# REGION: HEADER
<#
    =====================================================================================
    E2E.PUBLIC-CONTRACTS-RESILIENCE.PS1
    =====================================================================================
    Covers:
    - BE-SMOKE-03
    - BE-MEDIA-03
    - BE-CHAT-03
    - BE-PUB-01
    - BE-PUB-02
    - BE-PUB-03
    - BE-PUB-04
    =====================================================================================
#>
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ArtifactsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
$SetupScript = Join-Path $RepoRoot 'tests\backend\setup\ensure-regression-users.ps1'
$ConvertFromJsonSupportsDepth = (Get-Command ConvertFrom-Json).Parameters.ContainsKey('Depth')

$script:passCount = 0
$script:failCount = 0
$script:skipCount = 0
$script:failDetails = @()
$script:cleanupFiles = New-Object System.Collections.Generic.List[string]
$script:startedBackends = New-Object System.Collections.Generic.List[object]
$script:tempIds = @{
    fanpageId = $null
    categoryId = $null
    productId = $null
    openAiConfigId = $null
    statementId = $null
}

# REGION: HELPERS
function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 90) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 90) -ForegroundColor Cyan
}

function Write-Step($step, $desc) {
    Write-Host ""
    Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow
}

function Write-Pass($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passCount++
}

function Write-Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failCount++
    $script:failDetails += $msg
}

function Write-Skip($msg) {
    Write-Host "  [SKIP] $msg" -ForegroundColor Yellow
    $script:skipCount++
}

function Write-Info($msg) {
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Get-ErrorBody([object]$Exception) {
    try {
        if ($Exception.Response -and $Exception.Response.GetResponseStream) {
            return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
        }
    } catch {}
    return ""
}

function Convert-ResponseContent {
    param([string]$Content)
    if ([string]::IsNullOrWhiteSpace($Content)) {
        return $null
    }

    try {
        if ($ConvertFromJsonSupportsDepth) {
            return $Content | ConvertFrom-Json -Depth 30
        }
        return $Content | ConvertFrom-Json
    } catch {
        return $Content
    }
}

function Invoke-HttpRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$ContentType = $null,
        [string]$Label = ""
    )

    try {
        $params = @{
            Method          = $Method
            Uri             = $Uri
            Headers         = $Headers
            ErrorAction     = 'Stop'
            UseBasicParsing = $true
        }

        if ($ContentType) {
            $params['ContentType'] = $ContentType
        }

        if ($null -ne $Body -and $Method -ne 'GET') {
            if ($Body -is [byte[]]) {
                $params['Body'] = $Body
            } else {
                $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 }
                $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
                if (-not $ContentType) {
                    $params['ContentType'] = 'application/json; charset=utf-8'
                }
            }
        }

        $response = Invoke-WebRequest @params
        return @{
            success     = $true
            statusCode  = [int]$response.StatusCode
            raw         = $response.Content
            data        = Convert-ResponseContent -Content $response.Content
            headers     = $response.Headers
            contentType = [string]$response.Headers['Content-Type']
        }
    } catch {
        $statusCode = 0
        try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        $errorBody = Get-ErrorBody $_.Exception
        Write-Host "  [HTTP] $Label => $Method $Uri -> $statusCode" -ForegroundColor DarkYellow
        if ($errorBody) {
            Write-Host "         $errorBody" -ForegroundColor DarkYellow
        }
        return @{
            success     = $false
            statusCode  = $statusCode
            raw         = $errorBody
            data        = Convert-ResponseContent -Content $errorBody
            headers     = @{}
            contentType = ''
        }
    }
}

function Invoke-MultipartUpload {
    param(
        [string]$Uri,
        [hashtable]$Headers,
        [string]$FilePath,
        [string]$FieldName = 'file',
        [string]$FileContentType = 'image/png',
        [hashtable]$FormFields = @{},
        [string]$Label = ''
    )

    $responsePath = Join-Path ([System.IO.Path]::GetTempPath()) ("multipart-response-" + [guid]::NewGuid().ToString('N') + ".txt")
    $script:cleanupFiles.Add($responsePath)
    $args = @('-sS', '-o', $responsePath, '-w', 'HTTP_STATUS:%{http_code}', '-X', 'POST')

    foreach ($entry in $Headers.GetEnumerator()) {
        $args += @('-H', ("{0}: {1}" -f [string]$entry.Key, [string]$entry.Value))
    }
    foreach ($field in $FormFields.GetEnumerator()) {
        $args += @('-F', ("{0}={1}" -f [string]$field.Key, [string]$field.Value))
    }

    $args += @('-F', ("{0}=@{1};type={2}" -f $FieldName, $FilePath, $FileContentType))
    $args += $Uri

    $output = & curl.exe @args
    $statusCode = 0
    if ($output -match 'HTTP_STATUS:(\d{3})') {
        $statusCode = [int]$Matches[1]
    }
    $body = if (Test-Path -LiteralPath $responsePath) { Get-Content -LiteralPath $responsePath -Raw } else { '' }

    if ($statusCode -lt 200 -or $statusCode -ge 300) {
        Write-Host "  [HTTP] $Label => POST multipart $Uri -> $statusCode" -ForegroundColor DarkYellow
        if ($body) { Write-Host "         $body" -ForegroundColor DarkYellow }
    }

    return @{
        success     = ($statusCode -ge 200 -and $statusCode -lt 300)
        statusCode  = $statusCode
        raw         = $body
        data        = Convert-ResponseContent -Content $body
        headers     = @{}
        contentType = ''
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

function Assert-True {
    param(
        [bool]$Condition,
        [string]$PassMessage,
        [string]$FailMessage
    )

    if ($Condition) {
        Write-Pass $PassMessage
        return $true
    }

    Write-Fail $FailMessage
    return $false
}

function Assert-Equal {
    param(
        $Actual,
        $Expected,
        [string]$PassMessage,
        [string]$FailMessage
    )

    if ("$Actual" -eq "$Expected") {
        Write-Pass $PassMessage
        return $true
    }

    Write-Fail "$FailMessage (expected=$Expected actual=$Actual)"
    return $false
}

function Get-PropertyValue {
    param(
        [object]$Object,
        [string]$PropertyName
    )

    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$PropertyName]
    if ($prop) { return $prop.Value }
    return $null
}

function New-TempFile {
    param(
        [string]$RelativePath,
        [string]$Content
    )

    $path = Join-Path $RepoRoot $RelativePath
    $dir = Split-Path -Parent $path
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    [System.IO.File]::WriteAllText($path, $Content, [System.Text.UTF8Encoding]::new($false))
    $script:cleanupFiles.Add($path)
    return $path
}

function Get-BodyText {
    param($Value)

    if ($Value -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($Value)
    }
    return [string]$Value
}

function Wait-HttpHealthy {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $probe = Invoke-HttpRequest -Method GET -Uri $Uri -Label 'HealthProbe'
        if ($probe.success -and $probe.statusCode -eq 200) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Wait-LogContains {
    param(
        [string]$Path,
        [string]$Pattern,
        [int]$TimeoutSeconds = 10
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $Path) {
            $content = Get-Content -Path $Path -Raw -ErrorAction SilentlyContinue
            if ($content -match [regex]::Escape($Pattern)) {
                return $true
            }
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Start-BackendInstance {
    param(
        [string]$Name,
        [int]$Port,
        [string]$MongoUri,
        [string]$PublicOrigin = $null,
        [string]$AppPublicOrigin = $null,
        [string]$MessengerVerifyToken = $null,
        [string]$FbVerifyToken = $null,
        [string]$FbSendingEnabled = '0'
    )

    $outLog = Join-Path $ArtifactsDir ("tmp-$Name-$Port.out.log")
    $errLog = Join-Path $ArtifactsDir ("tmp-$Name-$Port.err.log")
    if (Test-Path $outLog) { Remove-Item $outLog -Force }
    if (Test-Path $errLog) { Remove-Item $errLog -Force }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        try { Stop-Process -Id $listener.OwningProcess -Force } catch {}
        Start-Sleep -Seconds 1
    }

    $envKeys = @(
        'PORT', 'MONGODB_URI', 'PLAN_TYPE', 'FB_SENDING_ENABLED',
        'PUBLIC_ORIGIN', 'APP_PUBLIC_ORIGIN', 'MESSENGER_VERIFY_TOKEN',
        'FB_VERIFY_TOKEN', 'NODE_ENV'
    )
    $snapshot = @{}
    foreach ($key in $envKeys) {
        $snapshot[$key] = (Get-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue).Value
    }

    try {
        $env:PORT = [string]$Port
        $env:MONGODB_URI = $MongoUri
        $env:PLAN_TYPE = 'enterprise'
        $env:FB_SENDING_ENABLED = $FbSendingEnabled
        $env:NODE_ENV = 'development'

        if ($PublicOrigin) { $env:PUBLIC_ORIGIN = $PublicOrigin } else { Remove-Item Env:PUBLIC_ORIGIN -ErrorAction SilentlyContinue }
        if ($AppPublicOrigin) { $env:APP_PUBLIC_ORIGIN = $AppPublicOrigin } else { Remove-Item Env:APP_PUBLIC_ORIGIN -ErrorAction SilentlyContinue }
        if ($MessengerVerifyToken) { $env:MESSENGER_VERIFY_TOKEN = $MessengerVerifyToken } else { Remove-Item Env:MESSENGER_VERIFY_TOKEN -ErrorAction SilentlyContinue }
        if ($FbVerifyToken) { $env:FB_VERIFY_TOKEN = $FbVerifyToken } else { Remove-Item Env:FB_VERIFY_TOKEN -ErrorAction SilentlyContinue }

        $proc = Start-Process node -ArgumentList 'dist/main' -WorkingDirectory $BackendDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    } finally {
        foreach ($key in $envKeys) {
            if ($null -ne $snapshot[$key] -and $snapshot[$key] -ne '') {
                Set-Item -Path ("Env:" + $key) -Value $snapshot[$key]
            } else {
                Remove-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue
            }
        }
    }

    $healthUrl = "http://localhost:$Port/health"
    if (-not (Wait-HttpHealthy -Uri $healthUrl -TimeoutSeconds 60)) {
        throw "Backend instance '$Name' failed to become healthy. See $outLog and $errLog"
    }

    $nodePid = $null
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) { $nodePid = $listener.OwningProcess }

    $instance = [pscustomobject]@{
        Name       = $Name
        Port       = $Port
        BaseUrl    = "http://localhost:$Port/api"
        HealthUrl  = $healthUrl
        MongoUri   = $MongoUri
        OutLog     = $outLog
        ErrLog     = $errLog
        WrapperPid = $proc.Id
        NodePid    = $nodePid
    }
    $script:startedBackends.Add($instance)
    return $instance
}

function Stop-BackendInstance {
    param([object]$Instance)

    if ($null -eq $Instance) { return }

    try {
        $listener = Get-NetTCPConnection -LocalPort $Instance.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}

    try {
        if ($Instance.WrapperPid) {
            $proc = Get-Process -Id $Instance.WrapperPid -ErrorAction SilentlyContinue
            if ($proc) { Stop-Process -Id $Instance.WrapperPid -Force -ErrorAction SilentlyContinue }
        }
    } catch {}
}

function Invoke-BackendNodeScript {
    param(
        [string]$Script,
        [hashtable]$Env = @{}
    )

    $snapshot = @{}
    foreach ($key in $Env.Keys) {
        $snapshot[$key] = (Get-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue).Value
        Set-Item -Path ("Env:" + $key) -Value ([string]$Env[$key])
    }

    Push-Location $BackendDir
    try {
        $output = $Script | node -
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
        foreach ($key in $Env.Keys) {
            if ($null -ne $snapshot[$key] -and $snapshot[$key] -ne '') {
                Set-Item -Path ("Env:" + $key) -Value $snapshot[$key]
            } else {
                Remove-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue
            }
        }
    }

    if ($exitCode -ne 0) {
        throw "Node helper exited with code $exitCode"
    }
    return ($output -join "`n")
}

function Ensure-RegressionUsers {
    param(
        [string]$BaseUrl,
        [string]$MongoUri
    )

    $previousBaseUrl = (Get-Item -Path Env:BACKEND_BASE_URL -ErrorAction SilentlyContinue).Value
    $previousMongoUri = (Get-Item -Path Env:MONGODB_URI -ErrorAction SilentlyContinue).Value
    try {
        Set-Item -Path Env:BACKEND_BASE_URL -Value $BaseUrl
        Set-Item -Path Env:MONGODB_URI -Value $MongoUri
        & powershell -ExecutionPolicy Bypass -File $SetupScript
        if ($LASTEXITCODE -ne 0) {
            throw "Regression setup exited with code $LASTEXITCODE"
        }
    } finally {
        if ($null -ne $previousBaseUrl -and $previousBaseUrl -ne '') {
            Set-Item -Path Env:BACKEND_BASE_URL -Value $previousBaseUrl
        } else {
            Remove-Item Env:BACKEND_BASE_URL -ErrorAction SilentlyContinue
        }
        if ($null -ne $previousMongoUri -and $previousMongoUri -ne '') {
            Set-Item -Path Env:MONGODB_URI -Value $previousMongoUri
        } else {
            Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue
        }
    }
}

function Get-JwtSecret {
    $envPath = Join-Path $BackendDir '.env'
    if (Test-Path $envPath) {
        $line = Get-Content -Path $envPath | Where-Object { $_ -match '^\s*JWT_SECRET\s*=' } | Select-Object -First 1
        if ($line) {
            $value = ($line -replace '^\s*JWT_SECRET\s*=\s*', '').Trim()
            return $value.Trim('"').Trim("'")
        }
    }
    return 'dev-only-insecure-secret-do-not-use-in-production'
}

# REGION: FLOW
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$primaryMongo = "mongodb://127.0.0.1:27017/htxbachgia_public_contracts_$ts"
$secondaryMongo = "mongodb://127.0.0.1:27017/htxbachgia_public_contracts_env_$ts"
$primary = $null
$secondary = $null

Write-Section "E2E TEST: PUBLIC CONTRACTS & RESILIENCE - $ts"

try {
    Write-Section "STEP 0: Start Isolated Backends"

    Write-Step "0.1" "Start primary backend with PUBLIC_ORIGIN and fallback verify token"
    $primary = Start-BackendInstance -Name 'public-contracts-primary' -Port 3640 -MongoUri $primaryMongo -PublicOrigin 'http://qa-public-origin.local' -FbSendingEnabled '0'
    Write-Pass "Primary backend healthy on $($primary.BaseUrl)"
    [void](Assert-True -Condition (Wait-LogContains -Path $primary.OutLog -Pattern 'http://qa-public-origin.local/api/webhook/messenger' -TimeoutSeconds 12) -PassMessage 'Primary bootstrap log uses PUBLIC_ORIGIN' -FailMessage 'Primary bootstrap log should include PUBLIC_ORIGIN-based webhook URL')

    Write-Step "0.2" "Start secondary backend with APP_PUBLIC_ORIGIN and explicit MESSENGER_VERIFY_TOKEN"
    $secondary = Start-BackendInstance -Name 'public-contracts-secondary' -Port 3641 -MongoUri $secondaryMongo -AppPublicOrigin 'http://qa-app-origin.local' -MessengerVerifyToken 'fb-explicit-token' -FbSendingEnabled '0'
    Write-Pass "Secondary backend healthy on $($secondary.BaseUrl)"
    [void](Assert-True -Condition (Wait-LogContains -Path $secondary.OutLog -Pattern 'http://qa-app-origin.local/api/webhook/messenger' -TimeoutSeconds 12) -PassMessage 'Secondary bootstrap log uses APP_PUBLIC_ORIGIN' -FailMessage 'Secondary bootstrap log should include APP_PUBLIC_ORIGIN-based webhook URL')

    Write-Step "0.3" "Secondary webhook respects explicit MESSENGER_VERIFY_TOKEN"
    $secondaryWebhookOk = Invoke-HttpRequest -Method GET -Uri "$($secondary.BaseUrl)/webhook/messenger?hub.mode=subscribe&hub.verify_token=fb-explicit-token&hub.challenge=fb-explicit-123" -Label 'SecondaryWebhookOk'
    if ((Expect-Status -Result $secondaryWebhookOk -AllowedStatusCodes @(200) -PassMessage 'Secondary webhook accepts explicit MESSENGER_VERIFY_TOKEN' -FailMessage 'Secondary webhook should accept explicit MESSENGER_VERIFY_TOKEN')) {
        [void](Assert-Equal -Actual $secondaryWebhookOk.raw -Expected 'fb-explicit-123' -PassMessage 'Secondary webhook returns challenge for explicit token' -FailMessage 'Secondary webhook should echo explicit challenge')
    }
    $secondaryWebhookDev = Invoke-HttpRequest -Method GET -Uri "$($secondary.BaseUrl)/webhook/messenger?hub.mode=subscribe&hub.verify_token=dev-verify-token&hub.challenge=should-fail" -Label 'SecondaryWebhookDev'
    [void](Expect-Status -Result $secondaryWebhookDev -AllowedStatusCodes @(403) -PassMessage 'Secondary webhook rejects fallback token when explicit token is configured' -FailMessage 'Secondary webhook should reject dev fallback token when explicit token is configured')

    Write-Step "0.4" "Seed baseline users on primary backend"
    Ensure-RegressionUsers -BaseUrl $primary.BaseUrl -MongoUri $primary.MongoUri
    Write-Pass "Regression users ensured on primary backend"

    Write-Step "0.5" "Public login remains reachable without JWT"
    $directorLogin = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/auth/login" -Body @{ email = 'director@test.com'; password = '123456' } -Label 'DirectorLogin'
    if (-not ($directorLogin.success -and $directorLogin.data.access_token)) {
        Write-Fail "Director login failed on primary backend"
        throw "Primary director login failed"
    }
    Write-Pass "Public login returned access_token"
    $directorToken = [string]$directorLogin.data.access_token
    $directorHeaders = @{ Authorization = "Bearer $directorToken" }

    Write-Section "STEP 1: Smoke And Public Baseline"

    Write-Step "1.1" "GET /health is public and healthy"
    $health = Invoke-HttpRequest -Method GET -Uri $primary.HealthUrl -Label 'Health'
    if ((Expect-Status -Result $health -AllowedStatusCodes @(200) -PassMessage '/health returned 200' -FailMessage '/health should return 200')) {
        [void](Assert-Equal -Actual (Get-PropertyValue -Object $health.data -PropertyName 'status') -Expected 'ok' -PassMessage '/health status=ok' -FailMessage '/health should return status=ok')
    }

    Write-Step "1.2" "GET /api/health/db is public"
    $healthDb = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/health/db" -Label 'HealthDb'
    if ((Expect-Status -Result $healthDb -AllowedStatusCodes @(200) -PassMessage '/api/health/db returned 200' -FailMessage '/api/health/db should return 200')) {
        $dbStatus = Get-PropertyValue -Object $healthDb.data -PropertyName 'status'
        [void](Assert-True -Condition (-not [string]::IsNullOrWhiteSpace([string]$dbStatus)) -PassMessage '/api/health/db returned status field' -FailMessage '/api/health/db should expose status field')
    }

    Write-Step "1.3" "Protected /api/media still requires auth"
    $protectedMedia = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media" -Label 'ProtectedMediaNoAuth'
    [void](Expect-Status -Result $protectedMedia -AllowedStatusCodes @(401, 403) -PassMessage 'Protected media list rejected without auth' -FailMessage 'Protected media list should reject unauthenticated access')

    Write-Step "1.4" "Primary webhook uses dev fallback token when env is absent"
    $webhookVerify = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/webhook/messenger?hub.mode=subscribe&hub.verify_token=dev-verify-token&hub.challenge=dev-fallback-123" -Label 'PrimaryWebhookVerify'
    if ((Expect-Status -Result $webhookVerify -AllowedStatusCodes @(200) -PassMessage 'Primary webhook accepts dev fallback token' -FailMessage 'Primary webhook should accept dev fallback token in non-production')) {
        [void](Assert-Equal -Actual $webhookVerify.raw -Expected 'dev-fallback-123' -PassMessage 'Primary webhook echoed dev fallback challenge' -FailMessage 'Primary webhook should echo dev fallback challenge')
    }
    $webhookWrong = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/webhook/messenger?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=wrong" -Label 'PrimaryWebhookWrong'
    [void](Expect-Status -Result $webhookWrong -AllowedStatusCodes @(403) -PassMessage 'Primary webhook rejects wrong verify token' -FailMessage 'Primary webhook should reject wrong verify token')

    Write-Step "1.5" "Primary webhook POST ACKs quickly"
    $webhookPost = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/webhook/messenger" -Body @{ object = 'page'; entry = @() } -Label 'PrimaryWebhookPost'
    if ((Expect-Status -Result $webhookPost -AllowedStatusCodes @(200) -PassMessage 'Primary webhook POST returned 200' -FailMessage 'Primary webhook POST should return 200')) {
        [void](Assert-Equal -Actual (Get-PropertyValue -Object $webhookPost.data -PropertyName 'status') -Expected 'accepted' -PassMessage 'Primary webhook POST returns accepted ACK' -FailMessage 'Primary webhook POST should ACK accepted')
    }

    Write-Section "STEP 2: Advertising Cost Public Contract"

    Write-Step "2.1" "No-data advertising-cost-public contract stays public and stable"
    $costEmpty = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/advertising-cost-public/yesterday-spent" -Label 'AdvertisingCostPublicEmpty'
    if ((Expect-Status -Result $costEmpty -AllowedStatusCodes @(200) -PassMessage 'advertising-cost-public returned 200 with empty dataset' -FailMessage 'advertising-cost-public should return 200 with empty dataset')) {
        [void](Assert-Equal -Actual (Get-PropertyValue -Object $costEmpty.data -PropertyName 'statusCode') -Expected 200 -PassMessage 'advertising-cost-public returns statusCode=200' -FailMessage 'advertising-cost-public should return statusCode=200')
        $emptyData = Get-PropertyValue -Object $costEmpty.data -PropertyName 'data'
        [void](Assert-Equal -Actual (@($emptyData.PSObject.Properties).Count) -Expected 0 -PassMessage 'advertising-cost-public empty dataset is an empty map' -FailMessage 'advertising-cost-public empty dataset should be an empty map')
    }

    Write-Step "2.2" "Seed yesterday cost and verify public map"
    $seedAdGroupId = "PUB-COST-$ts"
    $seedCostScript = @'
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGODB_URI;
  const adGroupId = process.env.SEED_AD_GROUP_ID;
  await mongoose.connect(uri);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  await mongoose.connection.collection('advertisingcosts').insertOne({
    channel: 'facebook',
    date: yesterday,
    adGroupId,
    customerId: 'PUB-CUSTOMER',
    spentAmount: 321000,
    impressions: 1234,
    clicks: 77,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await mongoose.disconnect();
})();
'@
    $null = Invoke-BackendNodeScript -Script $seedCostScript -Env @{ MONGODB_URI = $primary.MongoUri; SEED_AD_GROUP_ID = $seedAdGroupId }
    $costWithData = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/advertising-cost-public/yesterday-spent" -Label 'AdvertisingCostPublicWithData'
    if ((Expect-Status -Result $costWithData -AllowedStatusCodes @(200) -PassMessage 'advertising-cost-public returned 200 with seeded data' -FailMessage 'advertising-cost-public should return 200 with seeded data')) {
        $spentMap = Get-PropertyValue -Object $costWithData.data -PropertyName 'data'
        $seedValue = $spentMap.PSObject.Properties[$seedAdGroupId].Value
        [void](Assert-Equal -Actual $seedValue -Expected 321000 -PassMessage 'advertising-cost-public exposes seeded yesterday-spent map' -FailMessage 'advertising-cost-public should expose seeded yesterday-spent map')
    }

    Write-Section "STEP 3: Media Public Alias Parity And DB Fallback"

    Write-Step "3.1" "Canonical media works across all public aliases"
    $mediaRel = "media\\2026\\04\\public-contract-$ts.png"
    $mediaContent = "QA-MEDIA-$ts"
    $canonicalMediaPath = New-TempFile -RelativePath $mediaRel -Content $mediaContent
    $mediaUrlPath = '2026/04/' + [System.IO.Path]::GetFileName($canonicalMediaPath)

    $legacyMedia = Invoke-HttpRequest -Method GET -Uri ("http://localhost:{0}/media/{1}" -f $primary.Port, $mediaUrlPath) -Label 'LegacyMedia'
    if ((Expect-Status -Result $legacyMedia -AllowedStatusCodes @(200) -PassMessage 'Legacy /media alias served file' -FailMessage 'Legacy /media alias should serve file')) {
        [void](Assert-Equal -Actual (Get-BodyText $legacyMedia.raw).Trim() -Expected $mediaContent -PassMessage 'Legacy /media alias preserved file bytes' -FailMessage 'Legacy /media alias should preserve file bytes')
    }

    $serveMedia = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media/serve/$mediaUrlPath" -Label 'ServeMedia'
    if ((Expect-Status -Result $serveMedia -AllowedStatusCodes @(200) -PassMessage '/api/media/serve served file' -FailMessage '/api/media/serve should serve file')) {
        [void](Assert-Equal -Actual (Get-BodyText $serveMedia.raw).Trim() -Expected $mediaContent -PassMessage '/api/media/serve preserved file bytes' -FailMessage '/api/media/serve should preserve file bytes')
    }

    $ymfMedia = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media/2026/04/$([System.IO.Path]::GetFileName($canonicalMediaPath))" -Label 'YmfMedia'
    if ((Expect-Status -Result $ymfMedia -AllowedStatusCodes @(200) -PassMessage '/api/media/yyyy/mm/file served file' -FailMessage '/api/media/yyyy/mm/file should serve file')) {
        [void](Assert-Equal -Actual (Get-BodyText $ymfMedia.raw).Trim() -Expected $mediaContent -PassMessage '/api/media/yyyy/mm/file preserved file bytes' -FailMessage '/api/media/yyyy/mm/file should preserve file bytes')
    }

    Write-Step "3.2" "Traversal and missing-file paths are rejected"
    $traversal = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media/serve/%2e%2e/%2e%2e/package.json" -Label 'TraversalMedia'
    [void](Expect-Status -Result $traversal -AllowedStatusCodes @(403) -PassMessage 'Encoded traversal was rejected with 403' -FailMessage 'Encoded traversal should be rejected with 403')

    $missingMedia = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media/serve/2026/04/missing-$ts.png" -Label 'MissingMedia'
    [void](Expect-Status -Result $missingMedia -AllowedStatusCodes @(404) -PassMessage 'Missing media returns 404' -FailMessage 'Missing media should return 404')

    Write-Step "3.3" "DB fallback serves file when canonical path is absent"
    $fallbackRealPath = New-TempFile -RelativePath ("uploads\\media\\fallback-db-$ts.png") -Content "QA-DB-FALLBACK-$ts"
    $fallbackUrl = "/media/2026/04/db-fallback-$ts.png"
    $seedMediaScript = @'
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGODB_URI;
  const fallbackPath = process.env.FALLBACK_PATH;
  const fallbackUrl = process.env.FALLBACK_URL;
  const filename = process.env.FALLBACK_FILENAME;
  await mongoose.connect(uri);
  await mongoose.connection.collection('media').insertOne({
    url: fallbackUrl,
    path: fallbackPath,
    filename,
    mimeType: 'image/png',
    ext: 'png',
    size: 15,
    alt: 'db fallback',
    sourceType: 'marketing',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await mongoose.disconnect();
})();
'@
    $null = Invoke-BackendNodeScript -Script $seedMediaScript -Env @{
        MONGODB_URI       = $primary.MongoUri
        FALLBACK_PATH     = $fallbackRealPath
        FALLBACK_URL      = $fallbackUrl
        FALLBACK_FILENAME = "db-fallback-$ts.png"
    }
    $fallbackResponse = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/media/serve/2026/04/db-fallback-$ts.png" -Label 'FallbackMedia'
    if ((Expect-Status -Result $fallbackResponse -AllowedStatusCodes @(200) -PassMessage 'DB fallback served file through /api/media/serve' -FailMessage 'DB fallback should serve file through /api/media/serve')) {
        [void](Assert-Equal -Actual (Get-BodyText $fallbackResponse.raw).Trim() -Expected "QA-DB-FALLBACK-$ts" -PassMessage 'DB fallback preserved file bytes' -FailMessage 'DB fallback should preserve file bytes')
    }

    Write-Section "STEP 4: Supplier Statement Public PDF Token Access"

    Write-Step "4.1" "Create supplier statement on isolated DB"
    $supplierLookup = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/users/email/external-supplier@test.com" -Headers $directorHeaders -Label 'SupplierLookup'
    if (-not ($supplierLookup.success -and ($supplierLookup.data._id -or $supplierLookup.data.id))) {
        Write-Fail "Failed to look up external supplier user"
        throw "Supplier lookup failed"
    }
    $supplierId = if ($supplierLookup.data._id) { [string]$supplierLookup.data._id } else { [string]$supplierLookup.data.id }
    $periodFrom = (Get-Date).Date.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    $periodTo = (Get-Date).Date.AddDays(1).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
    $statementCreate = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/supplier-payables/statements" -Headers $directorHeaders -Body @{
        supplierId = $supplierId
        from       = $periodFrom
        to         = $periodTo
        notes      = "QA public PDF $ts"
    } -Label 'StatementCreate'
    if (-not ($statementCreate.success -and ($statementCreate.data._id -or $statementCreate.data.id))) {
        Write-Fail "Failed to create supplier statement"
        throw "Supplier statement creation failed"
    }
    $script:tempIds.statementId = if ($statementCreate.data._id) { [string]$statementCreate.data._id } else { [string]$statementCreate.data.id }
    Write-Pass "Supplier statement created for public PDF checks"

    Write-Step "4.2" "Public PDF rejects missing/invalid/expired token and accepts valid JWT"
    $missingToken = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/supplier-payables/statements/$($script:tempIds.statementId)/pdf" -Label 'StatementPdfMissing'
    [void](Expect-Status -Result $missingToken -AllowedStatusCodes @(401) -PassMessage 'Statement PDF rejects missing token' -FailMessage 'Statement PDF should reject missing token')

    $invalidToken = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/supplier-payables/statements/$($script:tempIds.statementId)/pdf?token=not-a-real-token" -Label 'StatementPdfInvalid'
    [void](Expect-Status -Result $invalidToken -AllowedStatusCodes @(401) -PassMessage 'Statement PDF rejects invalid token' -FailMessage 'Statement PDF should reject invalid token')

    $jwtSecret = Get-JwtSecret
    $expiredTokenScript = @'
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET_VALUE;
const token = jwt.sign({ sub: 'qa-expired-user' }, secret, { expiresIn: -30 });
console.log(token);
'@
    $expiredToken = Invoke-BackendNodeScript -Script $expiredTokenScript -Env @{ JWT_SECRET_VALUE = $jwtSecret }
    $expiredTokenResp = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/supplier-payables/statements/$($script:tempIds.statementId)/pdf?token=$expiredToken" -Label 'StatementPdfExpired'
    [void](Expect-Status -Result $expiredTokenResp -AllowedStatusCodes @(401) -PassMessage 'Statement PDF rejects expired token' -FailMessage 'Statement PDF should reject expired token')

    $validTokenResp = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/supplier-payables/statements/$($script:tempIds.statementId)/pdf?token=$directorToken" -Label 'StatementPdfValid'
    if ((Expect-Status -Result $validTokenResp -AllowedStatusCodes @(200) -PassMessage 'Statement PDF accepts valid JWT token' -FailMessage 'Statement PDF should accept valid JWT token')) {
        [void](Assert-True -Condition ($validTokenResp.contentType -match 'text/html') -PassMessage 'Statement PDF preview returns HTML content type' -FailMessage 'Statement PDF preview should return HTML content type')
        [void](Assert-True -Condition ($validTokenResp.raw -match '<!DOCTYPE html>') -PassMessage 'Statement PDF preview returns HTML document' -FailMessage 'Statement PDF preview should return HTML document')
    }

    Write-Section "STEP 5: Deprecated Compatibility Endpoint"

    Write-Step "5.1" "Deprecated google-sync contract stays explicit"
    $deprecated = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/google-sync/cred-check" -Label 'GoogleSyncDeprecated'
    if ((Expect-Status -Result $deprecated -AllowedStatusCodes @(200) -PassMessage 'google-sync/cred-check returned 200' -FailMessage 'google-sync/cred-check should return 200')) {
        [void](Assert-Equal -Actual (Get-PropertyValue -Object $deprecated.data -PropertyName 'status') -Expected 'DEPRECATED' -PassMessage 'google-sync/cred-check marks status DEPRECATED' -FailMessage 'google-sync/cred-check should mark status DEPRECATED')
        [void](Assert-True -Condition (-not [string]::IsNullOrWhiteSpace([string](Get-PropertyValue -Object (Get-PropertyValue -Object $deprecated.data -PropertyName 'replacement') -PropertyName 'syncAgent'))) -PassMessage 'google-sync/cred-check exposes replacement.syncAgent' -FailMessage 'google-sync/cred-check should expose replacement.syncAgent')
        [void](Assert-True -Condition (-not [string]::IsNullOrWhiteSpace([string](Get-PropertyValue -Object (Get-PropertyValue -Object $deprecated.data -PropertyName 'replacement') -PropertyName 'syncAll'))) -PassMessage 'google-sync/cred-check exposes replacement.syncAll' -FailMessage 'google-sync/cred-check should expose replacement.syncAll')
    }

    Write-Section "STEP 6: Chat Send-Side Matrix And 24h Policy"

    Write-Step "6.1" "Create product-category, product, OpenAI config, and fanpage fixtures"
    $categoryCreate = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/product-category" -Headers $directorHeaders -Body @{
        name        = "QA Public Category $ts"
        description = "QA public contracts category $ts"
        color       = '#228B22'
        code        = "QAPUB$((Get-Random -Minimum 100 -Maximum 999))"
    } -Label 'CategoryCreate'
    if (-not ($categoryCreate.success -and ($categoryCreate.data._id -or $categoryCreate.data.id))) {
        Write-Fail "Failed to create product category fixture"
        throw "Product category creation failed"
    }
    $script:tempIds.categoryId = if ($categoryCreate.data._id) { [string]$categoryCreate.data._id } else { [string]$categoryCreate.data.id }
    Write-Pass "Product category fixture created"

    $productName = "WidgetAlpha$($ts -replace '[^0-9]','')"
    $productCreate = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/products" -Headers $directorHeaders -Body @{
        name                 = $productName
        categoryId           = $script:tempIds.categoryId
        importPrice          = 120000
        shippingCost         = 15000
        packagingCost        = 5000
        estimatedDeliveryDays = 2
        notes                = "QA product for AI immediate path $ts"
    } -Label 'ProductCreate'
    if (-not ($productCreate.success -and ($productCreate.data._id -or $productCreate.data.id))) {
        Write-Fail "Failed to create product fixture"
        throw "Product creation failed"
    }
    $script:tempIds.productId = if ($productCreate.data._id) { [string]$productCreate.data._id } else { [string]$productCreate.data.id }
    Write-Pass "Product fixture created"

    $openAiCreate = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/openai-configs" -Headers $directorHeaders -Body @{
        name         = "QA Public OpenAI $ts"
        model        = 'gpt-4o-mini'
        apiKey       = 'sk-test-public-contracts'
        systemPrompt = 'Answer briefly.'
        scopeType    = 'global'
        status       = 'active'
        temperature  = 0.2
        maxTokens    = 128
    } -Label 'OpenAiCreate'
    if (-not ($openAiCreate.success -and ($openAiCreate.data._id -or $openAiCreate.data.id))) {
        Write-Fail "Failed to create OpenAI config fixture"
        throw "OpenAI config creation failed"
    }
    $script:tempIds.openAiConfigId = if ($openAiCreate.data._id) { [string]$openAiCreate.data._id } else { [string]$openAiCreate.data.id }
    Write-Pass "OpenAI config fixture created"

    $fanpageCreate = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/fanpages" -Headers $directorHeaders -Body @{
        pageId         = "qa-public-chat-$ts"
        name           = "QA Public Chat $ts"
        accessToken    = "fake-chat-token-$ts"
        status         = 'active'
        aiEnabled      = $true
        openAIConfigId = $script:tempIds.openAiConfigId
        description    = 'QA chat fanpage'
    } -Label 'FanpageCreate'
    if (-not ($fanpageCreate.success -and ($fanpageCreate.data._id -or $fanpageCreate.data.id))) {
        Write-Fail "Failed to create chat fanpage fixture"
        throw "Chat fanpage creation failed"
    }
    $script:tempIds.fanpageId = if ($fanpageCreate.data._id) { [string]$fanpageCreate.data._id } else { [string]$fanpageCreate.data.id }
    Write-Pass "Chat fanpage fixture created"

    Write-Step "6.2" "Seed old inbound chat for 24h-window checks"
    $chatSenderPsid = "psid-public-$ts"
    $seedChatScript = @'
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGODB_URI;
  const fanpageId = process.env.CHAT_FANPAGE_ID;
  const senderPsid = process.env.CHAT_SENDER_PSID;
  const content = process.env.CHAT_CONTENT;
  const createdAt = new Date(Date.now() - (26 * 60 * 60 * 1000));
  await mongoose.connect(uri);
  await mongoose.connection.collection('chatmessages').insertOne({
    fanpageId: new mongoose.Types.ObjectId(fanpageId),
    senderPsid,
    direction: 'in',
    content,
    awaitingHuman: false,
    sourcePlatform: 'facebook',
    deliveryStatus: 'sent',
    receivedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  await mongoose.disconnect();
})();
'@
    $null = Invoke-BackendNodeScript -Script $seedChatScript -Env @{
        MONGODB_URI      = $primary.MongoUri
        CHAT_FANPAGE_ID  = $script:tempIds.fanpageId
        CHAT_SENDER_PSID = $chatSenderPsid
        CHAT_CONTENT     = "Cho minh gia $productName"
    }
    Write-Pass "Old inbound chat seeded outside the 24h window"

    Write-Step "6.3" "Text send blocks outside 24h, invalid tag fails, valid MESSAGE_TAG still works"
    $textOutside24h = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/chat-messages/send" -Headers $directorHeaders -Body @{
        fanpageId  = $script:tempIds.fanpageId
        senderPsid = $chatSenderPsid
        text       = 'outside 24h plain text'
    } -Label 'TextOutside24h'
    [void](Expect-Status -Result $textOutside24h -AllowedStatusCodes @(400) -PassMessage 'Plain text send is blocked outside 24h' -FailMessage 'Plain text send should be blocked outside 24h')

    $invalidTag = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/chat-messages/send" -Headers $directorHeaders -Body @{
        fanpageId           = $script:tempIds.fanpageId
        senderPsid          = $chatSenderPsid
        text                = 'outside 24h invalid tag'
        messagingType       = 'MESSAGE_TAG'
        tag                 = 'INVALID_TAG'
        allowTaggedFallback = $true
    } -Label 'InvalidMessageTag'
    [void](Expect-Status -Result $invalidTag -AllowedStatusCodes @(400) -PassMessage 'Invalid MESSAGE_TAG is rejected outside 24h' -FailMessage 'Invalid MESSAGE_TAG should be rejected outside 24h')

    $validTag = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/chat-messages/send" -Headers $directorHeaders -Body @{
        fanpageId           = $script:tempIds.fanpageId
        senderPsid          = $chatSenderPsid
        text                = 'outside 24h valid message tag'
        messagingType       = 'MESSAGE_TAG'
        tag                 = 'ACCOUNT_UPDATE'
        allowTaggedFallback = $true
    } -Label 'ValidMessageTag'
    if ((Expect-Status -Result $validTag -AllowedStatusCodes @(200, 201) -PassMessage 'Valid MESSAGE_TAG succeeds outside 24h even when FB sending is disabled' -FailMessage 'Valid MESSAGE_TAG should succeed outside 24h even when FB sending is disabled')) {
        $validSaved = Get-PropertyValue -Object $validTag.data -PropertyName 'saved'
        [void](Assert-Equal -Actual (Get-PropertyValue -Object $validSaved -PropertyName 'deliveryStatus') -Expected 'skipped' -PassMessage 'Valid MESSAGE_TAG was recorded as skipped delivery' -FailMessage 'Valid MESSAGE_TAG should be recorded as skipped delivery when FB sending is disabled')
    }

    Write-Step "6.4" "Image send by URL and multipart upload both block outside 24h"
    $imageUrlResp = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/chat-messages/send/image/url" -Headers $directorHeaders -Body @{
        fanpageId  = $script:tempIds.fanpageId
        senderPsid = $chatSenderPsid
        imageUrl   = '/media/2026/04/outside24h-url.png'
        alt        = 'outside24h'
    } -Label 'ImageByUrlOutside24h'
    [void](Expect-Status -Result $imageUrlResp -AllowedStatusCodes @(400) -PassMessage 'Image-by-URL send is blocked outside 24h' -FailMessage 'Image-by-URL send should be blocked outside 24h')

    $uploadImagePath = New-TempFile -RelativePath ("tests\\backend\\artifacts\\results\\upload-outside24h-$ts.png") -Content "UPLOAD-IMAGE-$ts"
    $imageUploadResp = Invoke-MultipartUpload -Uri "$($primary.BaseUrl)/chat-messages/send/image/$($script:tempIds.fanpageId)/$chatSenderPsid" -Headers $directorHeaders -FilePath $uploadImagePath -FileContentType 'image/png' -FormFields @{ alt = 'outside24h-upload' } -Label 'ImageUploadOutside24h'
    [void](Expect-Status -Result $imageUploadResp -AllowedStatusCodes @(400) -PassMessage 'Multipart image upload/send is blocked outside 24h' -FailMessage 'Multipart image upload/send should be blocked outside 24h')

    Write-Step "6.5" "AI send stays blocked outside 24h on the immediate-product path"
    $aiSend = Invoke-HttpRequest -Method POST -Uri "$($primary.BaseUrl)/chat-messages/send/ai" -Headers $directorHeaders -Body @{
        fanpageId  = $script:tempIds.fanpageId
        senderPsid = $chatSenderPsid
    } -Label 'AiSendOutside24h'
    [void](Expect-Status -Result $aiSend -AllowedStatusCodes @(400) -PassMessage 'AI send is blocked outside 24h' -FailMessage 'AI send should be blocked outside 24h')

    Write-Step "6.6" "Only the valid MESSAGE_TAG outbound survives conversation replay"
    $conversation = Invoke-HttpRequest -Method GET -Uri "$($primary.BaseUrl)/chat-messages/conversations/$($script:tempIds.fanpageId)/$chatSenderPsid" -Headers $directorHeaders -Label 'ConversationAfter24hChecks'
    if ((Expect-Status -Result $conversation -AllowedStatusCodes @(200) -PassMessage 'Conversation detail returned after 24h checks' -FailMessage 'Conversation detail should be readable after 24h checks')) {
        $chatCountScript = @'
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await mongoose.connection.collection('chatmessages')
    .find({ senderPsid: process.env.CHAT_SENDER_PSID })
    .toArray();
  const inbound = docs.filter(d => d.direction === 'in').length;
  const outbound = docs.filter(d => d.direction === 'out').length;
  const outboundImages = docs.filter(d => d.direction === 'out' && d.messageType === 'image').length;
  console.log(JSON.stringify({ inbound, outbound, outboundImages }));
  await mongoose.disconnect();
})();
'@
        $chatCounts = Invoke-BackendNodeScript -Script $chatCountScript -Env @{
            MONGODB_URI      = $primary.MongoUri
            CHAT_FANPAGE_ID  = $script:tempIds.fanpageId
            CHAT_SENDER_PSID = $chatSenderPsid
        } | ConvertFrom-Json
        [void](Assert-Equal -Actual $chatCounts.inbound -Expected 1 -PassMessage 'Exactly one inbound message exists in the test conversation' -FailMessage 'Test conversation should contain exactly one inbound message')
        [void](Assert-Equal -Actual $chatCounts.outbound -Expected 1 -PassMessage 'Only one outbound message was persisted after the 24h matrix' -FailMessage 'Only one outbound message should be persisted after the 24h matrix')
        [void](Assert-Equal -Actual $chatCounts.outboundImages -Expected 0 -PassMessage 'Blocked image sends did not persist outbound image messages' -FailMessage 'Blocked image sends should not persist outbound image messages')
    }

} finally {
    Write-Section "CLEANUP"
    foreach ($instance in @($secondary, $primary)) {
        if ($instance) {
            Stop-BackendInstance -Instance $instance
            Write-Info "Stopped backend instance $($instance.Name) on port $($instance.Port)"
        }
    }

    foreach ($path in $script:cleanupFiles) {
        try {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }
}

# REGION: SUMMARY
Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount + $script:skipCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { 'Red' } else { 'Green' }) -NoNewline
Write-Host " | " -NoNewline
Write-Host "SKIP: $($script:skipCount)" -ForegroundColor Yellow
if ($script:failCount -gt 0) {
    Write-Host "`nFailed checks:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
exit $script:failCount
