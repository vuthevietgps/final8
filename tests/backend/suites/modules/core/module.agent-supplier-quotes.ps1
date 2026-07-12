#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.AGENT-SUPPLIER-QUOTES.PS1
    =====================================================================================
    Test agent quote and supplier quote modules:
    Phase 0: Login + setup (get supplier, agent, product)
    Phase 1: Agent Quote CRUD (create, list, get, update, filter by agent/product, stats)
    Phase 2: Supplier Quote CRUD (create, list, latest, effective, history, by-supplier)
    Phase 3: Cleanup
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
function Get-ObjectId {
    param($Value)
    if ($null -eq $Value) { return "" }
    if ($Value._id) { return $Value._id }
    if ($Value.id) { return $Value.id }
    return ""
}
function Get-Items {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value.data) { return @($Value.data) }
    if ($Value -is [array]) { return @($Value) }
    return @($Value)
}
function Find-FirstByPrefix {
    param([object[]]$Items, [string]$Prefix)
    return ($Items | Where-Object { $_.name -like "$Prefix*" } | Select-Object -First 1)
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$createdCategoryId = ""
$createdProductId = ""
$categoryPrefix = "Test Cat Quotes"
$productPrefix = "Test Product Quotes"

Write-Section "MODULE TEST: QUOTES - $ts"

# ===== PHASE 0: LOGIN & SETUP =====
Write-Section "PHASE 0: Login & Setup"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
} else { Write-Fail "Login failed"; exit 1 }

# Get supplier, agent, product
Write-Step "0.2" "Get supplier, agent, product data"
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "GetUsers"
$supplier = $null; $agent = $null
if ($users) {
    $userList = Get-Items $users
    $supplier = $userList | Where-Object { $_.email -eq "internal-supplier@test.com" } | Select-Object -First 1
    $agent = $userList | Where-Object { $_.email -eq "external-agent@test.com" } | Select-Object -First 1
    foreach ($u in $userList) {
        if ($u.role -match "supplier" -and -not $supplier) { $supplier = $u }
        if ($u.role -match "agent" -and -not $agent) { $agent = $u }
    }
}
if (-not $supplier) {
    $supBody = (@{
        email = "test-supplier-quotes-$ts@test.com"
        password = "123456"
        fullName = "NCC Test Quotes $ts"
        role = "internal_supplier"
        phone = "0999000101"
        isActive = $true
    } | ConvertTo-Json)
    $supplier = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $supBody -Label "CreateSupplier"
    if (-not $supplier) {
        $users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "RefreshUsersAfterSupplierCreate"
        if ($users) {
            $userList = Get-Items $users
            $supplier = $userList | Where-Object { $_.email -eq "internal-supplier@test.com" } | Select-Object -First 1
        }
    }
}
if (-not $agent) {
    $agBody = (@{
        email = "test-agent-quotes-$ts@test.com"
        password = "123456"
        fullName = "Agent Test Quotes $ts"
        role = "external_agent"
        phone = "0999000102"
        isActive = $true
    } | ConvertTo-Json)
    $agent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $agBody -Label "CreateAgent"
    if (-not $agent) {
        $users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "RefreshUsersAfterAgentCreate"
        if ($users) {
            $userList = Get-Items $users
            $agent = $userList | Where-Object { $_.email -eq "external-agent@test.com" } | Select-Object -First 1
        }
    }
}
$supplierId = if ($supplier._id) { $supplier._id } elseif ($supplier.id) { $supplier.id } else { "" }
$agentId = if ($agent._id) { $agent._id } elseif ($agent.id) { $agent.id } else { "" }

# Get or create a product
$products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "GetProducts"
$productList = Get-Items $products
$product = Find-FirstByPrefix -Items $productList -Prefix $productPrefix

if (-not $product) {
    Write-Info "No product found, creating..."
    $categories = Safe-Request -Method GET -Uri "$BaseUrl/product-category" -Headers $h -Label "GetCategories"
    $categoryList = Get-Items $categories
    $category = Find-FirstByPrefix -Items $categoryList -Prefix $categoryPrefix
    if (-not $category) {
        $catBody = (@{
            name = "$categoryPrefix $ts"
            description = "Category for quotes module test"
            isActive = $true
        } | ConvertTo-Json)
        $category = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $catBody -Label "CreateCat"
        if (-not $category) {
            $categories = Safe-Request -Method GET -Uri "$BaseUrl/product-category" -Headers $h -Label "RefreshCategories"
            $categoryList = Get-Items $categories
            $category = Find-FirstByPrefix -Items $categoryList -Prefix $categoryPrefix
        } else {
            $createdCategoryId = Get-ObjectId $category
        }
    }
    $catId = Get-ObjectId $category
    if ($catId) {
        $product = Find-FirstByPrefix -Items $productList -Prefix $productPrefix
        if (-not $product) {
            $prodBody = (@{ name = "$productPrefix $ts"; categoryId = $catId } | ConvertTo-Json)
            $product = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $prodBody -Label "CreateProd"
            if (-not $product) {
                $products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "RefreshProducts"
                $productList = Get-Items $products
                $product = Find-FirstByPrefix -Items $productList -Prefix $productPrefix
            } else {
                $createdProductId = Get-ObjectId $product
            }
        }
    }
}
$productId = if ($product._id) { $product._id } elseif ($product.id) { $product.id } else { "" }
Write-Info "Supplier: $supplierId | Agent: $agentId | Product: $productId"
if ($supplierId -and $agentId -and $productId) { Write-Pass "Setup complete" } else { Write-Fail "Setup incomplete" }

# ===== PHASE 1: AGENT QUOTES =====
Write-Section "PHASE 1: Agent Quotes (quotes)"

Write-Step "1.1" "Create quote"
$qBody = '{"productId":"' + $productId + '","agentId":"' + $agentId + '","unitPrice":150000,"status":"pending","validFrom":"2026-02-01","validUntil":"2026-03-31","notes":"Test quote from module test"}'
$q1 = Safe-Request -Method POST -Uri "$BaseUrl/quotes" -Headers $h -Body $qBody -Label "CreateQuote"
$q1Id = if ($q1._id) { $q1._id } elseif ($q1.id) { $q1.id } else { "" }
if ($q1Id) { Write-Pass "Created quote: $q1Id, price=$($q1.unitPrice)" } else { Write-Fail "Create quote failed" }

Write-Step "1.2" "Create second quote (different price)"
$q2Body = '{"productId":"' + $productId + '","agentId":"' + $agentId + '","unitPrice":180000,"status":"pending","validFrom":"2026-04-01","validUntil":"2026-06-30","notes":"Second test quote"}'
$q2 = Safe-Request -Method POST -Uri "$BaseUrl/quotes" -Headers $h -Body $q2Body -Label "CreateQuote2"
$q2Id = if ($q2._id) { $q2._id } elseif ($q2.id) { $q2.id } else { "" }
if ($q2Id) { Write-Pass "Created second quote: $q2Id" } else { Write-Fail "Create second quote failed" }

Write-Step "1.3" "List all quotes"
$qList = Safe-Request -Method GET -Uri "$BaseUrl/quotes" -Headers $h -Label "ListQuotes"
if ($qList -ne $null) {
    $count = if ($qList -is [array]) { $qList.Count } elseif ($qList.data) { $qList.data.Count } else { 1 }
    Write-Pass "List quotes: $count items"
} else { Write-Fail "List quotes failed" }

Write-Step "1.4" "Get quote by ID"
if ($q1Id) {
    $qGet = Safe-Request -Method GET -Uri "$BaseUrl/quotes/$q1Id" -Headers $h -Label "GetQuote"
    if ($qGet) { Write-Pass "Get quote: price=$($qGet.unitPrice), status=$($qGet.status)" } else { Write-Fail "Get quote failed" }
} else { Write-Fail "Skip" }

Write-Step "1.5" "Update quote (approve)"
if ($q1Id) {
    $qUpBody = '{"status":"approved","unitPrice":155000}'
    $qUp = Safe-Request -Method PATCH -Uri "$BaseUrl/quotes/$q1Id" -Headers $h -Body $qUpBody -Label "UpdateQuote"
    if ($qUp) { Write-Pass "Quote updated: status=$($qUp.status), price=$($qUp.unitPrice)" } else { Write-Fail "Update quote failed" }
} else { Write-Fail "Skip" }

Write-Step "1.6" "Get quotes by agent"
$qByAgent = Safe-Request -Method GET -Uri "$BaseUrl/quotes/agent/$agentId" -Headers $h -Label "QuotesByAgent"
if ($qByAgent -ne $null) {
    $count = if ($qByAgent -is [array]) { $qByAgent.Count } elseif ($qByAgent.data) { $qByAgent.data.Count } else { 1 }
    Write-Pass "Quotes by agent: $count items"
} else { Write-Fail "Quotes by agent failed" }

Write-Step "1.7" "Get quotes by product"
$qByProd = Safe-Request -Method GET -Uri "$BaseUrl/quotes/product/$productId" -Headers $h -Label "QuotesByProduct"
if ($qByProd -ne $null) {
    $count = if ($qByProd -is [array]) { $qByProd.Count } elseif ($qByProd.data) { $qByProd.data.Count } else { 1 }
    Write-Pass "Quotes by product: $count items"
} else { Write-Fail "Quotes by product failed" }

Write-Step "1.8" "Get quote stats"
$qStats = Safe-Request -Method GET -Uri "$BaseUrl/quotes/stats/summary" -Headers $h -Label "QuoteStats"
if ($qStats -ne $null) { Write-Pass "Quote stats OK" } else { Write-Fail "Quote stats failed" }

# ===== PHASE 2: SUPPLIER QUOTES =====
Write-Section "PHASE 2: Supplier Quotes"

Write-Step "2.1" "Create supplier quote"
$sqBody = @{
    productId = $productId
    supplierId = $supplierId
    price = 95000
    currency = "VND"
    effectiveAt = "2026-02-01T00:00:00.000Z"
    note = "Test supplier quote"
    shippingFee = 15000
    returnFee = 10000
} | ConvertTo-Json
$sq1 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $h -Body $sqBody -Label "CreateSQ"
$sq1Id = if ($sq1._id) { $sq1._id } elseif ($sq1.id) { $sq1.id } else { "" }
if ($sq1Id) { Write-Pass "Created supplier quote: $sq1Id, price=$($sq1.price)" } else { Write-Fail "Create supplier quote failed" }

Write-Step "2.2" "Create second supplier quote (newer price)"
$sq2Body = @{
    productId = $productId
    supplierId = $supplierId
    price = 92000
    effectiveAt = "2026-02-15T00:00:00.000Z"
    note = "Updated price"
} | ConvertTo-Json
$sq2 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-quotes" -Headers $h -Body $sq2Body -Label "CreateSQ2"
$sq2Id = if ($sq2._id) { $sq2._id } elseif ($sq2.id) { $sq2.id } else { "" }
if ($sq2Id) { Write-Pass "Created second supplier quote: $sq2Id" } else { Write-Fail "Create second SQ failed" }

Write-Step "2.3" "List all supplier quotes"
$sqList = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes" -Headers $h -Label "ListSQ"
if ($sqList -ne $null) {
    $count = if ($sqList -is [array]) { $sqList.Count } elseif ($sqList.data) { $sqList.data.Count } elseif ($sqList.pagination) { $sqList.pagination.total } else { 1 }
    Write-Pass "List supplier quotes: $count items"
} else { Write-Fail "List supplier quotes failed" }

Write-Step "2.4" "Get latest supplier quote"
$sqLatest = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes/latest?productId=$productId&supplierId=$supplierId" -Headers $h -Label "LatestSQ"
if ($sqLatest -ne $null) { Write-Pass "Latest supplier quote: price=$($sqLatest.price)" } else { Write-Fail "Latest supplier quote failed" }

Write-Step "2.5" "Get effective supplier quote"
$sqEff = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes/effective?productId=$productId&supplierId=$supplierId" -Headers $h -Label "EffectiveSQ"
if ($sqEff -ne $null) { Write-Pass "Effective supplier quote OK" } else { Write-Fail "Effective supplier quote failed" }

Write-Step "2.6" "Get price history"
$sqHist = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes/history/$productId/$supplierId" -Headers $h -Label "HistorySQ"
if ($sqHist -ne $null) {
    $count = if ($sqHist -is [array]) { $sqHist.Count } elseif ($sqHist.history) { $sqHist.history.Count } else { 1 }
    Write-Pass "Price history: $count entries"
} else { Write-Fail "Price history failed" }

Write-Step "2.7" "Get quotes by supplier"
$sqBySup = Safe-Request -Method GET -Uri "$BaseUrl/supplier-quotes/by-supplier/$supplierId" -Headers $h -Label "SQBySupplier"
if ($sqBySup -ne $null) {
    $count = if ($sqBySup -is [array]) { $sqBySup.Count } elseif ($sqBySup.data) { $sqBySup.data.Count } else { 1 }
    Write-Pass "Quotes by supplier: $count items"
} else { Write-Fail "Quotes by supplier failed" }

# ===== PHASE 3: CLEANUP =====
Write-Section "PHASE 3: Cleanup"

Write-Step "3.1" "Delete quotes"
if ($q1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/quotes/$q1Id" -Headers $h -Label "DelQ1" }
if ($q2Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/quotes/$q2Id" -Headers $h -Label "DelQ2" }
Write-Pass "Quotes cleaned up"

if ($createdProductId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductId" -Headers $h -Label "DeleteCreatedProduct")
    Write-Info "Deleted created product"
}
if ($createdCategoryId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdCategoryId" -Headers $h -Label "DeleteCreatedCategory")
    Write-Info "Deleted created category"
}

# ===== SUMMARY =====
Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })
if ($script:failCount -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
exit $script:failCount
