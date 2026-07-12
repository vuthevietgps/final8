# OPERATIONAL SCENARIOS TEST SCRIPT
# Test cac tinh huong van hanh thuc te

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
Write-TestHeader "SCENARIO 1: ORDER LIFECYCLE"

$orderId = $null

# Step 1.1: Get available products
Write-Step "1.1" "Get available products"
try {
    $products = Invoke-RestMethod -Uri "$baseUrl/products" -Headers $headers
    $productCount = if ($products -is [array]) { $products.Count } else { 1 }
    Write-Success "Found $productCount products"
    
    if ($productCount -gt 0) {
        $firstProduct = if ($products -is [array]) { $products[0] } else { $products }
        Write-Info "First product: $($firstProduct.name) - Price: $($firstProduct.price)"
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

# Step 1.3: Create a new order
Write-Step "1.3" "Create new order"
try {
    $orderBody = @{
        customerName = "Test Customer $(Get-Date -Format 'HHmmss')"
        customerPhone = "0901234567"
        customerAddress = "123 Test Street, District 1, HCMC"
        items = @(
            @{
                productId = "test-product-1"
                productName = "Test Product"
                quantity = 2
                price = 150000
            }
        )
        totalAmount = 300000
        notes = "Test order - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    } | ConvertTo-Json -Depth 10
    
    $newOrder = Invoke-RestMethod -Uri "$baseUrl/testorders2" -Method Post -Headers $headers -Body $orderBody
    $orderId = $newOrder._id
    Write-Success "Order created!"
    Write-Info "Order ID: $orderId"
    Write-Info "Customer: $($newOrder.customerName)"
    Write-Info "Total: $($newOrder.totalAmount) VND"
} catch {
    Write-Fail "Create order error: $_"
    Write-Info "Trying to get existing order..."
    
    try {
        $orders = Invoke-RestMethod -Uri "$baseUrl/testorders2" -Headers $headers
        if ($orders -and $orders.Count -gt 0) {
            $orderId = $orders[0]._id
            Write-Success "Using existing order: $orderId"
        }
    } catch {
        Write-Fail "Cannot get orders: $_"
    }
}

# Step 1.4: Update order status
if ($orderId) {
    Write-Step "1.4" "Update order status"
    try {
        $updateBody = @{
            deliveryStatus = "processing"
            notes = "Processing - Updated at $(Get-Date -Format 'HH:mm:ss')"
        } | ConvertTo-Json
        
        $updatedOrder = Invoke-RestMethod -Uri "$baseUrl/testorders2/$orderId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Order status updated!"
        Write-Info "New status: $($updatedOrder.deliveryStatus)"
    } catch {
        Write-Fail "Update error: $_"
    }
}

# Step 1.5: Get order details
if ($orderId) {
    Write-Step "1.5" "Get order details"
    try {
        $orderDetails = Invoke-RestMethod -Uri "$baseUrl/testorders2/$orderId" -Headers $headers
        Write-Success "Order details retrieved!"
        Write-Info "ID: $($orderDetails._id)"
        Write-Info "Customer: $($orderDetails.customerName)"
        Write-Info "Status: $($orderDetails.deliveryStatus)"
    } catch {
        Write-Fail "Error: $_"
    }
}

# === SCENARIO 2: PAYMENT BATCH WORKFLOW ===
Write-TestHeader "SCENARIO 2: PAYMENT BATCH WORKFLOW"

# Step 2.1: Check supplier payables
Write-Step "2.1" "Check supplier payables"
try {
    $payables = Invoke-RestMethod -Uri "$baseUrl/supplier-payable/summary" -Headers $headers
    Write-Success "Got payables info!"
    Write-Info "Total payable: $($payables.totalPayable) VND"
    Write-Info "Supplier count: $($payables.supplierCount)"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.2: Get suppliers list
Write-Step "2.2" "Get suppliers list"
try {
    $suppliers = Invoke-RestMethod -Uri "$baseUrl/suppliers" -Headers $headers
    $supplierCount = if ($suppliers -is [array]) { $suppliers.Count } else { 1 }
    Write-Success "Found $supplierCount suppliers"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.3: Check available funds
Write-Step "2.3" "Check available funds"
try {
    $funds = Invoke-RestMethod -Uri "$baseUrl/capital-management/available-funds" -Headers $headers
    Write-Success "Got available funds!"
    Write-Info "Available: $($funds.availableFunds) VND"
    Write-Info "Total capital: $($funds.totalCapital) VND"
} catch {
    Write-Fail "Error: $_"
}

# Step 2.4: Check cashflow health
Write-Step "2.4" "Check cashflow health"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/capital-management/cashflow-health" -Headers $headers
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
    }
} catch {
    Write-Fail "Error: $_"
}

# Step 3.2: Create new product
Write-Step "3.2" "Create new product"
try {
    $productBody = @{
        name = "Test Product $(Get-Date -Format 'HHmmss')"
        sku = "SKU-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        price = 299000
        cost = 150000
        stock = 100
        categoryId = $firstCatId
        description = "Test product for operational testing"
        isActive = $true
    } | ConvertTo-Json
    
    $newProduct = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $productBody
    $productId = $newProduct._id
    Write-Success "Product created!"
    Write-Info "Product ID: $productId"
    Write-Info "Name: $($newProduct.name)"
    Write-Info "Price: $($newProduct.price) VND"
} catch {
    Write-Fail "Create product error: $_"
}

# Step 3.3: Update product stock
if ($productId) {
    Write-Step "3.3" "Update product stock"
    try {
        $updateBody = @{
            stock = 150
        } | ConvertTo-Json
        
        $updatedProduct = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Stock updated!"
        Write-Info "New stock: $($updatedProduct.stock)"
    } catch {
        Write-Fail "Update error: $_"
    }
}

# Step 3.4: Get product details
if ($productId) {
    Write-Step "3.4" "Get product details"
    try {
        $productDetails = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Headers $headers
        Write-Success "Product details retrieved!"
        Write-Info "Name: $($productDetails.name)"
        Write-Info "SKU: $($productDetails.sku)"
        Write-Info "Stock: $($productDetails.stock)"
    } catch {
        Write-Fail "Error: $_"
    }
}

# === SCENARIO 4: BUDGET ALLOCATION ===
Write-TestHeader "SCENARIO 4: BUDGET ALLOCATION"

# Step 4.1: Get current budget allocation
Write-Step "4.1" "Get budget allocation"
try {
    $budget = Invoke-RestMethod -Uri "$baseUrl/budget-allocation" -Headers $headers
    Write-Success "Got budget allocation!"
} catch {
    Write-Fail "Error: $_"
}

# Step 4.2: Check capital allocation settings
Write-Step "4.2" "Get capital allocation settings"
try {
    $allocation = Invoke-RestMethod -Uri "$baseUrl/capital-management/allocation" -Headers $headers
    Write-Success "Got capital allocation!"
} catch {
    Write-Fail "Error: $_"
}

# Step 4.3: Check Employee Ads KPI
Write-Step "4.3" "Check Employee Ads KPI"
try {
    $fromDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $kpi = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi?fromDate=$fromDate`&toDate=$toDate" -Headers $headers
    Write-Success "Got Employee KPI data!"
} catch {
    Write-Fail "Error: $_"
}

# === SCENARIO 5: REPORTING ===
Write-TestHeader "SCENARIO 5: REPORTING"

# Step 5.1: Return report
Write-Step "5.1" "Get return report"
try {
    $returnReport = Invoke-RestMethod -Uri "$baseUrl/reports/return-report" -Headers $headers
    Write-Success "Got return report!"
    Write-Info "Total returns: $($returnReport.totalReturns)"
} catch {
    Write-Fail "Error: $_"
}

# Step 5.2: Ad Group Daily Report
Write-Step "5.2" "Get Ad Group Daily Report"
try {
    $fromDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $adReport = Invoke-RestMethod -Uri "$baseUrl/reports/ad-group-daily?fromDate=$fromDate`&toDate=$toDate" -Headers $headers
    Write-Success "Got ad report!"
    $reportCount = if ($adReport -is [array]) { $adReport.Count } else { 1 }
    Write-Info "Report count: $reportCount"
} catch {
    Write-Fail "Error: $_"
}

# Step 5.3: Agent receivables
Write-Step "5.3" "Get agent receivables"
try {
    $receivables = Invoke-RestMethod -Uri "$baseUrl/agent-receivable/summary" -Headers $headers
    Write-Success "Got agent receivables!"
    Write-Info "Total receivable: $($receivables.totalReceivable) VND"
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

# Step 6.2: Create test employee
Write-Step "6.2" "Create test employee"
try {
    $randomNum = Get-Random -Minimum 100000 -Maximum 999999
    $userBody = @{
        email = "employee-test-$randomNum@test.com"
        password = "123456"
        name = "Test Employee $randomNum"
        role = "employee"
        userType = "employee"
        phone = "0909$randomNum"
        isActive = $true
    } | ConvertTo-Json
    
    $newUser = Invoke-RestMethod -Uri "$baseUrl/users" -Method Post -Headers $headers -Body $userBody
    Write-Success "Employee created!"
    Write-Info "ID: $($newUser._id)"
    Write-Info "Email: $($newUser.email)"
    Write-Info "Role: $($newUser.role)"
} catch {
    Write-Fail "Create user error: $_"
}

# === SCENARIO 7: CHAT/MESSENGER INTEGRATION ===
Write-TestHeader "SCENARIO 7: CHAT INTEGRATION"

# Step 7.1: Get conversations
Write-Step "7.1" "Get conversations"
try {
    $conversations = Invoke-RestMethod -Uri "$baseUrl/chat/conversations" -Headers $headers
    $convCount = if ($conversations -is [array]) { $conversations.Count } else { 0 }
    Write-Success "Found $convCount conversations"
} catch {
    Write-Fail "Error: $_"
}

# Step 7.2: Get messenger pages
Write-Step "7.2" "Get Facebook Pages"
try {
    $pages = Invoke-RestMethod -Uri "$baseUrl/messenger-integration/pages" -Headers $headers
    $pageCount = if ($pages -is [array]) { $pages.Count } else { 0 }
    Write-Success "Found $pageCount pages"
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
Write-Host "1. ORDER LIFECYCLE" -ForegroundColor White
Write-Host "   + Get products" -ForegroundColor Gray
Write-Host "   + Get delivery statuses" -ForegroundColor Gray
Write-Host "   + Create order" -ForegroundColor Gray
Write-Host "   + Update order status" -ForegroundColor Gray
Write-Host "   + Get order details" -ForegroundColor Gray
Write-Host ""
Write-Host "2. PAYMENT BATCH" -ForegroundColor White
Write-Host "   + Check payables" -ForegroundColor Gray
Write-Host "   + Get suppliers" -ForegroundColor Gray
Write-Host "   + Check available funds" -ForegroundColor Gray
Write-Host "   + Check cashflow health" -ForegroundColor Gray
Write-Host ""
Write-Host "3. PRODUCT MANAGEMENT" -ForegroundColor White
Write-Host "   + Get categories" -ForegroundColor Gray
Write-Host "   + Create product" -ForegroundColor Gray
Write-Host "   + Update stock" -ForegroundColor Gray
Write-Host "   + Get product details" -ForegroundColor Gray
Write-Host ""
Write-Host "4. BUDGET ALLOCATION" -ForegroundColor White
Write-Host "   + Get budget allocation" -ForegroundColor Gray
Write-Host "   + Get capital settings" -ForegroundColor Gray
Write-Host "   + Check Employee KPI" -ForegroundColor Gray
Write-Host ""
Write-Host "5. REPORTING" -ForegroundColor White
Write-Host "   + Return report" -ForegroundColor Gray
Write-Host "   + Ad group daily report" -ForegroundColor Gray
Write-Host "   + Agent receivables" -ForegroundColor Gray
Write-Host ""
Write-Host "6. USER MANAGEMENT" -ForegroundColor White
Write-Host "   + Get all users" -ForegroundColor Gray
Write-Host "   + Create employee" -ForegroundColor Gray
Write-Host ""
Write-Host "7. CHAT INTEGRATION" -ForegroundColor White
Write-Host "   + Get conversations" -ForegroundColor Gray
Write-Host "   + Get Facebook Pages" -ForegroundColor Gray
Write-Host ""

Write-Host "OPERATIONAL SCENARIOS TEST COMPLETED!" -ForegroundColor Green
Write-Host "Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
