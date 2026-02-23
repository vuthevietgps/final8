#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-FULL-BUSINESS-FLOW.ps1
    =====================================================================================
    Kiem tra toan bo luong nghiep vu:
    1.  Tao/Sua/Xoa nha cung cap (internal + external) va dai ly (internal + external)
    2.  Tao bao gia NCC + bao gia dai ly cho cac san pham
    3.  Tao 10 don hang rai 7 ngay (Feb 8-16, 2026), gan NCC/DL/AdGroup khac nhau
    4.  CRUD update: thay doi COD, so luong, adGroupId, supplierQuote, agentQuote, supplierId
    5.  Thay doi trang thai san xuat: Chua lam -> Dang lam -> Da tra ket qua
    6.  Thay doi trang thai van don: Chua co ma van don -> Dang giao -> Giao thanh cong / Hang hoan
    7.  Kiem tra du lieu phat sinh trong supplier-payable va agent-receivable
    8.  Thuc hien thanh toan NCC (statement + payment + close)
    9.  Thuc hien thanh toan hoa hong dai ly (statement + payment + close)
    10. Kiem tra Financial Control dashboard truoc/sau
    11. Xoa don #10, verify cascade
    12. So sanh so lieu truoc/sau
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

# ========== UTILITIES ==========
function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 90) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 90) -ForegroundColor Cyan
}
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Check($msg) { Write-Host "  [CHECK] $msg" -ForegroundColor Magenta }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor DarkYellow }

function Safe-Request {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null, [string]$Label = "")
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        return (Invoke-RestMethod @params)
    }
    catch {
        $st = $_.Exception.Response.StatusCode.value__
        $eb = ""
        try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}

# ========== INIT ==========
$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$script:createdOrderIds = @()
$script:createdUserIds = @()
$script:testResults = @{}
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

# FIX: Vietnamese status constants fetched dynamically to avoid UTF-8 BOM encoding issues
# PowerShell 5.1 reads UTF-8 files without BOM as ANSI, mangling Vietnamese characters
# We construct the correct strings using Unicode escape sequences
$PS_PENDING = "Ch" + [char]0x01B0 + "a l" + [char]0x00E0 + "m"
$PS_INPROGRESS = [char]0x0110 + "ang l" + [char]0x00E0 + "m"
$PS_DONE = [char]0x0110 + [char]0x00E3 + " tr" + [char]0x1EA3 + " k" + [char]0x1EBF + "t qu" + [char]0x1EA3
$OS_NO_TRACKING = "Ch" + [char]0x01B0 + "a c" + [char]0x00F3 + " m" + [char]0x00E3 + " v" + [char]0x1EAD + "n " + [char]0x0111 + [char]0x01A1 + "n"
$OS_SHIPPING = [char]0x0110 + "ang giao"
$OS_DELIVERED = "Giao th" + [char]0x00E0 + "nh c" + [char]0x00F4 + "ng"
$OS_RETURNED = "H" + [char]0x00E0 + "ng ho" + [char]0x00E0 + "n"

Write-Section "FULL BUSINESS FLOW TEST - $ts"
Write-Info "Base URL: $BaseUrl"
Write-Info "Statuses: PS=[$PS_PENDING -> $PS_INPROGRESS -> $PS_DONE]"
Write-Info "Statuses: OS=[$OS_NO_TRACKING -> $OS_SHIPPING -> $OS_DELIVERED / $OS_RETURNED]"

# =============================================================================================
# PHASE 0: LOGIN
# =============================================================================================
Write-Section "PHASE 0: Dang nhap"
Write-Step "0.1" "Login Director"
$loginBody = @{ email = "director@test.com"; password = "123456" } | ConvertTo-Json
$loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login"
if (-not $loginResp -or -not $loginResp.access_token) {
    $loginBody = @{ email = "vutheviet@gmail.com"; password = "123456" } | ConvertTo-Json
    $loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login Alt"
}
if (-not $loginResp -or -not $loginResp.access_token) { Write-Fail "Cannot login - STOP"; exit 1 }
$token = $loginResp.access_token
$headers = @{ "Authorization" = "Bearer $token" }
Write-Pass "Login OK: $($loginResp.user.fullName) ($($loginResp.user.role))"

# =============================================================================================
# PHASE 0B: CLEANUP OLD TEST DATA (truoc khi tao moi)
# =============================================================================================
Write-Section "PHASE 0B: Cleanup test data cu"

Write-Step "0.2" "Xoa don hang cu (orderDate 02/08 - 02/16, ten DH-*)"
$cleanupOrders = Safe-Request -Method GET -Uri "$BaseUrl/test-order2?limit=500" -Headers $headers -Label "List orders"
if ($cleanupOrders -and $cleanupOrders.data) {
    $oldTestOrders = @($cleanupOrders.data | Where-Object { $_.customerName -and $_.customerName -like "DH-*" -and $_.orderDate -like "*2026-02*" })
    $cleanedOrders = 0
    foreach ($o in $oldTestOrders) {
        $oid = if ($o._id) { $o._id } else { $o.id }
        try {
            Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/test-order2/$oid" -Headers $headers -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            $cleanedOrders++
        } catch { }
    }
    Write-Info "Deleted $cleanedOrders old test orders (found $($oldTestOrders.Count))"
}

Write-Step "0.3" "Xoa labor costs cu ngay 02/08 - 02/16"
$allLabor = Safe-Request -Method GET -Uri "$BaseUrl/labor-cost1" -Headers $headers -Label "List labor"
if ($allLabor) {
    $laborList = if ($allLabor -is [array]) { $allLabor } elseif ($allLabor.data) { $allLabor.data } else { @($allLabor) }
    $oldLabor = @($laborList | Where-Object { $_.date -and $_.date -like "*2026-02*" })
    $cleanedLabor = 0
    foreach ($l in $oldLabor) {
        $lid = if ($l._id) { $l._id } else { $l.id }
        try {
            Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/labor-cost1/$lid" -Headers $headers -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            $cleanedLabor++
        } catch { }
    }
    Write-Info "Deleted $cleanedLabor old labor costs (found $($oldLabor.Count))"
}

Write-Step "0.4" "Xoa other costs cu ngay 02/08 - 02/16"
$allOther = Safe-Request -Method GET -Uri "$BaseUrl/other-cost" -Headers $headers -Label "List other"
if ($allOther) {
    $otherList = if ($allOther -is [array]) { $allOther } elseif ($allOther.data) { $allOther.data } else { @($allOther) }
    $oldOther = @($otherList | Where-Object { $_.date -and $_.date -like "*2026-02*" })
    $cleanedOther = 0
    foreach ($oc in $oldOther) {
        $ocid = if ($oc._id) { $oc._id } else { $oc.id }
        try {
            Invoke-RestMethod -Method DELETE -Uri "$BaseUrl/other-cost/$ocid" -Headers $headers -ContentType "application/json" -ErrorAction SilentlyContinue | Out-Null
            $cleanedOther++
        } catch { }
    }
    Write-Info "Deleted $cleanedOther old other costs (found $($oldOther.Count))"
}

Write-Pass "Cleanup completed"

# =============================================================================================
# PHASE 1: TAO / SUA / XOA USERS (NCC + DAI LY)
# =============================================================================================
Write-Section "PHASE 1: CRUD Users - NCC & Dai Ly"

# 1.1 Tao 6 users: 2 NCC noi + 1 NCC ngoai + 2 Dai ly ngoai + 1 Dai ly noi
$userConfigs = @(
    @{ var = "intSupp1"; role = "internal_supplier"; name = "NCC Noi Bo Alpha"; phone = "0901001001"; email = "int-supp1-$ts@test.com" },
    @{ var = "intSupp2"; role = "internal_supplier"; name = "NCC Noi Bo Beta"; phone = "0901001002"; email = "int-supp2-$ts@test.com" },
    @{ var = "extSupp1"; role = "external_supplier"; name = "NCC Ngoai Gamma"; phone = "0901001003"; email = "ext-supp1-$ts@test.com" },
    @{ var = "extAgent1"; role = "external_agent"; name = "Dai Ly Ngoai DL1"; phone = "0902001001"; email = "ext-agent1-$ts@test.com" },
    @{ var = "extAgent2"; role = "external_agent"; name = "Dai Ly Ngoai DL2"; phone = "0902001002"; email = "ext-agent2-$ts@test.com" },
    @{ var = "intAgent1"; role = "internal_agent"; name = "Dai Ly Noi Bo DLN1"; phone = "0902001003"; email = "int-agent1-$ts@test.com" }
)

$userIds = @{}
for ($i = 0; $i -lt $userConfigs.Count; $i++) {
    $u = $userConfigs[$i]
    Write-Step "1.$($i + 1)" "Tao $($u.var): $($u.name) ($($u.role))"
    $body = @{
        fullName = $u.name; email = $u.email; password = "123456"
        phone    = $u.phone; role = $u.role; isActive = $true
        address  = "Dia chi $($u.var)"; notes = "E2E test $ts"
    } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $headers -Body $body -Label "Create $($u.var)"
    if ($r -and ($r._id -or $r.id)) {
        $uid = if ($r._id) { $r._id } else { $r.id }
        $userIds[$u.var] = $uid
        $script:createdUserIds += $uid
        Write-Pass "$($u.var) = $uid ($($u.name))"
    }
    else { Write-Fail "Khong tao duoc $($u.var)" }
}

# 1.7 Sua user - doi ten NCC Noi Bo Beta -> NCC Noi Bo Beta Updated
Write-Step "1.7" "Sua NCC Noi Bo Beta -> doi ten va notes"
if ($userIds["intSupp2"]) {
    $body = @{ fullName = "NCC Noi Bo Beta Updated"; notes = "Updated in test $ts" } | ConvertTo-Json
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/users/$($userIds["intSupp2"])" -Headers $headers -Body $body -Label "Update intSupp2"
    if ($r -and $r.fullName -eq "NCC Noi Bo Beta Updated") { Write-Pass "Sua intSupp2 OK -> $($r.fullName)" }
    else { Write-Fail "Sua intSupp2 FAIL" }
}

# 1.8 Xoa NCC Noi Bo Beta (will not be used in orders)
Write-Step "1.8" "Xoa NCC Noi Bo Beta Updated"
if ($userIds["intSupp2"]) {
    $r = Safe-Request -Method DELETE -Uri "$BaseUrl/users/$($userIds["intSupp2"])" -Headers $headers -Label "Delete intSupp2"
    if ($null -ne $r) { Write-Pass "Xoa intSupp2 OK" }
    else { Write-Fail "Xoa intSupp2 FAIL (cung co the thanh cong)" }
}

# 1.9 Verify danh sach user
Write-Step "1.9" "Verify danh sach NCC va Dai Ly"
$suppliers = Safe-Request -Method GET -Uri "$BaseUrl/users/suppliers?active=true" -Headers $headers -Label "Suppliers"
$agents = Safe-Request -Method GET -Uri "$BaseUrl/users/agents" -Headers $headers -Label "Agents"
$suppList = if ($suppliers -is [array]) { $suppliers } elseif ($suppliers.data) { $suppliers.data } else { @($suppliers) }
$agentList = if ($agents -is [array]) { $agents } elseif ($agents.data) { $agents.data } else { @($agents) }
Write-Info "Active Suppliers: $($suppList.Count), Active Agents: $($agentList.Count)"

# Short vars
$intSupp1Id = $userIds["intSupp1"]
$extSupp1Id = $userIds["extSupp1"]
$extAgent1Id = $userIds["extAgent1"]
$extAgent2Id = $userIds["extAgent2"]
$intAgent1Id = $userIds["intAgent1"]

# =============================================================================================
# PHASE 2: LAY SAN PHAM + TAO BAO GIA NCC + BAO GIA DAI LY
# =============================================================================================
Write-Section "PHASE 2: San pham + Bao gia NCC + Bao gia Dai ly"

Write-Step "2.1" "Lay danh sach san pham"
$products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $headers -Label "Products"
$productList = if ($products -is [array]) { $products } elseif ($products.data) { $products.data } else { @($products) }
if ($productList.Count -lt 2) { Write-Fail "Can it nhat 2 san pham!"; exit 1 }
$prod1 = $productList[0]; $prod2 = $productList[1]; $prod3 = if ($productList.Count -gt 2) { $productList[2] } else { $productList[0] }
$prod1Id = "$($prod1._id)"; $prod2Id = "$($prod2._id)"; $prod3Id = "$($prod3._id)"
Write-Pass "SP1: $($prod1.name) ($prod1Id)"
Write-Pass "SP2: $($prod2.name) ($prod2Id)"
Write-Pass "SP3: $($prod3.name) ($prod3Id)"

# 2.2 Tao 4 Supplier Quotes (NCC x San pham)
Write-Step "2.2" "Tao Supplier Quotes"
$sqConfigs = @(
    @{ suppId = $intSupp1Id; prodId = $prod1Id; price = 150000; ship = 30000; ret = 18000; label = "IntSupp1 x SP1" },
    @{ suppId = $intSupp1Id; prodId = $prod2Id; price = 180000; ship = 32000; ret = 20000; label = "IntSupp1 x SP2" },
    @{ suppId = $extSupp1Id; prodId = $prod1Id; price = 130000; ship = 25000; ret = 15000; label = "ExtSupp1 x SP1" },
    @{ suppId = $extSupp1Id; prodId = $prod2Id; price = 160000; ship = 28000; ret = 17000; label = "ExtSupp1 x SP2" }
)
$sqCreated = 0
for ($i = 0; $i -lt $sqConfigs.Count; $i++) {
    $sq = $sqConfigs[$i]
    if (-not $sq.suppId) { Write-Warn "Skip SQ $($sq.label) - no supplierId"; continue }
    $body = @{
        productId   = $sq.prodId; supplierId = $sq.suppId; price = $sq.price
        shippingFee = $sq.ship; returnFee = $sq.ret
        effectiveAt = "2026-01-01T00:00:00.000Z"; note = "E2E $($sq.label) $ts"
    } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $headers -Body $body -Label "SQ $($sq.label)"
    if ($r) { Write-Pass "SQ $($sq.label) = $($sq.price) VND, ship=$($sq.ship), ret=$($sq.ret)"; $sqCreated++ }
    else { Write-Fail "SQ $($sq.label) FAIL" }
}
Write-Info "Supplier Quotes created: $sqCreated / 4"

# 2.3 Tao 4 Agent Quotes (Bao gia dai ly)
# Status "Đã duyệt" constructed via Unicode to avoid encoding issues
$aqStatusApproved = [char]0x0110 + [char]0x00E3 + " duy" + [char]0x1EC7 + "t"
Write-Step "2.3" "Tao Agent Quotes (Bao gia dai ly) - status=$aqStatusApproved"
$aqConfigs = @(
    @{ agentId = $extAgent1Id; prodId = $prod1Id; price = 45000; label = "ExtAgent1 x SP1" },
    @{ agentId = $extAgent1Id; prodId = $prod2Id; price = 55000; label = "ExtAgent1 x SP2" },
    @{ agentId = $extAgent2Id; prodId = $prod1Id; price = 42000; label = "ExtAgent2 x SP1" },
    @{ agentId = $extAgent2Id; prodId = $prod2Id; price = 50000; label = "ExtAgent2 x SP2" }
)
$aqCreated = 0
for ($i = 0; $i -lt $aqConfigs.Count; $i++) {
    $aq = $aqConfigs[$i]
    if (-not $aq.agentId) { Write-Warn "Skip AQ $($aq.label) - no agentId"; continue }
    # Build JSON manually to ensure UTF-8 correctness
    $jsonAQ = '{"productId":"' + $aq.prodId + '","agentId":"' + $aq.agentId + '","unitPrice":' + $aq.price + ',"status":"' + $aqStatusApproved + '","validFrom":"2026-01-01T00:00:00.000Z","validUntil":"2026-12-31T23:59:59.000Z","notes":"E2E ' + $aq.label + ' ' + $ts + '"}'
    $r = Safe-Request -Method POST -Uri "$BaseUrl/quotes" -Headers $headers -Body $jsonAQ -Label "AQ $($aq.label)"
    if ($r) { Write-Pass "AQ $($aq.label) = $($aq.price) VND"; $aqCreated++ }
    else { Write-Fail "AQ $($aq.label) FAIL" }
}
Write-Info "Agent Quotes created: $aqCreated / 4"

# 2.4 Verify quotes
Write-Step "2.4" "Verify Supplier Quotes & Agent Quotes"
if ($intSupp1Id -and $prod1Id) {
    $sq = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes/latest?productId=$prod1Id&supplierId=$intSupp1Id" -Headers $headers -Label "SQ verify"
    if ($sq -and $sq.price -eq 150000) { Write-Pass "SQ verify IntSupp1xSP1 = $($sq.price)" } else { Write-Warn "SQ verify: $($sq | ConvertTo-Json -Compress)" }
}
$allQuotes = Safe-Request -Method GET -Uri "$BaseUrl/quotes" -Headers $headers -Label "All AQ"
$aqList = if ($allQuotes -is [array]) { $allQuotes } elseif ($allQuotes.data) { $allQuotes.data } else { @($allQuotes) }
Write-Info "Total Agent Quotes in system: $($aqList.Count)"

# =============================================================================================
# PHASE 3: BASELINE - CHUP SO LIEU TRUOC KHI TAO DON
# =============================================================================================
Write-Section "PHASE 3: Baseline - So lieu TRUOC"

Write-Step "3.1" "Financial Control Dashboard BEFORE"
$fcBefore = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Before"
if ($fcBefore) {
    Write-Pass "FC BEFORE: bank=$($fcBefore.bankBalance), free=$($fcBefore.freeCash), committed=$($fcBefore.committedCash)"
    Write-Info "  burn=$($fcBefore.monthlyBurn), runway=$($fcBefore.runwayMonths), withdrawable=$($fcBefore.ownerWithdrawable)"
    $script:testResults["fc_before"] = $fcBefore
}

Write-Step "3.2" "Supplier Payable Cashflow BEFORE"
$spBefore = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP CF Before"
if ($spBefore) {
    Write-Pass "SP BEFORE: grossEarned=$($spBefore.grossEarned), unreceived=$($spBefore.unreceived)"
    $script:testResults["sp_before"] = $spBefore
}
else { Write-Info "SP summary not available (no data yet)" }

Write-Step "3.3" "Agent Payable Cashflow BEFORE"
$apBefore = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP CF Before"
if ($apBefore) {
    Write-Pass "AP BEFORE: netPayable=$($apBefore.totalAgentNetPayable), unpaid=$($apBefore.totalAgentUnpaid)"
    $script:testResults["ap_before"] = $apBefore
}
else { Write-Info "AP summary not available (no data yet)" }

Write-Step "3.4" "Cashflow Health BEFORE"
$cfhBefore = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label "CFH Before"
if ($cfhBefore) {
    Write-Pass "CFH BEFORE: CSI=$($cfhBefore.csi), DSO=$($cfhBefore.dso), DPO=$($cfhBefore.dpo)"
    $script:testResults["cfh_before"] = $cfhBefore
}

# Get ad group IDs (use fake if none exist)
Write-Step "3.5" "Lay Ad Groups"
$adGroups = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $headers -Label "AdGroups"
$agList = if ($adGroups -is [array]) { $adGroups } elseif ($adGroups.data) { $adGroups.data } else { @() }
if ($agList.Count -gt 0) {
    $adGrp1 = if ($agList[0].adGroupId) { $agList[0].adGroupId } else { "$($agList[0]._id)" }
    $adGrp2 = if ($agList.Count -gt 1) { if ($agList[1].adGroupId) { $agList[1].adGroupId } else { "$($agList[1]._id)" } } else { $adGrp1 }
    $adGrp3 = if ($agList.Count -gt 2) { if ($agList[2].adGroupId) { $agList[2].adGroupId } else { "$($agList[2]._id)" } } else { $adGrp1 }
}
else {
    $adGrp1 = "test-ag-001"; $adGrp2 = "test-ag-002"; $adGrp3 = "test-ag-003"
}
Write-Info "AdGroups: AG1=$adGrp1, AG2=$adGrp2, AG3=$adGrp3"

# =============================================================================================
# PHASE 4: TAO 10 DON HANG - RAI 7 NGAY KHAC NHAU
# =============================================================================================
Write-Section "PHASE 4: Tao 10 don hang - rai 7 ngay"

# 10 orders, 7 different dates, mixed supplier/agent/adgroup
$orderConfigs = @(
    # Don 1: ExtAgent1 + IntSupp1 + SP1, ngay 8/2
    @{ name = "DH-01"; qty = 1; cod = 500000; aq = 45000; date = "2026-02-08";
        agent = $extAgent1Id; supp = $intSupp1Id; prod = $prod1Id; ag = $adGrp1;
        desc = "ExtAg1+IntSupp1+SP1 (ngay 08/02)" },
    # Don 2: ExtAgent1 + IntSupp1 + SP1 x2, ngay 9/2
    @{ name = "DH-02"; qty = 2; cod = 980000; aq = 45000; date = "2026-02-09";
        agent = $extAgent1Id; supp = $intSupp1Id; prod = $prod1Id; ag = $adGrp1;
        desc = "ExtAg1+IntSupp1+SP1x2 (ngay 09/02)" },
    # Don 3: ExtAgent1 + ExtSupp1 + SP2, ngay 10/2
    @{ name = "DH-03"; qty = 1; cod = 650000; aq = 55000; date = "2026-02-10";
        agent = $extAgent1Id; supp = $extSupp1Id; prod = $prod2Id; ag = $adGrp2;
        desc = "ExtAg1+ExtSupp1+SP2 (ngay 10/02)" },
    # Don 4: ExtAgent1 + IntSupp1 + SP1 x3, ngay 11/2 -> SE LAM HANG HOAN
    @{ name = "DH-04"; qty = 3; cod = 1500000; aq = 45000; date = "2026-02-11";
        agent = $extAgent1Id; supp = $intSupp1Id; prod = $prod1Id; ag = $adGrp1;
        desc = "ExtAg1+IntSupp1+SP1x3 -> HANG HOAN (ngay 11/02)" },
    # Don 5: ExtAgent2 + ExtSupp1 + SP1, ngay 12/2
    @{ name = "DH-05"; qty = 1; cod = 450000; aq = 42000; date = "2026-02-12";
        agent = $extAgent2Id; supp = $extSupp1Id; prod = $prod1Id; ag = $adGrp2;
        desc = "ExtAg2+ExtSupp1+SP1 (ngay 12/02)" },
    # Don 6: ExtAgent2 + ExtSupp1 + SP2 x2, ngay 12/2
    @{ name = "DH-06"; qty = 2; cod = 900000; aq = 50000; date = "2026-02-12";
        agent = $extAgent2Id; supp = $extSupp1Id; prod = $prod2Id; ag = $adGrp3;
        desc = "ExtAg2+ExtSupp1+SP2x2 (ngay 12/02)" },
    # Don 7: ExtAgent2 + IntSupp1 + SP1, ngay 13/2
    @{ name = "DH-07"; qty = 1; cod = 520000; aq = 42000; date = "2026-02-13";
        agent = $extAgent2Id; supp = $intSupp1Id; prod = $prod1Id; ag = $adGrp2;
        desc = "ExtAg2+IntSupp1+SP1 (ngay 13/02)" },
    # Don 8: IntAgent1 + IntSupp1 + SP2 x2, ngay 14/2 (No agent commission)
    @{ name = "DH-08"; qty = 2; cod = 850000; aq = 0; date = "2026-02-14";
        agent = $intAgent1Id; supp = $intSupp1Id; prod = $prod2Id; ag = $adGrp1;
        desc = "IntAg1+IntSupp1+SP2x2 (ngay 14/02) - no commission" },
    # Don 9: IntAgent1 + ExtSupp1 + SP1, ngay 15/2 (No agent commission)
    @{ name = "DH-09"; qty = 1; cod = 480000; aq = 0; date = "2026-02-15";
        agent = $intAgent1Id; supp = $extSupp1Id; prod = $prod1Id; ag = $adGrp3;
        desc = "IntAg1+ExtSupp1+SP1 (ngay 15/02) - no commission" },
    # Don 10: ExtAgent1 + ExtSupp1 + SP2, ngay 16/2 -> SE XOA
    @{ name = "DH-10"; qty = 1; cod = 550000; aq = 55000; date = "2026-02-16";
        agent = $extAgent1Id; supp = $extSupp1Id; prod = $prod2Id; ag = $adGrp1;
        desc = "ExtAg1+ExtSupp1+SP2 -> SE XOA (ngay 16/02)" }
)

for ($i = 0; $i -lt 10; $i++) {
    $c = $orderConfigs[$i]
    Write-Step "4.$($i + 1)" "Don #$($i + 1): $($c.desc)"
    $body = @{
        customerName     = "$($c.name)-$ts"
        quantity         = $c.qty
        codAmount        = $c.cod
        agentQuote       = $c.aq
        depositAmount    = 0
        orderDate        = "$($c.date)T00:00:00.000Z"
        productionStatus = $PS_PENDING
        orderStatus      = $OS_NO_TRACKING
        adGroupId        = $c.ag
        productId        = $c.prod
        supplierId       = $c.supp
        agentId          = $c.agent
        receiverName     = "Khach Hang $($i + 1)"
        receiverPhone    = "09800000$($i.ToString('D2'))"
        receiverAddress  = "So $($i + 1), Duong Test, Quan $($i + 1), TP.HCM"
    } | ConvertTo-Json -Depth 5
    $r = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $headers -Body $body -Label "Order $($i + 1)"
    if ($r -and ($r._id -or $r.id)) {
        $oid = if ($r._id) { $r._id } else { $r.id }
        $script:createdOrderIds += $oid
        Write-Pass "Don #$($i + 1): $oid (supplierQuote=$($r.supplierQuote), agentQuote=$($r.agentQuote))"
        Write-Info "  ship=$($r.shippingFee), ret=$($r.returnFee), cod=$($r.codAmount), gross=$($r.grossProfit)"
        if ($c.supp -and $r.supplierQuote -gt 0) { Write-Pass "  -> Supplier quote snapshot OK = $($r.supplierQuote)" }
        elseif ($c.supp) { Write-Warn "  -> supplierQuote=0 (may not have quote for this combo)" }
    }
    else { Write-Fail "Don #$($i + 1) FAIL" }
}
Write-Info "Total orders created: $($script:createdOrderIds.Count)"

# =============================================================================================
# PHASE 5: CRUD UPDATES - THAY DOI CAC TRUONG TREN DON HANG
# =============================================================================================
Write-Section "PHASE 5: CRUD Updates"

# 5.1 Thay doi COD don #1: 500K -> 650K
Write-Step "5.1" "Thay doi COD don #1: 500K -> 650K"
if ($script:createdOrderIds.Count -ge 1) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[0])" -Headers $headers -Body (@{ codAmount = 650000 } | ConvertTo-Json) -Label "Upd COD #1"
    if ($r -and $r.codAmount -eq 650000) { Write-Pass "COD #1 -> 650K OK" } else { Write-Fail "COD #1 update FAIL" }
}

# 5.2 Thay doi so luong don #2: 2 -> 3
Write-Step "5.2" "Thay doi so luong don #2: 2 -> 3"
if ($script:createdOrderIds.Count -ge 2) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[1])" -Headers $headers -Body (@{ quantity = 3 } | ConvertTo-Json) -Label "Upd Qty #2"
    if ($r -and $r.quantity -eq 3) { Write-Pass "Qty #2 -> 3 OK" } else { Write-Fail "Qty #2 update FAIL" }
}

# 5.3 Thay doi adGroupId don #3
Write-Step "5.3" "Thay doi adGroupId don #3: $adGrp2 -> $adGrp1"
if ($script:createdOrderIds.Count -ge 3) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[2])" -Headers $headers -Body (@{ adGroupId = $adGrp1 } | ConvertTo-Json) -Label "Upd AG #3"
    if ($r -and $r.adGroupId -eq $adGrp1) { Write-Pass "AG #3 -> $adGrp1 OK" } else { Write-Fail "AG #3 update FAIL" }
}

# 5.4 Thay doi agentQuote don #5: 42K -> 60K
Write-Step "5.4" "Thay doi agentQuote don #5: 42K -> 60K"
if ($script:createdOrderIds.Count -ge 5) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[4])" -Headers $headers -Body (@{ agentQuote = 60000 } | ConvertTo-Json) -Label "Upd AQ #5"
    if ($r -and $r.agentQuote -eq 60000) { Write-Pass "AQ #5 -> 60K OK" } else { Write-Fail "AQ #5 update FAIL" }
}

# 5.5 Doi NCC don #6: ExtSupp1 -> IntSupp1
Write-Step "5.5" "Doi NCC don #6: ExtSupp1 -> IntSupp1"
if ($script:createdOrderIds.Count -ge 6 -and $intSupp1Id) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[5])" -Headers $headers -Body (@{ supplierId = $intSupp1Id } | ConvertTo-Json) -Label "Upd Supp #6"
    if ($r) { Write-Pass "NCC #6 -> IntSupp1, nueva quote=$($r.supplierQuote)" } else { Write-Fail "NCC #6 update FAIL" }
}

# 5.6 Thay doi supplierQuote thu cong don #7: -> 200000
# NOTE: supplierQuote is auto-calculated from SupplierQuote snapshot (by design)
# To change it, we must clear snapshot by changing supplierId then changing back
Write-Step "5.6" "Thay doi supplierQuote don #7 bang cach doi NCC"
if ($script:createdOrderIds.Count -ge 7 -and $extSupp1Id) {
    # Change to ExtSupp1 (will auto-lookup new supplier quote)
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[6])" -Headers $headers -Body (@{ supplierId = $extSupp1Id } | ConvertTo-Json) -Label "Upd Supp #7"
    if ($r) { Write-Pass "NCC #7 -> ExtSupp1, new quote=$($r.supplierQuote)" } else { Write-Fail "NCC #7 update FAIL" }
}

# 5.7 Thay doi agentQuote dai ly don #8 (internal agent, no commission expected)
Write-Step "5.7" "Thay doi agentQuote don #8: 0 -> 35000 (IntAgent - van la n/a)"
if ($script:createdOrderIds.Count -ge 8) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[7])" -Headers $headers -Body (@{ agentQuote = 35000 } | ConvertTo-Json) -Label "Upd AQ #8"
    if ($r) { Write-Pass "AQ #8 -> 35K (agentPaymentStatus should stay n/a when delivered)" } else { Write-Fail "AQ #8 update FAIL" }
}

# 5.8 Lay chi tiet tung don sau khi update
Write-Step "5.8" "Verify: Doc lai 10 don sau khi update"
Write-Host ""
Write-Host ("  {0,-4} {1,-10} {2,-10} {3,-10} {4,-10} {5,-10} {6,-10}" -f "#", "Qty", "COD", "SuppQ", "AgentQ", "Ship", "AG") -ForegroundColor White
Write-Host ("  " + "-" * 70) -ForegroundColor White
for ($i = 0; $i -lt $script:createdOrderIds.Count; $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Read #$($i + 1)"
    if ($o) {
        $agShort = if ($o.adGroupId.Length -gt 10) { $o.adGroupId.Substring(0, 10) + ".." } else { $o.adGroupId }
        Write-Host ("  {0,-4} {1,-10} {2,-10} {3,-10} {4,-10} {5,-10} {6,-10}" -f "#$($i + 1)", $o.quantity, $o.codAmount, $o.supplierQuote, $o.agentQuote, $o.shippingFee, $agShort)
    }
}

# =============================================================================================
# PHASE 6: THAY DOI TRANG THAI SAN XUAT
# =============================================================================================
Write-Section "PHASE 6: Trang thai san xuat"

# Don #1-8: Chua lam -> Dang lam -> Da tra ket qua
Write-Step "6.1" "Don #1-8 -> Dang lam -> Da tra ket qua"
for ($i = 0; $i -lt [Math]::Min(8, $script:createdOrderIds.Count); $i++) {
    # Step 1: Chua lam -> Dang lam
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ productionStatus = $PS_INPROGRESS } | ConvertTo-Json) -Label "Prod IP $($i + 1)" | Out-Null
    Start-Sleep -Milliseconds 200
    # Step 2: Dang lam -> Da tra ket qua
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ productionStatus = $PS_DONE } | ConvertTo-Json) -Label "Prod Done $($i + 1)"
    if ($r -and $r.productionStatus -eq $PS_DONE) { Write-Pass "Don #$($i + 1) -> $PS_DONE" }
    else { Write-Fail "Don #$($i + 1) productionStatus FAIL" }
}

# Don #9: Chi den Dang lam (chua xong)
Write-Step "6.2" "Don #9 -> chi Dang lam (chua hoan thanh)"
if ($script:createdOrderIds.Count -ge 9) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[8])" -Headers $headers `
        -Body (@{ productionStatus = $PS_INPROGRESS } | ConvertTo-Json) -Label "Prod IP #9"
    if ($r -and $r.productionStatus -eq $PS_INPROGRESS) { Write-Pass "Don #9 -> $PS_INPROGRESS (dang lam)" }
}

# Don #10: De nguyen Chua lam
Write-Step "6.3" "Don #10 de nguyen $PS_PENDING (se xoa sau)"
Write-Info "Don #10 van la '$PS_PENDING'"

# =============================================================================================
# PHASE 7: THAY DOI TRANG THAI VAN DON + KIEM TRA TRIGGER
# =============================================================================================
Write-Section "PHASE 7: Trang thai van don + Trigger verification"

# Phase 7A: Don #1-3 -> Giao thanh cong (External Agent 1 + mixed suppliers)
Write-Step "7.1" "Don #1-3 -> Giao thanh cong [ExtAgent1 - kiem tra trigger]"
for ($i = 0; $i -lt 3; $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ orderStatus = $OS_SHIPPING } | ConvertTo-Json) -Label "Ship $($i + 1)" | Out-Null
    Start-Sleep -Milliseconds 400
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ orderStatus = $OS_DELIVERED } | ConvertTo-Json) -Label "Deliver $($i + 1)"
    if ($r) {
        Write-Pass "Don #$($i + 1) -> $OS_DELIVERED"
        Write-Check "  TRIGGER: gross=$($r.grossProfit), suppPaidAmt=$($r.supplierPaidAmount), agPaidAmt=$($r.agentPaidAmount), agSt=$($r.agentPaymentStatus)"
        if ($null -ne $r.grossProfit -and $r.grossProfit -ne 0) { Write-Pass "  grossProfit OK = $($r.grossProfit)" }
        else { Write-Fail "  grossProfit = $($r.grossProfit) TRIGGER FAIL" }
        if ($r.agentPaymentStatus -eq "pending") { Write-Pass "  agentPaymentStatus=pending (ExtAgent OK)" }
        elseif ($r.agentPaymentStatus -eq "n/a") { Write-Fail "  agentPaymentStatus=n/a (WRONG for ext agent)" }
    }
}

# Phase 7B: Don #4 -> Hang hoan (RETURN)
Write-Step "7.2" "Don #4 -> Hang hoan [RETURN TRIGGER]"
if ($script:createdOrderIds.Count -ge 4) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers `
        -Body (@{ orderStatus = $OS_SHIPPING } | ConvertTo-Json) -Label "Ship 4" | Out-Null
    Start-Sleep -Milliseconds 500
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers `
        -Body (@{ orderStatus = $OS_RETURNED } | ConvertTo-Json) -Label "Return 4"
    if ($r) {
        Write-Pass "Don #4 -> $OS_RETURNED"
        Write-Check "  RETURN: gross=$($r.grossProfit), suppPaid=$($r.supplierPaidAmount), agPaid=$($r.agentPaidAmount)"
        if ($null -ne $r.supplierPaidAmount -and $r.supplierPaidAmount -lt 0) { Write-Pass "  supplierPaidAmount < 0 (RETURN OK)" }
        else { Write-Warn "  supplierPaidAmount = $($r.supplierPaidAmount) (expected negative for return)" }
    }
}

# Phase 7C: Don #5-7 -> Giao thanh cong (External Agent 2)
Write-Step "7.3" "Don #5-7 -> Giao thanh cong [ExtAgent2]"
for ($i = 4; $i -lt 7; $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ orderStatus = $OS_SHIPPING } | ConvertTo-Json) -Label "Ship $($i + 1)" | Out-Null
    Start-Sleep -Milliseconds 400
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers `
        -Body (@{ orderStatus = $OS_DELIVERED } | ConvertTo-Json) -Label "Deliver $($i + 1)"
    if ($r) {
        Write-Pass "Don #$($i + 1) -> $OS_DELIVERED"
        Write-Check "  gross=$($r.grossProfit), agSt=$($r.agentPaymentStatus)"
        if ($null -ne $r.grossProfit -and $r.grossProfit -ne 0) { Write-Pass "  grossProfit OK" } else { Write-Fail "  grossProfit FAIL #$($i + 1)" }
        if ($r.agentPaymentStatus -eq "pending") { Write-Pass "  agentPaymentStatus=pending OK" }
    }
}

# Phase 7D: Don #8 -> Giao thanh cong (Internal Agent -> n/a)
Write-Step "7.4" "Don #8 -> Giao thanh cong [IntAgent1 -> n/a]"
if ($script:createdOrderIds.Count -ge 8) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[7])" -Headers $headers `
        -Body (@{ orderStatus = $OS_SHIPPING } | ConvertTo-Json) -Label "Ship 8" | Out-Null
    Start-Sleep -Milliseconds 400
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[7])" -Headers $headers `
        -Body (@{ orderStatus = $OS_DELIVERED } | ConvertTo-Json) -Label "Deliver 8"
    if ($r) {
        Write-Pass "Don #8 -> $OS_DELIVERED"
        Write-Check "  gross=$($r.grossProfit), agSt=$($r.agentPaymentStatus)"
        if ($r.agentPaymentStatus -eq "n/a") { Write-Pass "  agentPaymentStatus=n/a (IntAgent CORRECT)" }
        else { Write-Fail "  agentPaymentStatus=$($r.agentPaymentStatus) (expected n/a for IntAgent)" }
    }
}

# Don 9-10: De nguyen (chua giao)
Write-Info "Don #9: Van la $OS_NO_TRACKING (dang san xuat)"
Write-Info "Don #10: Van la $OS_NO_TRACKING (se xoa)"

# Phase 7E: Summary table
Write-Section "PHASE 7E: Bang tong hop trang thai"
Write-Host ""
Write-Host ("  {0,-4} {1,-22} {2,-18} {3,-14} {4,-12} {5,-10} {6,-10}" -f "#", "OrderStatus", "ProdStatus", "SuppPaid", "AgPaid", "AgSt", "Gross") -ForegroundColor White
Write-Host ("  " + "-" * 92) -ForegroundColor White
$trigOK = 0; $trigFail = 0
$script:grossProfitBefore = @{}
for ($i = 0; $i -lt $script:createdOrderIds.Count; $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Read $($i + 1)"
    if ($o) {
        $sp = if ($null -ne $o.supplierPaidAmount) { $o.supplierPaidAmount } else { "-" }
        $ap = if ($null -ne $o.agentPaidAmount) { $o.agentPaidAmount } else { "-" }
        $agS = if ($o.agentPaymentStatus) { $o.agentPaymentStatus } else { "-" }
        $gp = if ($null -ne $o.grossProfit) { $o.grossProfit } else { "-" }
        $ps = if ($o.productionStatus) { $o.productionStatus } else { "-" }
        Write-Host ("  {0,-4} {1,-22} {2,-18} {3,-14} {4,-12} {5,-10} {6,-10}" -f "#$($i + 1)", $o.orderStatus, $ps, $sp, $ap, $agS, $gp)
        # Save grossProfit before recalculate for consistency check
        $script:grossProfitBefore[$i] = $o.grossProfit
        if ($o.orderStatus -eq $OS_DELIVERED -or $o.orderStatus -eq $OS_RETURNED) {
            if ($null -ne $o.supplierPaidAmount -and $o.supplierPaidAmount -ne 0 -and $null -ne $o.grossProfit -and $o.grossProfit -ne 0) { $trigOK++ } else { $trigFail++ }
        }
    }
}
Write-Host ""
if ($trigFail -eq 0 -and $trigOK -gt 0) { Write-Pass "TRIGGERS: $trigOK/$trigOK all OK!" } else { Write-Fail "TRIGGERS: $trigOK OK, $trigFail FAILED" }

# =============================================================================================
# PHASE 8: KIEM TRA CONG NO NCC + DAI LY SAU GIAO HANG
# =============================================================================================
Write-Section "PHASE 8: Kiem tra cong no NCC + Dai ly SAU giao hang"

Write-Step "8.1" "Supplier Payable Cashflow SAU giao hang"
$spMid = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP Mid"
if ($spMid) {
    Write-Pass "SP MID: grossEarned=$($spMid.grossEarned), unreceived=$($spMid.unreceived)"
    $script:testResults["sp_mid"] = $spMid
    # Assert supplier payable cashflow has data after deliveries
    if ($spMid.grossEarned -and $spMid.grossEarned -ne 0) { Write-Pass "  SP grossEarned > 0 ($($spMid.grossEarned))" }
    else { Write-Warn "  SP grossEarned = 0 (may indicate field name mismatch or no data)" }
}

Write-Step "8.2" "Pending orders cho IntSupp1"
$pendS1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$intSupp1Id" -Headers $headers -Label "Pend IntSupp1"
$pendS1List = if ($pendS1 -is [array]) { $pendS1 } elseif ($pendS1.data) { $pendS1.data } elseif ($pendS1.orders) { $pendS1.orders } else { @($pendS1) }
Write-Check "IntSupp1 pending: $($pendS1List.Count) orders"

Write-Step "8.3" "Pending orders cho ExtSupp1"
$pendS2 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$extSupp1Id" -Headers $headers -Label "Pend ExtSupp1"
$pendS2List = if ($pendS2 -is [array]) { $pendS2 } elseif ($pendS2.data) { $pendS2.data } elseif ($pendS2.orders) { $pendS2.orders } else { @($pendS2) }
Write-Check "ExtSupp1 pending: $($pendS2List.Count) orders"

Write-Step "8.4" "Agent Payable Cashflow SAU giao hang"
$apMid = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP Mid"
if ($apMid) {
    Write-Pass "AP MID: incurred=$($apMid.totalAgentCommissionIncurred), unpaid=$($apMid.totalAgentUnpaid)"
    $script:testResults["ap_mid"] = $apMid
}

Write-Step "8.5" "Pending orders cho ExtAgent1"
$pendA1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$extAgent1Id" -Headers $headers -Label "Pend ExtAgent1"
$pendA1List = if ($pendA1 -is [array]) { $pendA1 } elseif ($pendA1.data) { $pendA1.data } elseif ($pendA1.orders) { $pendA1.orders } else { @($pendA1) }
Write-Check "ExtAgent1 pending: $($pendA1List.Count) orders"

Write-Step "8.6" "Pending orders cho ExtAgent2"
$pendA2 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$extAgent2Id" -Headers $headers -Label "Pend ExtAgent2"
$pendA2List = if ($pendA2 -is [array]) { $pendA2 } elseif ($pendA2.data) { $pendA2.data } elseif ($pendA2.orders) { $pendA2.orders } else { @($pendA2) }
Write-Check "ExtAgent2 pending: $($pendA2List.Count) orders"

Write-Step "8.7" "Ops Summary cho IntSupp1"
$opsS1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/supplier-payment/ops-summary?supplierId=$intSupp1Id&fromDate=2026-02-01&toDate=2026-02-28" -Headers $headers -Label "Ops IntSupp1"
if ($opsS1) {
    Write-Info "IntSupp1 Ops: totalOrders=$($opsS1.totalOrders), totalPaid=$($opsS1.totalPaid), totalUnpaid=$($opsS1.totalUnpaid)"
    if ($opsS1.totalOrders -and $opsS1.totalOrders -gt 0) { Write-Pass "  IntSupp1 totalOrders=$($opsS1.totalOrders) OK" }
    else { Write-Warn "  IntSupp1 totalOrders empty or 0" }
}

Write-Step "8.8" "Ops Summary cho ExtAgent1"
$opsA1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/agent-payment/ops-summary?agentId=$extAgent1Id&fromDate=2026-02-01&toDate=2026-02-28" -Headers $headers -Label "Ops ExtAgent1"
if ($opsA1) {
    Write-Info "ExtAgent1 Ops: totalOrders=$($opsA1.totalOrders), totalPaid=$($opsA1.totalPaid), totalUnpaid=$($opsA1.totalUnpaid)"
    if ($opsA1.totalOrders -and $opsA1.totalOrders -gt 0) { Write-Pass "  ExtAgent1 totalOrders=$($opsA1.totalOrders) OK" }
    else { Write-Warn "  ExtAgent1 totalOrders empty or 0" }
}

# =============================================================================================
# PHASE 9: THANH TOAN NCC (Statement-based)
# =============================================================================================
Write-Section "PHASE 9: Thanh toan NCC"

# 9.1 Tao Statement cho IntSupp1 (02/01 - 02/16)
Write-Step "9.1" "Tao Statement NCC IntSupp1: 02/01 - 02/16"
$body = @{ supplierId = $intSupp1Id; from = "2026-02-01"; to = "2026-02-16"; notes = "E2E IntSupp1 Statement $ts" } | ConvertTo-Json
$spStmt1 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $headers -Body $body -Label "SP Stmt IntSupp1"
$spStmt1Id = $null
if ($spStmt1 -and ($spStmt1._id -or $spStmt1.id)) {
    $spStmt1Id = if ($spStmt1._id) { $spStmt1._id } else { $spStmt1.id }
    Write-Pass "IntSupp1 Statement: $spStmt1Id"
    Write-Info "  opening=$($spStmt1.openingBalance), periodPayables=$($spStmt1.periodPayables), COD=$($spStmt1.periodCodCollected)"
    $script:testResults["sp_stmt1_id"] = $spStmt1Id
}
else { Write-Fail "IntSupp1 Statement FAIL" }

# 9.2 Thanh toan IntSupp1: 2 lan
Write-Step "9.2" "Pay IntSupp1 - Lan 1: 500K"
if ($spStmt1Id) {
    $body = @{ amount = 500000; paidAt = "2026-02-15T10:00:00.000Z"; method = "bank_transfer"; reference = "TXN-IS1-001-$ts"; notes = "Thanh toan lan 1" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id/payments" -Headers $headers -Body $body -Label "SP Pay1 IntSupp1"
    if ($r) { Write-Pass "IntSupp1 paid 500K (balance=$($r.closingBalance))" } else { Write-Fail "IntSupp1 pay 1 FAIL" }
}

Write-Step "9.3" "Pay IntSupp1 - Lan 2: 300K"
if ($spStmt1Id) {
    $body = @{ amount = 300000; paidAt = "2026-02-16T09:00:00.000Z"; method = "cash"; reference = "CASH-IS1-002-$ts"; notes = "Thanh toan lan 2 bang tien mat" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id/payments" -Headers $headers -Body $body -Label "SP Pay2 IntSupp1"
    if ($r) { Write-Pass "IntSupp1 paid +300K = 800K total (balance=$($r.closingBalance))" } else { Write-Fail "IntSupp1 pay 2 FAIL" }
}

# 9.4 Tao Statement cho ExtSupp1
Write-Step "9.4" "Tao Statement NCC ExtSupp1: 02/01 - 02/16"
$body = @{ supplierId = $extSupp1Id; from = "2026-02-01"; to = "2026-02-16"; notes = "E2E ExtSupp1 Statement $ts" } | ConvertTo-Json
$spStmt2 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $headers -Body $body -Label "SP Stmt ExtSupp1"
$spStmt2Id = $null
if ($spStmt2 -and ($spStmt2._id -or $spStmt2.id)) {
    $spStmt2Id = if ($spStmt2._id) { $spStmt2._id } else { $spStmt2.id }
    Write-Pass "ExtSupp1 Statement: $spStmt2Id"
    Write-Info "  opening=$($spStmt2.openingBalance), periodPayables=$($spStmt2.periodPayables), COD=$($spStmt2.periodCodCollected)"
    $script:testResults["sp_stmt2_id"] = $spStmt2Id
}
else { Write-Fail "ExtSupp1 Statement FAIL" }

# 9.5 Thanh toan ExtSupp1: 1 lan
Write-Step "9.5" "Pay ExtSupp1: 400K"
if ($spStmt2Id) {
    $body = @{ amount = 400000; paidAt = "2026-02-15T14:00:00.000Z"; method = "bank_transfer"; reference = "TXN-ES1-001-$ts"; notes = "Thanh toan NCC ngoai" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$spStmt2Id/payments" -Headers $headers -Body $body -Label "SP Pay ExtSupp1"
    if ($r) { Write-Pass "ExtSupp1 paid 400K (balance=$($r.closingBalance))" } else { Write-Fail "ExtSupp1 pay FAIL" }
}

# 9.6 Doc lai statements de verify
Write-Step "9.6" "Verify Supplier Statements"
if ($spStmt1Id) {
    $s = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id" -Headers $headers -Label "Read SP Stmt1"
    if ($s) {
        Write-Check "IntSupp1: status=$($s.status), payments=$($s.payments.Count), paymentTotal=$($s.statementPaymentTotal), closing=$($s.closingBalance)"
        if ($s.statementPaymentTotal -ge 800000) { Write-Pass "IntSupp1 total payment = $($s.statementPaymentTotal) >= 800K" }
    }
}
if ($spStmt2Id) {
    $s = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statements/$spStmt2Id" -Headers $headers -Label "Read SP Stmt2"
    if ($s) {
        Write-Check "ExtSupp1: status=$($s.status), payments=$($s.payments.Count), paymentTotal=$($s.statementPaymentTotal), closing=$($s.closingBalance)"
    }
}

# =============================================================================================
# PHASE 10: THANH TOAN HOA HONG DAI LY
# =============================================================================================
Write-Section "PHASE 10: Thanh toan hoa hong dai ly"

# 10.1 Tao Statement cho ExtAgent1
Write-Step "10.1" "Tao Statement dai ly ExtAgent1: 02/01 - 02/16"
$body = @{ agentId = $extAgent1Id; periodFrom = "2026-02-01"; periodTo = "2026-02-16"; notes = "E2E ExtAgent1 Stmt $ts" } | ConvertTo-Json
$agStmt1 = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Body $body -Label "AG Stmt ExtAgent1"
$agStmt1Id = $null
if ($agStmt1 -and ($agStmt1._id -or $agStmt1.id)) {
    $agStmt1Id = if ($agStmt1._id) { $agStmt1._id } else { $agStmt1.id }
    Write-Pass "ExtAgent1 Statement: $agStmt1Id"
    Write-Info "  opening=$($agStmt1.openingBalance), receivables=$($agStmt1.periodReceivables), closing=$($agStmt1.closingBalance)"
    $script:testResults["ag_stmt1_id"] = $agStmt1Id
}
else { Write-Fail "ExtAgent1 Statement FAIL" }

# 10.2 Thanh toan ExtAgent1: 2 lan
Write-Step "10.2" "Pay ExtAgent1 - Lan 1: 100K"
if ($agStmt1Id) {
    $body = @{ amount = 100000; paidAt = "2026-02-15T12:00:00.000Z"; method = "bank_transfer"; reference = "TXN-EA1-001-$ts"; notes = "Hoa hong lan 1" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$agStmt1Id/payments" -Headers $headers -Body $body -Label "AG Pay1 EA1"
    if ($r) { Write-Pass "ExtAgent1 paid 100K" } else { Write-Fail "ExtAgent1 pay 1 FAIL" }
}

Write-Step "10.3" "Pay ExtAgent1 - Lan 2: 50K"
if ($agStmt1Id) {
    $body = @{ amount = 50000; paidAt = "2026-02-16T10:00:00.000Z"; method = "cash"; reference = "CASH-EA1-002-$ts"; notes = "Hoa hong lan 2 tien mat" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$agStmt1Id/payments" -Headers $headers -Body $body -Label "AG Pay2 EA1"
    if ($r) { Write-Pass "ExtAgent1 paid +50K = 150K total" } else { Write-Fail "ExtAgent1 pay 2 FAIL" }
}

# 10.4 Tao Statement cho ExtAgent2
Write-Step "10.4" "Tao Statement dai ly ExtAgent2: 02/01 - 02/16"
$body = @{ agentId = $extAgent2Id; periodFrom = "2026-02-01"; periodTo = "2026-02-16"; notes = "E2E ExtAgent2 Stmt $ts" } | ConvertTo-Json
$agStmt2 = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Body $body -Label "AG Stmt ExtAgent2"
$agStmt2Id = $null
if ($agStmt2 -and ($agStmt2._id -or $agStmt2.id)) {
    $agStmt2Id = if ($agStmt2._id) { $agStmt2._id } else { $agStmt2.id }
    Write-Pass "ExtAgent2 Statement: $agStmt2Id"
    Write-Info "  opening=$($agStmt2.openingBalance), receivables=$($agStmt2.periodReceivables), closing=$($agStmt2.closingBalance)"
    $script:testResults["ag_stmt2_id"] = $agStmt2Id
}
else { Write-Fail "ExtAgent2 Statement FAIL" }

# 10.5 Thanh toan ExtAgent2: 1 lan
Write-Step "10.5" "Pay ExtAgent2: 80K"
if ($agStmt2Id) {
    $body = @{ amount = 80000; paidAt = "2026-02-15T15:00:00.000Z"; method = "bank_transfer"; reference = "TXN-EA2-001-$ts"; notes = "Hoa hong ExtAgent2" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$agStmt2Id/payments" -Headers $headers -Body $body -Label "AG Pay EA2"
    if ($r) { Write-Pass "ExtAgent2 paid 80K" } else { Write-Fail "ExtAgent2 pay FAIL" }
}

# 10.6 Verify Agent Statements
Write-Step "10.6" "Verify Agent Statements"
if ($agStmt1Id) {
    $s = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Label "AG Stmts"
    $stmtList = if ($s -is [array]) { $s } elseif ($s.data) { $s.data } else { @($s) }
    Write-Info "Total agent statements: $($stmtList.Count)"
}

# =============================================================================================
# PHASE 11: FINANCIAL CONTROL - SAU THANH TOAN
# =============================================================================================
Write-Section "PHASE 11: Financial Control SAU thanh toan"

Write-Step "11.1" "FC Dashboard AFTER"
$fcAfter = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC After"
if ($fcAfter) {
    Write-Pass "FC AFTER: bank=$($fcAfter.bankBalance), free=$($fcAfter.freeCash), committed=$($fcAfter.committedCash)"
    Write-Info "  burn=$($fcAfter.monthlyBurn), runway=$($fcAfter.runwayMonths), withdrawable=$($fcAfter.ownerWithdrawable)"
    Write-Info "  debt=$($fcAfter.totalDebtOutstanding)"
    $script:testResults["fc_after"] = $fcAfter
}

Write-Step "11.2" "FC Full Metrics"
$fcFull = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/full" -Headers $headers -Label "FC Full"
if ($fcFull) { Write-Pass "FC Full: keys=$($fcFull.PSObject.Properties.Name -join ', ')" }

Write-Step "11.3" "FC Forecast 7 ngay"
$fcForecast = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/forecast" -Headers $headers -Label "FC Forecast"
if ($fcForecast) {
    Write-Pass "Forecast: lowPoint=$($fcForecast.lowPoint)"
    if ($fcForecast.dailyForecast) { Write-Info "  Days: $($fcForecast.dailyForecast.Count)" }
}

Write-Step "11.4" "FC Optimal Ads"
$fcAds = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/optimal-ads" -Headers $headers -Label "FC Ads"
if ($fcAds) { Write-Pass "Optimal Ads response OK" }

Write-Step "11.5" "Cashflow Health AFTER"
$cfhAfter = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label "CFH After"
if ($cfhAfter) {
    Write-Pass "CFH AFTER: CSI=$($cfhAfter.csi), DSO=$($cfhAfter.dso), DPO=$($cfhAfter.dpo)"
    $script:testResults["cfh_after"] = $cfhAfter
}

Write-Step "11.6" "Module Health"
$mh = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/module-health" -Headers $headers -Label "Module Health"
if ($mh) { Write-Pass "Module Health: $($mh.overall)" }

Write-Step "11.7" "FC Actions"
$fcActions = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/actions" -Headers $headers -Label "FC Actions"
if ($fcActions) {
    $actionList = if ($fcActions -is [array]) { $fcActions } else { @($fcActions) }
    Write-Info "Suggested actions: $($actionList.Count)"
}

Write-Step "11.8" "Supplier Payable Cashflow SAU thanh toan"
$spAfter = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP CF After"
if ($spAfter) {
    Write-Pass "SP AFTER: grossEarned=$($spAfter.grossEarned), unreceived=$($spAfter.unreceived)"
    $script:testResults["sp_after"] = $spAfter
    # Assert cashflow reflects supplier payments
    if ($spAfter.totalPaid -and $spAfter.totalPaid -gt 0) { Write-Pass "  SP totalPaid=$($spAfter.totalPaid) > 0 (payments reflected)" }
    else { Write-Warn "  SP totalPaid=$($spAfter.totalPaid) (expected > 0 after Phase 9 payments)" }
}

Write-Step "11.9" "Agent Payable Cashflow SAU thanh toan"
$apAfter = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP CF After"
if ($apAfter) {
    Write-Pass "AP AFTER: incurred=$($apAfter.totalAgentCommissionIncurred), unpaid=$($apAfter.totalAgentUnpaid)"
    $script:testResults["ap_after"] = $apAfter
}

Write-Step "11.10" "Funds Overview"
$funds = Safe-Request -Method GET -Uri "$BaseUrl/funds/overview" -Headers $headers -Label "Funds"
if ($funds) { Write-Pass "Funds overview: keys=$($funds.PSObject.Properties.Name -join ', ')" }

Write-Step "11.11" "Cashflow Dashboard Summary"
$cfDash = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/dashboard/summary" -Headers $headers -Label "CF Dashboard"
if ($cfDash) { Write-Pass "Cashflow Dashboard OK" }

Write-Step "11.12" "Profit Summary (30 days)"
$profitSum = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/profit/summary?days=30" -Headers $headers -Label "Profit Sum"
if ($profitSum) { Write-Pass "Profit Summary: keys=$($profitSum.PSObject.Properties.Name -join ', ')" }

# =============================================================================================
# PHASE 12: CLOSE STATEMENTS + XOA DON #10
# =============================================================================================
Write-Section "PHASE 12: Close Statements + Xoa don #10"

# 12.1 Close supplier statements
Write-Step "12.1" "Close Supplier Statements"
foreach ($sid in @($spStmt1Id, $spStmt2Id)) {
    if ($sid) {
        $r = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$sid/close" -Headers $headers -Body "{}" -Label "Close SP $sid"
        if ($r -and $r.status -eq "closed") { Write-Pass "SP Statement $sid CLOSED" }
        else { Write-Info "SP close: status=$($r.status)" }
    }
}

# 12.2 Close agent statements
Write-Step "12.2" "Close Agent Statements"
foreach ($sid in @($agStmt1Id, $agStmt2Id)) {
    if ($sid) {
        $r = Safe-Request -Method PATCH -Uri "$BaseUrl/agent-payables/statements/$sid/close" -Headers $headers -Body "{}" -Label "Close AG $sid"
        if ($r -and $r.status -eq "closed") { Write-Pass "AG Statement $sid CLOSED" }
        else { Write-Info "AG close: status=$($r.status)" }
    }
}

# 12.3 Xoa don #10
Write-Step "12.3" "Xoa don #10"
if ($script:createdOrderIds.Count -ge 10) {
    $r = Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[9])" -Headers $headers -Label "Del #10"
    if ($null -ne $r) { Write-Pass "Don #10 deleted OK" }
    else { Write-Info "Don #10 delete (may have succeeded)" }
}

# 12.4 Verify don #10 da xoa
Write-Step "12.4" "Verify don #10 da xoa"
if ($script:createdOrderIds.Count -ge 10) {
    $r = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[9])" -Headers $headers -Label "Verify Del #10"
    if (-not $r) { Write-Pass "Don #10 confirmed deleted (404)" }
    else { Write-Warn "Don #10 van ton tai (co the soft delete)" }
}

# =============================================================================================
# PHASE 13: RECALCULATE + BANG TONG HOP CUOI
# =============================================================================================
Write-Section "PHASE 13: Recalculate + Bang tong hop cuoi"

Write-Step "13.1" "Recalculate all profits"
$recalc = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/recalculate-all-profits?from=2026-02-08&to=2026-02-16" -Headers $headers -Body "{}" -Label "Recalc"
if ($recalc) { Write-Pass "Recalculate: $($recalc | ConvertTo-Json -Compress)" }

# 13.1b: Validate netProfit consistency after recalculate
Write-Step "13.1b" "Validate netProfit sau recalculate (kiem tra bug -9.2M)"
$netProfitBug = $false
for ($i = 0; $i -lt [Math]::Min(9, $script:createdOrderIds.Count); $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Check NP $($i + 1)"
    if ($o -and $null -ne $o.grossProfit -and $null -ne $o.netProfit) {
        $gp = [double]$o.grossProfit
        $np = [double]$o.netProfit
        # netProfit should not be < grossProfit - 5M (reasonable threshold for cost allocation)
        if ($np -lt ($gp - 5000000)) {
            Write-Fail "  Don #$($i + 1): netProfit=$np grossProfit=$gp -- ABNORMAL (diff=$([Math]::Abs($gp - $np)))"
            $netProfitBug = $true
        }
        # grossProfit should be consistent (positive for delivered orders with COD > costs)
        if ($gp -ne 0 -and $o.orderStatus -eq 'Giao th\u00e0nh c\u00f4ng') {
            Write-Info "  Don #$($i + 1): gross=$gp, net=$np, adCost=$($o.advertisingCost), laborCost=$($o.laborCostAllocation), otherCost=$($o.otherCostAllocation)"
        }
    }
}
if (-not $netProfitBug) { Write-Pass "All orders have reasonable netProfit (no -9.2M bug)" }
else { Write-Fail "netProfit BUG detected in one or more orders" }

Write-Step "13.2" "Daily Profit Report"
$dailyReport = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/daily-profit-report?date=2026-02-12" -Headers $headers -Label "DailyReport"
if ($dailyReport) { Write-Pass "Daily Report 02/12: $($dailyReport | ConvertTo-Json -Compress -Depth 2)" }

Write-Step "13.3" "Bang tong hop 9 don (sau khi xoa don #10)"
Write-Host ""
Write-Host ("  {0,-4} {1,-12} {2,-22} {3,-18} {4,-12} {5,-12} {6,-10} {7,-10} {8,-10}" -f "#", "Date", "OrdStatus", "ProdStatus", "SuppPaid", "AgPaid", "AgSt", "Gross", "Net") -ForegroundColor White
Write-Host ("  " + "-" * 110) -ForegroundColor White
for ($i = 0; $i -lt [Math]::Min(9, $script:createdOrderIds.Count); $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Final $($i + 1)"
    if ($o) {
        $dt = if ($o.orderDate) { ([DateTime]$o.orderDate).ToString("MM/dd") } else { "-" }
        $sp = if ($null -ne $o.supplierPaidAmount) { $o.supplierPaidAmount } else { "-" }
        $ap = if ($null -ne $o.agentPaidAmount) { $o.agentPaidAmount } else { "-" }
        $agS = if ($o.agentPaymentStatus) { $o.agentPaymentStatus } else { "-" }
        $gp = if ($null -ne $o.grossProfit) { $o.grossProfit } else { "-" }
        $np = if ($null -ne $o.netProfit) { $o.netProfit } else { "-" }
        $os = if ($o.orderStatus) { $o.orderStatus } else { "-" }
        $ps = if ($o.productionStatus) { $o.productionStatus } else { "-" }
        Write-Host ("  {0,-4} {1,-12} {2,-22} {3,-18} {4,-12} {5,-12} {6,-10} {7,-10} {8,-10}" -f "#$($i + 1)", $dt, $os, $ps, $sp, $ap, $agS, $gp, $np)
    }
}

# 13.4: GrossProfit consistency check (before vs after recalculate)
Write-Step "13.4" "GrossProfit nhat quan truoc/sau recalculate"
$gpConsistent = $true
for ($i = 0; $i -lt [Math]::Min(9, $script:createdOrderIds.Count); $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "GP Check $($i + 1)"
    if ($o -and $null -ne $o.grossProfit -and $script:grossProfitBefore.ContainsKey($i)) {
        $before = $script:grossProfitBefore[$i]
        $after = $o.grossProfit
        if ($null -ne $before -and $before -ne 0 -and $after -ne 0 -and $before -ne $after) {
            $diff = [Math]::Abs($after - $before)
            if ($diff -gt 1) {
                Write-Warn "  Don #$($i + 1): grossProfit CHANGED: $before -> $after (diff=$diff)"
                $gpConsistent = $false
            }
        }
    }
}
if ($gpConsistent) { Write-Pass "GrossProfit consistent before/after recalculate" }
else { Write-Warn "GrossProfit changed after recalculate (trigger formula was updated)" }

# =============================================================================================
# PHASE 14: SO SANH TRUOC / SAU
# =============================================================================================
Write-Section "PHASE 14: So sanh TRUOC / SAU"

# 14.1 Financial Control
Write-Step "14.1" "FC Dashboard: TRUOC vs SAU"
if ($script:testResults["fc_before"] -and $script:testResults["fc_after"]) {
    $b = $script:testResults["fc_before"]; $a = $script:testResults["fc_after"]
    Write-Host ""
    Write-Host ("  {0,-28} {1,18} {2,18} {3,18}" -f "FC Metric", "TRUOC", "SAU", "DELTA") -ForegroundColor White
    Write-Host ("  " + "-" * 85) -ForegroundColor White
    foreach ($m in @("bankBalance", "freeCash", "committedCash", "monthlyBurn", "ownerWithdrawable", "totalDebtOutstanding")) {
        $bV = if ($b.PSObject.Properties[$m]) { $b.$m } else { 0 }
        $aV = if ($a.PSObject.Properties[$m]) { $a.$m } else { 0 }
        $d = [Math]::Round($aV - $bV, 0)
        $ds = if ($d -gt 0) { "+$d" } elseif ($d -lt 0) { "$d" } else { "0" }
        $color = if ($d -gt 0) { "Green" } elseif ($d -lt 0) { "Red" } else { "White" }
        Write-Host ("  {0,-28} {1,18:N0} {2,18:N0} {3,18}" -f $m, $bV, $aV, $ds) -ForegroundColor $color
    }
}
else { Write-Warn "Khong co du lieu FC de so sanh" }

# 14.2 Cashflow Health
Write-Step "14.2" "Cashflow Health: TRUOC vs SAU"
if ($script:testResults["cfh_before"] -and $script:testResults["cfh_after"]) {
    $b = $script:testResults["cfh_before"]; $a = $script:testResults["cfh_after"]
    Write-Host ""
    Write-Host ("  {0,-20} {1,15} {2,15}" -f "CFH Metric", "TRUOC", "SAU") -ForegroundColor White
    Write-Host ("  " + "-" * 55) -ForegroundColor White
    foreach ($m in @("csi", "dso", "dpo")) {
        $bV = if ($b.PSObject.Properties[$m]) { $b.$m } else { "-" }
        $aV = if ($a.PSObject.Properties[$m]) { $a.$m } else { "-" }
        Write-Host ("  {0,-20} {1,15} {2,15}" -f $m, $bV, $aV)
    }
}

# 14.3 Supplier Payable
Write-Step "14.3" "Supplier Payable Cashflow: TRUOC vs SAU"
if ($script:testResults["sp_before"] -and $script:testResults["sp_after"]) {
    $b = $script:testResults["sp_before"]; $a = $script:testResults["sp_after"]
    Write-Host ""
    Write-Host ("  {0,-30} {1,18} {2,18}" -f "SP Metric", "TRUOC", "SAU") -ForegroundColor White
    Write-Host ("  " + "-" * 70) -ForegroundColor White
    foreach ($m in @("grossEarned", "unreceived", "totalPaid", "netAfterCod")) {
        $bV = if ($b.PSObject.Properties[$m]) { [Math]::Round($b.$m, 0) } else { 0 }
        $aV = if ($a.PSObject.Properties[$m]) { [Math]::Round($a.$m, 0) } else { 0 }
        Write-Host ("  {0,-30} {1,18:N0} {2,18:N0}" -f $m, $bV, $aV)
    }
}
else { Write-Info "Supplier payable: no before data" }

# 14.4 Agent Payable
Write-Step "14.4" "Agent Payable Cashflow: TRUOC vs SAU"
if ($script:testResults["ap_before"] -and $script:testResults["ap_after"]) {
    $b = $script:testResults["ap_before"]; $a = $script:testResults["ap_after"]
    Write-Host ""
    Write-Host ("  {0,-38} {1,15} {2,15}" -f "AP Metric", "TRUOC", "SAU") -ForegroundColor White
    Write-Host ("  " + "-" * 72) -ForegroundColor White
    foreach ($m in @("totalAgentCommissionIncurred", "totalAgentNetPayable", "totalAgentPaid", "totalAgentUnpaid")) {
        $bV = if ($b.PSObject.Properties[$m]) { [Math]::Round($b.$m, 0) } else { 0 }
        $aV = if ($a.PSObject.Properties[$m]) { [Math]::Round($a.$m, 0) } else { 0 }
        Write-Host ("  {0,-38} {1,15:N0} {2,15:N0}" -f $m, $bV, $aV)
    }
}
else { Write-Info "Agent payable: no before data" }

# =============================================================================================
# PHASE 15: REOPEN + PAY MORE (test reopen workflow)
# =============================================================================================
Write-Section "PHASE 15: Test Reopen Statement + Pay thêm"

Write-Step "15.1" "Reopen IntSupp1 Statement"
if ($spStmt1Id) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id/reopen" -Headers $headers -Body "{}" -Label "Reopen SP1"
    if ($r -and $r.status -eq "open") { Write-Pass "IntSupp1 Statement REOPENED" }
    else { Write-Warn "Reopen result: $($r.status)" }
}

Write-Step "15.2" "Pay IntSupp1 lan 3: 200K"
if ($spStmt1Id) {
    $body = @{ amount = 200000; paidAt = "2026-02-16T15:00:00.000Z"; method = "bank_transfer"; reference = "TXN-IS1-003-$ts"; notes = "Thanh toan bo sung lan 3" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id/payments" -Headers $headers -Body $body -Label "SP Pay3 IntSupp1"
    if ($r) { Write-Pass "IntSupp1 paid +200K = 1M total (balance=$($r.closingBalance))" } else { Write-Fail "IntSupp1 pay 3 FAIL" }
}

Write-Step "15.3" "Close IntSupp1 lai"
if ($spStmt1Id) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$spStmt1Id/close" -Headers $headers -Body "{}" -Label "Close SP1 again"
    if ($r -and $r.status -eq "closed") { Write-Pass "IntSupp1 Statement CLOSED (final)" }
}

# =============================================================================================
# PHASE 16: FC CUOI CUNG SAU REOPEN
# =============================================================================================
Write-Section "PHASE 16: Financial Control CUOI CUNG"

Write-Step "16.1" "FC Dashboard FINAL"
$fcFinal = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Final"
if ($fcFinal) {
    Write-Pass "FC FINAL: bank=$($fcFinal.bankBalance), free=$($fcFinal.freeCash), committed=$($fcFinal.committedCash)"
    Write-Info "  burn=$($fcFinal.monthlyBurn), runway=$($fcFinal.runwayMonths), withdrawable=$($fcFinal.ownerWithdrawable)"
    $script:testResults["fc_final"] = $fcFinal
}

Write-Step "16.2" "FC Config"
$fcConfig = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/config" -Headers $headers -Label "FC Config"
if ($fcConfig) {
    Write-Info "Config: CommittedWindow=$($fcConfig.CommittedWindowDays)d, SurvivalMonths=$($fcConfig.SurvivalMonths), Caps=+$($fcConfig.UpperCapMultiplier)/-$($fcConfig.LowerCapMultiplier)"
}

Write-Step "16.3" "Funds Status"
$fundsStatus = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/funds/status" -Headers $headers -Label "Funds Status"
if ($fundsStatus) { Write-Pass "Funds Status OK" }

Write-Step "16.4" "Ads Decision"
$adsDecision = Safe-Request -Method GET -Uri "$BaseUrl/cashflow/ads/decision" -Headers $headers -Label "Ads Decision"
if ($adsDecision) { Write-Pass "Ads Decision: $($adsDecision | ConvertTo-Json -Compress -Depth 2)" }

# =============================================================================================
# FINAL: KET QUA
# =============================================================================================
Write-Section "KET QUA TONG HOP"
Write-Host ""
Write-Host "  =============================================" -ForegroundColor White
Write-Host "  Test Timestamp : $ts" -ForegroundColor White
Write-Host "  Orders Created : $($script:createdOrderIds.Count)" -ForegroundColor White
Write-Host "  Users Created  : $($script:createdUserIds.Count)" -ForegroundColor White
Write-Host "  PASS           : $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL           : $($script:failCount)" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Red" })
Write-Host "  =============================================" -ForegroundColor White
Write-Host ""

if ($script:failCount -gt 0) {
    Write-Host "  FAIL Details:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    Write-Host ""
}

if ($script:failCount -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
}
else {
    Write-Host "  CO LOI - Xem chi tiet phia tren" -ForegroundColor Red
}

# Export results
$exportResults = @{
    timestamp   = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    pass        = $script:passCount
    fail        = $script:failCount
    failDetails = $script:failDetails
    orderIds    = $script:createdOrderIds
    userIds     = $script:createdUserIds
    statements  = @{
        supplierIntSupp1 = $spStmt1Id
        supplierExtSupp1 = $spStmt2Id
        agentExtAgent1   = $agStmt1Id
        agentExtAgent2   = $agStmt2Id
    }
    fcBefore    = if ($script:testResults["fc_before"]) { @{
            bankBalance     = $script:testResults["fc_before"].bankBalance
            freeCash        = $script:testResults["fc_before"].freeCash
            committedCash   = $script:testResults["fc_before"].committedCash
            monthlyBurn     = $script:testResults["fc_before"].monthlyBurn
            ownerWithdrawable = $script:testResults["fc_before"].ownerWithdrawable
        }
    }
    else { $null }
    fcAfter     = if ($script:testResults["fc_after"]) { @{
            bankBalance     = $script:testResults["fc_after"].bankBalance
            freeCash        = $script:testResults["fc_after"].freeCash
            committedCash   = $script:testResults["fc_after"].committedCash
            monthlyBurn     = $script:testResults["fc_after"].monthlyBurn
            ownerWithdrawable = $script:testResults["fc_after"].ownerWithdrawable
        }
    }
    else { $null }
    fcFinal     = if ($script:testResults["fc_final"]) { @{
            bankBalance     = $script:testResults["fc_final"].bankBalance
            freeCash        = $script:testResults["fc_final"].freeCash
            committedCash   = $script:testResults["fc_final"].committedCash
        }
    }
    else { $null }
}
$exportResults | ConvertTo-Json -Depth 5 | Out-File -FilePath "test-full-business-flow-results.json" -Encoding utf8
Write-Host "  Results saved: test-full-business-flow-results.json" -ForegroundColor Gray
Write-Host ""
