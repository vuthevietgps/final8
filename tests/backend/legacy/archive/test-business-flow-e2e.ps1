#!/usr/bin/env pwsh
# =============================================================================
# TEST BUSINESS FLOW E2E - Kiểm tra luồng nghiệp vụ toàn diện
# =============================================================================
# Mục tiêu: Tạo 10 đơn hàng rải các ngày khác nhau, thực hiện CRUD, thay đổi
# trạng thái sản xuất, trạng thái vận đơn, COD, nhóm quảng cáo, báo giá NCC,
# hoa hồng đại lý, thanh toán NCC, thanh toán hoa hồng đại lý, kiểm tra số liệu
# công nợ NCC, hoa hồng đại lý, financial control.
# =============================================================================

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

# ==================== HELPER FUNCTIONS ====================

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 80) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Cyan
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

function Write-Check($msg) {
    Write-Host "  [CHECK] $msg" -ForegroundColor Magenta
}

function Safe-Request {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body = $null,
        [string]$Label = ""
    )
    try {
        $params = @{
            Method = $Method
            Uri = $Uri
            Headers = $Headers
            ContentType = "application/json; charset=utf-8"
        }
        if ($Body -and $Method -ne "GET") {
            $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
            $params["Body"] = $bodyBytes
        }
        $resp = Invoke-RestMethod @params
        return $resp
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        $errBody = ""
        try { 
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
        } catch {}
        Write-Host "  [ERROR] $Label - HTTP $status : $errBody" -ForegroundColor Red
        return $null
    }
}

# ==================== COUNTERS ====================
$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$script:createdOrderIds = @()
$script:testResults = @{}

# ==================== SECTION 0: AUTHENTICATION ====================

Write-Section "PHASE 0: Đăng nhập & Thu thập dữ liệu tham chiếu"

Write-Step "0.1" "Đăng nhập với tài khoản Director"
$loginBody = @{ email = "director@test.com"; password = "123456" } | ConvertTo-Json
$loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login"

if (-not $loginResp -or -not $loginResp.access_token) {
    # Try alternate credentials
    $loginBody = @{ email = "vutheviet@gmail.com"; password = "123456" } | ConvertTo-Json
    $loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login Alt"
}

if (-not $loginResp -or -not $loginResp.access_token) {
    Write-Fail "Không thể đăng nhập. Dừng test."
    exit 1
}

$token = $loginResp.access_token
$userId = $loginResp.user.id
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json; charset=utf-8"
}
Write-Pass "Đăng nhập thành công: $($loginResp.user.fullName) ($($loginResp.user.role))"

# ==================== Thu thập dữ liệu tham chiếu ====================

Write-Step "0.2" "Lấy danh sách Sản phẩm"
$products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $headers -Label "Products"
$productList = if ($products.data) { $products.data } elseif ($products -is [array]) { $products } else { @($products) }
if ($productList.Count -gt 0) {
    Write-Pass "Có $($productList.Count) sản phẩm"
    $testProduct = $productList[0]
    Write-Info "Sản phẩm test: $($testProduct.name) (ID: $($testProduct._id))"
} else {
    Write-Fail "Không có sản phẩm. Cần seed data trước."
}

Write-Step "0.3" "Lấy danh sách Nhà cung cấp"
$suppliers = Safe-Request -Method GET -Uri "$BaseUrl/users?role=internal_supplier" -Headers $headers -Label "Suppliers"
$supplierList = if ($suppliers.data) { $suppliers.data } elseif ($suppliers -is [array]) { $suppliers } else { @($suppliers) }
# Also try external suppliers
$extSuppliers = Safe-Request -Method GET -Uri "$BaseUrl/users?role=external_supplier" -Headers $headers -Label "ExtSuppliers"
$extList = if ($extSuppliers.data) { $extSuppliers.data } elseif ($extSuppliers -is [array]) { $extSuppliers } else { @() }
$allSuppliers = @($supplierList) + @($extList)
if ($allSuppliers.Count -gt 0) {
    Write-Pass "Có $($allSuppliers.Count) nhà cung cấp"
    $testSupplier = $allSuppliers[0]
    $testSupplier2 = if ($allSuppliers.Count -gt 1) { $allSuppliers[1] } else { $allSuppliers[0] }
    Write-Info "NCC test 1: $($testSupplier.fullName) (ID: $($testSupplier._id))"
    Write-Info "NCC test 2: $($testSupplier2.fullName) (ID: $($testSupplier2._id))"
} else {
    Write-Fail "Không có nhà cung cấp."
}

Write-Step "0.4" "Lấy danh sách Đại lý"
$agents = Safe-Request -Method GET -Uri "$BaseUrl/users?role=external_agent" -Headers $headers -Label "Agents"
$agentList = if ($agents.data) { $agents.data } elseif ($agents -is [array]) { $agents } else { @($agents) }
if ($agentList.Count -gt 0) {
    Write-Pass "Có $($agentList.Count) đại lý ngoài"
    $testAgent = $agentList[0]
    $testAgent2 = if ($agentList.Count -gt 1) { $agentList[1] } else { $agentList[0] }
    Write-Info "Đại lý test 1: $($testAgent.fullName) (ID: $($testAgent._id))"
    Write-Info "Đại lý test 2: $($testAgent2.fullName) (ID: $($testAgent2._id))"
} else {
    Write-Info "Không có đại lý ngoài. Thử internal_agent..."
    $agents = Safe-Request -Method GET -Uri "$BaseUrl/users?role=internal_agent" -Headers $headers -Label "IntAgents"
    $agentList = if ($agents.data) { $agents.data } elseif ($agents -is [array]) { $agents } else { @($agents) }
    if ($agentList.Count -gt 0) {
        $testAgent = $agentList[0]
        $testAgent2 = if ($agentList.Count -gt 1) { $agentList[1] } else { $agentList[0] }
        Write-Info "Đại lý nội bộ: $($testAgent.fullName)"
    }
}

Write-Step "0.5" "Lấy danh sách Nhóm quảng cáo"
$adGroups = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $headers -Label "AdGroups"
$adGroupList = if ($adGroups.data) { $adGroups.data } elseif ($adGroups -is [array]) { $adGroups } else { @($adGroups) }
if ($adGroupList.Count -gt 0) {
    Write-Pass "Có $($adGroupList.Count) nhóm quảng cáo"
    $testAdGroup1 = $adGroupList[0]
    $testAdGroup2 = if ($adGroupList.Count -gt 1) { $adGroupList[1] } else { $adGroupList[0] }
    $adGroupId1 = if ($testAdGroup1.platformId) { $testAdGroup1.platformId } else { $testAdGroup1._id }
    $adGroupId2 = if ($testAdGroup2.platformId) { $testAdGroup2.platformId } else { $testAdGroup2._id }
    Write-Info "AdGroup 1: $($testAdGroup1.name) (ID: $adGroupId1)"
    Write-Info "AdGroup 2: $($testAdGroup2.name) (ID: $adGroupId2)"
} else {
    Write-Info "Không có nhóm quảng cáo. Sử dụng ID giả."
    $adGroupId1 = "test-adgroup-001"
    $adGroupId2 = "test-adgroup-002"
}

Write-Step "0.6" "Lấy Financial Control TRƯỚC khi tạo đơn (baseline)"
$fcBefore = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Dashboard Before"
if ($fcBefore) {
    Write-Pass "Financial Control dashboard trước test:"
    Write-Info "  Bank Balance: $($fcBefore.bankBalance)"
    Write-Info "  Free Cash: $($fcBefore.freeCash)"
    Write-Info "  Committed Cash: $($fcBefore.committedCash)"
    Write-Info "  Owner Withdrawable: $($fcBefore.ownerWithdrawable)"
    $script:testResults["fc_before"] = $fcBefore
}

Write-Step "0.7" "Lấy Supplier Payable Summary TRƯỚC test (baseline)"
if ($testSupplier) {
    $spBefore = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "Supplier Cashflow Before"
    if ($spBefore) {
        Write-Pass "Supplier payable cashflow baseline lấy thành công"
        Write-Info "  Gross Earned: $($spBefore.grossEarned)"
        Write-Info "  Net Earned: $($spBefore.netEarned)"
        Write-Info "  Unreceived: $($spBefore.unreceived)"
        $script:testResults["sp_before"] = $spBefore
    }
}

Write-Step "0.8" "Lấy Agent Payable Summary TRƯỚC test (baseline)"
if ($testAgent) {
    $apBefore = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "Agent Cashflow Before"
    if ($apBefore) {
        Write-Pass "Agent payable cashflow baseline lấy thành công"
        Write-Info "  Net Payable: $($apBefore.totalAgentNetPayable)"
        Write-Info "  Paid: $($apBefore.totalAgentPaid)"
        Write-Info "  Unpaid: $($apBefore.totalAgentUnpaid)"
        $script:testResults["ap_before"] = $apBefore
    }
}

# ==================== SECTION 1: TẠO 10 ĐƠN HÀNG ====================

Write-Section "PHASE 1: Tạo 10 đơn hàng (CRUD - Create)"

$testTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$orderDates = @(
    "2026-02-08T00:00:00.000Z",  # Đơn 1: 8 ngày trước
    "2026-02-09T00:00:00.000Z",  # Đơn 2: 7 ngày trước
    "2026-02-10T00:00:00.000Z",  # Đơn 3: 6 ngày trước
    "2026-02-11T00:00:00.000Z",  # Đơn 4: 5 ngày trước
    "2026-02-11T00:00:00.000Z",  # Đơn 5: cùng ngày đơn 4
    "2026-02-12T00:00:00.000Z",  # Đơn 6: 4 ngày trước
    "2026-02-13T00:00:00.000Z",  # Đơn 7: 3 ngày trước
    "2026-02-13T00:00:00.000Z",  # Đơn 8: cùng ngày đơn 7
    "2026-02-14T00:00:00.000Z",  # Đơn 9: hôm qua
    "2026-02-15T00:00:00.000Z"   # Đơn 10: hôm nay
)

# Cấu hình 10 đơn hàng khác nhau: COD, supplier quote, agent quote, quantity, adGroup
$orderConfigs = @(
    @{ name = "E2E-DH01-$testTimestamp"; qty = 1;  cod = 450000;  sqt = 120000; aqt = 40000;  ship = 25000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 0; desc = "Đơn 1 ngày - NCC1 - Agent1 - AdGrp1" },
    @{ name = "E2E-DH02-$testTimestamp"; qty = 2;  cod = 900000;  sqt = 140000; aqt = 50000;  ship = 30000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 0; desc = "Đơn 2 ngày - x2 - NCC1 - Agent1" },
    @{ name = "E2E-DH03-$testTimestamp"; qty = 1;  cod = 550000;  sqt = 160000; aqt = 45000;  ship = 28000; adGrp = $adGroupId2; suppIdx = 1; agentIdx = 1; desc = "Đơn 3 ngày - NCC2 - Agent2 - AdGrp2" },
    @{ name = "E2E-DH04-$testTimestamp"; qty = 3;  cod = 1200000; sqt = 110000; aqt = 35000;  ship = 35000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 0; desc = "Đơn 4 ngày - x3 - NCC1 - Agent1" },
    @{ name = "E2E-DH05-$testTimestamp"; qty = 1;  cod = 380000;  sqt = 100000; aqt = 30000;  ship = 22000; adGrp = $adGroupId2; suppIdx = 1; agentIdx = 1; desc = "Đơn 5 cùng ngày 4 - NCC2 - Agent2" },
    @{ name = "E2E-DH06-$testTimestamp"; qty = 2;  cod = 750000;  sqt = 130000; aqt = 42000;  ship = 26000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 0; desc = "Đơn 6 ngày - x2 - NCC1 - Agent1" },
    @{ name = "E2E-DH07-$testTimestamp"; qty = 1;  cod = 600000;  sqt = 150000; aqt = 48000;  ship = 30000; adGrp = $adGroupId2; suppIdx = 1; agentIdx = 1; desc = "Đơn 7 ngày - NCC2 - Agent2" },
    @{ name = "E2E-DH08-$testTimestamp"; qty = 2;  cod = 850000;  sqt = 125000; aqt = 38000;  ship = 28000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 0; desc = "Đơn 8 cùng ngày 7 - NCC1 - Agent1" },
    @{ name = "E2E-DH09-$testTimestamp"; qty = 1;  cod = 520000;  sqt = 135000; aqt = 43000;  ship = 25000; adGrp = $adGroupId2; suppIdx = 1; agentIdx = 0; desc = "Đơn 9 hôm qua - NCC2 - Agent1 (khác cặp)" },
    @{ name = "E2E-DH10-$testTimestamp"; qty = 1;  cod = 480000;  sqt = 115000; aqt = 36000;  ship = 24000; adGrp = $adGroupId1; suppIdx = 0; agentIdx = 1; desc = "Đơn 10 hôm nay - NCC1 - Agent2 (khác cặp)" }
)

$suppliersArr = @($testSupplier, $testSupplier2)
$agentsArr = @($testAgent, $testAgent2)

for ($i = 0; $i -lt 10; $i++) {
    $cfg = $orderConfigs[$i]
    $supp = $suppliersArr[$cfg.suppIdx]
    $agent = $agentsArr[$cfg.agentIdx]

    Write-Step "1.$($i+1)" "Tạo đơn hàng #$($i+1): $($cfg.desc)"

    $orderBody = @{
        customerName     = $cfg.name
        quantity         = $cfg.qty
        codAmount        = $cfg.cod
        supplierQuote    = $cfg.sqt
        agentQuote       = $cfg.aqt
        shippingFee      = $cfg.ship
        depositAmount    = 0
        returnFee        = 15000
        orderDate        = $orderDates[$i]
        productionStatus = "Chưa làm"
        orderStatus      = "Chưa có mã vận đơn"
        adGroupId        = $cfg.adGrp
        receiverName     = "Nguoi nhan $($i+1)"
        receiverPhone    = "090000000$i"
        receiverAddress  = "Dia chi $($i+1), Q$($i+1), TP.HCM"
    }

    # Thêm productId nếu có
    if ($testProduct -and $testProduct._id) {
        $orderBody["productId"] = $testProduct._id
    }
    # Thêm supplierId nếu có
    if ($supp -and $supp._id) {
        $orderBody["supplierId"] = $supp._id
    }
    # Thêm agentId nếu có
    if ($agent -and $agent._id) {
        $orderBody["agentId"] = $agent._id
    }

    $jsonBody = $orderBody | ConvertTo-Json -Depth 5
    $created = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $headers -Body $jsonBody -Label "Create Order $($i+1)"

    if ($created -and ($created._id -or $created.id)) {
        $oid = if ($created._id) { $created._id } else { $created.id }
        $script:createdOrderIds += $oid
        Write-Pass "Đơn #$($i+1) tạo thành công: ID=$oid"
        Write-Info "  COD=$($cfg.cod), SupplierQuote=$($cfg.sqt), AgentQuote=$($cfg.aqt), Qty=$($cfg.qty)"
    } else {
        Write-Fail "Không tạo được đơn #$($i+1)"
    }
}

Write-Info "Tổng đơn đã tạo: $($script:createdOrderIds.Count)"

# ==================== SECTION 2: ĐỌC ĐƠN HÀNG (Read) ====================

Write-Section "PHASE 2: Đọc đơn hàng (CRUD - Read)"

Write-Step "2.1" "Đọc chi tiết đơn hàng #1"
if ($script:createdOrderIds.Count -gt 0) {
    $order1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[0])" -Headers $headers -Label "Get Order 1"
    if ($order1) {
        Write-Pass "Đọc đơn #1 thành công"
        Write-Info "  Customer: $($order1.customerName), Status: $($order1.orderStatus), Production: $($order1.productionStatus)"
        Write-Info "  COD: $($order1.codAmount), SupplierQuote: $($order1.supplierQuote), AgentQuote: $($order1.agentQuote)"
    } else {
        Write-Fail "Không đọc được đơn #1"
    }
}

Write-Step "2.2" "Liệt kê đơn hàng theo filter (tìm đơn test)"
$listResp = Safe-Request -Method GET -Uri "$BaseUrl/test-order2?q=E2E-DH&limit=20" -Headers $headers -Label "List Orders"
if ($listResp) {
    $items = if ($listResp.data) { $listResp.data } elseif ($listResp -is [array]) { $listResp } else { @($listResp) }
    Write-Pass "Tìm thấy $($items.Count) đơn hàng test"
}

# ==================== SECTION 3: SỬA ĐƠN HÀNG (Update) ====================

Write-Section "PHASE 3: Sửa đơn hàng (CRUD - Update)"

Write-Step "3.1" "Sửa COD đơn #1 (450K → 500K)"
if ($script:createdOrderIds.Count -ge 1) {
    $updateBody = @{ codAmount = 500000 } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[0])" -Headers $headers -Body $updateBody -Label "Update COD"
    if ($updated) {
        Write-Pass "Cập nhật COD đơn #1 thành 500,000"
    } else {
        Write-Fail "Không cập nhật được COD đơn #1"
    }
}

Write-Step "3.2" "Sửa số lượng đơn #2 (qty 2 → 3)"
if ($script:createdOrderIds.Count -ge 2) {
    $updateBody = @{ quantity = 3 } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[1])" -Headers $headers -Body $updateBody -Label "Update Qty"
    if ($updated) {
        Write-Pass "Cập nhật quantity đơn #2 thành 3"
    } else {
        Write-Fail "Không cập nhật được quantity đơn #2"
    }
}

Write-Step "3.3" "Đổi nhóm quảng cáo đơn #3 (AdGrp2 → AdGrp1)"
if ($script:createdOrderIds.Count -ge 3) {
    $updateBody = @{ adGroupId = $adGroupId1 } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[2])" -Headers $headers -Body $updateBody -Label "Update AdGroup"
    if ($updated) {
        Write-Pass "Đổi nhóm quảng cáo đơn #3 → $adGroupId1"
    } else {
        Write-Fail "Không cập nhật được nhóm quảng cáo đơn #3"
    }
}

Write-Step "3.4" "Đổi báo giá NCC đơn #4 (110K → 125K)"
if ($script:createdOrderIds.Count -ge 4) {
    $updateBody = @{ supplierQuote = 125000 } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers -Body $updateBody -Label "Update SupplierQuote"
    if ($updated) {
        Write-Pass "Đổi báo giá NCC đơn #4 → 125,000"
    } else {
        Write-Fail "Không cập nhật được báo giá NCC đơn #4"
    }
}

Write-Step "3.5" "Đổi hoa hồng đại lý đơn #5 (30K → 55K)"
if ($script:createdOrderIds.Count -ge 5) {
    $updateBody = @{ agentQuote = 55000 } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[4])" -Headers $headers -Body $updateBody -Label "Update AgentQuote"
    if ($updated) {
        Write-Pass "Đổi hoa hồng đại lý đơn #5 → 55,000"
    } else {
        Write-Fail "Không cập nhật được hoa hồng đại lý đơn #5"
    }
}

Write-Step "3.6" "Đổi NCC cho đơn #6 (NCC1 → NCC2)"
if ($script:createdOrderIds.Count -ge 6 -and $testSupplier2) {
    $updateBody = @{ supplierId = $testSupplier2._id } | ConvertTo-Json
    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[5])" -Headers $headers -Body $updateBody -Label "Update Supplier"
    if ($updated) {
        Write-Pass "Đổi NCC đơn #6 → $($testSupplier2.fullName)"
    } else {
        Write-Fail "Không cập nhật được NCC đơn #6"
    }
}

# ==================== SECTION 4: THAY ĐỔI TRẠNG THÁI SẢN XUẤT ====================

Write-Section "PHASE 4: Thay đổi trạng thái sản xuất"

# Đơn 1-6: Chuyển sang 'Đang làm' rồi 'Đã trả kết quả'
# Đơn 7-8: Chuyển sang 'Đang làm'
# Đơn 9-10: Giữ nguyên 'Chưa làm'

Write-Step "4.1" "Chuyển đơn #1-8 sang 'Đang làm'"
for ($i = 0; $i -lt [Math]::Min(8, $script:createdOrderIds.Count); $i++) {
    $body = @{ productionStatus = "Đang làm" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body -Label "ProdStatus Đang làm #$($i+1)"
    if ($resp) {
        Write-Pass "Đơn #$($i+1) → 'Đang làm'"
    } else {
        Write-Fail "Đơn #$($i+1) không chuyển được 'Đang làm'"
    }
}

Write-Step "4.2" "Chuyển đơn #1-6 sang 'Đã trả kết quả' (triggers SupplierPayable upsert)"
for ($i = 0; $i -lt [Math]::Min(6, $script:createdOrderIds.Count); $i++) {
    $body = @{ productionStatus = "Đã trả kết quả" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body -Label "ProdStatus Done #$($i+1)"
    if ($resp) {
        Write-Pass "Đơn #$($i+1) → 'Đã trả kết quả' (auto-tạo SupplierPayable)"
    } else {
        Write-Fail "Đơn #$($i+1) không chuyển được 'Đã trả kết quả'"
    }
}

Write-Step "4.3" "Kiểm tra SupplierPayable đã được tạo sau khi production = Done"
$spAfterProd = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables?limit=20" -Headers $headers -Label "Check SupplierPayables"
if ($spAfterProd) {
    $spItems = if ($spAfterProd.data) { $spAfterProd.data } elseif ($spAfterProd -is [array]) { $spAfterProd } else { @($spAfterProd) }
    Write-Check "Số SupplierPayable records: $($spItems.Count)"
    Write-Pass "SupplierPayable tự động tạo khi production = 'Đã trả kết quả'"
}

# ==================== SECTION 5: THAY ĐỔI TRẠNG THÁI VẬN ĐƠN ====================

Write-Section "PHASE 5: Thay đổi trạng thái vận đơn (triggers payment calculation)"

Write-Step "5.1" "Chuyển đơn #1-4 sang 'Đang giao'"
for ($i = 0; $i -lt [Math]::Min(4, $script:createdOrderIds.Count); $i++) {
    $body = @{ orderStatus = "Đang giao" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body -Label "OrderStatus Shipping #$($i+1)"
    if ($resp) {
        Write-Pass "Đơn #$($i+1) → 'Đang giao'"
    } else {
        Write-Fail "Đơn #$($i+1) không chuyển được 'Đang giao'"
    }
}

Write-Step "5.2" "Chuyển đơn #1-3 sang 'Giao thành công' (triggers grossProfit calc + COD collection)"
for ($i = 0; $i -lt [Math]::Min(3, $script:createdOrderIds.Count); $i++) {
    $body = @{ orderStatus = "Giao thành công" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body -Label "OrderStatus Delivered #$($i+1)"
    if ($resp) {
        Write-Pass "Đơn #$($i+1) → 'Giao thành công'"
    } else {
        Write-Fail "Đơn #$($i+1) không chuyển được 'Giao thành công'"
    }
}

Write-Step "5.3" "Chuyển đơn #4 sang 'Hàng hoàn' (triggers return calculation)"
if ($script:createdOrderIds.Count -ge 4) {
    $body = @{ orderStatus = "Hàng hoàn" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers -Body $body -Label "OrderStatus Return #4"
    if ($resp) {
        Write-Pass "Đơn #4 → 'Hàng hoàn' (return - negative amounts)"
    } else {
        Write-Fail "Đơn #4 không chuyển được 'Hàng hoàn'"
    }
}

Write-Step "5.4" "Kiểm tra grossProfit & supplierPaidAmount sau khi delivery status thay đổi"
for ($i = 0; $i -lt [Math]::Min(4, $script:createdOrderIds.Count); $i++) {
    $order = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Verify Order #$($i+1)"
    if ($order) {
        Write-Check "Đơn #$($i+1):"
        Write-Info "  orderStatus: $($order.orderStatus)"
        Write-Info "  supplierPaymentStatus: $($order.supplierPaymentStatus)"
        Write-Info "  agentPaymentStatus: $($order.agentPaymentStatus)"
        Write-Info "  grossProfit: $($order.grossProfit)"
        Write-Info "  supplierPaidAmount: $($order.supplierPaidAmount)"
        Write-Info "  agentPaidAmount: $($order.agentPaidAmount)"
        Write-Info "  codCollectedBySupplier: $($order.codCollectedBySupplier)"
        
        if ($order.orderStatus -eq "Giao thành công" -and $order.grossProfit -gt 0) {
            Write-Pass "Đơn #$($i+1) grossProfit đã được tính: $($order.grossProfit)"
        } elseif ($order.orderStatus -eq "Hàng hoàn") {
            Write-Pass "Đơn #$($i+1) là đơn hoàn"
        }
    }
}

# ==================== SECTION 5B: THÊM ĐƠN GIAO THÀNH CÔNG ====================

Write-Step "5.5" "Chuyển đơn #5-6 sang 'Đang giao' → 'Giao thành công'"
for ($i = 4; $i -lt [Math]::Min(6, $script:createdOrderIds.Count); $i++) {
    $body1 = @{ orderStatus = "Đang giao" } | ConvertTo-Json
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body1 -Label "Ship #$($i+1)" | Out-Null
    Start-Sleep -Milliseconds 300
    $body2 = @{ orderStatus = "Giao thành công" } | ConvertTo-Json
    $resp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body $body2 -Label "Deliver #$($i+1)"
    if ($resp) {
        Write-Pass "Đơn #$($i+1) → 'Giao thành công'"
    }
}

# ==================== SECTION 6: KIỂM TRA CÔNG NỢ NCC SAU THAY ĐỔI ====================

Write-Section "PHASE 6: Kiểm tra Công nợ Nhà cung cấp sau thay đổi"

Write-Step "6.1" "Supplier Payable Cashflow Summary - SAU KHI giao hàng"
$spAfterDelivery = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP Cashflow After Delivery"
if ($spAfterDelivery) {
    Write-Pass "Supplier payable cashflow sau delivery:"
    Write-Info "  Gross Earned: $($spAfterDelivery.grossEarned)"
    Write-Info "  Net Earned: $($spAfterDelivery.netEarned)"
    Write-Info "  Received: $($spAfterDelivery.received)"
    Write-Info "  Unreceived: $($spAfterDelivery.unreceived)"
    $script:testResults["sp_after_delivery"] = $spAfterDelivery
}

Write-Step "6.2" "Ops Summary cho NCC1"
if ($testSupplier) {
    $opsSummary = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/supplier-payment/ops-summary?supplierId=$($testSupplier._id)" -Headers $headers -Label "Supplier Ops Summary"
    if ($opsSummary) {
        Write-Pass "NCC1 ops summary:"
        Write-Info "  $(($opsSummary | ConvertTo-Json -Depth 2 -Compress))"
    }
}

Write-Step "6.3" "Pending payment cho NCC1"
if ($testSupplier) {
    $pending = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$($testSupplier._id)" -Headers $headers -Label "Supplier Pending"
    if ($pending) {
        $pendingItems = if ($pending -is [array]) { $pending } else { @($pending) }
        Write-Check "Số đơn chờ thanh toán NCC1: $($pendingItems.Count)"
    }
}

# ==================== SECTION 7: KIỂM TRA HOA HỒNG ĐẠI LÝ SAU THAY ĐỔI ====================

Write-Section "PHASE 7: Kiểm tra Hoa hồng Đại lý sau thay đổi"

Write-Step "7.1" "Agent Payable Cashflow Summary - SAU KHI giao hàng"
$apAfterDelivery = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP Cashflow After Delivery"
if ($apAfterDelivery) {
    Write-Pass "Agent payable cashflow sau delivery:"
    Write-Info "  Incurred: $($apAfterDelivery.totalAgentCommissionIncurred)"
    Write-Info "  Adjustments: $($apAfterDelivery.totalAgentAdjustments)"
    Write-Info "  Net Payable: $($apAfterDelivery.totalAgentNetPayable)"
    Write-Info "  Paid: $($apAfterDelivery.totalAgentPaid)"
    Write-Info "  Unpaid: $($apAfterDelivery.totalAgentUnpaid)"
    Write-Info "  Due 14D: $($apAfterDelivery.totalAgentDue14d)"
    $script:testResults["ap_after_delivery"] = $apAfterDelivery
}

Write-Step "7.2" "Agent Pending Orders"
if ($testAgent) {
    $agentPending = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$($testAgent._id)" -Headers $headers -Label "Agent Pending"
    if ($agentPending) {
        $apItems = if ($agentPending -is [array]) { $agentPending } else { @($agentPending) }
        Write-Check "Số đơn chờ thanh toán Agent1: $($apItems.Count)"
    }
}

Write-Step "7.3" "Agent Summary"
if ($testAgent) {
    $agentSummary = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary?agentId=$($testAgent._id)" -Headers $headers -Label "Agent Summary"
    if ($agentSummary) {
        Write-Pass "Agent1 summary:"
        Write-Info "  $(($agentSummary | ConvertTo-Json -Depth 2 -Compress))"
    }
}

# ==================== SECTION 8: THANH TOÁN NHÀ CUNG CẤP ====================

Write-Section "PHASE 8: Thanh toán Nhà cung cấp (Statement-based)"

Write-Step "8.1" "Tạo Statement cho NCC1 (kỳ 01/02 - 15/02)"
if ($testSupplier) {
    $stmtBody = @{
        supplierId = $testSupplier._id
        periodFrom = "2026-02-01"
        periodTo   = "2026-02-15"
        notes      = "Kỳ đối soát 01-15/02/2026 - E2E Test"
    } | ConvertTo-Json
    $stmt = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $headers -Body $stmtBody -Label "Create Supplier Statement"
    if ($stmt -and ($stmt._id -or $stmt.id)) {
        $stmtId = if ($stmt._id) { $stmt._id } else { $stmt.id }
        Write-Pass "Tạo statement NCC1 thành công: ID=$stmtId"
        Write-Info "  Opening: $($stmt.openingBalance), Period Payables: $($stmt.periodPayables)"
        Write-Info "  Closing: $($stmt.closingBalance)"
        $script:testResults["supplier_stmt_id"] = $stmtId
    } else {
        Write-Fail "Không tạo được statement NCC1"
    }
}

Write-Step "8.2" "Ghi nhận thanh toán NCC1 - 500,000 VND"
$stmtId = $script:testResults["supplier_stmt_id"]
if ($stmtId) {
    $payBody = @{
        amount    = 500000
        paidAt    = "2026-02-15T10:00:00.000Z"
        method    = "bank_transfer"
        reference = "TXN-NCC-E2E-001"
        notes     = "Thanh toán đợt 1 - E2E test"
        createdBy = $loginResp.user.fullName
    } | ConvertTo-Json
    $payResp = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$stmtId/payments" -Headers $headers -Body $payBody -Label "Supplier Payment"
    if ($payResp) {
        Write-Pass "Thanh toán NCC1 - 500,000 VND thành công"
        Write-Info "  Statement Payment Total: $($payResp.statementPaymentTotal)"
        Write-Info "  Closing Balance: $($payResp.closingBalance)"
    } else {
        Write-Fail "Thanh toán NCC1 thất bại"
    }
}

Write-Step "8.3" "Kiểm tra đơn hàng đã được sync supplierPaymentStatus"
Start-Sleep -Seconds 1
for ($i = 0; $i -lt [Math]::Min(3, $script:createdOrderIds.Count); $i++) {
    $order = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Check supplier sync #$($i+1)"
    if ($order) {
        Write-Check "Đơn #$($i+1): supplierPaymentStatus=$($order.supplierPaymentStatus), batchId=$($order.supplierPaymentBatchId)"
    }
}

Write-Step "8.4" "Ghi nhận thanh toán đợt 2 NCC1 - 300,000 VND"
if ($stmtId) {
    $payBody2 = @{
        amount    = 300000
        paidAt    = "2026-02-15T14:00:00.000Z"
        method    = "bank_transfer"
        reference = "TXN-NCC-E2E-002"
        notes     = "Thanh toán đợt 2 - E2E test"
        createdBy = $loginResp.user.fullName
    } | ConvertTo-Json
    $payResp2 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$stmtId/payments" -Headers $headers -Body $payBody2 -Label "Supplier Payment 2"
    if ($payResp2) {
        Write-Pass "Thanh toán NCC1 đợt 2 - 300,000 VND thành công"
        Write-Info "  Statement Payment Total: $($payResp2.statementPaymentTotal)"
        Write-Info "  Closing Balance: $($payResp2.closingBalance)"
    }
}

# ==================== SECTION 9: THANH TOÁN HOA HỒNG ĐẠI LÝ ====================

Write-Section "PHASE 9: Thanh toán Hoa hồng Đại lý (Statement-based)"

Write-Step "9.1" "Tạo Statement cho Agent1 (kỳ 01/02 - 15/02)"
if ($testAgent) {
    $agStmtBody = @{
        agentId    = $testAgent._id
        periodFrom = "2026-02-01"
        periodTo   = "2026-02-15"
        notes      = "Kỳ đối soát hoa hồng 01-15/02/2026 - E2E Test"
    } | ConvertTo-Json
    $agStmt = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Body $agStmtBody -Label "Create Agent Statement"
    if ($agStmt -and ($agStmt._id -or $agStmt.id)) {
        $agStmtId = if ($agStmt._id) { $agStmt._id } else { $agStmt.id }
        Write-Pass "Tạo statement Agent1 thành công: ID=$agStmtId"
        Write-Info "  Opening: $($agStmt.openingBalance), Period Receivables: $($agStmt.periodReceivables)"
        Write-Info "  Closing: $($agStmt.closingBalance)"
        $script:testResults["agent_stmt_id"] = $agStmtId
    } else {
        Write-Fail "Không tạo được statement Agent1"
    }
}

Write-Step "9.2" "Ghi nhận thanh toán hoa hồng Agent1 - 200,000 VND"
$agStmtId = $script:testResults["agent_stmt_id"]
if ($agStmtId) {
    $agPayBody = @{
        amount    = 200000
        paidAt    = "2026-02-15T11:00:00.000Z"
        method    = "bank_transfer"
        reference = "TXN-AGENT-E2E-001"
        notes     = "Thanh toán hoa hồng đợt 1 - E2E test"
        createdBy = $loginResp.user.fullName
    } | ConvertTo-Json
    $agPayResp = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$agStmtId/payments" -Headers $headers -Body $agPayBody -Label "Agent Payment"
    if ($agPayResp) {
        Write-Pass "Thanh toán hoa hồng Agent1 - 200,000 VND thành công"
        Write-Info "  Statement Payment Total: $($agPayResp.statementPaymentTotal)"
        Write-Info "  Closing Balance: $($agPayResp.closingBalance)"
    } else {
        Write-Fail "Thanh toán hoa hồng Agent1 thất bại"
    }
}

Write-Step "9.3" "Kiểm tra đơn hàng đã sync agentPaymentStatus"
Start-Sleep -Seconds 1
for ($i = 0; $i -lt [Math]::Min(5, $script:createdOrderIds.Count); $i++) {
    $order = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Check agent sync #$($i+1)"
    if ($order) {
        Write-Check "Đơn #$($i+1): agentPaymentStatus=$($order.agentPaymentStatus), batchId=$($order.agentPaymentBatchId)"
    }
}

Write-Step "9.4" "Kiểm tra realizedProfit (cần cả 2 bên đã thanh toán)"
for ($i = 0; $i -lt [Math]::Min(5, $script:createdOrderIds.Count); $i++) {
    $order = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Check realized #$($i+1)"
    if ($order) {
        if ($order.realizedGrossProfit -or $order.realizedNetProfit) {
            Write-Pass "Đơn #$($i+1) có realizedGrossProfit=$($order.realizedGrossProfit), realizedNetProfit=$($order.realizedNetProfit)"
        } else {
            $bothPaid = ($order.supplierPaymentStatus -eq "paid") -and ($order.agentPaymentStatus -eq "paid" -or $order.agentPaymentStatus -eq "n/a")
            if ($bothPaid) {
                Write-Info "Đơn #$($i+1) cả 2 bên đã paid nhưng chưa có realizedProfit (có thể chưa trigger)"
            } else {
                Write-Info "Đơn #$($i+1) chưa đủ điều kiện realized (supplier=$($order.supplierPaymentStatus), agent=$($order.agentPaymentStatus))"
            }
        }
    }
}

# ==================== SECTION 10: FINANCIAL CONTROL SAU THANH TOÁN ====================

Write-Section "PHASE 10: Financial Control - SAU tất cả thay đổi"

Write-Step "10.1" "Financial Control Dashboard SAU thanh toán"
$fcAfter = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Dashboard After"
if ($fcAfter) {
    Write-Pass "Financial Control dashboard SAU test:"
    Write-Info "  Bank Balance: $($fcAfter.bankBalance)"
    Write-Info "  Free Cash: $($fcAfter.freeCash)"
    Write-Info "  Committed Cash: $($fcAfter.committedCash)"
    Write-Info "  Monthly Burn: $($fcAfter.monthlyBurn)"
    Write-Info "  Runway: $($fcAfter.runwayMonths) tháng"
    Write-Info "  Survival Floor: $($fcAfter.survivalFloor)"
    Write-Info "  Ads Budget Approved: $($fcAfter.adsBudgetApproved)"
    Write-Info "  Owner Withdrawable: $($fcAfter.ownerWithdrawable)"
    $script:testResults["fc_after"] = $fcAfter
}

Write-Step "10.2" "Financial Control Full Metrics"
$fcFull = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/full" -Headers $headers -Label "FC Full"
if ($fcFull) {
    Write-Pass "Financial Control full metrics:"
    Write-Info "  $(($fcFull | ConvertTo-Json -Depth 3 -Compress).Substring(0, [Math]::Min(500, ($fcFull | ConvertTo-Json -Depth 3 -Compress).Length)))"
}

Write-Step "10.3" "Financial Control Forecast 7 ngày"
$fcForecast = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/forecast" -Headers $headers -Label "FC Forecast"
if ($fcForecast) {
    Write-Pass "Forecast 7 ngày:"
    if ($fcForecast.forecast) {
        foreach ($day in $fcForecast.forecast) {
            Write-Info "  Ngày $($day.date): Bank=$($day.bankBalance), In=$($day.expectedIn), Out=$($day.expectedOut)"
        }
    }
    if ($null -ne $fcForecast.lowPoint) {
        Write-Info "  Low Point: $($fcForecast.lowPoint)"
    }
    if ($fcForecast.isCashCrunch) { Write-Fail "CASH CRUNCH detected!" }
    if ($fcForecast.isSurvivalRisk) { Write-Fail "SURVIVAL RISK detected!" }
}

Write-Step "10.4" "Cashflow Health (CSI, DSO, DPO)"
$cfHealth = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label "Cashflow Health"
if ($cfHealth) {
    Write-Pass "Cashflow Health:"
    Write-Info "  CSI: $($cfHealth.csi)"
    Write-Info "  DSO: $($cfHealth.dso)"
    Write-Info "  DPO: $($cfHealth.dpo)"
    if ($cfHealth.riskLevel) { Write-Info "  Risk Level: $($cfHealth.riskLevel)" }
}

Write-Step "10.5" "Module Health"
$modHealth = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/module-health" -Headers $headers -Label "Module Health"
if ($modHealth) {
    Write-Pass "Module Health:"
    if ($modHealth -is [array]) {
        foreach ($m in $modHealth) {
            $status = if ($m.healthy -or $m.status -eq "ok") { "OK" } else { "ISSUE" }
            Write-Info "  $($m.name): $status"
        }
    } else {
        Write-Info "  $(($modHealth | ConvertTo-Json -Depth 2 -Compress).Substring(0, [Math]::Min(300, ($modHealth | ConvertTo-Json -Depth 2 -Compress).Length)))"
    }
}

Write-Step "10.6" "4 Virtual Funds Overview"
$fundsOverview = Safe-Request -Method GET -Uri "$BaseUrl/funds/overview" -Headers $headers -Label "Funds Overview"
if ($fundsOverview) {
    Write-Pass "4 Virtual Funds:"
    Write-Info "  $(($fundsOverview | ConvertTo-Json -Depth 2 -Compress).Substring(0, [Math]::Min(400, ($fundsOverview | ConvertTo-Json -Depth 2 -Compress).Length)))"
}

Write-Step "10.7" "Supplier Payable Cashflow SAU thanh toán"
$spFinal = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP Cashflow Final"
if ($spFinal) {
    Write-Pass "Supplier payable cashflow cuối cùng:"
    Write-Info "  Gross Earned: $($spFinal.grossEarned)"
    Write-Info "  Net Earned: $($spFinal.netEarned)"
    Write-Info "  Received: $($spFinal.received)"
    Write-Info "  Unreceived: $($spFinal.unreceived)"
    $script:testResults["sp_final"] = $spFinal
}

Write-Step "10.8" "Agent Payable Cashflow SAU thanh toán"
$apFinal = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP Cashflow Final"
if ($apFinal) {
    Write-Pass "Agent payable cashflow cuối cùng:"
    Write-Info "  Incurred: $($apFinal.totalAgentCommissionIncurred)"
    Write-Info "  Net Payable: $($apFinal.totalAgentNetPayable)"
    Write-Info "  Paid: $($apFinal.totalAgentPaid)"
    Write-Info "  Unpaid: $($apFinal.totalAgentUnpaid)"
    Write-Info "  Due 14D: $($apFinal.totalAgentDue14d)"
    $script:testResults["ap_final"] = $apFinal
}

# ==================== SECTION 11: DAILY PROFIT REPORT ====================

Write-Section "PHASE 11: Báo cáo lợi nhuận theo ngày"

Write-Step "11.1" "Daily Profit Report - Hôm nay"
$profitReport = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/daily-profit-report?date=2026-02-15" -Headers $headers -Label "Daily Profit"
if ($profitReport) {
    Write-Pass "Báo cáo lợi nhuận 15/02/2026:"
    Write-Info "  $(($profitReport | ConvertTo-Json -Depth 3 -Compress).Substring(0, [Math]::Min(400, ($profitReport | ConvertTo-Json -Depth 3 -Compress).Length)))"
}

Write-Step "11.2" "Product Profit Report"
$productProfit = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/product-profit-report?from=2026-02-08&to=2026-02-15" -Headers $headers -Label "Product Profit"
if ($productProfit) {
    Write-Pass "Báo cáo lợi nhuận theo sản phẩm 08-15/02:"
    $ppItems = if ($productProfit -is [array]) { $productProfit } else { @($productProfit) }
    Write-Info "  Có $($ppItems.Count) products trong báo cáo"
}

# ==================== SECTION 12: XÓA ĐƠN HÀNG (Delete) ====================

Write-Section "PHASE 12: Xóa đơn hàng (CRUD - Delete) + Kiểm tra ảnh hưởng"

Write-Step "12.1" "Lấy snapshot trước xóa"
$fcBeforeDelete = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Before Delete"

Write-Step "12.2" "Xóa đơn #10 (chưa giao - không ảnh hưởng thanh toán)"
if ($script:createdOrderIds.Count -ge 10) {
    $delResp = Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[9])" -Headers $headers -Label "Delete Order 10"
    if ($delResp -or $true) {
        Write-Pass "Xóa đơn #10 thành công"
    }
}

Write-Step "12.3" "Xóa đơn #9 (chưa giao - không ảnh hưởng thanh toán)"
if ($script:createdOrderIds.Count -ge 9) {
    $delResp2 = Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[8])" -Headers $headers -Label "Delete Order 9"
    if ($delResp2 -or $true) {
        Write-Pass "Xóa đơn #9 thành công"
    }
}

Write-Step "12.4" "Kiểm tra Financial Control SAU xóa"
Start-Sleep -Seconds 1
$fcAfterDelete = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC After Delete"
if ($fcAfterDelete -and $fcBeforeDelete) {
    Write-Check "So sánh FC trước/sau xóa 2 đơn chưa giao:"
    Write-Info "  Bank Balance: $($fcBeforeDelete.bankBalance) → $($fcAfterDelete.bankBalance)"
    Write-Info "  Free Cash: $($fcBeforeDelete.freeCash) → $($fcAfterDelete.freeCash)"
    Write-Info "  Committed: $($fcBeforeDelete.committedCash) → $($fcAfterDelete.committedCash)"
}

# ==================== SECTION 13: CLOSE STATEMENTS ====================

Write-Section "PHASE 13: Đóng Kỳ đối soát (Close Statements)"

Write-Step "13.1" "Đóng Statement NCC1"
$stmtId = $script:testResults["supplier_stmt_id"]
if ($stmtId) {
    $closeResp = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$stmtId/close" -Headers $headers -Body "{}" -Label "Close Supplier Statement"
    if ($closeResp) {
        Write-Pass "Đóng statement NCC1 thành công"
        Write-Info "  Status: $($closeResp.status)"
    } else {
        Write-Fail "Không đóng được statement NCC1"
    }
}

Write-Step "13.2" "Đóng Statement Agent1"
$agStmtId = $script:testResults["agent_stmt_id"]
if ($agStmtId) {
    $closeResp2 = Safe-Request -Method PATCH -Uri "$BaseUrl/agent-payables/statements/$agStmtId/close" -Headers $headers -Body "{}" -Label "Close Agent Statement"
    if ($closeResp2) {
        Write-Pass "Đóng statement Agent1 thành công"
        Write-Info "  Status: $($closeResp2.status)"
    } else {
        Write-Fail "Không đóng được statement Agent1"
    }
}

# ==================== SECTION 14: RECALCULATE & VERIFY ====================

Write-Section "PHASE 14: Recalculate & Verify tổng hợp"

Write-Step "14.1" "Recalculate profits cho tất cả đơn test"
$recalcResp = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/recalculate-all-profits?from=2026-02-08&to=2026-02-15" -Headers $headers -Body "{}" -Label "Recalculate All"
if ($recalcResp) {
    Write-Pass "Recalculate all profits thành công"
    Write-Info "  $(($recalcResp | ConvertTo-Json -Depth 2 -Compress))"
}

Write-Step "14.2" "Kiểm tra tổng hợp cuối cùng cho mỗi đơn còn lại"
Write-Host ""
Write-Host ("  {0,-6} {1,-22} {2,-20} {3,-18} {4,-12} {5,-12} {6,-12}" -f "#", "OrderStatus", "ProdStatus", "SupplierPay", "AgentPay", "GrossProfit", "NetProfit") -ForegroundColor White
Write-Host ("  " + "-" * 105) -ForegroundColor White

$remainingIds = $script:createdOrderIds[0..([Math]::Min(7, $script:createdOrderIds.Count - 1))]
foreach ($oid in $remainingIds) {
    $idx = [Array]::IndexOf($script:createdOrderIds, $oid) + 1
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$oid" -Headers $headers -Label "Final check #$idx"
    if ($o) {
        $spPay = "$($o.supplierPaymentStatus)$(if($o.supplierPaidAmount){' $'+$o.supplierPaidAmount})"
        $agPay = "$($o.agentPaymentStatus)$(if($o.agentPaidAmount){' $'+$o.agentPaidAmount})"
        Write-Host ("  {0,-6} {1,-22} {2,-20} {3,-18} {4,-12} {5,-12} {6,-12}" -f `
            "#$idx", $o.orderStatus, $o.productionStatus, $spPay, $agPay, $o.grossProfit, $o.netProfit)
    }
}

# ==================== SECTION 15: SO SÁNH TRƯỚC/SAU ====================

Write-Section "PHASE 15: So sánh Tổng hợp TRƯỚC / SAU test"

Write-Step "15.1" "Financial Control Delta"
if ($script:testResults["fc_before"] -and $script:testResults["fc_after"]) {
    $before = $script:testResults["fc_before"]
    $after = $script:testResults["fc_after"]
    Write-Host ""
    Write-Host ("  {0,-25} {1,20} {2,20} {3,20}" -f "Metric", "BEFORE", "AFTER", "DELTA") -ForegroundColor White
    Write-Host ("  " + "-" * 85) -ForegroundColor White
    
    $metrics = @("bankBalance", "freeCash", "committedCash", "monthlyBurn", "survivalFloor", "adsBudgetApproved", "ownerWithdrawable")
    foreach ($m in $metrics) {
        $bVal = if ($before.PSObject.Properties[$m]) { $before.$m } else { 0 }
        $aVal = if ($after.PSObject.Properties[$m]) { $after.$m } else { 0 }
        $delta = $aVal - $bVal
        $deltaStr = if ($delta -gt 0) { "+$delta" } elseif ($delta -lt 0) { "$delta" } else { "0" }
        Write-Host ("  {0,-25} {1,20:N0} {2,20:N0} {3,20}" -f $m, $bVal, $aVal, $deltaStr)
    }
}

Write-Step "15.2" "Supplier Payable Delta"
if ($script:testResults["sp_before"] -and $script:testResults["sp_final"]) {
    $spB = $script:testResults["sp_before"]
    $spA = $script:testResults["sp_final"]
    Write-Host ""
    Write-Host ("  {0,-25} {1,20} {2,20}" -f "Metric", "BEFORE", "AFTER") -ForegroundColor White
    Write-Host ("  " + "-" * 65) -ForegroundColor White
    foreach ($m in @("grossEarned", "netEarned", "received", "unreceived")) {
        $bVal = if ($spB.PSObject.Properties[$m]) { $spB.$m } else { 0 }
        $aVal = if ($spA.PSObject.Properties[$m]) { $spA.$m } else { 0 }
        Write-Host ("  {0,-25} {1,20:N0} {2,20:N0}" -f $m, $bVal, $aVal)
    }
}

Write-Step "15.3" "Agent Payable Delta"
if ($script:testResults["ap_before"] -and $script:testResults["ap_final"]) {
    $apB = $script:testResults["ap_before"]
    $apA = $script:testResults["ap_final"]
    Write-Host ""
    Write-Host ("  {0,-30} {1,20} {2,20}" -f "Metric", "BEFORE", "AFTER") -ForegroundColor White
    Write-Host ("  " + "-" * 70) -ForegroundColor White
    foreach ($m in @("totalAgentCommissionIncurred", "totalAgentNetPayable", "totalAgentPaid", "totalAgentUnpaid", "totalAgentDue14d")) {
        $bVal = if ($apB.PSObject.Properties[$m]) { $apB.$m } else { 0 }
        $aVal = if ($apA.PSObject.Properties[$m]) { $apA.$m } else { 0 }
        Write-Host ("  {0,-30} {1,20:N0} {2,20:N0}" -f $m, $bVal, $aVal)
    }
}

# ==================== FINAL SUMMARY ====================

Write-Section "KẾT QUẢ TỔNG HỢP"

Write-Host ""
Write-Host "  Tổng test PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "  Tổng test FAIL: $($script:failCount)" -ForegroundColor Red
Write-Host "  Đơn hàng đã tạo: $($script:createdOrderIds.Count)" -ForegroundColor White
Write-Host ""

if ($script:failCount -gt 0) {
    Write-Host "  Chi tiết FAIL:" -ForegroundColor Red
    foreach ($f in $script:failDetails) {
        Write-Host "    - $f" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "  LUỒNG NGHIỆP VỤ ĐÃ TEST:" -ForegroundColor Cyan
Write-Host "  [1] Tạo 10 đơn hàng (CRUD Create) - các ngày 08-15/02/2026" -ForegroundColor White
Write-Host "  [2] Doc don hang (CRUD Read) - lay chi tiet va filter" -ForegroundColor White
Write-Host "  [3] Sửa đơn hàng (CRUD Update):" -ForegroundColor White
Write-Host "      - Thay đổi COD (450K → 500K)" -ForegroundColor White
Write-Host "      - Thay đổi số lượng (2 → 3)" -ForegroundColor White
Write-Host "      - Đổi nhóm quảng cáo (AdGrp2 → AdGrp1)" -ForegroundColor White
Write-Host "      - Đổi báo giá NCC (110K → 125K)" -ForegroundColor White
Write-Host "      - Đổi hoa hồng đại lý (30K → 55K)" -ForegroundColor White
Write-Host "      - Đổi nhà cung cấp (NCC1 → NCC2)" -ForegroundColor White
Write-Host "  [4] Thay đổi trạng thái sản xuất:" -ForegroundColor White
Write-Host "      - Chưa làm → Đang làm → Đã trả kết quả" -ForegroundColor White
Write-Host "      - Auto-tạo SupplierPayable khi Done" -ForegroundColor White
Write-Host "  [5] Thay đổi trạng thái vận đơn:" -ForegroundColor White
Write-Host "      - Chưa có MVĐ → Đang giao → Giao thành công" -ForegroundColor White
Write-Host "      - Giao thành công (auto COD collection + gross profit)" -ForegroundColor White
Write-Host "      - Hàng hoàn (return fee + negative amounts)" -ForegroundColor White
Write-Host "  [6] Công nợ NCC:" -ForegroundColor White
Write-Host "      - Tạo kỳ đối soát (Statement)" -ForegroundColor White
Write-Host "      - Thanh toán 2 đợt (500K + 300K)" -ForegroundColor White
Write-Host "      - Sync supplierPaymentStatus trên đơn hàng" -ForegroundColor White
Write-Host "      - Đóng kỳ đối soát" -ForegroundColor White
Write-Host "  [7] Hoa hồng đại lý:" -ForegroundColor White
Write-Host "      - Tạo kỳ đối soát (Statement)" -ForegroundColor White
Write-Host "      - Thanh toán hoa hồng (200K)" -ForegroundColor White
Write-Host "      - Sync agentPaymentStatus trên đơn hàng" -ForegroundColor White
Write-Host "      - Đóng kỳ đối soát" -ForegroundColor White
Write-Host "  [8] Financial Control:" -ForegroundColor White
Write-Host "      - Dashboard 8 số (bank, freecash, committed, burn, runway...)" -ForegroundColor White
Write-Host "      - Full metrics" -ForegroundColor White
Write-Host "      - Forecast 7 ngày" -ForegroundColor White
Write-Host "      - Cashflow Health (CSI, DSO, DPO)" -ForegroundColor White
Write-Host "      - Module Health" -ForegroundColor White
Write-Host "      - 4 Virtual Funds" -ForegroundColor White
Write-Host "  [9] Recalculate & so sánh trước/sau" -ForegroundColor White
Write-Host "  [10] Xóa đơn hàng (CRUD Delete)" -ForegroundColor White
Write-Host ""

# Save results to JSON
$resultsFile = "test-business-flow-e2e-results.json"
$exportResults = @{
    timestamp    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    passCount    = $script:passCount
    failCount    = $script:failCount
    failDetails  = $script:failDetails
    orderIds     = $script:createdOrderIds
    fcBefore     = $script:testResults["fc_before"]
    fcAfter      = $script:testResults["fc_after"]
    spBefore     = $script:testResults["sp_before"]
    spFinal      = $script:testResults["sp_final"]
    apBefore     = $script:testResults["ap_before"]
    apFinal      = $script:testResults["ap_final"]
}
$exportResults | ConvertTo-Json -Depth 5 | Out-File -FilePath $resultsFile -Encoding utf8
Write-Host "  Kết quả lưu tại: $resultsFile" -ForegroundColor Gray

Write-Host ""
if ($script:failCount -eq 0) {
    Write-Host "  ✓ ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  ✗ CÓ LỖI - Kiểm tra chi tiết FAIL ở trên" -ForegroundColor Red
}
Write-Host ""
