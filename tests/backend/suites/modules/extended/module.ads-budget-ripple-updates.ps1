#!/usr/bin/env powershell
<#
  Ripple integration test for ads budget suggestions.
  Covers:
  1) advertisingCost update -> order allocations update immediately, suggestions update after daily sync
  2) product assumedReturnRatePercent update -> product-x updates immediately, legacy stays unchanged
  3) order status update -> legacy changes after sync, product-x is status-agnostic
  4) COD update -> product-x updates immediately from order data, legacy updates after sync
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

function Assert-Equal {
  param(
    $Actual,
    $Expected,
    [string]$Label = ""
  )
  if ([string]$Actual -eq [string]$Expected) {
    Write-Pass "$Label (actual=$Actual)"
    return $true
  } else {
    Write-Fail "$Label (actual=$Actual, expected=$Expected)"
    return $false
  }
}

function Get-LegacyGross {
  param(
    [double]$Cod,
    [string]$StatusKind
  )
  if ($StatusKind -eq "returned") {
    return -($script:shippingFee + $script:returnFee)
  }
  if ($StatusKind -eq "delivered") {
    return $Cod - $script:supplierCost - $script:shippingFee - $script:returnFee
  }
  return 0
}

function Get-LegacyNet {
  param([object]$Item)
  return (Get-LegacyGross -Cod (N0 $Item.Cod) -StatusKind $Item.StatusKind) - (N0 $Item.Spend)
}

function Get-ProductXGross {
  param(
    [double]$Cod,
    [double]$XPercent
  )
  $xRate = $XPercent / 100
  $expectedRevenue = $Cod * (1 - $xRate)
  $expectedSupplierCost = $script:supplierCost * (1 - $xRate)
  $expectedReturnFee = $script:returnFee * $xRate
  return $expectedRevenue - $expectedSupplierCost - $script:shippingFee - $expectedReturnFee
}

function Get-ProductXNet {
  param(
    [object]$Item,
    [double]$XPercent
  )
  return (Get-ProductXGross -Cod (N0 $Item.Cod) -XPercent $XPercent) - (N0 $Item.Spend)
}

function Get-RecordsForLegacy {
  param([array]$History)
  $records = @()
  foreach ($item in $History) {
    $records += [pscustomobject]@{
      Date = $item.DateStr
      Spend = N0 $item.Spend
      Profit = Get-LegacyNet -Item $item
    }
  }
  return $records
}

function Get-RecordsForProductX {
  param(
    [array]$History,
    [double]$XPercent
  )
  $records = @()
  foreach ($item in $History) {
    $records += [pscustomobject]@{
      Date = $item.DateStr
      Spend = N0 $item.Spend
      Profit = Get-ProductXNet -Item $item -XPercent $XPercent
    }
  }
  return $records
}

function Get-SuggestionExpectation {
  param([array]$Records)

  $dayCount = @($Records).Count
  $totalSpend = 0
  foreach ($record in $Records) {
    $totalSpend += N0 $record.Spend
  }
  $currentAvgSpend = if ($dayCount -gt 0) { $totalSpend / $dayCount } else { 0 }

  $sortedByDateDesc = @($Records | Sort-Object Date -Descending)
  $yesterdayRecord = @($Records | Where-Object { $_.Date -eq $script:serviceYesterdayDateStr } | Select-Object -First 1)[0]
  if (-not $yesterdayRecord) {
    $yesterdayRecord = if ($sortedByDateDesc.Count -gt 0) { $sortedByDateDesc[0] } else { $null }
  }
  $spendYesterday = if ($yesterdayRecord) { N0 $yesterdayRecord.Spend } else { 0 }
  $profitYesterday = if ($yesterdayRecord) { N0 $yesterdayRecord.Profit } else { 0 }

  $last3 = @($sortedByDateDesc | Select-Object -First 3)
  $avgLast3Days = 0
  if ($last3.Count -gt 0) {
    $sumLast3 = 0
    foreach ($record in $last3) {
      $sumLast3 += N0 $record.Spend
    }
    $avgLast3Days = $sumLast3 / $last3.Count
  }

  $baselineSpend = [Math]::Max([double]$spendYesterday, [double]([Math]::Max([double]$avgLast3Days, 60000)))

  $consecutiveNegativeDays = 0
  foreach ($record in $sortedByDateDesc) {
    if ((N0 $record.Profit) -lt 0) {
      $consecutiveNegativeDays++
    } else {
      break
    }
  }

  $suggestedSpend = [Math]::Round($currentAvgSpend)
  $suggestedSpendWithCap = $suggestedSpend
  $avgMarginalProfit = 0
  $lastMarginalProfit = 0

  if ($dayCount -lt 3) {
    return [pscustomobject]@{
      spendYesterday = [Math]::Round($spendYesterday)
      profitYesterday = [Math]::Round($profitYesterday)
      currentAvgSpend = [Math]::Round($currentAvgSpend)
      baselineSpend = [Math]::Round($baselineSpend)
      suggestedSpendWithCap = [Math]::Round($suggestedSpendWithCap)
      consecutiveNegativeDays = $consecutiveNegativeDays
      avgMarginalProfit = 0
      lastMarginalProfit = 0
    }
  }

  $sortedBySpend = @($Records | Sort-Object Spend, Date)
  $marginals = @()
  for ($i = 1; $i -lt $sortedBySpend.Count; $i++) {
    $prev = $sortedBySpend[$i - 1]
    $curr = $sortedBySpend[$i]
    $deltaSpend = (N0 $curr.Spend) - (N0 $prev.Spend)
    $deltaProfit = (N0 $curr.Profit) - (N0 $prev.Profit)
    if ($deltaSpend -gt 0) {
      $marginals += ($deltaProfit / $deltaSpend)
    }
  }

  if ($marginals.Count -eq 0) {
    return [pscustomobject]@{
      spendYesterday = [Math]::Round($spendYesterday)
      profitYesterday = [Math]::Round($profitYesterday)
      currentAvgSpend = [Math]::Round($currentAvgSpend)
      baselineSpend = [Math]::Round($baselineSpend)
      suggestedSpendWithCap = [Math]::Round($suggestedSpendWithCap)
      consecutiveNegativeDays = $consecutiveNegativeDays
      avgMarginalProfit = 0
      lastMarginalProfit = 0
    }
  }

  $sumMarginals = 0
  foreach ($value in $marginals) {
    $sumMarginals += [double]$value
  }
  $avgMarginalProfit = $sumMarginals / $marginals.Count
  $lastMarginalProfit = [double]$marginals[$marginals.Count - 1]

  if ($avgMarginalProfit -gt 1) {
    $suggestedSpend = [Math]::Min(($currentAvgSpend * 1.2), ($currentAvgSpend + 500000))
  } elseif ($avgMarginalProfit -gt 0) {
    if ($lastMarginalProfit -gt 0.5) {
      $suggestedSpend = $currentAvgSpend * 1.1
    } elseif ($lastMarginalProfit -gt 0) {
      $suggestedSpend = $currentAvgSpend
    } else {
      $suggestedSpend = $currentAvgSpend * 0.9
    }
  } else {
    $suggestedSpend = $currentAvgSpend * 0.7
  }

  $suggestedSpend = [Math]::Max(0, [Math]::Round($suggestedSpend))
  $upperCap = [Math]::Round($baselineSpend * 1.2)
  $lowerCap = [Math]::Round($baselineSpend * 0.7)
  $suggestedSpendWithCap = [Math]::Max($lowerCap, [Math]::Min($upperCap, $suggestedSpend))

  return [pscustomobject]@{
    spendYesterday = [Math]::Round($spendYesterday)
    profitYesterday = [Math]::Round($profitYesterday)
    currentAvgSpend = [Math]::Round($currentAvgSpend)
    baselineSpend = [Math]::Round($baselineSpend)
    suggestedSpendWithCap = [Math]::Round($suggestedSpendWithCap)
    consecutiveNegativeDays = $consecutiveNegativeDays
    avgMarginalProfit = [Math]::Round($avgMarginalProfit * 100) / 100
    lastMarginalProfit = [Math]::Round($lastMarginalProfit * 100) / 100
  }
}

function Get-StateExpectations {
  param(
    [array]$History,
    [double]$XPercent
  )

  $legacyRecords = @(Get-RecordsForLegacy -History $History)
  $productXRecords = @(Get-RecordsForProductX -History $History -XPercent $XPercent)

  $legacyTotalNet = 0
  $productXTotalNet = 0
  $totalAdsCost = 0

  foreach ($record in $legacyRecords) {
    $legacyTotalNet += N0 $record.Profit
    $totalAdsCost += N0 $record.Spend
  }
  foreach ($record in $productXRecords) {
    $productXTotalNet += N0 $record.Profit
  }

  return [pscustomobject]@{
    totalAdsCost = $totalAdsCost
    legacyTotalNet = $legacyTotalNet
    productXTotalNet = $productXTotalNet
    legacySuggestion = Get-SuggestionExpectation -Records $legacyRecords
    productXSuggestion = Get-SuggestionExpectation -Records $productXRecords
    expectedReturnedOrders = ($History.Count * $XPercent) / 100
  }
}

function Sync-Day {
  param(
    [string]$DateStr,
    [hashtable]$Headers,
    [string]$Label
  )
  $sync = Safe-Request -Method POST -Uri "$BaseUrl/ad-group-daily-report/sync?date=$DateStr" -Headers $Headers -Body "{}" -Label $Label
  if ($sync -and $sync.success) {
    Write-Pass "Synced ad-group daily report for $DateStr"
    return $true
  }
  Write-Fail "Sync failed for $DateStr"
  return $false
}

function Get-OptimalRow {
  param(
    [hashtable]$Headers,
    [string]$AdGroupId,
    [string]$Mode,
    [string]$DefaultX = "15"
  )
  $url = if ($Mode -eq "product-x") {
    "$BaseUrl/ad-group-daily-report/optimal-spend?mode=product-x&defaultX=$DefaultX"
  } else {
    "$BaseUrl/ad-group-daily-report/optimal-spend?mode=legacy"
  }
  $response = Safe-Request -Method GET -Uri $url -Headers $Headers -Label "Optimal-$Mode"
  if (-not $response) { return $null }
  return @($response.adGroupSuggestions) | Where-Object { $_.adGroupId -eq $AdGroupId } | Select-Object -First 1
}

function Get-Report {
  param(
    [hashtable]$Headers,
    [string]$AdGroupId,
    [string]$FromDate,
    [string]$ToDate
  )
  $url = "$BaseUrl/ad-group-daily-report?fromDate=$FromDate&toDate=$ToDate&adGroupId=$AdGroupId"
  return Safe-Request -Method GET -Uri $url -Headers $Headers -Label "DailyReport"
}

function Assert-SuggestionRow {
  param(
    [object]$Row,
    [object]$Expected,
    [string]$Label,
    [double]$ExpectedX = -1,
    [double]$ExpectedReturnedOrders = -1
  )
  if (-not $Row) {
    Write-Fail "$Label row missing"
    return
  }

  Assert-Approx -Actual (N0 $Row.spendYesterday) -Expected (N0 $Expected.spendYesterday) -Tolerance 2 -Label "$Label spendYesterday"
  Assert-Approx -Actual (N0 $Row.profitYesterday) -Expected (N0 $Expected.profitYesterday) -Tolerance 2 -Label "$Label profitYesterday"
  Assert-Approx -Actual (N0 $Row.currentAvgSpend) -Expected (N0 $Expected.currentAvgSpend) -Tolerance 2 -Label "$Label currentAvgSpend"
  Assert-Approx -Actual (N0 $Row.baselineSpend) -Expected (N0 $Expected.baselineSpend) -Tolerance 2 -Label "$Label baselineSpend"
  Assert-Approx -Actual (N0 $Row.suggestedSpendWithCap) -Expected (N0 $Expected.suggestedSpendWithCap) -Tolerance 2 -Label "$Label suggestedSpendWithCap"
  Assert-Approx -Actual (N0 $Row.consecutiveNegativeDays) -Expected (N0 $Expected.consecutiveNegativeDays) -Tolerance 0.01 -Label "$Label consecutiveNegativeDays"

  if ($ExpectedX -ge 0) {
    Assert-Approx -Actual (N0 $Row.assumedReturnRatePercent) -Expected $ExpectedX -Tolerance 0.01 -Label "$Label assumedReturnRatePercent"
    Assert-Approx -Actual (N0 $Row.expectedReturnedOrders) -Expected $ExpectedReturnedOrders -Tolerance 0.05 -Label "$Label expectedReturnedOrders"
    Assert-Equal -Actual $Row.assumptionSource -Expected "product" -Label "$Label assumptionSource"
  }
}

function Assert-ReportState {
  param(
    [object]$Report,
    [object]$ExpectedState,
    [string]$DateStr,
    [string]$Label
  )
  if (-not $Report) {
    Write-Fail "$Label report missing"
    return
  }

  Assert-Approx -Actual (N0 $Report.summary.totalAdsCost) -Expected (N0 $ExpectedState.totalAdsCost) -Tolerance 2 -Label "$Label summary totalAdsCost"
  Assert-Approx -Actual (N0 $Report.summary.totalNetProfit) -Expected (N0 $ExpectedState.legacyTotalNet) -Tolerance 2 -Label "$Label summary totalNetProfit"

  $row = @($Report.details) | Where-Object { $_.date -eq $DateStr } | Select-Object -First 1
  if (-not $row) {
    Write-Fail "$Label report row for $DateStr missing"
    return
  }

  Assert-Approx -Actual (N0 $row.adsCost) -Expected (N0 $ExpectedState.legacySuggestion.spendYesterday) -Tolerance 2 -Label "$Label report row adsCost"
  Assert-Approx -Actual (N0 $row.netProfit) -Expected (N0 $ExpectedState.legacySuggestion.profitYesterday) -Tolerance 2 -Label "$Label report row netProfit"
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$script:supplierCost = 200000
$script:shippingFee = 50000
$script:returnFee = 0
$currentXPercent = 60
$nextXPercent = 20

$history = @(
  [pscustomobject]@{ Label = "D1"; Date = (Get-Date).AddDays(-3); Spend = 100000; Cod = 500000; StatusKind = "delivered"; OrderId = $null; AdCostId = $null },
  [pscustomobject]@{ Label = "D2"; Date = (Get-Date).AddDays(-2); Spend = 120000; Cod = 650000; StatusKind = "delivered"; OrderId = $null; AdCostId = $null },
  [pscustomobject]@{ Label = "D3"; Date = (Get-Date).AddDays(-1); Spend = 140000; Cod = 700000; StatusKind = "delivered"; OrderId = $null; AdCostId = $null }
)

foreach ($item in $history) {
  $item | Add-Member -NotePropertyName DateStr -NotePropertyValue ($item.Date.ToString("yyyy-MM-dd"))
  $item | Add-Member -NotePropertyName Iso -NotePropertyValue ("$($item.Date.ToString('yyyy-MM-dd'))" + "T00:00:00.000Z")
}

$yesterday = $history[2]
$createdCategoryId = $null
$createdProductId = $null
$createdFanpageId = $null
$createdAdAccountId = $null
$createdAdGroupObjId = $null
$createdAdGroupId = "AG-RIPPLE-$ts"
$h = @{}
$currentUserId = $null
$deliveredStatus = $null
$returnStatus = $null
$script:serviceYesterdayDateStr = Get-ServiceDateStringDaysAgo -DaysAgo 1

Write-Section "RIPPLE TEST: ADS BUDGET INPUT UPDATES - $ts"
Write-Info "History dates: $($history[0].DateStr), $($history[1].DateStr), $($history[2].DateStr)"

try {
  Write-Section "PHASE 0: Login and resolve statuses"

  Write-Step "0.1" "Login Director"
  $login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
  if ($login -and $login.access_token) {
    $h = @{ Authorization = "Bearer $($login.access_token)" }
    $currentUserId = [string]$login.user.id
    Write-Pass "Login OK"
  } else {
    Write-Fail "Login failed"
    throw "Login failed"
  }

  Write-Step "0.2" "Resolve canonical delivered and return statuses from API"
  $paymentStatuses = @(Safe-Request -Method GET -Uri "$BaseUrl/delivery-status/payment-trigger" -Headers $h -Label "PaymentTriggerStatuses")
  $delivered = $paymentStatuses | Where-Object { $_ -and $_.isReturnStatus -ne $true } | Select-Object -First 1
  $returned = $paymentStatuses | Where-Object { $_ -and $_.isReturnStatus -eq $true } | Select-Object -First 1

  if ($delivered -and $delivered.name) {
    $deliveredStatus = [string]$delivered.name
    Write-Pass "Resolved delivered status: $deliveredStatus"
  } else {
    Write-Fail "Cannot resolve delivered status"
    throw "No delivered status"
  }

  if ($returned -and $returned.name) {
    $returnStatus = [string]$returned.name
    Write-Pass "Resolved return status: $returnStatus"
  } else {
    Write-Fail "Cannot resolve return status from payment-trigger statuses"
    throw "No return status"
  }

  $yesterday = @($history | Where-Object { $_.DateStr -eq $script:serviceYesterdayDateStr } | Select-Object -First 1)[0]
  if (-not $yesterday) {
    Write-Fail "History does not contain service yesterday date: $($script:serviceYesterdayDateStr)"
    throw "Service yesterday not covered by test history"
  }
  Write-Pass "Service yesterday date resolved to: $($yesterday.DateStr)"

  Write-Section "PHASE 1: Setup ads entities"

  Write-Step "1.1" "Create product category"
  $categoryBody = @{
    name = "Category Ripple $ts"
    description = "Ripple test for ads budget suggestion"
    color = "#006D77"
    isActive = $true
  } | ConvertTo-Json -Compress
  $category = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $categoryBody -Label "CreateCategory"
  if ($category -and $category._id) {
    $createdCategoryId = [string]$category._id
    Write-Pass "Product category created: $createdCategoryId"
  } else {
    Write-Fail "Create product category failed"
    throw "No category"
  }

  Write-Step "1.2" "Create product with assumedReturnRatePercent = $currentXPercent"
  $productBody = @{
    name = "Product Ripple $ts"
    categoryId = $createdCategoryId
    assumedReturnRatePercent = $currentXPercent
    importPrice = 0
    shippingCost = 0
    packagingCost = 0
  } | ConvertTo-Json -Compress
  $product = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $productBody -Label "CreateProduct"
  if ($product -and $product._id) {
    $createdProductId = [string]$product._id
    Write-Pass "Product created: $createdProductId"
    Assert-Approx -Actual (N0 $product.assumedReturnRatePercent) -Expected $currentXPercent -Tolerance 0.01 -Label "Initial product assumedReturnRatePercent"
  } else {
    Write-Fail "Create product failed"
    throw "No product"
  }

  Write-Step "1.3" "Create fanpage"
  $fanpageBody = @{
    name = "FP Ripple $ts"
    pageId = "fp_ripple_$ts"
    accessToken = "token_$ts"
    status = "active"
  } | ConvertTo-Json -Compress
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
    name = "ACC Ripple $ts"
    accountId = "acc_ripple_$ts"
    accountType = "facebook"
    isActive = $true
  } | ConvertTo-Json -Compress
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
    name = "AG Ripple $ts"
    adGroupId = $createdAdGroupId
    fanpageId = $createdFanpageId
    productCategoryId = $createdCategoryId
    selectedProducts = @($createdProductId)
    agentId = $currentUserId
    adAccountId = $createdAdAccountId
    platform = "facebook"
    isActive = $true
  } | ConvertTo-Json -Compress
  $adGroup = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $adGroupBody -Label "CreateAdGroup"
  if ($adGroup -and $adGroup._id) {
    $createdAdGroupObjId = [string]$adGroup._id
    Write-Pass "Ad group created: $createdAdGroupId"
  } else {
    Write-Fail "Create ad group failed"
    throw "No ad group"
  }

  Write-Section "PHASE 2: Build 3-day baseline history"
  $stepIndex = 1
  foreach ($item in $history) {
    Write-Step "2.$stepIndex" "Create ad cost + delivered order for $($item.DateStr)"

    $adCostBody = @{
      adGroupId = $createdAdGroupId
      date = $item.Iso
      spentAmount = $item.Spend
      channel = "facebook"
    } | ConvertTo-Json -Compress
    $adCost = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $adCostBody -Label "CreateAdCost-$($item.Label)"
    if ($adCost -and $adCost._id) {
      $item.AdCostId = [string]$adCost._id
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
      supplierAppliedPrice = $script:supplierCost
      supplierQuote = $script:supplierCost
      shippingFee = $script:shippingFee
    } | ConvertTo-Json -Compress
    $order = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $orderBody -Label "CreateOrder-$($item.Label)"
    if ($order -and $order._id) {
      $item.OrderId = [string]$order._id
      Write-Pass "Order created for $($item.Label): $($item.OrderId)"
    } else {
      Write-Fail "Create order failed for $($item.Label)"
      throw "No order for $($item.Label)"
    }

    $deliverBody = @{ orderStatus = $deliveredStatus } | ConvertTo-Json -Compress
    [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($item.OrderId)" -Headers $h -Body $deliverBody -Label "Deliver-$($item.Label)")
    [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$($item.OrderId)/recalculate-profits" -Headers $h -Body "{}" -Label "Recalc-$($item.Label)")
    Start-Sleep -Milliseconds 300

    $savedOrder = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($item.OrderId)" -Headers $h -Label "GetOrder-$($item.Label)"
    if ($savedOrder) {
      Assert-Approx -Actual (N0 $savedOrder.advertisingCost) -Expected (N0 $item.Spend) -Tolerance 2 -Label "$($item.Label) order advertisingCost"
      Assert-Approx -Actual (N0 $savedOrder.netProfit) -Expected (Get-LegacyNet -Item $item) -Tolerance 2 -Label "$($item.Label) order legacy netProfit"
    } else {
      Write-Fail "Cannot reload order for $($item.Label)"
    }

    if (-not (Sync-Day -DateStr $item.DateStr -Headers $h -Label "Sync-$($item.Label)")) {
      throw "Sync failed for $($item.DateStr)"
    }

    $stepIndex++
  }

  Write-Section "PHASE 3: Validate baseline"
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $baselineReport = Get-Report -Headers $h -AdGroupId $createdAdGroupId -FromDate $history[0].DateStr -ToDate $history[2].DateStr
  Assert-ReportState -Report $baselineReport -ExpectedState $state -DateStr $yesterday.DateStr -Label "Baseline"

  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRow -Expected $state.legacySuggestion -Label "Baseline legacy"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "Baseline product-x" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Section "PHASE 4: Update advertising cost and verify ripple"
  $previousSpend = N0 $yesterday.Spend
  Write-Step "4.1" "Patch service-yesterday ad cost from $previousSpend to 200000"
  $yesterday.Spend = 200000
  $patchAdBody = @{ spentAmount = $yesterday.Spend } | ConvertTo-Json -Compress
  $patchedAdCost = Safe-Request -Method PATCH -Uri "$BaseUrl/advertising-cost/$($yesterday.AdCostId)" -Headers $h -Body $patchAdBody -Label "PatchAdCost-Yesterday"
  if ($patchedAdCost) {
    Write-Pass "Yesterday ad cost patched"
  } else {
    Write-Fail "Patch yesterday ad cost failed"
    throw "Patch ad cost failed"
  }

  $updatedOrder = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Label "GetOrder-AfterAdCost"
  if ($updatedOrder) {
    Assert-Approx -Actual (N0 $updatedOrder.advertisingCost) -Expected (N0 $yesterday.Spend) -Tolerance 2 -Label "After ad cost patch order advertisingCost"
    Assert-Approx -Actual (N0 $updatedOrder.netProfit) -Expected (Get-LegacyNet -Item $yesterday) -Tolerance 2 -Label "After ad cost patch order netProfit"
  } else {
    Write-Fail "Cannot reload order after ad cost patch"
  }

  Write-Step "4.2" "Suggestions remain stale before manual daily sync"
  $legacyRowBeforeSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRowBeforeSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRowBeforeSync -Expected $state.legacySuggestion -Label "Before sync legacy after ad cost"
  Assert-SuggestionRow -Row $productXRowBeforeSync -Expected $state.productXSuggestion -Label "Before sync product-x after ad cost" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Step "4.3" "Daily sync makes both suggestion modes reflect new ad spend"
  if (-not (Sync-Day -DateStr $yesterday.DateStr -Headers $h -Label "Sync-AdCost-Changed")) {
    throw "Sync failed after ad cost change"
  }
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $report = Get-Report -Headers $h -AdGroupId $createdAdGroupId -FromDate $history[0].DateStr -ToDate $history[2].DateStr
  Assert-ReportState -Report $report -ExpectedState $state -DateStr $yesterday.DateStr -Label "After ad cost sync"
  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRow -Expected $state.legacySuggestion -Label "After ad cost sync legacy"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "After ad cost sync product-x" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Section "PHASE 5: Update product X percent"
  Write-Step "5.1" "Patch product assumedReturnRatePercent from 60 to 20"
  $currentXPercent = $nextXPercent
  $patchProductBody = @{ assumedReturnRatePercent = $currentXPercent } | ConvertTo-Json -Compress
  $patchedProduct = Safe-Request -Method PATCH -Uri "$BaseUrl/products/$createdProductId" -Headers $h -Body $patchProductBody -Label "PatchProductX"
  if ($patchedProduct) {
    Write-Pass "Product X percent patched"
    Assert-Approx -Actual (N0 $patchedProduct.assumedReturnRatePercent) -Expected $currentXPercent -Tolerance 0.01 -Label "Patched product assumedReturnRatePercent"
  } else {
    Write-Fail "Patch product X failed"
    throw "Patch product X failed"
  }

  Write-Step "5.2" "Product-x updates immediately without daily sync, legacy stays unchanged"
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  $legacyUnchangedState = Get-StateExpectations -History $history -XPercent 60
  Assert-SuggestionRow -Row $legacyRow -Expected $legacyUnchangedState.legacySuggestion -Label "After X patch legacy unchanged"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "After X patch product-x immediate" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Section "PHASE 6: Update order status to return"
  Write-Step "6.1" "Patch yesterday order from delivered to return"
  $yesterday.StatusKind = "returned"
  $returnBody = @{ orderStatus = $returnStatus } | ConvertTo-Json -Compress
  [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Body $returnBody -Label "PatchOrderStatus-Return")
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)/recalculate-profits" -Headers $h -Body "{}" -Label "Recalc-Return")
  Start-Sleep -Milliseconds 300

  $returnedOrder = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Label "GetOrder-Returned"
  if ($returnedOrder) {
    Assert-Approx -Actual (N0 $returnedOrder.grossProfit) -Expected (Get-LegacyGross -Cod (N0 $yesterday.Cod) -StatusKind $yesterday.StatusKind) -Tolerance 2 -Label "Returned order grossProfit"
    Assert-Approx -Actual (N0 $returnedOrder.netProfit) -Expected (Get-LegacyNet -Item $yesterday) -Tolerance 2 -Label "Returned order netProfit"
  } else {
    Write-Fail "Cannot reload returned order"
  }

  Write-Step "6.2" "Legacy stays stale before sync, product-x is unchanged because status is ignored in X model"
  $legacyRowBeforeSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRowBeforeSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  $statusPreSyncHistory = @()
  foreach ($item in $history) {
    $statusKind = if ($item.Label -eq $yesterday.Label) { "delivered" } else { $item.StatusKind }
    $statusPreSyncHistory += [pscustomobject]@{
      Label = $item.Label
      DateStr = $item.DateStr
      Spend = $item.Spend
      Cod = $item.Cod
      StatusKind = $statusKind
    }
  }
  $stateBeforeStatus = Get-StateExpectations -History $statusPreSyncHistory -XPercent $currentXPercent
  Assert-SuggestionRow -Row $legacyRowBeforeSync -Expected $stateBeforeStatus.legacySuggestion -Label "Before sync legacy after status"
  Assert-SuggestionRow -Row $productXRowBeforeSync -Expected $stateBeforeStatus.productXSuggestion -Label "Before sync product-x after status" -ExpectedX $currentXPercent -ExpectedReturnedOrders $stateBeforeStatus.expectedReturnedOrders

  Write-Step "6.3" "Daily sync updates legacy, product-x stays unchanged"
  if (-not (Sync-Day -DateStr $yesterday.DateStr -Headers $h -Label "Sync-Status-Changed")) {
    throw "Sync failed after status change"
  }
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $report = Get-Report -Headers $h -AdGroupId $createdAdGroupId -FromDate $history[0].DateStr -ToDate $history[2].DateStr
  Assert-ReportState -Report $report -ExpectedState $state -DateStr $yesterday.DateStr -Label "After status sync"
  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRow -Expected $state.legacySuggestion -Label "After status sync legacy"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "After status sync product-x" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Section "PHASE 7: Restore delivered state"
  Write-Step "7.1" "Patch yesterday order back to delivered and sync"
  $yesterday.StatusKind = "delivered"
  $deliverBody = @{ orderStatus = $deliveredStatus } | ConvertTo-Json -Compress
  [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Body $deliverBody -Label "PatchOrderStatus-DeliveredAgain")
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)/recalculate-profits" -Headers $h -Body "{}" -Label "Recalc-DeliveredAgain")
  Start-Sleep -Milliseconds 300
  if (-not (Sync-Day -DateStr $yesterday.DateStr -Headers $h -Label "Sync-Delivered-Again")) {
    throw "Sync failed after restore delivered"
  }
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRow -Expected $state.legacySuggestion -Label "After restore delivered legacy"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "After restore delivered product-x" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Section "PHASE 8: Update COD and verify ripple"
  $previousCod = N0 $yesterday.Cod
  Write-Step "8.1" "Patch service-yesterday COD from $previousCod to 400000"
  $yesterday.Cod = 400000
  $patchCodBody = @{ codAmount = $yesterday.Cod } | ConvertTo-Json -Compress
  [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Body $patchCodBody -Label "PatchCod")
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)/recalculate-profits" -Headers $h -Body "{}" -Label "Recalc-Cod")
  Start-Sleep -Milliseconds 300

  $orderAfterCod = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$($yesterday.OrderId)" -Headers $h -Label "GetOrder-AfterCod"
  if ($orderAfterCod) {
    Assert-Approx -Actual (N0 $orderAfterCod.grossProfit) -Expected (Get-LegacyGross -Cod (N0 $yesterday.Cod) -StatusKind $yesterday.StatusKind) -Tolerance 2 -Label "After COD patch order grossProfit"
    Assert-Approx -Actual (N0 $orderAfterCod.netProfit) -Expected (Get-LegacyNet -Item $yesterday) -Tolerance 2 -Label "After COD patch order netProfit"
  } else {
    Write-Fail "Cannot reload order after COD patch"
  }

  Write-Step "8.2" "Product-x updates immediately from order COD, legacy remains stale until sync"
  $state = Get-StateExpectations -History $history -XPercent $currentXPercent
  $legacyBeforeCodSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXBeforeCodSync = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  $codPreSyncHistory = @()
  foreach ($item in $history) {
    $codValue = if ($item.Label -eq $yesterday.Label) { $previousCod } else { $item.Cod }
    $codPreSyncHistory += [pscustomobject]@{
      Label = $item.Label
      DateStr = $item.DateStr
      Spend = $item.Spend
      Cod = $codValue
      StatusKind = $item.StatusKind
    }
  }
  $stateBeforeCod = Get-StateExpectations -History $codPreSyncHistory -XPercent $currentXPercent
  Assert-SuggestionRow -Row $legacyBeforeCodSync -Expected $stateBeforeCod.legacySuggestion -Label "Before sync legacy after COD"
  Assert-SuggestionRow -Row $productXBeforeCodSync -Expected $state.productXSuggestion -Label "Before sync product-x after COD" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

  Write-Step "8.3" "Daily sync updates legacy after COD change"
  if (-not (Sync-Day -DateStr $yesterday.DateStr -Headers $h -Label "Sync-Cod-Changed")) {
    throw "Sync failed after COD change"
  }
  $report = Get-Report -Headers $h -AdGroupId $createdAdGroupId -FromDate $history[0].DateStr -ToDate $history[2].DateStr
  Assert-ReportState -Report $report -ExpectedState $state -DateStr $yesterday.DateStr -Label "After COD sync"
  $legacyRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "legacy"
  $productXRow = Get-OptimalRow -Headers $h -AdGroupId $createdAdGroupId -Mode "product-x"
  Assert-SuggestionRow -Row $legacyRow -Expected $state.legacySuggestion -Label "After COD sync legacy"
  Assert-SuggestionRow -Row $productXRow -Expected $state.productXSuggestion -Label "After COD sync product-x" -ExpectedX $currentXPercent -ExpectedReturnedOrders $state.expectedReturnedOrders

} catch {
  Write-Fail "Exception in test: $_"
}

Write-Section "PHASE 9: Cleanup"

foreach ($item in $history) {
  if ($item.OrderId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$($item.OrderId)" -Headers $h -Label "DeleteOrder-$($item.OrderId)")
    Write-Info "Deleted order: $($item.OrderId)"
  }
}

foreach ($item in $history) {
  if ($item.AdCostId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$($item.AdCostId)" -Headers $h -Label "DeleteAdCost-$($item.AdCostId)")
    Write-Info "Deleted ad cost: $($item.AdCostId)"
  }
}

if ($createdAdGroupObjId) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$createdAdGroupObjId" -Headers $h -Label "DeleteAdGroup")
  Write-Info "Deleted ad group"
}
if ($createdAdAccountId) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$createdAdAccountId" -Headers $h -Label "DeleteAdAccount")
  Write-Info "Deleted ad account"
}
if ($createdProductId) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductId" -Headers $h -Label "DeleteProduct")
  Write-Info "Deleted product"
}
if ($createdCategoryId) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdCategoryId" -Headers $h -Label "DeleteCategory")
  Write-Info "Deleted product category"
}
if ($createdFanpageId) {
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$createdFanpageId" -Headers $h -Label "DeleteFanpage")
  Write-Info "Deleted fanpage"
}

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
  Write-Host "  ALL PASSED - ripple behavior for ads budget suggestion is verified." -ForegroundColor Green
} else {
  Write-Host "  TEST FAILED - review failures above." -ForegroundColor Red
}
Write-Host ""
