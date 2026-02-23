# Test Payment Batch Processing
# Chạy: .\test-payment-batch.ps1

$baseUrl = "http://localhost:3000/api"

# Login
Write-Host "=== LOGIN ===" -ForegroundColor Cyan
$login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body '{"email":"director@test.com","password":"123456"}' -ContentType "application/json"
$token = $login.access_token
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
Write-Host "Token obtained" -ForegroundColor Green

# ===== Get Orders for testing =====
Write-Host "`n=== GETTING ORDERS ===" -ForegroundColor Cyan
$orders = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Method Get -Headers $headers
$orderList = $orders.data

if ($orderList.Length -eq 0) {
    Write-Host "No orders found in database" -ForegroundColor Yellow
    exit
}

Write-Host "Found $($orderList.Length) orders" -ForegroundColor Green

# Display first 5 orders
Write-Host "`nFirst 5 orders:" -ForegroundColor Cyan
$orderList | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_._id): $($_.orderCode) | $($_.customerName) | Status: $($_.deliveryStatus)"
}

# ===== Test Supplier Payment Batch =====
Write-Host "`n=== TEST SUPPLIER PAYMENT BATCH ===" -ForegroundColor Cyan

# Get 2 orders without supplier payment batch
$ordersWithoutSupplierPayment = $orderList | Where-Object { -not $_.supplierPaymentBatchId } | Select-Object -First 2

if ($ordersWithoutSupplierPayment.Length -ge 2) {
    $orderIds = @($ordersWithoutSupplierPayment[0]._id, $ordersWithoutSupplierPayment[1]._id)
    $batchId = "TT-NCC-TEST-" + (Get-Date -Format "yyyyMMddHHmmss")
    
    $batchData = @{
        orderIds = $orderIds
        batchId = $batchId
        paidDate = (Get-Date -Format "yyyy-MM-dd")
        note = "Test payment batch"
    } | ConvertTo-Json
    
    Write-Host "Creating batch with orders: $($orderIds -join ', ')"
    
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/test-order2/supplier-payment-batch" -Method Post -Headers $headers -Body $batchData
        Write-Host "✅ Supplier Payment Batch Created: $batchId" -ForegroundColor Green
        Write-Host "   Updated $($result.modifiedCount) orders" -ForegroundColor Green
        
        # Verify orders were updated
        $verifyOrder = Invoke-RestMethod -Uri "$baseUrl/test-order2/$($orderIds[0])" -Method Get -Headers $headers
        Write-Host "   Verified: Order now has supplierPaymentBatchId = $($verifyOrder.supplierPaymentBatchId)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Supplier Payment Batch Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Not enough orders without supplier payment for testing" -ForegroundColor Yellow
}

# ===== Test Agent Payment Batch =====
Write-Host "`n=== TEST AGENT PAYMENT BATCH ===" -ForegroundColor Cyan

# Get 2 orders without agent payment batch
$ordersWithoutAgentPayment = $orderList | Where-Object { -not $_.agentPaymentBatchId } | Select-Object -First 2

if ($ordersWithoutAgentPayment.Length -ge 2) {
    $orderIds = @($ordersWithoutAgentPayment[0]._id, $ordersWithoutAgentPayment[1]._id)
    $batchId = "TT-DL-TEST-" + (Get-Date -Format "yyyyMMddHHmmss")
    
    $batchData = @{
        orderIds = $orderIds
        batchId = $batchId
        paidDate = (Get-Date -Format "yyyy-MM-dd")
        note = "Test agent payment batch"
    } | ConvertTo-Json
    
    Write-Host "Creating batch with orders: $($orderIds -join ', ')"
    
    try {
        $result = Invoke-RestMethod -Uri "$baseUrl/test-order2/agent-payment-batch" -Method Post -Headers $headers -Body $batchData
        Write-Host "✅ Agent Payment Batch Created: $batchId" -ForegroundColor Green
        Write-Host "   Updated $($result.modifiedCount) orders" -ForegroundColor Green
        
        # Verify orders were updated
        $verifyOrder = Invoke-RestMethod -Uri "$baseUrl/test-order2/$($orderIds[0])" -Method Get -Headers $headers
        Write-Host "   Verified: Order now has agentPaymentBatchId = $($verifyOrder.agentPaymentBatchId)" -ForegroundColor Green
    } catch {
        Write-Host "❌ Agent Payment Batch Error: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Not enough orders without agent payment for testing" -ForegroundColor Yellow
}

# ===== Test Available Funds Impact =====
Write-Host "`n=== TEST AVAILABLE FUNDS ===" -ForegroundColor Cyan

try {
    $funds = Invoke-RestMethod -Uri "$baseUrl/finance/available-funds/current" -Method Get -Headers $headers
    Write-Host "Available Funds:" -ForegroundColor Green
    Write-Host "  - Conservative: $('{0:N0}' -f $funds.availableFunds.conservative) VND" -ForegroundColor Cyan
    Write-Host "  - Moderate: $('{0:N0}' -f $funds.availableFunds.moderate) VND" -ForegroundColor Cyan
    Write-Host "  - Aggressive: $('{0:N0}' -f $funds.availableFunds.aggressive) VND" -ForegroundColor Cyan
    Write-Host "  - Total Funds: $('{0:N0}' -f $funds.totalFunds) VND" -ForegroundColor Green
} catch {
    Write-Host "❌ Available Funds Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ===== Test Cashflow Health =====
Write-Host "`n=== TEST CASHFLOW HEALTH ===" -ForegroundColor Cyan

try {
    $health = Invoke-RestMethod -Uri "$baseUrl/finance/cashflow-health" -Method Get -Headers $headers
    Write-Host "Cashflow Health:" -ForegroundColor Green
    Write-Host "  - CSI (Cash Safety Index): $($health.csi)" -ForegroundColor Cyan
    Write-Host "  - DSO (Days Sales Outstanding): $($health.dso) days" -ForegroundColor Cyan
    Write-Host "  - DPO (Days Payable Outstanding): $($health.dpo) days" -ForegroundColor Cyan
    Write-Host "  - Status: $($health.status)" -ForegroundColor $(if ($health.status -eq 'healthy') { 'Green' } elseif ($health.status -eq 'warning') { 'Yellow' } else { 'Red' })
} catch {
    Write-Host "❌ Cashflow Health Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== PAYMENT BATCH TESTS COMPLETE ===" -ForegroundColor Cyan
