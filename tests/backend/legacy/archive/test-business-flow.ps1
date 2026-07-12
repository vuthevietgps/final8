# =============================================
# BUSINESS FLOW TEST - Test kich ban nghiep vu thuc te
# =============================================

# Force UTF-8 encoding for proper Vietnamese text
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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

function Write-Money($label, $amount) {
    $formatted = "{0:N0}" -f $amount
    Write-Host "  $label $formatted VND" -ForegroundColor White
}

# === LOGIN ===
Write-TestHeader "DANG NHAP HE THONG"

try {
    $loginBody = @{
        email = "director@test.com"
        password = "123456"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json; charset=utf-8"
    $token = $loginResponse.access_token
    Write-Success "Dang nhap thanh cong voi quyen Director!"
} catch {
    Write-Fail "Dang nhap that bai: $_"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json; charset=utf-8"
}

# =============================================
# KICH BAN 1: TAO SAN PHAM MOI VOI GIA BAN/GIA VON
# =============================================
Write-TestHeader "KICH BAN 1: TAO SAN PHAM MOI"

$productId = $null
$productName = "Ao Thun Test $(Get-Date -Format 'HHmmss')"
$sellingPrice = 350000
$costPrice = 180000

Write-Step "1.1" "Lay danh muc san pham"
$categoryId = $null
try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Headers $headers
    if ($categories -is [array] -and $categories.Count -gt 0) {
        $categoryId = $categories[0]._id
        Write-Success "Danh muc: $($categories[0].name)"
    }
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "1.2" "Tao san pham moi: $productName"
Write-Info "Gia ban: $sellingPrice VND"
Write-Info "Gia von (du kien): $costPrice VND"
Write-Info "Loi nhuan du kien: $($sellingPrice - $costPrice) VND ($(([math]::Round(($sellingPrice - $costPrice) / $sellingPrice * 100, 1)))%)"

try {
    $productBody = @{
        name = $productName
        categoryId = $categoryId
    } | ConvertTo-Json
    
    $newProduct = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $productBody
    $productId = $newProduct._id
    Write-Success "San pham da tao! ID: $productId"
} catch {
    Write-Fail "Loi tao san pham: $_"
}

# =============================================
# KICH BAN 2: TAO BAO GIA NHA CUNG CAP
# =============================================
Write-TestHeader "KICH BAN 2: TAO BAO GIA NHA CUNG CAP"

$supplierId = $null
$supplierQuoteId = $null

Write-Step "2.1" "Lay danh sach nha cung cap"
try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Headers $headers
    $suppliers = $users | Where-Object { $_.role -eq "internal_supplier" -or $_.role -eq "external_supplier" }
    if ($suppliers.Count -gt 0) {
        $supplier = $suppliers[0]
        $supplierId = $supplier._id
        Write-Success "NCC: $($supplier.fullName) ($($supplier.email))"
    } else {
        Write-Info "Khong co NCC, se tao moi"
    }
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "2.2" "Tao bao gia NCC cho san pham"
Write-Info "Gia nhap tu NCC: $costPrice VND"

try {
    $quoteBody = @{
        productId = $productId
        supplierId = $supplierId
        price = $costPrice
    } | ConvertTo-Json
    
    $supplierQuote = Invoke-RestMethod -Uri "$baseUrl/supplier-quotes" -Method Post -Headers $headers -Body $quoteBody
    $supplierQuoteId = $supplierQuote._id
    Write-Success "Bao gia NCC da tao!"
    Write-Money "Gia nhap:" $costPrice
} catch {
    Write-Fail "Loi tao bao gia NCC: $_"
}

# =============================================
# KICH BAN 3: TAO BAO GIA DAI LY
# =============================================
Write-TestHeader "KICH BAN 3: TAO BAO GIA DAI LY"

$agentId = $null
$agentQuoteId = $null
$agentPrice = 320000  # Gia ban cho dai ly (thap hon gia le)

Write-Step "3.1" "Lay danh sach dai ly"
try {
    $agents = $users | Where-Object { $_.role -eq "internal_agent" -or $_.role -eq "external_agent" }
    if ($agents.Count -gt 0) {
        $agent = $agents[0]
        $agentId = $agent._id
        Write-Success "Dai ly: $($agent.fullName) ($($agent.email))"
    }
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "3.2" "Tao bao gia cho dai ly"
Write-Info "Gia ban cho dai ly: $agentPrice VND"
Write-Info "Loi nhuan/SP khi ban qua dai ly: $($agentPrice - $costPrice) VND"

try {
    $validFrom = (Get-Date).ToString("yyyy-MM-dd")
    $validUntil = (Get-Date).AddMonths(3).ToString("yyyy-MM-dd")
    $quoteBody = @{
        productId = $productId
        agentId = $agentId
        unitPrice = $agentPrice
        status = "approved"
        validFrom = $validFrom
        validUntil = $validUntil
    } | ConvertTo-Json -Depth 10
    
    $agentQuote = Invoke-RestMethod -Uri "$baseUrl/quotes" -Method Post -Headers $headers -Body $quoteBody
    $agentQuoteId = $agentQuote._id
    Write-Success "Bao gia dai ly da tao! ID: $agentQuoteId"
    Write-Money "Gia ban dai ly:" $agentPrice
} catch {
    Write-Fail "Loi tao bao gia dai ly: $_"
}

# =============================================
# KICH BAN 4: TAO DON HANG
# =============================================
Write-TestHeader "KICH BAN 4: TAO DON HANG TU DAI LY"

$orderId = $null
$quantity = 3
$shippingFee = 30000
$depositAmount = 100000
$codAmount = ($agentPrice * $quantity) + $shippingFee - $depositAmount

Write-Step "4.1" "Thong tin don hang"
Write-Info "San pham: $productName"
Write-Info "So luong: $quantity"
Write-Info "Don gia: $agentPrice VND"
Write-Money "Tong tien hang:" ($agentPrice * $quantity)
Write-Money "Phi van chuyen:" $shippingFee
Write-Money "Dat coc:" $depositAmount
Write-Money "COD can thu:" $codAmount

Write-Step "4.2" "Tao don hang"
try {
    # Dung dung field names tu CreateTestOrder2Dto
    $orderBody = @{
        productId = $productId
        agentId = $agentId
        customerName = "Nguyen Van Test"
        receiverPhone = "0901234567"
        receiverAddress = "123 Duong ABC, Quan 1, TP.HCM"
        receiverName = "Nguyen Van Test"
        quantity = $quantity
        agentQuote = $agentPrice
        depositAmount = $depositAmount
        codAmount = $codAmount
        shippingFee = $shippingFee
        orderDate = (Get-Date).ToString("yyyy-MM-dd")
        supplierId = $supplierId
        supplierQuote = $costPrice
    } | ConvertTo-Json
    
    $newOrder = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Method Post -Headers $headers -Body $orderBody
    $orderId = $newOrder._id
    Write-Success "Don hang da tao! ID: $orderId"
    Write-Info "Ma don: $($newOrder.orderCode)"
} catch {
    Write-Fail "Loi tao don: $_"
    
    # Thu lay don co san
    try {
        $orders = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Headers $headers
        if ($orders.data -and $orders.data.Count -gt 0) {
            $orderId = $orders.data[0]._id
            Write-Info "Su dung don co san: $orderId"
        }
    } catch {}
}

# =============================================
# KICH BAN 5: CAP NHAT TRANG THAI GIAO HANG
# =============================================
Write-TestHeader "KICH BAN 5: CAP NHAT TRANG THAI GIAO HANG"

if ($orderId) {
    # Buoc 1: Cho xu ly
    Write-Step "5.1" "Trang thai: CHO XU LY -> DANG XU LY"
    try {
        $updateBody = @{ productionStatus = "dang_xu_ly" } | ConvertTo-Json
        $updated = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId/delivery-status" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat: DANG XU LY"
    } catch {
        Write-Fail "Loi: $_"
    }

    # Buoc 2: Da giao cho van chuyen
    Write-Step "5.2" "Trang thai: DANG XU LY -> DA GIAO VAN CHUYEN"
    try {
        $updateBody = @{ deliveryStatus = "da_gui" } | ConvertTo-Json
        $updated = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId/delivery-status" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat: DA GIAO VAN CHUYEN"
    } catch {
        Write-Fail "Loi: $_"
    }

    # Buoc 3: Dang giao
    Write-Step "5.3" "Trang thai: DA GIAO VAN CHUYEN -> DANG GIAO"
    try {
        $updateBody = @{ deliveryStatus = "dang_giao" } | ConvertTo-Json
        $updated = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId/delivery-status" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat: DANG GIAO"
    } catch {
        Write-Fail "Loi: $_"
    }

    # Buoc 4: Giao thanh cong - dung dung enum value
    Write-Step "5.4" "Trang thai: DANG GIAO -> GIAO THANH CONG"
    try {
        $updateBody = @{ 
            deliveryStatus = "da_giao"
            orderStatus = "Giao thành công"
        } | ConvertTo-Json
        $updated = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId/delivery-status" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat: GIAO THANH CONG"
    } catch {
        Write-Fail "Loi: $_"
    }
}

# =============================================
# KICH BAN 6: KIEM TRA LOI NHUAN DON HANG
# =============================================
Write-TestHeader "KICH BAN 6: KIEM TRA LOI NHUAN"

if ($orderId) {
    Write-Step "6.1" "Lay chi tiet don hang de kiem tra loi nhuan"
    try {
        $orderDetail = Invoke-RestMethod -Uri "$baseUrl/test-order2/$orderId" -Headers $headers
        Write-Success "Chi tiet don hang:"
        
        # Dung agentQuote thay vi quoteAmount
        $unitPrice = if ($orderDetail.agentQuote) { $orderDetail.agentQuote } else { $agentPrice }
        $qty = if ($orderDetail.quantity) { $orderDetail.quantity } else { $quantity }
        $revenue = $unitPrice * $qty
        
        $supplierCost = if ($orderDetail.supplierQuote) { $orderDetail.supplierQuote * $qty } else { $costPrice * $qty }
        $shipFee = if ($orderDetail.shippingFee) { $orderDetail.shippingFee } else { $shippingFee }
        $profit = $revenue - $supplierCost - $shipFee
        
        Write-Money "Doanh thu (agentQuote x qty):" $revenue
        Write-Money "Gia von NCC (supplierQuote x qty):" $supplierCost
        Write-Money "Phi van chuyen:" $shipFee
        Write-Host "  ----------------------------" -ForegroundColor Gray
        Write-Money "LOI NHUAN TINH TOAN:" $profit
        
        if ($orderDetail.grossProfit) {
            Write-Money "Loi nhuan gop (he thong):" $orderDetail.grossProfit
        }
        if ($orderDetail.netProfit) {
            Write-Money "Loi nhuan rong (he thong):" $orderDetail.netProfit
        }
    } catch {
        Write-Fail "Loi: $_"
    }
}

# =============================================
# KICH BAN 7: KIEM TRA CONG NO NHA CUNG CAP
# =============================================
Write-TestHeader "KICH BAN 7: CONG NO NHA CUNG CAP"

Write-Step "7.1" "Kiem tra don cho thanh toan NCC"
try {
    $pendingSupplier = Invoke-RestMethod -Uri "$baseUrl/test-order2/payment-pending/supplier" -Headers $headers
    $pendingCount = if ($pendingSupplier.data) { $pendingSupplier.data.Count } elseif ($pendingSupplier -is [array]) { $pendingSupplier.Count } else { 0 }
    Write-Success "Don cho thanh toan NCC: $pendingCount don"
    
    if ($pendingCount -gt 0) {
        $totalOwed = 0
        $items = if ($pendingSupplier.data) { $pendingSupplier.data } else { $pendingSupplier }
        foreach ($o in $items[0..([Math]::Min(2, $items.Count-1))]) {
            if ($o.supplierCost) { $totalOwed += $o.supplierCost }
        }
        Write-Money "Tong no NCC (3 don dau):" $totalOwed
    }
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "7.2" "Tao phieu thanh toan NCC"
try {
    # Lay don hang vua tao de tao batch
    $batchCode = "SUPP-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    $batchBody = @{
        orderIds = @($orderId)
        batchId = $batchCode
        paidDate = (Get-Date).ToString("yyyy-MM-dd")
        note = "Thanh toan NCC - Test"
    } | ConvertTo-Json
    
    $batch = Invoke-RestMethod -Uri "$baseUrl/test-order2/supplier-payment-batch" -Method Post -Headers $headers -Body $batchBody
    Write-Success "Phieu thanh toan da tao!"
    Write-Info "Ma phieu: $batchCode"
    Write-Info "So don: 1"
} catch {
    Write-Fail "Loi tao phieu thanh toan: $_"
}

# =============================================
# KICH BAN 8: KIEM TRA CONG NO DAI LY
# =============================================
Write-TestHeader "KICH BAN 8: CONG NO DAI LY"

Write-Step "8.1" "Kiem tra don cho thanh toan dai ly"
try {
    $pendingAgent = Invoke-RestMethod -Uri "$baseUrl/test-order2/payment-pending/agent" -Headers $headers
    $pendingCount = if ($pendingAgent.data) { $pendingAgent.data.Count } elseif ($pendingAgent -is [array]) { $pendingAgent.Count } else { 0 }
    Write-Success "Don cho thanh toan dai ly: $pendingCount don"
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "8.2" "Tong hop cong no dai ly"
try {
    $summary = Invoke-RestMethod -Uri "$baseUrl/agent-receivables/summary" -Headers $headers
    Write-Success "Thong tin cong no dai ly:"
    
    if ($summary.totals) {
        Write-Money "Tong phai thu:" $summary.totals.receivableAmount
        Write-Money "Da thu:" $summary.totals.collectedAmount
        Write-Info "Tong don: $($summary.totals.totalOrders)"
    }
} catch {
    Write-Fail "Loi: $_"
}

# =============================================
# KICH BAN 9: BAO CAO TAI CHINH
# =============================================
Write-TestHeader "KICH BAN 9: BAO CAO TAI CHINH"

Write-Step "9.1" "Tong hop tai chinh"
try {
    $finance = Invoke-RestMethod -Uri "$baseUrl/finance/summary" -Headers $headers
    Write-Success "Bao cao tai chinh:"
    Write-Money "Tong thu:" $finance.totalIn
    Write-Money "Tong chi:" $finance.totalOut
    Write-Money "Rong:" $finance.net
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "9.2" "Suc khoe dong tien"
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/finance/cashflow-health" -Headers $headers
    Write-Success "Chi so suc khoe:"
    Write-Info "Cash Safety Index: $($health.cashSafetyIndex)"
    Write-Info "DSO (ngay thu tien TB): $($health.dso) ngay"
    Write-Info "DPO (ngay tra tien TB): $($health.dpo) ngay"
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "9.3" "Bao cao hoan tra theo san pham"
try {
    $returns = Invoke-RestMethod -Uri "$baseUrl/return-report/product" -Headers $headers
    $returnCount = if ($returns -is [array]) { $returns.Count } else { 0 }
    Write-Success "Bao cao hoan tra: $returnCount san pham co hoan"
    
    if ($returnCount -gt 0 -and $returns[0]) {
        Write-Info "San pham hoan nhieu nhat: $($returns[0].productName)"
        Write-Info "So don hoan: $($returns[0].returnCount)"
    }
} catch {
    Write-Fail "Loi: $_"
}

# =============================================
# KICH BAN 10: PHAN BO NGAN SACH QUANG CAO
# =============================================
Write-TestHeader "KICH BAN 10: NGAN SACH QUANG CAO"

Write-Step "10.1" "Trang thai phan bo ngan sach"
try {
    $budget = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/status" -Headers $headers
    Write-Success "Trang thai phan bo:"
    if ($budget.lastAllocation) {
        Write-Info "Lan phan bo cuoi: $($budget.lastAllocation)"
    }
    if ($budget.totalBudget) {
        Write-Money "Tong ngan sach:" $budget.totalBudget
    }
} catch {
    Write-Fail "Loi: $_"
}

Write-Step "10.2" "KPI nhan vien quang cao"
try {
    $fromDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $kpi = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi?fromDate=$fromDate`&toDate=$toDate" -Headers $headers
    Write-Success "KPI nhan vien ads:"
    
    if ($kpi -is [array] -and $kpi.Count -gt 0) {
        foreach ($emp in $kpi[0..([Math]::Min(2, $kpi.Count-1))]) {
            Write-Info "- $($emp.employeeName): $($emp.profitableGroups) nhom lai"
        }
    } else {
        Write-Info "Chua co du lieu KPI"
    }
} catch {
    Write-Fail "Loi: $_"
}

# =============================================
# CLEANUP (Optional)
# =============================================
Write-TestHeader "DON DEP (TUY CHON)"

if ($productId) {
    Write-Step "C.1" "Xoa san pham test"
    try {
        Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Delete -Headers $headers
        Write-Success "Da xoa san pham test!"
    } catch {
        Write-Info "Khong the xoa: $_"
    }
}

# =============================================
# TONG KET
# =============================================
Write-TestHeader "TONG KET KICH BAN NGHIEP VU"

Write-Host ""
Write-Host "DA TEST CAC KICH BAN:" -ForegroundColor White
Write-Host ""
Write-Host "1. TAO SAN PHAM MOI" -ForegroundColor Green
Write-Host "   - Tao san pham voi ten, danh muc" -ForegroundColor Gray
Write-Host "   - Tinh toan loi nhuan du kien" -ForegroundColor Gray
Write-Host ""
Write-Host "2. TAO BAO GIA NHA CUNG CAP" -ForegroundColor Green
Write-Host "   - Chon NCC, tao bao gia voi gia nhap" -ForegroundColor Gray
Write-Host ""
Write-Host "3. TAO BAO GIA DAI LY" -ForegroundColor Green
Write-Host "   - Chon dai ly, tao bao gia ban" -ForegroundColor Gray
Write-Host ""
Write-Host "4. TAO DON HANG" -ForegroundColor Green
Write-Host "   - Don hang day du: san pham, so luong, gia, phi ship, COD" -ForegroundColor Gray
Write-Host ""
Write-Host "5. CAP NHAT TRANG THAI GIAO HANG" -ForegroundColor Green
Write-Host "   - Luong: Cho xu ly -> Dang xu ly -> Da gui -> Dang giao -> Thanh cong" -ForegroundColor Gray
Write-Host ""
Write-Host "6. KIEM TRA LOI NHUAN" -ForegroundColor Green
Write-Host "   - Doanh thu, gia von, chi phi, loi nhuan thuc" -ForegroundColor Gray
Write-Host ""
Write-Host "7. CONG NO NHA CUNG CAP" -ForegroundColor Green
Write-Host "   - Don cho thanh toan, tao phieu thanh toan" -ForegroundColor Gray
Write-Host ""
Write-Host "8. CONG NO DAI LY" -ForegroundColor Green
Write-Host "   - Don cho thu tien, tong hop cong no" -ForegroundColor Gray
Write-Host ""
Write-Host "9. BAO CAO TAI CHINH" -ForegroundColor Green
Write-Host "   - Thu chi, suc khoe dong tien, bao cao hoan tra" -ForegroundColor Gray
Write-Host ""
Write-Host "10. NGAN SACH QUANG CAO" -ForegroundColor Green
Write-Host "    - Trang thai phan bo, KPI nhan vien" -ForegroundColor Gray
Write-Host ""

Write-Host "HOAN THANH TEST KICH BAN NGHIEP VU!" -ForegroundColor Green
Write-Host "Thoi gian: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
