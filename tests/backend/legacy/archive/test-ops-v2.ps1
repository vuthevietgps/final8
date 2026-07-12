# OPERATIONAL SCENARIOS TEST SCRIPT v2
# Corrected endpoints based on actual routes

$baseUrl = "http://localhost:3000/api"
$token = $null

function Write-TestHeader($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Step($step, $text) {
    Write-Host "`n[$step] $text" -ForegroundColor Yellow
}

function Write-Success($text) {
    Write-Host "  [OK] $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "  [FAIL] $text" -ForegroundColor Red
}

function Write-Info($text) {
    Write-Host "  [INFO] $text" -ForegroundColor Gray
}

# === 1. LOGIN AS DIRECTOR ===
Write-TestHeader "LOGIN AS DIRECTOR"

try {
    $loginBody = @{
        email = "director@test.com"
        password = "123456"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json; charset=utf-8"
    $token = $loginResponse.access_token
    Write-Success "Login successful!"
    Write-Info "Token: $($token.Substring(0, 50))..."
} catch {
    Write-Fail "Login failed: $_"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json; charset=utf-8"
}

# === SCENARIO 1: ORDER LIFECYCLE ===
# Correct route: /api/test-order2
Write-TestHeader "SCENARIO 1: ORDER LIFECYCLE"

$orderId = $null

# Step 1.1: Get available products
Write-Step "1.1" "Get available products"
try {
    $products = Invoke-RestMethod -Uri "$baseUrl/products" -Headers $headers
    $productCount = if ($products -is [array]) { $products.Count } else { 1 }
    Write-Success "Found $productCount products"
    
    $firstProductId = $null
    if ($productCount -gt 0) {
        $firstProduct = if ($products -is [array]) { $products[0] } else { $products }
        $firstProductId = $firstProduct._id
        Write-Info "First product: $($firstProduct.name) - ID: $firstProductId"
    }
} catch {
    Write-Fail "Error: $_"
}

# Step 1.2: Get delivery statuses
Write-Step "1.2" "Get delivery statuses"
try {
    $deliveryStatuses = Invoke-RestMethod -Uri "$baseUrl/delivery-status" -Headers $headers
    $statusCount = if ($deliveryStatuses -is [array]) { $deliveryStatuses.Count } else { 1 }
    Write-Success "Found $statusCount delivery statuses"
} catch {
    Write-Fail "Error: $_"
}

# Step 1.3: Get existing orders (correct endpoint: test-order2)
Write-Step "1.3" "Get orders list"
try {
    $orders = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Headers $headers
    if ($orders.data) {
        $orderCount = $orders.data.Count
        Write-Success "Found $orderCount orders"
        if ($orderCount -gt 0) {
            $orderId = $orders.data[0]._id
            Write-Info "First order ID: $orderId"
            Write-Info "Customer: $($orders.data[0].customerName)"
        }
    } else {
        $orderCount = if ($orders -is [array]) { $orders.Count } else { 0 }
        Write-Success "Found $orderCount orders"
        if ($orderCount -gt 0) {
            $orderId = $orders[0]._id
        }
    }
} catch {
    Write-Fail "Error: $_"
}

# Step 1.4: Get order details
if ($orderId) {
    Write-Step "1.4" "Get order details"
    try {
        $orderDetails = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId" -Headers $headers
        Write-Success "Order details retrieved!"
        Write-Info "Order ID: $($orderDetails._id)"
        Write-Info "Customer: $($orderDetails.customerName)"
        Write-Info "Status: $($orderDetails.deliveryStatus)"
        Write-Info "Total: $($orderDetails.totalAmount)"
    } catch {
        Write-Fail "Error: $_"
    }
}

# Step 1.5: Update order delivery status
if ($orderId) {
    Write-Step "1.5" "Update order delivery status"
    try {
        $updateBody = @{
            deliveryStatus = "dang_giao"
        } | ConvertTo-Json
        
        $updatedOrder = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId/delivery-status" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Delivery status updated!"
        Write-Info "New status: $($updatedOrder.deliveryStatus)"
    } catch {
        Write-Fail "Error: $_"
    }
}

# === SCENARIO 2: SUPPLIER PAYMENT WORKFLOW ===
Write-TestHeader "SCENARIO 2: SUPPLIER PAYMENT WORKFLOW"

# Step 2.1: Get supplier payables (correct endpoint: supplier-payables)
Write-Step "2.1" "Get supplier payables"
try {
    $payables = Invoke-RestMethod -Uri "$baseUrl/supplier-payables" -Headers $headers
    $payableCount = if ($payables -is [array]) { $payables.Count } else { 0 }
    Write-Success "Found $payableCount supplier payable records"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.2: Get orders pending supplier payment (correct endpoint: payment-pending/supplier)
Write-Step "2.2" "Get orders pending supplier payment"
try {
    $pendingOrders = Invoke-RestMethod -Uri "$baseUrl/test-order2/payment-pending/supplier" -Headers $headers
    $pendingCount = if ($pendingOrders -is [array]) { $pendingOrders.Count } else { 0 }
    Write-Success "Found $pendingCount orders pending supplier payment"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.3: Get finance summary
Write-Step "2.3" "Get finance summary"
try {
    $summary = Invoke-RestMethod -Uri "$baseUrl/finance/summary" -Headers $headers
    Write-Success "Got finance summary!"
    Write-Info "Data: $($summary | ConvertTo-Json -Compress)"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.4: Get finance cashflow health
Write-Step "2.4" "Get cashflow health"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/finance/cashflow-health" -Headers $headers
    Write-Success "Got cashflow health!"
    Write-Info "Cash Safety Index: $($health.cashSafetyIndex)"
    Write-Info "DSO: $($health.dso)"
    Write-Info "DPO: $($health.dpo)"
} catch {
    Write-Fail "Error: $_"
}

# === SCENARIO 3: PRODUCT MANAGEMENT ===
Write-TestHeader "SCENARIO 3: PRODUCT MANAGEMENT"

$productId = $null
$firstCatId = $null

# Step 3.1: Get product categories
Write-Step "3.1" "Get product categories"
try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Headers $headers
    $catCount = if ($categories -is [array]) { $categories.Count } else { 1 }
    Write-Success "Found $catCount categories"
    
    if ($categories -is [array] -and $categories.Count -gt 0) {
        $firstCatId = $categories[0]._id
        Write-Info "First category: $($categories[0].name)"
    }
} catch {
    Write-Fail "Error: $_"
}

# Step 3.2: Create new product (correct DTO fields)
Write-Step "3.2" "Create new product"
try {
    $productBody = @{
        name = "Test Product $(Get-Date -Format 'HHmmss')"
        categoryId = $firstCatId
    } | ConvertTo-Json
    
    $newProduct = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $productBody
    $productId = $newProduct._id
    Write-Success "Product created!"
    Write-Info "Product ID: $productId"
    Write-Info "Name: $($newProduct.name)"
} catch {
    Write-Fail "Create product error: $_"
}

# Step 3.3: Get product details
if ($productId) {
    Write-Step "3.3" "Get product details"
    try {
        $productDetails = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Headers $headers
        Write-Success "Product details retrieved!"
        Write-Info "Name: $($productDetails.name)"
        Write-Info "ID: $($productDetails._id)"
    } catch {
        Write-Fail "Error: $_"
    }
}

# Step 3.4: Update product
if ($productId) {
    Write-Step "3.4" "Update product"
    try {
        $updateBody = @{
            name = "Updated Test Product $(Get-Date -Format 'HHmmss')"
        } | ConvertTo-Json
        
        $updatedProduct = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Product updated!"
        Write-Info "New name: $($updatedProduct.name)"
    } catch {
        Write-Fail "Update error: $_"
    }
}

# === SCENARIO 4: BUDGET ALLOCATION ===
Write-TestHeader "SCENARIO 4: BUDGET AND CAPITAL"

# Step 4.1: Get budget allocation status
Write-Step "4.1" "Get budget allocation status"
try {
    $budget = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/status" -Headers $headers
    Write-Success "Got budget allocation status!"
} catch {
    Write-Fail "Error: $_"
}

# Step 4.2: Get capital allocation policies
Write-Step "4.2" "Get capital allocation policies"
try {
    $policies = Invoke-RestMethod -Uri "$baseUrl/capital-allocation/policies" -Headers $headers
    $policyCount = if ($policies -is [array]) { $policies.Count } else { 0 }
    Write-Success "Found $policyCount capital policies"
} catch {
    Write-Fail "Error: $_"
}

# Step 4.3: Get Employee Ads KPI
Write-Step "4.3" "Get Employee Ads KPI"
try {
    $fromDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $kpi = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi?fromDate=$fromDate`&toDate=$toDate" -Headers $headers
    Write-Success "Got Employee KPI data!"
} catch {
    Write-Fail "Error: $_"
}

# Step 4.4: Get Ad Group Daily Report
Write-Step "4.4" "Get Ad Group Daily Report"
try {
    $fromDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $adReport = Invoke-RestMethod -Uri "$baseUrl/ad-group-daily-report?fromDate=$fromDate`&toDate=$toDate" -Headers $headers
    Write-Success "Got ad report!"
    $reportCount = if ($adReport -is [array]) { $adReport.Count } else { 0 }
    Write-Info "Report count: $reportCount"
} catch {
    Write-Fail "Error: $_"
}

# === SCENARIO 5: AGENT RECEIVABLES ===
Write-TestHeader "SCENARIO 5: AGENT RECEIVABLES"

# Step 5.1: Get agent receivables statements
Write-Step "5.1" "Get agent receivable statements"
try {
    $statements = Invoke-RestMethod -Uri "$baseUrl/agent-receivables/statements" -Headers $headers
    $stmtCount = if ($statements -is [array]) { $statements.Count } else { 0 }
    Write-Success "Found $stmtCount statements"
} catch {
    Write-Fail "Error: $_"
}

# Step 5.2: Get agent receivables summary
Write-Step "5.2" "Get agent receivables summary"
try {
    $summary = Invoke-RestMethod -Uri "$baseUrl/agent-receivables/summary" -Headers $headers
    Write-Success "Got agent receivables summary!"
    Write-Info "Total: $($summary | ConvertTo-Json -Compress)"
} catch {
    Write-Fail "Error: $_"
}

# === SCENARIO 6: USER MANAGEMENT ===
Write-TestHeader "SCENARIO 6: USER MANAGEMENT"

# Step 6.1: Get all users
Write-Step "6.1" "Get all users"
try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Headers $headers
    $userCount = if ($users -is [array]) { $users.Count } else { 1 }
    Write-Success "Found $userCount users"
    
    if ($users -is [array]) {
        $roleGroups = $users | Group-Object -Property { if ($_.role) { $_.role } else { $_.userType } }
        foreach ($group in $roleGroups) {
            Write-Info "$($group.Name): $($group.Count) users"
        }
    }
} catch {
    Write-Fail "Error: $_"
}

# Step 6.2: Create test employee (correct DTO fields)
Write-Step "6.2" "Create test employee"
try {
    $randomNum = Get-Random -Minimum 100000 -Maximum 999999
    $userBody = @{
        email = "employee-test-$randomNum@test.com"
        password = "123456"
        fullName = "Test Employee $randomNum"
        role = "employee"
        phone = "0909$randomNum"
    } | ConvertTo-Json
    
    $newUser = Invoke-RestMethod -Uri "$baseUrl/users" -Method Post -Headers $headers -Body $userBody
    Write-Success "Employee created!"
    Write-Info "ID: $($newUser._id)"
    Write-Info "Email: $($newUser.email)"
    Write-Info "Role: $($newUser.role)"
} catch {
    Write-Fail "Create user error: $_"
}

# === SCENARIO 7: RETURN MANAGEMENT ===
Write-TestHeader "SCENARIO 7: RETURN REPORTS"

# Step 7.1: Get return report by ad group
Write-Step "7.1" "Get return report by ad group"
try {
    $returnReport = Invoke-RestMethod -Uri "$baseUrl/return-report/ad-group" -Headers $headers
    Write-Success "Got return report!"
    $reportCount = if ($returnReport -is [array]) { $returnReport.Count } else { 0 }
    Write-Info "Report items: $reportCount"
} catch {
    Write-Fail "Error: $_"
}

# Step 7.2: Get return report by product
Write-Step "7.2" "Get return report by product"
try {
    $productReport = Invoke-RestMethod -Uri "$baseUrl/return-report/product" -Headers $headers
    Write-Success "Got product return report!"
    $reportCount = if ($productReport -is [array]) { $productReport.Count } else { 0 }
    Write-Info "Report items: $reportCount"
} catch {
    Write-Fail "Error: $_"
}

# === SCENARIO 8: FANPAGE/CHAT ===
Write-TestHeader "SCENARIO 8: FANPAGE/CHAT INTEGRATION"

# Step 8.1: Get fanpages
Write-Step "8.1" "Get fanpages"
try {
    $fanpages = Invoke-RestMethod -Uri "$baseUrl/fanpages" -Headers $headers
    $pageCount = if ($fanpages -is [array]) { $fanpages.Count } else { 0 }
    Write-Success "Found $pageCount fanpages"
} catch {
    Write-Fail "Error: $_"
}

# Step 8.2: Get chat conversations
Write-Step "8.2" "Get chat conversations"
try {
    $conversations = Invoke-RestMethod -Uri "$baseUrl/chat-messages/conversations/list/all" -Headers $headers
    $convCount = if ($conversations -is [array]) { $conversations.Count } else { 0 }
    Write-Success "Found $convCount conversations"
} catch {
    Write-Fail "Error: $_"
}

# === CLEANUP ===
Write-TestHeader "CLEANUP"

if ($productId) {
    Write-Step "C.1" "Delete test product"
    try {
        Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Delete -Headers $headers
        Write-Success "Test product deleted!"
    } catch {
        Write-Info "Could not delete: $_"
    }
}

# === SUMMARY ===
Write-TestHeader "TEST SUMMARY"

Write-Host ""
Write-Host "SCENARIOS TESTED:" -ForegroundColor White
Write-Host ""
Write-Host "1. ORDER LIFECYCLE (/api/test-order2)" -ForegroundColor White
Write-Host "   + Get products" -ForegroundColor Gray
Write-Host "   + Get delivery statuses" -ForegroundColor Gray
Write-Host "   + Get orders list" -ForegroundColor Gray
Write-Host "   + Get order details" -ForegroundColor Gray
Write-Host "   + Update delivery status" -ForegroundColor Gray
Write-Host ""
Write-Host "2. SUPPLIER PAYMENT" -ForegroundColor White
Write-Host "   + Get supplier payables" -ForegroundColor Gray
Write-Host "   + Get pending supplier payment" -ForegroundColor Gray
Write-Host "   + Get finance summary" -ForegroundColor Gray
Write-Host "   + Get cashflow health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. PRODUCT MANAGEMENT" -ForegroundColor White
Write-Host "   + Get categories" -ForegroundColor Gray
Write-Host "   + Create product" -ForegroundColor Gray
Write-Host "   + Get product details" -ForegroundColor Gray
Write-Host "   + Update product" -ForegroundColor Gray
Write-Host ""
Write-Host "4. BUDGET AND CAPITAL" -ForegroundColor White
Write-Host "   + Get budget allocation status" -ForegroundColor Gray
Write-Host "   + Get capital policies" -ForegroundColor Gray
Write-Host "   + Get Employee KPI" -ForegroundColor Gray
Write-Host "   + Get Ad Group Daily Report" -ForegroundColor Gray
Write-Host ""
Write-Host "5. AGENT RECEIVABLES" -ForegroundColor White
Write-Host "   + Get statements" -ForegroundColor Gray
Write-Host "   + Get summary" -ForegroundColor Gray
Write-Host ""
Write-Host "6. USER MANAGEMENT" -ForegroundColor White
Write-Host "   + Get all users" -ForegroundColor Gray
Write-Host "   + Create employee" -ForegroundColor Gray
Write-Host ""
Write-Host "7. RETURN REPORTS" -ForegroundColor White
Write-Host "   + Return by ad group" -ForegroundColor Gray
Write-Host "   + Return by product" -ForegroundColor Gray
Write-Host ""
Write-Host "8. FANPAGE/CHAT" -ForegroundColor White
Write-Host "   + Get fanpages" -ForegroundColor Gray
Write-Host "   + Get conversations" -ForegroundColor Gray
Write-Host ""

Write-Host "OPERATIONAL TEST COMPLETED!" -ForegroundColor Green
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
