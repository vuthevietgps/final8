#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.DB-CONSISTENCY.PS1
    =====================================================================================
    Target coverage:
    - DB-01: transaction / rollback integrity on return-request resolve
    - DB-02: referential consistency after deleting a category in use
    - DB-03: duplicate email pressure keeps a single user row
    - DB-04: capital-allocation active policy + snapshot read-after-write coherence
    - CON-08: duplicate / invalid resolve must not half-apply return-request state
    - CON-09: other-cost timezone boundary must stay on the Bangkok business day
    =====================================================================================
#>

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$tsDigits = $ts -replace '[^0-9]', ''
$SuitePort = if ($env:DB_CONSISTENCY_PORT) { [int]$env:DB_CONSISTENCY_PORT } else { 3680 }
$SuiteMongoUri =
    if ($env:DB_CONSISTENCY_MONGODB_URI) { $env:DB_CONSISTENCY_MONGODB_URI.Trim() }
    elseif ($env:MONGODB_URI) { $env:MONGODB_URI.Trim() }
    else { "mongodb://127.0.0.1:27017/htxbachgia_db_consistency_$tsDigits" }

$BaseUrl =
    if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') }
    else { "http://localhost:$SuitePort/api" }
$HealthUrl =
    if ($env:BACKEND_HEALTH_URL) { $env:BACKEND_HEALTH_URL.TrimEnd('/') }
    else { ($BaseUrl -replace '/api$','/health') }

$TempBackendOut = Join-Path $ResultsDir "tmp-db-consistency-$SuitePort-$ts.out.log"
$TempBackendErr = Join-Path $ResultsDir "tmp-db-consistency-$SuitePort-$ts.err.log"
$script:StartedBackend = $false
$script:BackendProcess = $null
$script:StartedBackendPid = $null
$script:StartedBackendWrapperPid = $null

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()

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

function Get-Id($Object) {
    if ($null -eq $Object) { return '' }
    if ($Object -is [string]) { return [string]$Object }
    if ($Object._id) { return [string]$Object._id }
    if ($Object.id) { return [string]$Object.id }
    return ''
}

function Get-FieldValue($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    if ($Object.PSObject.Properties[$Name]) { return $Object.$Name }
    return $null
}

function New-ObjectIdString {
    return -join ((1..24) | ForEach-Object { '{0:x}' -f (Get-Random -Minimum 0 -Maximum 16) })
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

    $escapedBackendDir = $BackendDir.Replace("'", "''")
    $escapedMongoUri = $SuiteMongoUri.Replace("'", "''")
    $escapedOut = $TempBackendOut.Replace("'", "''")
    $escapedErr = $TempBackendErr.Replace("'", "''")
    $command = "Set-Location '$escapedBackendDir'; `$env:PORT='$SuitePort'; `$env:MONGODB_URI='$escapedMongoUri'; node dist/main.js 1>> '$escapedOut' 2>> '$escapedErr'"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'powershell.exe'
    $psi.Arguments = "-NoProfile -Command $command"
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $script:BackendProcess = [System.Diagnostics.Process]::Start($psi)
    if (-not $script:BackendProcess) {
        Write-Fail 'Failed to start isolated backend process'
        return $false
    }
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

function Invoke-MongoJson {
    param(
        [string]$JavaScript,
        [string]$Label = 'MongoScript'
    )

    $repoRootJson = $RepoRoot | ConvertTo-Json -Compress
    $mongoUriJson = $SuiteMongoUri | ConvertTo-Json -Compress
    $nodeScript = @"
const path = require('path');
const { createRequire } = require('module');
const repoRoot = $repoRootJson;
const mongoUri = $mongoUriJson;
const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');

(async () => {
  await mongoose.connect(mongoUri);
  const { ObjectId } = mongoose.Types;
  let result;
  $JavaScript
  console.log(JSON.stringify(result ?? null));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

    $output = $nodeScript | node -
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "$Label failed"
        return $null
    }

    $text = ($output | Out-String).Trim()
    if (-not $text) { return $null }
    try { return $text | ConvertFrom-Json } catch { return $text }
}

function Get-UserCountByEmail([string]$Email) {
    $emailJson = $Email | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label 'GetUserCountByEmail' -JavaScript @"
result = {
  count: await mongoose.connection.db.collection('users').countDocuments({ email: $emailJson })
};
"@
}

function Get-InventoryState([string]$ProductId) {
    $productIdJson = $ProductId | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label 'GetInventoryState' -JavaScript @"
const pid = new ObjectId($productIdJson);
const [summary, txCount, batchCount] = await Promise.all([
  mongoose.connection.db.collection('inventorysummaries').findOne({ productId: pid }),
  mongoose.connection.db.collection('inventorytransactions').countDocuments({ productId: pid }),
  mongoose.connection.db.collection('inventorybatches').countDocuments({ productId: pid }),
]);
result = {
  onHand: summary ? Number(summary.onHand || 0) : 0,
  avgCost: summary ? Number(summary.avgCost || 0) : 0,
  summaryExists: !!summary,
  txCount,
  batchCount,
};
"@
}

function Get-ReturnRequestCountByOrder([string]$OrderId) {
    $orderIdJson = $OrderId | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label 'GetReturnRequestCountByOrder' -JavaScript @"
const oid = new ObjectId($orderIdJson);
const [totalCount, pendingCount, resolvedCount] = await Promise.all([
  mongoose.connection.db.collection('returnrequests').countDocuments({ orderId: oid }),
  mongoose.connection.db.collection('returnrequests').countDocuments({ orderId: oid, status: 'pending' }),
  mongoose.connection.db.collection('returnrequests').countDocuments({ orderId: oid, status: 'resolved' }),
]);
result = {
  totalCount,
  pendingCount,
  resolvedCount,
};
"@
}

function Get-CapitalPolicyState([string]$PolicyAId, [string]$PolicyBId) {
    $policyAJson = $PolicyAId | ConvertTo-Json -Compress
    $policyBJson = $PolicyBId | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label 'GetCapitalPolicyState' -JavaScript @"
const pidA = new ObjectId($policyAJson);
const pidB = new ObjectId($policyBJson);
const [activeCount, policyA, policyB] = await Promise.all([
  mongoose.connection.db.collection('capitalallocationpolicies').countDocuments({ isActive: true }),
  mongoose.connection.db.collection('capitalallocationpolicies').findOne({ _id: pidA }),
  mongoose.connection.db.collection('capitalallocationpolicies').findOne({ _id: pidB }),
]);
result = {
  activeCount,
  policyAIsActive: !!(policyA && policyA.isActive),
  policyBIsActive: !!(policyB && policyB.isActive),
};
"@
}

function Get-ProductDbState([string]$ProductId) {
    $productIdJson = $ProductId | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label 'GetProductDbState' -JavaScript @"
const pid = new ObjectId($productIdJson);
const product = await mongoose.connection.db.collection('products').findOne({ _id: pid });
result = product
  ? {
      exists: true,
      categoryId: product.categoryId ? String(product.categoryId) : null,
    }
  : {
      exists: false,
      categoryId: null,
    };
"@
}

function Assert-Equal([string]$Label, $Expected, $Actual) {
    if ("$Expected" -eq "$Actual") {
        Write-Pass "$Label = $Actual (expected: $Expected)"
    } else {
        Write-Fail "$Label = $Actual (expected: $Expected)"
    }
}

function Assert-True([string]$Label, [bool]$Condition, [string]$FailureMessage) {
    if ($Condition) {
        Write-Pass $Label
    } else {
        Write-Fail $FailureMessage
    }
}

function New-Category {
    param([hashtable]$Headers, [string]$Prefix)
    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/product-category" -Headers $Headers -Label "CreateCategory-$Prefix" -Body @{
        name = "$Prefix Category $stamp"
        description = "DB consistency category $stamp"
        color = '#228B22'
        order = 1
        code = "DBCAT-$($stamp.Substring($stamp.Length - 6))"
        isActive = $true
    }
}

function New-Product {
    param([hashtable]$Headers, [string]$CategoryId, [string]$Prefix)
    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/products" -Headers $Headers -Label "CreateProduct-$Prefix" -Body @{
        name = "$Prefix Product $stamp"
        categoryId = $CategoryId
        importPrice = 50000
        shippingCost = 12000
        packagingCost = 3000
        isReturnable = $true
        assumedReturnRatePercent = 8
        status = 'active'
    }
}

function New-UserBody {
    param([string]$Email, [string]$FullName)
    return @{
        fullName = $FullName
        email = $Email
        password = '123456'
        phone = "09$((Get-Random -Minimum 10000000 -Maximum 99999999))"
        role = 'employee'
        isActive = $true
    }
}

function New-OtherCost {
    param(
        [hashtable]$Headers,
        [string]$DateIso,
        [string]$DueDateIso,
        [decimal]$Amount,
        [string]$Category = 'other',
        [string]$Notes = 'DB consistency other-cost fixture'
    )

    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/other-cost" -Headers $Headers -Label 'CreateOtherCost' -Body @{
        date = $DateIso
        dueDate = $DueDateIso
        amount = $Amount
        category = $Category
        notes = $Notes
    }
}

function New-TestOrder {
    param(
        [hashtable]$Headers,
        [string]$CustomerName,
        [string]$AdGroupId,
        [string]$OrderDateIso,
        [string]$OrderStatus,
        [string]$ReceiverAddress,
        [string]$ServiceDetails
    )

    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/test-order2" -Headers $Headers -Label "CreateTestOrder-$CustomerName" -Body @{
        customerName = $CustomerName
        adGroupId = $AdGroupId
        orderDate = $OrderDateIso
        isActive = $true
        orderStatus = $OrderStatus
        productionStatus = 'QA-DB05-IDLE'
        receiverAddress = $ReceiverAddress
        serviceDetails = $ServiceDetails
    }
}

function Get-ListDataItems([object]$ResponseData) {
    $items = Get-FieldValue $ResponseData 'data'
    if ($items -is [array]) { return @($items) }
    if ($items) { return @($items) }
    return @()
}

function Get-PaginationValue([object]$ResponseData, [string]$Name) {
    $pagination = Get-FieldValue $ResponseData 'pagination'
    if ($null -eq $pagination) { return $null }
    return Get-FieldValue $pagination $Name
}

function Get-CashflowSnapshot {
    param(
        [string]$Domain,
        [int]$WindowDays
    )

    $domainJson = $Domain | ConvertTo-Json -Compress
    return Invoke-MongoJson -Label "GetCashflowSnapshot-$Domain-$WindowDays" -JavaScript @"
const snapshot = await mongoose.connection.db
  .collection('cashflow_summary_snapshots')
  .findOne({ domain: $domainJson, windowDays: $WindowDays });
result = snapshot
  ? {
      exists: true,
      updatedAt: snapshot.updatedAt ? new Date(snapshot.updatedAt).toISOString() : null,
      data: snapshot.data || null,
    }
  : {
      exists: false,
      updatedAt: null,
      data: null,
    };
"@
}

function Get-FinancialControlDashboard([hashtable]$Headers) {
    return Invoke-JsonRequest -Method GET -Uri "$BaseUrl/financial-control/dashboard?forceRefresh=true" -Headers $Headers -Label 'GetFinancialControlDashboard'
}

Write-Section "MODULE TEST: DB CONSISTENCY - $ts"
Write-Info "Base URL: $BaseUrl"
Write-Info "Mongo URI: $SuiteMongoUri"

try {
    Write-Section 'PHASE 0: Backend And Login'

    Write-Step '0.1' 'Start isolated backend'
    if (Start-IsolatedBackend) {
        Write-Pass "Backend healthy on $BaseUrl"
    } else {
        Write-Fail 'Isolated backend did not become healthy'
        throw 'backend-start-failed'
    }

    Write-Step '0.2' 'Ensure baseline regression users'
    if (Ensure-RegressionUsers) {
        Write-Pass 'Regression users ensured'
    } else {
        Write-Fail 'ensure-regression-users failed'
        throw 'setup-failed'
    }

    Write-Step '0.3' 'Login director'
    $login = Login-Director
    if (-not $login.success -or -not $login.data.access_token) {
        Write-Fail 'Director login failed'
        throw 'login-failed'
    }
    $headers = Get-AuthHeaders $login.data.access_token
    Write-Pass 'Director login OK'

    Write-Section 'PHASE 1: DB-01 / CON-08 Return Resolve Integrity'

    Write-Step '1.1' 'Create product fixture for return request'
    $rrCategory = New-Category -Headers $headers -Prefix 'Return'
    $rrCategoryId = Get-Id $rrCategory.data
    if (-not $rrCategory.success -or -not $rrCategoryId) {
        Write-Fail 'Return category create failed'
        throw 'return-category-failed'
    }
    $rrProduct = New-Product -Headers $headers -CategoryId $rrCategoryId -Prefix 'Return'
    $rrProductId = Get-Id $rrProduct.data
    if (-not $rrProduct.success -or -not $rrProductId) {
        Write-Fail 'Return product create failed'
        throw 'return-product-failed'
    }
    Write-Pass "Return product fixture created: $rrProductId"

    Write-Step '1.2' 'Create linked order + return request and verify item-id contract'
    $returnLinkedOrder = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/test-order2" -Headers $headers -Label 'CreateReturnLinkedOrder' -Body @{
        customerName = "DB01 Return Order $tsDigits"
        productId = $rrProductId
        quantity = 2
        adGroupId = "DB01-RETURN-$tsDigits"
        isActive = $true
        orderStatus = 'QA-RETURN-OPEN'
        productionStatus = 'QA-RETURN-IDLE'
        orderDate = '2026-04-19T10:00:00+07:00'
        codAmount = 250000
        shippingFee = 20000
        receiverName = 'DB01 Receiver'
        receiverPhone = '0900000001'
        receiverAddress = 'DB01 Address'
    }
    $returnLinkedOrderId = Get-Id $returnLinkedOrder.data
    if (-not $returnLinkedOrder.success -or -not $returnLinkedOrderId) {
        Write-Fail 'Linked return order create failed'
        throw 'return-linked-order-failed'
    }
    Write-Pass "Linked return order created: $returnLinkedOrderId"

    $rrCreate = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/returns" -Headers $headers -Label 'CreateReturnRequest' -Body @{
        orderId = $returnLinkedOrderId
        items = @(@{
            productId = $rrProductId
            quantityReturned = 2
            notes = 'DB consistency return fixture'
        })
        reason = 'DB consistency return fixture'
    }
    $rrId = Get-Id $rrCreate.data
    if (-not $rrCreate.success -or -not $rrId) {
        Write-Fail 'Return request create failed'
        throw 'return-create-failed'
    }
    $rrBefore = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/returns/$rrId" -Headers $headers -Label 'GetReturnBefore'
    $rrItems = @()
    if ($rrBefore.success -and $rrBefore.data.items) {
        $rrItems = @($rrBefore.data.items)
    }
    $realItemId = ''
    if ($rrItems.Count -gt 0) {
        $realItemId = Get-Id $rrItems[0]
    }
    Assert-True 'Return request fetched with one item' ($rrItems.Count -eq 1) "Return request item count mismatch: $($rrItems.Count)"
    Assert-True 'Return item exposes stable _id contract' (-not [string]::IsNullOrWhiteSpace($realItemId)) 'Return item _id is missing'

    $inventoryBefore = Get-InventoryState -ProductId $rrProductId
    if ($null -eq $inventoryBefore) { throw 'inventory-before-failed' }

    $rrCountAfterCreate = Get-ReturnRequestCountByOrder -OrderId $returnLinkedOrderId
    Assert-Equal 'Return request total count after first create' 1 $rrCountAfterCreate.totalCount
    Assert-Equal 'Return request pending count after first create' 1 $rrCountAfterCreate.pendingCount
    Assert-Equal 'Return request resolved count after first create' 0 $rrCountAfterCreate.resolvedCount

    Write-Step '1.3' 'Duplicate pending return create must fail and keep a single pending row'
    $rrDuplicateCreate = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/returns" -Headers $headers -Label 'CreateReturnRequestDuplicate' -Body @{
        orderId = $returnLinkedOrderId
        items = @(@{
            productId = $rrProductId
            quantityReturned = 2
            notes = 'DB consistency duplicate return fixture'
        })
        reason = 'DB consistency duplicate return fixture'
    }
    if ($rrDuplicateCreate.success) {
        Write-Fail "Duplicate return request unexpectedly succeeded with HTTP $($rrDuplicateCreate.statusCode)"
    } elseif ($rrDuplicateCreate.statusCode -eq 409) {
        Write-Pass 'Duplicate return request rejected with HTTP 409'
    } else {
        Write-Fail "Duplicate return request returned unexpected HTTP $($rrDuplicateCreate.statusCode)"
    }

    $rrCountAfterDupCreate = Get-ReturnRequestCountByOrder -OrderId $returnLinkedOrderId
    Assert-Equal 'Return request total count after duplicate create attempt' 1 $rrCountAfterDupCreate.totalCount
    Assert-Equal 'Return request pending count after duplicate create attempt' 1 $rrCountAfterDupCreate.pendingCount
    Assert-Equal 'Return request resolved count after duplicate create attempt' 0 $rrCountAfterDupCreate.resolvedCount

    Write-Step '1.4' 'Invalid itemId resolve must fail without partial write'
    $invalidResolve = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/returns/$rrId/resolve" -Headers $headers -Label 'ResolveReturnInvalidItem' -Body @{
        items = @(@{
            itemId = (New-ObjectIdString)
            decision = 'restock'
            quantity = 1
            recoveryUnitCost = 15000
        })
        reason = 'Invalid item should be rejected'
    }
    if ($invalidResolve.success) {
        Write-Fail "Invalid resolve unexpectedly succeeded with HTTP $($invalidResolve.statusCode)"
    } elseif ($invalidResolve.statusCode -in 400, 404) {
        Write-Pass "Invalid resolve rejected with HTTP $($invalidResolve.statusCode)"
    } else {
        Write-Fail "Invalid resolve returned unexpected HTTP $($invalidResolve.statusCode)"
    }

    $rrAfterInvalid = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/returns/$rrId" -Headers $headers -Label 'GetReturnAfterInvalid'
    $inventoryAfterInvalid = Get-InventoryState -ProductId $rrProductId
    Assert-Equal 'Return status after invalid resolve' 'pending' "$($rrAfterInvalid.data.status)"
    Assert-True 'Return item decision untouched after invalid resolve' (-not (Get-FieldValue $rrAfterInvalid.data.items[0] 'decision')) 'Return item decision was persisted after invalid resolve'
    Assert-Equal 'Inventory onHand unchanged after invalid resolve' $inventoryBefore.onHand $inventoryAfterInvalid.onHand
    Assert-Equal 'Inventory transaction count unchanged after invalid resolve' $inventoryBefore.txCount $inventoryAfterInvalid.txCount

    Write-Step '1.5' 'Valid resolve then duplicate resolve must preserve single-write state'
    if (-not [string]::IsNullOrWhiteSpace($realItemId)) {
        $validResolve = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/returns/$rrId/resolve" -Headers $headers -Label 'ResolveReturnValid' -Body @{
            items = @(@{
                itemId = $realItemId
                decision = 'restock'
                quantity = 2
                recoveryUnitCost = 12345
            })
            reason = 'Valid resolve'
        }
        if ($validResolve.success) {
            Write-Pass 'Valid resolve succeeded'
        } else {
            Write-Fail "Valid resolve failed with HTTP $($validResolve.statusCode)"
        }

        $rrAfterValid = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/returns/$rrId" -Headers $headers -Label 'GetReturnAfterValid'
        $inventoryAfterValid = Get-InventoryState -ProductId $rrProductId
        Assert-Equal 'Return status after valid resolve' 'resolved' "$($rrAfterValid.data.status)"
        Assert-Equal 'Inventory onHand after valid resolve' 2 $inventoryAfterValid.onHand
        Assert-Equal 'Inventory batch count after valid resolve' 1 $inventoryAfterValid.batchCount
        Assert-Equal 'Inventory transaction count after valid resolve' 1 $inventoryAfterValid.txCount

        $dupResolve = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/returns/$rrId/resolve" -Headers $headers -Label 'ResolveReturnDuplicate' -Body @{
            items = @(@{
                itemId = $realItemId
                decision = 'restock'
                quantity = 2
                recoveryUnitCost = 12345
            })
        }
        if ($dupResolve.success) {
            Write-Fail "Duplicate resolve unexpectedly succeeded with HTTP $($dupResolve.statusCode)"
        } elseif ($dupResolve.statusCode -eq 400) {
            Write-Pass 'Duplicate resolve rejected with HTTP 400'
        } else {
            Write-Fail "Duplicate resolve returned unexpected HTTP $($dupResolve.statusCode)"
        }

        $rrAfterDup = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/returns/$rrId" -Headers $headers -Label 'GetReturnAfterDup'
        $inventoryAfterDup = Get-InventoryState -ProductId $rrProductId
        Assert-Equal 'Return status after duplicate resolve' 'resolved' "$($rrAfterDup.data.status)"
        Assert-Equal 'Inventory onHand unchanged after duplicate resolve' $inventoryAfterValid.onHand $inventoryAfterDup.onHand
        Assert-Equal 'Inventory transaction count unchanged after duplicate resolve' $inventoryAfterValid.txCount $inventoryAfterDup.txCount
    }

    Write-Section 'PHASE 2: DB-02 Referential Consistency On Delete'

    Write-Step '2.1' 'Create category + product then attempt category delete'
    $refCategory = New-Category -Headers $headers -Prefix 'Ref'
    $refCategoryId = Get-Id $refCategory.data
    $refProduct = New-Product -Headers $headers -CategoryId $refCategoryId -Prefix 'Ref'
    $refProductId = Get-Id $refProduct.data
    if (-not $refCategory.success -or -not $refCategoryId -or -not $refProduct.success -or -not $refProductId) {
        Write-Fail 'Referential fixtures create failed'
        throw 'referential-fixtures-failed'
    }
    $deleteCategory = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/product-category/$refCategoryId" -Headers $headers -Label 'DeleteCategoryInUse'
    $categoryAfterDelete = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/product-category/$refCategoryId" -Headers $headers -Label 'GetCategoryAfterDelete'
    $productAfterDelete = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/products/$refProductId" -Headers $headers -Label 'GetProductAfterDelete'
    $productCategoryAfterDelete = Get-Id (Get-FieldValue $productAfterDelete.data 'categoryId')
    $productDbAfterDelete = Get-ProductDbState -ProductId $refProductId
    $productCategoryDbAfterDelete = if ($productDbAfterDelete) { $productDbAfterDelete.categoryId } else { $null }

    if ($deleteCategory.success) {
        $leftOrphan = $productDbAfterDelete.exists -and ($productCategoryDbAfterDelete -eq $refCategoryId)
        if ($leftOrphan) {
            Write-Fail "Category delete left orphan product reference: product $refProductId still points to deleted category $refCategoryId"
        } else {
            Write-Pass 'Category delete cleaned dependent references without orphan'
        }
    } elseif ($deleteCategory.statusCode -in 400, 409, 422) {
        $blockedCleanly = $categoryAfterDelete.success -and $productDbAfterDelete.exists -and ($productCategoryDbAfterDelete -eq $refCategoryId)
        Assert-True 'Category delete blocked while references still exist' $blockedCleanly "Category delete was blocked but state became inconsistent (categoryExists=$($categoryAfterDelete.success), productExists=$($productDbAfterDelete.exists), productCategoryDb=$productCategoryDbAfterDelete, productCategoryApi=$productCategoryAfterDelete)"
    } else {
        Write-Fail "Category delete returned unexpected HTTP $($deleteCategory.statusCode)"
    }

    Write-Section 'PHASE 3: DB-03 Duplicate And Unique Pressure'

    Write-Step '3.1' 'Duplicate email must not create duplicate rows'
    $dupEmail = "db-consistency.$tsDigits@test.com"
    $firstUser = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $headers -Label 'CreateUserFirst' -Body (New-UserBody -Email $dupEmail -FullName "DB Consistency First $tsDigits")
    if ($firstUser.success) {
        Write-Pass 'Initial user create succeeded'
    } else {
        Write-Fail "Initial user create failed with HTTP $($firstUser.statusCode)"
    }
    $secondUser = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $headers -Label 'CreateUserDuplicate' -Body (New-UserBody -Email $dupEmail -FullName "DB Consistency Second $tsDigits")
    if ($secondUser.success) {
        Write-Fail "Duplicate user create unexpectedly succeeded with HTTP $($secondUser.statusCode)"
    } elseif ($secondUser.statusCode -eq 409) {
        Write-Pass 'Duplicate user create rejected with HTTP 409'
    } else {
        Write-Fail "Duplicate user create returned unexpected HTTP $($secondUser.statusCode)"
    }
    $dupCount = Get-UserCountByEmail -Email $dupEmail
    Assert-Equal 'User count for duplicate email' 1 $dupCount.count

    Write-Section 'PHASE 4: DB-04 Read-After-Write And Snapshot Coherence'

    Write-Step '4.1' 'Create active policies and verify only one active row remains'
    $policyA = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/capital-allocation/policies" -Headers $headers -Label 'CreatePolicyA' -Body @{
        name = "QA DB Policy A $tsDigits"
        description = 'DB consistency policy A'
        reinvestmentRatio = 45
        safetyReserveRatio = 25
        personalIncomeRatio = 20
        longTermAssetRatio = 10
        isActive = $true
    }
    $policyAId = Get-Id $policyA.data
    $policyB = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/capital-allocation/policies" -Headers $headers -Label 'CreatePolicyB' -Body @{
        name = "QA DB Policy B $tsDigits"
        description = 'DB consistency policy B'
        reinvestmentRatio = 40
        safetyReserveRatio = 30
        personalIncomeRatio = 20
        longTermAssetRatio = 10
        isActive = $true
    }
    $policyBId = Get-Id $policyB.data
    if (-not $policyA.success -or -not $policyAId -or -not $policyB.success -or -not $policyBId) {
        Write-Fail 'Capital allocation policy setup failed'
        throw 'capital-policy-setup-failed'
    }
    $activePolicy = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/capital-allocation/policies/active" -Headers $headers -Label 'GetActivePolicy'
    $policyState = Get-CapitalPolicyState -PolicyAId $policyAId -PolicyBId $policyBId
    Assert-Equal 'Active policy after second create' $policyBId (Get-Id $activePolicy.data)
    Assert-Equal 'Active capital policy count in DB' 1 $policyState.activeCount
    Assert-Equal 'Policy A deactivated after policy B activation' False $policyState.policyAIsActive
    Assert-Equal 'Policy B active flag persisted' True $policyState.policyBIsActive

    Write-Step '4.2' 'Create snapshot and verify immediate list/latest coherence'
    $snapshot = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/capital-allocation/snapshots" -Headers $headers -Label 'CreateSnapshot' -Body @{
        note = "DB consistency snapshot $tsDigits"
        policyId = $policyBId
    }
    $snapshotId = Get-Id $snapshot.data
    if (-not $snapshot.success -or -not $snapshotId) {
        Write-Fail 'Capital allocation snapshot create failed'
        throw 'capital-snapshot-failed'
    }
    $snapshots = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/capital-allocation/snapshots?limit=5" -Headers $headers -Label 'ListSnapshots'
    $snapshotList = if ($snapshots.data -is [array]) { @($snapshots.data) } elseif ($snapshots.data) { @($snapshots.data) } else { @() }
    $latestSnapshot = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/capital-allocation/snapshots/latest" -Headers $headers -Label 'LatestSnapshot'
    Assert-True 'Snapshot list contains newly created snapshot' (@($snapshotList | Where-Object { (Get-Id $_) -eq $snapshotId }).Count -ge 1) "Snapshot list does not contain $snapshotId"
    Assert-Equal 'Latest snapshot id after create' $snapshotId (Get-Id $latestSnapshot.data)

    Write-Step '4.3' 'Update snapshot usage and verify read-after-write on latest endpoint'
    $usageUpdate = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/capital-allocation/snapshots/$snapshotId/usage" -Headers $headers -Label 'UpdateSnapshotUsage' -Body @{
        reinvestmentUsed = 12345
    }
    if ($usageUpdate.success) {
        Write-Pass 'Snapshot usage update succeeded'
    } else {
        Write-Fail "Snapshot usage update failed with HTTP $($usageUpdate.statusCode)"
    }
    $latestAfterUsage = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/capital-allocation/snapshots/latest" -Headers $headers -Label 'LatestSnapshotAfterUsage'
    Assert-Equal 'Latest snapshot reinvestmentUsed after update' 12345 (Get-FieldValue $latestAfterUsage.data 'reinvestmentUsed')

    Write-Section 'PHASE 5: DB-05 Pagination / Filter / Sort Stability Under Mutation'

    $db05AdGroupId = "DB05-ADG-$tsDigits"
    $db05CustomerPrefix = "DB05 Customer $tsDigits"
    $db05OrderStatus = 'QA-DB05-OPEN'
    $db05OrderDateIso = '2026-04-19T09:00:00+07:00'
    $db05Limit = 3
    $db05ListBaseUri = "$BaseUrl/test-order2?adGroupId=$([System.Uri]::EscapeDataString($db05AdGroupId))&q=$([System.Uri]::EscapeDataString($db05CustomerPrefix))&isActive=true&orderStatus=$([System.Uri]::EscapeDataString($db05OrderStatus))&sortBy=orderDate&sortOrder=desc"

    Write-Step '5.1' 'Create same-sort-key order fixtures and lock baseline dataset'
    $db05CreatedIds = @()
    foreach ($index in 1..6) {
        $order = New-TestOrder `
            -Headers $headers `
            -CustomerName "$db05CustomerPrefix Item $index" `
            -AdGroupId $db05AdGroupId `
            -OrderDateIso $db05OrderDateIso `
            -OrderStatus $db05OrderStatus `
            -ReceiverAddress "DB05 base address $index" `
            -ServiceDetails ("DB05 baseline payload " + ('A' * (180 + ($index * 40))))
        $orderId = Get-Id $order.data
        if ($order.success -and $orderId) {
            $db05CreatedIds += $orderId
        } else {
            Write-Fail "DB-05 fixture create failed at item $index with HTTP $($order.statusCode)"
            throw 'db05-create-fixture-failed'
        }
    }
    Assert-Equal 'DB-05 fixture create count' 6 $db05CreatedIds.Count

    $db05FullBefore = Invoke-JsonRequest -Method GET -Uri "$db05ListBaseUri&page=1&limit=20" -Headers $headers -Label 'DB05BaselineList'
    $db05BaselineItems = Get-ListDataItems $db05FullBefore.data
    $db05BaselineIds = @($db05BaselineItems | ForEach-Object { Get-Id $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $db05ExpectedIds = @($db05CreatedIds | Sort-Object)
    $db05BaselineSortedIds = @($db05BaselineIds | Sort-Object)
    $db05BaselineMissingIds = @($db05ExpectedIds | Where-Object { $db05BaselineSortedIds -notcontains $_ })
    $db05BaselineUnexpectedIds = @($db05BaselineSortedIds | Where-Object { $db05ExpectedIds -notcontains $_ })
    Assert-Equal 'DB-05 baseline pagination total' 6 (Get-PaginationValue $db05FullBefore.data 'total')
    Assert-Equal 'DB-05 baseline list count' 6 $db05BaselineIds.Count
    Assert-True 'DB-05 baseline list matches created ids' (($db05BaselineMissingIds.Count -eq 0) -and ($db05BaselineUnexpectedIds.Count -eq 0)) "DB-05 baseline list drifted from created ids. Missing=$($db05BaselineMissingIds -join ',') Unexpected=$($db05BaselineUnexpectedIds -join ',')"

    Write-Step '5.2' 'Repeated non-sort mutations must not destabilize page boundaries'
    $db05MetadataFailures = @()
    $db05OverlapFailures = @()
    $db05CoverageFailures = @()
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        $page1 = Invoke-JsonRequest -Method GET -Uri "$db05ListBaseUri&page=1&limit=$db05Limit" -Headers $headers -Label "DB05Page1Attempt$attempt"
        if (-not $page1.success) {
            $db05MetadataFailures += "Attempt $attempt page1 HTTP $($page1.statusCode)"
            continue
        }

        $page1Items = Get-ListDataItems $page1.data
        $page1Ids = @($page1Items | ForEach-Object { Get-Id $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $page1Total = Get-PaginationValue $page1.data 'total'
        $page1TotalPages = Get-PaginationValue $page1.data 'totalPages'

        if ($page1Total -ne 6 -or $page1TotalPages -ne 2 -or $page1Ids.Count -ne $db05Limit) {
            $db05MetadataFailures += "Attempt $attempt page1 metadata drifted: total=$page1Total totalPages=$page1TotalPages count=$($page1Ids.Count)"
        }

        foreach ($itemId in $page1Ids) {
            $mutation = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/test-order2/$itemId" -Headers $headers -Label "DB05MutateAttempt${attempt}_$itemId" -Body @{
                receiverAddress = "DB05 mutation attempt $attempt for $itemId"
                serviceDetails = "DB05 mutation attempt $attempt " + ('Z' * (900 + ($attempt * 120)))
            }
            if (-not $mutation.success) {
                $db05MetadataFailures += "Attempt $attempt mutation failed for $itemId with HTTP $($mutation.statusCode)"
            }
        }

        $page2 = Invoke-JsonRequest -Method GET -Uri "$db05ListBaseUri&page=2&limit=$db05Limit" -Headers $headers -Label "DB05Page2Attempt$attempt"
        if (-not $page2.success) {
            $db05MetadataFailures += "Attempt $attempt page2 HTTP $($page2.statusCode)"
            continue
        }

        $page2Items = Get-ListDataItems $page2.data
        $page2Ids = @($page2Items | ForEach-Object { Get-Id $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $page2Total = Get-PaginationValue $page2.data 'total'
        $page2TotalPages = Get-PaginationValue $page2.data 'totalPages'

        if ($page2Total -ne 6 -or $page2TotalPages -ne 2 -or $page2Ids.Count -ne $db05Limit) {
            $db05MetadataFailures += "Attempt $attempt page2 metadata drifted: total=$page2Total totalPages=$page2TotalPages count=$($page2Ids.Count)"
        }

        $overlapIds = @($page1Ids | Where-Object { $page2Ids -contains $_ } | Select-Object -Unique)
        if ($overlapIds.Count -gt 0) {
            $db05OverlapFailures += "Attempt $attempt overlapped ids: $($overlapIds -join ',')"
        }

        $combinedIds = @($page1Ids + $page2Ids | Select-Object -Unique | Sort-Object)
        $missingIds = @($db05ExpectedIds | Where-Object { $combinedIds -notcontains $_ })
        $unexpectedIds = @($combinedIds | Where-Object { $db05ExpectedIds -notcontains $_ })
        if ($combinedIds.Count -ne $db05ExpectedIds.Count -or $missingIds.Count -gt 0 -or $unexpectedIds.Count -gt 0) {
            $db05CoverageFailures += "Attempt $attempt combined pages drifted. Missing=$($missingIds -join ',') Unexpected=$($unexpectedIds -join ',') CombinedCount=$($combinedIds.Count)"
        }
    }

    Assert-True 'DB-05 metadata stays stable under mutation' ($db05MetadataFailures.Count -eq 0) ($db05MetadataFailures -join ' | ')
    Assert-True 'DB-05 page boundaries stay non-overlapping under mutation' ($db05OverlapFailures.Count -eq 0) ($db05OverlapFailures -join ' | ')
    Assert-True 'DB-05 page coverage stays complete under mutation' ($db05CoverageFailures.Count -eq 0) ($db05CoverageFailures -join ' | ')

    Write-Step '5.3' 'Full filtered list remains identical after mutation loop'
    $db05FullAfter = Invoke-JsonRequest -Method GET -Uri "$db05ListBaseUri&page=1&limit=20" -Headers $headers -Label 'DB05FullListAfterMutation'
    $db05AfterItems = Get-ListDataItems $db05FullAfter.data
    $db05AfterIds = @($db05AfterItems | ForEach-Object { Get-Id $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object)
    $db05AfterMissingIds = @($db05ExpectedIds | Where-Object { $db05AfterIds -notcontains $_ })
    $db05AfterUnexpectedIds = @($db05AfterIds | Where-Object { $db05ExpectedIds -notcontains $_ })
    Assert-Equal 'DB-05 final pagination total' 6 (Get-PaginationValue $db05FullAfter.data 'total')
    Assert-Equal 'DB-05 final full list count' 6 $db05AfterIds.Count
    Assert-True 'DB-05 final full list identity unchanged after mutation' (($db05AfterMissingIds.Count -eq 0) -and ($db05AfterUnexpectedIds.Count -eq 0)) "DB-05 final list drifted. Missing=$($db05AfterMissingIds -join ',') Unexpected=$($db05AfterUnexpectedIds -join ',')"

    Write-Section 'PHASE 6: CON-09 Other-Cost Timezone Boundary Ripple'

    $bangkokTz = [System.TimeZoneInfo]::FindSystemTimeZoneById('SE Asia Standard Time')
    $bangkokNow = [System.TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $bangkokTz)
    $boundaryDayIso = $bangkokNow.ToString('yyyy-MM-dd')
    $boundaryDateIso = "$boundaryDayIso`T00:30:00+07:00"
    $boundaryAmount = 654321

    $baselineBoundaryList = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'ListOtherCostBoundaryDayBaseline'
    $baselineBoundaryListItems = if ($baselineBoundaryList.data -is [array]) { @($baselineBoundaryList.data) } elseif ($baselineBoundaryList.data) { @($baselineBoundaryList.data) } else { @() }
    $baselineBoundarySummary = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'OtherCostSummaryBoundaryDayBaseline'
    $baselineBoundaryCount = [int](Get-FieldValue $baselineBoundarySummary.data 'count')
    $baselineBoundaryAmount = [decimal](Get-FieldValue $baselineBoundarySummary.data 'totalAmount')

    $baselineCashflow = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary/cashflow?windowDays=14" -Headers $headers -Label 'BoundaryOtherCostCashflowBaseline'
    $baselineCashflowPaid = [decimal](Get-FieldValue $baselineCashflow.data 'totalOpsPaid')
    $baselineCashflowUnpaid = [decimal](Get-FieldValue $baselineCashflow.data 'totalOpsUnpaid')
    $baselineCashflowDue14d = [decimal](Get-FieldValue $baselineCashflow.data 'totalOpsDue14d')
    $baselineDueByDay = if ($baselineCashflow.data.dueByDay7d) { @($baselineCashflow.data.dueByDay7d) } else { @() }
    $baselineDueTodayEntry = @($baselineDueByDay | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $baselineDueTodayAmount = if ($baselineDueTodayEntry.Count -gt 0) { [decimal](Get-FieldValue $baselineDueTodayEntry[0] 'amount') } else { 0 }
    $baselineDueTodayCount = if ($baselineDueTodayEntry.Count -gt 0) { [int](Get-FieldValue $baselineDueTodayEntry[0] 'count') } else { 0 }
    $baselineAlertsText = (($baselineCashflow.data.alerts | ForEach-Object { "$_" }) -join ' | ')

    $opsSnapshotBeforeBoundary = Get-CashflowSnapshot -Domain 'ops' -WindowDays 14
    $opsDueBeforeBoundary = if ($opsSnapshotBeforeBoundary -and $opsSnapshotBeforeBoundary.exists -and $opsSnapshotBeforeBoundary.data) { [decimal](Get-FieldValue $opsSnapshotBeforeBoundary.data 'totalOpsDue14d') } else { 0 }
    $opsPaidBeforeBoundary = if ($opsSnapshotBeforeBoundary -and $opsSnapshotBeforeBoundary.exists -and $opsSnapshotBeforeBoundary.data) { [decimal](Get-FieldValue $opsSnapshotBeforeBoundary.data 'totalOpsPaid') } else { 0 }
    $opsDueByDayBeforeBoundary = if ($opsSnapshotBeforeBoundary -and $opsSnapshotBeforeBoundary.data -and $opsSnapshotBeforeBoundary.data.dueByDay7d) { @($opsSnapshotBeforeBoundary.data.dueByDay7d) } else { @() }
    $opsDueTodayBeforeEntry = @($opsDueByDayBeforeBoundary | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $opsDueTodayBeforeAmount = if ($opsDueTodayBeforeEntry.Count -gt 0) { [decimal](Get-FieldValue $opsDueTodayBeforeEntry[0] 'amount') } else { 0 }
    $opsDueTodayBeforeCount = if ($opsDueTodayBeforeEntry.Count -gt 0) { [int](Get-FieldValue $opsDueTodayBeforeEntry[0] 'count') } else { 0 }

    Write-Step '6.1' 'Create other-cost at Asia/Bangkok midnight boundary'
    $fcBeforeBoundary = Get-FinancialControlDashboard -Headers $headers
    $fcCommittedBeforeBoundary = if ($fcBeforeBoundary.success) { [decimal](Get-FieldValue $fcBeforeBoundary.data 'committedCash') } else { 0 }
    $boundaryCost = New-OtherCost -Headers $headers -DateIso $boundaryDateIso -DueDateIso $boundaryDateIso -Amount $boundaryAmount -Category 'utilities' -Notes "CON-09 boundary $tsDigits"
    $boundaryCostId = Get-Id $boundaryCost.data
    if (-not $boundaryCost.success -or -not $boundaryCostId) {
        Write-Fail 'Boundary other-cost create failed'
        throw 'boundary-other-cost-create-failed'
    }
    Write-Pass "Boundary other-cost created: $boundaryCostId"

    Write-Step '6.2' 'Date-only filter and summary must honor Bangkok business day'
    $boundaryList = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'ListOtherCostBoundaryDay'
    $boundaryListItems = if ($boundaryList.data -is [array]) { @($boundaryList.data) } elseif ($boundaryList.data) { @($boundaryList.data) } else { @() }
    $boundaryListHit = @($boundaryListItems | Where-Object { (Get-Id $_) -eq $boundaryCostId }).Count
    Assert-True 'Boundary cost appears in same-day filtered list' ($boundaryListHit -ge 1) "Boundary cost $boundaryCostId missing from same-day list for $boundaryDayIso"

    $boundarySummary = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'OtherCostSummaryBoundaryDay'
    Assert-Equal 'Same-day other-cost summary count' ($baselineBoundaryCount + 1) (Get-FieldValue $boundarySummary.data 'count')
    Assert-Equal 'Same-day other-cost summary amount' ($baselineBoundaryAmount + $boundaryAmount) (Get-FieldValue $boundarySummary.data 'totalAmount')

    Write-Step '6.3' 'Cashflow summary must not shift same-day dueDate into overdue/yesterday'
    $boundaryCashflow = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary/cashflow?windowDays=14" -Headers $headers -Label 'BoundaryOtherCostCashflow'
    $boundaryDueByDay = if ($boundaryCashflow.data.dueByDay7d) { @($boundaryCashflow.data.dueByDay7d) } else { @() }
    $boundaryDueTodayEntry = @($boundaryDueByDay | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $boundaryDueTodayAmount = if ($boundaryDueTodayEntry.Count -gt 0) { [decimal](Get-FieldValue $boundaryDueTodayEntry[0] 'amount') } else { 0 }
    $boundaryDueTodayCount = if ($boundaryDueTodayEntry.Count -gt 0) { [int](Get-FieldValue $boundaryDueTodayEntry[0] 'count') } else { 0 }
    $boundaryAlertsText = (($boundaryCashflow.data.alerts | ForEach-Object { "$_" }) -join ' | ')
    Assert-Equal 'Boundary cashflow unpaid total before confirm' ($baselineCashflowUnpaid + $boundaryAmount) (Get-FieldValue $boundaryCashflow.data 'totalOpsUnpaid')
    Assert-Equal 'Boundary cashflow due14d before confirm' ($baselineCashflowDue14d + $boundaryAmount) (Get-FieldValue $boundaryCashflow.data 'totalOpsDue14d')
    Assert-Equal 'Boundary dueByDay7d amount keeps Bangkok calendar date' ($baselineDueTodayAmount + $boundaryAmount) $boundaryDueTodayAmount
    Assert-Equal 'Boundary dueByDay7d count keeps Bangkok calendar date' ($baselineDueTodayCount + 1) $boundaryDueTodayCount
    Assert-Equal 'Boundary overdue alerts stay unchanged on same Bangkok day' $baselineAlertsText $boundaryAlertsText

    Write-Step '6.4' 'Ops snapshot and financial-control must converge to boundary amount'
    $opsSnapshotBoundary = $null
    $fcBoundary = $null
    $opsDeadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 400
        $opsSnapshotBoundary = Get-CashflowSnapshot -Domain 'ops' -WindowDays 14
        $fcBoundary = Get-FinancialControlDashboard -Headers $headers
        $opsDue = if ($opsSnapshotBoundary -and $opsSnapshotBoundary.exists -and $opsSnapshotBoundary.data) { [decimal](Get-FieldValue $opsSnapshotBoundary.data 'totalOpsDue14d') } else { -1 }
        $fcCommitted = if ($fcBoundary.success) { [decimal](Get-FieldValue $fcBoundary.data 'committedCash') } else { -1 }
    } while ((($opsDue -ne ($opsDueBeforeBoundary + $boundaryAmount)) -or ($fcCommitted -ne ($fcCommittedBeforeBoundary + $boundaryAmount))) -and ((Get-Date) -lt $opsDeadline))
    $opsBoundaryDueByDay = if ($opsSnapshotBoundary -and $opsSnapshotBoundary.data -and $opsSnapshotBoundary.data.dueByDay7d) { @($opsSnapshotBoundary.data.dueByDay7d) } else { @() }
    $opsBoundaryDueTodayEntry = @($opsBoundaryDueByDay | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $opsBoundaryDueTodayAmount = if ($opsBoundaryDueTodayEntry.Count -gt 0) { [decimal](Get-FieldValue $opsBoundaryDueTodayEntry[0] 'amount') } else { 0 }
    $opsBoundaryDueTodayCount = if ($opsBoundaryDueTodayEntry.Count -gt 0) { [int](Get-FieldValue $opsBoundaryDueTodayEntry[0] 'count') } else { 0 }
    Assert-Equal 'Ops snapshot due14d after boundary create' ($opsDueBeforeBoundary + $boundaryAmount) $opsDue
    Assert-Equal 'Ops snapshot dueByDay7d amount keeps Bangkok date' ($opsDueTodayBeforeAmount + $boundaryAmount) $opsBoundaryDueTodayAmount
    Assert-Equal 'Ops snapshot dueByDay7d count keeps Bangkok date' ($opsDueTodayBeforeCount + 1) $opsBoundaryDueTodayCount
    Assert-Equal 'Financial-control committedCash after boundary create' ($fcCommittedBeforeBoundary + $boundaryAmount) $fcCommitted

    Write-Step '6.5' 'Confirm boundary other-cost and verify unpaid->paid ripple'
    $confirmBoundary = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/other-cost/$boundaryCostId/confirm" -Headers $headers -Label 'ConfirmBoundaryOtherCost'
    if ($confirmBoundary.success -and (Get-FieldValue $confirmBoundary.data 'isConfirmed')) {
        Write-Pass 'Boundary other-cost confirm succeeded'
    } else {
        Write-Fail "Boundary other-cost confirm failed with HTTP $($confirmBoundary.statusCode)"
    }
    $boundaryCashflowAfterConfirm = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary/cashflow?windowDays=14" -Headers $headers -Label 'BoundaryOtherCostCashflowAfterConfirm'
    $boundaryDueByDayAfterConfirm = if ($boundaryCashflowAfterConfirm.data.dueByDay7d) { @($boundaryCashflowAfterConfirm.data.dueByDay7d) } else { @() }
    $boundaryDueTodayAfterConfirmEntry = @($boundaryDueByDayAfterConfirm | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $boundaryDueTodayAfterConfirmAmount = if ($boundaryDueTodayAfterConfirmEntry.Count -gt 0) { [decimal](Get-FieldValue $boundaryDueTodayAfterConfirmEntry[0] 'amount') } else { 0 }
    $boundaryDueTodayAfterConfirmCount = if ($boundaryDueTodayAfterConfirmEntry.Count -gt 0) { [int](Get-FieldValue $boundaryDueTodayAfterConfirmEntry[0] 'count') } else { 0 }
    $boundaryAlertsAfterConfirmText = (($boundaryCashflowAfterConfirm.data.alerts | ForEach-Object { "$_" }) -join ' | ')
    Assert-Equal 'Boundary cashflow paid total after confirm' ($baselineCashflowPaid + $boundaryAmount) (Get-FieldValue $boundaryCashflowAfterConfirm.data 'totalOpsPaid')
    Assert-Equal 'Boundary cashflow unpaid total after confirm' $baselineCashflowUnpaid (Get-FieldValue $boundaryCashflowAfterConfirm.data 'totalOpsUnpaid')
    Assert-Equal 'Boundary cashflow due14d after confirm' $baselineCashflowDue14d (Get-FieldValue $boundaryCashflowAfterConfirm.data 'totalOpsDue14d')
    Assert-Equal 'Boundary dueByDay7d amount after confirm reverts to baseline' $baselineDueTodayAmount $boundaryDueTodayAfterConfirmAmount
    Assert-Equal 'Boundary dueByDay7d count after confirm reverts to baseline' $baselineDueTodayCount $boundaryDueTodayAfterConfirmCount
    Assert-Equal 'Boundary overdue alerts after confirm revert to baseline' $baselineAlertsText $boundaryAlertsAfterConfirmText

    $opsSnapshotAfterConfirm = $null
    $fcAfterConfirm = $null
    $confirmDeadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 400
        $opsSnapshotAfterConfirm = Get-CashflowSnapshot -Domain 'ops' -WindowDays 14
        $fcAfterConfirm = Get-FinancialControlDashboard -Headers $headers
        $opsDueAfterConfirm = if ($opsSnapshotAfterConfirm -and $opsSnapshotAfterConfirm.exists -and $opsSnapshotAfterConfirm.data) { [decimal](Get-FieldValue $opsSnapshotAfterConfirm.data 'totalOpsDue14d') } else { -1 }
        $opsPaidAfterConfirm = if ($opsSnapshotAfterConfirm -and $opsSnapshotAfterConfirm.exists -and $opsSnapshotAfterConfirm.data) { [decimal](Get-FieldValue $opsSnapshotAfterConfirm.data 'totalOpsPaid') } else { -1 }
        $fcCommittedAfterConfirm = if ($fcAfterConfirm.success) { [decimal](Get-FieldValue $fcAfterConfirm.data 'committedCash') } else { -1 }
    } while ((($opsDueAfterConfirm -ne $opsDueBeforeBoundary) -or ($opsPaidAfterConfirm -ne ($opsPaidBeforeBoundary + $boundaryAmount)) -or ($fcCommittedAfterConfirm -ne $fcCommittedBeforeBoundary)) -and ((Get-Date) -lt $confirmDeadline))
    $opsDueByDayAfterConfirm = if ($opsSnapshotAfterConfirm -and $opsSnapshotAfterConfirm.data -and $opsSnapshotAfterConfirm.data.dueByDay7d) { @($opsSnapshotAfterConfirm.data.dueByDay7d) } else { @() }
    $opsDueTodayAfterConfirmEntry = @($opsDueByDayAfterConfirm | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $opsDueTodayAfterConfirmAmount = if ($opsDueTodayAfterConfirmEntry.Count -gt 0) { [decimal](Get-FieldValue $opsDueTodayAfterConfirmEntry[0] 'amount') } else { 0 }
    $opsDueTodayAfterConfirmCount = if ($opsDueTodayAfterConfirmEntry.Count -gt 0) { [int](Get-FieldValue $opsDueTodayAfterConfirmEntry[0] 'count') } else { 0 }
    Assert-Equal 'Ops snapshot due14d after confirm' $opsDueBeforeBoundary $opsDueAfterConfirm
    Assert-Equal 'Ops snapshot paid total after confirm' ($opsPaidBeforeBoundary + $boundaryAmount) $opsPaidAfterConfirm
    Assert-Equal 'Ops snapshot dueByDay7d amount after confirm reverts to baseline' $opsDueTodayBeforeAmount $opsDueTodayAfterConfirmAmount
    Assert-Equal 'Ops snapshot dueByDay7d count after confirm reverts to baseline' $opsDueTodayBeforeCount $opsDueTodayAfterConfirmCount
    Assert-Equal 'Financial-control committedCash after confirm' $fcCommittedBeforeBoundary $fcCommittedAfterConfirm

    Write-Step '6.6' 'Delete boundary other-cost and verify same-day cleanup'
    $deleteBoundaryCost = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/other-cost/$boundaryCostId" -Headers $headers -Label 'DeleteBoundaryOtherCost'
    if ($deleteBoundaryCost.success) {
        Write-Pass 'Boundary other-cost delete succeeded'
    } else {
        Write-Fail "Boundary other-cost delete failed with HTTP $($deleteBoundaryCost.statusCode)"
    }

    $boundaryListAfterDelete = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'ListBoundaryDayAfterDelete'
    $boundaryListAfterDeleteItems = if ($boundaryListAfterDelete.data -is [array]) { @($boundaryListAfterDelete.data) } elseif ($boundaryListAfterDelete.data) { @($boundaryListAfterDelete.data) } else { @() }
    $boundarySummaryAfterDelete = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/other-cost/summary?from=$boundaryDayIso&to=$boundaryDayIso" -Headers $headers -Label 'OtherCostSummaryBoundaryDayAfterDelete'
    Assert-Equal 'Same-day filtered list after delete' 0 (@($boundaryListAfterDeleteItems | Where-Object { (Get-Id $_) -eq $boundaryCostId }).Count)
    Assert-Equal 'Same-day other-cost summary count after delete' $baselineBoundaryCount (Get-FieldValue $boundarySummaryAfterDelete.data 'count')
    Assert-Equal 'Same-day other-cost summary amount after delete' $baselineBoundaryAmount (Get-FieldValue $boundarySummaryAfterDelete.data 'totalAmount')

    $opsSnapshotAfterDelete = $null
    $fcAfterDelete = $null
    $deleteDeadline = (Get-Date).AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 400
        $opsSnapshotAfterDelete = Get-CashflowSnapshot -Domain 'ops' -WindowDays 14
        $fcAfterDelete = Get-FinancialControlDashboard -Headers $headers
        $opsDueAfterDelete = if ($opsSnapshotAfterDelete -and $opsSnapshotAfterDelete.exists -and $opsSnapshotAfterDelete.data) { [decimal](Get-FieldValue $opsSnapshotAfterDelete.data 'totalOpsDue14d') } else { -1 }
        $opsPaidAfterDelete = if ($opsSnapshotAfterDelete -and $opsSnapshotAfterDelete.exists -and $opsSnapshotAfterDelete.data) { [decimal](Get-FieldValue $opsSnapshotAfterDelete.data 'totalOpsPaid') } else { -1 }
        $fcCommittedAfterDelete = if ($fcAfterDelete.success) { [decimal](Get-FieldValue $fcAfterDelete.data 'committedCash') } else { -1 }
    } while ((($opsDueAfterDelete -ne $opsDueBeforeBoundary) -or ($opsPaidAfterDelete -ne $opsPaidBeforeBoundary) -or ($fcCommittedAfterDelete -ne $fcCommittedBeforeBoundary)) -and ((Get-Date) -lt $deleteDeadline))
    $opsDueByDayAfterDelete = if ($opsSnapshotAfterDelete -and $opsSnapshotAfterDelete.data -and $opsSnapshotAfterDelete.data.dueByDay7d) { @($opsSnapshotAfterDelete.data.dueByDay7d) } else { @() }
    $opsDueTodayAfterDeleteEntry = @($opsDueByDayAfterDelete | Where-Object { (Get-FieldValue $_ 'date') -eq $boundaryDayIso } | Select-Object -First 1)
    $opsDueTodayAfterDeleteAmount = if ($opsDueTodayAfterDeleteEntry.Count -gt 0) { [decimal](Get-FieldValue $opsDueTodayAfterDeleteEntry[0] 'amount') } else { 0 }
    $opsDueTodayAfterDeleteCount = if ($opsDueTodayAfterDeleteEntry.Count -gt 0) { [int](Get-FieldValue $opsDueTodayAfterDeleteEntry[0] 'count') } else { 0 }
    Assert-Equal 'Ops snapshot due14d after delete' $opsDueBeforeBoundary $opsDueAfterDelete
    Assert-Equal 'Ops snapshot paid total after delete' $opsPaidBeforeBoundary $opsPaidAfterDelete
    Assert-Equal 'Ops snapshot dueByDay7d amount after delete reverts to baseline' $opsDueTodayBeforeAmount $opsDueTodayAfterDeleteAmount
    Assert-Equal 'Ops snapshot dueByDay7d count after delete reverts to baseline' $opsDueTodayBeforeCount $opsDueTodayAfterDeleteCount
    Assert-Equal 'Financial-control committedCash after delete' $fcCommittedBeforeBoundary $fcCommittedAfterDelete
}
finally {
    Write-Section 'SUMMARY'
    Write-Host "Total: $($script:passCount + $script:failCount) | PASS: $($script:passCount) | FAIL: $($script:failCount)"
    if ($script:failCount -gt 0) {
        Write-Host ''
        Write-Host 'Failed tests:' -ForegroundColor Red
        $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    Stop-IsolatedBackend
}

if ($script:failCount -gt 0) { exit 1 }
exit 0
