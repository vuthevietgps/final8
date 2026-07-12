#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.DB-SEED-CLEANUP.PS1
    =====================================================================================
    Target coverage:
    - DB-06: high-volume seed and cleanup safety across target/protected namespaces
    =====================================================================================
#>

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
$RuntimeManifestScript = Join-Path $RepoRoot 'tests\backend\setup\backend-runtime-manifest.ps1'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

if (Test-Path $RuntimeManifestScript) {
    . $RuntimeManifestScript
}

$RuntimeManifestUsage = $null
if (Get-Command Use-BackendRuntimeManifest -ErrorAction SilentlyContinue) {
    try {
        $RuntimeManifestUsage = Use-BackendRuntimeManifest
    } catch {
        Write-Host "  [ERROR] Runtime manifest load failed: $_" -ForegroundColor Red
        exit 1
    }
}

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$tsDigits = $ts -replace '[^0-9]', ''
$RunTag = "run-$tsDigits"
$SuitePort = if ($env:DB06_PORT) { [int]$env:DB06_PORT } else { 3684 }
$UsingExternalBackend = -not [string]::IsNullOrWhiteSpace($env:BACKEND_BASE_URL)
$HasExplicitDb06MediaDir = -not [string]::IsNullOrWhiteSpace($env:DB06_MEDIA_DIR)
$SuiteMongoUri =
    if ($env:DB06_MONGODB_URI) { $env:DB06_MONGODB_URI.Trim() }
    elseif ($env:MONGODB_URI) { $env:MONGODB_URI.Trim() }
    else { "mongodb://127.0.0.1:27017/htxbachgia_db06_$tsDigits" }
$SuiteMediaDir =
    if ($HasExplicitDb06MediaDir) {
        $resolvedMediaDir = Resolve-Path -LiteralPath $env:DB06_MEDIA_DIR -ErrorAction SilentlyContinue
        if ($resolvedMediaDir) { $resolvedMediaDir.Path } else { [System.IO.Path]::GetFullPath($env:DB06_MEDIA_DIR) }
    }
    elseif ($UsingExternalBackend) { $null }
    else { Join-Path $ResultsDir "tmp-db06-media-$tsDigits" }

$BaseUrl =
    if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') }
    else { "http://localhost:$SuitePort/api" }
$HealthUrl =
    if ($env:BACKEND_HEALTH_URL) { $env:BACKEND_HEALTH_URL.TrimEnd('/') }
    else { ($BaseUrl -replace '/api$','/health') }

$StateFile = Join-Path $RepoRoot "backend\scripts\.db06-seed-state-$RunTag.json"
$TempBackendOut = Join-Path $ResultsDir "tmp-db06-backend-$SuitePort-$ts.out.log"
$TempBackendErr = Join-Path $ResultsDir "tmp-db06-backend-$SuitePort-$ts.err.log"

$ExpectedTarget = @{
    orders = 240
    otherCosts = 120
    chatMessages = 184
    agedChatMessages = 24
    conversations = 8
    mediaDocs = 18
    backedFiles = 18
    orphanFiles = 8
}
$ExpectedProtected = @{
    orders = 36
    otherCosts = 24
    chatMessages = 48
    agedChatMessages = 0
    conversations = 8
    mediaDocs = 6
    backedFiles = 6
}

$script:StartedBackend = $false
$script:BackendProcess = $null
$script:StartedBackendPid = $null
$script:StartedBackendWrapperPid = $null
$script:SeedEstablished = $false

$script:passCount = 0
$script:failCount = 0
$script:blockedCount = 0
$script:failDetails = @()
$script:blockedDetails = @()

function Write-Section($Title) {
    Write-Host ''
    Write-Host ('=' * 96) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 96) -ForegroundColor Cyan
}

function Write-Step($Step, $Title) {
    Write-Host ''
    Write-Host "--- Step $Step : $Title ---" -ForegroundColor Yellow
}

function Write-Pass($Message) {
    Write-Host "  [PASS] $Message" -ForegroundColor Green
    $script:passCount++
}

function Write-Fail($Message) {
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $script:failCount++
    $script:failDetails += $Message
}

function Write-Blocked($Message) {
    Write-Host "  [BLOCKED] $Message" -ForegroundColor Magenta
    $script:blockedCount++
    $script:blockedDetails += $Message
}

function Write-Info($Message) {
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

function Get-ErrorBody([object]$Exception) {
    try {
        if ($Exception.Response -and $Exception.Response.GetResponseStream) {
            return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
        }
    } catch {}
    return ''
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
        [string]$Label = ''
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Uri
            Headers = $Headers
            ContentType = 'application/json; charset=utf-8'
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }
        if ($null -ne $Body -and $Method -ne 'GET') {
            $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 }
            $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
        }
        $response = Invoke-WebRequest @params
        return @{
            success = $true
            statusCode = [int]$response.StatusCode
            data = Convert-ResponseJson -Text $response.Content
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
            data = Convert-ResponseJson -Text $errorBody
            raw = $errorBody
        }
    }
}

function Start-IsolatedBackend {
    if ($env:BACKEND_BASE_URL) {
        Write-Info "Using externally provided backend: $BaseUrl"
        return $true
    }

    $existingListener = Get-NetTCPConnection -LocalPort $SuitePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingListener -and $existingListener.OwningProcess) {
        Write-Info "Stopping pre-existing listener on port $SuitePort (PID $($existingListener.OwningProcess))"
        try { Stop-Process -Id $existingListener.OwningProcess -Force -ErrorAction Stop } catch {}
        Start-Sleep -Seconds 2
    }

    $command = "Set-Location '$BackendDir'; `$env:PORT='$SuitePort'; `$env:MONGODB_URI='$SuiteMongoUri'; `$env:MEDIA_DIR='$SuiteMediaDir'; node dist/main.js"
    $script:BackendProcess = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-Command',$command -WindowStyle Hidden -RedirectStandardOutput $TempBackendOut -RedirectStandardError $TempBackendErr -PassThru
    $script:StartedBackendWrapperPid = $script:BackendProcess.Id
    $script:StartedBackendPid = $script:BackendProcess.Id

    $deadline = (Get-Date).AddSeconds(75)
    do {
        Start-Sleep -Seconds 2
        try {
            Invoke-RestMethod -Uri $HealthUrl -Method Get | Out-Null
            $listener = Get-NetTCPConnection -LocalPort $SuitePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($listener -and $listener.OwningProcess) {
                $script:StartedBackendPid = $listener.OwningProcess
                Write-Info "Detected dedicated backend listener PID $($listener.OwningProcess)"
            }
            $script:StartedBackend = $true
            return $true
        } catch {}
    } while ((Get-Date) -lt $deadline)

    return $false
}

function Stop-IsolatedBackend {
    if ($script:StartedBackendPid) {
        try { Stop-Process -Id $script:StartedBackendPid -Force -ErrorAction Stop } catch {}
    }
    if ($script:StartedBackendWrapperPid -and $script:StartedBackendWrapperPid -ne $script:StartedBackendPid) {
        try { Stop-Process -Id $script:StartedBackendWrapperPid -Force -ErrorAction Stop } catch {}
    } elseif ($script:BackendProcess -and -not $script:BackendProcess.HasExited) {
        try { Stop-Process -Id $script:BackendProcess.Id -Force } catch {}
    }
}

function Ensure-RegressionUsers {
    $setupScript = Join-Path $RepoRoot 'tests\backend\setup\ensure-regression-users.ps1'
    $previousMongo = $env:MONGODB_URI
    try {
        $env:MONGODB_URI = $SuiteMongoUri
        & powershell -ExecutionPolicy Bypass -File $setupScript -BaseUrl $BaseUrl
        return ($LASTEXITCODE -eq 0)
    } finally {
        if ($null -ne $previousMongo) { $env:MONGODB_URI = $previousMongo } else { Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue }
    }
}

function Login-Director {
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/auth/login" -Body @{ email = 'director@test.com'; password = '123456' } -Label 'DirectorLogin'
}

function Get-AuthHeaders([string]$Token) {
    return @{ Authorization = "Bearer $Token" }
}

function Invoke-HelperJson {
    param(
        [string]$Action,
        [string]$Tag,
        [string]$Label
    )

    $previousMongo = $env:MONGODB_URI
    $previousMedia = $env:DB06_MEDIA_DIR
    try {
        $env:MONGODB_URI = $SuiteMongoUri
        $env:DB06_MEDIA_DIR = $SuiteMediaDir
        Push-Location $RepoRoot
        $output = & node 'backend/scripts/db06-seed-cleanup-helper.js' $Action $Tag 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        Pop-Location
        if ($null -ne $previousMongo) { $env:MONGODB_URI = $previousMongo } else { Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue }
        if ($null -ne $previousMedia) { $env:DB06_MEDIA_DIR = $previousMedia } else { Remove-Item Env:DB06_MEDIA_DIR -ErrorAction SilentlyContinue }
    }

    $text = ($output | Out-String).Trim()
    if ($exitCode -ne 0) {
        Write-Host "  [ERROR] $Label failed: $text" -ForegroundColor Red
        return @{
            success = $false
            raw = $text
            data = $null
        }
    }

    try {
        return @{
            success = $true
            raw = $text
            data = ($text | ConvertFrom-Json)
        }
    } catch {
        Write-Host "  [ERROR] $Label returned invalid JSON: $text" -ForegroundColor Red
        return @{
            success = $false
            raw = $text
            data = $null
        }
    }
}

function Assert-Equal {
    param(
        [string]$Label,
        $Expected,
        $Actual
    )

    if ($Expected -eq $Actual) {
        Write-Pass "$Label -> $Actual"
    } else {
        Write-Fail "$Label expected [$Expected] but got [$Actual]"
    }
}

function Assert-True {
    param(
        [string]$Label,
        [bool]$Condition,
        [string]$FailureMessage
    )

    if ($Condition) {
        Write-Pass $Label
    } else {
        Write-Fail "$Label :: $FailureMessage"
    }
}

function Assert-Blocked {
    param(
        [string]$Label,
        [bool]$Condition,
        [string]$BlockedMessage
    )

    if ($Condition) {
        Write-Pass $Label
        return $true
    }

    Write-Blocked "$Label :: $BlockedMessage"
    return $false
}

function Assert-SummaryCounts {
    param(
        [object]$Summary,
        [hashtable]$ExpectedTargetCounts,
        [hashtable]$ExpectedProtectedCounts
    )

    foreach ($entry in $ExpectedTargetCounts.GetEnumerator()) {
        Assert-Equal "Target $($entry.Key)" $entry.Value ([int]$Summary.target.PSObject.Properties[$entry.Key].Value)
    }
    foreach ($entry in $ExpectedProtectedCounts.GetEnumerator()) {
        Assert-Equal "Protected $($entry.Key)" $entry.Value ([int]$Summary.protected.PSObject.Properties[$entry.Key].Value)
    }
}

$finalExitCode = 0

try {
    Write-Section 'DB-06 High-volume Seed And Cleanup Safety'
    Write-Info "RepoRoot: $RepoRoot"
    Write-Info "BaseUrl: $BaseUrl"
    Write-Info "HealthUrl: $HealthUrl"
    Write-Info "Mongo: $SuiteMongoUri"
    Write-Info "MediaDir: $SuiteMediaDir"
    Write-Info "RunTag: $RunTag"
    if ($RuntimeManifestUsage) {
        Write-Info "RuntimeManifest: $($RuntimeManifestUsage.Path)"
        Write-Info "ManifestApplied: $(if (@($RuntimeManifestUsage.Applied).Count -gt 0) { @($RuntimeManifestUsage.Applied) -join ', ' } else { 'none' })"
    }

    Write-Step '0.0' 'Validate backend/media root coupling'
    if ($UsingExternalBackend -and -not $HasExplicitDb06MediaDir) {
        Write-Blocked 'External BACKEND_BASE_URL requires DB06_MEDIA_DIR so seed helpers and media cleanup target the same media root'
        throw 'db06-external-backend-media-dir-missing'
    }
    Write-Pass 'DB06 media root is explicitly coupled to the backend execution mode'

    Write-Step '0.1' 'Start isolated backend'
    if (Start-IsolatedBackend) {
        Write-Pass "Backend healthy on $BaseUrl"
    } else {
        Write-Fail 'Isolated backend did not become healthy'
        throw 'backend-start-failed'
    }

    Write-Step '0.2' 'Ensure baseline regression users'
    if (Ensure-RegressionUsers) {
        Write-Pass 'Regression users ensured on isolated DB'
    } else {
        Write-Fail 'ensure-regression-users failed'
        throw 'setup-users-failed'
    }

    Write-Step '0.3' 'Login director'
    $login = Login-Director
    if (-not $login.success -or -not $login.data.access_token) {
        Write-Fail 'Director login failed'
        throw 'login-failed'
    }
    $headers = Get-AuthHeaders $login.data.access_token
    Write-Pass 'Director login OK'

    Write-Step '1' 'Seed target and protected namespaces'
    $setup = Invoke-HelperJson -Action 'setup' -Tag $RunTag -Label 'DB06Setup'
    if (-not $setup.success) {
        Write-Fail 'DB-06 setup helper failed'
        throw 'helper-setup-failed'
    }
    $script:SeedEstablished = $true
    Assert-Equal 'Setup expected target orders' 240 ([int]$setup.data.expected.target.orders)
    Assert-Equal 'Setup expected protected orders' 36 ([int]$setup.data.expected.protected.orders)

    Write-Step '2' 'Verify seeded baseline and TTL index'
    $summaryBefore = Invoke-HelperJson -Action 'summary' -Tag $RunTag -Label 'DB06SummaryBefore'
    if (-not $summaryBefore.success) {
        Write-Fail 'DB-06 summary before cleanup failed'
        throw 'helper-summary-before-failed'
    }
    Assert-SummaryCounts -Summary $summaryBefore.data -ExpectedTargetCounts $ExpectedTarget -ExpectedProtectedCounts $ExpectedProtected
    Assert-Equal 'TTL index seconds on chatmessages.createdAt' 7776000 ([int]$summaryBefore.data.ttlIndexSeconds)

    Write-Step '3' 'API precheck for order pagination and media catalog'
    $targetCustomerQuery = [uri]::EscapeDataString("DB06 TARGET $RunTag")
    $targetMediaTag = [uri]::EscapeDataString("db06-target-$RunTag")
    $ordersResponse = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/test-order2?q=$targetCustomerQuery&page=1&limit=200&sortBy=createdAt&sortOrder=desc" -Headers $headers -Label 'ListTargetOrders'
    if (-not $ordersResponse.success) {
        Write-Fail 'Order list precheck failed'
        throw 'order-precheck-failed'
    }
    Assert-Equal 'Order API target total' 240 ([int]$ordersResponse.data.pagination.total)
    Assert-Equal 'Order API page-1 rows' 200 (@($ordersResponse.data.data).Count)

    $mediaResponse = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/media?tag=$targetMediaTag&page=1&limit=100" -Headers $headers -Label 'ListTargetMedia'
    if (-not $mediaResponse.success) {
        Write-Fail 'Media list precheck failed'
        throw 'media-precheck-failed'
    }
    Assert-Equal 'Media API target total' 18 ([int]$mediaResponse.data.total)
    Assert-Equal 'Media API item count' 18 (@($mediaResponse.data.items).Count)

    Write-Step '4' 'Cleanup orphaned media and verify namespace safety'
    $cleanupResponse = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/media/cleanup-orphaned" -Headers $headers -Label 'CleanupOrphanedMedia'
    if (-not $cleanupResponse.success) {
        Write-Fail 'Media cleanup endpoint failed'
        throw 'media-cleanup-failed'
    }
    Assert-Equal 'Media cleanup deleted orphan files' 8 ([int]$cleanupResponse.data.deletedFiles)
    Assert-Equal 'Media cleanup error count' 0 (@($cleanupResponse.data.errors).Count)

    $summaryAfterCleanup = Invoke-HelperJson -Action 'summary' -Tag $RunTag -Label 'DB06SummaryAfterCleanup'
    if (-not $summaryAfterCleanup.success) {
        Write-Fail 'DB-06 summary after cleanup failed'
        throw 'helper-summary-after-cleanup-failed'
    }
    Assert-Equal 'Target orphan files after media cleanup' 0 ([int]$summaryAfterCleanup.data.target.orphanFiles)
    Assert-Equal 'Target media docs remain after media cleanup' 18 ([int]$summaryAfterCleanup.data.target.mediaDocs)
    Assert-Equal 'Target backed files remain after media cleanup' 18 ([int]$summaryAfterCleanup.data.target.backedFiles)
    Assert-Equal 'Protected media docs remain after media cleanup' 6 ([int]$summaryAfterCleanup.data.protected.mediaDocs)
    Assert-Equal 'Protected backed files remain after media cleanup' 6 ([int]$summaryAfterCleanup.data.protected.backedFiles)

    Write-Step '5' 'Observe chat TTL retention behavior'
    $ttlObserved = $false
    $deadline = (Get-Date).AddSeconds(150)
    do {
        Start-Sleep -Seconds 10
        $summaryPoll = Invoke-HelperJson -Action 'summary' -Tag $RunTag -Label 'DB06SummaryTtlPoll'
        if (-not $summaryPoll.success) {
            Write-Fail 'TTL poll summary failed'
            throw 'ttl-summary-failed'
        }
        $agedCount = [int]$summaryPoll.data.target.agedChatMessages
        $targetChatTotal = [int]$summaryPoll.data.target.chatMessages
        Write-Info "TTL poll -> target aged chat messages: $agedCount ; total target chat messages: $targetChatTotal"
        if ($agedCount -eq 0) {
            $ttlObserved = $true
            break
        }
    } while ((Get-Date) -lt $deadline)

    $null = Assert-Blocked -Label 'Chat TTL deleted aged messages within observation window' -Condition $ttlObserved -BlockedMessage 'TTL index exists but aged messages did not disappear within 150 seconds.'

    Write-Step '6' 'Teardown only target namespace and verify protected survives'
    $teardownTarget = Invoke-HelperJson -Action 'teardown-target' -Tag $RunTag -Label 'DB06TeardownTarget'
    if (-not $teardownTarget.success) {
        Write-Fail 'Target teardown failed'
        throw 'teardown-target-failed'
    }

    $summaryAfterTarget = Invoke-HelperJson -Action 'summary' -Tag $RunTag -Label 'DB06SummaryAfterTargetTeardown'
    if (-not $summaryAfterTarget.success) {
        Write-Fail 'Summary after target teardown failed'
        throw 'summary-after-target-failed'
    }

    $expectedTargetAfterTeardown = @{
        orders = 0
        otherCosts = 0
        chatMessages = 0
        agedChatMessages = 0
        conversations = 0
        mediaDocs = 0
        backedFiles = 0
        orphanFiles = 0
    }
    Assert-SummaryCounts -Summary $summaryAfterTarget.data -ExpectedTargetCounts $expectedTargetAfterTeardown -ExpectedProtectedCounts $ExpectedProtected

    Write-Step '7' 'Final cleanup'
    $teardownAll = Invoke-HelperJson -Action 'teardown-all' -Tag $RunTag -Label 'DB06TeardownAll'
    if (-not $teardownAll.success) {
        Write-Fail 'Final teardown failed'
        throw 'teardown-all-failed'
    }
    $script:SeedEstablished = $false
    Assert-True 'State file removed after teardown-all' (-not (Test-Path -LiteralPath $StateFile)) "State file still present: $StateFile"
    Assert-True 'Isolated media directory removed after teardown-all' (-not (Test-Path -LiteralPath $SuiteMediaDir)) "Media directory still present: $SuiteMediaDir"
}
catch {
    if ([string]$_ -eq 'db06-external-backend-media-dir-missing') {
        Write-Info 'DB-06 suite stopped after blocked external-backend preflight'
    } else {
        Write-Fail "Unhandled suite exception: $_"
    }
}
finally {
    if ($script:SeedEstablished) {
        Write-Info 'Attempting emergency teardown-all in finally'
        $cleanupAttempt = Invoke-HelperJson -Action 'teardown-all' -Tag $RunTag -Label 'DB06TeardownAllFinally'
        if ($cleanupAttempt.success) {
            Write-Info 'Emergency teardown-all completed'
            $script:SeedEstablished = $false
        } else {
            Write-Info "Emergency teardown-all skipped/failed: $($cleanupAttempt.raw)"
        }
    }

    Stop-IsolatedBackend

    Write-Section 'Summary'
    Write-Host "  PASS    : $($script:passCount)" -ForegroundColor Green
    Write-Host "  FAIL    : $($script:failCount)" -ForegroundColor Red
    Write-Host "  BLOCKED : $($script:blockedCount)" -ForegroundColor Magenta
    if ($script:failDetails.Count -gt 0) {
        Write-Host '  Fail details:' -ForegroundColor Red
        foreach ($detail in $script:failDetails) {
            Write-Host "    - $detail" -ForegroundColor Red
        }
    }
    if ($script:blockedDetails.Count -gt 0) {
        Write-Host '  Blocked details:' -ForegroundColor Magenta
        foreach ($detail in $script:blockedDetails) {
            Write-Host "    - $detail" -ForegroundColor Magenta
        }
    }

    if ($script:failCount -gt 0) {
        $finalExitCode = 1
    } elseif ($script:blockedCount -gt 0) {
        $finalExitCode = 2
    } else {
        $finalExitCode = 0
    }
}

exit $finalExitCode
