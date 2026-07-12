#!/usr/bin/env powershell
<#
  Ads Budget X-mode + Emergency mode-prefix integration test
  Scope:
  1) Product X setup (assumedReturnRatePercent on product)
  2) Optimal spend API: product-x vs legacy behavior
  3) Emergency action logs: mode-prefixed task IDs isolation
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

function Assert-Approx {
  param(
    [double]$Actual,
    [double]$Expected,
    [double]$Tolerance = 0.5,
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

$today = Get-Date
$todayStr = $today.ToString("yyyy-MM-dd")
$yesterday = $today.AddDays(-1)
$yesterdayStr = $yesterday.ToString("yyyy-MM-dd")
$yesterdayIso = "$yesterdayStr" + "T00:00:00.000Z"

# Cleanup IDs
$createdCategoryId = $null
$createdCategoryOwned = $false
$createdProductAId = $null
$createdProductBId = $null
$createdFanpageId = $null
$createdAdAccountId = $null
$createdAdGroupProductObjId = $null
$createdAdGroupFallbackObjId = $null
$createdAdGroupProductId = "AG-X-PROD-$ts"
$createdAdGroupFallbackId = "AG-X-FALL-$ts"
$createdOrderAId = $null
$createdOrderBId = $null

$taskProductXId = "product-x:change-budget:AG-X-PROD-$ts"
$taskLegacyId   = "legacy:change-budget:AG-X-PROD-$ts"

$h = @{}
$currentUserId = $null

Write-Section "INTEGRATION TEST: ADS BUDGET X MODE + EMERGENCY MODE ISOLATION - $ts"
Write-Info "Test date for sync: $yesterdayStr"

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

  Write-Section "PHASE 1: Setup product + ads entities"

  Write-Step "1.1" "Resolve active product category"
  $cats = Safe-Request -Method GET -Uri "$BaseUrl/product-category/active" -Headers $h -Label "GetActiveCategories"
  $catList = if ($cats -is [array]) { $cats } elseif ($cats.data) { $cats.data } else { @($cats) }
  if ($catList.Count -gt 0 -and $catList[0]._id) {
    $createdCategoryId = [string]$catList[0]._id
    Write-Pass "Using category: $createdCategoryId"
  } else {
    $catBody = @{
      name = "Ads Budget X Category $ts"
      description = "Temporary category for ads-budget-x-emergency"
      code = "ABX-$ts"
      isActive = $true
      order = 110
    } | ConvertTo-Json
    $cat = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $catBody -Label "CreateFallbackCategory"
    if ($cat -and $cat._id) {
      $createdCategoryId = [string]$cat._id
      $createdCategoryOwned = $true
      Write-Pass "Created fallback category: $createdCategoryId"
    } else {
      Write-Fail "No active product category found"
      throw "No category"
    }
  }

  Write-Step "1.2" "Create product A with assumedReturnRatePercent = 42"
  $prodABody = @{
    name = "Test Product X A $ts"
    categoryId = $createdCategoryId
    assumedReturnRatePercent = 42
  } | ConvertTo-Json
  $prodA = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $prodABody -Label "CreateProductA"
  if ($prodA -and $prodA._id) {
    $createdProductAId = [string]$prodA._id
    Write-Pass "Product A created: $createdProductAId"
    Assert-Approx -Actual (N0 $prodA.assumedReturnRatePercent) -Expected 42 -Tolerance 0.01 -Label "Product A assumedReturnRatePercent"
  } else {
    Write-Fail "Create product A failed"
    throw "Create product A failed"
  }

  Write-Step "1.3" "Create product B without X (expect default 20)"
  $prodBBody = @{
    name = "Test Product X B $ts"
    categoryId = $createdCategoryId
  } | ConvertTo-Json
  $prodB = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $h -Body $prodBBody -Label "CreateProductB"
  if ($prodB -and $prodB._id) {
    $createdProductBId = [string]$prodB._id
    Write-Pass "Product B created: $createdProductBId"
    Assert-Approx -Actual (N0 $prodB.assumedReturnRatePercent) -Expected 20 -Tolerance 0.01 -Label "Product B default assumedReturnRatePercent"
  } else {
    Write-Fail "Create product B failed"
    throw "Create product B failed"
  }

  Write-Step "1.4" "Create fanpage + ad account"
  $fpBody = @{
    name = "Test FP X $ts"
    pageId = "test_fp_x_$ts"
    accessToken = "token_$ts"
    status = "active"
  } | ConvertTo-Json
  $fp = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $fpBody -Label "CreateFanpage"
  if ($fp -and $fp._id) {
    $createdFanpageId = [string]$fp._id
    Write-Pass "Fanpage created: $createdFanpageId"
  } else {
    Write-Fail "Create fanpage failed"
    throw "No fanpage"
  }

  $accBody = @{
    name = "Test ACC X $ts"
    accountId = "test_acc_x_$ts"
    accountType = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $acc = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $accBody -Label "CreateAdAccount"
  if ($acc -and $acc._id) {
    $createdAdAccountId = [string]$acc._id
    Write-Pass "Ad account created: $createdAdAccountId"
  } else {
    Write-Fail "Create ad account failed"
    throw "No ad account"
  }

  Write-Step "1.5" "Create 2 ad groups: product-linked vs fallback"
  $agProdBody = @{
    name = "AG Product X $ts"
    adGroupId = $createdAdGroupProductId
    fanpageId = $createdFanpageId
    productCategoryId = $createdCategoryId
    selectedProducts = @($createdProductAId)
    agentId = $currentUserId
    adAccountId = $createdAdAccountId
    platform = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $agProd = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $agProdBody -Label "CreateAdGroupProduct"
  if ($agProd -and $agProd._id) {
    $createdAdGroupProductObjId = [string]$agProd._id
    Write-Pass "Product-linked ad group created: $createdAdGroupProductId"
  } else {
    Write-Fail "Create product-linked ad group failed"
    throw "Create ad group product failed"
  }

  $agFallbackBody = @{
    name = "AG Fallback X $ts"
    adGroupId = $createdAdGroupFallbackId
    fanpageId = $createdFanpageId
    productCategoryId = $createdCategoryId
    selectedProducts = @($createdProductBId)
    agentId = $currentUserId
    adAccountId = $createdAdAccountId
    platform = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $agFallback = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $agFallbackBody -Label "CreateAdGroupFallback"
  if ($agFallback -and $agFallback._id) {
    $createdAdGroupFallbackObjId = [string]$agFallback._id
    Write-Pass "Fallback ad group created: $createdAdGroupFallbackId"
  } else {
    Write-Fail "Create fallback ad group failed"
    throw "Create ad group fallback failed"
  }

  Write-Step "1.6" "Delete product B after ad-group creation to simulate fallback/defaultX path"
  [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductBId" -Headers $h -Label "DeleteProductBForFallback")
  Write-Pass "Deleted product B to force fallback mapping on product-x mode"

  Write-Section "PHASE 2: Create minimal orders and sync report"

  Write-Step "2.1" "Create order for product-linked ad group"
  $orderABody = @{
    customerName = "Customer AG Product $ts"
    quantity = 1
    adGroupId = $createdAdGroupProductId
    productId = $createdProductAId
    orderDate = $yesterdayIso
    codAmount = 300000
    supplierAppliedPrice = 120000
    supplierQuote = 120000
    shippingFee = 30000
    orderStatus = "Giao thành công"
  } | ConvertTo-Json
  $orderA = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $orderABody -Label "CreateOrderA"
  if ($orderA -and $orderA._id) {
    $createdOrderAId = [string]$orderA._id
    Write-Pass "Order A created: $createdOrderAId"
  } else {
    Write-Fail "Create order A failed"
    throw "Create order A failed"
  }

  Write-Step "2.2" "Create order for fallback ad group (no productId)"
  $orderBBody = @{
    customerName = "Customer AG Fallback $ts"
    quantity = 1
    adGroupId = $createdAdGroupFallbackId
    orderDate = $yesterdayIso
    codAmount = 280000
    supplierAppliedPrice = 130000
    supplierQuote = 130000
    shippingFee = 35000
    orderStatus = "Giao thành công"
  } | ConvertTo-Json
  $orderB = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $orderBBody -Label "CreateOrderB"
  if ($orderB -and $orderB._id) {
    $createdOrderBId = [string]$orderB._id
    Write-Pass "Order B created: $createdOrderBId"
  } else {
    Write-Fail "Create order B failed"
    throw "Create order B failed"
  }

  Write-Step "2.3" "Force recalculate profits for 2 orders"
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$createdOrderAId/recalculate-profits" -Headers $h -Body "{}" -Label "RecalcA")
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$createdOrderBId/recalculate-profits" -Headers $h -Body "{}" -Label "RecalcB")
  Write-Pass "Recalculate endpoint invoked"

  Write-Step "2.4" "Sync ad-group daily report for test date"
  $sync = Safe-Request -Method POST -Uri "$BaseUrl/ad-group-daily-report/sync?date=$yesterdayStr" -Headers $h -Body "{}" -Label "SyncDailyReport"
  if ($sync -and $sync.success) {
    Write-Pass "Sync daily report OK (records=$($sync.recordsProcessed))"
  } else {
    Write-Fail "Sync daily report failed"
  }

  Write-Section "PHASE 3: Validate optimal-spend modes"

  Write-Step "3.1" "Query product-x mode with defaultX=11"
  $optX = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=product-x&defaultX=11" -Headers $h -Label "OptimalProductX"
  if ($optX -and $optX.mode -eq "product-x") {
    Write-Pass "product-x mode returned"
    Assert-Approx -Actual (N0 $optX.defaultAssumedReturnRatePercent) -Expected 11 -Tolerance 0.01 -Label "defaultAssumedReturnRatePercent=11"
  } else {
    Write-Fail "product-x mode request failed"
  }

  $xRows = if ($optX -and $optX.adGroupSuggestions) { @($optX.adGroupSuggestions) } else { @() }
  $rowProduct = $xRows | Where-Object { $_.adGroupId -eq $createdAdGroupProductId } | Select-Object -First 1
  $rowFallback = $xRows | Where-Object { $_.adGroupId -eq $createdAdGroupFallbackId } | Select-Object -First 1

  if ($rowProduct) {
    Write-Pass "Found product-linked ad group in product-x response"
    if ($rowProduct.assumptionSource -eq "product" -or $rowProduct.assumptionSource -eq "mixed") {
      Write-Pass "Product-linked assumptionSource=$($rowProduct.assumptionSource)"
    } else {
      Write-Fail "Expected product/mixed assumptionSource for product-linked ad group, got: $($rowProduct.assumptionSource)"
    }
    Assert-Approx -Actual (N0 $rowProduct.assumedReturnRatePercent) -Expected 42 -Tolerance 0.2 -Label "Product-linked assumedReturnRatePercent"
    if ($rowProduct.optimizationMode -eq "product-x") {
      Write-Pass "Product-linked optimizationMode=product-x"
    } else {
      Write-Fail "Product-linked optimizationMode mismatch: $($rowProduct.optimizationMode)"
    }
  } else {
    Write-Fail "Cannot find product-linked ad group in product-x response"
  }

  if ($rowFallback) {
    Write-Pass "Found fallback ad group in product-x response"
    if ($rowFallback.assumptionSource -eq "fallback") {
      Write-Pass "Fallback assumptionSource=fallback"
    } else {
      Write-Fail "Expected fallback assumptionSource for fallback ad group, got: $($rowFallback.assumptionSource)"
    }
    Assert-Approx -Actual (N0 $rowFallback.assumedReturnRatePercent) -Expected 11 -Tolerance 0.01 -Label "Fallback assumedReturnRatePercent from defaultX"
    if ($rowFallback.optimizationMode -eq "product-x") {
      Write-Pass "Fallback optimizationMode=product-x"
    } else {
      Write-Fail "Fallback optimizationMode mismatch: $($rowFallback.optimizationMode)"
    }
  } else {
    Write-Fail "Cannot find fallback ad group in product-x response"
  }

  Write-Step "3.2" "Query legacy mode"
  $optLegacy = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=legacy" -Headers $h -Label "OptimalLegacy"
  if ($optLegacy -and $optLegacy.mode -eq "legacy") {
    Write-Pass "legacy mode returned"
  } else {
    Write-Fail "legacy mode request failed"
  }

  $legacyRows = if ($optLegacy -and $optLegacy.adGroupSuggestions) { @($optLegacy.adGroupSuggestions) } else { @() }
  $legacyProduct = $legacyRows | Where-Object { $_.adGroupId -eq $createdAdGroupProductId } | Select-Object -First 1
  if ($legacyProduct) {
    if ($legacyProduct.optimizationMode -eq "legacy") {
      Write-Pass "Legacy optimizationMode=legacy on product-linked ad group"
    } else {
      Write-Fail "Legacy optimizationMode mismatch: $($legacyProduct.optimizationMode)"
    }
  } else {
    Write-Fail "Cannot find product-linked ad group in legacy response"
  }

  Write-Step "3.3" "Validate defaultX clamp bounds"
  $optXMax = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=product-x&defaultX=999" -Headers $h -Label "OptimalXClampMax"
  if ($optXMax) {
    Assert-Approx -Actual (N0 $optXMax.defaultAssumedReturnRatePercent) -Expected 95 -Tolerance 0.01 -Label "defaultX upper clamp to 95"
  } else {
    Write-Fail "defaultX upper clamp request failed"
  }

  $optXMin = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-daily-report/optimal-spend?mode=product-x&defaultX=-5" -Headers $h -Label "OptimalXClampMin"
  if ($optXMin) {
    Assert-Approx -Actual (N0 $optXMin.defaultAssumedReturnRatePercent) -Expected 0 -Tolerance 0.01 -Label "defaultX lower clamp to 0"
  } else {
    Write-Fail "defaultX lower clamp request failed"
  }

  Write-Section "PHASE 4: Validate emergency task isolation by mode prefix"

  Write-Step "4.1" "Bulk sync 2 tasks with same logical target but different mode prefix"
  $bulkBody = @{
    date = $todayStr
    tasks = @(
      @{
        taskId = $taskProductXId
        taskType = "change-budget"
        priority = "high"
        platform = "facebook"
        adGroupId = $createdAdGroupProductId
        adGroupName = "AG Product X $ts"
        actionText = "Set budget by X-mode"
        reason = "X-mode test"
        deadline = "Truoc 11:00"
        currentSpend = 100000
        targetSpend = 120000
      },
      @{
        taskId = $taskLegacyId
        taskType = "change-budget"
        priority = "high"
        platform = "facebook"
        adGroupId = $createdAdGroupProductId
        adGroupName = "AG Product X $ts"
        actionText = "Set budget by legacy mode"
        reason = "legacy-mode test"
        deadline = "Truoc 11:00"
        currentSpend = 100000
        targetSpend = 90000
      }
    )
  } | ConvertTo-Json -Depth 5

  $bulk = Safe-Request -Method POST -Uri "$BaseUrl/emergency-actions/bulk-sync" -Headers $h -Body $bulkBody -Label "EmergencyBulkSync"
  if ($bulk -and $bulk.success) {
    Write-Pass "Emergency bulk sync success (upserted=$($bulk.upserted), existing=$($bulk.existing))"
  } else {
    Write-Fail "Emergency bulk sync failed"
  }

  Write-Step "4.2" "Verify both tasks are stored independently"
  $tasksResp1 = Safe-Request -Method GET -Uri "$BaseUrl/emergency-actions?date=$todayStr" -Headers $h -Label "EmergencyGet1"
  $tasks1 = if ($tasksResp1 -and $tasksResp1.tasks) { @($tasksResp1.tasks) } else { @() }
  $tX1 = $tasks1 | Where-Object { $_.taskId -eq $taskProductXId } | Select-Object -First 1
  $tL1 = $tasks1 | Where-Object { $_.taskId -eq $taskLegacyId } | Select-Object -First 1
  if ($tX1) { Write-Pass "Stored task: $taskProductXId" } else { Write-Fail "Missing task: $taskProductXId" }
  if ($tL1) { Write-Pass "Stored task: $taskLegacyId" } else { Write-Fail "Missing task: $taskLegacyId" }

  Write-Step "4.3" "Toggle done only for product-x task and ensure legacy task unchanged"
  $encodedTaskX = [System.Uri]::EscapeDataString($taskProductXId)
  $toggle = Safe-Request -Method PATCH -Uri "$BaseUrl/emergency-actions/$encodedTaskX/toggle?date=$todayStr" -Headers $h -Body "{}" -Label "ToggleTaskX"
  if ($toggle -and $toggle.success -and $toggle.task -and $toggle.task.done -eq $true) {
    Write-Pass "Toggled product-x task to done=true"
  } else {
    Write-Fail "Toggle product-x task failed"
  }

  Start-Sleep -Milliseconds 600
  $tasksResp2 = Safe-Request -Method GET -Uri "$BaseUrl/emergency-actions?date=$todayStr" -Headers $h -Label "EmergencyGet2"
  $tasks2 = if ($tasksResp2 -and $tasksResp2.tasks) { @($tasksResp2.tasks) } else { @() }
  $tX2 = $tasks2 | Where-Object { $_.taskId -eq $taskProductXId } | Select-Object -First 1
  $tL2 = $tasks2 | Where-Object { $_.taskId -eq $taskLegacyId } | Select-Object -First 1
  if ($tX2 -and $tX2.done -eq $true) {
    Write-Pass "product-x task done=true after toggle"
  } else {
    Write-Fail "product-x task not done=true after toggle"
  }
  if ($tL2 -and $tL2.done -eq $false) {
    Write-Pass "legacy task remains done=false"
  } else {
    Write-Fail "legacy task state changed unexpectedly"
  }

  # Reset x task done state to reduce side effects in shared environment
  [void](Safe-Request -Method PATCH -Uri "$BaseUrl/emergency-actions/$encodedTaskX/toggle?date=$todayStr" -Headers $h -Body "{}" -Label "ToggleTaskXBack")
  Write-Info "Reset product-x task back to done=false"

} catch {
  Write-Fail "Exception in test: $_"
}

Write-Section "PHASE 5: Cleanup"

if ($createdOrderAId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$createdOrderAId" -Headers $h -Label "DeleteOrderA"); Write-Info "Deleted order A" }
if ($createdOrderBId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$createdOrderBId" -Headers $h -Label "DeleteOrderB"); Write-Info "Deleted order B" }
if ($createdAdGroupProductObjId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$createdAdGroupProductObjId" -Headers $h -Label "DeleteAgProduct"); Write-Info "Deleted product ad group" }
if ($createdAdGroupFallbackObjId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$createdAdGroupFallbackObjId" -Headers $h -Label "DeleteAgFallback"); Write-Info "Deleted fallback ad group" }
if ($createdAdAccountId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$createdAdAccountId" -Headers $h -Label "DeleteAdAccount"); Write-Info "Deleted ad account" }
if ($createdFanpageId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$createdFanpageId" -Headers $h -Label "DeleteFanpage"); Write-Info "Deleted fanpage" }
if ($createdProductAId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductAId" -Headers $h -Label "DeleteProductA"); Write-Info "Deleted product A" }
if ($createdProductBId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$createdProductBId" -Headers $h -Label "DeleteProductB"); Write-Info "Deleted product B" }
if ($createdCategoryOwned -and $createdCategoryId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdCategoryId" -Headers $h -Label "DeleteCategory"); Write-Info "Deleted fallback category" }

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
  Write-Host "  ALL PASSED - X-mode and emergency mode isolation look healthy." -ForegroundColor Green
} else {
  Write-Host "  TEST FAILED - review failures above." -ForegroundColor Red
}
Write-Host ""
