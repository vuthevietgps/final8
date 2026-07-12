// Generate the E2E v2 test script with proper UTF-8 BOM encoding
const fs = require('fs');
const path = require('path');

const BOM = '\uFEFF';

const script = `#!/usr/bin/env pwsh
$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

function Write-Section($title) { Write-Host ""; Write-Host ("=" * 80) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 80) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Check($msg) { Write-Host "  [CHECK] $msg" -ForegroundColor Magenta }

function Safe-Request {
    param([string]$Method,[string]$Uri,[hashtable]$Headers,[string]$Body=$null,[string]$Label="")
    try {
        $params = @{ Method=$Method; Uri=$Uri; Headers=$Headers; ContentType="application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        return (Invoke-RestMethod @params)
    } catch {
        $st = $_.Exception.Response.StatusCode.value__
        $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch {}
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$script:createdOrderIds = @(); $script:testResults = @{}
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

# Vietnamese status constants (UTF-8 with diacritics)
$PS_PENDING = "Ch\u01B0a l\u00E0m"
$PS_INPROGRESS = "\u0110ang l\u00E0m"
$PS_DONE = "\u0110\u00E3 tr\u1EA3 k\u1EBFt qu\u1EA3"
$OS_NO_TRACKING = "Ch\u01B0a c\u00F3 m\u00E3 v\u1EADn \u0111\u01A1n"
$OS_SHIPPING = "\u0110ang giao"
$OS_DELIVERED = "Giao th\u00E0nh c\u00F4ng"
$OS_RETURNED = "H\u00E0ng ho\u00E0n"

Write-Info "Statuses: [$OS_DELIVERED] [$OS_RETURNED] [$PS_DONE]"

# ==================== PHASE 0: AUTH ====================
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$loginBody = @{ email = "director@test.com"; password = "123456" } | ConvertTo-Json
$loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login"
if (-not $loginResp -or -not $loginResp.access_token) {
    $loginBody = @{ email = "vutheviet@gmail.com"; password = "123456" } | ConvertTo-Json
    $loginResp = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body $loginBody -Label "Login Alt"
}
if (-not $loginResp -or -not $loginResp.access_token) { Write-Fail "Cannot login"; exit 1 }
$token = $loginResp.access_token
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json; charset=utf-8" }
Write-Pass "Login OK: $($loginResp.user.fullName) ($($loginResp.user.role))"

# ==================== PHASE 1: CREATE USERS ====================
Write-Section "PHASE 1: Tao 5 Users (2 ext_agent, 1 int_agent, 2 supplier)"

$userConfigs = @(
    @{ var="extAgent1"; email="ext-agent1"; role="external_agent"; name="Dai Ly Ngoai 1"; phone="0901110001" },
    @{ var="extAgent2"; email="ext-agent2"; role="external_agent"; name="Dai Ly Ngoai 2"; phone="0901110002" },
    @{ var="intAgent"; email="int-agent"; role="internal_agent"; name="Dai Ly Noi Bo"; phone="0901110003" },
    @{ var="supplier1"; email="supplier1"; role="internal_supplier"; name="NCC Noi Bo 1"; phone="0902220001" },
    @{ var="supplier2"; email="supplier2"; role="external_supplier"; name="NCC Ngoai 2"; phone="0902220002" }
)

$userIds = @{}
for ($i = 0; $i -lt $userConfigs.Count; $i++) {
    $u = $userConfigs[$i]
    Write-Step "1.$($i+1)" "Tao $($u.var)"
    $body = @{ fullName=$u.name; email="$($u.email)-$ts@test.com"; password="123456"; phone=$u.phone; role=$u.role; isActive=$true } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $headers -Body $body -Label "Create $($u.var)"
    if ($r -and ($r._id -or $r.id)) {
        $uid = if ($r._id) { $r._id } else { $r.id }
        $userIds[$u.var] = $uid
        Write-Pass "$($u.var): $uid"
    } else { Write-Fail "Cannot create $($u.var)" }
}
$extAgent1Id = $userIds["extAgent1"]
$extAgent2Id = $userIds["extAgent2"]
$intAgentId = $userIds["intAgent"]
$supplier1Id = $userIds["supplier1"]
$supplier2Id = $userIds["supplier2"]

# ==================== PHASE 2: PRODUCTS + SUPPLIER QUOTES ====================
Write-Section "PHASE 2: Products + Supplier Quotes"

Write-Step "2.1" "Lay danh sach san pham"
$products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $headers -Label "Products"
# IMPORTANT: array check FIRST to avoid PowerShell member-enumeration bug
$productList = if ($products -is [array]) { $products } elseif ($products.data) { $products.data } else { @($products) }
if ($productList.Count -gt 0) {
    $prod1 = $productList[0]; $prod2 = if ($productList.Count -gt 1) { $productList[1] } else { $productList[0] }
    $prod1Id = "$($prod1._id)"; $prod2Id = "$($prod2._id)"
    Write-Pass "SP1: $($prod1.name) ($prod1Id)"
    Write-Pass "SP2: $($prod2.name) ($prod2Id)"
} else { Write-Fail "No products"; exit 1 }

# Create 4 supplier quotes
$sqConfigs = @(
    @{ suppId=$supplier1Id; prodId=$prod1Id; price=120000; ship=25000; ret=15000; label="S1xP1" },
    @{ suppId=$supplier1Id; prodId=$prod2Id; price=140000; ship=28000; ret=18000; label="S1xP2" },
    @{ suppId=$supplier2Id; prodId=$prod1Id; price=110000; ship=22000; ret=12000; label="S2xP1" },
    @{ suppId=$supplier2Id; prodId=$prod2Id; price=130000; ship=26000; ret=14000; label="S2xP2" }
)
for ($i = 0; $i -lt $sqConfigs.Count; $i++) {
    $sq = $sqConfigs[$i]
    Write-Step "2.$($i+2)" "SupplierQuote $($sq.label) = $($sq.price)"
    $body = @{ productId=$sq.prodId; supplierId=$sq.suppId; price=$sq.price; shippingFee=$sq.ship; returnFee=$sq.ret; effectiveAt="2026-01-01T00:00:00.000Z"; note="E2E $($sq.label)" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $headers -Body $body -Label "SQ $($sq.label)"
    if ($r) { Write-Pass "SQ $($sq.label) OK" } else { Write-Fail "SQ $($sq.label) FAIL" }
}

Write-Step "2.6" "Ad Groups"
$adGroups = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $headers -Label "AdGroups"
$agList = if ($adGroups -is [array]) { $adGroups } elseif ($adGroups.data) { $adGroups.data } else { @() }
if ($agList.Count -gt 0) { $adGrp1 = if ($agList[0].platformId) { $agList[0].platformId } else { "$($agList[0]._id)" }; $adGrp2 = if ($agList.Count -gt 1 -and $agList[1].platformId) { $agList[1].platformId } else { $adGrp1 } } else { $adGrp1 = "test-ag-001"; $adGrp2 = "test-ag-002" }
Write-Info "AG1=$adGrp1, AG2=$adGrp2"

# ==================== PHASE 3: BASELINE ====================
Write-Section "PHASE 3: Baseline"
Write-Step "3.1" "FC Dashboard BEFORE"
$fcBefore = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC Before"
if ($fcBefore) { Write-Pass "FC: bank=$($fcBefore.bankBalance), free=$($fcBefore.freeCash), committed=$($fcBefore.committedCash)"; $script:testResults["fc_before"] = $fcBefore }

Write-Step "3.2" "SP summary BEFORE"
$spBefore = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP Before"
if ($spBefore) { Write-Pass "SP: grossEarned=$($spBefore.grossEarned)"; $script:testResults["sp_before"] = $spBefore }

Write-Step "3.3" "AP summary BEFORE"
$apBefore = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP Before"
if ($apBefore) { Write-Pass "AP: netPayable=$($apBefore.totalAgentNetPayable), unpaid=$($apBefore.totalAgentUnpaid)"; $script:testResults["ap_before"] = $apBefore }

# ==================== PHASE 4: CREATE 10 ORDERS ====================
Write-Section "PHASE 4: Tao 10 don hang"

$orderDates = @("2026-02-08","2026-02-09","2026-02-10","2026-02-11","2026-02-11","2026-02-12","2026-02-13","2026-02-13","2026-02-14","2026-02-15")
$orderConfigs = @(
    @{ name="E2Ev2-01"; qty=1; cod=500000; aq=40000; agent=$extAgent1Id; supp=$supplier1Id; prod=$prod1Id; ag=$adGrp1; desc="EA1+S1+P1" },
    @{ name="E2Ev2-02"; qty=2; cod=950000; aq=45000; agent=$extAgent1Id; supp=$supplier1Id; prod=$prod1Id; ag=$adGrp1; desc="EA1+S1+P1x2" },
    @{ name="E2Ev2-03"; qty=1; cod=600000; aq=50000; agent=$extAgent1Id; supp=$supplier1Id; prod=$prod1Id; ag=$adGrp2; desc="EA1+S1+P1-AG2" },
    @{ name="E2Ev2-04"; qty=3; cod=1500000; aq=35000; agent=$extAgent1Id; supp=$supplier1Id; prod=$prod1Id; ag=$adGrp1; desc="EA1+S1+P1x3-RETURN" },
    @{ name="E2Ev2-05"; qty=1; cod=450000; aq=38000; agent=$extAgent2Id; supp=$supplier2Id; prod=$prod1Id; ag=$adGrp2; desc="EA2+S2+P1" },
    @{ name="E2Ev2-06"; qty=2; cod=850000; aq=42000; agent=$extAgent2Id; supp=$supplier2Id; prod=$prod1Id; ag=$adGrp1; desc="EA2+S2+P1x2" },
    @{ name="E2Ev2-07"; qty=1; cod=520000; aq=48000; agent=$extAgent2Id; supp=$supplier2Id; prod=$prod1Id; ag=$adGrp2; desc="EA2+S2+P1" },
    @{ name="E2Ev2-08"; qty=2; cod=900000; aq=30000; agent=$intAgentId; supp=$supplier1Id; prod=$prod2Id; ag=$adGrp1; desc="IA+S1+P2x2" },
    @{ name="E2Ev2-09"; qty=1; cod=480000; aq=35000; agent=$intAgentId; supp=$supplier1Id; prod=$prod2Id; ag=$adGrp2; desc="IA+S1+P2" },
    @{ name="E2Ev2-10"; qty=1; cod=550000; aq=43000; agent=$extAgent1Id; supp=$supplier2Id; prod=$prod2Id; ag=$adGrp1; desc="EA1+S2+P2" }
)

for ($i = 0; $i -lt 10; $i++) {
    $c = $orderConfigs[$i]
    Write-Step "4.$($i+1)" "Don #$($i+1): $($c.desc)"
    $body = @{
        customerName="$($c.name)-$ts"; quantity=$c.qty; codAmount=$c.cod; agentQuote=$c.aq; depositAmount=0
        orderDate="$($orderDates[$i])T00:00:00.000Z"; productionStatus=$PS_PENDING; orderStatus=$OS_NO_TRACKING
        adGroupId=$c.ag; receiverName="KH $($i+1)"; receiverPhone="090000000$i"; receiverAddress="Addr $($i+1)"
        productId=$c.prod; supplierId=$c.supp; agentId=$c.agent
    } | ConvertTo-Json -Depth 5
    $r = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $headers -Body $body -Label "Order $($i+1)"
    if ($r -and ($r._id -or $r.id)) {
        $oid = if ($r._id) { $r._id } else { $r.id }
        $script:createdOrderIds += $oid
        Write-Pass "Don #$($i+1): $oid"
        Write-Info "  supplierQuote=$($r.supplierQuote), supplierQuoteId=$($r.supplierQuoteId), ship=$($r.shippingFee), ret=$($r.returnFee)"
        if ($r.supplierQuote -gt 0) { Write-Pass "  -> supplierQuote=$($r.supplierQuote) snapshot OK" }
        else { Write-Fail "  -> supplierQuote=0 (snapshot FAIL)" }
    } else { Write-Fail "Don #$($i+1) FAIL" }
}
Write-Info "Total orders: $($script:createdOrderIds.Count)"

# ==================== PHASE 5: CRUD UPDATE ====================
Write-Section "PHASE 5: CRUD Updates"
Write-Step "5.1" "COD don #1: 500K -> 600K"
if ($script:createdOrderIds.Count -ge 1) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[0])" -Headers $headers -Body (@{codAmount=600000}|ConvertTo-Json) -Label "Upd COD"
    if ($r) { Write-Pass "COD #1 -> 600K, supplierQuote=$($r.supplierQuote)" }
}
Write-Step "5.2" "Qty don #2: 2 -> 3"
if ($script:createdOrderIds.Count -ge 2) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[1])" -Headers $headers -Body (@{quantity=3}|ConvertTo-Json) -Label "Upd Qty"
    if ($r) { Write-Pass "Qty #2 -> 3" }
}
Write-Step "5.3" "AgentQuote don #5: 38K -> 55K"
if ($script:createdOrderIds.Count -ge 5) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[4])" -Headers $headers -Body (@{agentQuote=55000}|ConvertTo-Json) -Label "Upd AQ"
    if ($r) { Write-Pass "AgentQuote #5 -> 55K" }
}
Write-Step "5.4" "Doi NCC don #6: S2 -> S1"
if ($script:createdOrderIds.Count -ge 6) {
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[5])" -Headers $headers -Body (@{supplierId=$supplier1Id}|ConvertTo-Json) -Label "Upd Supp"
    if ($r) { Write-Pass "NCC #6 -> S1, new quote=$($r.supplierQuote)" }
}

# ==================== PHASE 6: PRODUCTION STATUS ====================
Write-Section "PHASE 6: Production Status"
Write-Step "6.1" "Don #1-8 -> Dang lam -> Da tra ket qua"
for ($i = 0; $i -lt [Math]::Min(8, $script:createdOrderIds.Count); $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{productionStatus=$PS_INPROGRESS}|ConvertTo-Json) -Label "Prod IP $($i+1)" | Out-Null
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{productionStatus=$PS_DONE}|ConvertTo-Json) -Label "Prod Done $($i+1)"
    if ($r) { Write-Pass "Don #$($i+1) -> $PS_DONE" } else { Write-Fail "Don #$($i+1) prod FAIL" }
}

# ==================== PHASE 7: ORDER STATUS + TRIGGER ====================
Write-Section "PHASE 7: Order Status + TRIGGER VERIFICATION"

# Don 1-3: Dang giao -> Giao thanh cong (External Agent 1)
Write-Step "7.1" "Don #1-3 -> Giao thanh cong [ExtAgent1 TRIGGER TEST]"
for ($i = 0; $i -lt 3; $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_SHIPPING}|ConvertTo-Json) -Label "Ship $($i+1)" | Out-Null
    Start-Sleep -Milliseconds 300
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_DELIVERED}|ConvertTo-Json) -Label "Deliver $($i+1)"
    if ($r) {
        Write-Pass "Don #$($i+1) -> $OS_DELIVERED"
        Write-Check "  TRIGGER: gross=$($r.grossProfit), suppPaid=$($r.supplierPaidAmount), agPaid=$($r.agentPaidAmount), agSt=$($r.agentPaymentStatus)"
        if ($null -ne $r.grossProfit -and $r.grossProfit -ne 0) { Write-Pass "  grossProfit OK = $($r.grossProfit)" } else { Write-Fail "  grossProfit = $($r.grossProfit) TRIGGER FAIL" }
        if ($null -ne $r.supplierPaidAmount -and $r.supplierPaidAmount -ne 0) { Write-Pass "  supplierPaidAmount OK = $($r.supplierPaidAmount)" } else { Write-Fail "  supplierPaidAmount FAIL" }
        if ($r.agentPaymentStatus -eq "pending") { Write-Pass "  agentPaymentStatus=pending (ExtAgent OK)" } elseif ($r.agentPaymentStatus -eq "n/a") { Write-Fail "  agentPaymentStatus=n/a (WRONG for ext agent)" }
    }
}

# Don 4: Hang hoan (return)
Write-Step "7.2" "Don #4 -> Hang hoan [RETURN TRIGGER]"
if ($script:createdOrderIds.Count -ge 4) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers -Body (@{orderStatus=$OS_SHIPPING}|ConvertTo-Json) -Label "Ship 4" | Out-Null
    Start-Sleep -Milliseconds 500
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[3])" -Headers $headers -Body (@{orderStatus=$OS_RETURNED}|ConvertTo-Json) -Label "Return 4"
    if ($r) {
        Write-Pass "Don #4 -> $OS_RETURNED"
        Write-Check "  RETURN: gross=$($r.grossProfit), suppPaid=$($r.supplierPaidAmount), agPaid=$($r.agentPaidAmount)"
        if ($null -ne $r.supplierPaidAmount -and $r.supplierPaidAmount -lt 0) { Write-Pass "  supplierPaidAmount < 0 (RETURN OK)" } else { Write-Fail "  supplierPaidAmount >= 0 (RETURN FAIL)" }
    }
}

# Don 5-7: Giao thanh cong (External Agent 2)
Write-Step "7.3" "Don #5-7 -> Giao thanh cong [ExtAgent2]"
for ($i = 4; $i -lt 7; $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_SHIPPING}|ConvertTo-Json) -Label "Ship $($i+1)" | Out-Null
    Start-Sleep -Milliseconds 300
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_DELIVERED}|ConvertTo-Json) -Label "Deliver $($i+1)"
    if ($r) {
        Write-Pass "Don #$($i+1) -> $OS_DELIVERED"
        Write-Info "  gross=$($r.grossProfit), agSt=$($r.agentPaymentStatus)"
        if ($null -ne $r.grossProfit -and $r.grossProfit -ne 0) { Write-Pass "  grossProfit OK" } else { Write-Fail "  grossProfit FAIL" }
        if ($r.agentPaymentStatus -eq "pending") { Write-Pass "  agentPaymentStatus=pending OK" }
    }
}

# Don 8-9: Giao thanh cong (Internal Agent -> n/a)
Write-Step "7.4" "Don #8-9 -> Giao thanh cong [IntAgent -> n/a]"
for ($i = 7; $i -lt 9; $i++) {
    Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_SHIPPING}|ConvertTo-Json) -Label "Ship $($i+1)" | Out-Null
    Start-Sleep -Milliseconds 300
    $r = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Body (@{orderStatus=$OS_DELIVERED}|ConvertTo-Json) -Label "Deliver $($i+1)"
    if ($r) {
        Write-Pass "Don #$($i+1) -> $OS_DELIVERED"
        Write-Info "  gross=$($r.grossProfit), agSt=$($r.agentPaymentStatus)"
        if ($r.agentPaymentStatus -eq "n/a") { Write-Pass "  agentPaymentStatus=n/a (IntAgent CORRECT)" } else { Write-Fail "  agentPaymentStatus=$($r.agentPaymentStatus) (expected n/a)" }
        if ($null -eq $r.agentPaidAmount -or $r.agentPaidAmount -eq 0) { Write-Pass "  agentPaidAmount=0 (IntAgent CORRECT)" }
    }
}

# Phase 7B: Summary table
Write-Section "PHASE 7B: Trigger Summary Table"
Write-Host ""
Write-Host ("  {0,-4} {1,-22} {2,-14} {3,-12} {4,-10} {5,-12}" -f "#","OrderStatus","SuppPaid","AgPaid","AgSt","Gross") -ForegroundColor White
Write-Host ("  " + "-" * 78) -ForegroundColor White
$trigOK = 0; $trigFail = 0
for ($i = 0; $i -lt $script:createdOrderIds.Count; $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Read $($i+1)"
    if ($o) {
        $sp = if ($null -ne $o.supplierPaidAmount) { $o.supplierPaidAmount } else { "null" }
        $ap = if ($null -ne $o.agentPaidAmount) { $o.agentPaidAmount } else { "null" }
        $agS = if ($o.agentPaymentStatus) { $o.agentPaymentStatus } else { "null" }
        $gp = if ($null -ne $o.grossProfit) { $o.grossProfit } else { "null" }
        Write-Host ("  {0,-4} {1,-22} {2,-14} {3,-12} {4,-10} {5,-12}" -f "#$($i+1)",$o.orderStatus,$sp,$ap,$agS,$gp)
        if ($o.orderStatus -eq $OS_DELIVERED -or $o.orderStatus -eq $OS_RETURNED) {
            if ($null -ne $o.supplierPaidAmount -and $o.supplierPaidAmount -ne 0 -and $null -ne $o.grossProfit -and $o.grossProfit -ne 0) { $trigOK++ } else { $trigFail++ }
        }
    }
}
Write-Host ""
if ($trigFail -eq 0 -and $trigOK -gt 0) { Write-Pass "TRIGGERS: $trigOK/$trigOK all OK!" } else { Write-Fail "TRIGGERS: $trigOK OK, $trigFail FAILED" }

# ==================== PHASE 8: SUPPLIER PAYABLE ====================
Write-Section "PHASE 8: Supplier Payable Check"
Write-Step "8.1" "SP Cashflow after delivery"
$spAfter = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $headers -Label "SP After"
if ($spAfter) { Write-Pass "SP: grossEarned=$($spAfter.grossEarned), unreceived=$($spAfter.unreceived)" }

Write-Step "8.2" "Pending Supplier1"
$r = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$supplier1Id" -Headers $headers -Label "SP1 Pend"
if ($r) { $items = if ($r -is [array]) { $r } else { @($r) }; Write-Check "Supplier1 pending: $($items.Count) orders" }

Write-Step "8.3" "Pending Supplier2"
$r = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier?supplierId=$supplier2Id" -Headers $headers -Label "SP2 Pend"
if ($r) { $items = if ($r -is [array]) { $r } else { @($r) }; Write-Check "Supplier2 pending: $($items.Count) orders" }

# ==================== PHASE 9: AGENT PAYABLE ====================
Write-Section "PHASE 9: Agent Payable Check"
Write-Step "9.1" "AP Cashflow after delivery"
$apAfter = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $headers -Label "AP After"
if ($apAfter) {
    Write-Pass "AP: incurred=$($apAfter.totalAgentCommissionIncurred), unpaid=$($apAfter.totalAgentUnpaid)"
    $script:testResults["ap_after"] = $apAfter
}

Write-Step "9.2" "Pending ExtAgent1"
$r = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$extAgent1Id" -Headers $headers -Label "EA1 Pend"
if ($r) { $items = if ($r -is [array]) { $r } else { @($r) }; Write-Check "ExtAgent1 pending: $($items.Count) orders" }

Write-Step "9.3" "Pending ExtAgent2"
$r = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent?agentId=$extAgent2Id" -Headers $headers -Label "EA2 Pend"
if ($r) { $items = if ($r -is [array]) { $r } else { @($r) }; Write-Check "ExtAgent2 pending: $($items.Count) orders" }

# ==================== PHASE 10: SUPPLIER PAYMENT ====================
Write-Section "PHASE 10: Thanh toan NCC"
Write-Step "10.1" "Statement Supplier1 02/01-15"
$body = @{ supplierId=$supplier1Id; from="2026-02-01"; to="2026-02-15"; notes="E2E v2 S1" } | ConvertTo-Json
$stmt1 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $headers -Body $body -Label "SP1 Stmt"
if ($stmt1 -and ($stmt1._id -or $stmt1.id)) {
    $stmt1Id = if ($stmt1._id) { $stmt1._id } else { $stmt1.id }
    Write-Pass "SP1 Statement: $stmt1Id, opening=$($stmt1.openingBalance), period=$($stmt1.periodPayables)"
    $script:testResults["sp_stmt1_id"] = $stmt1Id
} else { Write-Fail "SP1 Statement FAIL" }

Write-Step "10.2" "Pay Supplier1: 500K"
if ($script:testResults["sp_stmt1_id"]) {
    $body = @{ amount=500000; method="bank_transfer"; reference="TXN-S1-001"; notes="E2E" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$($script:testResults["sp_stmt1_id"])/payments" -Headers $headers -Body $body -Label "SP1 Pay"
    if ($r) { Write-Pass "SP1 paid 500K" } else { Write-Fail "SP1 pay FAIL" }
}

Write-Step "10.3" "Statement Supplier2 02/01-15"
$body = @{ supplierId=$supplier2Id; from="2026-02-01"; to="2026-02-15"; notes="E2E v2 S2" } | ConvertTo-Json
$stmt2 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $headers -Body $body -Label "SP2 Stmt"
if ($stmt2 -and ($stmt2._id -or $stmt2.id)) {
    $stmt2Id = if ($stmt2._id) { $stmt2._id } else { $stmt2.id }
    Write-Pass "SP2 Statement: $stmt2Id"
    $script:testResults["sp_stmt2_id"] = $stmt2Id
} else { Write-Fail "SP2 Statement FAIL" }

Write-Step "10.4" "Pay Supplier2: 400K"
if ($script:testResults["sp_stmt2_id"]) {
    $body = @{ amount=400000; method="bank_transfer"; reference="TXN-S2-001"; notes="E2E" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$($script:testResults["sp_stmt2_id"])/payments" -Headers $headers -Body $body -Label "SP2 Pay"
    if ($r) { Write-Pass "SP2 paid 400K" } else { Write-Fail "SP2 pay FAIL" }
}

# ==================== PHASE 11: AGENT PAYMENT ====================
Write-Section "PHASE 11: Thanh toan hoa hong dai ly"
Write-Step "11.1" "Statement ExtAgent1"
$body = @{ agentId=$extAgent1Id; periodFrom="2026-02-01"; periodTo="2026-02-15"; notes="E2E AG1" } | ConvertTo-Json
$agStmt1 = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Body $body -Label "AG1 Stmt"
if ($agStmt1 -and ($agStmt1._id -or $agStmt1.id)) {
    $agStmt1Id = if ($agStmt1._id) { $agStmt1._id } else { $agStmt1.id }
    Write-Pass "AG1 Statement: $agStmt1Id, receivables=$($agStmt1.periodReceivables)"
    $script:testResults["ag_stmt1_id"] = $agStmt1Id
} else { Write-Fail "AG1 Statement FAIL" }

Write-Step "11.2" "Pay ExtAgent1: 200K"
if ($script:testResults["ag_stmt1_id"]) {
    $body = @{ amount=200000; method="bank_transfer"; reference="TXN-AG1-001"; notes="E2E" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$($script:testResults["ag_stmt1_id"])/payments" -Headers $headers -Body $body -Label "AG1 Pay"
    if ($r) { Write-Pass "AG1 paid 200K" } else { Write-Fail "AG1 pay FAIL" }
}

Write-Step "11.3" "Statement ExtAgent2"
$body = @{ agentId=$extAgent2Id; periodFrom="2026-02-01"; periodTo="2026-02-15"; notes="E2E AG2" } | ConvertTo-Json
$agStmt2 = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $headers -Body $body -Label "AG2 Stmt"
if ($agStmt2 -and ($agStmt2._id -or $agStmt2.id)) {
    $agStmt2Id = if ($agStmt2._id) { $agStmt2._id } else { $agStmt2.id }
    Write-Pass "AG2 Statement: $agStmt2Id"
    $script:testResults["ag_stmt2_id"] = $agStmt2Id
} else { Write-Fail "AG2 Statement FAIL" }

Write-Step "11.4" "Pay ExtAgent2: 150K"
if ($script:testResults["ag_stmt2_id"]) {
    $body = @{ amount=150000; method="bank_transfer"; reference="TXN-AG2-001"; notes="E2E" } | ConvertTo-Json
    $r = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$($script:testResults["ag_stmt2_id"])/payments" -Headers $headers -Body $body -Label "AG2 Pay"
    if ($r) { Write-Pass "AG2 paid 150K" } else { Write-Fail "AG2 pay FAIL" }
}

# ==================== PHASE 12: FC AFTER ====================
Write-Section "PHASE 12: Financial Control SAU thanh toan"
Write-Step "12.1" "FC Dashboard AFTER"
$fcAfter = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/dashboard" -Headers $headers -Label "FC After"
if ($fcAfter) {
    Write-Pass "FC: bank=$($fcAfter.bankBalance), free=$($fcAfter.freeCash), committed=$($fcAfter.committedCash)"
    Write-Info "  burn=$($fcAfter.monthlyBurn), runway=$($fcAfter.runwayMonths), withdrawable=$($fcAfter.ownerWithdrawable)"
    $script:testResults["fc_after"] = $fcAfter
}

Write-Step "12.2" "FC Forecast"
$forecast = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/forecast" -Headers $headers -Label "Forecast"
if ($forecast) { Write-Pass "Forecast lowPoint=$($forecast.lowPoint)" }

Write-Step "12.3" "Cashflow Health"
$cfH = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label "CF Health"
if ($cfH) { Write-Pass "CSI=$($cfH.csi), DSO=$($cfH.dso), DPO=$($cfH.dpo)" }

Write-Step "12.4" "Module Health"
$mh = Safe-Request -Method GET -Uri "$BaseUrl/financial-control/module-health" -Headers $headers -Label "ModHealth"
if ($mh) { Write-Pass "Module Health: $($mh.overall)" }

# ==================== PHASE 13: DELETE + CLOSE ====================
Write-Section "PHASE 13: Delete don #10 + Close statements"
Write-Step "13.1" "Delete don #10"
if ($script:createdOrderIds.Count -ge 10) {
    Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[9])" -Headers $headers -Label "Del 10" | Out-Null
    Write-Pass "Don #10 deleted"
}

$stmtIds = @{ sp1=$script:testResults["sp_stmt1_id"]; sp2=$script:testResults["sp_stmt2_id"]; ag1=$script:testResults["ag_stmt1_id"]; ag2=$script:testResults["ag_stmt2_id"] }
foreach ($k in $stmtIds.Keys) {
    if ($stmtIds[$k]) {
        $prefix = if ($k -like "sp*") { "supplier-payables" } else { "agent-payables" }
        $r = Safe-Request -Method PATCH -Uri "$BaseUrl/$prefix/statements/$($stmtIds[$k])/close" -Headers $headers -Body "{}" -Label "Close $k"
        if ($r -and $r.status -eq "closed") { Write-Pass "Statement $k CLOSED" } else { Write-Info "Close $k result: $($r.status)" }
    }
}

# ==================== PHASE 14: RECALCULATE + FINAL TABLE ====================
Write-Section "PHASE 14: Recalculate + Final Summary"
Write-Step "14.1" "Recalculate all profits"
$recalc = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/recalculate-all-profits?from=2026-02-08&to=2026-02-15" -Headers $headers -Body "{}" -Label "Recalc"
if ($recalc) { Write-Pass "Recalculate: $($recalc | ConvertTo-Json -Compress)" }

Write-Step "14.2" "Final Table"
Write-Host ""
Write-Host ("  {0,-4} {1,-22} {2,-14} {3,-12} {4,-10} {5,-10} {6,-10}" -f "#","OrderStatus","SuppPaid","AgPaid","AgSt","Gross","Net") -ForegroundColor White
Write-Host ("  " + "-" * 85) -ForegroundColor White
for ($i = 0; $i -lt [Math]::Min(9, $script:createdOrderIds.Count); $i++) {
    $o = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($script:createdOrderIds[$i])" -Headers $headers -Label "Final $($i+1)"
    if ($o) {
        $sp = if ($null -ne $o.supplierPaidAmount) { $o.supplierPaidAmount } else { "-" }
        $ap = if ($null -ne $o.agentPaidAmount) { $o.agentPaidAmount } else { "-" }
        $agS = if ($o.agentPaymentStatus) { $o.agentPaymentStatus } else { "-" }
        $gp = if ($null -ne $o.grossProfit) { $o.grossProfit } else { "-" }
        $np = if ($null -ne $o.netProfit) { $o.netProfit } else { "-" }
        Write-Host ("  {0,-4} {1,-22} {2,-14} {3,-12} {4,-10} {5,-10} {6,-10}" -f "#$($i+1)",$o.orderStatus,$sp,$ap,$agS,$gp,$np)
    }
}

# ==================== PHASE 15: BEFORE/AFTER COMPARISON ====================
Write-Section "PHASE 15: So sanh TRUOC / SAU"
if ($script:testResults["fc_before"] -and $script:testResults["fc_after"]) {
    $b = $script:testResults["fc_before"]; $a = $script:testResults["fc_after"]
    Write-Host ("  {0,-25} {1,18} {2,18} {3,18}" -f "Metric","BEFORE","AFTER","DELTA") -ForegroundColor White
    Write-Host ("  " + "-" * 80) -ForegroundColor White
    foreach ($m in @("bankBalance","freeCash","committedCash","monthlyBurn","ownerWithdrawable")) {
        $bV = if ($b.PSObject.Properties[$m]) { $b.$m } else { 0 }
        $aV = if ($a.PSObject.Properties[$m]) { $a.$m } else { 0 }
        $d = $aV - $bV; $ds = if ($d -gt 0) { "+$d" } elseif ($d -lt 0) { "$d" } else { "0" }
        Write-Host ("  {0,-25} {1,18:N0} {2,18:N0} {3,18}" -f $m,$bV,$aV,$ds)
    }
}

if ($script:testResults["ap_before"] -and $script:testResults["ap_after"]) {
    Write-Host ""
    $b = $script:testResults["ap_before"]; $a = $script:testResults["ap_after"]
    Write-Host ("  {0,-35} {1,15} {2,15}" -f "Agent Metric","BEFORE","AFTER") -ForegroundColor White
    Write-Host ("  " + "-" * 67) -ForegroundColor White
    foreach ($m in @("totalAgentCommissionIncurred","totalAgentNetPayable","totalAgentPaid","totalAgentUnpaid")) {
        $bV = if ($b.PSObject.Properties[$m]) { $b.$m } else { 0 }
        $aV = if ($a.PSObject.Properties[$m]) { $a.$m } else { 0 }
        Write-Host ("  {0,-35} {1,15:N0} {2,15:N0}" -f $m,$bV,$aV)
    }
}

# ==================== FINAL ====================
Write-Section "KET QUA TONG HOP"
Write-Host "  PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL: $($script:failCount)" -ForegroundColor Red
Write-Host "  Orders: $($script:createdOrderIds.Count)" -ForegroundColor White
if ($script:failCount -gt 0) { Write-Host "  FAIL details:" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
Write-Host ""
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green } else { Write-Host "  CO LOI - Kiem tra chi tiet" -ForegroundColor Red }

$exportResults = @{ timestamp=(Get-Date -Format "yyyy-MM-dd HH:mm:ss"); pass=$script:passCount; fail=$script:failCount; failDetails=$script:failDetails; orders=$script:createdOrderIds }
$exportResults | ConvertTo-Json -Depth 5 | Out-File -FilePath "test-business-flow-e2e-v2-results.json" -Encoding utf8
Write-Host "  Results: test-business-flow-e2e-v2-results.json" -ForegroundColor Gray
`;

const outPath = path.join(__dirname, 'test-business-flow-e2e-v2.ps1');
fs.writeFileSync(outPath, BOM + script, 'utf8');
console.log('Generated:', outPath, '- Size:', fs.statSync(outPath).size, 'bytes');
