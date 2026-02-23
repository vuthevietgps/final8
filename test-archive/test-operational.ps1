# =============================================
# OPERATIONAL SCENARIOS TEST SCRIPT
# Test các tình huống vận hành thực tế
# =============================================

$baseUrl = "http://localhost:3000"
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
    Write-Host "  ✅ $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "  ❌ $text" -ForegroundColor Red
}

function Write-Info($text) {
    Write-Host "  ℹ️  $text" -ForegroundColor Gray
}

# =============================================
# 1. LOGIN AS DIRECTOR
# =============================================
Write-TestHeader "🔐 LOGIN AS DIRECTOR"

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

# =============================================
# SCENARIO 1: ORDER LIFECYCLE
# Tạo đơn hàng → Cập nhật trạng thái → Hoàn thành
# =============================================
Write-TestHeader "📦 SCENARIO 1: ORDER LIFECYCLE"

$orderId = $null

# Step 1.1: Get available products
Write-Step "1.1" "Lấy danh sách sản phẩm có sẵn"
try {
    $products = Invoke-RestMethod -Uri "$baseUrl/products" -Headers $headers
    $productCount = if ($products -is [array]) { $products.Count } else { 1 }
    Write-Success "Có $productCount sản phẩm trong hệ thống"
    
    if ($productCount -gt 0) {
        $firstProduct = if ($products -is [array]) { $products[0] } else { $products }
        Write-Info "Sản phẩm đầu tiên: $($firstProduct.name) - Giá: $($firstProduct.price)"
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 1.2: Get delivery statuses
Write-Step "1.2" "Lấy danh sách trạng thái giao hàng"
try {
    $deliveryStatuses = Invoke-RestMethod -Uri "$baseUrl/delivery-status" -Headers $headers
    $statusCount = if ($deliveryStatuses -is [array]) { $deliveryStatuses.Count } else { 1 }
    Write-Success "Có $statusCount trạng thái giao hàng"
    
    if ($deliveryStatuses -is [array]) {
        foreach ($status in $deliveryStatuses[0..2]) {
            Write-Info "  - $($status.name) ($($status.code))"
        }
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 1.3: Create a new order
Write-Step "1.3" "Tạo đơn hàng mới"
try {
    $orderBody = @{
        customerName = "Khách hàng Test - $(Get-Date -Format 'HHmmss')"
        customerPhone = "0901234567"
        customerAddress = "123 Đường Test, Quận 1, TP.HCM"
        items = @(
            @{
                productId = "test-product-1"
                productName = "Sản phẩm Test"
                quantity = 2
                price = 150000
            }
        )
        totalAmount = 300000
        notes = "Đơn hàng test vận hành - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    } | ConvertTo-Json -Depth 10
    
    $newOrder = Invoke-RestMethod -Uri "$baseUrl/testorders2" -Method Post -Headers $headers -Body $orderBody
    $orderId = $newOrder._id
    Write-Success "Tạo đơn hàng thành công!"
    Write-Info "Order ID: $orderId"
    Write-Info "Khách hàng: $($newOrder.customerName)"
    Write-Info "Tổng tiền: $($newOrder.totalAmount) VND"
} catch {
    Write-Fail "Lỗi tạo đơn: $_"
    Write-Info "Thử lấy đơn hàng có sẵn..."
    
    try {
        $orders = Invoke-RestMethod -Uri "$baseUrl/testorders2" -Headers $headers
        if ($orders -and $orders.Count -gt 0) {
            $orderId = $orders[0]._id
            Write-Success "Sử dụng đơn hàng có sẵn: $orderId"
        }
    } catch {
        Write-Fail "Không thể lấy đơn hàng: $_"
    }
}

# Step 1.4: Update order status
if ($orderId) {
    Write-Step "1.4" "Cập nhật trạng thái đơn hàng"
    try {
        $updateBody = @{
            deliveryStatus = "processing"
            notes = "Đang xử lý - Cập nhật lúc $(Get-Date -Format 'HH:mm:ss')"
        } | ConvertTo-Json
        
        $updatedOrder = Invoke-RestMethod -Uri "$baseUrl/testorders2/$orderId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Cập nhật trạng thái thành công!"
        Write-Info "Trạng thái mới: $($updatedOrder.deliveryStatus)"
    } catch {
        Write-Fail "Lỗi cập nhật: $_"
    }
}

# Step 1.5: Get order details
if ($orderId) {
    Write-Step "1.5" "Xem chi tiết đơn hàng"
    try {
        $orderDetails = Invoke-RestMethod -Uri "$baseUrl/testorders2/$orderId" -Headers $headers
        Write-Success "Lấy chi tiết thành công!"
        Write-Info "ID: $($orderDetails._id)"
        Write-Info "Khách hàng: $($orderDetails.customerName)"
        Write-Info "Trạng thái: $($orderDetails.deliveryStatus)"
        Write-Info "Tổng tiền: $($orderDetails.totalAmount)"
    } catch {
        Write-Fail "Lỗi: $_"
    }
}

# =============================================
# SCENARIO 2: PAYMENT BATCH WORKFLOW
# Tạo phiếu thanh toán → Xử lý → Kiểm tra
# =============================================
Write-TestHeader "💰 SCENARIO 2: PAYMENT BATCH WORKFLOW"

$paymentBatchId = $null

# Step 2.1: Check supplier payables
Write-Step "2.1" "Kiểm tra công nợ nhà cung cấp"
try {
    $payables = Invoke-RestMethod -Uri "$baseUrl/supplier-payable/summary" -Headers $headers
    Write-Success "Lấy thông tin công nợ thành công!"
    Write-Info "Tổng công nợ: $($payables.totalPayable) VND"
    Write-Info "Số NCC: $($payables.supplierCount)"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 2.2: Get suppliers list
Write-Step "2.2" "Lấy danh sách nhà cung cấp"
try {
    $suppliers = Invoke-RestMethod -Uri "$baseUrl/suppliers" -Headers $headers
    $supplierCount = if ($suppliers -is [array]) { $suppliers.Count } else { 1 }
    Write-Success "Có $supplierCount nhà cung cấp"
    
    if ($suppliers -is [array] -and $suppliers.Count -gt 0) {
        foreach ($sup in $suppliers[0..2]) {
            Write-Info "  - $($sup.name) ($($sup.code))"
        }
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 2.3: Create supplier payment batch
Write-Step "2.3" "Tạo phiếu thanh toán cho NCC"
try {
    $batchBody = @{
        type = "supplier"
        supplierId = "test-supplier-1"
        description = "Thanh toán NCC - Test $(Get-Date -Format 'yyyyMMdd-HHmmss')"
        amount = 5000000
        paymentMethod = "bank_transfer"
        notes = "Phiếu test vận hành"
    } | ConvertTo-Json
    
    $newBatch = Invoke-RestMethod -Uri "$baseUrl/payment-batches" -Method Post -Headers $headers -Body $batchBody
    $paymentBatchId = $newBatch._id
    Write-Success "Tạo phiếu thanh toán thành công!"
    Write-Info "Batch ID: $paymentBatchId"
    Write-Info "Số tiền: $($newBatch.amount) VND"
} catch {
    Write-Fail "Lỗi tạo phiếu: $_"
}

# Step 2.4: Check available funds
Write-Step "2.4" "Kiểm tra quỹ khả dụng"
try {
    $funds = Invoke-RestMethod -Uri "$baseUrl/capital-management/available-funds" -Headers $headers
    Write-Success "Lấy thông tin quỹ thành công!"
    Write-Info "Quỹ khả dụng: $($funds.availableFunds) VND"
    Write-Info "Tổng vốn: $($funds.totalCapital) VND"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 2.5: Check cashflow health
Write-Step "2.5" "Kiểm tra sức khỏe dòng tiền"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/capital-management/cashflow-health" -Headers $headers
    Write-Success "Lấy thông tin sức khỏe tài chính!"
    Write-Info "Cash Safety Index: $($health.cashSafetyIndex)"
    Write-Info "Days Sales Outstanding: $($health.dso)"
    Write-Info "Days Payable Outstanding: $($health.dpo)"
} catch {
    Write-Fail "Lỗi: $_"
}

# =============================================
# SCENARIO 3: PRODUCT MANAGEMENT
# Tạo sản phẩm → Cập nhật → Kiểm tra tồn kho
# =============================================
Write-TestHeader "📱 SCENARIO 3: PRODUCT MANAGEMENT"

$productId = $null

# Step 3.1: Get product categories
Write-Step "3.1" "Lấy danh mục sản phẩm"
try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Headers $headers
    $catCount = if ($categories -is [array]) { $categories.Count } else { 1 }
    Write-Success "Có $catCount danh mục"
    
    $firstCatId = $null
    if ($categories -is [array] -and $categories.Count -gt 0) {
        $firstCatId = $categories[0]._id
        foreach ($cat in $categories[0..2]) {
            Write-Info "  - $($cat.name) ($($cat.code))"
        }
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 3.2: Create new product
Write-Step "3.2" "Tạo sản phẩm mới"
try {
    $productBody = @{
        name = "Sản phẩm Test $(Get-Date -Format 'HHmmss')"
        sku = "SKU-TEST-$(Get-Date -Format 'yyyyMMddHHmmss')"
        price = 299000
        cost = 150000
        stock = 100
        categoryId = $firstCatId
        description = "Sản phẩm test vận hành hệ thống"
        isActive = $true
    } | ConvertTo-Json
    
    $newProduct = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $productBody
    $productId = $newProduct._id
    Write-Success "Tạo sản phẩm thành công!"
    Write-Info "Product ID: $productId"
    Write-Info "Tên: $($newProduct.name)"
    Write-Info "Giá bán: $($newProduct.price) VND"
    Write-Info "Giá vốn: $($newProduct.cost) VND"
} catch {
    Write-Fail "Lỗi tạo sản phẩm: $_"
}

# Step 3.3: Update product stock
if ($productId) {
    Write-Step "3.3" "Cập nhật tồn kho sản phẩm"
    try {
        $updateBody = @{
            stock = 150
            notes = "Nhập thêm 50 sản phẩm - $(Get-Date -Format 'HH:mm:ss')"
        } | ConvertTo-Json
        
        $updatedProduct = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Cập nhật tồn kho thành công!"
        Write-Info "Tồn kho mới: $($updatedProduct.stock)"
    } catch {
        Write-Fail "Lỗi cập nhật: $_"
    }
}

# Step 3.4: Get product details
if ($productId) {
    Write-Step "3.4" "Xem chi tiết sản phẩm"
    try {
        $productDetails = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Headers $headers
        Write-Success "Lấy chi tiết sản phẩm!"
        Write-Info "Tên: $($productDetails.name)"
        Write-Info "SKU: $($productDetails.sku)"
        Write-Info "Giá: $($productDetails.price) VND"
        Write-Info "Tồn kho: $($productDetails.stock)"
    } catch {
        Write-Fail "Lỗi: $_"
    }
}

# =============================================
# SCENARIO 4: BUDGET ALLOCATION FOR ADS
# Phân bổ ngân sách quảng cáo
# =============================================
Write-TestHeader "💸 SCENARIO 4: BUDGET ALLOCATION"

# Step 4.1: Get current budget allocation
Write-Step "4.1" "Xem phân bổ ngân sách hiện tại"
try {
    $budget = Invoke-RestMethod -Uri "$baseUrl/budget-allocation" -Headers $headers
    Write-Success "Lấy thông tin phân bổ ngân sách!"
    Write-Info "Data: $($budget | ConvertTo-Json -Compress)"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 4.2: Preview budget allocation
Write-Step "4.2" "Xem preview phân bổ ngân sách"
try {
    $previewUrl = "$baseUrl/budget-allocation/preview?totalBudget=50000000" + "&" + "mode=moderate"
    $preview = Invoke-RestMethod -Uri $previewUrl -Headers $headers
    Write-Success "Lấy preview phân bổ!"
    if ($preview.recommendations) {
        Write-Info "Số lượng gợi ý: $($preview.recommendations.Count)"
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 4.3: Check Employee Ads KPI
Write-Step "4.3" "Kiểm tra KPI quảng cáo nhân viên"
try {
    $fromDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $kpiUrl = "$baseUrl/employee-ads-kpi?fromDate=$fromDate" + "&" + "toDate=$toDate"
    $kpi = Invoke-RestMethod -Uri $kpiUrl -Headers $headers
    Write-Success "Lấy thông tin KPI!"
    Write-Info "Data: $($kpi | ConvertTo-Json -Compress)"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 4.4: Check capital allocation settings
Write-Step "4.4" "Kiểm tra cài đặt phân bổ vốn"
try {
    $allocation = Invoke-RestMethod -Uri "$baseUrl/capital-management/allocation" -Headers $headers
    Write-Success "Lấy cài đặt phân bổ vốn!"
    if ($allocation.businessFund) {
        Write-Info "Quỹ kinh doanh: $($allocation.businessFund)%"
    }
    if ($allocation.adsFund) {
        Write-Info "Quỹ quảng cáo: $($allocation.adsFund)%"
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# =============================================
# SCENARIO 5: REPORTING
# Xem các báo cáo quan trọng
# =============================================
Write-TestHeader "📊 SCENARIO 5: REPORTING"

# Step 5.1: Return report
Write-Step "5.1" "Báo cáo hoàn trả"
try {
    $returnReport = Invoke-RestMethod -Uri "$baseUrl/reports/return-report" -Headers $headers
    Write-Success "Lấy báo cáo hoàn trả!"
    Write-Info "Tổng hoàn trả: $($returnReport.totalReturns)"
    Write-Info "Tổng giá trị: $($returnReport.totalAmount) VND"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 5.2: Ad Group Daily Report
Write-Step "5.2" "Báo cáo nhóm quảng cáo theo ngày"
try {
    $fromDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $adReportUrl = "$baseUrl/reports/ad-group-daily?fromDate=$fromDate" + "&" + "toDate=$toDate"
    $adReport = Invoke-RestMethod -Uri $adReportUrl -Headers $headers
    Write-Success "Lấy báo cáo quảng cáo!"
    $reportCount = if ($adReport -is [array]) { $adReport.Count } else { 1 }
    Write-Info "Số báo cáo: $reportCount"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 5.3: Agent receivables
Write-Step "5.3" "Công nợ đại lý"
try {
    $receivables = Invoke-RestMethod -Uri "$baseUrl/agent-receivable/summary" -Headers $headers
    Write-Success "Lấy thông tin công nợ đại lý!"
    Write-Info "Tổng phải thu: $($receivables.totalReceivable) VND"
} catch {
    Write-Fail "Lỗi: $_"
}

# =============================================
# SCENARIO 6: USER MANAGEMENT
# Quản lý người dùng và phân quyền
# =============================================
Write-TestHeader "👥 SCENARIO 6: USER MANAGEMENT"

# Step 6.1: Get all users
Write-Step "6.1" "Lấy danh sách người dùng"
try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Headers $headers
    $userCount = if ($users -is [array]) { $users.Count } else { 1 }
    Write-Success "Có $userCount người dùng"
    
    if ($users -is [array]) {
        $roleGroups = $users | Group-Object -Property { if ($_.role) { $_.role } else { $_.userType } }
        foreach ($group in $roleGroups) {
            Write-Info "  - $($group.Name): $($group.Count) người"
        }
    }
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 6.2: Create test employee
Write-Step "6.2" "Tạo nhân viên test"
try {
    $userBody = @{
        email = "employee-test-$(Get-Date -Format 'HHmmss')@test.com"
        password = "123456"
        name = "Nhân viên Test $(Get-Date -Format 'HHmmss')"
        role = "employee"
        userType = "employee"
        phone = "0909$(Get-Random -Minimum 100000 -Maximum 999999)"
        isActive = $true
    } | ConvertTo-Json
    
    $newUser = Invoke-RestMethod -Uri "$baseUrl/users" -Method Post -Headers $headers -Body $userBody
    Write-Success "Tạo nhân viên thành công!"
    Write-Info "ID: $($newUser._id)"
    Write-Info "Email: $($newUser.email)"
    Write-Info "Vai trò: $($newUser.role)"
} catch {
    Write-Fail "Lỗi tạo user: $_"
}

# =============================================
# SCENARIO 7: CHAT/MESSENGER INTEGRATION
# Tích hợp chat/messenger
# =============================================
Write-TestHeader "💬 SCENARIO 7: CHAT INTEGRATION"

# Step 7.1: Get conversations
Write-Step "7.1" "Lấy danh sách cuộc hội thoại"
try {
    $conversations = Invoke-RestMethod -Uri "$baseUrl/chat/conversations" -Headers $headers
    $convCount = if ($conversations -is [array]) { $conversations.Count } else { 0 }
    Write-Success "Có $convCount cuộc hội thoại"
} catch {
    Write-Fail "Lỗi: $_"
}

# Step 7.2: Get messenger pages
Write-Step "7.2" "Lấy danh sách Facebook Pages"
try {
    $pages = Invoke-RestMethod -Uri "$baseUrl/messenger-integration/pages" -Headers $headers
    $pageCount = if ($pages -is [array]) { $pages.Count } else { 0 }
    Write-Success "Có $pageCount Facebook Pages"
} catch {
    Write-Fail "Lỗi: $_"
}

# =============================================
# CLEANUP (Optional)
# =============================================
Write-TestHeader "🧹 CLEANUP"

# Step: Delete test product
if ($productId) {
    Write-Step "C.1" "Xóa sản phẩm test"
    try {
        Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Delete -Headers $headers
        Write-Success "Đã xóa sản phẩm test!"
    } catch {
        Write-Info "Không thể xóa hoặc đã xóa: $_"
    }
}

# =============================================
# SUMMARY
# =============================================
Write-TestHeader "📋 TEST SUMMARY"

Write-Host ""
Write-Host "🎯 CAC TINH HUONG DA TEST:" -ForegroundColor White
Write-Host ""
Write-Host "1. ORDER LIFECYCLE (Vong doi don hang)" -ForegroundColor White
Write-Host "   + Lay san pham" -ForegroundColor Gray
Write-Host "   + Lay trang thai giao hang" -ForegroundColor Gray
Write-Host "   + Tao don hang" -ForegroundColor Gray
Write-Host "   + Cap nhat trang thai" -ForegroundColor Gray
Write-Host "   + Xem chi tiet don" -ForegroundColor Gray
Write-Host ""
Write-Host "2. PAYMENT BATCH (Xu ly thanh toan)" -ForegroundColor White
Write-Host "   + Kiem tra cong no NCC" -ForegroundColor Gray
Write-Host "   + Lay danh sach NCC" -ForegroundColor Gray
Write-Host "   + Tao phieu thanh toan" -ForegroundColor Gray
Write-Host "   + Kiem tra quy kha dung" -ForegroundColor Gray
Write-Host "   + Kiem tra suc khoe tai chinh" -ForegroundColor Gray
Write-Host ""
Write-Host "3. PRODUCT MANAGEMENT (Quan ly san pham)" -ForegroundColor White
Write-Host "   + Lay danh muc" -ForegroundColor Gray
Write-Host "   + Tao san pham" -ForegroundColor Gray
Write-Host "   + Cap nhat ton kho" -ForegroundColor Gray
Write-Host "   + Xem chi tiet" -ForegroundColor Gray
Write-Host ""
Write-Host "4. BUDGET ALLOCATION (Phan bo ngan sach)" -ForegroundColor White
Write-Host "   + Xem phan bo hien tai" -ForegroundColor Gray
Write-Host "   + Preview phan bo" -ForegroundColor Gray
Write-Host "   + Kiem tra KPI" -ForegroundColor Gray
Write-Host "   + Cai dat phan bo von" -ForegroundColor Gray
Write-Host ""
Write-Host "5. REPORTING (Bao cao)" -ForegroundColor White
Write-Host "   + Bao cao hoan tra" -ForegroundColor Gray
Write-Host "   + Bao cao quang cao" -ForegroundColor Gray
Write-Host "   + Cong no dai ly" -ForegroundColor Gray
Write-Host ""
Write-Host "6. USER MANAGEMENT (Quan ly nguoi dung)" -ForegroundColor White
Write-Host "   + Danh sach nguoi dung" -ForegroundColor Gray
Write-Host "   + Tao nhan vien moi" -ForegroundColor Gray
Write-Host ""
Write-Host "7. CHAT INTEGRATION (Tich hop chat)" -ForegroundColor White
Write-Host "   + Cuoc hoi thoai" -ForegroundColor Gray
Write-Host "   + Facebook Pages" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ OPERATIONAL SCENARIOS TEST COMPLETED!" -ForegroundColor Green
Write-Host "Thoi gian: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
