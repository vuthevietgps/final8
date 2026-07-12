#!/usr/bin/env powershell
<#
  Deep integration test for ads budget suggestions:
  1) ad-group-daily-report sync must carry advertisingCost from orders
  2) legacy mode must use actual net profit
  3) product-x mode must use assumed return rate from product and can diverge from legacy
#>

$ErrorActionPreference = "Continue"
function Get-BackendBaseUrl {
  $baseUrl = $env:BACKEND_BASE_URL
  if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
    return $baseUrl.TrimEnd('/')
  }
  return "http://localhost:3000/api"
}

$BaseUrl = Get-BackendBaseUrl

function Write-Section($title) {
  Write-Host ""
  Write-Host ("=" * 95) -ForegroundColor Cyan
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host ("=" * 95) -ForegroundColor Cyan
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

function N0($v) {
  if ($null -eq $v) { return 0 }
  try { return [double]$v } catch { return 0 }
}

function Safe-Request {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers = @{},
    [string]$Body = $null,
    [string]$Label = ""
  )
  try {
    $params = @{
      Method      = $Method
      Uri         = $Uri
      Headers     = $Headers
      ContentType = "application/json; charset=utf-8"
    }
    if ($Body -and $Method -ne "GET") {
      $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
    }
    return (Invoke-RestMethod @params)
  } catch {
    $status = $null
    $errBody = ""
    try {
      $status = $_.Exception.Response.StatusCode.value__
      $errBody = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
    } catch { }
    Write-Host "  [ERROR] $Label - HTTP $status : $errBody" -ForegroundColor Red
    return $null
  }
}

function Get-ServiceDateStringDaysAgo {
  param([int]$DaysAgo)
  $businessNow = (Get-Date).ToUniversalTime().AddHours(7)
  return $businessNow.AddDays(-$DaysAgo).ToString("yyyy-MM-dd")
}

function Assert-Approx {
  param(
    [double]$Actual,
    [double]$Expected,
    [double]$Tolerance = 2,
    [string]$Label = ""
  )
  $diff = [Math]::Abs($Actual - $Expected)
  if ($diff -le $Tolerance) {
    Write-Pass "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
    return $true
  } else {
    Write-Fail "$Label (actual=$Actual, expected=$Expected, diff=$diff EXCEEDS tolerance=$Tolerance)"
    return $false
  }
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$productXPercent = 60
$supplierCost = 200000
$shippingFee = 50000

$history = @(
  [pscustomobject]@{ Label = "D1"; Date = (Get-Date).AddDays(-3); Spend = 100000; Cod = 500000; ExpectedLegacyNet = 150000; ExpectedProductXNet = -30000 },
  [pscustomobject]@{ Label = "D2"; Date = (Get-Date).AddDays(-2); Spend = 120000; Cod = 650000; ExpectedLegacyNet = 280000; ExpectedProductXNet = 10000 },
  [pscustomobject]@{ Label = "D3"; Date = (Get-Date).AddDays(-1); Spend = 140000; Cod = 700000; ExpectedLegacyNet = 310000; ExpectedProductXNet = 10000 }
)

foreach ($item in $history) {
  $item | Add-Member -NotePropertyName DateStr -NotePropertyValue ($item.Date.ToString("yyyy-MM-dd"))
  $item | Add-Member -NotePropertyName Iso -NotePropertyValue ("$($item.Date.ToString('yyyy-MM-dd'))" + "T00:00:00.000Z")
}

$expectedTotalAdsCost = ($history | Measure-Object -Property Spend -Sum).Sum
$expectedLegacyTotalNet = ($history | Measure-Object -Property ExpectedLegacyNet -Sum).Sum
$expectedProductXReturnedOrders = ($history.Count * $productXPercent) / 100

$createdCategoryId = $null
$createdProductId = $null
$createdFanpageId = $null
$createdAdAccountId = $null
$createdAdGroupObjId = $null
$createdAdGroupId = "AG-X-LEGACY-$ts"
$createdOrderIds = @()
$createdAdCostIds = @()
$h = @{}
$currentUserId = $null
$deliveredStatus = $null
$serviceYesterdayDateStr = Get-ServiceDateStringDaysAgo -DaysAgo 1
$serviceYesterdayItem = $null

Write-Section "DEEP TEST: ADS BUDGET PRODUCT-X VS LEGACY - $ts"
Write-Info "History dates: $($history[0].DateStr), $($history[1].DateStr), $($history[2].DateStr)"

try {
  Write-Section "PHASE 0: Login"
  Write-Step "0.1" "Login Director"
  $lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
  if ($lr -and $lr.access_token) {
    $h = @{ Authorization = "Bearer $($lr.access_token)" }
    $currentUserId = [string]$lr.user.id
    Write-Pass "Login OK"
  } else {
    Write-Fail "Login failed"
    throw "Login failed"
  }

  Write-Step "0.2" "Resolve canonical delivered status from API"
  $paymentStatuses = @(Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/payment-trigger" -Headers $h -Label "PaymentTriggerStatuses")
  $delivered = $paymentStatuses | Where-Object { $_ -and $_.isReturnStatus -ne $true } | Select-Object -First 1
  if ($delivered -and $delivered.name) {
    $deliveredStatus = [string]$delivered.name
    Write-Pass "Resolved delivered status: $deliveredStatus"
  } else {
    Write-Fail "Cannot resolve canonical delivered status"
    throw "No delivered status"
  }

  $serviceYesterdayItem = @($history | Where-Object { $_.DateStr -eq $serviceYesterdayDateStr } | Select-Object -First 1)[0]
  if (-not $serviceYesterdayItem) {
    Write-Fail "History does not contain service yesterday date: $serviceYesterdayDateStr"
    throw "Service yesterday not covered by test history"
  }
  Write-Pass "Service yesterday date resolved to: $($serviceYesterdayItem.DateStr)"

  Write-Section "PHASE 1: Setup ads entities"

  Write-Step "1.1" "Create product category"
  $categoryBody = @{
    name = "Category X Legacy $ts"
    description = "Deep integration test for ads budget"
    color = "#146C94"
    isActive = $true
  } | ConvertTo-Json
  $category = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $categoryBody -Label "CreateCategory"
  if ($category -and $category._id) {
    $createdCategoryId = [string]$category._id
    Write-Pass "Product category created: $createdCategoryId"
  } else {
    Write-Fail "Create product category failed"
    throw "No category"
  }

  Write-Step "1.2" "Create product with assumedReturnRatePercent = $productXPercent"
  $productBody = @{
    name = "Product X Legacy $ts"
    categoryId = $createdCategoryId
    assumedReturnRatePercent = $productXPercent
    importPrice = 0
    shippingCost = 0
    packagingCost = 0
  } | ConvertTo-Json
  $product = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $productBody -Label "CreateProduct"
  if ($product -and $product._id) {
    $createdProductId = [string]$product._id
    Write-Pass "Product created: $createdProductId"
    Assert-Approx -Actual (N0 $product.assumedReturnRatePercent) -Expected $productXPercent -Tolerance 0.01 -Label "Product assumedReturnRatePercent"
  } else {
    Write-Fail "Create product failed"
    throw "No product"
  }

  Write-Step "1.3" "Create fanpage"
  $fanpageBody = @{
    name = "FP X Legacy $ts"
    pageId = "fp_x_legacy_$ts"
    accessToken = "token_$ts"
    status = "active"
  } | ConvertTo-Json
  $fanpage = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $fanpageBody -Label "CreateFanpage"
  if ($fanpage -and $fanpage._id) {
    $createdFanpageId = [string]$fanpage._id
    Write-Pass "Fanpage created: $createdFanpageId"
  } else {
    Write-Fail "Create fanpage failed"
    throw "No fanpage"
  }

  Write-Step "1.4" "Create ad account"
  $adAccountBody = @{
    name = "ACC X Legacy $ts"
    accountId = "acc_x_legacy_$ts"
    accountType = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $adAccount = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $adAccountBody -Label "CreateAdAccount"
  if ($adAccount -and $adAccount._id) {
    $createdAdAccountId = [string]$adAccount._id
    Write-Pass "Ad account created: $createdAdAccountId"
  } else {
    Write-Fail "Create ad account failed"
    throw "No ad account"
  }

  Write-Step "1.5" "Create ad group bound to exactly one product"
  $adGroupBody = @{
    name = "AG X Legacy $ts"
    adGroupId = $createdAdGroupId
    fanpageId = $createdFanpageId
    productCategoryId = $createdCategoryId
    selectedProducts = @($createdProductId)
    agentId = $currentUserId
    adAccountId = $createdAdAccountId
    platform = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $adGroup = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $adGroupBody -Label "CreateAdGroup"
  if ($adGroup -and $adGroup._id) {
    $createdAdGroupObjId = [string]$adGroup._id
    Write-Pass "Ad group created: $createdAdGroupId"
  } else {
    Write-Fail "Create ad group failed"
    throw "No ad group"
  }

  Write-Section "PHASE 2: Build 3-day spend/profit history"

  $stepIndex = 1
  foreach ($item in $history) {
    Write-Step "2.$stepIndex" "Create ad cost + delivered order for $($item.DateStr)"

    $adCostBody = @{
      adGroupId = $createdAdGroupId
      date = $item.Iso
      spentAmount = $item.Spend
      channel = "facebook"
    } | ConvertTo-Json
    $adCost = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $adCostBody -Label "CreateAdCost-$($item.Label)"
    if ($adCost -and $adCost._id) {
      $createdAdCostIds += [string]$adCost._id
      Write-Pass "Ad cost created for $($item.Label): $($item.Spend)"
    } else {
      Write-Fail "Create ad cost failed for $($item.Label)"
      throw "No ad cost for $($item.Label)"
    }

    $orderBody = @{
      customerName = "Customer $($item.Label) $ts"
      quantity = 1
      productId = $createdProductId
      adGroupId = $createdAdGroupId
      orderDate = $item.Iso
      codAmount = $item.Cod
      supplierAppliedPrice = $supplierCost
      supplierQuote = $supplierCost
      shippingFee = $shippingFee
      orderStatus = "Chua co ma van don"
    } | ConvertTo-Json
    $order = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $orderBody -Label "CreateOrder-$($item.Label)"
    if ($order -and $order._id) {
      $createdOrderIds += [string]$order._id
      Write-Pass "Order created for $($item.Label): $($order._id)"
    } else {
      Write-Fail "Create order failed for $($item.Label)"
      throw "No order for $($item.Label)"
    }

    $orderId = [string]$order._id
    $deliverBody = @{ orderStatus = $deliveredStatus } | ConvertTo-Json -Compress
    [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$orderId" -Headers $h -Body $deliverBody -Label "Deliver-$($item.Label)")
    [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$orderId/recalculate-profits" -Headers $h -Body "{}" -Label "Recalc-$($item.Label)")
    Start-Sleep -Milliseconds 400

    $savedOrder = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$orderId" -Headers $h -Label "GetOrder-$($item.Label)"
    if ($savedOrder) {
      Assert-Approx -Actual (N0 $savedOrder.advertisingCost) -Expected $item.Spend -Tolerance 2 -Label "$($item.Label) order advertisingCost"
      Assert-Approx -Actual (N0 $savedOrder.netProfit) -Expected $item.ExpectedLegacyNet -Tolerance 2 -Label "$($item.Label) order legacy netProfit"
    } else {
      Write-Fail "Cannot reload order for $($item.Label)"
    }

    $sync = Safe-Request -Method POST -Uri "$BaseUrl/ad-group-daily-report/sync?date=$($item.DateStr)" -Headers $h -Body "{}" -Label "Sync-$($item.Label)"
    if ($sync -and $sync.success) {
      Write-Pass "Synced ad-group daily report for $($item.DateStr)"
    } else {
      Write-Fail "Sync daily report failed for $($item.DateStr)"
      throw "Sync failed for $($item.DateStr)"
    }

    $stepIndex++
  }

  Write-Section "PHASE 3: Validate synced report uses advertisingCost"

  $reportUrl = "$BaseUrl/ad-group-daily-report?fromDate=$($history[0].DateStr)&toDate=$($history[2].DateStr)&adGroupId=$createdAdGroupId"
  $report = Safe-Request -Method GET -Uri $reportUrl -Headers $h -Label "DailyReportWithSuggestions"
  if ($report -and $report.summary) {
    Assert-Approx -Actual (N0 $report.summary.totalAdsCost) -Expected $expectedTotalAdsCost -Tolerance 2 -Label "Report summary totalAdsCost"
    Assert-Approx -Actual (N0 $report.summary.totalNetProfit) -Expected $expectedLegacyTotalNet -Tolerance 2 -Label "Report summary totalNetProfit"

    $details = if ($report.details) { @($report.details) } else { @() }
    $yesterdayRow = $details | Where-Object { $_.date -eq $serviceYesterdayItem.DateStr } | Select-Object -First 1
    if ($yesterdayRow) {
      Assert-Approx -Actual (N0 $yesterdayRow.adsCost) -Expected $serviceYesterdayItem.Spend -Tolerance 2 -Label "Yesterday synced adsCost"
      Assert-Approx -Actual (N0 $yesterdayRow.netProfit) -Expected $serviceYesterdayItem.ExpectedLegacyNet -Tolerance 2 -Label "Yesterday synced netProfit"
    } else {
      Write-Fail "Cannot find yesterday row in ad-group daily report"
    }
  } else {
    Write-Fail "Daily report query failed"
    throw "No daily report"
  }

  Write-Section "PHASE 4: Compare optimal-spend legacy vs product-x"

  $legacy = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=legacy" -Headers $h -Label "OptimalLegacy"
  $productX = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=product-x&defaultX=15" -Headers $h -Label "OptimalProductX"

  $legacyRow = @($legacy.adGroupSuggestions) | Where-Object { $_.adGroupId -eq $createdAdGroupId } | Select-Object -First 1
  $productXRow = @($productX.adGroupSuggestions) | Where-Object { $_.adGroupId -eq $createdAdGroupId } | Select-Object -First 1

  if (-not $legacyRow) {
    Write-Fail "Legacy optimal-spend missing test ad group"
    throw "No legacy row"
  }
  if (-not $productXRow) {
    Write-Fail "Product-x optimal-spend missing test ad group"
    throw "No product-x row"
  }

  Assert-Approx -Actual (N0 $legacyRow.spendYesterday) -Expected $serviceYesterdayItem.Spend -Tolerance 2 -Label "Legacy spendYesterday"
  Assert-Approx -Actual (N0 $legacyRow.profitYesterday) -Expected $serviceYesterdayItem.ExpectedLegacyNet -Tolerance 2 -Label "Legacy profitYesterday"
  Assert-Approx -Actual (N0 $legacyRow.currentAvgSpend) -Expected 120000 -Tolerance 2 -Label "Legacy currentAvgSpend"
  Assert-Approx -Actual (N0 $legacyRow.suggestedSpendWithCap) -Expected 144000 -Tolerance 2 -Label "Legacy suggestedSpendWithCap"

  Assert-Approx -Actual (N0 $productXRow.spendYesterday) -Expected $serviceYesterdayItem.Spend -Tolerance 2 -Label "Product-x spendYesterday"
  Assert-Approx -Actual (N0 $productXRow.profitYesterday) -Expected $serviceYesterdayItem.ExpectedProductXNet -Tolerance 2 -Label "Product-x profitYesterday"
  Assert-Approx -Actual (N0 $productXRow.assumedReturnRatePercent) -Expected $productXPercent -Tolerance 0.01 -Label "Product-x assumedReturnRatePercent"
  Assert-Approx -Actual (N0 $productXRow.expectedReturnedOrders) -Expected $expectedProductXReturnedOrders -Tolerance 0.05 -Label "Product-x expectedReturnedOrders"
  Assert-Approx -Actual (N0 $productXRow.suggestedSpendWithCap) -Expected 108000 -Tolerance 2 -Label "Product-x suggestedSpendWithCap"

  if ($productXRow.assumptionSource -eq "product") {
    Write-Pass "Product-x assumptionSource=product"
  } else {
    Write-Fail "Expected assumptionSource=product, got: $($productXRow.assumptionSource)"
  }

  if ((N0 $productXRow.suggestedSpendWithCap) -lt (N0 $legacyRow.suggestedSpendWithCap)) {
    Write-Pass "Product-x recommends lower budget than legacy on the same history"
  } else {
    Write-Fail "Product-x should recommend lower budget than legacy for this scenario"
  }

  if ((N0 $productXRow.profitYesterday) -lt (N0 $legacyRow.profitYesterday)) {
    Write-Pass "Product-x profitYesterday is lower than legacy as expected"
  } else {
    Write-Fail "Product-x profitYesterday should be lower than legacy"
  }

} catch {
  Write-Fail "Exception in test: $_"
}

Write-Section "PHASE 5: Cleanup"

foreach ($orderId in $createdOrderIds) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$orderId" -Headers $h -Label "DeleteOrder-$orderId")
  Write-Info "Deleted order: $orderId"
}

foreach ($adCostId in $createdAdCostIds) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$adCostId" -Headers $h -Label "DeleteAdCost-$adCostId")
  Write-Info "Deleted ad cost: $adCostId"
}

if ($createdAdGroupObjId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$createdAdGroupObjId" -Headers $h -Label "DeleteAdGroup"); Write-Info "Deleted ad group" }
if ($createdAdAccountId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$createdAdAccountId" -Headers $h -Label "DeleteAdAccount"); Write-Info "Deleted ad account" }
if ($createdProductId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductId" -Headers $h -Label "DeleteProduct"); Write-Info "Deleted product" }
if ($createdCategoryId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdCategoryId" -Headers $h -Label "DeleteCategory"); Write-Info "Deleted product category" }
if ($createdFanpageId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$createdFanpageId" -Headers $h -Label "DeleteFanpage"); Write-Info "Deleted fanpage" }

Write-Section "FINAL SUMMARY"
Write-Host ""
Write-Host "  PASS : $($script:passCount)" -ForegroundColor Green
Write-Host "  FAIL : $($script:failCount)" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($script:failDetails.Count -gt 0) {
  Write-Host "  Failures:" -ForegroundColor Red
  foreach ($fd in $script:failDetails) {
    Write-Host "    - $fd" -ForegroundColor Red
  }
  Write-Host ""
}

if ($script:failCount -eq 0) {
  Write-Host "  ALL PASSED - product-x vs legacy suggestions and sync logic look healthy." -ForegroundColor Green
} else {
  Write-Host "  TEST FAILED - review failures above." -ForegroundColor Red
}
Write-Host ""
