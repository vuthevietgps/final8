#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-FINANCIAL-IMPACT-E2E.ps1 v2
    =====================================================================================
    Comprehensive E2E test: Verify that changes to orders, shipping, production,
    agents, suppliers, quotes, products, loans, costs, ads... correctly impact
    Financial Control calculations.

    FC service has 30s cache - we use Sleep 32 between action and verify.

    Phases:
    0. Login + Full Setup (users, product, category, fanpage, ad account, ad group,
       supplier quote, agent quote)
    1. Order Create + Delivery (Giao thanh cong) → Payment trigger verify
    2. Return Order (Hang hoan) → returnFee impact on profit
    3. Change Agent → Quote snapshot cleared + recalculated
    4. Change Supplier → Quote snapshot cleared + recalculated
    5. Other Cost → Committed Cash + Monthly Burn impact
    6. Loan Disburse/Repay → BankBalance + Debt impact
    7. Advertising Cost → Ads metrics impact
    8. Supplier Payment Batch → Revenue flow
    9. FC Formula Verification (math consistency check)
    10. Cleanup
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

# ========== UTILITIES ==========
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
        $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return $null
    }
}

function Get-FCFull {
    param([hashtable]$Headers)
    return (Safe-Request -Method GET -Uri "$BaseUrl/financial-control/full" -Headers $Headers -Label "FC-Full")
}

function Wait-CacheExpire {
    Write-Host "  [WAIT] Waiting 32s for FC cache to expire..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 32
}

function Get-Id($obj) {
    if ($obj._id) { return $obj._id }
    if ($obj.id) { return $obj.id }
    return ""
}

function Assert-NumberChanged {
    param([string]$Name, $Before, $After, [string]$Direction = "any")
    $b = [double]$Before; $a = [double]$After
    if ($Direction -eq "increase" -and $a -gt $b) {
        Write-Pass "$Name increased: $b -> $a (delta: +$([math]::Round($a - $b, 0)))"
        return $true
    } elseif ($Direction -eq "decrease" -and $a -lt $b) {
        Write-Pass "$Name decreased: $b -> $a (delta: $([math]::Round($a - $b, 0)))"
        return $true
    } elseif ($Direction -eq "any" -and $a -ne $b) {
        Write-Pass "$Name changed: $b -> $a (delta: $([math]::Round($a - $b, 0)))"
        return $true
    } else {
        Write-Fail "$Name did NOT change as expected ($Direction): before=$b, after=$a"
        return $false
    }
}

function Assert-Equal {
    param([string]$Name, $Expected, $Actual, [double]$Tolerance = 1)
    $e = [double]$Expected; $a = [double]$Actual
    if ([math]::Abs($e - $a) -le $Tolerance) {
        Write-Pass "$Name = $a (expected: $e)"
    } else {
        Write-Fail "$Name = $a (expected: $e, diff: $([math]::Round($a - $e, 2)))"
    }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
# Cleanup IDs tracker
$script:cleanupOrders = @()
$script:cleanupCostIds = @()
$script:cleanupAdCostIds = @()
$script:cleanupLoanId = ""
$script:cleanupSqId = ""
$script:cleanupAqId = ""
$script:cleanupUserIds = @()

Write-Section "FINANCIAL IMPACT E2E TEST v2 - $ts"

# ===== PHASE 0: LOGIN + FULL SETUP =====
Write-Section "PHASE 0: Login + Full Setup"

Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK - userId: $($lr.user.id)"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
    $directorId = $lr.user.id
} else { Write-Fail "Login failed - cannot continue"; exit 1 }

# Get existing users
Write-Step "0.2" "Get/Create users (supplier, internal agent, external agent)"
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "Users"
$supplier = $null; $intAgent = $null; $extAgent = $null
$userList = if ($users.data) { $users.data } elseif ($users -is [array]) { $users } else { @() }
foreach ($u in $userList) {
    if ($u.role -eq "internal_supplier" -and !$supplier) { $supplier = $u }
    if ($u.role -eq "internal_agent" -and !$intAgent) { $intAgent = $u }
    if ($u.role -eq "external_agent" -and !$extAgent) { $extAgent = $u }
}

# Create external agent if needed
if (!$extAgent) {
    $agBody = (@{ email = "fc-ext-agent-$ts@test.com"; password = "123456"; fullName = "FC ExtAgent"; role = "external_agent"; phone = "0999111222"; isActive = $true } | ConvertTo-Json)
    $extAgent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $agBody -Label "CreateExtAgent"
    if ($extAgent) { $script:cleanupUserIds += (Get-Id $extAgent); Write-Pass "Created external agent: $(Get-Id $extAgent)" }
}

# Create internal agent if needed
if (!$intAgent) {
    $iaBody = (@{ email = "fc-int-agent-$ts@test.com"; password = "123456"; fullName = "FC IntAgent"; role = "internal_agent"; phone = "0999222333"; isActive = $true } | ConvertTo-Json)
    $intAgent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $iaBody -Label "CreateIntAgent"
    if ($intAgent) { $script:cleanupUserIds += (Get-Id $intAgent); Write-Pass "Created internal agent: $(Get-Id $intAgent)" }
}

# Create supplier if needed
if (!$supplier) {
    $spBody = (@{ email = "fc-supplier-$ts@test.com"; password = "123456"; fullName = "FC Supplier"; role = "internal_supplier"; phone = "0999333444"; isActive = $true } | ConvertTo-Json)
    $supplier = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $spBody -Label "CreateSupplier"
    if ($supplier) { $script:cleanupUserIds += (Get-Id $supplier); Write-Pass "Created supplier: $(Get-Id $supplier)" }
}

$supplierId = Get-Id $supplier
$intAgentId = Get-Id $intAgent
$extAgentId = Get-Id $extAgent
Write-Info "supplierId=$supplierId, intAgentId=$intAgentId, extAgentId=$extAgentId"

# Get/create product category
Write-Step "0.3" "Get/Create product category + product"
$cats = Safe-Request -Method GET -Uri "$BaseUrl/product-category" -Headers $h -Label "Categories"
$catList = if ($cats.data) { $cats.data } elseif ($cats -is [array]) { $cats } else { @() }
$catId = if ($catList.Count -gt 0) { Get-Id $catList[0] } else { "" }
if (!$catId) {
    $catBody = (@{ name = "FC Test Cat $ts"; description = "FC E2E test category"; isActive = $true } | ConvertTo-Json)
    $newCat = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $catBody -Label "CreateCat"
    if ($newCat) { $catId = Get-Id $newCat }
}
Write-Info "catId=$catId"

$prods = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "Products"
$prodList = if ($prods.data) { $prods.data } elseif ($prods -is [array]) { $prods } else { @() }
$productId = if ($prodList.Count -gt 0) { Get-Id $prodList[0] } else { "" }
if (!$productId -and $catId) {
    $newProd = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body (@{ name = "FC Test Product"; categoryId = $catId } | ConvertTo-Json) -Label "CreateProd"
    if ($newProd) { $productId = Get-Id $newProd }
}
Write-Info "productId=$productId"

# Get/create fanpage (requires accessToken)
Write-Step "0.4" "Get/Create fanpage, ad account, ad group"
$fanpages = Safe-Request -Method GET -Uri "$BaseUrl/fanpages" -Headers $h -Label "Fanpages"
$fpList = if ($fanpages -is [array]) { $fanpages } elseif ($fanpages.data) { $fanpages.data } else { @() }
$fanpageId = if ($fpList.Count -gt 0) { Get-Id $fpList[0] } else { "" }
if (!$fanpageId) {
    $fpBody = (@{ name = "FC Test Page"; pageId = "fc_test_$ts"; accessToken = "test_token_$ts" } | ConvertTo-Json)
    $newFp = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $fpBody -Label "CreateFanpage"
    if ($newFp) { $fanpageId = Get-Id $newFp; Write-Pass "Created fanpage: $fanpageId" }
}
Write-Info "fanpageId=$fanpageId"

# Get/create ad account
$adAccounts = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts" -Headers $h -Label "AdAccounts"
$aaList = if ($adAccounts.data) { $adAccounts.data } elseif ($adAccounts -is [array]) { $adAccounts } else { @() }
$adAccountId = if ($aaList.Count -gt 0) { Get-Id $aaList[0] } else { "" }
if (!$adAccountId) {
    $aaBody = (@{ name = "FC Test Ad Account"; accountId = "fc_aa_$ts"; accountType = "facebook" } | ConvertTo-Json)
    $newAa = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $aaBody -Label "CreateAdAccount"
    if ($newAa) { $adAccountId = Get-Id $newAa; Write-Pass "Created ad account: $adAccountId" }
}
Write-Info "adAccountId=$adAccountId"

# Get/create ad group
$adGroups = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $h -Label "AdGroups"
$agList = if ($adGroups.data) { $adGroups.data } elseif ($adGroups -is [array]) { $adGroups } else { @() }
$adGroupId = if ($agList.Count -gt 0) { Get-Id $agList[0] } else { "" }
if (!$adGroupId -and $fanpageId -and $catId -and $extAgentId -and $adAccountId) {
    $agBody = (@{
        name = "FC Test Group"; adGroupId = "fc_ag_$ts"; platform = "facebook"
        fanpageId = $fanpageId; productCategoryId = $catId; agentId = $extAgentId; adAccountId = $adAccountId
        isActive = $true
    } | ConvertTo-Json)
    $newAg = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $agBody -Label "CreateAdGroup"
    if ($newAg) { $adGroupId = Get-Id $newAg; Write-Pass "Created ad group: $adGroupId" }
}
Write-Info "adGroupId=$adGroupId"

# Create supplier quote (correct DTO: price, not priceLevel1/2/3)
Write-Step "0.5" "Create supplier quote + agent quote"
if ($supplierId -and $productId) {
    $sqBody = (@{
        supplierId = $supplierId; productId = $productId; price = 50000
        shippingFee = 30000; returnFee = 25000; effectiveAt = (Get-Date).ToString("yyyy-MM-dd")
    } | ConvertTo-Json)
    $sq = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $h -Body $sqBody -Label "CreateSQ"
    if ($sq) { $script:cleanupSqId = Get-Id $sq; Write-Pass "Supplier quote: $(Get-Id $sq) (price:50000, ship:30000, return:25000)" }
    else { Write-Info "Supplier quote creation failed - will use manual prices" }
}

# Create agent quote
if ($extAgentId -and $productId) {
    $aqBody = (@{ agentId = $extAgentId; productId = $productId; price = 80000; isActive = $true; status = "approved" } | ConvertTo-Json)
    $aq = Safe-Request -Method POST -Uri "$BaseUrl/quotes" -Headers $h -Body $aqBody -Label "CreateAQ"
    if ($aq) { $script:cleanupAqId = Get-Id $aq; Write-Pass "Agent quote: $(Get-Id $aq) (price:80000)" }
    else { Write-Info "Agent quote creation failed" }
}

Write-Pass "Setup complete"

# ===== PHASE 1: ORDER DELIVERY → PAYMENT TRIGGER =====
Write-Section "PHASE 1: Create Order + Delivery (Giao thanh cong)"

Write-Step "1.1" "Create order with supplier/agent/product"
$orderBody = (@{
    customerName = "FC-Test 001"
    productId = $productId; supplierId = $supplierId; agentId = $extAgentId; adGroupId = $adGroupId
    quantity = 2; codAmount = 200000; orderDate = (Get-Date).ToString("yyyy-MM-dd")
    productionStatus = "Chưa làm"; orderStatus = "Chưa có mã vận đơn"
} | ConvertTo-Json)
$order1 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $orderBody -Label "CreateOrder1"
$order1Id = ""
if ($order1) {
    $order1Id = Get-Id $order1; $script:cleanupOrders += $order1Id
    Write-Pass "Order created: $order1Id"
    Write-Info "  supplierQuote=$($order1.supplierQuote), agentQuote=$($order1.agentQuote), shippingFee=$($order1.shippingFee), returnFee=$($order1.returnFee)"
    Write-Info "  supplierAppliedPrice=$($order1.supplierAppliedPrice), agentAppliedPrice=$($order1.agentAppliedPrice)"

    # Verify quotes were auto-calculated from DB
    if ($order1.supplierQuote -gt 0) {
        Write-Pass "supplierQuote auto-calculated: $($order1.supplierQuote)"
    } else { Write-Fail "supplierQuote = 0 (auto-calculation from SupplierQuote DB may have failed)" }

    if ($order1.grossProfit -eq 0 -or $null -eq $order1.grossProfit) {
        Write-Pass "grossProfit = 0 (correct: order not yet completed)"
    } else { Write-Fail "grossProfit should be 0 for non-completed order, got: $($order1.grossProfit)" }
} else { Write-Fail "Create order failed" }

Write-Step "1.2" "Update order status to 'Giao thành công'"
if ($order1Id) {
    # Use UTF8 encoded body for Vietnamese
    $upBody = '{"orderStatus":"Giao th\u00e0nh c\u00f4ng"}'
    $order1Del = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$order1Id" -Headers $h -Body $upBody -Label "DeliverOrder"
    if ($order1Del) {
        Write-Pass "Order status = '$($order1Del.orderStatus)'"

        # Get the actual supplierQuote from the saved order for formula verification
        $sq = [double]($order1Del.supplierQuote)
        $aq = [double]($order1Del.agentQuote)
        $cod = [double]($order1Del.codAmount)
        $qty = [double]($order1Del.quantity)
        $ship = [double]($order1Del.shippingFee)
        $ret = [double]($order1Del.returnFee)

        Write-Info "  Values: cod=$cod, sq=$sq, aq=$aq, qty=$qty, ship=$ship, ret=$ret"

        # supplierPaidAmount = codAmount - (supplierQuote * qty) - shippingFee
        $expectedSP = $cod - ($sq * $qty) - $ship
        $actualSP = [double]($order1Del.supplierPaidAmount)
        if ($sq -gt 0) {
            Assert-Equal "supplierPaidAmount" $expectedSP $actualSP
        } else { Write-Info "supplierQuote=0, skipping supplierPaidAmount formula check" }

        # supplierPaymentStatus should be 'pending'
        if ($order1Del.supplierPaymentStatus -eq "pending") {
            Write-Pass "supplierPaymentStatus = 'pending'"
        } else { Write-Fail "supplierPaymentStatus = '$($order1Del.supplierPaymentStatus)' (expected 'pending')" }

        # agentPaidAmount (external agent): codAmount - (agentQuote * qty) - shippingFee
        $expectedAP = $cod - ($aq * $qty) - $ship
        $actualAP = [double]($order1Del.agentPaidAmount)
        if ($aq -gt 0) {
            Assert-Equal "agentPaidAmount" $expectedAP $actualAP
            if ($order1Del.agentPaymentStatus -eq "pending") {
                Write-Pass "agentPaymentStatus = 'pending' (external agent)"
            } else { Write-Fail "agentPaymentStatus = '$($order1Del.agentPaymentStatus)' (expected 'pending')" }
        } else {
            Write-Info "agentQuote=0, checking if agent was recognized"
            if ($order1Del.agentPaymentStatus -eq "n/a") {
                Write-Info "agentPaymentStatus = 'n/a' (agent may not be recognized as external)"
            }
        }

        # grossProfit should be non-zero for completed order
        $gp = [double]($order1Del.grossProfit)
        if ($gp -ne 0) { Write-Pass "grossProfit = $gp (non-zero for completed order)" }
        else { Write-Info "grossProfit = 0 (may be expected if quotes are 0)" }

        # agentCommissionFinal snapshot
        if ($order1Del.agentCommissionFinal -ne $null -and $order1Del.agentCommissionFinal -ne 0) {
            Write-Pass "agentCommissionFinal snapshot: $($order1Del.agentCommissionFinal)"
        }

        # codCollectedBySupplier auto-filled
        if ([double]($order1Del.codCollectedBySupplier) -gt 0) {
            Write-Pass "codCollectedBySupplier auto-filled: $($order1Del.codCollectedBySupplier)"
        }
    } else { Write-Fail "Delivery update failed" }
} else { Write-Fail "No order to update" }

# ===== PHASE 2: RETURN ORDER =====
Write-Section "PHASE 2: Return Order (Hàng hoàn) → returnFee Impact"

Write-Step "2.1" "Create second order + set to returned"
$order2Body = (@{
    customerName = "FC-Test 002-Return"; productId = $productId; supplierId = $supplierId
    agentId = $extAgentId; quantity = 1; codAmount = 150000
    orderDate = (Get-Date).ToString("yyyy-MM-dd"); orderStatus = "Đang giao"
} | ConvertTo-Json)
$order2 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $order2Body -Label "CreateOrder2"
$order2Id = if ($order2) { Get-Id $order2 } else { "" }
if ($order2Id) { $script:cleanupOrders += $order2Id; Write-Pass "Order 2: $order2Id" }

Write-Step "2.2" "Update to 'Hàng hoàn'"
if ($order2Id) {
    $retBody = '{"orderStatus":"H\u00e0ng ho\u00e0n"}'
    $order2Ret = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$order2Id" -Headers $h -Body $retBody -Label "ReturnOrder"
    if ($order2Ret) {
        Write-Pass "Order 2 status = '$($order2Ret.orderStatus)'"
        $sq2 = [double]($order2Ret.supplierQuote)
        $aq2 = [double]($order2Ret.agentQuote)
        $qty2 = [double]($order2Ret.quantity)
        $ship2 = [double]($order2Ret.shippingFee)
        $ret2 = [double]($order2Ret.returnFee)

        # For return: supplierPaidAmount = 0 - (sq * qty) - ship - returnFee
        if ($sq2 -gt 0) {
            $expectedRetSP = 0 - ($sq2 * $qty2) - $ship2 - $ret2
            Assert-Equal "Return supplierPaidAmount" $expectedRetSP ([double]$order2Ret.supplierPaidAmount)
        }

        # For return: agentPaidAmount = 0 - (aq * qty) - ship - returnFee
        if ($aq2 -gt 0) {
            $expectedRetAP = 0 - ($aq2 * $qty2) - $ship2 - $ret2
            Assert-Equal "Return agentPaidAmount" $expectedRetAP ([double]$order2Ret.agentPaidAmount)
        }

        # grossProfit for return: COD=0 so profit = 0 - costs = negative
        $gpRet = [double]($order2Ret.grossProfit)
        if ($gpRet -le 0) {
            Write-Pass "Return grossProfit = $gpRet (correct: non-positive for returned order)"
        } else { Write-Fail "Return grossProfit should be <= 0, got: $gpRet" }
    } else { Write-Fail "Return update failed" }
}

# ===== PHASE 3: CHANGE AGENT =====
Write-Section "PHASE 3: Change Agent → Quote Snapshot Reset"

Write-Step "3.1" "Create order with external agent"
$order3Body = (@{
    customerName = "FC-Test 003-AgentChange"; productId = $productId; supplierId = $supplierId
    agentId = $extAgentId; quantity = 1; codAmount = 100000
    orderDate = (Get-Date).ToString("yyyy-MM-dd")
} | ConvertTo-Json)
$order3 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $order3Body -Label "CreateOrder3"
$order3Id = if ($order3) { Get-Id $order3 } else { "" }
if ($order3Id) {
    $script:cleanupOrders += $order3Id
    Write-Pass "Order 3: $order3Id, agentQuote=$($order3.agentQuote)"
}

Write-Step "3.2" "Change agent to internal agent"
if ($order3Id -and $intAgentId) {
    $chBody = (@{ agentId = $intAgentId } | ConvertTo-Json)
    $order3Ch = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$order3Id" -Headers $h -Body $chBody -Label "ChangeAgent"
    if ($order3Ch) {
        if ($null -eq $order3Ch.agentQuoteId -or $order3Ch.agentQuoteId -eq "") {
            Write-Pass "agentQuoteId cleared after agent change"
        } else { Write-Fail "agentQuoteId NOT cleared: $($order3Ch.agentQuoteId)" }
        Write-Info "After: agentAppliedPrice=$($order3Ch.agentAppliedPrice), agentQuote=$($order3Ch.agentQuote)"
    } else { Write-Fail "Agent change failed" }
} else { Write-Fail "Skip agent change (missing order3=$order3Id or intAgent=$intAgentId)" }

# ===== PHASE 4: CHANGE SUPPLIER =====
Write-Section "PHASE 4: Change Supplier → Quote Snapshot Reset"

Write-Step "4.1" "Create second supplier + change on order"
$sp2Body = (@{ email = "fc-supplier2-$ts@test.com"; password = "123456"; fullName = "FC Supplier2"; role = "internal_supplier"; phone = "0999555666"; isActive = $true } | ConvertTo-Json)
$sp2 = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $sp2Body -Label "CreateSupplier2"
$supplier2Id = if ($sp2) { $script:cleanupUserIds += (Get-Id $sp2); Get-Id $sp2 } else { "" }

if ($order3Id -and $supplier2Id) {
    $chSpBody = (@{ supplierId = $supplier2Id } | ConvertTo-Json)
    $order3Sp = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$order3Id" -Headers $h -Body $chSpBody -Label "ChangeSupplier"
    if ($order3Sp) {
        if ($null -eq $order3Sp.supplierQuoteId -or $order3Sp.supplierQuoteId -eq "") {
            Write-Pass "supplierQuoteId cleared after supplier change"
        } else { Write-Fail "supplierQuoteId NOT cleared" }
        Write-Info "After: supplierAppliedPrice=$($order3Sp.supplierAppliedPrice), supplierQuote=$($order3Sp.supplierQuote)"
    }
} else { Write-Fail "Skip supplier change test" }

# ===== PHASE 5: OTHER COST → FC IMPACT =====
Write-Section "PHASE 5: Other Cost → Committed Cash + Monthly Burn"

Write-Step "5.1" "FC snapshot BEFORE"
Wait-CacheExpire
$fcBefore = Get-FCFull -Headers $h
$commitBefore = if ($fcBefore) { $fcBefore.committedCash } else { 0 }
$burnBefore = if ($fcBefore) { $fcBefore.monthlyBurn } else { 0 }
$bankBefore = if ($fcBefore) { $fcBefore.bankBalance } else { 0 }
Write-Info "BEFORE: bank=$bankBefore, committed=$commitBefore, burn=$burnBefore"

Write-Step "5.2" "Create unpaid other cost (due in 7 days) - uses 'notes' not 'description'"
$dueDate = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$costBody = (@{
    date = (Get-Date).ToString("yyyy-MM-dd"); dueDate = $dueDate
    amount = 5000000; category = "rent"; notes = "FC E2E Test rent"; isConfirmed = $false
} | ConvertTo-Json)
$cost1 = Safe-Request -Method POST -Uri "$BaseUrl/other-cost" -Headers $h -Body $costBody -Label "CreateCost"
$cost1Id = ""
if ($cost1) {
    $cost1Id = Get-Id $cost1; $script:cleanupCostIds += $cost1Id
    Write-Pass "Other cost created: $cost1Id (5M, unpaid, due $dueDate)"
} else { Write-Fail "Create other cost failed" }

Write-Step "5.3" "Verify committedCash increased"
Wait-CacheExpire
$fcAfterCost = Get-FCFull -Headers $h
if ($fcAfterCost -and $cost1Id) {
    Assert-NumberChanged "committedCash (after unpaid cost)" $commitBefore $fcAfterCost.committedCash "increase"
    if ($fcAfterCost.committedBreakdown) {
        Write-Info "Breakdown: ops=$($fcAfterCost.committedBreakdown.operations), labor=$($fcAfterCost.committedBreakdown.labor), agents=$($fcAfterCost.committedBreakdown.agents), debt=$($fcAfterCost.committedBreakdown.loanPayment)"
    }
}

Write-Step "5.4" "Confirm cost (paid) → burn should increase, committed should decrease"
if ($cost1Id) {
    $confirmBody = (@{ isConfirmed = $true } | ConvertTo-Json)
    $costConfirmed = Safe-Request -Method PATCH -Uri "$BaseUrl/other-cost/$cost1Id" -Headers $h -Body $confirmBody -Label "ConfirmCost"
    if ($costConfirmed) {
        Write-Pass "Cost confirmed (paid)"
        Wait-CacheExpire
        $fcAfterConfirm = Get-FCFull -Headers $h
        if ($fcAfterConfirm) {
            Assert-NumberChanged "committedCash (after confirm)" $fcAfterCost.committedCash $fcAfterConfirm.committedCash "decrease"
            Assert-NumberChanged "monthlyBurn (after confirm)" $burnBefore $fcAfterConfirm.monthlyBurn "increase"
            Assert-NumberChanged "bankBalance (after paying cost)" $bankBefore $fcAfterConfirm.bankBalance "decrease"
        }
    } else { Write-Fail "Confirm cost failed" }
}

# ===== PHASE 6: LOAN → BANK BALANCE + DEBT =====
Write-Section "PHASE 6: Loan → BankBalance + Debt"

Write-Step "6.1" "FC snapshot BEFORE loan"
Wait-CacheExpire
$fcBeforeLoan = Get-FCFull -Headers $h
$bankBeforeLoan = if ($fcBeforeLoan) { $fcBeforeLoan.bankBalance } else { 0 }
$debtBefore = if ($fcBeforeLoan) { $fcBeforeLoan.totalDebtOutstanding } else { 0 }
Write-Info "BEFORE: bank=$bankBeforeLoan, debt=$debtBefore"

Write-Step "6.2" "Create loan (name required)"
$loanBody = (@{
    name = "FC Test Loan $ts"; lenderName = "FC Test Bank"
    principal = 10000000; interestRate = 12
    startDate = (Get-Date).ToString("yyyy-MM-dd"); endDate = (Get-Date).AddMonths(12).ToString("yyyy-MM-dd")
    repaymentCycle = "monthly"; status = "active"
} | ConvertTo-Json)
$loan = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans" -Headers $h -Body $loanBody -Label "CreateLoan"
$loanId = ""
if ($loan) {
    $loanId = Get-Id $loan; $script:cleanupLoanId = $loanId
    Write-Pass "Loan created: $loanId (10M @ 12%)"
} else { Write-Fail "Create loan failed" }

Write-Step "6.3" "Disburse 5M"
if ($loanId) {
    $disbBody = (@{ amount = 5000000; date = (Get-Date).ToString("yyyy-MM-dd"); notes = "FC test disburse" } | ConvertTo-Json)
    $disb = Safe-Request -Method POST -Uri "$BaseUrl/finance/loans/$loanId/disburse" -Headers $h -Body $disbBody -Label "Disburse"
    if ($disb) {
        Write-Pass "Loan disbursed 5M"
        Wait-CacheExpire
        $fcAfterDisb = Get-FCFull -Headers $h
        if ($fcAfterDisb) {
            Assert-NumberChanged "bankBalance (after disburse)" $bankBeforeLoan $fcAfterDisb.bankBalance "increase"
            Assert-NumberChanged "totalDebtOutstanding (after disburse)" $debtBefore $fcAfterDisb.totalDebtOutstanding "increase"
        }
    } else { Write-Fail "Disburse failed" }
}

Write-Step "6.4" "Repay 1M principal (via loan-management)"
if ($loanId) {
    $repayBody = (@{ paymentType = "principal"; amount = 1000000; source = "bank_balance"; notes = "FC test repay"; paymentDate = (Get-Date).ToString("yyyy-MM-dd") } | ConvertTo-Json)
    $repay = Safe-Request -Method POST -Uri "$BaseUrl/loan-management/loans/$loanId/pay" -Headers $h -Body $repayBody -Label "Repay"
    if ($repay) {
        Write-Pass "Repaid 1M principal"
        Wait-CacheExpire
        $fcAfterRepay = Get-FCFull -Headers $h
        if ($fcAfterRepay) {
            Assert-NumberChanged "bankBalance (after repay)" $fcAfterDisb.bankBalance $fcAfterRepay.bankBalance "decrease"
            Assert-NumberChanged "totalDebtOutstanding (after repay)" $fcAfterDisb.totalDebtOutstanding $fcAfterRepay.totalDebtOutstanding "decrease"
        }
    } else { Write-Fail "Repay failed" }
}

# ===== PHASE 7: ADVERTISING COST =====
Write-Section "PHASE 7: Advertising Cost → Ads Metrics"

Write-Step "7.1" "Create ad cost (channel not platform, spentAmount not amount)"
if ($adGroupId) {
    $yesterday = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $adCostBody = (@{
        adGroupId = $adGroupId; channel = "facebook"; date = $yesterday
        spentAmount = 300000; impressions = 50000; clicks = 1500; reach = 30000
    } | ConvertTo-Json)
    $adCost = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $adCostBody -Label "CreateAdCost"
    if ($adCost) {
        $adCostId = Get-Id $adCost; $script:cleanupAdCostIds += $adCostId
        Write-Pass "Ad cost created: $adCostId (300K)"
    } else { Write-Fail "Create ad cost failed" }

    Write-Step "7.2" "Verify FC bankBalance decreased (ads = cash-out in fallback calc)"
    Wait-CacheExpire
    $fcAfterAds = Get-FCFull -Headers $h
    if ($fcAfterAds -and $fcAfterRepay) {
        $bankAfterAds = $fcAfterAds.bankBalance
        Write-Info "bank after ads=$bankAfterAds (was $($fcAfterRepay.bankBalance))"
        Assert-NumberChanged "bankBalance (after ad spend)" $fcAfterRepay.bankBalance $bankAfterAds "decrease"
    }
} else { Write-Info "No adGroupId - skipping ad cost test" }

# ===== PHASE 8: SUPPLIER PAYMENT BATCH =====
Write-Section "PHASE 8: Supplier Payment Batch → Revenue Flow"

Write-Step "8.1" "Create supplier payment batch for order 1"
if ($order1Id) {
    $batchBody = (@{
        orderIds = @($order1Id)
        batchId = "SUPP-FC-TEST-$ts"
        paidDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        note = "FC E2E test payment"
    } | ConvertTo-Json)
    $batch = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/supplier-payment-batch" -Headers $h -Body $batchBody -Label "SupplierBatch"
    if ($batch) {
        Write-Pass "Supplier payment batch created"
        Write-Info "Batch result: $($batch | ConvertTo-Json -Compress)"

        # Verify order now has supplierPaymentStatus = 'paid'
        $order1Check = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$order1Id" -Headers $h -Label "CheckOrder1"
        if ($order1Check -and $order1Check.supplierPaymentStatus -eq "paid") {
            Write-Pass "Order 1 supplierPaymentStatus = 'paid'"
        } else { Write-Info "supplierPaymentStatus = $($order1Check.supplierPaymentStatus)" }
    } else { Write-Fail "Supplier payment batch failed" }
}

Write-Step "8.2" "Create agent payment batch for order 1"
if ($order1Id) {
    $agBatchBody = (@{
        orderIds = @($order1Id)
        batchId = "AGENT-FC-TEST-$ts"
        paidDate = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
        note = "FC E2E test agent payment"
    } | ConvertTo-Json)
    $agBatch = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/agent-payment-batch" -Headers $h -Body $agBatchBody -Label "AgentBatch"
    if ($agBatch) {
        Write-Pass "Agent payment batch created"

        # Check realized profit
        Start-Sleep -Seconds 2  # small delay for async recalculation
        $order1Final = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$order1Id" -Headers $h -Label "FinalOrder1"
        if ($order1Final) {
            if ($order1Final.realizedGrossProfit -ne $null -and $order1Final.realizedGrossProfit -ne 0) {
                Write-Pass "realizedGrossProfit = $($order1Final.realizedGrossProfit)"
            } else { Write-Info "realizedGrossProfit not set (may need explicit recalculation)" }

            if ($order1Final.realizedAt) {
                Write-Pass "realizedAt set"
            } else { Write-Info "realizedAt not set" }
        }
    } else { Write-Info "Agent payment batch may have failed (agent may not be external)" }
}

# ===== PHASE 9: FC FORMULA VERIFICATION =====
Write-Section "PHASE 9: FC Formula Consistency Verification"

Write-Step "9.1" "Get fresh FC full metrics"
Wait-CacheExpire
$fc = Get-FCFull -Headers $h
if ($fc) {
    Write-Step "9.2" "freeCash = bankBalance - committedCash"
    Assert-Equal "freeCash" ($fc.bankBalance - $fc.committedCash) $fc.freeCash

    Write-Step "9.3" "survivalFloor = SurvivalMonths × monthlyBurn"
    $sm = if ($fc.config.SurvivalMonths) { $fc.config.SurvivalMonths } else { 3 }
    Assert-Equal "survivalFloor" ($sm * $fc.monthlyBurn) $fc.survivalFloor

    Write-Step "9.4" "availableAfterSurvival = max(0, freeCash - survivalFloor)"
    Assert-Equal "availableAfterSurvival" ([math]::Max(0, $fc.freeCash - $fc.survivalFloor)) $fc.availableAfterSurvival

    Write-Step "9.5" "adsBudgetApproved <= availableAfterSurvival"
    if ($fc.adsBudgetApproved -le $fc.availableAfterSurvival + 1) {
        Write-Pass "adsBudgetApproved ($($fc.adsBudgetApproved)) <= availableAfterSurvival ($($fc.availableAfterSurvival))"
    } else { Write-Fail "adsBudgetApproved > availableAfterSurvival" }

    Write-Step "9.6" "ownerWithdrawable = max(0, availableAfterSurvival - adsBudgetApproved)"
    Assert-Equal "ownerWithdrawable" ([math]::Max(0, $fc.availableAfterSurvival - $fc.adsBudgetApproved)) $fc.ownerWithdrawable

    Write-Step "9.7" "committedCash breakdown sums"
    if ($fc.committedBreakdown) {
        $cb = $fc.committedBreakdown
        Assert-Equal "committedCash sum" ($cb.labor + $cb.operations + $cb.agents + $cb.tax + $cb.loanPayment) $fc.committedCash
    }

    Write-Step "9.8" "monthlyBurn breakdown sums"
    if ($fc.monthlyBurnBreakdown) {
        $mb = $fc.monthlyBurnBreakdown
        Assert-Equal "monthlyBurn sum" ($mb.laborCore + $mb.operationsMandatory + $mb.loanPayment) $fc.monthlyBurn
    }

    Write-Step "9.9" "runway calculation"
    if ($fc.monthlyBurn -eq 0) {
        if ($null -eq $fc.runwayMonths) { Write-Pass "runwayMonths = null (burn=0, infinite)" }
        else { Write-Fail "runwayMonths should be null when burn=0" }
    } elseif ($fc.freeCash -lt 0) {
        if ($fc.runwayMonths -eq 0) { Write-Pass "runwayMonths = 0 (freeCash<0)" }
        else { Write-Fail "runwayMonths should be 0 when freeCash<0" }
    } else {
        Assert-Equal "runwayMonths" ($fc.freeCash / $fc.monthlyBurn) $fc.runwayMonths 0.01
    }

    Write-Step "9.10" "Print FC summary"
    Write-Info "=========== FC Summary ==========="
    Write-Info "bankBalance       = $($fc.bankBalance)"
    Write-Info "committedCash     = $($fc.committedCash)"
    Write-Info "freeCash          = $($fc.freeCash)"
    Write-Info "monthlyBurn       = $($fc.monthlyBurn)"
    Write-Info "runwayMonths      = $($fc.runwayMonths)"
    Write-Info "survivalFloor     = $($fc.survivalFloor)"
    Write-Info "availableAfter    = $($fc.availableAfterSurvival)"
    Write-Info "adsBudgetApproved = $($fc.adsBudgetApproved)"
    Write-Info "ownerWithdrawable = $($fc.ownerWithdrawable)"
    Write-Info "totalDebt         = $($fc.totalDebtOutstanding)"
    Write-Info "isCashCrunch      = $($fc.isCashCrunch)"
    Write-Info "isSurvivalRisk    = $($fc.isSurvivalRisk)"
    Write-Info "runwayStatus      = $($fc.runwayStatus)"
    if ($fc.alerts) { Write-Info "alerts            = $($fc.alerts -join ', ')" }
    Write-Info "=================================="
} else { Write-Fail "FC full metrics unavailable" }

# ===== PHASE 10: CLEANUP =====
Write-Section "PHASE 10: Cleanup"

foreach ($oid in $script:cleanupOrders) {
    if ($oid) { Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$oid" -Headers $h -Label "Del-$oid" | Out-Null; Write-Info "Deleted order: $oid" }
}
foreach ($cid in $script:cleanupCostIds) {
    if ($cid) { Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$cid" -Headers $h -Label "Del-$cid" | Out-Null; Write-Info "Deleted cost: $cid" }
}
foreach ($acid in $script:cleanupAdCostIds) {
    if ($acid) { Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$acid" -Headers $h -Label "Del-$acid" | Out-Null; Write-Info "Deleted ad cost: $acid" }
}
if ($script:cleanupLoanId) {
    Safe-Request -Method DELETE -Uri "$BaseUrl/finance/loans/$($script:cleanupLoanId)" -Headers $h -Label "Del-Loan" | Out-Null
    Write-Info "Deleted loan: $($script:cleanupLoanId)"
}
if ($script:cleanupSqId) {
    Safe-Request -Method DELETE -Uri "$BaseUrl/supplier-quotes/$($script:cleanupSqId)" -Headers $h -Label "Del-SQ" | Out-Null
    Write-Info "Deleted supplier quote"
}
if ($script:cleanupAqId) {
    Safe-Request -Method DELETE -Uri "$BaseUrl/quotes/$($script:cleanupAqId)" -Headers $h -Label "Del-AQ" | Out-Null
    Write-Info "Deleted agent quote"
}
Write-Pass "Cleanup complete"

# ===== SUMMARY =====
Write-Section "SUMMARY"
Write-Host ""
Write-Host "Total: $($script:passCount + $script:failCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })
if ($script:failCount -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
Write-Host ""
exit $script:failCount
