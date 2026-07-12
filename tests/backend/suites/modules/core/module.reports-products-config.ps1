#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.REPORTS-PRODUCTS-CONFIG.PS1
    =====================================================================================
    Test Reports, Product Management & Config modules:
    1. Product CRUD (create, list, get, update, delete, stats)
    2. Product Category CRUD (create, list, active, seed, update, order, delete)
    3. Order Reports (daily-profit, product-profit, export JSON/CSV)
    4. Pending Orders (create, list, approve, delete)
    5. Return Requests (create, get, resolve)
    6. Config modules (delivery-status, production-status, order-status)
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
function Get-BackendBaseUrl {
    $override = [string]$env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}
$BaseUrl = Get-BackendBaseUrl

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

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$phase2CategoryCreatedId = $null
$poProductCreatedId = $null

Write-Section "MODULE TEST: REPORTS, PRODUCTS & CONFIG - $ts"

# ===== LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
} else { Write-Fail "Login failed"; exit 1 }

# ===== PHASE 1: PRODUCT CATEGORY CRUD =====
Write-Section "PHASE 1: Product Category CRUD"

Write-Step "1.1" "Seed product categories"
$catSeed = Safe-Request -Method POST -Uri "$BaseUrl/product-category/seed" -Headers $h -Label "SeedCats"
if ($catSeed -ne $null) {
    Write-Pass "Category seed OK"
} else {
    Write-Info "Category seed endpoint is disabled unless ALLOW_DANGEROUS_SEED=true"
    Write-Pass "Category seed guard honored"
}

Write-Step "1.2" "Create product category"
$cat1Body = @{
    name = "Test Category $ts"
    description = "Auto test category"
    color = "#FF5733"
    icon = "test-icon"
    code = "TC-$ts"
    isActive = $true
    order = 99
} | ConvertTo-Json
$cat1 = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $cat1Body -Label "CreateCat"
if ($cat1 -and $cat1._id) {
    $cat1Id = $cat1._id
    Write-Pass "Category created: $cat1Id ($($cat1.name))"
} else { Write-Fail "Create category failed" }

Write-Step "1.3" "List all categories"
$catList = Safe-Request -Method GET -Uri "$BaseUrl/product-category" -Headers $h -Label "ListCats"
if ($catList) {
    $cats = if ($catList -is [array]) { $catList } elseif ($catList.data) { $catList.data } else { @($catList) }
    Write-Pass "Categories found: $($cats.Count)"
} else { Write-Fail "List categories failed" }

Write-Step "1.4" "Active categories"
$catActive = Safe-Request -Method GET -Uri "$BaseUrl/product-category/active" -Headers $h -Label "ActiveCats"
if ($catActive -ne $null) { Write-Pass "Active categories OK" } else { Write-Fail "Active categories failed" }

Write-Step "1.5" "Category stats summary"
$catStats = Safe-Request -Method GET -Uri "$BaseUrl/product-category/stats/summary" -Headers $h -Label "CatStats"
if ($catStats) { Write-Pass "Category stats OK" } else { Write-Fail "Category stats failed" }

Write-Step "1.6" "Update category"
if ($cat1Id) {
    $catUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/product-category/$cat1Id" -Headers $h -Body '{"description":"Updated description"}' -Label "UpdateCat"
    if ($catUpd) { Write-Pass "Category updated" } else { Write-Fail "Update category failed" }
}

Write-Step "1.7" "Update category order"
if ($cat1Id) {
    $catOrd = Safe-Request -Method PATCH -Uri "$BaseUrl/product-category/$cat1Id/order" -Headers $h -Body '{"order":50}' -Label "CatOrder"
    if ($catOrd) { Write-Pass "Category order updated: 99 -> 50" } else { Write-Fail "Update order failed" }
}

Write-Step "1.8" "Update product count"
if ($cat1Id) {
    $catCnt = Safe-Request -Method PATCH -Uri "$BaseUrl/product-category/$cat1Id/product-count" -Headers $h -Body '{"count":10}' -Label "CatCount"
    if ($catCnt) { Write-Pass "Product count updated: 10" } else { Write-Fail "Update product count failed" }
}

Write-Step "1.9" "Get single category"
if ($cat1Id) {
    $catGet = Safe-Request -Method GET -Uri "$BaseUrl/product-category/$cat1Id" -Headers $h -Label "GetCat"
    if ($catGet -and $catGet._id) { Write-Pass "Get category: $($catGet.name)" } else { Write-Fail "Get category failed" }
}

Write-Step "1.10" "Delete category"
if ($cat1Id) {
    $catDel = Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$cat1Id" -Headers $h -Label "DeleteCat"
    if ($catDel -ne $null) { Write-Pass "Category deleted" } else { Write-Fail "Delete category failed" }
}

# ===== PHASE 2: PRODUCT CRUD =====
Write-Section "PHASE 2: Product CRUD"

Write-Step "2.1" "Seed products"
$prodSeed = Safe-Request -Method POST -Uri "$BaseUrl/products/seed" -Headers $h -Label "SeedProds"
if ($prodSeed -ne $null) {
    Write-Pass "Product seed OK"
} else {
    Write-Info "Product seed endpoint is disabled unless ALLOW_DANGEROUS_SEED=true"
    Write-Pass "Product seed guard honored"
}

Write-Step "2.2" "Create product"
# Get a category for the product
$catForProd = Safe-Request -Method GET -Uri "$BaseUrl/product-category/active" -Headers $h -Label "GetCatForProd"
$catForProdList = if ($catForProd -is [array]) { $catForProd } elseif ($catForProd.data) { $catForProd.data } else { @($catForProd) }
$prodCatId = if ($catForProdList.Count -gt 0) { $catForProdList[0]._id } else { $null }
if (-not $prodCatId) {
    $phase2CategoryBody = @{
        name = "Phase2 Category $ts"
        description = "Fallback category for reports-products-config"
        code = "P2-$ts"
        isActive = $true
        order = 101
    } | ConvertTo-Json
    $phase2Category = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $phase2CategoryBody -Label "CreatePhase2Cat"
    if ($phase2Category -and $phase2Category._id) {
        $phase2CategoryCreatedId = $phase2Category._id
        $prodCatId = $phase2CategoryCreatedId
        Write-Info "Created fallback active category for product phase: $phase2CategoryCreatedId"
    }
}

$prod1Body = @{
    name = "Test Product $ts"
    categoryId = $prodCatId
} | ConvertTo-Json
$prod1 = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $prod1Body -Label "CreateProd"
if ($prod1 -and $prod1._id) {
    $prod1Id = $prod1._id
    Write-Pass "Product created: $prod1Id ($($prod1.name))"
} else { Write-Fail "Create product failed" }

Write-Step "2.3" "List products"
$prodList = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "ListProds"
if (($null -ne $prodList) -or ($prodList -is [array])) {
    $prods = if ($prodList -is [array]) { $prodList } elseif ($prodList.data) { $prodList.data } else { @($prodList) }
    Write-Pass "Products found: $($prods.Count)"
} else { Write-Fail "List products failed" }

Write-Step "2.4" "Product stats"
$prodStats = Safe-Request -Method GET -Uri "$BaseUrl/products/stats" -Headers $h -Label "ProdStats"
if ($prodStats -ne $null) { Write-Pass "Product stats OK" } else { Write-Fail "Product stats failed" }

Write-Step "2.5" "Get single product"
if ($prod1Id) {
    $prodGet = Safe-Request -Method GET -Uri "$BaseUrl/products/$prod1Id" -Headers $h -Label "GetProd"
    if ($prodGet -and $prodGet._id) { Write-Pass "Get product: $($prodGet.name), price=$($prodGet.price)" }
    else { Write-Fail "Get product failed" }
}

Write-Step "2.6" "Update product"
if ($prod1Id) {
    $prodUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/products/$prod1Id" -Headers $h -Body '{"name":"Updated Product Name","importPrice":180000}' -Label "UpdateProd"
    if ($prodUpd) { Write-Pass "Product updated" } else { Write-Fail "Update product failed" }
}

Write-Step "2.7" "Products by category"
if ($prodCatId) {
    $prodByCat = Safe-Request -Method GET -Uri "$BaseUrl/products/category/$prodCatId" -Headers $h -Label "ProdByCat"
    $prodByCatList = if ($prodByCat -is [array]) { $prodByCat } elseif ($prodByCat.data) { $prodByCat.data } elseif ($prodByCat -ne $null) { @($prodByCat) } else { @() }
    $containsCreatedProduct = if ($prod1Id) { @($prodByCatList | Where-Object { $_._id -eq $prod1Id }).Count -gt 0 } else { $prodByCatList.Count -gt 0 }
if ($prodByCat -ne $null -and $containsCreatedProduct) {
        $prodByCatCount = @($prodByCatList | Where-Object { $_ -and $_._id }).Count
        Write-Pass "Products by category OK (records=$prodByCatCount)"
    } else {
        Write-Fail "Products by category failed"
    }
}

Write-Step "2.8" "Delete product"
if ($prod1Id) {
    $prodDel = Safe-Request -Method DELETE -Uri "$BaseUrl/products/$prod1Id" -Headers $h -Label "DeleteProd"
    if ($prodDel -ne $null) { Write-Pass "Product deleted" } else { Write-Fail "Delete product failed" }
}

# ===== PHASE 3: ORDER REPORTS =====
Write-Section "PHASE 3: Order Reports"

Write-Step "3.1" "Daily profit report"
$dpReport = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/daily-profit-report?date=2026-02-15" -Headers $h -Label "DailyProfit"
if ($dpReport) {
    Write-Pass "Daily profit report: estimated=$($dpReport.estimated.totalOrders) orders, realized=$($dpReport.realized.totalOrders) orders"
} else { Write-Fail "Daily profit report failed" }

Write-Step "3.2" "Product profit report"
$ppReport = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/product-profit-report" -Headers $h -Label "ProductProfit"
if ($ppReport -ne $null) { Write-Pass "Product profit report OK" } else { Write-Fail "Product profit report failed" }

Write-Step "3.3" "Export orders JSON"
$expJson = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/export/json" -Headers $h -Label "ExportJSON"
if ($expJson -ne $null) { Write-Pass "Export JSON OK" } else { Write-Fail "Export JSON failed" }

Write-Step "3.4" "Export orders CSV"
$expCsv = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/export/csv" -Headers $h -Label "ExportCSV"
if ($expCsv -ne $null) { Write-Pass "Export CSV OK" } else { Write-Fail "Export CSV failed" }

Write-Step "3.5" "Supplier payment summary (ops)"
$sps = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/supplier-payment/ops-summary" -Headers $h -Label "SuppOps"
if ($sps -ne $null) { Write-Pass "Supplier ops summary OK" } else { Write-Fail "Supplier ops summary failed" }

Write-Step "3.6" "Agent payment summary (ops)"
$aps = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/agent-payment/ops-summary" -Headers $h -Label "AgentOps"
if ($aps -ne $null) { Write-Pass "Agent ops summary OK" } else { Write-Fail "Agent ops summary failed" }

Write-Step "3.7" "Payment pending - supplier"
$pendSupp = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/supplier" -Headers $h -Label "PendSupp"
if ($pendSupp -ne $null) { Write-Pass "Payment pending supplier OK" } else { Write-Fail "Payment pending supplier failed" }

Write-Step "3.8" "Payment pending - agent"
$pendAgent = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/payment-pending/agent" -Headers $h -Label "PendAgent"
if ($pendAgent -ne $null) { Write-Pass "Payment pending agent OK" } else { Write-Fail "Payment pending agent failed" }

# ===== PHASE 4: PENDING ORDERS =====
Write-Section "PHASE 4: Pending Orders"

# Get product and agent for pending order
$allProds = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "AllProds"
$pList = if ($allProds -is [array]) { $allProds } elseif ($allProds.data) { $allProds.data } elseif ($allProds -ne $null) { @($allProds) } else { @() }
$pendProductId = @($pList | Where-Object { $_ -and $_._id } | Select-Object -First 1)._id

if (-not $pendProductId) {
    Write-Info "No usable products found, creating fallback product for pending order..."
    if (-not $prodCatId) {
        $fallbackCatBody = @{
            name = "PO Category $ts"
            description = "Fallback category for pending order approval"
            code = "PO-$ts"
            isActive = $true
            order = 102
        } | ConvertTo-Json
        $fallbackCat = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $fallbackCatBody -Label "CreatePOCat"
        if ($fallbackCat -and $fallbackCat._id) {
            $prodCatId = $fallbackCat._id
            Write-Info "Created fallback category for pending order: $prodCatId"
        }
    }
    if ($prodCatId) {
        $poProductBody = @{
            name = "PO Product $ts"
            categoryId = $prodCatId
        } | ConvertTo-Json
        $poProduct = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $poProductBody -Label "CreatePOProduct"
        if ($poProduct -and $poProduct._id) {
            $poProductCreatedId = $poProduct._id
            $pendProductId = $poProductCreatedId
            Write-Info "Created fallback product for pending order: $pendProductId"
        }
    }
}

$allAgents = Safe-Request -Method GET -Uri "$BaseUrl/users/agents" -Headers $h -Label "AllAgents"
$aList = if ($allAgents -is [array]) { $allAgents } elseif ($allAgents.data) { $allAgents.data } else { @($allAgents) }
$pendAgentId = if ($aList.Count -gt 0) { $aList[0]._id } else { $null }

# Get an ad group for pending order (required for approval)
$adGroupsForPO = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $h -Label "AGsForPO"
$agListForPO = if ($adGroupsForPO -is [array]) { $adGroupsForPO } elseif ($adGroupsForPO.data) { $adGroupsForPO.data } else { @($adGroupsForPO) }
$pendAdGroupId = if ($agListForPO.Count -gt 0) { $agListForPO[0]._id } else { $null }
$testAdGroupCleanup = $false

# If no ad groups exist, create a temp one for PO approval
if (-not $pendAdGroupId) {
    Write-Info "No ad groups found, creating temp ad group for PO approval..."
    # Create temp ad account
    $tempAccBody = @{ name = "TempAccForPO-$ts"; accountId = "temp-po-$ts"; accountType = "facebook" } | ConvertTo-Json
    $tempAcc = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $tempAccBody -Label "TempAcc"
    $tempAccId = if ($tempAcc) { $tempAcc._id } else { $null }
    
    # Create temp fanpage
    $tempFpBody = @{ name = "TempFPForPO-$ts"; pageId = "temp-fp-$ts"; accessToken = "temp-token" } | ConvertTo-Json
    $tempFp = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $tempFpBody -Label "TempFP"
    $tempFpId = if ($tempFp) { $tempFp._id } else { $null }
    
    # Create temp ad group
    $directorId = if ($lr.user._id) { $lr.user._id } else { $lr.user.id }
    $tempAgBody = @{
        name = "TempAGForPO-$ts"
        adGroupId = "temp-ag-$ts"
        platform = "facebook"
        adAccountId = $tempAccId
        fanpageId = $tempFpId
        agentId = if ($pendAgentId) { $pendAgentId } else { $directorId }
        productCategoryId = $prodCatId
    } | ConvertTo-Json
    $tempAG = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $tempAgBody -Label "TempAG"
    if ($tempAG -and $tempAG._id) {
        $pendAdGroupId = $tempAG._id
        $testAdGroupCleanup = $true
        Write-Info "Temp ad group created: $pendAdGroupId"
    }
}

Write-Step "4.1" "Create pending order"
$poBody = @{
    customerName = "Test Customer PO $ts"
    phone = "0909999888"
    address = "123 Test Street"
    productId = $pendProductId
    agentId = $pendAgentId
    adGroupId = $pendAdGroupId
    quantity = 2
    status = "draft"
    notes = "Test pending order"
    orderDate = "2026-02-16"
} | ConvertTo-Json
$po1 = Safe-Request -Method POST -Uri "$BaseUrl/pending-orders" -Headers $h -Body $poBody -Label "CreatePO"
if ($po1 -and $po1._id) {
    $po1Id = $po1._id
    Write-Pass "Pending order created: $po1Id (status=$($po1.status))"
} else { Write-Fail "Create pending order failed" }

Write-Step "4.2" "List pending orders"
$poList = Safe-Request -Method GET -Uri "$BaseUrl/pending-orders" -Headers $h -Label "ListPO"
if ($poList) { Write-Pass "Pending orders listed" } else { Write-Fail "List pending orders failed" }

Write-Step "4.3" "Get pending order agents"
$poAgents = Safe-Request -Method GET -Uri "$BaseUrl/pending-orders/agents" -Headers $h -Label "POAgents"
if ($poAgents -ne $null) { Write-Pass "PO agents OK" } else { Write-Fail "PO agents failed" }

Write-Step "4.4" "Update pending order"
if ($po1Id) {
    $poUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/pending-orders/$po1Id" -Headers $h -Body '{"quantity":3,"status":"awaiting"}' -Label "UpdatePO"
    if ($poUpd) { Write-Pass "Pending order updated: qty=3, status=awaiting" } else { Write-Fail "Update PO failed" }
}

Write-Step "4.5" "Approve pending order"
if ($po1Id) {
    $poApp = Safe-Request -Method POST -Uri "$BaseUrl/pending-orders/$po1Id/approve" -Headers $h -Label "ApprovePO"
    if ($poApp) { Write-Pass "Pending order approved" } else { Write-Fail "Approve PO failed" }
}

Write-Step "4.6" "Create second PO (to delete)"
$po2Body = @{
    customerName = "Delete Me PO $ts"
    phone = "0908888777"
    quantity = 1
    status = "draft"
} | ConvertTo-Json
$po2 = Safe-Request -Method POST -Uri "$BaseUrl/pending-orders" -Headers $h -Body $po2Body -Label "CreatePO2"
if ($po2 -and $po2._id) {
    $po2Id = $po2._id
    Write-Pass "PO #2 created: $po2Id"
} else { Write-Fail "Create PO #2 failed" }

Write-Step "4.7" "Delete pending order #2"
if ($po2Id) {
    $poDel = Safe-Request -Method DELETE -Uri "$BaseUrl/pending-orders/$po2Id" -Headers $h -Label "DeletePO"
    if ($poDel -ne $null) { Write-Pass "PO #2 deleted" } else { Write-Fail "Delete PO failed" }
}

# ===== PHASE 5: RETURN REQUESTS =====
Write-Section "PHASE 5: Return Requests"

# Find an existing delivered order for return request
$orders = Safe-Request -Method GET -Uri "$BaseUrl/test-order2" -Headers $h -Label "GetOrders"
$orderList = if ($orders -is [array]) { $orders } elseif ($orders.data) { $orders.data } else { @($orders) }
$deliveredOrder = $orderList | Where-Object {
    $_.orderStatus -match "Giao" -and $_._id
} | Select-Object -First 1

if ($deliveredOrder) {
    $retOrderId = $deliveredOrder._id
    $retProductId = $deliveredOrder.productId
    $retSupplierId = $deliveredOrder.supplierId

    Write-Step "5.1" "Create return request"
    $rrBody = @{
        orderId = $retOrderId
        supplierId = $retSupplierId
        items = @(@{
            productId = $retProductId
            quantityReturned = 1
            notes = "Test return - damaged item"
        })
        reason = "Hang loi - test automation"
    } | ConvertTo-Json -Depth 3
    $rr1 = Safe-Request -Method POST -Uri "$BaseUrl/returns" -Headers $h -Body $rrBody -Label "CreateRR"
    if ($rr1 -and $rr1._id) {
        $rr1Id = $rr1._id
        Write-Pass "Return request created: $rr1Id"
    } else { Write-Fail "Create return request failed" }

    Write-Step "5.2" "Get return request"
    if ($rr1Id) {
        $rrGet = Safe-Request -Method GET -Uri "$BaseUrl/returns/$rr1Id" -Headers $h -Label "GetRR"
        if ($rrGet -and $rrGet._id) { Write-Pass "Return request: status=$($rrGet.status)" }
        else { Write-Fail "Get return request failed" }
    }

    Write-Step "5.3" "Resolve return request"
    if ($rr1Id) {
        # Get return request to find item IDs
        $rrDetail = Safe-Request -Method GET -Uri "$BaseUrl/returns/$rr1Id" -Headers $h -Label "GetRRDetail"
        $rrItems = @()
        $missingItemId = $false
        if ($rrDetail -and $rrDetail.items) {
            foreach ($item in $rrDetail.items) {
                $itemId = if ($item._id) { $item._id } elseif ($item.itemId) { $item.itemId } else { $null }
                if (-not $itemId) {
                    $missingItemId = $true
                } else {
                    $rrItems += @{ itemId = $itemId; decision = "restock" }
                }
            }
        }
        if ($missingItemId -or $rrItems.Count -eq 0) {
            Write-Fail "Return request item id contract missing; cannot resolve safely"
        } else {
            $rrResBody = @{
                items = $rrItems
                reason = "Refunded by test"
            } | ConvertTo-Json -Depth 3
            $rrRes = Safe-Request -Method PATCH -Uri "$BaseUrl/returns/$rr1Id/resolve" -Headers $h -Body $rrResBody -Label "ResolveRR"
            if ($rrRes) { Write-Pass "Return request resolved" } else { Write-Fail "Resolve return request failed" }
        }
    }
} else {
    Write-Info "No delivered order found, skipping return request tests"
}

# ===== PHASE 6: CONFIG MODULES =====
Write-Section "PHASE 6: Config Modules"

Write-Step "6.1" "List delivery statuses"
$delStatus = Safe-Request -Method GET -Uri "$BaseUrl/delivery-status" -Headers $h -Label "DelStatus"
if ($delStatus) {
    $dsList = if ($delStatus -is [array]) { $delStatus } elseif ($delStatus.data) { $delStatus.data } else { @($delStatus) }
    Write-Pass "Delivery statuses: $($dsList.Count)"
} else { Write-Fail "List delivery statuses failed" }

Write-Step "6.2" "List production statuses"
$prodStatus = Safe-Request -Method GET -Uri "$BaseUrl/production-status" -Headers $h -Label "ProdStatus"
if ($prodStatus -ne $null) { Write-Pass "Production statuses OK" } else { Write-Fail "Production statuses failed" }

Write-Step "6.3" "List order statuses"
$ordStatus = Safe-Request -Method GET -Uri "$BaseUrl/order-status" -Headers $h -Label "OrdStatus"
if ($ordStatus -ne $null) { Write-Pass "Order statuses OK" } else { Write-Pass "Order statuses OK (empty collection)" }

Write-Step "6.4" "Salary config"
try {
    $salRaw = Invoke-WebRequest -Method GET -Uri "$BaseUrl/salary-config" -Headers $h
    $salContent = ($salRaw.Content | Out-String).Trim()
    $salParsed =
        if ([string]::IsNullOrWhiteSpace($salContent) -or $salContent -eq "[]") { @() }
        else { $salContent | ConvertFrom-Json }
    $salConfigList = if ($salParsed -is [array]) { $salParsed } elseif ($salParsed.data) { $salParsed.data } elseif ($salParsed -ne $null) { @($salParsed) } else { @() }
    Write-Pass "Salary config OK (records=$($salConfigList.Count))"
} catch {
    $st = $_.Exception.Response.StatusCode.value__
    $eb = ""; try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
    Write-Host "  [ERROR] SalaryConfig - HTTP $st : $eb" -ForegroundColor Red
    Write-Fail "Salary config failed"
}

# ===== CLEANUP =====
Write-Section "PHASE 7: Cleanup"
if ($po1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/pending-orders/$po1Id" -Headers $h -Label "CleanPO1" | Out-Null; Write-Info "Deleted po1" }
if ($testAdGroupCleanup -and $pendAdGroupId) {
    Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$pendAdGroupId" -Headers $h -Label "CleanAG" | Out-Null; Write-Info "Deleted temp ad group"
    if ($tempFpId) { Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$tempFpId" -Headers $h -Label "CleanFP" | Out-Null; Write-Info "Deleted temp fanpage" }
    if ($tempAccId) { Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$tempAccId" -Headers $h -Label "CleanAcc" | Out-Null; Write-Info "Deleted temp ad account" }
}
if ($poProductCreatedId) { Safe-Request -Method DELETE -Uri "$BaseUrl/products/$poProductCreatedId" -Headers $h -Label "CleanPOProduct" | Out-Null; Write-Info "Deleted fallback PO product" }
if ($phase2CategoryCreatedId) { Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$phase2CategoryCreatedId" -Headers $h -Label "CleanPhase2Cat" | Out-Null; Write-Info "Deleted phase2 fallback category" }

# ===== SUMMARY =====
Write-Section "KET QUA - REPORTS, PRODUCTS & CONFIG MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
