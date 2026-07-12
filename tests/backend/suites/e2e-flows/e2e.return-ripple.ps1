#!/usr/bin/env pwsh
<#
    =====================================================================================
    E2E.RETURN-RIPPLE.PS1
    =====================================================================================
    Goal:
      - Verify return-request resolve keeps transactional guards intact
      - Verify mixed restock/scrap affects inventory correctly
      - Verify resolved return rolls order financials back
      - Verify downstream return-report and ad-group-profit-report reflect the rollback
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

function Write-Info($msg) {
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
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

function Get-UserByRole {
    param(
        [hashtable]$Headers,
        [string]$Role
    )

    $usersResp = Invoke-Api -Method GET -Url "$BaseUrl/users" -Headers $Headers
    if (-not $usersResp.ok) {
        return $null
    }

    $items = Get-CollectionItems $usersResp.data
    return $items | Where-Object { $_.role -eq $Role } | Select-Object -First 1
}

function Get-ReportRowByKey {
    param(
        [object[]]$Rows,
        [string]$Key
    )

    return $Rows | Where-Object { [string]$_.key -eq $Key -or [string]$_.adGroupId -eq $Key } | Select-Object -First 1
}

function Get-InventoryTransactions {
    param(
        [hashtable]$Headers,
        [string]$ProductId
    )

    $resp = Invoke-Api -Method GET -Url "$BaseUrl/inventory/$ProductId/transactions?page=1&limit=20" -Headers $Headers
    if (-not $resp.ok) {
        return @{ ok = $false; count = -1; data = @() }
    }

    $data = @(Get-CollectionItems $resp.data)
    return @{ ok = $true; count = $data.Count; data = $data }
}

function Get-InventorySummaryRow {
    param(
        [hashtable]$Headers,
        [string]$ProductName
    )

    $escaped = [System.Uri]::EscapeDataString($ProductName)
    $resp = Invoke-Api -Method GET -Url "$BaseUrl/inventory/summary?page=1&limit=20&q=$escaped" -Headers $Headers
    if (-not $resp.ok) {
        return $null
    }

    $rows = Get-CollectionItems $resp.data
    return $rows | Where-Object { [string]$_.productName -eq $ProductName } | Select-Object -First 1
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$headers = @{}
$today = (Get-Date).ToString("yyyy-MM-dd")
$fromDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$toDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")

$createdCategoryId = $null
$createdProductId = $null
$createdFanpageId = $null
$createdAdAccountId = $null
$createdAdGroupMongoId = $null
$createdAdGroupCode = "rr-ag-$ts"
$createdSupplierQuoteId = $null
$createdOrderId = $null
$createdReturnRequestId = $null

$DeliveredStatus = "Giao thành công"
$ReturnedStatus = "Hàng hoàn"
$DeliveredStatusPatchBody = '{"orderStatus":"Giao th\u00e0nh c\u00f4ng"}'
$ReturnedStatusPatchBody = '{"orderStatus":"H\u00e0ng ho\u00e0n"}'

Write-Section "RETURN RIPPLE E2E - $ts"

try {
    Write-Step "0.1" "Health check"
    $health = Invoke-Api -Method GET -Url $HealthUrl
    if ($health.ok) {
        Write-Pass "Health endpoint reachable"
    } else {
        throw "Backend health check failed"
    }

    Write-Step "0.2" "Login director"
    $login = Invoke-Api -Method POST -Url "$BaseUrl/auth/login" -Body @{
        email = "director@test.com"
        password = "123456"
    }
    if (-not ($login.ok -and $login.data.access_token)) {
        throw "Login failed"
    }
    $headers = @{ Authorization = "Bearer $($login.data.access_token)" }
    Write-Pass "Login OK"

    Write-Step "0.3" "Resolve supplier and agent fixtures"
    $supplier = Get-UserByRole -Headers $headers -Role "internal_supplier"
    $agent = Get-UserByRole -Headers $headers -Role "internal_agent"
    if (-not $supplier) {
        throw "Missing internal_supplier fixture"
    }
    if (-not $agent) {
        throw "Missing internal_agent fixture"
    }
    Write-Pass "Supplier fixture: $(Get-Id $supplier)"
    Write-Pass "Agent fixture: $(Get-Id $agent)"

    Write-Step "0.4" "Resolve canonical delivery statuses"
    $statusResp = Invoke-Api -Method GET -Url "$BaseUrl/delivery-status" -Headers $headers
    if ($statusResp.ok) {
        $statusItems = @(Get-CollectionItems $statusResp.data)
        $deliveredStatusItem = $statusItems | Where-Object { $_.isFinal -eq $true -and $_.isReturnStatus -ne $true } | Select-Object -First 1
        $returnedStatusItem = $statusItems | Where-Object { $_.isReturnStatus -eq $true } | Select-Object -First 1
        if ($deliveredStatusItem -and $deliveredStatusItem.name) {
            $DeliveredStatus = [string]$deliveredStatusItem.name
        }
        if ($returnedStatusItem -and $returnedStatusItem.name) {
            $ReturnedStatus = [string]$returnedStatusItem.name
        }
    }
    Write-Pass "Delivered status fixture: $DeliveredStatus"
    Write-Pass "Returned status fixture: $ReturnedStatus"

    Write-Step "1.1" "Create product category"
    $categoryResp = Invoke-Api -Method POST -Url "$BaseUrl/product-category" -Headers $headers -Body @{
        name = "Return Ripple Category $ts"
        description = "Return ripple isolated fixture"
        color = "#0F766E"
        isActive = $true
    }
    if (-not ($categoryResp.ok -and (Get-Id $categoryResp.data))) {
        throw "Create product category failed"
    }
    $createdCategoryId = Get-Id $categoryResp.data
    Write-Pass "Category created: $createdCategoryId"

    Write-Step "1.2" "Create product"
    $productName = "Return Ripple Product $ts"
    $productResp = Invoke-Api -Method POST -Url "$BaseUrl/products" -Headers $headers -Body @{
        name = $productName
        categoryId = $createdCategoryId
        importPrice = 50000
        shippingCost = 15000
        packagingCost = 10000
        isReturnable = $true
        minStock = 0
    }
    if (-not ($productResp.ok -and (Get-Id $productResp.data))) {
        throw "Create product failed"
    }
    $createdProductId = Get-Id $productResp.data
    Write-Pass "Product created: $createdProductId"

    Write-Step "1.3" "Create fanpage, ad account, and ad group"
    $fanpageResp = Invoke-Api -Method POST -Url "$BaseUrl/fanpages" -Headers $headers -Body @{
        name = "Return Ripple Fanpage $ts"
        pageId = "rr-page-$ts"
        accessToken = "rr-token-$ts"
    }
    if (-not ($fanpageResp.ok -and (Get-Id $fanpageResp.data))) {
        throw "Create fanpage failed"
    }
    $createdFanpageId = Get-Id $fanpageResp.data
    Write-Pass "Fanpage created: $createdFanpageId"

    $adAccountResp = Invoke-Api -Method POST -Url "$BaseUrl/ad-accounts" -Headers $headers -Body @{
        name = "Return Ripple Ad Account $ts"
        accountId = "rr-account-$ts"
        accountType = "facebook"
    }
    if (-not ($adAccountResp.ok -and (Get-Id $adAccountResp.data))) {
        throw "Create ad account failed"
    }
    $createdAdAccountId = Get-Id $adAccountResp.data
    Write-Pass "Ad account created: $createdAdAccountId"

    $adGroupResp = Invoke-Api -Method POST -Url "$BaseUrl/ad-groups" -Headers $headers -Body @{
        name = "Return Ripple Ad Group $ts"
        adGroupId = $createdAdGroupCode
        platform = "facebook"
        fanpageId = $createdFanpageId
        productCategoryId = $createdCategoryId
        selectedProducts = @($createdProductId)
        agentId = (Get-Id $agent)
        adAccountId = $createdAdAccountId
        isActive = $true
    }
    if (-not ($adGroupResp.ok -and (Get-Id $adGroupResp.data))) {
        throw "Create ad group failed"
    }
    $createdAdGroupMongoId = Get-Id $adGroupResp.data
    Write-Pass "Ad group created: $createdAdGroupMongoId / $createdAdGroupCode"

    Write-Step "1.4" "Create supplier quote"
    $supplierQuoteResp = Invoke-Api -Method POST -Url "$BaseUrl/supplier-quotes" -Headers $headers -Body @{
        supplierId = (Get-Id $supplier)
        productId = $createdProductId
        price = 50000
        shippingFee = 15000
        returnFee = 10000
        effectiveAt = $today
    }
    if (-not ($supplierQuoteResp.ok -and (Get-Id $supplierQuoteResp.data))) {
        throw "Create supplier quote failed"
    }
    $createdSupplierQuoteId = Get-Id $supplierQuoteResp.data
    Write-Pass "Supplier quote created: $createdSupplierQuoteId"

    Write-Step "2.1" "Create order fixture"
    $orderResp = Invoke-Api -Method POST -Url "$BaseUrl/test-order2" -Headers $headers -Body @{
        customerName = "Return Ripple Customer $ts"
        productId = $createdProductId
        supplierId = (Get-Id $supplier)
        adGroupId = $createdAdGroupCode
        quantity = 2
        codAmount = 200000
        orderDate = $today
    }
    if (-not ($orderResp.ok -and (Get-Id $orderResp.data))) {
        throw "Create order failed"
    }
    $createdOrderId = Get-Id $orderResp.data
    Write-Pass "Order created: $createdOrderId"

    Write-Step "2.2" "Promote order to delivered via status patch"
    $deliverResp = Invoke-Api -Method PATCH -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers -Body $DeliveredStatusPatchBody
    if (-not $deliverResp.ok) {
        throw "Patch order to delivered failed"
    }
    $orderBefore = $deliverResp.data
    $expectedDeliveredGross = ((N0 $orderBefore.codAmount) - ((N0 $orderBefore.supplierQuote) * (N0 $orderBefore.quantity)) - (N0 $orderBefore.shippingFee) - (N0 $orderBefore.returnFee))
    $expectedDeliveredNet = $expectedDeliveredGross - (N0 $orderBefore.advertisingCost) - (N0 $orderBefore.laborCostAllocation) - (N0 $orderBefore.otherCostAllocation)
    $expectedDeliveredSupplierPaid = (N0 $orderBefore.codAmount) - ((N0 $orderBefore.supplierQuote) * (N0 $orderBefore.quantity)) - (N0 $orderBefore.shippingFee)
    [void](Assert-Equal -Actual ([string]$orderBefore.orderStatus) -Expected $DeliveredStatus -Label "Pre-return order status")
    [void](Assert-Approx -Actual (N0 $orderBefore.supplierQuote) -Expected 50000 -Tolerance 0.001 -Label "Supplier quote snapshot")
    [void](Assert-Approx -Actual (N0 $orderBefore.shippingFee) -Expected 15000 -Tolerance 0.001 -Label "Shipping fee snapshot")
    [void](Assert-Approx -Actual (N0 $orderBefore.returnFee) -Expected 10000 -Tolerance 0.001 -Label "Return fee snapshot")
    [void](Assert-Approx -Actual (N0 $orderBefore.supplierPaidAmount) -Expected $expectedDeliveredSupplierPaid -Tolerance 0.001 -Label "Delivered supplier paid amount")
    [void](Assert-Approx -Actual (N0 $orderBefore.grossProfit) -Expected $expectedDeliveredGross -Tolerance 0.001 -Label "Delivered gross profit")
    [void](Assert-Approx -Actual (N0 $orderBefore.netProfit) -Expected $expectedDeliveredNet -Tolerance 0.001 -Label "Delivered net profit")

    Write-Step "2.3" "Verify pre-return reports"
    $productReportBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/return-report/product?fromDate=$fromDate&toDate=$toDate&productId=$createdProductId" -Headers $headers
    if (-not $productReportBeforeResp.ok) {
        throw "Pre-return product report failed"
    }
    $productReportBefore = @(Get-CollectionItems $productReportBeforeResp.data)
    $productRowBefore = Get-ReportRowByKey -Rows $productReportBefore -Key $createdProductId
    if (-not $productRowBefore) {
        throw "Pre-return product report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $productRowBefore.totalOrders)) -Expected 1 -Label "Product report totalOrders before resolve")
    [void](Assert-Equal -Actual ([int](N0 $productRowBefore.returnOrders)) -Expected 0 -Label "Product report returnOrders before resolve")

    $adGroupReportBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/return-report/ad-group?fromDate=$fromDate&toDate=$toDate&adGroupId=$createdAdGroupCode" -Headers $headers
    if (-not $adGroupReportBeforeResp.ok) {
        throw "Pre-return ad-group report failed"
    }
    $adGroupReportBefore = @(Get-CollectionItems $adGroupReportBeforeResp.data)
    $adGroupRowBefore = Get-ReportRowByKey -Rows $adGroupReportBefore -Key $createdAdGroupCode
    if (-not $adGroupRowBefore) {
        throw "Pre-return ad-group report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $adGroupRowBefore.totalOrders)) -Expected 1 -Label "Ad-group return report totalOrders before resolve")
    [void](Assert-Equal -Actual ([int](N0 $adGroupRowBefore.returnOrders)) -Expected 0 -Label "Ad-group return report returnOrders before resolve")

    $profitBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/ad-group-profit-report/performance?startDate=$fromDate&endDate=$toDate&adGroupIds=$createdAdGroupCode" -Headers $headers
    if (-not $profitBeforeResp.ok) {
        throw "Pre-return ad-group profit report failed"
    }
    $profitBeforeRows = @(Get-CollectionItems $profitBeforeResp.data)
    $profitBefore = $profitBeforeRows | Where-Object { [string]$_.adGroupId -eq $createdAdGroupCode } | Select-Object -First 1
    if (-not $profitBefore) {
        throw "Pre-return profit report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $profitBefore.totalOrders)) -Expected 1 -Label "Ad-group profit totalOrders before resolve")
    [void](Assert-Equal -Actual ([int](N0 $profitBefore.successOrders)) -Expected 1 -Label "Ad-group profit successOrders before resolve")
    [void](Assert-Equal -Actual ([int](N0 $profitBefore.returnOrders)) -Expected 0 -Label "Ad-group profit returnOrders before resolve")
    [void](Assert-Approx -Actual (N0 $profitBefore.totalRevenue) -Expected (N0 $orderBefore.codCollectedBySupplier) -Tolerance 0.001 -Label "Ad-group profit totalRevenue before resolve")
    [void](Assert-Approx -Actual (N0 $profitBefore.totalNetProfit) -Expected (N0 $orderBefore.netProfit) -Tolerance 0.001 -Label "Ad-group profit totalNetProfit before resolve")

    Write-Step "3.1" "Create return request with mixed restock/scrap lines"
    $returnRequestResp = Invoke-Api -Method POST -Url "$BaseUrl/returns" -Headers $headers -Body @{
        orderId = $createdOrderId
        supplierId = (Get-Id $supplier)
        reason = "E2E mixed restock/scrap $ts"
        items = @(
            @{ productId = $createdProductId; quantityReturned = 1; notes = "restock-line" },
            @{ productId = $createdProductId; quantityReturned = 1; notes = "scrap-line" }
        )
    }
    if (-not ($returnRequestResp.ok -and (Get-Id $returnRequestResp.data))) {
        throw "Create return request failed"
    }
    $createdReturnRequestId = Get-Id $returnRequestResp.data
    Write-Pass "Return request created: $createdReturnRequestId"

    $returnDetailBeforeResp = Invoke-Api -Method GET -Url "$BaseUrl/returns/$createdReturnRequestId" -Headers $headers
    if (-not $returnDetailBeforeResp.ok) {
        throw "Get return request detail failed"
    }
    $returnDetailBefore = $returnDetailBeforeResp.data
    [void](Assert-Equal -Actual ([string]$returnDetailBefore.status) -Expected "pending" -Label "Return request status before resolve")
    [void](Assert-Equal -Actual $returnDetailBefore.items.Count -Expected 2 -Label "Return request item count")

    $itemIds = @($returnDetailBefore.items | ForEach-Object { [string]$_.'_id' })
    if ($itemIds.Count -ne 2 -or $itemIds -contains $null -or $itemIds -contains "") {
        throw "Return request item ids missing"
    }
    Write-Pass "Return request item ids present"

    Write-Step "3.2" "Duplicate payload should fail without partial side effects"
    $inventoryBefore = Get-InventoryTransactions -Headers $headers -ProductId $createdProductId
    if (-not $inventoryBefore.ok) {
        throw "Inventory transaction precheck failed"
    }
    [void](Assert-Equal -Actual $inventoryBefore.count -Expected 0 -Label "Inventory tx count before resolve")

    $duplicateResolveResp = Invoke-Api -Method PATCH -Url "$BaseUrl/returns/$createdReturnRequestId/resolve" -Headers $headers -Body @{
        reason = "duplicate-payload"
        items = @(
            @{ itemId = $itemIds[0]; decision = "restock"; quantity = 1; recoveryUnitCost = 30000 },
            @{ itemId = $itemIds[0]; decision = "scrap"; quantity = 1 }
        )
    }
    [void](Assert-Equal -Actual $duplicateResolveResp.status -Expected 400 -Label "Duplicate resolve returns HTTP 400")

    $returnDetailAfterBadResp = Invoke-Api -Method GET -Url "$BaseUrl/returns/$createdReturnRequestId" -Headers $headers
    if (-not $returnDetailAfterBadResp.ok) {
        throw "Return request re-read after bad resolve failed"
    }
    $returnDetailAfterBad = $returnDetailAfterBadResp.data
    [void](Assert-Equal -Actual ([string]$returnDetailAfterBad.status) -Expected "pending" -Label "Return request remains pending after bad resolve")

    $inventoryAfterBad = Get-InventoryTransactions -Headers $headers -ProductId $createdProductId
    if (-not $inventoryAfterBad.ok) {
        throw "Inventory transaction recheck after bad resolve failed"
    }
    [void](Assert-Equal -Actual $inventoryAfterBad.count -Expected 0 -Label "Inventory tx unchanged after bad resolve")

    $orderAfterBadResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers
    if (-not $orderAfterBadResp.ok) {
        throw "Order re-read after bad resolve failed"
    }
    $orderAfterBad = $orderAfterBadResp.data
    [void](Assert-Equal -Actual ([string]$orderAfterBad.orderStatus) -Expected $DeliveredStatus -Label "Order status unchanged after bad resolve")
    [void](Assert-Approx -Actual (N0 $orderAfterBad.netProfit) -Expected (N0 $orderBefore.netProfit) -Tolerance 0.001 -Label "Order net profit unchanged after bad resolve")

    Write-Step "4.1" "Resolve valid mixed restock/scrap payload"
    $validResolveResp = Invoke-Api -Method PATCH -Url "$BaseUrl/returns/$createdReturnRequestId/resolve" -Headers $headers -Body @{
        reason = "valid-mixed-resolve"
        items = @(
            @{ itemId = $itemIds[0]; decision = "restock"; quantity = 1; recoveryUnitCost = 30000 },
            @{ itemId = $itemIds[1]; decision = "scrap"; quantity = 1 }
        )
    }
    if (-not $validResolveResp.ok) {
        throw "Valid resolve failed"
    }
    Write-Pass "Valid resolve accepted"

    $returnDetailAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/returns/$createdReturnRequestId" -Headers $headers
    if (-not $returnDetailAfterResp.ok) {
        throw "Get return request after valid resolve failed"
    }
    $returnDetailAfter = $returnDetailAfterResp.data
    [void](Assert-Equal -Actual ([string]$returnDetailAfter.status) -Expected "resolved" -Label "Return request status after valid resolve")
    [void](Assert-True -Condition ([bool]$returnDetailAfter.resolvedAt) -Label "Return request resolvedAt populated")
    $restockLine = $returnDetailAfter.items | Where-Object { [string]$_.'_id' -eq $itemIds[0] } | Select-Object -First 1
    $scrapLine = $returnDetailAfter.items | Where-Object { [string]$_.'_id' -eq $itemIds[1] } | Select-Object -First 1
    [void](Assert-Equal -Actual ([string]$restockLine.decision) -Expected "restock" -Label "Restock line decision")
    [void](Assert-Approx -Actual (N0 $restockLine.processedQuantity) -Expected 1 -Tolerance 0.001 -Label "Restock line processed quantity")
    [void](Assert-Approx -Actual (N0 $restockLine.recoveryUnitCost) -Expected 30000 -Tolerance 0.001 -Label "Restock line recovery unit cost")
    [void](Assert-Equal -Actual ([string]$scrapLine.decision) -Expected "scrap" -Label "Scrap line decision")
    [void](Assert-Approx -Actual (N0 $scrapLine.processedQuantity) -Expected 1 -Tolerance 0.001 -Label "Scrap line processed quantity")

    $inventoryAfter = Get-InventoryTransactions -Headers $headers -ProductId $createdProductId
    if (-not $inventoryAfter.ok) {
        throw "Inventory transaction read after valid resolve failed"
    }
    [void](Assert-Equal -Actual $inventoryAfter.count -Expected 1 -Label "Inventory tx count after valid resolve")
    $summaryRow = Get-InventorySummaryRow -Headers $headers -ProductName $productName
    if (-not $summaryRow) {
        throw "Inventory summary row missing after valid resolve"
    }
    [void](Assert-Approx -Actual (N0 $summaryRow.onHand) -Expected 1 -Tolerance 0.001 -Label "Inventory onHand after mixed restock/scrap")

    Write-Step "4.2" "Verify downstream rollback after resolve"
    $orderAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/test-order2/$createdOrderId" -Headers $headers
    if (-not $orderAfterResp.ok) {
        throw "Order read after valid resolve failed"
    }
    $orderAfter = $orderAfterResp.data
    $isReturnable = $true
    if ($null -ne $orderAfter.supplierIsReturnableSnapshot) {
        $isReturnable = [bool]$orderAfter.supplierIsReturnableSnapshot
    }
    $supplierCostOnReturn = if ($isReturnable) { 0.0 } else { (N0 $orderAfter.supplierQuote) * (N0 $orderAfter.quantity) }
    $expectedSupplierPaidAfter = 0.0 - $supplierCostOnReturn - (N0 $orderAfter.shippingFee) - (N0 $orderAfter.returnFee)
    $expectedGrossAfter = $expectedSupplierPaidAfter
    $expectedNetAfter = $expectedGrossAfter - (N0 $orderAfter.advertisingCost) - (N0 $orderAfter.laborCostAllocation) - (N0 $orderAfter.otherCostAllocation)

    [void](Assert-Equal -Actual ([string]$orderAfter.orderStatus) -Expected $ReturnedStatus -Label "Order status rolled back to returned after resolve")
    [void](Assert-Approx -Actual (N0 $orderAfter.codCollectedBySupplier) -Expected 0 -Tolerance 0.001 -Label "COD collected cleared after return resolve")
    [void](Assert-Approx -Actual (N0 $orderAfter.supplierPaidAmount) -Expected $expectedSupplierPaidAfter -Tolerance 0.001 -Label "Supplier paid amount rolled back after resolve")
    [void](Assert-Approx -Actual (N0 $orderAfter.grossProfit) -Expected $expectedGrossAfter -Tolerance 0.001 -Label "Gross profit rolled back after resolve")
    [void](Assert-Approx -Actual (N0 $orderAfter.netProfit) -Expected $expectedNetAfter -Tolerance 0.001 -Label "Net profit rolled back after resolve")

    $productReportAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/return-report/product?fromDate=$fromDate&toDate=$toDate&productId=$createdProductId" -Headers $headers
    if (-not $productReportAfterResp.ok) {
        throw "Post-resolve product report failed"
    }
    $productReportAfter = @(Get-CollectionItems $productReportAfterResp.data)
    $productRowAfter = Get-ReportRowByKey -Rows $productReportAfter -Key $createdProductId
    if (-not $productRowAfter) {
        throw "Post-resolve product report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $productRowAfter.totalOrders)) -Expected 1 -Label "Product report totalOrders after resolve")
    [void](Assert-Equal -Actual ([int](N0 $productRowAfter.returnOrders)) -Expected 1 -Label "Product report returnOrders after resolve")
    [void](Assert-Approx -Actual (N0 $productRowAfter.returnRate) -Expected 1 -Tolerance 0.0001 -Label "Product report returnRate after resolve")

    $adGroupReportAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/return-report/ad-group?fromDate=$fromDate&toDate=$toDate&adGroupId=$createdAdGroupCode" -Headers $headers
    if (-not $adGroupReportAfterResp.ok) {
        throw "Post-resolve ad-group return report failed"
    }
    $adGroupReportAfter = @(Get-CollectionItems $adGroupReportAfterResp.data)
    $adGroupRowAfter = Get-ReportRowByKey -Rows $adGroupReportAfter -Key $createdAdGroupCode
    if (-not $adGroupRowAfter) {
        throw "Post-resolve ad-group return report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $adGroupRowAfter.totalOrders)) -Expected 1 -Label "Ad-group return report totalOrders after resolve")
    [void](Assert-Equal -Actual ([int](N0 $adGroupRowAfter.returnOrders)) -Expected 1 -Label "Ad-group return report returnOrders after resolve")

    $profitAfterResp = Invoke-Api -Method GET -Url "$BaseUrl/ad-group-profit-report/performance?startDate=$fromDate&endDate=$toDate&adGroupIds=$createdAdGroupCode" -Headers $headers
    if (-not $profitAfterResp.ok) {
        throw "Post-resolve ad-group profit report failed"
    }
    $profitAfterRows = @(Get-CollectionItems $profitAfterResp.data)
    $profitAfter = $profitAfterRows | Where-Object { [string]$_.adGroupId -eq $createdAdGroupCode } | Select-Object -First 1
    if (-not $profitAfter) {
        throw "Post-resolve profit report row missing"
    }
    [void](Assert-Equal -Actual ([int](N0 $profitAfter.totalOrders)) -Expected 1 -Label "Ad-group profit totalOrders after resolve")
    [void](Assert-Equal -Actual ([int](N0 $profitAfter.successOrders)) -Expected 0 -Label "Ad-group profit successOrders after resolve")
    [void](Assert-Equal -Actual ([int](N0 $profitAfter.returnOrders)) -Expected 1 -Label "Ad-group profit returnOrders after resolve")
    [void](Assert-Approx -Actual (N0 $profitAfter.totalRevenue) -Expected 0 -Tolerance 0.001 -Label "Ad-group profit totalRevenue after resolve")
    [void](Assert-Approx -Actual (N0 $profitAfter.totalNetProfit) -Expected $expectedNetAfter -Tolerance 0.001 -Label "Ad-group profit totalNetProfit after resolve")
}
catch {
    Write-Fail $_.Exception.Message
}
finally {
    Write-Section "CLEANUP"
    foreach ($cleanup in @(
        @{ Url = if ($createdSupplierQuoteId) { "$BaseUrl/supplier-quotes/$createdSupplierQuoteId" } else { $null }; Label = "SupplierQuote" },
        @{ Url = if ($createdAdGroupMongoId) { "$BaseUrl/ad-groups/$createdAdGroupMongoId" } else { $null }; Label = "AdGroup" },
        @{ Url = if ($createdAdAccountId) { "$BaseUrl/ad-accounts/$createdAdAccountId" } else { $null }; Label = "AdAccount" },
        @{ Url = if ($createdFanpageId) { "$BaseUrl/fanpages/$createdFanpageId" } else { $null }; Label = "Fanpage" },
        @{ Url = if ($createdProductId) { "$BaseUrl/products/$createdProductId" } else { $null }; Label = "Product" },
        @{ Url = if ($createdCategoryId) { "$BaseUrl/product-category/$createdCategoryId" } else { $null }; Label = "Category" }
    )) {
        if (-not $cleanup.Url) { continue }
        $cleanupResp = Invoke-Api -Method DELETE -Url $cleanup.Url -Headers $headers
        if ($cleanupResp.ok) {
            Write-Info "Deleted $($cleanup.Label)"
        } else {
            Write-Info "Cleanup skipped for $($cleanup.Label)"
        }
    }
}

Write-Section "FINAL SUMMARY"
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "FAIL: $($script:failCount)" -ForegroundColor Red
if ($script:failCount -gt 0) {
    Write-Host ""
    Write-Host "Failure details:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
}

exit 0
