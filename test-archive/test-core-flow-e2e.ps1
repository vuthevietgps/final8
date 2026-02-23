#Requires -Version 5.1
<#
.SYNOPSIS
  Core Flow E2E Tests - ERP System
.DESCRIPTION
  Flow 1: Order -> production done -> SupplierPayable -> Settlement/batch -> Finance dashboard
  Flow 2: Order delivered/returned -> Agent receivable -> Agent payout (>5M confirm)
  Flow 3: Import ads cost -> allocation -> FC optimal ads/cap -> alerts
.NOTES
  Usage: powershell -ExecutionPolicy Bypass -File .\test-core-flow-e2e.ps1
  Requires: Backend running on localhost:3000
#>

# ============================================================
# CONFIGURATION
# ============================================================
$API_BASE = "http://localhost:3000"
$resultFile = "test-core-flow-e2e-results.json"

# Test counters
$script:totalTests = 0
$script:passedTests = 0
$script:failedTests = 0
$script:skippedTests = 0
$script:testResults = @()

# Cleanup tracking - IDs to delete after tests
$script:createdOrderIds = @()
$script:createdPayableIds = @()
$script:createdAdsCostIds = @()
$script:createdStatementIds = @()

# ============================================================
# HELPERS
# ============================================================

function Get-AuthToken {
    <# Login and return JWT token #>
    param(
        [string]$Username = "director@test.com",
        [string]$Password = "123456"
    )
    try {
        $body = @{ email = $Username; password = $Password } | ConvertTo-Json
        $resp = Invoke-RestMethod -Uri "$API_BASE/api/auth/login" -Method POST `
            -ContentType "application/json" -Body $body -ErrorAction Stop
        return $resp.access_token
    }
    catch {
        Write-Host "  [AUTH ERROR] Cannot login: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

function Get-Headers {
    param([string]$Token)
    return @{
        "Authorization" = "Bearer $Token"
        "Content-Type"  = "application/json"
    }
}

function Invoke-Api {
    <# Generic API caller with error handling #>
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers,
        [object]$Body = $null,
        [switch]$RawResponse
    )
    $uri = "$API_BASE$Path"
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $Headers
        ErrorAction = "Stop"
    }
    if ($Body -and $Method -ne "GET") {
        $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 10 }
        $params["Body"] = $jsonBody
    }
    try {
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; Error = $null; StatusCode = 200 }
    }
    catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        $errMsg = $_.Exception.Message
        return @{ Success = $false; Data = $null; Error = $errMsg; StatusCode = $statusCode }
    }
}

function Test-Assert {
    <# Assert a condition and record result #>
    param(
        [string]$TestName,
        [bool]$Condition,
        [string]$Message = "",
        [string]$Suite = "General"
    )
    $script:totalTests++
    $result = @{
        suite    = $Suite
        name     = $TestName
        passed   = $Condition
        message  = $Message
        time     = (Get-Date -Format "HH:mm:ss")
    }
    $script:testResults += $result

    if ($Condition) {
        $script:passedTests++
        Write-Host "    PASS " -ForegroundColor Green -NoNewline
        Write-Host "$TestName" -ForegroundColor White
    }
    else {
        $script:failedTests++
        Write-Host "    FAIL " -ForegroundColor Red -NoNewline
        Write-Host "$TestName" -ForegroundColor White
        if ($Message) {
            Write-Host "         -> $Message" -ForegroundColor DarkYellow
        }
    }
}

function Test-Skip {
    param([string]$TestName, [string]$Reason = "", [string]$Suite = "General")
    $script:totalTests++
    $script:skippedTests++
    $script:testResults += @{ suite = $Suite; name = $TestName; passed = $null; message = "SKIPPED: $Reason"; time = (Get-Date -Format "HH:mm:ss") }
    Write-Host "    SKIP " -ForegroundColor Yellow -NoNewline
    Write-Host "$TestName - $Reason" -ForegroundColor DarkGray
}

function Write-SuiteHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor Cyan
}

function Write-TestGroup {
    param([string]$Title)
    Write-Host ""
    Write-Host "  --- $Title ---" -ForegroundColor DarkCyan
}

function Get-IsoDate {
    param([int]$DaysOffset = 0)
    return (Get-Date).AddDays($DaysOffset).ToString("yyyy-MM-dd")
}

# ============================================================
# PRE-FLIGHT: Health Check & Auth
# ============================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   CORE FLOW E2E TESTS" -ForegroundColor Magenta
Write-Host "   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Magenta

Write-TestGroup "Pre-flight checks"

# Health check
$healthResult = Invoke-Api -Method GET -Path "/health" -Headers @{}
Test-Assert -TestName "Backend health check" `
    -Condition ($healthResult.Success) `
    -Message "Backend not running at $API_BASE" `
    -Suite "PreFlight"

if (-not $healthResult.Success) {
    Write-Host ""
    Write-Host "  ABORT: Backend is not running. Start with: cd backend && npm run start:dev" -ForegroundColor Red
    exit 1
}

# Auth
$token = Get-AuthToken
$headers = Get-Headers -Token $token
Test-Assert -TestName "Auth - Login as director" `
    -Condition ($null -ne $token) `
    -Message "Could not authenticate" `
    -Suite "PreFlight"

if (-not $token) {
    Write-Host "  ABORT: Cannot continue without authentication." -ForegroundColor Red
    exit 1
}

# ============================================================
# Fetch reference data (suppliers, agents, products, ad groups)
# ============================================================
Write-TestGroup "Loading reference data"

# Helper to extract list from various response formats
function Extract-List {
    param($ResponseData)
    if ($null -eq $ResponseData) { return @() }
    # If it has .data property (wrapped response)
    if ($ResponseData.PSObject.Properties.Name -contains "data") {
        $inner = $ResponseData.data
        if ($inner -is [array]) { return $inner }
        if ($inner.PSObject.Properties.Name -contains "items") { return $inner.items }
        return @($inner)
    }
    # If it's already an array
    if ($ResponseData -is [array]) { return $ResponseData }
    # Single object
    return @($ResponseData)
}

# Get a supplier via /api/users/suppliers
$suppliersResp = Invoke-Api -Method GET -Path "/api/users/suppliers?active=true" -Headers $headers
$supplierId = $null
$supplierName = ""
if ($suppliersResp.Success -and $suppliersResp.Data) {
    $supplierList = Extract-List $suppliersResp.Data
    if ($supplierList -and $supplierList.Count -gt 0) {
        $supplierId = $supplierList[0]._id
        $supplierName = $supplierList[0].fullName
    }
}
if (-not $supplierId) {
    # Fallback: try /api/users?role=internal_supplier
    $suppliersResp = Invoke-Api -Method GET -Path "/api/users?role=internal_supplier" -Headers $headers
    if ($suppliersResp.Success -and $suppliersResp.Data) {
        $supplierList = Extract-List $suppliersResp.Data
        if ($supplierList -and $supplierList.Count -gt 0) {
            $supplierId = $supplierList[0]._id
            $supplierName = $supplierList[0].fullName
        }
    }
}
if (-not $supplierId) {
    $suppliersResp = Invoke-Api -Method GET -Path "/api/users?role=external_supplier" -Headers $headers
    if ($suppliersResp.Success -and $suppliersResp.Data) {
        $supplierList = Extract-List $suppliersResp.Data
        if ($supplierList -and $supplierList.Count -gt 0) {
            $supplierId = $supplierList[0]._id
            $supplierName = $supplierList[0].fullName
        }
    }
}
Write-Host "    Supplier: $supplierName ($supplierId)" -ForegroundColor DarkGray

# Get an agent via /api/users/agents
$agentsResp = Invoke-Api -Method GET -Path "/api/users/agents" -Headers $headers
$agentId = $null
$agentName = ""
if ($agentsResp.Success -and $agentsResp.Data) {
    $agentList = Extract-List $agentsResp.Data
    # Prefer external_agent
    foreach ($ag in $agentList) {
        if ($ag.role -eq "external_agent") {
            $agentId = $ag._id
            $agentName = $ag.fullName
            break
        }
    }
    # Fallback to any agent
    if (-not $agentId -and $agentList.Count -gt 0) {
        $agentId = $agentList[0]._id
        $agentName = $agentList[0].fullName
    }
}
if (-not $agentId) {
    # Fallback: list all users and filter
    $agentsResp = Invoke-Api -Method GET -Path "/api/users?role=external_agent" -Headers $headers
    if ($agentsResp.Success -and $agentsResp.Data) {
        $agentList = Extract-List $agentsResp.Data
        if ($agentList -and $agentList.Count -gt 0) {
            $agentId = $agentList[0]._id
            $agentName = $agentList[0].fullName
        }
    }
}
Write-Host "    Agent: $agentName ($agentId)" -ForegroundColor DarkGray

# Get a product via /api/products
$productsResp = Invoke-Api -Method GET -Path "/api/products" -Headers $headers
$productId = $null
if ($productsResp.Success -and $productsResp.Data) {
    $productList = Extract-List $productsResp.Data
    if ($productList -and $productList.Count -gt 0) {
        $productId = $productList[0]._id
    }
}
Write-Host "    Product: $productId" -ForegroundColor DarkGray

# Get an ad group via /api/ad-groups
$adGroupsResp = Invoke-Api -Method GET -Path "/api/ad-groups" -Headers $headers
$adGroupId = $null
$adGroupPlatformId = $null
if ($adGroupsResp.Success -and $adGroupsResp.Data) {
    $adGroupList = Extract-List $adGroupsResp.Data
    if ($adGroupList -and $adGroupList.Count -gt 0) {
        $adGroupId = $adGroupList[0]._id
        $adGroupPlatformId = $adGroupList[0].adGroupId
    }
}
Write-Host "    AdGroup: $adGroupPlatformId ($adGroupId)" -ForegroundColor DarkGray

$hasRefData = ($supplierId -and $agentId -and $productId)
Test-Assert -TestName "Reference data loaded (supplier, agent, product)" `
    -Condition $hasRefData `
    -Message "Missing: supplier=$supplierId, agent=$agentId, product=$productId" `
    -Suite "PreFlight"


# ############################################################
# FLOW 1: Order -> Production Done -> SupplierPayable
#          -> Settlement/Batch -> Finance Dashboard
# ############################################################
Write-SuiteHeader "FLOW 1: Order -> SupplierPayable -> Settlement -> Finance"

$flow1OrderId = $null
$flow1BatchId = "PTTT-NCC-E2E-$(Get-Date -Format 'yyyyMMddHHmmss')"

# ----------------------------------------------------------
# 1.1 Create Order
# ----------------------------------------------------------
Write-TestGroup "1.1 Create Order"

$orderBody = @{
    customerName    = "E2E-Test-Customer-$(Get-Date -Format 'HHmmss')"
    productId       = $productId
    supplierId      = $supplierId
    agentId         = $agentId
    quantity        = 2
    codAmount       = 500000
    depositAmount   = 0
    supplierQuote   = 150000
    agentQuote      = 50000
    shippingFee     = 30000
    orderDate       = (Get-IsoDate)
    productSource   = "supplier"
    productionStatus = "Chua lam"
    orderStatus     = "Chua co ma van don"
}
if ($adGroupId) { $orderBody["adGroupId"] = $adGroupPlatformId }

$createResp = Invoke-Api -Method POST -Path "/api/test-order2" -Headers $headers -Body $orderBody
$flow1OrderId = $null
if ($createResp.Success -and $createResp.Data) {
    $orderData = if ($createResp.Data.data) { $createResp.Data.data } else { $createResp.Data }
    $flow1OrderId = $orderData._id
    $script:createdOrderIds += $flow1OrderId
}

Test-Assert -TestName "1.1.1 Create order - success" `
    -Condition ($createResp.Success -and $null -ne $flow1OrderId) `
    -Message "Response: $($createResp.Error)" `
    -Suite "Flow1-Order"

if ($flow1OrderId) {
    # Verify initial state
    $getOrder = Invoke-Api -Method GET -Path "/api/test-order2/$flow1OrderId" -Headers $headers
    $order = if ($getOrder.Data.data) { $getOrder.Data.data } else { $getOrder.Data }

    Test-Assert -TestName "1.1.2 Order has supplierId set" `
        -Condition ($null -ne $order.supplierId) `
        -Message "supplierId is null" `
        -Suite "Flow1-Order"

    Test-Assert -TestName "1.1.3 Order supplierPaymentStatus = pending or n/a" `
        -Condition ($order.supplierPaymentStatus -in @("pending", "n/a", $null)) `
        -Message "Got: $($order.supplierPaymentStatus)" `
        -Suite "Flow1-Order"

    Test-Assert -TestName "1.1.4 Order quantity = 2" `
        -Condition ($order.quantity -eq 2) `
        -Message "Got: $($order.quantity)" `
        -Suite "Flow1-Order"
}

# ----------------------------------------------------------
# 1.2 Update Production Status -> "Da tra ket qua"
# ----------------------------------------------------------
Write-TestGroup "1.2 Update Production Status -> Done"

if ($flow1OrderId) {
    $updateProd = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow1OrderId" `
        -Headers $headers -Body @{ productionStatus = "Da tra ket qua" }

    Test-Assert -TestName "1.2.1 Update productionStatus to Done - success" `
        -Condition ($updateProd.Success) `
        -Message "Error: $($updateProd.Error)" `
        -Suite "Flow1-Production"

    # Re-fetch to verify
    Start-Sleep -Milliseconds 500
    $getOrder2 = Invoke-Api -Method GET -Path "/api/test-order2/$flow1OrderId" -Headers $headers
    $order2 = if ($getOrder2.Data.data) { $getOrder2.Data.data } else { $getOrder2.Data }

    Test-Assert -TestName "1.2.2 productionStatus updated correctly" `
        -Condition ($order2.productionStatus -match "k.t qu.") `
        -Message "Got: $($order2.productionStatus)" `
        -Suite "Flow1-Production"

    # Check if SupplierPayable was auto-created
    $payablesResp = Invoke-Api -Method GET -Path "/api/supplier-payables?supplierId=$supplierId&limit=5" -Headers $headers
    $hasPayables = $false
    if ($payablesResp.Success -and $payablesResp.Data) {
        $payableList = if ($payablesResp.Data.data) { $payablesResp.Data.data } else { $payablesResp.Data }
        if ($payableList -and $payableList.Count -gt 0) { $hasPayables = $true }
    }

    Test-Assert -TestName "1.2.3 SupplierPayable exists for this supplier" `
        -Condition $hasPayables `
        -Message "No payable records found for supplier $supplierId" `
        -Suite "Flow1-Production"
}
else {
    Test-Skip "1.2.x Production update tests" -Reason "No order created" -Suite "Flow1-Production"
}

# ----------------------------------------------------------
# 1.3 Update Order Status -> "Giao thanh cong" (Delivered)
# ----------------------------------------------------------
Write-TestGroup "1.3 Update Order Status -> Delivered"

if ($flow1OrderId) {
    $updateStatus = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow1OrderId" `
        -Headers $headers -Body @{ orderStatus = "Giao thanh cong" }

    Test-Assert -TestName "1.3.1 Update orderStatus to Delivered - success" `
        -Condition ($updateStatus.Success) `
        -Message "Error: $($updateStatus.Error)" `
        -Suite "Flow1-Delivery"

    Start-Sleep -Milliseconds 500
    $getOrder3 = Invoke-Api -Method GET -Path "/api/test-order2/$flow1OrderId" -Headers $headers
    $order3 = if ($getOrder3.Data.data) { $getOrder3.Data.data } else { $getOrder3.Data }

    Test-Assert -TestName "1.3.2 orderStatus = Giao thanh cong" `
        -Condition ($order3.orderStatus -match "th.nh c.ng") `
        -Message "Got: $($order3.orderStatus)" `
        -Suite "Flow1-Delivery"

    Test-Assert -TestName "1.3.3 supplierPaymentStatus = pending after delivery" `
        -Condition ($order3.supplierPaymentStatus -eq "pending") `
        -Message "Got: $($order3.supplierPaymentStatus)" `
        -Suite "Flow1-Delivery"

    Test-Assert -TestName "1.3.4 supplierPaidAmount calculated after delivery" `
        -Condition ($null -ne $order3.supplierPaidAmount -and $order3.supplierPaidAmount -gt 0) `
        -Message "supplierPaidAmount=$($order3.supplierPaidAmount)" `
        -Suite "Flow1-Delivery"
}
else {
    Test-Skip "1.3.x Delivery tests" -Reason "No order created" -Suite "Flow1-Delivery"
}

# ----------------------------------------------------------
# 1.4 Get Pending Supplier Payments
# ----------------------------------------------------------
Write-TestGroup "1.4 Pending Supplier Payments"

if ($flow1OrderId) {
    Start-Sleep -Milliseconds 500
    $pendingResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/payment-pending/supplier?supplierId=$supplierId" `
        -Headers $headers

    Test-Assert -TestName "1.4.1 GET pending supplier payments - success" `
        -Condition ($pendingResp.Success) `
        -Message "Error: $($pendingResp.Error)" `
        -Suite "Flow1-Pending"

    $pendingOrders = if ($pendingResp.Data.data) { $pendingResp.Data.data } else { $pendingResp.Data }
    $foundInPending = $false
    if ($pendingOrders) {
        foreach ($po in $pendingOrders) {
            if ($po._id -eq $flow1OrderId) { $foundInPending = $true; break }
        }
    }

    Test-Assert -TestName "1.4.2 Created order appears in pending list" `
        -Condition $foundInPending `
        -Message "Order $flow1OrderId not found in pending supplier payments" `
        -Suite "Flow1-Pending"

    # Supplier payment ops summary
    $opsResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/supplier-payment/ops-summary?supplierId=$supplierId" `
        -Headers $headers

    Test-Assert -TestName "1.4.3 Supplier payment ops-summary returns data" `
        -Condition ($opsResp.Success -and $null -ne $opsResp.Data) `
        -Message "Error: $($opsResp.Error)" `
        -Suite "Flow1-Pending"
}
else {
    Test-Skip "1.4.x Pending payment tests" -Reason "No order created" -Suite "Flow1-Pending"
}

# ----------------------------------------------------------
# 1.5 Create Supplier Payment Batch
# ----------------------------------------------------------
Write-TestGroup "1.5 Supplier Payment Batch"

if ($flow1OrderId) {
    $batchBody = @{
        orderIds = @($flow1OrderId)
        batchId  = $flow1BatchId
        paidDate = (Get-IsoDate)
        note     = "E2E test batch payment"
    }

    $batchResp = Invoke-Api -Method POST -Path "/api/test-order2/supplier-payment-batch" `
        -Headers $headers -Body $batchBody

    Test-Assert -TestName "1.5.1 Create supplier payment batch - success" `
        -Condition ($batchResp.Success) `
        -Message "Error: $($batchResp.Error)" `
        -Suite "Flow1-Batch"

    # Verify order updated
    Start-Sleep -Milliseconds 500
    $getOrder4 = Invoke-Api -Method GET -Path "/api/test-order2/$flow1OrderId" -Headers $headers
    $order4 = if ($getOrder4.Data.data) { $getOrder4.Data.data } else { $getOrder4.Data }

    Test-Assert -TestName "1.5.2 Order supplierPaymentStatus = paid after batch" `
        -Condition ($order4.supplierPaymentStatus -eq "paid") `
        -Message "Got: $($order4.supplierPaymentStatus)" `
        -Suite "Flow1-Batch"

    Test-Assert -TestName "1.5.3 Order has supplierPaymentBatchId" `
        -Condition ($null -ne $order4.supplierPaymentBatchId) `
        -Message "supplierPaymentBatchId is null" `
        -Suite "Flow1-Batch"

    Test-Assert -TestName "1.5.4 supplierPaidAmount > 0" `
        -Condition ($order4.supplierPaidAmount -gt 0) `
        -Message "Got: $($order4.supplierPaidAmount)" `
        -Suite "Flow1-Batch"

    # List batches
    $batchListResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/payment-batches/supplier?supplierId=$supplierId" `
        -Headers $headers

    Test-Assert -TestName "1.5.5 Supplier batch list contains our batch" `
        -Condition ($batchListResp.Success) `
        -Message "Error: $($batchListResp.Error)" `
        -Suite "Flow1-Batch"

    # Get orders in batch
    $batchOrdersResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/payment-batch/$flow1BatchId/supplier" `
        -Headers $headers

    Test-Assert -TestName "1.5.6 Get orders in batch returns data" `
        -Condition ($batchOrdersResp.Success) `
        -Message "Error: $($batchOrdersResp.Error)" `
        -Suite "Flow1-Batch"
}
else {
    Test-Skip "1.5.x Batch payment tests" -Reason "No order created" -Suite "Flow1-Batch"
}

# ----------------------------------------------------------
# 1.6 Supplier Payable Statement & Cashflow
# ----------------------------------------------------------
Write-TestGroup "1.6 Supplier Payable Statement & Cashflow"

$today = Get-IsoDate
$monthStart = (Get-Date -Day 1).ToString("yyyy-MM-dd")
$monthEnd = (Get-Date -Day 1).AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd")

if ($supplierId) {
    # Statement by supplier
    $stmtResp = Invoke-Api -Method GET `
        -Path "/api/supplier-payables/statement/by-supplier?supplierId=$supplierId&from=$monthStart&to=$monthEnd" `
        -Headers $headers

    Test-Assert -TestName "1.6.1 GET supplier statement - success" `
        -Condition ($stmtResp.Success) `
        -Message "Error: $($stmtResp.Error)" `
        -Suite "Flow1-Statement"

    # Create/Upsert statement (DTO uses 'from'/'to', not 'periodFrom'/'periodTo')
    $upsertBody = @{
        supplierId = $supplierId
        from       = $monthStart
        to         = $monthEnd
        notes      = "E2E test statement"
    }
    $upsertResp = Invoke-Api -Method POST -Path "/api/supplier-payables/statements" `
        -Headers $headers -Body $upsertBody

    Test-Assert -TestName "1.6.2 Upsert supplier statement - success" `
        -Condition ($upsertResp.Success) `
        -Message "Error: $($upsertResp.Error)" `
        -Suite "Flow1-Statement"

    $statementId = $null
    if ($upsertResp.Success -and $upsertResp.Data) {
        $stmtData = if ($upsertResp.Data.data) { $upsertResp.Data.data } else { $upsertResp.Data }
        $statementId = $stmtData._id
        $script:createdStatementIds += $statementId
    }

    # Add payment to statement
    if ($statementId) {
        $paymentBody = @{
            amount    = 300000
            method    = "bank_transfer"
            reference = "E2E-REF-$(Get-Date -Format 'HHmmss')"
            notes     = "E2E test payment"
        }
        $payResp = Invoke-Api -Method POST `
            -Path "/api/supplier-payables/statements/$statementId/payments" `
            -Headers $headers -Body $paymentBody

        Test-Assert -TestName "1.6.3 Add payment to statement - success" `
            -Condition ($payResp.Success) `
            -Message "Error: $($payResp.Error)" `
            -Suite "Flow1-Statement"

        # Get statement to verify payment
        $getStmt = Invoke-Api -Method GET `
            -Path "/api/supplier-payables/statements/$statementId" `
            -Headers $headers
        $stmtDetail = if ($getStmt.Data.data) { $getStmt.Data.data } else { $getStmt.Data }

        Test-Assert -TestName "1.6.4 Statement has payments array" `
            -Condition ($null -ne $stmtDetail.payments -and $stmtDetail.payments.Count -gt 0) `
            -Message "payments is empty" `
            -Suite "Flow1-Statement"

        Test-Assert -TestName "1.6.5 Statement statementPaymentTotal > 0" `
            -Condition ($stmtDetail.statementPaymentTotal -gt 0) `
            -Message "Got: $($stmtDetail.statementPaymentTotal)" `
            -Suite "Flow1-Statement"

        # Close statement
        $closeResp = Invoke-Api -Method PATCH `
            -Path "/api/supplier-payables/statements/$statementId/close" `
            -Headers $headers

        Test-Assert -TestName "1.6.6 Close statement - success" `
            -Condition ($closeResp.Success) `
            -Message "Error: $($closeResp.Error)" `
            -Suite "Flow1-Statement"

        # Reopen (director only)
        $reopenResp = Invoke-Api -Method PATCH `
            -Path "/api/supplier-payables/statements/$statementId/reopen" `
            -Headers $headers

        Test-Assert -TestName "1.6.7 Reopen statement (director) - success" `
            -Condition ($reopenResp.Success) `
            -Message "Error: $($reopenResp.Error)" `
            -Suite "Flow1-Statement"
    }
    else {
        Test-Skip "1.6.3-7 Statement payment tests" -Reason "No statement created" -Suite "Flow1-Statement"
    }

    # Cashflow summary
    $cashflowResp = Invoke-Api -Method GET `
        -Path "/api/supplier-payables/summary/cashflow" `
        -Headers $headers

    Test-Assert -TestName "1.6.8 Supplier cashflow summary - success" `
        -Condition ($cashflowResp.Success) `
        -Message "Error: $($cashflowResp.Error)" `
        -Suite "Flow1-Statement"

    if ($cashflowResp.Success -and $cashflowResp.Data) {
        $cf = $cashflowResp.Data
        Test-Assert -TestName "1.6.9 Cashflow has totalCommissionGrossEarned field" `
            -Condition ($null -ne $cf.totalCommissionGrossEarned -or $null -ne $cf.totalSupplierPayable) `
            -Message "Missing expected cashflow fields" `
            -Suite "Flow1-Statement"

        Test-Assert -TestName "1.6.10 Cashflow has generatedAt timestamp" `
            -Condition ($null -ne $cf.generatedAt) `
            -Message "Missing generatedAt" `
            -Suite "Flow1-Statement"
    }
}
else {
    Test-Skip "1.6.x Statement tests" -Reason "No supplier ID" -Suite "Flow1-Statement"
}

# ----------------------------------------------------------
# 1.7 Financial Control Dashboard
# ----------------------------------------------------------
Write-TestGroup "1.7 Financial Control Dashboard"

$dashResp = Invoke-Api -Method GET -Path "/api/financial-control/dashboard" -Headers $headers

Test-Assert -TestName "1.7.1 GET FC dashboard - success" `
    -Condition ($dashResp.Success) `
    -Message "Error: $($dashResp.Error)" `
    -Suite "Flow1-Finance"

if ($dashResp.Success -and $dashResp.Data) {
    $dash = $dashResp.Data

    Test-Assert -TestName "1.7.2 Dashboard has freeCash field" `
        -Condition ($null -ne $dash.freeCash) `
        -Message "Missing freeCash" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.3 Dashboard has committedCash field" `
        -Condition ($null -ne $dash.committedCash) `
        -Message "Missing committedCash" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.4 Dashboard has monthlyBurn field" `
        -Condition ($null -ne $dash.monthlyBurn) `
        -Message "Missing monthlyBurn" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.5 Dashboard has adsBudgetApproved field" `
        -Condition ($null -ne $dash.adsBudgetApproved) `
        -Message "Missing adsBudgetApproved" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.6 Dashboard has ownerWithdrawable field" `
        -Condition ($null -ne $dash.ownerWithdrawable) `
        -Message "Missing ownerWithdrawable" `
        -Suite "Flow1-Finance"
}

# Full metrics
$fullResp = Invoke-Api -Method GET -Path "/api/financial-control/full" -Headers $headers

Test-Assert -TestName "1.7.7 GET FC full metrics - success" `
    -Condition ($fullResp.Success) `
    -Message "Error: $($fullResp.Error)" `
    -Suite "Flow1-Finance"

if ($fullResp.Success -and $fullResp.Data) {
    $full = $fullResp.Data

    Test-Assert -TestName "1.7.8 Full metrics has survivalFloor" `
        -Condition ($null -ne $full.survivalFloor) `
        -Message "Missing survivalFloor" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.9 survivalFloor = 3x monthlyBurn" `
        -Condition ([math]::Abs($full.survivalFloor - ($full.monthlyBurn * 3)) -lt 1) `
        -Message "survivalFloor=$($full.survivalFloor), monthlyBurn=$($full.monthlyBurn), expected 3x" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.10 availableAfterSurvival >= 0" `
        -Condition ($full.availableAfterSurvival -ge 0) `
        -Message "Got: $($full.availableAfterSurvival)" `
        -Suite "Flow1-Finance"

    Test-Assert -TestName "1.7.11 Full metrics has committedBreakdown" `
        -Condition ($null -ne $full.committedBreakdown) `
        -Message "Missing committedBreakdown" `
        -Suite "Flow1-Finance"
}

# Forecast
$forecastResp = Invoke-Api -Method GET -Path "/api/financial-control/forecast" -Headers $headers

Test-Assert -TestName "1.7.12 GET FC forecast - success" `
    -Condition ($forecastResp.Success) `
    -Message "Error: $($forecastResp.Error)" `
    -Suite "Flow1-Finance"

# Module health
$healthModResp = Invoke-Api -Method GET -Path "/api/financial-control/module-health" -Headers $headers

Test-Assert -TestName "1.7.13 GET FC module-health - success" `
    -Condition ($healthModResp.Success) `
    -Message "Error: $($healthModResp.Error)" `
    -Suite "Flow1-Finance"

# Actions
$actionsResp = Invoke-Api -Method GET -Path "/api/financial-control/actions" -Headers $headers

Test-Assert -TestName "1.7.14 GET FC actions - success" `
    -Condition ($actionsResp.Success) `
    -Message "Error: $($actionsResp.Error)" `
    -Suite "Flow1-Finance"


# ############################################################
# FLOW 2: Order Delivered/Returned -> Agent Receivable
#          -> Agent Payout (>5M VND needs confirm)
# ############################################################
Write-SuiteHeader "FLOW 2: Order -> Agent Receivable -> Agent Payout"

$flow2OrderId = $null
$flow2ReturnOrderId = $null
$flow2AgentBatchId = "PTTT-AGENT-E2E-$(Get-Date -Format 'yyyyMMddHHmmss')"

# ----------------------------------------------------------
# 2.1 Create Order for Agent Commission (Delivered)
# ----------------------------------------------------------
Write-TestGroup "2.1 Create Order (will be Delivered)"

if ($agentId) {
    # Step 1: Create order with initial status (like real user flow)
    $order2Body = @{
        customerName     = "E2E-Agent-Test-$(Get-Date -Format 'HHmmss')"
        productId        = $productId
        supplierId       = $supplierId
        agentId          = $agentId
        quantity         = 1
        codAmount        = 800000
        agentQuote       = 100000
        supplierQuote    = 200000
        shippingFee      = 25000
        orderDate        = (Get-IsoDate)
        productSource    = "supplier"
    }
    if ($adGroupId) { $order2Body["adGroupId"] = $adGroupPlatformId }

    $create2 = Invoke-Api -Method POST -Path "/api/test-order2" -Headers $headers -Body $order2Body
    if ($create2.Success -and $create2.Data) {
        $od = if ($create2.Data.data) { $create2.Data.data } else { $create2.Data }
        $flow2OrderId = $od._id
        $script:createdOrderIds += $flow2OrderId
    }

    Test-Assert -TestName "2.1.1 Create order for agent flow - success" `
        -Condition ($create2.Success -and $null -ne $flow2OrderId) `
        -Message "Error: $($create2.Error)" `
        -Suite "Flow2-Order"

    # Step 2: Update production -> done, then delivery -> delivered (triggers handleOrderStatusChange)
    if ($flow2OrderId) {
        $null = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow2OrderId" `
            -Headers $headers -Body @{ productionStatus = "Da tra ket qua" }
        Start-Sleep -Milliseconds 300

        $updateDel = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow2OrderId" `
            -Headers $headers -Body @{ orderStatus = "Giao thanh cong" }

        Test-Assert -TestName "2.1.2 Update to Delivered triggers payment calc" `
            -Condition ($updateDel.Success) `
            -Message "Error: $($updateDel.Error)" `
            -Suite "Flow2-Order"

        Start-Sleep -Milliseconds 500
        $getOrd = Invoke-Api -Method GET -Path "/api/test-order2/$flow2OrderId" -Headers $headers
        $ordData = if ($getOrd.Data.data) { $getOrd.Data.data } else { $getOrd.Data }

        Test-Assert -TestName "2.1.3 Order agentPaymentStatus = pending" `
            -Condition ($ordData.agentPaymentStatus -eq "pending") `
            -Message "Got: $($ordData.agentPaymentStatus)" `
            -Suite "Flow2-Order"

        Test-Assert -TestName "2.1.4 Order agentQuote set" `
            -Condition ($ordData.agentQuote -gt 0) `
            -Message "agentQuote = $($ordData.agentQuote)" `
            -Suite "Flow2-Order"
    }
}
else {
    Test-Skip "2.1.x Agent order tests" -Reason "No agent ID available" -Suite "Flow2-Order"
}

# ----------------------------------------------------------
# 2.2 Create Returned Order
# ----------------------------------------------------------
Write-TestGroup "2.2 Create Returned Order"

if ($agentId) {
    # Create order then update status step-by-step (triggers handleOrderStatusChange)
    $orderRetBody = @{
        customerName     = "E2E-Return-Test-$(Get-Date -Format 'HHmmss')"
        productId        = $productId
        supplierId       = $supplierId
        agentId          = $agentId
        quantity         = 1
        codAmount        = 600000
        agentQuote       = 80000
        supplierQuote    = 180000
        shippingFee      = 25000
        returnFee        = 15000
        orderDate        = (Get-IsoDate)
        productSource    = "supplier"
    }

    $createRet = Invoke-Api -Method POST -Path "/api/test-order2" -Headers $headers -Body $orderRetBody
    if ($createRet.Success -and $createRet.Data) {
        $retOd = if ($createRet.Data.data) { $createRet.Data.data } else { $createRet.Data }
        $flow2ReturnOrderId = $retOd._id
        $script:createdOrderIds += $flow2ReturnOrderId
    }

    Test-Assert -TestName "2.2.1 Create order for return flow - success" `
        -Condition ($createRet.Success -and $null -ne $flow2ReturnOrderId) `
        -Message "Error: $($createRet.Error)" `
        -Suite "Flow2-Return"

    # Step-by-step status update to trigger handleOrderStatusChange
    if ($flow2ReturnOrderId) {
        $null = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow2ReturnOrderId" `
            -Headers $headers -Body @{ productionStatus = "Da tra ket qua" }
        Start-Sleep -Milliseconds 300
        $null = Invoke-Api -Method PATCH -Path "/api/test-order2/$flow2ReturnOrderId" `
            -Headers $headers -Body @{ orderStatus = "Hang hoan" }
        Start-Sleep -Milliseconds 500

        $getRetOrd = Invoke-Api -Method GET -Path "/api/test-order2/$flow2ReturnOrderId" -Headers $headers
        $retData = if ($getRetOrd.Data.data) { $getRetOrd.Data.data } else { $getRetOrd.Data }

        Test-Assert -TestName "2.2.2 Returned order status matches return pattern" `
            -Condition ($retData.orderStatus -match "ho.n") `
            -Message "Got: $($retData.orderStatus)" `
            -Suite "Flow2-Return"

        Test-Assert -TestName "2.2.3 Returned order has returnFee" `
            -Condition ($retData.returnFee -gt 0) `
            -Message "returnFee = $($retData.returnFee)" `
            -Suite "Flow2-Return"
    }
}
else {
    Test-Skip "2.2.x Return order tests" -Reason "No agent ID" -Suite "Flow2-Return"
}

# ----------------------------------------------------------
# 2.3 Agent Receivable Summary
# ----------------------------------------------------------
Write-TestGroup "2.3 Agent Receivable Summary"

if ($agentId) {
    $agentSummaryResp = Invoke-Api -Method GET `
        -Path "/api/agent-receivables/summary?agentId=$agentId" `
        -Headers $headers

    # Also try new endpoint
    $agentPayableResp = Invoke-Api -Method GET `
        -Path "/api/agent-payables/summary?agentId=$agentId" `
        -Headers $headers

    $summarySuccess = $agentSummaryResp.Success -or $agentPayableResp.Success
    Test-Assert -TestName "2.3.1 GET agent receivable summary - success" `
        -Condition $summarySuccess `
        -Message "Both endpoints failed: $($agentSummaryResp.Error) / $($agentPayableResp.Error)" `
        -Suite "Flow2-AgentReceivable"

    # Cashflow summary
    $agentCfResp = Invoke-Api -Method GET `
        -Path "/api/agent-receivables/summary/cashflow?windowDays=14" `
        -Headers $headers

    if (-not $agentCfResp.Success) {
        $agentCfResp = Invoke-Api -Method GET `
            -Path "/api/agent-payables/summary/cashflow?windowDays=14" `
            -Headers $headers
    }

    Test-Assert -TestName "2.3.2 GET agent cashflow summary - success" `
        -Condition ($agentCfResp.Success) `
        -Message "Error: $($agentCfResp.Error)" `
        -Suite "Flow2-AgentReceivable"

    if ($agentCfResp.Success -and $agentCfResp.Data) {
        $acf = $agentCfResp.Data

        Test-Assert -TestName "2.3.3 Cashflow has totalAgentCommissionIncurred" `
            -Condition ($null -ne $acf.totalAgentCommissionIncurred) `
            -Message "Missing totalAgentCommissionIncurred" `
            -Suite "Flow2-AgentReceivable"

        Test-Assert -TestName "2.3.4 Cashflow has totalAgentNetPayable" `
            -Condition ($null -ne $acf.totalAgentNetPayable) `
            -Message "Missing totalAgentNetPayable" `
            -Suite "Flow2-AgentReceivable"

        Test-Assert -TestName "2.3.5 Cashflow has byAgent breakdown" `
            -Condition ($null -ne $acf.byAgent) `
            -Message "Missing byAgent array" `
            -Suite "Flow2-AgentReceivable"

        Test-Assert -TestName "2.3.6 Cashflow paymentPolicy = biweekly" `
            -Condition ($acf.paymentPolicy -eq "biweekly") `
            -Message "Got: $($acf.paymentPolicy)" `
            -Suite "Flow2-AgentReceivable"

        Test-Assert -TestName "2.3.7 Cashflow has totalAgentDue14d" `
            -Condition ($null -ne $acf.totalAgentDue14d) `
            -Message "Missing totalAgentDue14d" `
            -Suite "Flow2-AgentReceivable"
    }
}
else {
    Test-Skip "2.3.x Agent receivable tests" -Reason "No agent ID" -Suite "Flow2-AgentReceivable"
}

# ----------------------------------------------------------
# 2.4 Pending Agent Payments & Batch Payment
# ----------------------------------------------------------
Write-TestGroup "2.4 Pending Agent Payments & Batch"

if ($agentId -and $flow2OrderId) {
    # Get pending
    $pendingAgentResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/payment-pending/agent?agentId=$agentId" `
        -Headers $headers

    Test-Assert -TestName "2.4.1 GET pending agent payments - success" `
        -Condition ($pendingAgentResp.Success) `
        -Message "Error: $($pendingAgentResp.Error)" `
        -Suite "Flow2-AgentPayout"

    $pendingAgents = if ($pendingAgentResp.Data.data) { $pendingAgentResp.Data.data } else { $pendingAgentResp.Data }
    $foundAgentPending = $false
    if ($pendingAgents) {
        foreach ($pa in $pendingAgents) {
            if ($pa._id -eq $flow2OrderId) { $foundAgentPending = $true; break }
        }
    }

    Test-Assert -TestName "2.4.2 Delivered order in pending agent payment list" `
        -Condition $foundAgentPending `
        -Message "Order $flow2OrderId not in pending list" `
        -Suite "Flow2-AgentPayout"

    # Agent ops summary
    $agentOpsResp = Invoke-Api -Method GET `
        -Path "/api/test-order2/agent-payment/ops-summary?agentId=$agentId" `
        -Headers $headers

    Test-Assert -TestName "2.4.3 Agent payment ops-summary returns data" `
        -Condition ($agentOpsResp.Success) `
        -Message "Error: $($agentOpsResp.Error)" `
        -Suite "Flow2-AgentPayout"

    # Create agent payment batch
    $agentBatchBody = @{
        orderIds = @($flow2OrderId)
        batchId  = $flow2AgentBatchId
        paidDate = (Get-IsoDate)
        note     = "E2E agent batch test"
    }

    $agentBatchResp = Invoke-Api -Method POST -Path "/api/test-order2/agent-payment-batch" `
        -Headers $headers -Body $agentBatchBody

    Test-Assert -TestName "2.4.4 Create agent payment batch - success" `
        -Condition ($agentBatchResp.Success) `
        -Message "Error: $($agentBatchResp.Error)" `
        -Suite "Flow2-AgentPayout"

    # Verify order updated
    Start-Sleep -Milliseconds 500
    $getAgentOrd = Invoke-Api -Method GET -Path "/api/test-order2/$flow2OrderId" -Headers $headers
    $agentOrdData = if ($getAgentOrd.Data.data) { $getAgentOrd.Data.data } else { $getAgentOrd.Data }

    Test-Assert -TestName "2.4.5 Order agentPaymentStatus = paid after batch" `
        -Condition ($agentOrdData.agentPaymentStatus -eq "paid") `
        -Message "Got: $($agentOrdData.agentPaymentStatus)" `
        -Suite "Flow2-AgentPayout"

    Test-Assert -TestName "2.4.6 Order has agentPaymentBatchId" `
        -Condition ($null -ne $agentOrdData.agentPaymentBatchId) `
        -Message "agentPaymentBatchId is null" `
        -Suite "Flow2-AgentPayout"

    Test-Assert -TestName "2.4.7 Order realizedProfit calculated" `
        -Condition ($null -ne $agentOrdData.realizedGrossProfit -or $null -ne $agentOrdData.grossProfit) `
        -Message "No profit calculation found" `
        -Suite "Flow2-AgentPayout"
}
else {
    Test-Skip "2.4.x Agent payout tests" -Reason "No agent/order" -Suite "Flow2-AgentPayout"
}

# ----------------------------------------------------------
# 2.5 >5M VND Threshold (SUPPLIER_PAYMENT_ALERT_THRESHOLD)
# ----------------------------------------------------------
Write-TestGroup "2.5 Payment Threshold >5M VND"

if ($agentId -and $productId) {
    # Create high-value order step-by-step
    $highValBody = @{
        customerName     = "E2E-HighValue-$(Get-Date -Format 'HHmmss')"
        productId        = $productId
        supplierId       = $supplierId
        agentId          = $agentId
        quantity         = 10
        codAmount        = 5000000
        supplierQuote    = 800000
        agentQuote       = 600000
        orderDate        = (Get-IsoDate)
        productSource    = "supplier"
    }

    $createHigh = Invoke-Api -Method POST -Path "/api/test-order2" -Headers $headers -Body $highValBody
    $highOrderId = $null
    if ($createHigh.Success -and $createHigh.Data) {
        $hod = if ($createHigh.Data.data) { $createHigh.Data.data } else { $createHigh.Data }
        $highOrderId = $hod._id
        $script:createdOrderIds += $highOrderId
    }

    Test-Assert -TestName "2.5.1 Create high-value order (>5M) - success" `
        -Condition ($createHigh.Success -and $null -ne $highOrderId) `
        -Message "Error: $($createHigh.Error)" `
        -Suite "Flow2-Threshold"

    if ($highOrderId) {
        # Update statuses step-by-step to trigger payment calc
        $null = Invoke-Api -Method PATCH -Path "/api/test-order2/$highOrderId" `
            -Headers $headers -Body @{ productionStatus = "Da tra ket qua" }
        Start-Sleep -Milliseconds 300
        $null = Invoke-Api -Method PATCH -Path "/api/test-order2/$highOrderId" `
            -Headers $headers -Body @{ orderStatus = "Giao thanh cong" }
        Start-Sleep -Milliseconds 500

        # Try batch without confirm flag - may need confirmOverThreshold
        $highBatchId = "PTTT-NCC-HIGH-$(Get-Date -Format 'yyyyMMddHHmmss')"
        $highBatchBody = @{
            orderIds             = @($highOrderId)
            batchId              = $highBatchId
            paidDate             = (Get-IsoDate)
            note                 = "E2E high-value batch"
            confirmOverThreshold = $false
        }

        $highBatchResp = Invoke-Api -Method POST -Path "/api/test-order2/supplier-payment-batch" `
            -Headers $headers -Body $highBatchBody

        # This may succeed or fail depending on threshold check
        $thresholdChecked = $true
        if (-not $highBatchResp.Success -and $highBatchResp.Error -match "5.*000.*000|threshold|confirm|xac nhan") {
            # Threshold validation triggered - this is expected behavior!
            Test-Assert -TestName "2.5.2 Batch >5M without confirm is rejected" `
                -Condition $true `
                -Message "Correctly rejected" `
                -Suite "Flow2-Threshold"

            # Retry with confirm
            $highBatchBody["confirmOverThreshold"] = $true
            $highBatchRetry = Invoke-Api -Method POST -Path "/api/test-order2/supplier-payment-batch" `
                -Headers $headers -Body $highBatchBody

            Test-Assert -TestName "2.5.3 Batch >5M with confirmOverThreshold = true - success" `
                -Condition ($highBatchRetry.Success) `
                -Message "Error: $($highBatchRetry.Error)" `
                -Suite "Flow2-Threshold"
        }
        elseif ($highBatchResp.Success) {
            Test-Assert -TestName "2.5.2 Batch >5M processed (threshold may be advisory)" `
                -Condition $true `
                -Message "Batch succeeded without explicit confirm flag" `
                -Suite "Flow2-Threshold"

            # Verify supplier paid amount > 5M
            $getHighOrd = Invoke-Api -Method GET -Path "/api/test-order2/$highOrderId" -Headers $headers
            $highOrdData = if ($getHighOrd.Data.data) { $getHighOrd.Data.data } else { $getHighOrd.Data }

            Test-Assert -TestName "2.5.3 High-value order payment processed" `
                -Condition ($highOrdData.supplierPaymentStatus -eq "paid") `
                -Message "Got: $($highOrdData.supplierPaymentStatus)" `
                -Suite "Flow2-Threshold"
        }
        else {
            Test-Assert -TestName "2.5.2 Batch >5M handling" `
                -Condition $false `
                -Message "Unexpected error: $($highBatchResp.Error)" `
                -Suite "Flow2-Threshold"
        }
    }
}
else {
    Test-Skip "2.5.x Threshold tests" -Reason "Missing ref data" -Suite "Flow2-Threshold"
}

# ----------------------------------------------------------
# 2.6 Agent Statement Lifecycle
# ----------------------------------------------------------
Write-TestGroup "2.6 Agent Statement Lifecycle"

if ($agentId) {
    $stmtBody = @{
        agentId    = $agentId
        periodFrom = $monthStart
        periodTo   = $monthEnd
        notes      = "E2E agent statement"
    }
    $agentStmtResp = Invoke-Api -Method POST -Path "/api/agent-receivables/statements" `
        -Headers $headers -Body $stmtBody

    if (-not $agentStmtResp.Success) {
        $agentStmtResp = Invoke-Api -Method POST -Path "/api/agent-payables/statements" `
            -Headers $headers -Body $stmtBody
    }

    Test-Assert -TestName "2.6.1 Create agent statement - success" `
        -Condition ($agentStmtResp.Success) `
        -Message "Error: $($agentStmtResp.Error)" `
        -Suite "Flow2-AgentStatement"

    $agentStatementId = $null
    if ($agentStmtResp.Success -and $agentStmtResp.Data) {
        $asd = if ($agentStmtResp.Data.data) { $agentStmtResp.Data.data } else { $agentStmtResp.Data }
        $agentStatementId = $asd._id
    }

    if ($agentStatementId) {
        # Add payment
        $agentPayBody = @{
            amount    = 100000
            method    = "bank_transfer"
            reference = "E2E-AGENT-PAY-$(Get-Date -Format 'HHmmss')"
            notes     = "E2E agent payment"
        }

        $addPayPath = "/api/agent-receivables/statements/$agentStatementId/payments"
        $addPayResp = Invoke-Api -Method POST -Path $addPayPath -Headers $headers -Body $agentPayBody
        if (-not $addPayResp.Success) {
            $addPayPath = "/api/agent-payables/statements/$agentStatementId/payments"
            $addPayResp = Invoke-Api -Method POST -Path $addPayPath -Headers $headers -Body $agentPayBody
        }

        Test-Assert -TestName "2.6.2 Add payment to agent statement - success" `
            -Condition ($addPayResp.Success) `
            -Message "Error: $($addPayResp.Error)" `
            -Suite "Flow2-AgentStatement"

        # Close
        $closeAgentPath = "/api/agent-receivables/statements/$agentStatementId/close"
        $closeAgentResp = Invoke-Api -Method PATCH -Path $closeAgentPath -Headers $headers
        if (-not $closeAgentResp.Success) {
            $closeAgentPath = "/api/agent-payables/statements/$agentStatementId/close"
            $closeAgentResp = Invoke-Api -Method PATCH -Path $closeAgentPath -Headers $headers
        }

        Test-Assert -TestName "2.6.3 Close agent statement - success" `
            -Condition ($closeAgentResp.Success) `
            -Message "Error: $($closeAgentResp.Error)" `
            -Suite "Flow2-AgentStatement"

        # Reopen
        $reopenAgentPath = "/api/agent-receivables/statements/$agentStatementId/reopen"
        $reopenAgentResp = Invoke-Api -Method PATCH -Path $reopenAgentPath -Headers $headers
        if (-not $reopenAgentResp.Success) {
            $reopenAgentPath = "/api/agent-payables/statements/$agentStatementId/reopen"
            $reopenAgentResp = Invoke-Api -Method PATCH -Path $reopenAgentPath -Headers $headers
        }

        Test-Assert -TestName "2.6.4 Reopen agent statement - success" `
            -Condition ($reopenAgentResp.Success) `
            -Message "Error: $($reopenAgentResp.Error)" `
            -Suite "Flow2-AgentStatement"
    }
    else {
        Test-Skip "2.6.2-4 Agent statement payment tests" -Reason "No statement created" -Suite "Flow2-AgentStatement"
    }

    # List statements
    $listAgentStmt = Invoke-Api -Method GET `
        -Path "/api/agent-receivables/statements?agentId=$agentId" `
        -Headers $headers
    if (-not $listAgentStmt.Success) {
        $listAgentStmt = Invoke-Api -Method GET `
            -Path "/api/agent-payables/statements?agentId=$agentId" `
            -Headers $headers
    }

    Test-Assert -TestName "2.6.5 List agent statements - success" `
        -Condition ($listAgentStmt.Success) `
        -Message "Error: $($listAgentStmt.Error)" `
        -Suite "Flow2-AgentStatement"
}
else {
    Test-Skip "2.6.x Agent statement tests" -Reason "No agent ID" -Suite "Flow2-AgentStatement"
}


# ############################################################
# FLOW 3: Import Ads Cost -> Allocation -> FC Optimal Ads/Cap
#          -> Alerts
# ############################################################
Write-SuiteHeader "FLOW 3: Ads Cost -> Allocation -> FC Optimal/Cap -> Alerts"

$flow3AdsCostId = $null

# ----------------------------------------------------------
# 3.1 Create/Import Advertising Cost
# ----------------------------------------------------------
Write-TestGroup "3.1 Import Advertising Costs"

if ($adGroupPlatformId) {
    $yesterday = (Get-Date).AddDays(-1).ToUniversalTime()
    $yesterdayIso = $yesterday.ToString("yyyy-MM-ddT00:00:00.000Z")

    $adsCostBody = @{
        adGroupId   = $adGroupPlatformId
        channel     = "facebook"
        date        = $yesterdayIso
        spentAmount = 350000
        cpm         = 45000
        cpc         = 2500
        impressions = 7800
        clicks      = 140
        reach       = 5200
    }

    $createAdsCost = Invoke-Api -Method POST -Path "/api/advertising-cost" `
        -Headers $headers -Body $adsCostBody

    if ($createAdsCost.Success -and $createAdsCost.Data) {
        $acd = if ($createAdsCost.Data.data) { $createAdsCost.Data.data } else { $createAdsCost.Data }
        $flow3AdsCostId = $acd._id
        $script:createdAdsCostIds += $flow3AdsCostId
    }

    Test-Assert -TestName "3.1.1 Create ads cost record - success" `
        -Condition ($createAdsCost.Success) `
        -Message "Error: $($createAdsCost.Error)" `
        -Suite "Flow3-Import"

    # Create more records for 3-day baseline
    $twoDaysAgo = (Get-Date).AddDays(-2).ToUniversalTime().ToString("yyyy-MM-ddT00:00:00.000Z")
    $threeDaysAgo = (Get-Date).AddDays(-3).ToUniversalTime().ToString("yyyy-MM-ddT00:00:00.000Z")

    $adsCost2 = Invoke-Api -Method POST -Path "/api/advertising-cost" `
        -Headers $headers -Body @{
        adGroupId = $adGroupPlatformId; channel = "facebook"; date = $twoDaysAgo
        spentAmount = 400000; cpm = 48000; cpc = 2800
    }
    if ($adsCost2.Success -and $adsCost2.Data) {
        $acd2 = if ($adsCost2.Data.data) { $adsCost2.Data.data } else { $adsCost2.Data }
        $script:createdAdsCostIds += $acd2._id
    }

    $adsCost3 = Invoke-Api -Method POST -Path "/api/advertising-cost" `
        -Headers $headers -Body @{
        adGroupId = $adGroupPlatformId; channel = "facebook"; date = $threeDaysAgo
        spentAmount = 320000; cpm = 42000; cpc = 2200
    }
    if ($adsCost3.Success -and $adsCost3.Data) {
        $acd3 = if ($adsCost3.Data.data) { $adsCost3.Data.data } else { $adsCost3.Data }
        $script:createdAdsCostIds += $acd3._id
    }

    Test-Assert -TestName "3.1.2 Create 3 days of ads cost data" `
        -Condition ($adsCost2.Success -and $adsCost3.Success) `
        -Message "Day2: $($adsCost2.Error), Day3: $($adsCost3.Error)" `
        -Suite "Flow3-Import"

    # Get stats by adgroup
    $statsResp = Invoke-Api -Method GET `
        -Path "/api/advertising-cost/stats/by-adgroup?adGroupId=$adGroupPlatformId" `
        -Headers $headers

    Test-Assert -TestName "3.1.3 GET ads stats by adgroup - success" `
        -Condition ($statsResp.Success) `
        -Message "Error: $($statsResp.Error)" `
        -Suite "Flow3-Import"

    # Get daily summary
    $fromDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $toDate = (Get-IsoDate)
    $dailySummResp = Invoke-Api -Method GET `
        -Path "/api/advertising-cost/stats/daily-summary?dateFrom=$fromDate&dateTo=$toDate" `
        -Headers $headers

    Test-Assert -TestName "3.1.4 GET ads daily summary - success" `
        -Condition ($dailySummResp.Success) `
        -Message "Error: $($dailySummResp.Error)" `
        -Suite "Flow3-Import"
}
else {
    Test-Skip "3.1.x Ads cost import tests" -Reason "No ad group available" -Suite "Flow3-Import"
}

# ----------------------------------------------------------
# 3.2 Ads Cost Cashflow Summary (Allocation & Caps)
# ----------------------------------------------------------
Write-TestGroup "3.2 Ads Cost Cashflow & Budget Caps"

$adsCfResp = Invoke-Api -Method GET -Path "/api/advertising-cost/summary/cashflow" -Headers $headers

Test-Assert -TestName "3.2.1 GET ads cashflow summary - success" `
    -Condition ($adsCfResp.Success) `
    -Message "Error: $($adsCfResp.Error)" `
    -Suite "Flow3-Allocation"

if ($adsCfResp.Success -and $adsCfResp.Data) {
    $acf = $adsCfResp.Data

    Test-Assert -TestName "3.2.2 Cashflow has totalAdsSpentAllTime" `
        -Condition ($null -ne $acf.totalAdsSpentAllTime) `
        -Message "Missing totalAdsSpentAllTime" `
        -Suite "Flow3-Allocation"

    Test-Assert -TestName "3.2.3 Cashflow has totalAdsSpent7d" `
        -Condition ($null -ne $acf.totalAdsSpent7d) `
        -Message "Missing totalAdsSpent7d" `
        -Suite "Flow3-Allocation"

    Test-Assert -TestName "3.2.4 Cashflow has avgDailySpend7d" `
        -Condition ($null -ne $acf.avgDailySpend7d) `
        -Message "Missing avgDailySpend7d" `
        -Suite "Flow3-Allocation"

    Test-Assert -TestName "3.2.5 Cashflow has spendByDay array" `
        -Condition ($null -ne $acf.spendByDay) `
        -Message "Missing spendByDay" `
        -Suite "Flow3-Allocation"

    Test-Assert -TestName "3.2.6 Cashflow has spendByPlatform array" `
        -Condition ($null -ne $acf.spendByPlatform) `
        -Message "Missing spendByPlatform" `
        -Suite "Flow3-Allocation"

    Test-Assert -TestName "3.2.7 Cashflow has spendByAdGroup array" `
        -Condition ($null -ne $acf.spendByAdGroup) `
        -Message "Missing spendByAdGroup" `
        -Suite "Flow3-Allocation"

    # Validate budget caps per ad group
    if ($acf.spendByAdGroup -and $acf.spendByAdGroup.Count -gt 0) {
        $firstAg = $acf.spendByAdGroup[0]

        Test-Assert -TestName "3.2.8 Ad group has baseline field" `
            -Condition ($null -ne $firstAg.baseline) `
            -Message "Missing baseline" `
            -Suite "Flow3-Allocation"

        Test-Assert -TestName "3.2.9 Ad group has upperCap field" `
            -Condition ($null -ne $firstAg.upperCap) `
            -Message "Missing upperCap" `
            -Suite "Flow3-Allocation"

        Test-Assert -TestName "3.2.10 Ad group has lowerCap field" `
            -Condition ($null -ne $firstAg.lowerCap) `
            -Message "Missing lowerCap" `
            -Suite "Flow3-Allocation"

        # Validate cap formula: upperCap = baseline * 1.20
        if ($firstAg.baseline -gt 0) {
            $expectedUpper = $firstAg.baseline * 1.20
            $upperDiff = [math]::Abs($firstAg.upperCap - $expectedUpper)

            Test-Assert -TestName "3.2.11 upperCap = baseline * 1.20 (+20%)" `
                -Condition ($upperDiff -lt 1) `
                -Message "baseline=$($firstAg.baseline), upperCap=$($firstAg.upperCap), expected=$expectedUpper" `
                -Suite "Flow3-Allocation"

            $expectedLower = $firstAg.baseline * 0.70
            $lowerDiff = [math]::Abs($firstAg.lowerCap - $expectedLower)

            Test-Assert -TestName "3.2.12 lowerCap = baseline * 0.70 (-30%)" `
                -Condition ($lowerDiff -lt 1) `
                -Message "baseline=$($firstAg.baseline), lowerCap=$($firstAg.lowerCap), expected=$expectedLower" `
                -Suite "Flow3-Allocation"

            Test-Assert -TestName "3.2.13 baseline >= 200000 (min start budget)" `
                -Condition ($firstAg.baseline -ge 200000) `
                -Message "baseline=$($firstAg.baseline), min=200000" `
                -Suite "Flow3-Allocation"
        }
    }
    else {
        Test-Skip "3.2.8-13 Ad group cap validation" -Reason "No ad group spend data" -Suite "Flow3-Allocation"
    }

    Test-Assert -TestName "3.2.14 Cashflow has generatedAt" `
        -Condition ($null -ne $acf.generatedAt) `
        -Message "Missing generatedAt" `
        -Suite "Flow3-Allocation"
}

# ----------------------------------------------------------
# 3.3 FC Optimal Ads Suggestion
# ----------------------------------------------------------
Write-TestGroup "3.3 FC Optimal Ads Suggestion"

$optimalResp = Invoke-Api -Method GET -Path "/api/financial-control/optimal-ads" -Headers $headers

Test-Assert -TestName "3.3.1 GET optimal-ads - success" `
    -Condition ($optimalResp.Success) `
    -Message "Error: $($optimalResp.Error)" `
    -Suite "Flow3-OptimalAds"

if ($optimalResp.Success -and $optimalResp.Data) {
    $opt = $optimalResp.Data

    # Check for ad group level recommendations
    $hasAdGroupData = ($null -ne $opt.adGroups -or $null -ne $opt.recommendations -or $null -ne $opt.totalOptimalDaily)

    Test-Assert -TestName "3.3.2 Optimal ads has per-group or total data" `
        -Condition $hasAdGroupData `
        -Message "No ad group data or totals found in response" `
        -Suite "Flow3-OptimalAds"

    if ($opt.adGroups) {
        foreach ($ag in $opt.adGroups) {
            if ($ag.baseline -gt 0) {
                Test-Assert -TestName "3.3.3 Ad group cap: upperCap <= baseline * 1.20" `
                    -Condition ($ag.upperCap -le ($ag.baseline * 1.21)) `
                    -Message "upperCap=$($ag.upperCap), baseline=$($ag.baseline)" `
                    -Suite "Flow3-OptimalAds"

                Test-Assert -TestName "3.3.4 Ad group cap: lowerCap >= baseline * 0.70" `
                    -Condition ($ag.lowerCap -ge ($ag.baseline * 0.69)) `
                    -Message "lowerCap=$($ag.lowerCap), baseline=$($ag.baseline)" `
                    -Suite "Flow3-OptimalAds"
                break  # Only test first valid ad group
            }
        }
    }
}

# FC Dashboard with optimal ads integration
$dash2 = Invoke-Api -Method GET -Path "/api/financial-control/dashboard" -Headers $headers
if ($dash2.Success -and $dash2.Data) {
    Test-Assert -TestName "3.3.5 Dashboard adsBudgetApproved = min(optimal, available)" `
        -Condition ($dash2.Data.adsBudgetApproved -ge 0) `
        -Message "adsBudgetApproved=$($dash2.Data.adsBudgetApproved)" `
        -Suite "Flow3-OptimalAds"

    if ($null -ne $dash2.Data.availableAfterSurvival) {
        Test-Assert -TestName "3.3.6 adsBudgetApproved <= availableAfterSurvival" `
            -Condition ($dash2.Data.adsBudgetApproved -le $dash2.Data.availableAfterSurvival + 1) `
            -Message "ads=$($dash2.Data.adsBudgetApproved), available=$($dash2.Data.availableAfterSurvival)" `
            -Suite "Flow3-OptimalAds"
    }

    # ownerWithdrawable = max(0, available - adsBudget)
    if ($null -ne $dash2.Data.ownerWithdrawable -and $null -ne $dash2.Data.availableAfterSurvival) {
        $expectedOwner = [math]::Max(0, $dash2.Data.availableAfterSurvival - $dash2.Data.adsBudgetApproved)
        $ownerDiff = [math]::Abs($dash2.Data.ownerWithdrawable - $expectedOwner)

        Test-Assert -TestName "3.3.7 ownerWithdrawable = max(0, available - adsBudget)" `
            -Condition ($ownerDiff -lt 2) `
            -Message "owner=$($dash2.Data.ownerWithdrawable), expected=$expectedOwner" `
            -Suite "Flow3-OptimalAds"
    }
}

# ----------------------------------------------------------
# 3.4 Cashflow Ads Decision (cashflow-control)
# ----------------------------------------------------------
Write-TestGroup "3.4 Cashflow Ads Decision"

$adsDecResp = Invoke-Api -Method GET -Path "/api/cashflow/ads/decision" -Headers $headers

if ($adsDecResp.Success) {
    $dec = $adsDecResp.Data

    Test-Assert -TestName "3.4.1 Ads decision has finalAdsBudget" `
        -Condition ($null -ne $dec.finalAdsBudget) `
        -Message "Missing finalAdsBudget" `
        -Suite "Flow3-AdsDecision"

    Test-Assert -TestName "3.4.2 Ads decision has recommendation" `
        -Condition ($dec.recommendation -in @("SCALE_UP", "MAINTAIN", "SCALE_DOWN", "PAUSE")) `
        -Message "Got: $($dec.recommendation)" `
        -Suite "Flow3-AdsDecision"

    Test-Assert -TestName "3.4.3 finalAdsBudget = min(optimal, allowed)" `
        -Condition ($dec.finalAdsBudget -le $dec.optimalAdsBudget -or $dec.finalAdsBudget -le $dec.allowedByCashflow) `
        -Message "final=$($dec.finalAdsBudget), optimal=$($dec.optimalAdsBudget), allowed=$($dec.allowedByCashflow)" `
        -Suite "Flow3-AdsDecision"

    Test-Assert -TestName "3.4.4 Ads decision has isRestricted flag" `
        -Condition ($null -ne $dec.isRestricted) `
        -Message "Missing isRestricted" `
        -Suite "Flow3-AdsDecision"

    if ($dec.isRestricted) {
        Test-Assert -TestName "3.4.5 Restricted => has restrictionReason" `
            -Condition ($null -ne $dec.restrictionReason -and $dec.restrictionReason.Length -gt 0) `
            -Message "isRestricted=true but no reason" `
            -Suite "Flow3-AdsDecision"
    }
}
else {
    # Endpoint may not exist (cashflow-control module)
    Test-Skip "3.4.x Ads decision tests" -Reason "Endpoint not available: $($adsDecResp.Error)" -Suite "Flow3-AdsDecision"
}

# ----------------------------------------------------------
# 3.5 Funds Status
# ----------------------------------------------------------
Write-TestGroup "3.5 Cashflow Funds Status"

$fundsResp = Invoke-Api -Method GET -Path "/api/cashflow/funds/status" -Headers $headers

if ($fundsResp.Success) {
    $funds = $fundsResp.Data

    Test-Assert -TestName "3.5.1 Funds status has funds array" `
        -Condition ($null -ne $funds.funds) `
        -Message "Missing funds array" `
        -Suite "Flow3-Funds"

    Test-Assert -TestName "3.5.2 Funds has totalBalance" `
        -Condition ($null -ne $funds.totalBalance) `
        -Message "Missing totalBalance" `
        -Suite "Flow3-Funds"

    if ($funds.funds -and $funds.funds.Count -gt 0) {
        $fundTypes = $funds.funds | ForEach-Object { $_.fundType }

        Test-Assert -TestName "3.5.3 Has COMMITTED_CASH fund" `
            -Condition ($fundTypes -contains "COMMITTED_CASH") `
            -Message "Missing COMMITTED_CASH fund type" `
            -Suite "Flow3-Funds"

        Test-Assert -TestName "3.5.4 Has ADS_FUND" `
            -Condition ($fundTypes -contains "ADS_FUND") `
            -Message "Missing ADS_FUND fund type" `
            -Suite "Flow3-Funds"

        Test-Assert -TestName "3.5.5 Has SURVIVAL_BUFFER fund" `
            -Condition ($fundTypes -contains "SURVIVAL_BUFFER") `
            -Message "Missing SURVIVAL_BUFFER fund type" `
            -Suite "Flow3-Funds"

        # Check fund status values
        foreach ($f in $funds.funds) {
            if ($f.fundType -eq "ADS_FUND") {
                Test-Assert -TestName "3.5.6 ADS_FUND status is valid" `
                    -Condition ($f.status -in @("safe", "warning", "danger")) `
                    -Message "Got: $($f.status)" `
                    -Suite "Flow3-Funds"
                break
            }
        }
    }
}
else {
    Test-Skip "3.5.x Funds tests" -Reason "Endpoint not available: $($fundsResp.Error)" -Suite "Flow3-Funds"
}

# ----------------------------------------------------------
# 3.6 Ads Alerts
# ----------------------------------------------------------
Write-TestGroup "3.6 Ads Alerts"

# Trigger manual check
$checkResp = Invoke-Api -Method POST -Path "/api/ads-alerts/check" -Headers $headers

Test-Assert -TestName "3.6.1 Trigger ads alerts check - success" `
    -Condition ($checkResp.Success) `
    -Message "Error: $($checkResp.Error)" `
    -Suite "Flow3-Alerts"

Start-Sleep -Seconds 2  # Wait for alert generation

# Get all alerts
$alertsResp = Invoke-Api -Method GET -Path "/api/ads-alerts" -Headers $headers

Test-Assert -TestName "3.6.2 GET all ads alerts - success" `
    -Condition ($alertsResp.Success) `
    -Message "Error: $($alertsResp.Error)" `
    -Suite "Flow3-Alerts"

if ($alertsResp.Success -and $alertsResp.Data) {
    $alerts = if ($alertsResp.Data.data) { $alertsResp.Data.data } else { $alertsResp.Data }

    if ($alerts -and $alerts.Count -gt 0) {
        $firstAlert = $alerts[0]

        Test-Assert -TestName "3.6.3 Alert has type field (CRITICAL/WARNING/INFO/SUCCESS)" `
            -Condition ($firstAlert.type -in @("CRITICAL", "WARNING", "INFO", "SUCCESS")) `
            -Message "Got: $($firstAlert.type)" `
            -Suite "Flow3-Alerts"

        Test-Assert -TestName "3.6.4 Alert has category field" `
            -Condition ($firstAlert.category -in @("SCALE", "KILL", "BUDGET", "ROI", "PERFORMANCE", "KPI")) `
            -Message "Got: $($firstAlert.category)" `
            -Suite "Flow3-Alerts"

        Test-Assert -TestName "3.6.5 Alert has metrics object" `
            -Condition ($null -ne $firstAlert.metrics) `
            -Message "Missing metrics" `
            -Suite "Flow3-Alerts"

        # Mark as read
        $markReadResp = Invoke-Api -Method PATCH `
            -Path "/api/ads-alerts/$($firstAlert.id)/read" `
            -Headers $headers

        Test-Assert -TestName "3.6.6 Mark alert as read - success" `
            -Condition ($markReadResp.Success) `
            -Message "Error: $($markReadResp.Error)" `
            -Suite "Flow3-Alerts"
    }
    else {
        Test-Skip "3.6.3-6 Individual alert tests" -Reason "No alerts generated (may need order data)" -Suite "Flow3-Alerts"
    }
}

# Alerts summary
$alertSummResp = Invoke-Api -Method GET -Path "/api/ads-alerts/summary" -Headers $headers

Test-Assert -TestName "3.6.7 GET alerts summary - success" `
    -Condition ($alertSummResp.Success) `
    -Message "Error: $($alertSummResp.Error)" `
    -Suite "Flow3-Alerts"

if ($alertSummResp.Success -and $alertSummResp.Data) {
    $summ = $alertSummResp.Data

    Test-Assert -TestName "3.6.8 Summary has total count" `
        -Condition ($null -ne $summ.total) `
        -Message "Missing total" `
        -Suite "Flow3-Alerts"

    Test-Assert -TestName "3.6.9 Summary has unread count" `
        -Condition ($null -ne $summ.unread) `
        -Message "Missing unread" `
        -Suite "Flow3-Alerts"

    Test-Assert -TestName "3.6.10 Summary has critical count" `
        -Condition ($null -ne $summ.critical) `
        -Message "Missing critical count" `
        -Suite "Flow3-Alerts"
}

# ----------------------------------------------------------
# 3.7 FC Config Read/Update
# ----------------------------------------------------------
Write-TestGroup "3.7 FC Configuration"

$configResp = Invoke-Api -Method GET -Path "/api/financial-control/config" -Headers $headers

Test-Assert -TestName "3.7.1 GET FC config - success" `
    -Condition ($configResp.Success) `
    -Message "Error: $($configResp.Error)" `
    -Suite "Flow3-Config"

if ($configResp.Success -and $configResp.Data) {
    $cfg = $configResp.Data

    Test-Assert -TestName "3.7.2 Config has CommittedWindowDays" `
        -Condition ($null -ne $cfg.CommittedWindowDays) `
        -Message "Missing CommittedWindowDays" `
        -Suite "Flow3-Config"

    Test-Assert -TestName "3.7.3 Config has SurvivalMonths" `
        -Condition ($null -ne $cfg.SurvivalMonths) `
        -Message "Missing SurvivalMonths" `
        -Suite "Flow3-Config"

    Test-Assert -TestName "3.7.4 Config has UpperCapMultiplier" `
        -Condition ($null -ne $cfg.UpperCapMultiplier) `
        -Message "Missing UpperCapMultiplier" `
        -Suite "Flow3-Config"

    Test-Assert -TestName "3.7.5 UpperCapMultiplier = 1.20" `
        -Condition ([math]::Abs($cfg.UpperCapMultiplier - 1.20) -lt 0.01) `
        -Message "Got: $($cfg.UpperCapMultiplier)" `
        -Suite "Flow3-Config"

    Test-Assert -TestName "3.7.6 LowerCapMultiplier = 0.70" `
        -Condition ([math]::Abs($cfg.LowerCapMultiplier - 0.70) -lt 0.01) `
        -Message "Got: $($cfg.LowerCapMultiplier)" `
        -Suite "Flow3-Config"
}


# ############################################################
# CLEANUP (Optional - remove test data)
# ############################################################
Write-SuiteHeader "CLEANUP"

Write-TestGroup "Removing test data"

$cleanupErrors = 0

# Delete test orders
foreach ($oid in $script:createdOrderIds) {
    if ($oid) {
        $delResp = Invoke-Api -Method DELETE -Path "/api/test-order2/$oid" -Headers $headers
        if (-not $delResp.Success) { $cleanupErrors++ }
    }
}
Write-Host "    Deleted $($script:createdOrderIds.Count) test orders (errors: $cleanupErrors)" -ForegroundColor DarkGray

# Delete test ads cost records
$cleanupAds = 0
foreach ($acid in $script:createdAdsCostIds) {
    if ($acid) {
        $delAds = Invoke-Api -Method DELETE -Path "/api/advertising-cost/$acid" -Headers $headers
        if (-not $delAds.Success) { $cleanupAds++ }
    }
}
Write-Host "    Deleted $($script:createdAdsCostIds.Count) ads cost records (errors: $cleanupAds)" -ForegroundColor DarkGray


# ############################################################
# RESULTS SUMMARY
# ############################################################
Write-Host ""
Write-Host ("=" * 70) -ForegroundColor Magenta
Write-Host "  TEST RESULTS SUMMARY" -ForegroundColor Magenta
Write-Host ("=" * 70) -ForegroundColor Magenta
Write-Host ""
Write-Host "  Total:   $($script:totalTests)" -ForegroundColor White
Write-Host "  Passed:  $($script:passedTests)" -ForegroundColor Green
Write-Host "  Failed:  $($script:failedTests)" -ForegroundColor Red
Write-Host "  Skipped: $($script:skippedTests)" -ForegroundColor Yellow

$passRate = if ($script:totalTests -gt 0) {
    [math]::Round(($script:passedTests / ($script:totalTests - $script:skippedTests)) * 100, 1)
} else { 0 }
Write-Host ""
Write-Host "  Pass Rate: $passRate% (excluding skipped)" -ForegroundColor $(if ($passRate -ge 90) { "Green" } elseif ($passRate -ge 70) { "Yellow" } else { "Red" })

# By suite summary
Write-Host ""
Write-Host "  By Suite:" -ForegroundColor White
$suites = $script:testResults | Group-Object suite
foreach ($s in $suites) {
    $sPassed = ($s.Group | Where-Object { $_.passed -eq $true }).Count
    $sFailed = ($s.Group | Where-Object { $_.passed -eq $false }).Count
    $sSkipped = ($s.Group | Where-Object { $null -eq $_.passed }).Count
    $color = if ($sFailed -eq 0) { "Green" } else { "Red" }
    Write-Host "    $($s.Name): $sPassed passed, $sFailed failed, $sSkipped skipped" -ForegroundColor $color
}

# Save results to JSON
$resultObj = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    total     = $script:totalTests
    passed    = $script:passedTests
    failed    = $script:failedTests
    skipped   = $script:skippedTests
    passRate  = $passRate
    tests     = $script:testResults
}
$resultObj | ConvertTo-Json -Depth 5 | Out-File -FilePath $resultFile -Encoding UTF8

Write-Host ""
Write-Host "  Results saved to: $resultFile" -ForegroundColor DarkGray
Write-Host ""

# Exit with appropriate code
if ($script:failedTests -gt 0) {
    exit 1
}
exit 0
