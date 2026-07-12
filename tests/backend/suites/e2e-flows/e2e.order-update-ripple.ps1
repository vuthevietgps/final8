#!/usr/bin/env pwsh
<#
    =====================================================================================
    E2E.ORDER-UPDATE-RIPPLE.PS1
    =====================================================================================
    Goal:
      - Verify Excel order-update preview/check/apply works against real uploaded workbooks
      - Verify leading-zero tracking matching survives Excel normalization
      - Verify completed-status ripple updates order payments, reports, payable/receivable,
        and financial-control dashboard
      - Verify partial update does not wipe existing financial state
      - Verify schema-valid but business-invalid data is reported as an error, not passed
    =====================================================================================
#>
$ErrorActionPreference = "Continue"

function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}

function Get-BackendHealthUrl {
    $healthUrl = $env:BACKEND_HEALTH_URL
    if (-not [string]::IsNullOrWhiteSpace($healthUrl)) {
        return $healthUrl.TrimEnd('/')
    }

    $baseUrl = Get-BackendBaseUrl
    if ($baseUrl -match '/api/?$') {
        return (($baseUrl -replace '/api/?$', '') + '/health')
    }

    return ($baseUrl.TrimEnd('/') + '/health')
}

$BaseUrl = Get-BackendBaseUrl
$HealthUrl = Get-BackendHealthUrl
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$ResultsDir = Join-Path $RepoRoot 'tests\backend\artifacts\results'
$BackendPackage = Join-Path $RepoRoot 'backend\package.json'
Add-Type -AssemblyName System.Net.Http

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 96) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 96) -ForegroundColor Cyan
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

function Write-Info($msg) {
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Convert-ResponseJson {
    param([string]$Text)

    if ($null -eq $Text) { return $null }
    $clean = $Text.Trim()
    if ($clean.StartsWith([char]0xFEFF)) {
        $clean = $clean.TrimStart([char]0xFEFF)
    }
    if (-not $clean) { return $null }
    try { return $clean | ConvertFrom-Json } catch { return $clean }
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
        }
        if ($null -ne $Body) {
            $params.ContentType = "application/json; charset=utf-8"
            if ($Body -is [string]) {
                $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body)
            } else {
                $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 20 -Compress))
            }
        }

        $resp = Invoke-RestMethod @params
        return @{
            ok = $true
            status = 200
            data = $resp
            error = $null
        }
    } catch {
        $status = 0
        $errBody = ""
        try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            if ($stream) {
                $reader = [System.IO.StreamReader]::new($stream)
                $errBody = $reader.ReadToEnd()
            }
        } catch { }
        Write-Host "  [HTTP] $Method $Url => $status" -ForegroundColor DarkYellow
        if ($errBody) {
            Write-Host "         $errBody" -ForegroundColor DarkYellow
        }
        return @{
            ok = $false
            status = $status
            data = $null
            error = $errBody
        }
    }
}

function Invoke-MultipartRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$FilePath
    )

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $content = [System.Net.Http.MultipartFormDataContent]::new()
    try {
        foreach ($key in $Headers.Keys) {
            [void]$client.DefaultRequestHeaders.TryAddWithoutValidation($key, [string]$Headers[$key])
        }

        $bytes = [System.IO.File]::ReadAllBytes($FilePath)
        $fileContent = [System.Net.Http.ByteArrayContent]::new($bytes)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        $content.Add($fileContent, 'file', [System.IO.Path]::GetFileName($FilePath))

        $response = $client.PostAsync($Url, $content).GetAwaiter().GetResult()
        $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return @{
            ok = $response.IsSuccessStatusCode
            status = [int]$response.StatusCode
            data = Convert-ResponseJson -Text $body
            raw = $body
        }
    } catch {
        $status = 0
        $body = $_.Exception.Message
        try {
            if ($_.Exception.Response) {
                $status = [int]$_.Exception.Response.StatusCode.value__
            }
        } catch { }
        return @{
            ok = $false
            status = $status
            data = $null
            raw = $body
        }
    } finally {
        $content.Dispose()
        $client.Dispose()
        $handler.Dispose()
    }
}

function Get-CollectionItems {
    param($data)

    if ($null -eq $data) { return @() }
    if ($data -is [System.Array]) { return @($data) }
    if ($data.data -is [System.Array] -or $data.data) { return @($data.data) }
    if ($data.items -is [System.Array] -or $data.items) { return @($data.items) }
    return @()
}

function Get-Id {
    param($obj)

    if ($null -eq $obj) { return $null }
    if ($obj._id) { return [string]$obj._id }
    if ($obj.id) { return [string]$obj.id }
    return $null
}

function N0($value) {
    if ($null -eq $value) { return 0.0 }
    try { return [double]$value } catch { return 0.0 }
}

function Assert-Equal {
    param(
        $Actual,
        $Expected,
        [string]$Label
    )

    if ("$Actual" -eq "$Expected") {
        Write-Pass "$Label (actual=$Actual, expected=$Expected)"
        return $true
    }

    Write-Fail "$Label (actual=$Actual, expected=$Expected)"
    return $false
}

function Assert-Approx {
    param(
        [double]$Actual,
        [double]$Expected,
        [double]$Tolerance,
        [string]$Label
    )

    $diff = [Math]::Abs($Actual - $Expected)
    if ($diff -le $Tolerance) {
        Write-Pass "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
        return $true
    }

    Write-Fail "$Label (actual=$Actual, expected=$Expected, diff=$diff, tolerance=$Tolerance)"
    return $false
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Label
    )

    if ($Condition) {
        Write-Pass $Label
        return $true
    }

    Write-Fail $Label
    return $false
}

function Wait-ForHealthyBackend {
    param([string]$Url)

    for ($i = 0; $i -lt 10; $i++) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ([int]$resp.StatusCode -eq 200) {
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 2
    }

    return $false
}

function Get-UserByRole {
    param(
        [hashtable]$Headers,
        [string]$Role
    )

    $usersResp = Invoke-Api -Method GET -Url "$BaseUrl/users?limit=200" -Headers $Headers
    if (-not $usersResp.ok) {
        return $null
    }

    $items = Get-CollectionItems $usersResp.data
    return $items | Where-Object { $_.role -eq $Role } | Select-Object -First 1
}

function Get-PaymentTriggerStatuses {
    param([hashtable]$Headers)

    $resp = Invoke-Api -Method GET -Url "$BaseUrl/delivery-status/payment-trigger/names" -Headers $Headers
    if (-not $resp.ok) {
        return @()
    }

    if ($resp.data -is [System.Array]) {
        return @($resp.data)
    }

    return @()
}

function Get-ReturnStatuses {
    param([hashtable]$Headers)

    $resp = Invoke-Api -Method GET -Url "$BaseUrl/delivery-status/return/names" -Headers $Headers
    if (-not $resp.ok) {
        return @()
    }

    if ($resp.data -is [System.Array]) {
        return @($resp.data)
    }

    return @()
}

function Get-CompletedDeliveredStatus {
    param([hashtable]$Headers)

    $paymentStatuses = @(Get-PaymentTriggerStatuses -Headers $Headers)
    $returnStatuses = @(Get-ReturnStatuses -Headers $Headers)

    foreach ($status in $paymentStatuses) {
        if ($returnStatuses -notcontains $status) {
            return [string]$status
        }
    }

    return $null
}

function Get-PendingDeliveryStatus {
    param([hashtable]$Headers)

    $resp = Invoke-Api -Method GET -Url "$BaseUrl/delivery-status" -Headers $Headers
    if (-not $resp.ok) {
        return $null
    }

    $items = Get-CollectionItems $resp.data
    foreach ($item in $items) {
        if ($item.isPaymentTrigger -ne $true) {
            return [string]$item.name
        }
    }

    return $null
}

function Get-ProductionDoneStatus {
    param([hashtable]$Headers)

    $resp = Invoke-Api -Method GET -Url "$BaseUrl/production-status" -Headers $Headers
    if (-not $resp.ok) {
        return $null
    }

    $items = Get-CollectionItems $resp.data
    foreach ($item in $items) {
        $name = [string]$item.name
        if ($name -match 'tr' -and $name -match 'qu') {
            return $name
        }
    }

    if ($items.Count -ge 3) {
        return [string]$items[2].name
    }

    return $null
}

function New-OrderUpdateWorkbook {
    param(
        [string]$FilePath,
        [object[]]$Rows
    )

    $backendPackageJson = $BackendPackage | ConvertTo-Json -Compress
    $filePathJson = $FilePath | ConvertTo-Json -Compress
    $rowsJson = $Rows | ConvertTo-Json -Depth 20 -Compress
    $rowsBase64Json = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($rowsJson)) | ConvertTo-Json -Compress

    $nodeScript = @"
const { createRequire } = require('module');
const backendPackage = $backendPackageJson;
const filePath = $filePathJson;
const rows = JSON.parse(Buffer.from($rowsBase64Json, 'base64').toString('utf8'));
const backendRequire = createRequire(backendPackage);
const XLSX = backendRequire('xlsx');

const COL = {
  trackingNumber: 1,
  receiverName: 10,
  receiverAddress: 11,
  receiverPhone: 12,
  codAmount: 17,
  orderStatus: 32,
};

const header = new Array(33).fill('');
header[COL.trackingNumber] = 'trackingNumber';
header[COL.receiverName] = 'receiverName';
header[COL.receiverAddress] = 'receiverAddress';
header[COL.receiverPhone] = 'receiverPhone';
header[COL.codAmount] = 'codAmount';
header[COL.orderStatus] = 'orderStatus';

const rowList = Array.isArray(rows) ? rows : [rows];
const matrix = [header];
for (const row of rowList) {
  const item = new Array(33).fill('');
  item[COL.trackingNumber] = row.trackingNumber ?? '';
  item[COL.receiverName] = row.receiverName ?? '';
  item[COL.receiverAddress] = row.receiverAddress ?? '';
  item[COL.receiverPhone] = row.receiverPhone ?? '';
  item[COL.codAmount] = row.codAmount ?? '';
  item[COL.orderStatus] = row.orderStatus ?? '';
  matrix.push(item);
}

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.aoa_to_sheet(matrix);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
XLSX.writeFile(workbook, filePath);
console.log(filePath);
"@

    $output = $nodeScript | node -
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $FilePath)) {
        throw "Failed to create workbook: $FilePath"
    }

    return $FilePath
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$headers = @{}
$today = (Get-Date).ToString("yyyy-MM-dd")
$orderIsoDate = (Get-Date).ToString("yyyy-MM-dd")

$trackingSeed = ($ts -replace '[^0-9]', '')
$trackingInExcel = $trackingSeed.Substring([Math]::Max(0, $trackingSeed.Length - 9))
$trackingInDb = "000$trackingInExcel"
$initialCod = 500000
$updatedCod = 650000
$supplierUnitPrice = 150000
$agentUnitPrice = 50000
$quantity = 2
$shippingFee = 30000
$returnFee = 25000
$expectedSupplierPaid = $updatedCod - ($supplierUnitPrice * $quantity) - $shippingFee
$expectedAgentPaid = $updatedCod - ($agentUnitPrice * $quantity)
$expectedGrossProfit = $updatedCod - ($supplierUnitPrice * $quantity) - $shippingFee - $returnFee - $expectedAgentPaid
$expectedSupplierPendingForDashboard = $supplierUnitPrice * $quantity
$expectedMonthlyBurnDelta = $expectedSupplierPendingForDashboard + $expectedAgentPaid

$validWorkbook = Join-Path $ResultsDir "tmp-order-update-ripple-valid-$ts.xlsx"
$partialWorkbook = Join-Path $ResultsDir "tmp-order-update-ripple-partial-$ts.xlsx"
$invalidWorkbook = Join-Path $ResultsDir "tmp-order-update-ripple-invalid-$ts.xlsx"

$createdCategoryId = $null
$createdProductId = $null
$createdFanpageId = $null
$createdAdAccountId = $null
$createdAdGroupId = $null
$createdSupplierQuoteId = $null
$createdAgentQuoteId = $null
$createdOrderId = $null

Write-Section "E2E ORDER UPDATE RIPPLE - $ts"
Write-Info "Base URL: $BaseUrl"
Write-Info "Health URL: $HealthUrl"

if (-not (Wait-ForHealthyBackend -Url $HealthUrl)) {
    Write-Fail "Backend health check failed at $HealthUrl"
    exit 1
}
Write-Pass "Backend health check passed"

Write-Section "PHASE 0: Login + fixture setup"

Write-Step "0.1" "Login director"
$loginResp = Invoke-Api -Method POST -Url "$BaseUrl/auth/login" -Body @{
    email = "director@test.com"
    password = "123456"
}
if (-not $loginResp.ok -or -not $loginResp.data.access_token) {
    Write-Fail "Director login failed"
    exit 1
}
$headers = @{ Authorization = "Bearer $($loginResp.data.access_token)" }
Write-Pass "Director login succeeded"

Write-Step "0.2" "Resolve status fixtures"
$deliveredStatus = Get-CompletedDeliveredStatus -Headers $headers
$pendingStatus = Get-PendingDeliveryStatus -Headers $headers
$productionDoneStatus = Get-ProductionDoneStatus -Headers $headers

Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($deliveredStatus)) -Label "Completed delivery status resolved" | Out-Null
Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($pendingStatus)) -Label "Pending delivery status resolved" | Out-Null
Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($productionDoneStatus)) -Label "Production done status resolved" | Out-Null

Write-Step "0.3" "Resolve seeded users"
$supplier = Get-UserByRole -Headers $headers -Role "internal_supplier"
$agent = Get-UserByRole -Headers $headers -Role "external_agent"
$supplierId = Get-Id $supplier
$agentId = Get-Id $agent
Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($supplierId)) -Label "Seeded internal supplier available" | Out-Null
Assert-True -Condition (-not [string]::IsNullOrWhiteSpace($agentId)) -Label "Seeded external agent available" | Out-Null

Write-Step "0.4" "Create product, fanpage, ad account, ad group"
$categoryResp = Invoke-Api -Method POST -Url "$BaseUrl/product-category" -Headers $headers -Body @{
    name = "Order Update Ripple Category $ts"
    description = "Temp category for order-update ripple"
    isActive = $true
}
if (-not $categoryResp.ok -or -not (Get-Id $categoryResp.data)) {
    Write-Fail "Product category creation failed"
    exit 1
}
$createdCategoryId = Get-Id $categoryResp.data
Write-Pass "Created product category $createdCategoryId"

$productResp = Invoke-Api -Method POST -Url "$BaseUrl/products" -Headers $headers -Body @{
    name = "Order Update Ripple Product $ts"
    categoryId = $createdCategoryId
    importPrice = 10000
}
if (-not $productResp.ok -or -not (Get-Id $productResp.data)) {
    Write-Fail "Product creation failed"
    exit 1
}
$createdProductId = Get-Id $productResp.data
Write-Pass "Created product $createdProductId"

$fanpageResp = Invoke-Api -Method POST -Url "$BaseUrl/fanpages" -Headers $headers -Body @{
    pageId = "order-update-page-$($ts -replace '[^0-9]', '')"
    name = "Order Update Ripple Fanpage $ts"
    accessToken = "EAAToken-order-update-$ts"
    status = "active"
}
if (-not $fanpageResp.ok -or -not (Get-Id $fanpageResp.data)) {
    Write-Fail "Fanpage creation failed"
    exit 1
}
$createdFanpageId = Get-Id $fanpageResp.data
Write-Pass "Created fanpage $createdFanpageId"

$adAccountResp = Invoke-Api -Method POST -Url "$BaseUrl/ad-accounts" -Headers $headers -Body @{
    name = "Order Update Ripple AdAccount $ts"
    accountId = "order_update_account_$($ts -replace '[^0-9]', '')"
    accountType = "facebook"
}
if (-not $adAccountResp.ok -or -not (Get-Id $adAccountResp.data)) {
    Write-Fail "Ad account creation failed"
    exit 1
}
$createdAdAccountId = Get-Id $adAccountResp.data
Write-Pass "Created ad account $createdAdAccountId"

$adGroupResp = Invoke-Api -Method POST -Url "$BaseUrl/ad-groups" -Headers $headers -Body @{
    name = "Order Update Ripple AdGroup $ts"
    adGroupId = "order_update_ad_group_$($ts -replace '[^0-9]', '')"
    platform = "facebook"
    fanpageId = $createdFanpageId
    productCategoryId = $createdCategoryId
    selectedProducts = @($createdProductId)
    agentId = $agentId
    adAccountId = $createdAdAccountId
    isActive = $true
}
if (-not $adGroupResp.ok -or -not (Get-Id $adGroupResp.data)) {
    Write-Fail "Ad group creation failed"
    exit 1
}
$createdAdGroupId = Get-Id $adGroupResp.data
Write-Pass "Created ad group $createdAdGroupId"

Write-Step "0.5" "Create supplier and agent quotes"
$supplierQuoteResp = Invoke-Api -Method POST -Url "$BaseUrl/supplier-quotes" -Headers $headers -Body @{
    supplierId = $supplierId
    productId = $createdProductId
    price = $supplierUnitPrice
    shippingFee = $shippingFee
    returnFee = $returnFee
    effectiveAt = $today
}
if (-not $supplierQuoteResp.ok -or -not (Get-Id $supplierQuoteResp.data)) {
    Write-Fail "Supplier quote creation failed"
    exit 1
}
$createdSupplierQuoteId = Get-Id $supplierQuoteResp.data
Write-Pass "Created supplier quote $createdSupplierQuoteId"

$agentQuoteResp = Invoke-Api -Method POST -Url "$BaseUrl/quotes" -Headers $headers -Body @{
    agentId = $agentId
    productId = $createdProductId
    unitPrice = $agentUnitPrice
    status = "approved"
    validFrom = $today
    validUntil = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
    notes = "Order update ripple quote"
}
if (-not $agentQuoteResp.ok -or -not (Get-Id $agentQuoteResp.data)) {
    Write-Fail "Agent quote creation failed"
    exit 1
}
$createdAgentQuoteId = Get-Id $agentQuoteResp.data
Write-Pass "Created agent quote $createdAgentQuoteId"

Write-Step "0.6" "Create pending order with leading-zero tracking"
$orderResp = Invoke-Api -Method POST -Url "$BaseUrl/test-order2" -Headers $headers -Body @{
    customerName = "Order Update Ripple Customer $ts"
    productId = $createdProductId
    supplierId = $supplierId
    agentId = $agentId
    adGroupId = $createdAdGroupId
    quantity = $quantity
    codAmount = $initialCod
    shippingFee = $shippingFee
    returnFee = $returnFee
    orderDate = $orderIsoDate
    trackingNumber = $trackingInDb
    receiverName = "Receiver Before"
    receiverPhone = "0900000001"
    receiverAddress = "Before Address"
    orderStatus = $pendingStatus
}
if (-not $orderResp.ok -or -not (Get-Id $orderResp.data)) {
    Write-Fail "Order creation failed"
    exit 1
}
$createdOrderId = Get-Id $orderResp.data
Write-Pass "Created order $createdOrderId"

Write-Step "0.7" "Mark production done through canonical order service"
$prodPatchResp = Invoke-Api -Method PATCH -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers -Body @{
    productionStatus = $productionDoneStatus
}
if (-not $prodPatchResp.ok) {
    Write-Fail "Production status update failed"
    exit 1
}
Write-Pass "Production status updated to done"

$orderBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers
if (-not $orderBeforeResp.ok) {
    Write-Fail "Order fetch before Excel update failed"
    exit 1
}
$orderBefore = $orderBeforeResp.data

Assert-Equal -Actual $orderBefore.trackingNumber -Expected $trackingInDb -Label "DB order keeps leading-zero tracking" | Out-Null
Assert-Equal -Actual $orderBefore.orderStatus -Expected $pendingStatus -Label "Order starts in non-completed status" | Out-Null
Assert-Approx -Actual (N0 $orderBefore.grossProfit) -Expected 0 -Tolerance 0.01 -Label "Initial grossProfit is zero" | Out-Null
Assert-True -Condition ($orderBefore.agentPaymentStatus -ne "pending") -Label "Initial agent payment status is not pending" | Out-Null

Write-Section "PHASE 1: Baseline reports before Excel update"

$dailyBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/daily-profit-report?date=$today" -Headers $headers
$pendingSupplierBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$supplierId&from=$today&to=$today" -Headers $headers
$pendingAgentBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/payment-pending/agent?agentId=$agentId&from=$today&to=$today" -Headers $headers
$dashboardBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/financial-control/dashboard?forceRefresh=true" -Headers $headers

if (-not ($dailyBeforeResp.ok -and $pendingSupplierBeforeResp.ok -and $pendingAgentBeforeResp.ok -and $dashboardBeforeResp.ok)) {
    Write-Fail "Baseline report fetch failed"
    exit 1
}

Assert-Approx -Actual (N0 $dailyBeforeResp.data.estimated.totalOrders) -Expected 0 -Tolerance 0.01 -Label "Daily report has zero completed orders before update" | Out-Null
Assert-Approx -Actual (N0 $pendingSupplierBeforeResp.data.count) -Expected 0 -Tolerance 0.01 -Label "Pending supplier list empty before update" | Out-Null
Assert-Approx -Actual (N0 $pendingAgentBeforeResp.data.count) -Expected 0 -Tolerance 0.01 -Label "Pending agent list empty before update" | Out-Null
$baselineMonthlyBurn = N0 $dashboardBeforeResp.data.monthlyBurn
Write-Pass "Baseline dashboard captured (monthlyBurn=$baselineMonthlyBurn)"

Write-Section "PHASE 2: Valid Excel flow preview -> check-status -> apply"

Write-Step "2.1" "Create valid workbook with leading-zero-normalized tracking"
New-OrderUpdateWorkbook -FilePath $validWorkbook -Rows @(
    @{
        trackingNumber = $trackingInExcel
        receiverName = "Receiver After Import"
        receiverAddress = "After Import Address"
        receiverPhone = "0900009999"
        codAmount = $updatedCod
        orderStatus = $deliveredStatus
    }
) | Out-Null
Write-Pass "Valid workbook created"

Write-Step "2.2" "Preview workbook"
$previewResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/preview" -Headers $headers -FilePath $validWorkbook
if (-not $previewResp.ok) {
    Write-Fail "Preview request failed (status=$($previewResp.status))"
    exit 1
}
Assert-Approx -Actual (N0 $previewResp.data.totalRows) -Expected 1 -Tolerance 0.01 -Label "Preview totalRows = 1" | Out-Null
Assert-Equal -Actual $previewResp.data.sampleData[0].trackingNumber -Expected "$trackingInExcel" -Label "Preview sample tracking normalized without leading zeros" | Out-Null
Assert-Equal -Actual $previewResp.data.sampleData[0].orderStatus -Expected $deliveredStatus -Label "Preview sample keeps delivered status" | Out-Null
Assert-True -Condition ($null -ne $previewResp.data.mappingInfo) -Label "Preview mapping info returned" | Out-Null

Write-Step "2.3" "Check updateable status"
$checkResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/check-status" -Headers $headers -FilePath $validWorkbook
if (-not $checkResp.ok) {
    Write-Fail "check-status request failed (status=$($checkResp.status))"
    exit 1
}
Assert-Approx -Actual (N0 $checkResp.data.total) -Expected 1 -Tolerance 0.01 -Label "check-status total = 1" | Out-Null
Assert-Approx -Actual (N0 $checkResp.data.updatable) -Expected 1 -Tolerance 0.01 -Label "check-status updatable = 1" | Out-Null
Assert-Approx -Actual (N0 $checkResp.data.notFound) -Expected 0 -Tolerance 0.01 -Label "check-status notFound = 0" | Out-Null
Assert-Approx -Actual (N0 $checkResp.data.completed) -Expected 0 -Tolerance 0.01 -Label "check-status completed = 0" | Out-Null

Write-Step "2.4" "Apply workbook"
$applyResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/excel" -Headers $headers -FilePath $validWorkbook
if (-not $applyResp.ok) {
    Write-Fail "Excel apply request failed (status=$($applyResp.status))"
    exit 1
}
Assert-Approx -Actual (N0 $applyResp.data.totalProcessed) -Expected 1 -Tolerance 0.01 -Label "Apply totalProcessed = 1" | Out-Null
Assert-Approx -Actual (N0 $applyResp.data.successCount) -Expected 1 -Tolerance 0.01 -Label "Apply successCount = 1" | Out-Null
Assert-Approx -Actual (N0 $applyResp.data.errorCount) -Expected 0 -Tolerance 0.01 -Label "Apply errorCount = 0" | Out-Null
Assert-Approx -Actual (N0 $applyResp.data.skippedCount) -Expected 0 -Tolerance 0.01 -Label "Apply skippedCount = 0" | Out-Null

Write-Section "PHASE 3: Ripple verification after valid Excel apply"

$orderAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers
$dailyAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/daily-profit-report?date=$today" -Headers $headers
$pendingSupplierAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$supplierId&from=$today&to=$today" -Headers $headers
$pendingAgentAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/payment-pending/agent?agentId=$agentId&from=$today&to=$today" -Headers $headers
$dashboardAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/financial-control/dashboard?forceRefresh=true" -Headers $headers

if (-not ($orderAfterResp.ok -and $dailyAfterResp.ok -and $pendingSupplierAfterResp.ok -and $pendingAgentAfterResp.ok -and $dashboardAfterResp.ok)) {
    Write-Fail "Post-apply ripple fetch failed"
    exit 1
}

$orderAfter = $orderAfterResp.data
$dailyAfter = $dailyAfterResp.data
$pendingSupplierAfter = $pendingSupplierAfterResp.data
$pendingAgentAfter = $pendingAgentAfterResp.data
$dashboardAfter = $dashboardAfterResp.data

Assert-Equal -Actual $orderAfter.orderStatus -Expected $deliveredStatus -Label "Order status updated from Excel" | Out-Null
Assert-Equal -Actual $orderAfter.receiverName -Expected "Receiver After Import" -Label "Receiver name updated from Excel" | Out-Null
Assert-Equal -Actual $orderAfter.receiverAddress -Expected "After Import Address" -Label "Receiver address updated from Excel" | Out-Null
Assert-Equal -Actual $orderAfter.receiverPhone -Expected "0900009999" -Label "Receiver phone updated from Excel" | Out-Null
Assert-Approx -Actual (N0 $orderAfter.codAmount) -Expected $updatedCod -Tolerance 0.01 -Label "COD updated from Excel" | Out-Null
Assert-Equal -Actual $orderAfter.supplierPaymentStatus -Expected "pending" -Label "Supplier payment status became pending" | Out-Null
Assert-Equal -Actual $orderAfter.agentPaymentStatus -Expected "pending" -Label "Agent payment status became pending" | Out-Null
Assert-Approx -Actual (N0 $orderAfter.supplierPaidAmount) -Expected $expectedSupplierPaid -Tolerance 0.01 -Label "Supplier paid amount recalculated" | Out-Null
Assert-Approx -Actual (N0 $orderAfter.agentPaidAmount) -Expected $expectedAgentPaid -Tolerance 0.01 -Label "Agent paid amount recalculated" | Out-Null
Assert-Approx -Actual (N0 $orderAfter.grossProfit) -Expected $expectedGrossProfit -Tolerance 0.01 -Label "grossProfit recalculated for completed order" | Out-Null

Assert-Approx -Actual (N0 $dailyAfter.estimated.totalOrders) -Expected 1 -Tolerance 0.01 -Label "Daily report completed order count updated" | Out-Null
Assert-Approx -Actual (N0 $dailyAfter.estimated.totalGrossProfit) -Expected $expectedGrossProfit -Tolerance 0.01 -Label "Daily report gross profit updated" | Out-Null
Assert-Approx -Actual (N0 $dailyAfter.pending.pendingSupplierPayment) -Expected 1 -Tolerance 0.01 -Label "Daily report pending supplier payment count updated" | Out-Null
Assert-Approx -Actual (N0 $dailyAfter.pending.pendingAgentPayment) -Expected 1 -Tolerance 0.01 -Label "Daily report pending agent payment count updated" | Out-Null

Assert-Approx -Actual (N0 $pendingSupplierAfter.count) -Expected 1 -Tolerance 0.01 -Label "Pending supplier list contains order after Excel update" | Out-Null
Assert-Approx -Actual (N0 $pendingSupplierAfter.totalAmount) -Expected $expectedSupplierPendingForDashboard -Tolerance 0.01 -Label "Pending supplier total reflects supplier quote x qty" | Out-Null
Assert-Approx -Actual (N0 $pendingAgentAfter.count) -Expected 1 -Tolerance 0.01 -Label "Pending agent list contains order after Excel update" | Out-Null
Assert-Approx -Actual (N0 $pendingAgentAfter.totalCommission) -Expected $expectedAgentPaid -Tolerance 0.01 -Label "Pending agent total reflects delivered COD commission" | Out-Null

$monthlyBurnAfter = N0 $dashboardAfter.monthlyBurn
Assert-Approx -Actual ($monthlyBurnAfter - $baselineMonthlyBurn) -Expected $expectedMonthlyBurnDelta -Tolerance 0.01 -Label "Financial-control monthlyBurn reflects payable + receivable ripple" | Out-Null

Write-Section "PHASE 4: Partial update keeps existing ripple state"

Write-Step "4.1" "Create partial workbook"
New-OrderUpdateWorkbook -FilePath $partialWorkbook -Rows @(
    @{
        trackingNumber = "$trackingInExcel"
        receiverName = ""
        receiverAddress = ""
        receiverPhone = "0900001111"
        codAmount = ""
        orderStatus = ""
    }
) | Out-Null
Write-Pass "Partial workbook created"

$partialCheckResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/check-status" -Headers $headers -FilePath $partialWorkbook
$partialApplyResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/excel" -Headers $headers -FilePath $partialWorkbook
if (-not ($partialCheckResp.ok -and $partialApplyResp.ok)) {
    Write-Fail "Partial update requests failed"
    exit 1
}

Assert-Approx -Actual (N0 $partialCheckResp.data.updatable) -Expected 1 -Tolerance 0.01 -Label "Partial workbook still matches one order" | Out-Null
Assert-Approx -Actual (N0 $partialApplyResp.data.successCount) -Expected 1 -Tolerance 0.01 -Label "Partial workbook updates exactly one order" | Out-Null

$orderAfterPartialResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers
if (-not $orderAfterPartialResp.ok) {
    Write-Fail "Order fetch after partial update failed"
    exit 1
}
$orderAfterPartial = $orderAfterPartialResp.data

Assert-Equal -Actual $orderAfterPartial.receiverPhone -Expected "0900001111" -Label "Partial update changes requested field" | Out-Null
Assert-Equal -Actual $orderAfterPartial.orderStatus -Expected $deliveredStatus -Label "Partial update does not clear order status" | Out-Null
Assert-Approx -Actual (N0 $orderAfterPartial.codAmount) -Expected $updatedCod -Tolerance 0.01 -Label "Partial update does not clear COD" | Out-Null
Assert-Equal -Actual $orderAfterPartial.supplierPaymentStatus -Expected "pending" -Label "Partial update preserves supplier payment status" | Out-Null
Assert-Equal -Actual $orderAfterPartial.agentPaymentStatus -Expected "pending" -Label "Partial update preserves agent payment status" | Out-Null
Assert-Approx -Actual (N0 $orderAfterPartial.agentPaidAmount) -Expected $expectedAgentPaid -Tolerance 0.01 -Label "Partial update preserves agent amount" | Out-Null

Write-Section "PHASE 5: Schema-valid but business-invalid workbook stays FAIL"

Write-Step "5.1" "Create invalid workbook with unknown tracking"
New-OrderUpdateWorkbook -FilePath $invalidWorkbook -Rows @(
    @{
        trackingNumber = 987654321
        receiverName = "Unknown Receiver"
        receiverAddress = "Unknown Address"
        receiverPhone = "0900002222"
        codAmount = 700000
        orderStatus = $deliveredStatus
    }
) | Out-Null
Write-Pass "Invalid workbook created"

$invalidCheckResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/check-status" -Headers $headers -FilePath $invalidWorkbook
$invalidApplyResp = Invoke-MultipartRequest -Url "$BaseUrl/order-update/excel" -Headers $headers -FilePath $invalidWorkbook
if (-not ($invalidCheckResp.ok -and $invalidApplyResp.ok)) {
    Write-Fail "Invalid workbook request failed"
    exit 1
}

Assert-Approx -Actual (N0 $invalidCheckResp.data.total) -Expected 1 -Tolerance 0.01 -Label "Invalid workbook total = 1" | Out-Null
Assert-Approx -Actual (N0 $invalidCheckResp.data.updatable) -Expected 0 -Tolerance 0.01 -Label "Invalid workbook updatable = 0" | Out-Null
Assert-Approx -Actual (N0 $invalidCheckResp.data.notFound) -Expected 1 -Tolerance 0.01 -Label "Invalid workbook notFound = 1" | Out-Null
Assert-Approx -Actual (N0 $invalidApplyResp.data.successCount) -Expected 0 -Tolerance 0.01 -Label "Invalid workbook successCount = 0" | Out-Null
Assert-Approx -Actual (N0 $invalidApplyResp.data.errorCount) -Expected 1 -Tolerance 0.01 -Label "Invalid workbook errorCount = 1" | Out-Null
Assert-True -Condition ($invalidApplyResp.data.errors.Count -ge 1) -Label "Invalid workbook returns explicit error details" | Out-Null

Write-Section "SUMMARY"
Write-Host ""
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "FAIL: $($script:failCount)" -ForegroundColor Red

if ($script:failCount -gt 0) {
    Write-Host ""
    Write-Host "Failures:" -ForegroundColor Red
    foreach ($item in $script:failDetails) {
        Write-Host " - $item" -ForegroundColor Red
    }
    exit 1
}

exit 0
