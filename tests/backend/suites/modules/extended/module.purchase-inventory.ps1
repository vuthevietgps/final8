#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.PURCHASE-INVENTORY.PS1
    =====================================================================================
    Target coverage:
    - BE-SUP-04: purchase order -> partial receive -> final receive -> inventory summary
      -> inventory transactions -> purchase price history
    - Guard / negative path: protected endpoints require auth, invalid receive must not write
    - Ripple / reporting: supplier report reflects received quantities and costs
    =====================================================================================
#>

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
New-Item -ItemType Directory -Force -Path $ResultsDir | Out-Null

$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$tsDigits = $ts -replace '[^0-9]', ''
$SuitePort = if ($env:PURCHASE_INVENTORY_PORT) { [int]$env:PURCHASE_INVENTORY_PORT } else { 3686 }
$SuiteMongoUri =
    if ($env:PURCHASE_INVENTORY_MONGODB_URI) { $env:PURCHASE_INVENTORY_MONGODB_URI.Trim() }
    else { "mongodb://127.0.0.1:27017/htxbachgia_purchase_inventory_$tsDigits" }

$BaseUrl = "http://localhost:$SuitePort/api"
$HealthUrl = "http://localhost:$SuitePort/health"
$TempBackendOut = Join-Path $ResultsDir "tmp-purchase-inventory-$SuitePort-$ts.out.log"
$TempBackendErr = Join-Path $ResultsDir "tmp-purchase-inventory-$SuitePort-$ts.err.log"

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

function Get-CollectionItems {
    param($Data)

    if ($null -eq $Data) { return ,@() }
    if ($Data -is [System.Array]) { return ,@($Data) }
    if ($Data.data -is [System.Array] -or $Data.data) { return ,@($Data.data) }
    if ($Data.items -is [System.Array] -or $Data.items) { return ,@($Data.items) }
    return ,@()
}

function N0($Value) {
    if ($null -eq $Value) { return 0.0 }
    try { return [double]$Value } catch { return 0.0 }
}

function New-ObjectIdString {
    return -join ((1..24) | ForEach-Object { '{0:x}' -f (Get-Random -Minimum 0 -Maximum 16) })
}

function Assert-Equal([string]$Label, $Expected, $Actual) {
    if ("$Expected" -eq "$Actual") {
        Write-Pass "$Label = $Actual (expected: $Expected)"
    } else {
        Write-Fail "$Label = $Actual (expected: $Expected)"
    }
}

function Assert-Approx([double]$Actual, [double]$Expected, [double]$Tolerance, [string]$Label) {
    $diff = [Math]::Abs($Actual - $Expected)
    if ($diff -le $Tolerance) {
        Write-Pass "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
    } else {
        Write-Fail "$Label (actual=$Actual, expected=$Expected, diff=$diff, tolerance=$Tolerance)"
    }
}

function Assert-True([string]$Label, [bool]$Condition, [string]$FailureMessage = $null) {
    if ($Condition) {
        Write-Pass $Label
    } else {
        Write-Fail $(if ($FailureMessage) { $FailureMessage } else { $Label })
    }
}

function Start-IsolatedBackend {
    $existingListener = Get-NetTCPConnection -LocalPort $SuitePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingListener -and $existingListener.OwningProcess) {
        Write-Info "Stopping pre-existing listener on port $SuitePort (PID $($existingListener.OwningProcess))"
        try { Stop-Process -Id $existingListener.OwningProcess -Force -ErrorAction Stop } catch {}
        Start-Sleep -Seconds 2
    }

    $command = "Set-Location '$BackendDir'; `$env:PORT='$SuitePort'; `$env:MONGODB_URI='$SuiteMongoUri'; node dist/main.js"
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
        & powershell -ExecutionPolicy Bypass -File $setupScript
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

function Get-UserByEmail {
    param(
        [hashtable]$Headers,
        [string]$Email
    )

    $encoded = [uri]::EscapeDataString($Email)
    $resp = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/email/$encoded" -Headers $Headers -Label "GetUserByEmail-$Email"
    if (-not $resp.success) { return $null }
    return $resp.data
}

function New-Category {
    param(
        [hashtable]$Headers,
        [string]$Prefix
    )

    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/product-category" -Headers $Headers -Label "CreateCategory-$Prefix" -Body @{
        name = "$Prefix Category $stamp"
        description = "Purchase inventory category $stamp"
        color = '#1D4ED8'
        order = 1
        code = "POINV-$($stamp.Substring($stamp.Length - 6))"
        isActive = $true
    }
}

function New-Product {
    param(
        [hashtable]$Headers,
        [string]$CategoryId,
        [string]$Prefix,
        [double]$ImportPrice
    )

    $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
    return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/products" -Headers $Headers -Label "CreateProduct-$Prefix" -Body @{
        name = "$Prefix Product $stamp"
        categoryId = $CategoryId
        importPrice = $ImportPrice
        shippingCost = 12000
        packagingCost = 3000
        isReturnable = $true
        assumedReturnRatePercent = 8
        status = 'active'
    }
}

function Get-PurchaseOrder {
    param(
        [hashtable]$Headers,
        [string]$PurchaseOrderId,
        [string]$Label = 'GetPurchaseOrder'
    )

    return Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders/$PurchaseOrderId" -Headers $Headers -Label $Label
}

function Get-PurchaseLineByProductId {
    param(
        [object]$PurchaseOrderData,
        [string]$ProductId
    )

    $items = Get-FieldValue $PurchaseOrderData 'items'
    if (-not $items) { return $null }
    return @($items | Where-Object { (Get-Id (Get-FieldValue $_ 'productId')) -eq $ProductId -or [string](Get-FieldValue $_ 'productId') -eq $ProductId } | Select-Object -First 1)
}

function Get-InventorySummaryRow {
    param(
        [hashtable]$Headers,
        [string]$Search,
        [string]$ProductId
    )

    $q = [uri]::EscapeDataString($Search)
    $resp = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/inventory/summary?page=1&limit=50&q=$q" -Headers $Headers -Label "InventorySummary-$Search"
    if (-not $resp.success) {
        return @{ response = $resp; row = $null; items = @() }
    }
    $items = Get-CollectionItems $resp.data
    $row = @($items | Where-Object { [string](Get-FieldValue $_ 'productId') -eq $ProductId } | Select-Object -First 1)
    return @{ response = $resp; row = $(if ($row.Count -gt 0) { $row[0] } else { $null }); items = $items }
}

function Get-InventoryTransactions {
    param(
        [hashtable]$Headers,
        [string]$ProductId
    )

    $resp = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/inventory/$ProductId/transactions?page=1&limit=50" -Headers $Headers -Label "InventoryTransactions-$ProductId"
    return @{
        response = $resp
        items = $(if ($resp.success) { Get-CollectionItems $resp.data } else { @() })
    }
}

function Get-PriceHistory {
    param(
        [hashtable]$Headers,
        [string]$ProductId,
        [string]$SupplierId
    )

    $uri = "$BaseUrl/purchase-orders/price-history?productId=$ProductId&supplierId=$SupplierId&limit=20"
    $resp = Invoke-JsonRequest -Method GET -Uri $uri -Headers $Headers -Label "PurchasePriceHistory-$ProductId"
    return @{
        response = $resp
        items = $(if ($resp.success) { Get-CollectionItems $resp.data } else { @() })
        stats = $(if ($resp.success) { Get-FieldValue $resp.data 'stats' } else { $null })
    }
}

function Get-SupplierReport {
    param(
        [hashtable]$Headers,
        [string]$SupplierId
    )

    return Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders/supplier-report?supplierId=$SupplierId" -Headers $Headers -Label "PurchaseSupplierReport-$SupplierId"
}

try {
    Write-Section "MODULE TEST: PURCHASE -> INVENTORY -> PRICE HISTORY - $ts"
    Write-Info "Base URL: $BaseUrl"
    Write-Info "Mongo URI: $SuiteMongoUri"

    Write-Section 'PHASE 0: Backend, Guards, And Fixture Bootstrap'

    Write-Step '0.1' 'Start isolated backend'
    if (Start-IsolatedBackend) {
        Write-Pass "Backend healthy on $BaseUrl"
    } else {
        Write-Fail "Backend failed to boot. stdout=$TempBackendOut stderr=$TempBackendErr"
        throw 'purchase-inventory-backend-start-failed'
    }

    Write-Step '0.2' 'Ensure baseline regression users'
    if (Ensure-RegressionUsers) {
        Write-Pass 'Regression users ensured'
    } else {
        Write-Fail 'Regression user setup failed'
        throw 'purchase-inventory-regression-users-failed'
    }

    Write-Step '0.3' 'Protected purchase/inventory routes reject anonymous requests'
    $anonPurchaseList = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders" -Label 'AnonymousPurchaseList'
    $anonInventorySummary = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/inventory/summary" -Label 'AnonymousInventorySummary'
    Assert-Equal 'Anonymous purchase list returns 401' 401 $anonPurchaseList.statusCode
    Assert-Equal 'Anonymous inventory summary returns 401' 401 $anonInventorySummary.statusCode

    Write-Step '0.4' 'Login director and resolve canonical supplier'
    $login = Login-Director
    if (-not ($login.success -and (Get-FieldValue $login.data 'access_token'))) {
        Write-Fail 'Director login failed'
        throw 'purchase-inventory-login-failed'
    }
    $token = [string](Get-FieldValue $login.data 'access_token')
    $headers = Get-AuthHeaders -Token $token
    Write-Pass 'Director login succeeded'

    $supplier = Get-UserByEmail -Headers $headers -Email 'internal-supplier@test.com'
    $supplierId = Get-Id $supplier
    if (-not $supplierId) {
        Write-Fail 'Canonical internal supplier fixture missing'
        throw 'purchase-inventory-supplier-missing'
    }
    $supplierName = [string]($(Get-FieldValue $supplier 'fullName'))
    Write-Pass "Supplier fixture resolved: $supplierId"

    Write-Step '0.5' 'Create product category and products'
    $prefix = "BE-SUP-04-$tsDigits"
    $categoryResp = New-Category -Headers $headers -Prefix $prefix
    $categoryId = Get-Id $categoryResp.data
    if (-not ($categoryResp.success -and $categoryId)) {
        Write-Fail 'Category fixture create failed'
        throw 'purchase-inventory-category-create-failed'
    }
    Write-Pass "Category created: $categoryId"

    $productAResp = New-Product -Headers $headers -CategoryId $categoryId -Prefix "$prefix-A" -ImportPrice 100000
    $productBResp = New-Product -Headers $headers -CategoryId $categoryId -Prefix "$prefix-B" -ImportPrice 50000
    $productAId = Get-Id $productAResp.data
    $productBId = Get-Id $productBResp.data
    if (-not ($productAResp.success -and $productAId -and $productBResp.success -and $productBId)) {
        Write-Fail 'Product fixture create failed'
        throw 'purchase-inventory-product-create-failed'
    }
    $productAName = [string](Get-FieldValue $productAResp.data 'name')
    $productBName = [string](Get-FieldValue $productBResp.data 'name')
    Write-Pass "Product A created: $productAId"
    Write-Pass "Product B created: $productBId"

    Write-Section 'PHASE 1: Create Purchase Order Baseline'

    Write-Step '1.1' 'Create primary purchase order with two products'
    $po1Resp = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders" -Headers $headers -Label 'CreatePurchaseOrder1' -Body @{
        supplierId = $supplierId
        supplierNameSnap = $supplierName
        status = 'ordered'
        expectedDeliveryDate = (Get-Date).AddDays(3).ToString('s') + 'Z'
        shippingFee = 30000
        tax = 20000
        discount = 10000
        notes = "Primary purchase order $tsDigits"
        items = @(
            @{
                productId = $productAId
                productNameSnap = $productAName
                quantity = 10
                unitPrice = 100000
                currency = 'VND'
            },
            @{
                productId = $productBId
                productNameSnap = $productBName
                quantity = 5
                unitPrice = 50000
                currency = 'VND'
            }
        )
    }
    $po1Id = Get-Id $po1Resp.data
    if (-not ($po1Resp.success -and $po1Id)) {
        Write-Fail 'Primary purchase order create failed'
        throw 'purchase-order-1-create-failed'
    }
    Write-Pass "Primary purchase order created: $po1Id"

    $po1 = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po1Id -Label 'GetPurchaseOrder1'
    $po1Data = $po1.data
    $po1LineA = Get-PurchaseLineByProductId -PurchaseOrderData $po1Data -ProductId $productAId
    $po1LineB = Get-PurchaseLineByProductId -PurchaseOrderData $po1Data -ProductId $productBId
    $po1LineAId = if ($po1LineA) { Get-Id $po1LineA } else { '' }
    $po1LineBId = if ($po1LineB) { Get-Id $po1LineB } else { '' }
    $receiveLineAId = if ($po1LineAId) { $po1LineAId } else { $productAId }
    Assert-Equal 'PO1 status after create' 'ordered' (Get-FieldValue $po1Data 'status')
    Assert-Equal 'PO1 itemsTotal after create' 1250000 (Get-FieldValue $po1Data 'itemsTotal')
    Assert-Equal 'PO1 grandTotal after create' 1290000 (Get-FieldValue $po1Data 'grandTotal')
    Assert-True 'PO1 line A has subdocument id or product fallback id' (-not [string]::IsNullOrWhiteSpace($(if ($po1LineAId) { $po1LineAId } else { $productAId }))) 'PO1 line A identifier missing'
    Assert-Equal 'PO1 line A quantityReceived after create' 0 (Get-FieldValue $po1LineA 'quantityReceived')
    Assert-Equal 'PO1 line B quantityReceived after create' 0 (Get-FieldValue $po1LineB 'quantityReceived')

    Write-Step '1.2' 'List purchase orders by status'
    $poListOrdered = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders?status=ordered&page=1&limit=20" -Headers $headers -Label 'ListPurchaseOrdersOrdered'
    $poListOrderedItems = Get-CollectionItems $poListOrdered.data
    $po1InOrderedList = @($poListOrderedItems | Where-Object { (Get-Id $_) -eq $po1Id }).Count
    Assert-True 'PO1 appears in ordered list' ($po1InOrderedList -ge 1) "PO1 $po1Id missing from ordered list"

    Write-Section 'PHASE 2: Malformed Purchase Id And Filter Contract'

    Write-Step '2.1' 'Malformed purchase order ids return 400 and valid missing ids return 404'
    $malformedPurchaseOrderId = 'not-a-valid-object-id'
    $missingPurchaseOrderId = New-ObjectIdString

    $malformedPurchaseGet = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders/$malformedPurchaseOrderId" -Headers $headers -Label 'GetPurchaseOrderMalformedId'
    $missingPurchaseGet = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders/$missingPurchaseOrderId" -Headers $headers -Label 'GetPurchaseOrderMissingId'
    $malformedPurchasePatch = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/purchase-orders/$malformedPurchaseOrderId" -Headers $headers -Label 'PatchPurchaseOrderMalformedId' -Body @{
        notes = 'malformed-id-patch'
    }
    $missingPurchasePatch = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/purchase-orders/$missingPurchaseOrderId" -Headers $headers -Label 'PatchPurchaseOrderMissingId' -Body @{
        notes = 'missing-id-patch'
    }
    $malformedPurchaseDelete = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/purchase-orders/$malformedPurchaseOrderId" -Headers $headers -Label 'DeletePurchaseOrderMalformedId'
    $missingPurchaseDelete = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/purchase-orders/$missingPurchaseOrderId" -Headers $headers -Label 'DeletePurchaseOrderMissingId'
    $malformedPurchaseReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$malformedPurchaseOrderId/receive" -Headers $headers -Label 'ReceivePurchaseOrderMalformedId' -Body @{
        items = @(
            @{
                itemId = $receiveLineAId
                qtyReceived = 1
            }
        )
    }
    $missingPurchaseReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$missingPurchaseOrderId/receive" -Headers $headers -Label 'ReceivePurchaseOrderMissingId' -Body @{
        items = @(
            @{
                itemId = $receiveLineAId
                qtyReceived = 1
            }
        )
    }

    Assert-Equal 'GET purchase order with malformed id returns 400' 400 $malformedPurchaseGet.statusCode
    Assert-Equal 'GET purchase order with valid missing id returns 404' 404 $missingPurchaseGet.statusCode
    Assert-Equal 'PATCH purchase order with malformed id returns 400' 400 $malformedPurchasePatch.statusCode
    Assert-Equal 'PATCH purchase order with valid missing id returns 404' 404 $missingPurchasePatch.statusCode
    Assert-Equal 'DELETE purchase order with malformed id returns 400' 400 $malformedPurchaseDelete.statusCode
    Assert-Equal 'DELETE purchase order with valid missing id returns 404' 404 $missingPurchaseDelete.statusCode
    Assert-Equal 'Receive purchase order with malformed id returns 400' 400 $malformedPurchaseReceive.statusCode
    Assert-Equal 'Receive purchase order with valid missing id returns 404' 404 $missingPurchaseReceive.statusCode

    Write-Step '2.2' 'Malformed supplier filters return 400 while valid missing filters stay empty'
    $malformedPurchaseListBySupplier = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders?supplierId=$malformedPurchaseOrderId&status=ordered&page=1&limit=20" -Headers $headers -Label 'ListPurchaseOrdersMalformedSupplier'
    $missingSupplierId = New-ObjectIdString
    $missingPurchaseListBySupplier = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders?supplierId=$missingSupplierId&status=ordered&page=1&limit=20" -Headers $headers -Label 'ListPurchaseOrdersMissingSupplier'
    $malformedSupplierReport = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/purchase-orders/supplier-report?supplierId=$malformedPurchaseOrderId" -Headers $headers -Label 'SupplierReportMalformedSupplier'
    $missingPurchaseListItems = if ($missingPurchaseListBySupplier.success) { Get-CollectionItems $missingPurchaseListBySupplier.data } else { @() }

    Assert-Equal 'List purchase orders with malformed supplierId returns 400' 400 $malformedPurchaseListBySupplier.statusCode
    Assert-Equal 'List purchase orders with valid missing supplierId returns 200' 200 $missingPurchaseListBySupplier.statusCode
    Assert-Equal 'List purchase orders with valid missing supplierId returns zero rows' 0 $missingPurchaseListItems.Count
    Assert-Equal 'Supplier report with malformed supplierId returns 400' 400 $malformedSupplierReport.statusCode

    Write-Step '2.3' 'Malformed and missing id probes do not mutate the purchase baseline'
    $po1AfterContractChecks = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po1Id -Label 'GetPurchaseOrder1AfterContractChecks'
    $po1AfterContractChecksData = $po1AfterContractChecks.data
    $po1LineAAfterContractChecks = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterContractChecksData -ProductId $productAId
    $po1LineBAfterContractChecks = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterContractChecksData -ProductId $productBId
    Assert-Equal 'PO1 status unchanged after malformed and missing id probes' 'ordered' (Get-FieldValue $po1AfterContractChecksData 'status')
    Assert-Equal 'PO1 line A quantityReceived unchanged after malformed and missing id probes' 0 (Get-FieldValue $po1LineAAfterContractChecks 'quantityReceived')
    Assert-Equal 'PO1 line B quantityReceived unchanged after malformed and missing id probes' 0 (Get-FieldValue $po1LineBAfterContractChecks 'quantityReceived')

    Write-Section 'PHASE 3: Invalid Receive Must Not Write'

    Write-Step '3.1' 'Receive with unknown item id should fail without side effects'
    $invalidReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$po1Id/receive" -Headers $headers -Label 'ReceivePurchaseOrder1Invalid' -Body @{
        items = @(
            @{
                itemId = (New-ObjectIdString)
                qtyReceived = 3
            }
        )
    }
    Assert-Equal 'Invalid receive returns 400' 400 $invalidReceive.statusCode

    $po1AfterInvalid = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po1Id -Label 'GetPurchaseOrder1AfterInvalid'
    $po1AfterInvalidData = $po1AfterInvalid.data
    $po1LineAAfterInvalid = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterInvalidData -ProductId $productAId
    $po1LineBAfterInvalid = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterInvalidData -ProductId $productBId
    Assert-Equal 'PO1 status unchanged after invalid receive' 'ordered' (Get-FieldValue $po1AfterInvalidData 'status')
    Assert-Equal 'PO1 line A quantityReceived unchanged after invalid receive' 0 (Get-FieldValue $po1LineAAfterInvalid 'quantityReceived')
    Assert-Equal 'PO1 line B quantityReceived unchanged after invalid receive' 0 (Get-FieldValue $po1LineBAfterInvalid 'quantityReceived')

    $summaryBeforeReceiveA = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productAId
    $summaryBeforeReceiveB = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productBId
    Assert-True 'Product A absent from inventory summary before first receive' ($null -eq $summaryBeforeReceiveA.row) 'Product A unexpectedly exists in inventory before receive'
    Assert-True 'Product B absent from inventory summary before first receive' ($null -eq $summaryBeforeReceiveB.row) 'Product B unexpectedly exists in inventory before receive'

    Write-Section 'PHASE 4: Partial Receive Updates Inventory And Cumulative History'

    Write-Step '4.1' 'Receive first partial quantity for product A'
    $partialReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$po1Id/receive" -Headers $headers -Label 'ReceivePurchaseOrder1Partial' -Body @{
        items = @(
            @{
                itemId = $receiveLineAId
                qtyReceived = 4
            }
        )
    }
    if (-not $partialReceive.success) {
        Write-Fail 'Partial receive failed'
        throw 'purchase-order-1-partial-receive-failed'
    }
    Write-Pass 'Partial receive succeeded'

    $po1AfterPartial = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po1Id -Label 'GetPurchaseOrder1AfterPartial'
    $po1AfterPartialData = $po1AfterPartial.data
    $po1LineAAfterPartial = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterPartialData -ProductId $productAId
    $po1LineBAfterPartial = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterPartialData -ProductId $productBId
    Assert-Equal 'PO1 status after partial receive' 'partially_received' (Get-FieldValue $po1AfterPartialData 'status')
    Assert-Equal 'PO1 line A quantityReceived after partial receive' 4 (Get-FieldValue $po1LineAAfterPartial 'quantityReceived')
    Assert-Equal 'PO1 line B quantityReceived after partial receive' 0 (Get-FieldValue $po1LineBAfterPartial 'quantityReceived')
    Assert-True 'PO1 receivedDate set after partial receive' (-not [string]::IsNullOrWhiteSpace([string](Get-FieldValue $po1AfterPartialData 'receivedDate'))) 'PO1 receivedDate missing after partial receive'

    $summaryAfterPartialA = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productAId
    Assert-True 'Product A appears in inventory summary after partial receive' ($null -ne $summaryAfterPartialA.row) 'Product A missing from inventory summary after partial receive'
    Assert-Equal 'Product A onHand after partial receive' 4 (Get-FieldValue $summaryAfterPartialA.row 'onHand')
    Assert-Approx (N0 (Get-FieldValue $summaryAfterPartialA.row 'avgCost')) 100000 0.001 'Product A avgCost after partial receive'

    $txAfterPartialA = Get-InventoryTransactions -Headers $headers -ProductId $productAId
    Assert-Equal 'Product A receive transaction count after partial receive' 1 $txAfterPartialA.items.Count
    $txA1 = if ($txAfterPartialA.items.Count -gt 0) { $txAfterPartialA.items[0] } else { $null }
    Assert-Equal 'Latest Product A tx type after partial receive' 'receive' (Get-FieldValue $txA1 'type')
    Assert-Equal 'Latest Product A tx quantity after partial receive' 4 (Get-FieldValue $txA1 'quantity')
    Assert-Equal 'Latest Product A tx unitCost after partial receive' 100000 (Get-FieldValue $txA1 'unitCost')
    Assert-Equal 'Latest Product A tx purchaseOrderId after partial receive' $po1Id (Get-Id (Get-FieldValue $txA1 'purchaseOrderId'))

    $priceHistoryAfterPartialA = Get-PriceHistory -Headers $headers -ProductId $productAId -SupplierId $supplierId
    Assert-True 'Price history endpoint works after partial receive' $priceHistoryAfterPartialA.response.success ($priceHistoryAfterPartialA.response.raw)
    Assert-Equal 'Price history row count for product A after partial receive' 1 $priceHistoryAfterPartialA.items.Count
    $historyA1 = if ($priceHistoryAfterPartialA.items.Count -gt 0) { $priceHistoryAfterPartialA.items[0] } else { $null }
    Assert-Equal 'Price history PO id for product A after partial receive' $po1Id (Get-Id (Get-FieldValue $historyA1 'purchaseOrderId'))
    Assert-Equal 'Price history quantityReceived for product A after partial receive' 4 (Get-FieldValue $historyA1 'quantityReceived')
    Assert-Equal 'Price history unitPrice for product A after partial receive' 100000 (Get-FieldValue $historyA1 'unitPrice')

    Write-Step '4.2' 'Final receive for PO1 should close the order and append transactions'
    $receiveLineBId = if ($po1LineBId) { $po1LineBId } else { $productBId }
    $finalReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$po1Id/receive" -Headers $headers -Label 'ReceivePurchaseOrder1Final' -Body @{
        items = @(
            @{
                itemId = $receiveLineAId
                qtyReceived = 6
            },
            @{
                itemId = $receiveLineBId
                qtyReceived = 5
            }
        )
    }
    if (-not $finalReceive.success) {
        Write-Fail 'Final receive for PO1 failed'
        throw 'purchase-order-1-final-receive-failed'
    }
    Write-Pass 'Final receive for PO1 succeeded'

    $po1AfterFinal = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po1Id -Label 'GetPurchaseOrder1AfterFinal'
    $po1AfterFinalData = $po1AfterFinal.data
    $po1LineAAfterFinal = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterFinalData -ProductId $productAId
    $po1LineBAfterFinal = Get-PurchaseLineByProductId -PurchaseOrderData $po1AfterFinalData -ProductId $productBId
    Assert-Equal 'PO1 status after final receive' 'received' (Get-FieldValue $po1AfterFinalData 'status')
    Assert-Equal 'PO1 line A quantityReceived after final receive' 10 (Get-FieldValue $po1LineAAfterFinal 'quantityReceived')
    Assert-Equal 'PO1 line B quantityReceived after final receive' 5 (Get-FieldValue $po1LineBAfterFinal 'quantityReceived')

    $summaryAfterFinalA = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productAId
    $summaryAfterFinalB = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productBId
    Assert-Equal 'Product A onHand after final receive' 10 (Get-FieldValue $summaryAfterFinalA.row 'onHand')
    Assert-Approx (N0 (Get-FieldValue $summaryAfterFinalA.row 'avgCost')) 100000 0.001 'Product A avgCost after final receive'
    Assert-Equal 'Product B onHand after final receive' 5 (Get-FieldValue $summaryAfterFinalB.row 'onHand')
    Assert-Approx (N0 (Get-FieldValue $summaryAfterFinalB.row 'avgCost')) 50000 0.001 'Product B avgCost after final receive'

    $txAfterFinalA = Get-InventoryTransactions -Headers $headers -ProductId $productAId
    $txAfterFinalB = Get-InventoryTransactions -Headers $headers -ProductId $productBId
    Assert-Equal 'Product A receive transaction count after final receive' 2 $txAfterFinalA.items.Count
    Assert-Equal 'Product B receive transaction count after final receive' 1 $txAfterFinalB.items.Count
    $totalQtyAAfterFinal = (@($txAfterFinalA.items | ForEach-Object { N0 (Get-FieldValue $_ 'quantity') }) | Measure-Object -Sum).Sum
    $totalQtyBAfterFinal = (@($txAfterFinalB.items | ForEach-Object { N0 (Get-FieldValue $_ 'quantity') }) | Measure-Object -Sum).Sum
    Assert-Equal 'Product A total received quantity across transactions after final receive' 10 $totalQtyAAfterFinal
    Assert-Equal 'Product B total received quantity across transactions after final receive' 5 $totalQtyBAfterFinal

    $priceHistoryAfterFinalA = Get-PriceHistory -Headers $headers -ProductId $productAId -SupplierId $supplierId
    Assert-Equal 'Price history row count for product A after final receive stays per PO item' 1 $priceHistoryAfterFinalA.items.Count
    $historyAAfterFinal = if ($priceHistoryAfterFinalA.items.Count -gt 0) { $priceHistoryAfterFinalA.items[0] } else { $null }
    Assert-Equal 'Price history cumulative quantityReceived for product A after final receive' 10 (Get-FieldValue $historyAAfterFinal 'quantityReceived')

    Write-Section 'PHASE 5: Second Purchase Order Updates Weighted Cost And Multi-PO History'

    Write-Step '5.1' 'Create and fully receive PO2 for product A at a different unit price'
    $po2Resp = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders" -Headers $headers -Label 'CreatePurchaseOrder2' -Body @{
        supplierId = $supplierId
        supplierNameSnap = $supplierName
        status = 'ordered'
        notes = "Secondary purchase order $tsDigits"
        items = @(
            @{
                productId = $productAId
                productNameSnap = $productAName
                quantity = 2
                unitPrice = 160000
                currency = 'VND'
            }
        )
    }
    $po2Id = Get-Id $po2Resp.data
    if (-not ($po2Resp.success -and $po2Id)) {
        Write-Fail 'Secondary purchase order create failed'
        throw 'purchase-order-2-create-failed'
    }
    $po2 = Get-PurchaseOrder -Headers $headers -PurchaseOrderId $po2Id -Label 'GetPurchaseOrder2'
    $po2LineA = Get-PurchaseLineByProductId -PurchaseOrderData $po2.data -ProductId $productAId
    $po2LineAId = if ($po2LineA) { Get-Id $po2LineA } else { $productAId }
    $po2Receive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$po2Id/receive" -Headers $headers -Label 'ReceivePurchaseOrder2' -Body @{
        items = @(
            @{
                itemId = $po2LineAId
                qtyReceived = 2
            }
        )
    }
    if (-not $po2Receive.success) {
        Write-Fail 'Receive for PO2 failed'
        throw 'purchase-order-2-receive-failed'
    }
    Write-Pass 'Receive for PO2 succeeded'

    $summaryAfterPo2A = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productAId
    Assert-Equal 'Product A onHand after PO2 receive' 12 (Get-FieldValue $summaryAfterPo2A.row 'onHand')
    Assert-Approx (N0 (Get-FieldValue $summaryAfterPo2A.row 'avgCost')) 110000 0.001 'Product A avgCost after PO2 receive'

    $txAfterPo2A = Get-InventoryTransactions -Headers $headers -ProductId $productAId
    Assert-Equal 'Product A receive transaction count after PO2 receive' 3 $txAfterPo2A.items.Count
    $latestTxAfterPo2A = if ($txAfterPo2A.items.Count -gt 0) { $txAfterPo2A.items[0] } else { $null }
    Assert-Equal 'Latest Product A tx type after PO2 receive' 'receive' (Get-FieldValue $latestTxAfterPo2A 'type')
    Assert-Equal 'Latest Product A tx quantity after PO2 receive' 2 (Get-FieldValue $latestTxAfterPo2A 'quantity')
    Assert-Equal 'Latest Product A tx unitCost after PO2 receive' 160000 (Get-FieldValue $latestTxAfterPo2A 'unitCost')
    Assert-Equal 'Latest Product A tx purchaseOrderId after PO2 receive' $po2Id (Get-Id (Get-FieldValue $latestTxAfterPo2A 'purchaseOrderId'))

    Write-Step '5.2' 'Price history must show multi-PO state and weighted stats'
    $priceHistoryAfterPo2A = Get-PriceHistory -Headers $headers -ProductId $productAId -SupplierId $supplierId
    if (-not $priceHistoryAfterPo2A.response.success) {
        Write-Fail 'Price history request failed after PO2 receive'
        throw 'purchase-price-history-failed'
    }
    Assert-Equal 'Price history row count for product A after PO2 receive' 2 $priceHistoryAfterPo2A.items.Count
    $priceHistoryPo2Row = @($priceHistoryAfterPo2A.items | Where-Object { (Get-Id (Get-FieldValue $_ 'purchaseOrderId')) -eq $po2Id } | Select-Object -First 1)
    $priceHistoryPo1Row = @($priceHistoryAfterPo2A.items | Where-Object { (Get-Id (Get-FieldValue $_ 'purchaseOrderId')) -eq $po1Id } | Select-Object -First 1)
    $rowPo2 = if ($priceHistoryPo2Row.Count -gt 0) { $priceHistoryPo2Row[0] } else { $null }
    $rowPo1 = if ($priceHistoryPo1Row.Count -gt 0) { $priceHistoryPo1Row[0] } else { $null }
    Assert-Equal 'Price history PO2 quantityReceived for product A' 2 (Get-FieldValue $rowPo2 'quantityReceived')
    Assert-Equal 'Price history PO2 unitPrice for product A' 160000 (Get-FieldValue $rowPo2 'unitPrice')
    Assert-Equal 'Price history PO1 cumulative quantityReceived for product A' 10 (Get-FieldValue $rowPo1 'quantityReceived')
    Assert-Equal 'Price history PO1 unitPrice for product A' 100000 (Get-FieldValue $rowPo1 'unitPrice')
    Assert-Equal 'Price history stats.latest for product A' 160000 (Get-FieldValue $priceHistoryAfterPo2A.stats 'latest')
    Assert-Equal 'Price history stats.min for product A' 100000 (Get-FieldValue $priceHistoryAfterPo2A.stats 'min')
    Assert-Equal 'Price history stats.max for product A' 160000 (Get-FieldValue $priceHistoryAfterPo2A.stats 'max')
    Assert-Approx (N0 (Get-FieldValue $priceHistoryAfterPo2A.stats 'median')) 130000 0.001 'Price history stats.median for product A'

    $priceHistoryB = Get-PriceHistory -Headers $headers -ProductId $productBId -SupplierId $supplierId
    Assert-True 'Price history endpoint works for product B' $priceHistoryB.response.success ($priceHistoryB.response.raw)
    Assert-Equal 'Price history row count for product B' 1 $priceHistoryB.items.Count
    $historyB = if ($priceHistoryB.items.Count -gt 0) { $priceHistoryB.items[0] } else { $null }
    Assert-Equal 'Price history quantityReceived for product B' 5 (Get-FieldValue $historyB 'quantityReceived')
    Assert-Equal 'Price history unitPrice for product B' 50000 (Get-FieldValue $historyB 'unitPrice')

    Write-Step '5.3' 'Supplier report must reflect received quantity and received cost'
    $supplierReport = Get-SupplierReport -Headers $headers -SupplierId $supplierId
    $supplierReportRows = Get-CollectionItems $supplierReport.data
    $supplierReportRow = @($supplierReportRows | Where-Object { [string](Get-FieldValue $_ 'supplierId') -eq $supplierId } | Select-Object -First 1)
    $reportRow = if ($supplierReportRow.Count -gt 0) { $supplierReportRow[0] } else { $null }
    Assert-True 'Supplier report contains fixture supplier' ($null -ne $reportRow) "Supplier report missing supplier $supplierId"
    Assert-Equal 'Supplier report totalQuantityReceived' 17 (Get-FieldValue $reportRow 'totalQuantityReceived')
    Assert-Equal 'Supplier report totalCostReceived' 1570000 (Get-FieldValue $reportRow 'totalCostReceived')
    Assert-Equal 'Supplier report orderCount' 2 (Get-FieldValue $reportRow 'orderCount')

    $missingSupplierReport = Get-SupplierReport -Headers $headers -SupplierId $missingSupplierId
    $missingSupplierReportRows = Get-CollectionItems $missingSupplierReport.data
    Assert-Equal 'Supplier report with valid missing supplierId returns 200' 200 $missingSupplierReport.statusCode
    Assert-Equal 'Supplier report with valid missing supplierId returns zero rows' 0 $missingSupplierReportRows.Count

    Write-Section 'PHASE 6: Fully Received Orders Must Reject Duplicate Receive'

    Write-Step '6.1' 'Receive on fully received PO1 must fail without additional writes'
    $txCountBeforeDuplicate = $txAfterPo2A.items.Count
    $duplicateReceive = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/purchase-orders/$po1Id/receive" -Headers $headers -Label 'ReceivePurchaseOrder1Duplicate' -Body @{
        items = @(
            @{
                itemId = $receiveLineAId
                qtyReceived = 1
            }
        )
    }
    Assert-Equal 'Duplicate receive on fully received PO1 returns 400' 400 $duplicateReceive.statusCode

    $summaryAfterDuplicateA = Get-InventorySummaryRow -Headers $headers -Search $prefix -ProductId $productAId
    $txAfterDuplicateA = Get-InventoryTransactions -Headers $headers -ProductId $productAId
    Assert-Equal 'Product A onHand unchanged after duplicate receive' 12 (Get-FieldValue $summaryAfterDuplicateA.row 'onHand')
    Assert-Approx (N0 (Get-FieldValue $summaryAfterDuplicateA.row 'avgCost')) 110000 0.001 'Product A avgCost unchanged after duplicate receive'
    Assert-Equal 'Product A transaction count unchanged after duplicate receive' $txCountBeforeDuplicate $txAfterDuplicateA.items.Count
}
finally {
    Stop-IsolatedBackend

    Write-Section 'SUMMARY'
    Write-Host "Total: $($script:passCount + $script:failCount) | PASS: $($script:passCount) | FAIL: $($script:failCount)"
    if ($script:failCount -gt 0) {
        Write-Host ''
        Write-Host 'Failed tests:' -ForegroundColor Red
        $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
}

if ($script:failCount -gt 0) {
    exit 1
}
