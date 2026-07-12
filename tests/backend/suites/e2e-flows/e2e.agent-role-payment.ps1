#!/usr/bin/env pwsh
<#
  Focused E2E regression for agent-role payment logic.
  Covers:
  - external_agent delivered
  - external_agent returned
  - internal_agent delivered
  - internal_agent returned
  - pending agent payment list excludes internal agents
  - agent payment batch accepts external orders and rejects internal orders
#>

$ErrorActionPreference = "Continue"
function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}

$BaseUrl = Get-BackendBaseUrl

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
        $eb = ""
        try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}

function Expect-Failure {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null)
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        $resp = Invoke-RestMethod @params
        return @{ ok = $true; status = 200; data = $resp; error = "" }
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        $eb = ""
        try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        return @{ ok = $false; status = $st; data = $null; error = $eb }
    }
}

function Get-Id($obj) {
    if ($null -eq $obj) { return "" }
    if ($obj -is [string]) { return $obj }
    if ($obj._id) { return $obj._id }
    if ($obj.id) { return $obj.id }
    return ""
}

function Assert-Equal {
    param([string]$Name, $Expected, $Actual, [double]$Tolerance = 1)
    $e = [double]$Expected
    $a = [double]$Actual
    if ([math]::Abs($e - $a) -le $Tolerance) {
        Write-Pass "$Name = $a (expected: $e)"
    } else {
        Write-Fail "$Name = $a (expected: $e, diff: $([math]::Round($a - $e, 2)))"
    }
}

function Assert-Text {
    param([string]$Name, [string]$Expected, [string]$Actual)
    if ($Expected -eq $Actual) {
        Write-Pass "$Name = '$Actual'"
    } else {
        Write-Fail "$Name = '$Actual' (expected '$Expected')"
    }
}

function Assert-True {
    param([string]$Name, [bool]$Condition, [string]$FailMessage)
    if ($Condition) {
        Write-Pass $Name
    } else {
        Write-Fail $FailMessage
    }
}

function Number-OrZero($Value) {
    if ($null -eq $Value -or $Value -eq "") { return 0 }
    return [double]$Value
}

function New-JsonBody($Data) {
    return ($Data | ConvertTo-Json -Depth 8)
}

function Invoke-DeleteSilently {
    param([string]$Uri, [hashtable]$Headers)
    try {
        Invoke-RestMethod -Method DELETE -Uri $Uri -Headers $Headers | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Is-ReturnedStatus($Status) {
    return (-not [string]::IsNullOrWhiteSpace($script:returnedStatusName)) -and ($Status -eq $script:returnedStatusName)
}

function Build-OrderPayload {
    param(
        [string]$CustomerName,
        [string]$ProductId,
        [string]$SupplierId,
        [string]$AgentId,
        [int]$Quantity,
        [int]$CodAmount,
        [bool]$UseExternalSnapshot
    )

    $body = @{
        customerName = $CustomerName
        productId = $ProductId
        supplierId = $SupplierId
        agentId = $AgentId
        quantity = $Quantity
        codAmount = $CodAmount
        orderDate = (Get-Date).ToString("yyyy-MM-dd")
    }

    if ($UseExternalSnapshot) {
        $body.agentQuoteId = "manual-agent-quote-$ts-$CustomerName"
        $body.agentAppliedPrice = 80000
        $body.agentQuote = 80000
    }

    return (New-JsonBody $body)
}

function Assert-SupplierAmounts {
    param([string]$CaseName, $Order)

    $sq = Number-OrZero $Order.supplierQuote
    $qty = Number-OrZero $Order.quantity
    $ship = Number-OrZero $Order.shippingFee
    $ret = Number-OrZero $Order.returnFee
    $cod = Number-OrZero $Order.codAmount
    $isReturnable = if ($null -ne $Order.supplierIsReturnableSnapshot) { [bool]$Order.supplierIsReturnableSnapshot } else { $true }
    $isReturn = Is-ReturnedStatus $Order.orderStatus

    if ($isReturn) {
        $supplierCostOnReturn = if ($isReturnable) { 0 } else { ($sq * $qty) }
        $expectedSupplierPaid = 0 - $supplierCostOnReturn - $ship - $ret
    } else {
        $expectedSupplierPaid = $cod - ($sq * $qty) - $ship
    }

    Assert-Equal "$CaseName supplierPaidAmount" $expectedSupplierPaid (Number-OrZero $Order.supplierPaidAmount)
}

function Assert-ExternalCase {
    param([string]$CaseName, $Order)

    $aq = Number-OrZero $Order.agentQuote
    $sq = Number-OrZero $Order.supplierQuote
    $qty = Number-OrZero $Order.quantity
    $ship = Number-OrZero $Order.shippingFee
    $ret = Number-OrZero $Order.returnFee
    $cod = Number-OrZero $Order.codAmount
    $isReturn = Is-ReturnedStatus $Order.orderStatus
    $isReturnable = if ($null -ne $Order.supplierIsReturnableSnapshot) { [bool]$Order.supplierIsReturnableSnapshot } else { $true }
    $supplierCost = if ($isReturn -and $isReturnable) { 0 } else { ($sq * $qty) }
    $effectiveCod = if ($isReturn) { 0 } else { $cod }
    # Product rule (confirmed in backend services on 2026-03-15):
    # external-agent commission = COD - (agentQuote * qty); shipping/return stays on company side.
    $expectedAgentPaid = if ($isReturn) { 0 - ($aq * $qty) } else { $cod - ($aq * $qty) }
    $expectedGrossProfit = $effectiveCod - $supplierCost - $ship - $ret - $expectedAgentPaid

    Assert-SupplierAmounts $CaseName $Order
    Assert-Equal "$CaseName agentQuote" 80000 $aq
    Assert-Equal "$CaseName agentPaidAmount" $expectedAgentPaid (Number-OrZero $Order.agentPaidAmount)
    Assert-Text "$CaseName agentPaymentStatus" "pending" "$($Order.agentPaymentStatus)"
    Assert-Equal "$CaseName grossProfit" $expectedGrossProfit (Number-OrZero $Order.grossProfit)
    Assert-Equal "$CaseName agentCommissionFinal" $expectedAgentPaid (Number-OrZero $Order.agentCommissionFinal)
    Assert-True "$CaseName agentEligibleAt set" (-not [string]::IsNullOrWhiteSpace("$($Order.agentEligibleAt)")) "$CaseName agentEligibleAt missing"
}

function Assert-InternalCase {
    param([string]$CaseName, $Order)

    $sq = Number-OrZero $Order.supplierQuote
    $qty = Number-OrZero $Order.quantity
    $ship = Number-OrZero $Order.shippingFee
    $ret = Number-OrZero $Order.returnFee
    $cod = Number-OrZero $Order.codAmount
    $isReturn = Is-ReturnedStatus $Order.orderStatus
    $isReturnable = if ($null -ne $Order.supplierIsReturnableSnapshot) { [bool]$Order.supplierIsReturnableSnapshot } else { $true }
    $supplierCost = if ($isReturn -and $isReturnable) { 0 } else { ($sq * $qty) }
    $effectiveCod = if ($isReturn) { 0 } else { $cod }
    $expectedGrossProfit = $effectiveCod - $supplierCost - $ship - $ret

    Assert-SupplierAmounts $CaseName $Order
    Assert-Equal "$CaseName agentPaidAmount" 0 (Number-OrZero $Order.agentPaidAmount)
    Assert-Text "$CaseName agentPaymentStatus" "n/a" "$($Order.agentPaymentStatus)"
    Assert-Equal "$CaseName grossProfit" $expectedGrossProfit (Number-OrZero $Order.grossProfit)

    $commissionFinal = Number-OrZero $Order.agentCommissionFinal
    if ($commissionFinal -eq 0) {
        Write-Pass "$CaseName agentCommissionFinal not generated"
    } else {
        Write-Fail "$CaseName agentCommissionFinal should not be generated, got $commissionFinal"
    }
}

function Invoke-Cleanup {
    param([hashtable]$Headers)

    if (-not $Headers) { return }

    Write-Step "9.1" "Cleanup"
    foreach ($orderId in $script:cleanupOrders) {
        if ($orderId) {
            if (Invoke-DeleteSilently -Uri "$BaseUrl/test-order2/$orderId" -Headers $Headers) {
                Write-Info "Deleted order: $orderId"
            } else {
                Write-Info "Cleanup skipped for order: $orderId"
            }
        }
    }
    foreach ($sqCleanupId in $script:cleanupSupplierQuoteIds) {
        if ($sqCleanupId) {
            if (Invoke-DeleteSilently -Uri "$BaseUrl/supplier-quotes/$sqCleanupId" -Headers $Headers) {
                Write-Info "Deleted supplier quote: $sqCleanupId"
            } else {
                Write-Info "Cleanup skipped for supplier quote: $sqCleanupId"
            }
        }
    }
    if ($script:cleanupProductId) {
        if (Invoke-DeleteSilently -Uri "$BaseUrl/products/$($script:cleanupProductId)" -Headers $Headers) {
            Write-Info "Deleted product: $($script:cleanupProductId)"
        } else {
            Write-Info "Cleanup skipped for product: $($script:cleanupProductId)"
        }
    }
    if ($script:cleanupCategoryId) {
        if (Invoke-DeleteSilently -Uri "$BaseUrl/product-category/$($script:cleanupCategoryId)" -Headers $Headers) {
            Write-Info "Deleted category: $($script:cleanupCategoryId)"
        } else {
            Write-Info "Cleanup skipped for category: $($script:cleanupCategoryId)"
        }
    }
    foreach ($userId in $script:cleanupUserIds) {
        if ($userId) {
            if (Invoke-DeleteSilently -Uri "$BaseUrl/users/$userId" -Headers $Headers) {
                Write-Info "Deleted user: $userId"
            } else {
                Write-Info "Cleanup skipped for user: $userId"
            }
        }
    }
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$script:cleanupOrders = @()
$script:cleanupSupplierQuoteIds = @()
$script:cleanupUserIds = @()
$script:cleanupProductId = ""
$script:cleanupCategoryId = ""
$script:deliveredStatusName = ""
$script:returnedStatusName = ""

Write-Section "AGENT ROLE PAYMENT CASES - $ts"

$h = $null

try {
    Write-Step "0.1" "Login director"
    $login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
    if ($login -and $login.access_token) {
        $h = @{ Authorization = "Bearer $($login.access_token)" }
        Write-Pass "Login OK"
    } else {
        Write-Fail "Login failed - cannot continue"
        throw "login_failed"
    }

    Write-Step "0.1b" "Resolve canonical delivery statuses"
    $deliveryStatuses = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status" -Headers $h -Label "DeliveryStatuses"
    if (-not $deliveryStatuses) {
        Write-Fail "Delivery status lookup failed - cannot continue"
        throw "delivery_status_lookup_failed"
    }

    $deliveredStatus = @($deliveryStatuses | Where-Object { $_.isPaymentTrigger -eq $true -and $_.isReturnStatus -ne $true } | Sort-Object order | Select-Object -First 1)
    $returnedStatus = @($deliveryStatuses | Where-Object { $_.isPaymentTrigger -eq $true -and $_.isReturnStatus -eq $true } | Sort-Object order | Select-Object -First 1)
    $script:deliveredStatusName = if ($deliveredStatus.Count -gt 0) { [string]$deliveredStatus[0].name } else { "" }
    $script:returnedStatusName = if ($returnedStatus.Count -gt 0) { [string]$returnedStatus[0].name } else { "" }

    if (-not $script:deliveredStatusName -or -not $script:returnedStatusName) {
        Write-Fail "Could not resolve canonical delivery statuses"
        throw "delivery_status_missing"
    }
    Write-Pass "Resolved delivered status: $($script:deliveredStatusName)"
    Write-Pass "Resolved returned status: $($script:returnedStatusName)"

    Write-Step "0.2" "Create isolated users"
    $extAgentBody = New-JsonBody @{ email = "agent-role-ext-$ts@test.com"; password = "123456"; fullName = "Agent Role Ext"; role = "external_agent"; phone = "0901001001"; isActive = $true }
    $intAgentBody = New-JsonBody @{ email = "agent-role-int-$ts@test.com"; password = "123456"; fullName = "Agent Role Int"; role = "internal_agent"; phone = "0901001002"; isActive = $true }
    $supplierBody = New-JsonBody @{ email = "agent-role-supplier-$ts@test.com"; password = "123456"; fullName = "Agent Role Supplier"; role = "internal_supplier"; phone = "0901001003"; isActive = $true }

    $extAgent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $extAgentBody -Label "CreateExtAgent"
    $intAgent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $intAgentBody -Label "CreateIntAgent"
    $supplier = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $supplierBody -Label "CreateSupplier"

    $extAgentId = Get-Id $extAgent
    $intAgentId = Get-Id $intAgent
    $supplierId = Get-Id $supplier

    if ($extAgentId) { $script:cleanupUserIds += $extAgentId; Write-Pass "Created external agent: $extAgentId" } else { Write-Fail "External agent create failed" }
    if ($intAgentId) { $script:cleanupUserIds += $intAgentId; Write-Pass "Created internal agent: $intAgentId" } else { Write-Fail "Internal agent create failed" }
    if ($supplierId) { $script:cleanupUserIds += $supplierId; Write-Pass "Created supplier: $supplierId" } else { Write-Fail "Supplier create failed" }

    Write-Step "0.3" "Create isolated category and product"
    $catBody = New-JsonBody @{ name = "Agent Role Cat $ts"; description = "Agent role payment test"; isActive = $true }
    $cat = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $catBody -Label "CreateCategory"
    $categoryId = Get-Id $cat
    if ($categoryId) { $script:cleanupCategoryId = $categoryId; Write-Pass "Created category: $categoryId" } else { Write-Fail "Category create failed" }

    $productBody = New-JsonBody @{
        name = "Agent Role Product $ts"
        categoryId = $categoryId
        isReturnable = $true
        importPrice = 50000
        shippingCost = 30000
        packagingCost = 25000
    }
    $product = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $productBody -Label "CreateProduct"
    $productId = Get-Id $product
    if ($productId) { $script:cleanupProductId = $productId; Write-Pass "Created product: $productId" } else { Write-Fail "Product create failed" }

    Write-Step "0.4" "Create supplier quote for the product"
    $sqBody = New-JsonBody @{
        supplierId = $supplierId
        productId = $productId
        price = 50000
        shippingFee = 30000
        returnFee = 25000
        effectiveAt = (Get-Date).ToString("yyyy-MM-dd")
        isReturnableOverride = $true
    }
    $sq = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $h -Body $sqBody -Label "CreateSupplierQuote"
    $sqId = Get-Id $sq
    if ($sqId) { $script:cleanupSupplierQuoteIds += $sqId; Write-Pass "Created supplier quote: $sqId" } else { Write-Fail "Supplier quote create failed" }

    if ((-not $extAgentId) -or (-not $intAgentId) -or (-not $supplierId) -or (-not $productId) -or (-not $sqId)) {
        Write-Fail "Setup incomplete - cannot continue"
        throw "setup_incomplete"
    }

    Write-Step "1.1" "Create and complete external delivered order"
    $extDeliveredBody = Build-OrderPayload -CustomerName "AgentRole-Ext-Delivered" -ProductId $productId -SupplierId $supplierId -AgentId $extAgentId -Quantity 2 -CodAmount 200000 -UseExternalSnapshot $true
    $extDelivered = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $extDeliveredBody -Label "CreateExtDelivered"
    $extDeliveredId = Get-Id $extDelivered
    if ($extDeliveredId) { $script:cleanupOrders += $extDeliveredId; Write-Pass "Created ext delivered order: $extDeliveredId" } else { Write-Fail "Create ext delivered order failed" }
    $extDeliveredDone = if ($extDeliveredId) { Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$extDeliveredId" -Headers $h -Body (New-JsonBody @{ orderStatus = $script:deliveredStatusName }) -Label "DeliverExtOrder" } else { $null }
    if ($extDeliveredDone) { Assert-ExternalCase "External delivered" $extDeliveredDone } else { Write-Fail "External delivered update failed" }

    Write-Step "1.2" "Create and complete external returned order"
    $extReturnedBody = Build-OrderPayload -CustomerName "AgentRole-Ext-Returned" -ProductId $productId -SupplierId $supplierId -AgentId $extAgentId -Quantity 1 -CodAmount 150000 -UseExternalSnapshot $true
    $extReturned = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $extReturnedBody -Label "CreateExtReturned"
    $extReturnedId = Get-Id $extReturned
    if ($extReturnedId) { $script:cleanupOrders += $extReturnedId; Write-Pass "Created ext returned order: $extReturnedId" } else { Write-Fail "Create ext returned order failed" }
    $extReturnedDone = if ($extReturnedId) { Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$extReturnedId" -Headers $h -Body (New-JsonBody @{ orderStatus = $script:returnedStatusName }) -Label "ReturnExtOrder" } else { $null }
    if ($extReturnedDone) { Assert-ExternalCase "External returned" $extReturnedDone } else { Write-Fail "External returned update failed" }

    Write-Step "1.3" "Create and complete internal delivered order"
    $intDeliveredBody = Build-OrderPayload -CustomerName "AgentRole-Int-Delivered" -ProductId $productId -SupplierId $supplierId -AgentId $intAgentId -Quantity 2 -CodAmount 200000 -UseExternalSnapshot $false
    $intDelivered = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $intDeliveredBody -Label "CreateIntDelivered"
    $intDeliveredId = Get-Id $intDelivered
    if ($intDeliveredId) { $script:cleanupOrders += $intDeliveredId; Write-Pass "Created int delivered order: $intDeliveredId" } else { Write-Fail "Create int delivered order failed" }
    $intDeliveredDone = if ($intDeliveredId) { Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$intDeliveredId" -Headers $h -Body (New-JsonBody @{ orderStatus = $script:deliveredStatusName }) -Label "DeliverIntOrder" } else { $null }
    if ($intDeliveredDone) { Assert-InternalCase "Internal delivered" $intDeliveredDone } else { Write-Fail "Internal delivered update failed" }

    Write-Step "1.4" "Create and complete internal returned order"
    $intReturnedBody = Build-OrderPayload -CustomerName "AgentRole-Int-Returned" -ProductId $productId -SupplierId $supplierId -AgentId $intAgentId -Quantity 1 -CodAmount 150000 -UseExternalSnapshot $false
    $intReturned = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $intReturnedBody -Label "CreateIntReturned"
    $intReturnedId = Get-Id $intReturned
    if ($intReturnedId) { $script:cleanupOrders += $intReturnedId; Write-Pass "Created int returned order: $intReturnedId" } else { Write-Fail "Create int returned order failed" }
    $intReturnedDone = if ($intReturnedId) { Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$intReturnedId" -Headers $h -Body (New-JsonBody @{ orderStatus = $script:returnedStatusName }) -Label "ReturnIntOrder" } else { $null }
    if ($intReturnedDone) { Assert-InternalCase "Internal returned" $intReturnedDone } else { Write-Fail "Internal returned update failed" }

    Write-Step "2.1" "Verify pending agent payment list only includes external-agent orders"
    $pendingAgent = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent" -Headers $h -Label "PendingAgent"
    if ($pendingAgent) {
        $pendingOrders = if ($pendingAgent.orders) { $pendingAgent.orders } else { @() }
        $pendingIds = @($pendingOrders | ForEach-Object { Get-Id $_ })
        Assert-True "Pending list contains external delivered order" ($pendingIds -contains $extDeliveredId) "Pending list missing external delivered order"
        Assert-True "Pending list contains external returned order" ($pendingIds -contains $extReturnedId) "Pending list missing external returned order"
        Assert-True "Pending list excludes internal delivered order" (-not ($pendingIds -contains $intDeliveredId)) "Pending list should exclude internal delivered order"
        Assert-True "Pending list excludes internal returned order" (-not ($pendingIds -contains $intReturnedId)) "Pending list should exclude internal returned order"
        $expectedPendingCommission = (Number-OrZero $extDeliveredDone.agentPaidAmount) + (Number-OrZero $extReturnedDone.agentPaidAmount)
        Assert-Equal "Pending agent totalCommission" $expectedPendingCommission (Number-OrZero $pendingAgent.totalCommission)
    } else {
        Write-Fail "Pending agent payment query failed"
    }

    Write-Step "2.2" "Verify internal agent has no pending-payment entries"
    $pendingInternal = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$intAgentId" -Headers $h -Label "PendingInternal"
    if ($pendingInternal) {
        Assert-Equal "Internal pending agent count" 0 (Number-OrZero $pendingInternal.count) 0
    } else {
        Write-Fail "Pending internal agent query failed"
    }

    Write-Step "2.3" "Verify internal order cannot be paid via agent batch"
    $internalBatchBody = New-JsonBody @{
        orderIds = @($intDeliveredId)
        batchId = "AGENT-ROLE-INT-$ts"
        paidDate = (Get-Date).ToString("yyyy-MM-dd")
        note = "Internal agent should not be payable"
    }
    $internalBatch = Expect-Failure -Method POST -Uri "$BaseUrl/test-order2/agent-payment-batch" -Headers $h -Body $internalBatchBody
    if (-not $internalBatch.ok -and $internalBatch.status -ge 400) {
        Write-Pass "Internal agent payment batch rejected with HTTP $($internalBatch.status)"
    } else {
        Write-Fail "Internal agent payment batch should be rejected"
    }

    Write-Step "2.4" "Verify external delivered order can be paid via agent batch"
    $externalBatchBody = New-JsonBody @{
        orderIds = @($extDeliveredId)
        batchId = "AGENT-ROLE-EXT-$ts"
        paidDate = (Get-Date).ToString("yyyy-MM-dd")
        note = "External agent payment test"
    }
    $externalBatch = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/agent-payment-batch" -Headers $h -Body $externalBatchBody -Label "ExternalAgentBatch"
    if ($externalBatch) {
        Write-Pass "External agent payment batch created"
        $extDeliveredAfterPay = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$extDeliveredId" -Headers $h -Label "GetExtDeliveredAfterPay"
        if ($extDeliveredAfterPay) {
            Assert-Text "External delivered agentPaymentStatus after batch" "paid" "$($extDeliveredAfterPay.agentPaymentStatus)"
        } else {
            Write-Fail "Fetch external delivered order after batch failed"
        }
    } else {
        Write-Fail "External agent payment batch failed"
    }
} finally {
    Invoke-Cleanup -Headers $h

    Write-Section "SUMMARY"
    Write-Host ""
    Write-Host "Total: $($script:passCount + $script:failCount) | PASS: $($script:passCount) | FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Yellow" })

    if ($script:failDetails.Count -gt 0) {
        Write-Host ""
        Write-Host "Failed tests:" -ForegroundColor Red
        foreach ($item in $script:failDetails) {
            Write-Host "  - $item" -ForegroundColor Red
        }
    }
}

if ($script:failCount -gt 0) {
    exit 1
}
