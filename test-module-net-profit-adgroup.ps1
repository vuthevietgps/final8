#!/usr/bin/env powershell
<#
  Net profit + ad-group aggregation integration test
  - Covers delivered + returned order
  - Verifies auto-sync when dependent costs change
  - Compatible with Windows PowerShell 5.1 (no ?? operator)
#>

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

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

function Get-ExpectedByTotals {
  param(
    [double]$TotalAd,
    [double]$TotalLabor,
    [double]$TotalOther
  )

  $adPerUnit = $TotalAd / $script:totalQty
  $laborPerUnit = $TotalLabor / $script:totalQty
  $otherPerUnit = $TotalOther / $script:totalQty

  $o1Ad = $adPerUnit * $script:o1Qty
  $o2Ad = $adPerUnit * $script:o2Qty
  $o1Labor = $laborPerUnit * $script:o1Qty
  $o2Labor = $laborPerUnit * $script:o2Qty
  $o1Other = $otherPerUnit * $script:o1Qty
  $o2Other = $otherPerUnit * $script:o2Qty

  $o1Net = $script:o1GrossProfit - $o1Ad - $o1Labor - $o1Other
  $o2Net = $script:o2GrossProfit - $o2Ad - $o2Labor - $o2Other

  return [pscustomobject]@{
    totalAd = $TotalAd
    totalLabor = $TotalLabor
    totalOther = $TotalOther
    o1Ad = $o1Ad
    o2Ad = $o2Ad
    o1Labor = $o1Labor
    o2Labor = $o2Labor
    o1Other = $o1Other
    o2Other = $o2Other
    o1Net = $o1Net
    o2Net = $o2Net
    totalNetProfit = ($o1Net + $o2Net)
  }
}

function Verify-OrdersWithExpected {
  param(
    [hashtable]$Headers,
    [string]$Order1Id,
    [string]$Order2Id,
    [object]$Expected,
    [string]$LabelPrefix
  )

  $o1 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$Order1Id" -Headers $Headers -Label "$LabelPrefix-GetO1"
  $o2 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$Order2Id" -Headers $Headers -Label "$LabelPrefix-GetO2"

  if (-not $o1 -or -not $o2) {
    Write-Fail "${LabelPrefix}: cannot load orders to verify"
    return
  }

  Assert-Approx -Actual (N0 $o1.grossProfit) -Expected $script:o1GrossProfit -Tolerance 5 -Label "$LabelPrefix O1 grossProfit"
  Assert-Approx -Actual (N0 $o2.grossProfit) -Expected $script:o2GrossProfit -Tolerance 5 -Label "$LabelPrefix O2 grossProfit (returned)"

  Assert-Approx -Actual (N0 $o1.advertisingCost) -Expected $Expected.o1Ad -Tolerance 10 -Label "$LabelPrefix O1 advertisingCost"
  Assert-Approx -Actual (N0 $o2.advertisingCost) -Expected $Expected.o2Ad -Tolerance 10 -Label "$LabelPrefix O2 advertisingCost"

  Assert-Approx -Actual (N0 $o1.laborCostAllocation) -Expected $Expected.o1Labor -Tolerance 10 -Label "$LabelPrefix O1 laborCost"
  Assert-Approx -Actual (N0 $o2.laborCostAllocation) -Expected $Expected.o2Labor -Tolerance 10 -Label "$LabelPrefix O2 laborCost"

  Assert-Approx -Actual (N0 $o1.otherCostAllocation) -Expected $Expected.o1Other -Tolerance 10 -Label "$LabelPrefix O1 otherCost"
  Assert-Approx -Actual (N0 $o2.otherCostAllocation) -Expected $Expected.o2Other -Tolerance 10 -Label "$LabelPrefix O2 otherCost"

  Assert-Approx -Actual (N0 $o1.netProfit) -Expected $Expected.o1Net -Tolerance 15 -Label "$LabelPrefix O1 netProfit"
  Assert-Approx -Actual (N0 $o2.netProfit) -Expected $Expected.o2Net -Tolerance 15 -Label "$LabelPrefix O2 netProfit"

  $totalAd = (N0 $o1.advertisingCost) + (N0 $o2.advertisingCost)
  $totalLabor = (N0 $o1.laborCostAllocation) + (N0 $o2.laborCostAllocation)
  $totalOther = (N0 $o1.otherCostAllocation) + (N0 $o2.otherCostAllocation)
  $totalNet = (N0 $o1.netProfit) + (N0 $o2.netProfit)

  Assert-Approx -Actual $totalAd -Expected $Expected.totalAd -Tolerance 10 -Label "$LabelPrefix total ad allocation"
  Assert-Approx -Actual $totalLabor -Expected $Expected.totalLabor -Tolerance 10 -Label "$LabelPrefix total labor allocation"
  Assert-Approx -Actual $totalOther -Expected $Expected.totalOther -Tolerance 10 -Label "$LabelPrefix total other allocation"
  Assert-Approx -Actual $totalNet -Expected $Expected.totalNetProfit -Tolerance 20 -Label "$LabelPrefix total net profit"

  if ((N0 $o2.netProfit) -lt 0) {
    Write-Pass "$LabelPrefix return order netProfit is negative"
  } else {
    Write-Fail "$LabelPrefix return order netProfit should be negative"
  }
}

# ===== TEST STATE =====
$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$testDate = "2000-06-15"
$testDateFull = "2000-06-15T00:00:00.000Z"

# Base data
$adCostAmount    = 120000
$laborCostAmount = 240000
$otherCostAmount = 120000

$o1Qty = 3
$o1Cod = 1500000
$o1SupplierQuote = 300000
$o1ShippingFee = 60000
$o1GrossProfit = $o1Cod - ($o1SupplierQuote * $o1Qty) - $o1ShippingFee   # 540,000

# Returned order: supplier returnable defaults true => supplier cost = 0 on return
$o2Qty = 1
$o2Cod = 500000
$o2SupplierQuote = 200000
$o2ShippingFee = 30000
$o2ReturnFee = 20000
$o2GrossProfit = 0 - 0 - $o2ShippingFee - $o2ReturnFee                    # -50,000

$script:o1Qty = $o1Qty
$script:o2Qty = $o2Qty
$script:totalQty = $o1Qty + $o2Qty
$script:o1GrossProfit = $o1GrossProfit
$script:o2GrossProfit = $o2GrossProfit

$expectedBase = Get-ExpectedByTotals -TotalAd $adCostAmount -TotalLabor $laborCostAmount -TotalOther $otherCostAmount

# IDs for cleanup
$createdTestUserId      = $null
$createdSalaryConfigId  = $null
$createdFanpageId       = $null
$createdProductCategoryId = $null
$createdAdAccountId     = $null
$createdAdGroupObjId    = $null
$createdAdGroupId       = $null
$createdAdCostId        = $null
$createdLaborCostId     = $null
$createdOtherCostId     = $null
$createdOrder1Id        = $null
$createdOrder2Id        = $null
$testAdGroupId          = "AGTEST-NP-$ts"

$currentUserId = $null
$agentUserId = $null
$h = @{}

Write-Section "INTEGRATION TEST: Net Profit + Return Order + Ad Group Sync - $ts"
Write-Info "Test date: $testDate"
Write-Info "Expected base total net profit (incl. return impact): $($expectedBase.totalNetProfit)"

try {
  # ===== PHASE 0 =====
  Write-Section "PHASE 0: Login"
  Write-Step "0.1" "Login Director"
  $lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
  if ($lr -and $lr.access_token) {
    $h = @{ Authorization = "Bearer $($lr.access_token)" }
    $currentUserId = [string]$lr.user.id
    Write-Pass "Login OK"
    Write-Info "Current user id: $currentUserId"
  } else {
    Write-Fail "Login failed"
    throw "Login failed"
  }

  # ===== PHASE 1 =====
  Write-Section "PHASE 1: Setup dependencies"

  Write-Step "1.1" "Create test agent user"
  $userBody = @{
    fullName = "Agent NP $ts"
    email    = "agent.np.$ts@test.com"
    password = "123456"
    phone    = "090000$($ts.Substring($ts.Length-4))"
    role     = "internal_agent"
    address  = "Test address"
    isActive = $true
  } | ConvertTo-Json
  $usr = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $userBody -Label "CreateUser"
  if ($usr -and $usr._id) {
    $createdTestUserId = [string]$usr._id
    $agentUserId = $createdTestUserId
    Write-Pass "Test user created: $agentUserId"
  } elseif ($currentUserId) {
    $agentUserId = $currentUserId
    Write-Info "Fallback to current user as agentId: $agentUserId"
  } else {
    Write-Fail "Cannot resolve agent user id"
    throw "No agent user"
  }

  Write-Step "1.2" "Upsert salary config (hourlyRate=$laborCostAmount)"
  $salaryBody = @{
    userId = $agentUserId
    hourlyRate = $laborCostAmount
    payrollCycle = "monthly"
    paymentDays = @(5)
  } | ConvertTo-Json
  $salary = Safe-Request -Method POST -Uri "$BaseUrl/salary-config" -Headers $h -Body $salaryBody -Label "UpsertSalary"
  if ($salary -and $salary._id) {
    $createdSalaryConfigId = [string]$salary._id
    Write-Pass "Salary config upserted: $createdSalaryConfigId"
  } else {
    Write-Fail "Salary config upsert failed"
  }

  Write-Step "1.3" "Create Fanpage"
  $fanpageBody = @{
    name = "Test Fanpage NP-$ts"
    pageId = "page_np_$ts"
    accessToken = "token_np_$ts"
    status = "active"
    description = "Integration test net profit"
  } | ConvertTo-Json
  $fp = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $fanpageBody -Label "CreateFanpage"
  if ($fp -and $fp._id) {
    $createdFanpageId = [string]$fp._id
    Write-Pass "Fanpage created: $createdFanpageId"
  } else {
    Write-Fail "Create fanpage failed"
    throw "No fanpage"
  }

  Write-Step "1.4" "Create Product Category"
  $pcBody = @{
    name = "Category NP-$ts"
    description = "Category for integration test"
    color = "#229954"
    isActive = $true
  } | ConvertTo-Json
  $pc = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $h -Body $pcBody -Label "CreateProductCategory"
  if ($pc -and $pc._id) {
    $createdProductCategoryId = [string]$pc._id
    Write-Pass "Product category created: $createdProductCategoryId"
  } else {
    Write-Fail "Create product category failed"
    throw "No product category"
  }

  Write-Step "1.5" "Create Ad Account"
  $adAccBody = @{
    name = "AdAccount NP-$ts"
    accountId = "acc_np_$ts"
    accountType = "facebook"
    isActive = $true
  } | ConvertTo-Json
  $aa = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $adAccBody -Label "CreateAdAccount"
  if ($aa -and $aa._id) {
    $createdAdAccountId = [string]$aa._id
    Write-Pass "Ad account created: $createdAdAccountId"
  } else {
    Write-Fail "Create ad account failed"
    throw "No ad account"
  }

  Write-Step "1.6" "Create Ad Group"
  $adGroupBody = @{
    name = "AdGroup NP-$ts"
    adGroupId = $testAdGroupId
    fanpageId = $createdFanpageId
    productCategoryId = $createdProductCategoryId
    agentId = $agentUserId
    adAccountId = $createdAdAccountId
    platform = "facebook"
    isActive = $true
    description = "Net profit integration test"
  } | ConvertTo-Json
  $ag = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $adGroupBody -Label "CreateAdGroup"
  if ($ag -and $ag._id) {
    $createdAdGroupObjId = [string]$ag._id
    $createdAdGroupId = [string]$ag.adGroupId
    Write-Pass "Ad group created: $createdAdGroupObjId (adGroupId=$createdAdGroupId)"
  } else {
    Write-Fail "Create ad group failed"
    throw "No ad group"
  }

  Write-Step "1.7" "Create Advertising Cost = $adCostAmount"
  $adCostBody = @{
    adGroupId = $createdAdGroupId
    date = $testDateFull
    spentAmount = $adCostAmount
    channel = "facebook"
  } | ConvertTo-Json
  $adCostRec = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $adCostBody -Label "CreateAdCost"
  if ($adCostRec -and $adCostRec._id) {
    $createdAdCostId = [string]$adCostRec._id
    Write-Pass "Advertising cost created: $createdAdCostId"
  } else {
    Write-Fail "Create advertising cost failed"
    throw "No ad cost"
  }

  Write-Step "1.8" "Create Labor Cost1 = $laborCostAmount (1 hour)"
  $laborBody = @{
    date = $testDateFull
    userId = $agentUserId
    startTime = "08:00"
    endTime = "09:00"
    notes = "Labor NP-$ts"
  } | ConvertTo-Json
  $laborRec = Safe-Request -Method POST -Uri "$BaseUrl/labor-cost1" -Headers $h -Body $laborBody -Label "CreateLaborCost"
  if ($laborRec -and $laborRec._id) {
    $createdLaborCostId = [string]$laborRec._id
    Write-Pass "Labor cost created: $createdLaborCostId (cost=$($laborRec.cost))"
    Assert-Approx -Actual (N0 $laborRec.cost) -Expected $laborCostAmount -Tolerance 2 -Label "Labor cost record amount"
  } else {
    Write-Fail "Create labor cost failed"
    throw "No labor cost"
  }

  Write-Step "1.9" "Create Other Cost = $otherCostAmount"
  $otherBody = @{
    date = $testDateFull
    dueDate = $testDateFull
    amount = $otherCostAmount
    category = "other"
    notes = "Other NP-$ts"
  } | ConvertTo-Json
  $otherRec = Safe-Request -Method POST -Uri "$BaseUrl/other-cost" -Headers $h -Body $otherBody -Label "CreateOtherCost"
  if ($otherRec -and $otherRec._id) {
    $createdOtherCostId = [string]$otherRec._id
    Write-Pass "Other cost created: $createdOtherCostId"
  } else {
    Write-Fail "Create other cost failed"
    throw "No other cost"
  }

  # ===== PHASE 2 =====
  Write-Section "PHASE 2: Create orders"

  Write-Step "2.1" "Create Order 1 (will be delivered)"
  $order1Body = @{
    customerName = "KH NP O1 $ts"
    quantity = $o1Qty
    adGroupId = $createdAdGroupId
    orderDate = $testDateFull
    codAmount = $o1Cod
    supplierQuote = $o1SupplierQuote
    shippingFee = $o1ShippingFee
    orderStatus = "Chua co ma van don"
  } | ConvertTo-Json
  $ord1 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $order1Body -Label "CreateOrder1"
  if ($ord1 -and $ord1._id) {
    $createdOrder1Id = [string]$ord1._id
    Write-Pass "Order 1 created: $createdOrder1Id"
  } else {
    Write-Fail "Create order 1 failed"
    throw "No order1"
  }

  Write-Step "2.2" "Create Order 2 (will be returned)"
  $order2Body = @{
    customerName = "KH NP O2 $ts"
    quantity = $o2Qty
    adGroupId = $createdAdGroupId
    orderDate = $testDateFull
    codAmount = $o2Cod
    supplierQuote = $o2SupplierQuote
    shippingFee = $o2ShippingFee
    returnFee = $o2ReturnFee
    orderStatus = "Chua co ma van don"
  } | ConvertTo-Json
  $ord2 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $h -Body $order2Body -Label "CreateOrder2"
  if ($ord2 -and $ord2._id) {
    $createdOrder2Id = [string]$ord2._id
    Write-Pass "Order 2 created: $createdOrder2Id"
  } else {
    Write-Fail "Create order 2 failed"
    throw "No order2"
  }

  # ===== PHASE 3 =====
  Write-Section "PHASE 3: Update statuses (Delivered + Returned)"

  Write-Step "3.1" "Order 1 -> Giao thanh cong"
  $upd1 = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$createdOrder1Id" -Headers $h -Body '{"orderStatus":"Giao thành công"}' -Label "UpdateOrder1Status"
  if ($upd1 -and $upd1._id) { Write-Pass "Order 1 status updated" } else { Write-Fail "Order 1 status update failed" }

  Write-Step "3.2" "Order 2 -> Hang hoan"
  $upd2 = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$createdOrder2Id" -Headers $h -Body '{"orderStatus":"Hàng hoàn"}' -Label "UpdateOrder2Status"
  if ($upd2 -and $upd2._id) { Write-Pass "Order 2 status updated" } else { Write-Fail "Order 2 status update failed" }

  Start-Sleep -Milliseconds 800

  Write-Step "3.3" "Verify gross profit after status update"
  $o1After = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$createdOrder1Id" -Headers $h -Label "GetOrder1AfterStatus"
  $o2After = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/$createdOrder2Id" -Headers $h -Label "GetOrder2AfterStatus"
  if ($o1After) {
    Assert-Approx -Actual (N0 $o1After.grossProfit) -Expected $o1GrossProfit -Tolerance 5 -Label "Order 1 grossProfit"
  }
  if ($o2After) {
    Assert-Approx -Actual (N0 $o2After.grossProfit) -Expected $o2GrossProfit -Tolerance 5 -Label "Order 2 grossProfit (returned)"
  }

  # ===== PHASE 4 =====
  Write-Section "PHASE 4: Recalculate profits (manual endpoint)"
  Write-Step "4.1" "Recalculate Order 1"
  $r1 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$createdOrder1Id/recalculate-profits" -Headers $h -Body "{}" -Label "RecalcOrder1"
  if ($r1) { Write-Pass "Order 1 recalc OK" } else { Write-Fail "Order 1 recalc failed" }

  Write-Step "4.2" "Recalculate Order 2"
  $r2 = Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$createdOrder2Id/recalculate-profits" -Headers $h -Body "{}" -Label "RecalcOrder2"
  if ($r2) { Write-Pass "Order 2 recalc OK" } else { Write-Fail "Order 2 recalc failed" }

  Start-Sleep -Milliseconds 800

  # ===== PHASE 5 =====
  Write-Section "PHASE 5: Verify per-order net profit formula"
  Verify-OrdersWithExpected -Headers $h -Order1Id $createdOrder1Id -Order2Id $createdOrder2Id -Expected $expectedBase -LabelPrefix "Base"

  # ===== PHASE 6 =====
  Write-Section "PHASE 6: Verify Ad Group performance aggregation"
  $perfUrl = "$BaseUrl/ad-group-profit-report/performance?adGroupIds=$createdAdGroupId&startDate=2000-06-01&endDate=2000-06-30"
  $perf = Safe-Request -Method GET -Uri $perfUrl -Headers $h -Label "AdGroupPerformance"
  if ($perf -ne $null) {
    $items = if ($perf -is [array]) { $perf } elseif ($perf.data) { $perf.data } else { @($perf) }
    $myGroup = $items | Where-Object { $_.adGroupId -eq $createdAdGroupId } | Select-Object -First 1
    if ($myGroup) {
      Write-Pass "Ad group found in performance report"
      Assert-Approx -Actual (N0 $myGroup.totalOrders) -Expected 2 -Tolerance 0 -Label "AdGroup totalOrders"
      Assert-Approx -Actual (N0 $myGroup.returnOrders) -Expected 1 -Tolerance 0 -Label "AdGroup returnOrders"
      Assert-Approx -Actual (N0 $myGroup.totalNetProfit) -Expected $expectedBase.totalNetProfit -Tolerance 25 -Label "AdGroup totalNetProfit includes return impact"
      if ((N0 $myGroup.totalAdsSpent) -gt 0) {
        $roi = ((N0 $myGroup.totalNetProfit) / (N0 $myGroup.totalAdsSpent)) * 100
        Assert-Approx -Actual (N0 $myGroup.roi) -Expected $roi -Tolerance 5 -Label "AdGroup ROI"
      }
    } else {
      Write-Fail "Ad group not found in performance report"
    }
  } else {
    Write-Fail "Performance report failed"
  }

  $summary = Safe-Request -Method GET -Uri "$BaseUrl/ad-group-profit-report/summary?startDate=2000-06-01&endDate=2000-06-30" -Headers $h -Label "ProfitSummary"
  if ($summary -ne $null) {
    Write-Pass "Profit summary OK"
  } else {
    Write-Fail "Profit summary failed"
  }

  # ===== PHASE 7 =====
  Write-Section "PHASE 7: Verify daily/product reports"

  $daily = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/daily-profit-report?date=$testDate" -Headers $h -Label "DailyProfit"
  if ($daily -ne $null) {
    Write-Pass "Daily profit report OK"
    $est = if ($daily.estimated) { $daily.estimated } else { $daily.estimatedStats }
    if ($est) {
      Assert-Approx -Actual (N0 $est.totalOrders) -Expected 2 -Tolerance 0 -Label "Daily estimated totalOrders"
      Assert-Approx -Actual (N0 $est.totalNetProfit) -Expected $expectedBase.totalNetProfit -Tolerance 25 -Label "Daily estimated totalNetProfit"
      Assert-Approx -Actual (N0 $est.totalGrossProfit) -Expected ($o1GrossProfit + $o2GrossProfit) -Tolerance 10 -Label "Daily estimated totalGrossProfit"
    } else {
      Write-Fail "Daily report missing estimated/estimatedStats"
    }
  } else {
    Write-Fail "Daily profit report failed"
  }

  $prod = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/product-profit-report?from=$testDate&to=$testDate" -Headers $h -Label "ProductProfit"
  if ($prod -ne $null) {
    Write-Pass "Product profit report OK"
    if ($prod.totals) {
      Assert-Approx -Actual (N0 $prod.totals.netProfit) -Expected $expectedBase.totalNetProfit -Tolerance 25 -Label "Product report totals.netProfit"
    }
  } else {
    Write-Fail "Product profit report failed"
  }

  # ===== PHASE 8 =====
  Write-Section "PHASE 8: Verify auto-sync when dependent costs change"

  Write-Step "8.1" "Update advertising cost: 120000 -> 160000"
  $newAdTotal = 160000
  $adPatch = @{ spentAmount = $newAdTotal } | ConvertTo-Json
  $adUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/advertising-cost/$createdAdCostId" -Headers $h -Body $adPatch -Label "UpdateAdCost"
  if ($adUpd) { Write-Pass "Advertising cost updated" } else { Write-Fail "Advertising cost update failed" }
  Start-Sleep -Milliseconds 800
  $expAfterAd = Get-ExpectedByTotals -TotalAd $newAdTotal -TotalLabor $laborCostAmount -TotalOther $otherCostAmount
  Verify-OrdersWithExpected -Headers $h -Order1Id $createdOrder1Id -Order2Id $createdOrder2Id -Expected $expAfterAd -LabelPrefix "AfterAdUpdate"

  Write-Step "8.2" "Update labor cost: 1h -> 2h (cost 240000 -> 480000)"
  $newLaborTotal = 480000
  $laborPatch = @{ startTime = "08:00"; endTime = "10:00" } | ConvertTo-Json
  $laborUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/labor-cost1/$createdLaborCostId" -Headers $h -Body $laborPatch -Label "UpdateLaborCost"
  if ($laborUpd) { Write-Pass "Labor cost updated" } else { Write-Fail "Labor cost update failed" }
  Start-Sleep -Milliseconds 800
  $expAfterLabor = Get-ExpectedByTotals -TotalAd $newAdTotal -TotalLabor $newLaborTotal -TotalOther $otherCostAmount
  Verify-OrdersWithExpected -Headers $h -Order1Id $createdOrder1Id -Order2Id $createdOrder2Id -Expected $expAfterLabor -LabelPrefix "AfterLaborUpdate"

  Write-Step "8.3" "Update other cost: 120000 -> 200000"
  $newOtherTotal = 200000
  $otherPatch = @{ amount = $newOtherTotal } | ConvertTo-Json
  $otherUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/other-cost/$createdOtherCostId" -Headers $h -Body $otherPatch -Label "UpdateOtherCost"
  if ($otherUpd) { Write-Pass "Other cost updated" } else { Write-Fail "Other cost update failed" }
  Start-Sleep -Milliseconds 800
  $expAfterOther = Get-ExpectedByTotals -TotalAd $newAdTotal -TotalLabor $newLaborTotal -TotalOther $newOtherTotal
  Verify-OrdersWithExpected -Headers $h -Order1Id $createdOrder1Id -Order2Id $createdOrder2Id -Expected $expAfterOther -LabelPrefix "AfterOtherUpdate"

  Write-Step "8.4" "Delete other cost (total other -> 0)"
  $otherDel = Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$createdOtherCostId" -Headers $h -Label "DeleteOtherCostSync"
  Write-Pass "Other cost delete request sent"
  $createdOtherCostId = $null
  Start-Sleep -Milliseconds 800
  $expAfterOtherDelete = Get-ExpectedByTotals -TotalAd $newAdTotal -TotalLabor $newLaborTotal -TotalOther 0
  Verify-OrdersWithExpected -Headers $h -Order1Id $createdOrder1Id -Order2Id $createdOrder2Id -Expected $expAfterOtherDelete -LabelPrefix "AfterOtherDelete"

  Write-Step "8.5" "Re-check ad-group performance after dependency changes"
  $perf2 = Safe-Request -Method GET -Uri $perfUrl -Headers $h -Label "AdGroupPerformanceAfterChanges"
  if ($perf2 -ne $null) {
    $items2 = if ($perf2 -is [array]) { $perf2 } elseif ($perf2.data) { $perf2.data } else { @($perf2) }
    $myGroup2 = $items2 | Where-Object { $_.adGroupId -eq $createdAdGroupId } | Select-Object -First 1
    if ($myGroup2) {
      Assert-Approx -Actual (N0 $myGroup2.totalNetProfit) -Expected $expAfterOtherDelete.totalNetProfit -Tolerance 25 -Label "AdGroup totalNetProfit updated after dependent changes"
    } else {
      Write-Fail "Ad group not found in final performance check"
    }
  } else {
    Write-Fail "Final performance check failed"
  }

  Write-Step "8.6" "Re-check daily report after dependency changes"
  $daily2 = Safe-Request -Method GET -Uri "$BaseUrl/test-order2/daily-profit-report?date=$testDate" -Headers $h -Label "DailyProfitAfterChanges"
  if ($daily2 -ne $null) {
    $est2 = if ($daily2.estimated) { $daily2.estimated } else { $daily2.estimatedStats }
    if ($est2) {
      Assert-Approx -Actual (N0 $est2.totalNetProfit) -Expected $expAfterOtherDelete.totalNetProfit -Tolerance 25 -Label "Daily netProfit updated after dependent changes"
    } else {
      Write-Fail "Final daily report missing estimated fields"
    }
  } else {
    Write-Fail "Final daily report failed"
  }

  # ===== PHASE 9 =====
  Write-Section "PHASE 9: Cleanup"

  Write-Step "9.1" "Delete orders"
  if ($createdOrder2Id) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$createdOrder2Id" -Headers $h -Label "DeleteOrder2") ; Write-Pass "Delete order 2 requested" }
  if ($createdOrder1Id) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$createdOrder1Id" -Headers $h -Label "DeleteOrder1") ; Write-Pass "Delete order 1 requested" }

  Write-Step "9.2" "Delete costs"
  if ($createdAdCostId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$createdAdCostId" -Headers $h -Label "DeleteAdCost") ; Write-Pass "Delete ad cost requested" }
  if ($createdLaborCostId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/labor-cost1/$createdLaborCostId" -Headers $h -Label "DeleteLaborCost") ; Write-Pass "Delete labor cost requested" }
  if ($createdOtherCostId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/other-cost/$createdOtherCostId" -Headers $h -Label "DeleteOtherCost") ; Write-Pass "Delete other cost requested" }

  Write-Step "9.3" "Delete ad entities"
  if ($createdAdGroupObjId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$createdAdGroupObjId" -Headers $h -Label "DeleteAdGroup") ; Write-Pass "Delete ad group requested" }
  if ($createdAdAccountId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$createdAdAccountId" -Headers $h -Label "DeleteAdAccount") ; Write-Pass "Delete ad account requested" }
  if ($createdProductCategoryId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdProductCategoryId" -Headers $h -Label "DeleteProductCategory") ; Write-Pass "Delete product category requested" }
  if ($createdFanpageId) { [void](Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$createdFanpageId" -Headers $h -Label "DeleteFanpage") ; Write-Pass "Delete fanpage requested" }

  Write-Step "9.4" "Delete salary config + test user"
  if ($createdSalaryConfigId -and $createdTestUserId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/salary-config/$createdSalaryConfigId" -Headers $h -Label "DeleteSalaryConfig")
    Write-Pass "Delete salary config requested"
  }
  if ($createdTestUserId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/users/$createdTestUserId" -Headers $h -Label "DeleteTestUser")
    Write-Pass "Delete test user requested"
  }

} catch {
  Write-Fail "Exception in test: $_"
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
  Write-Host "  ALL PASSED - Net profit and dependency sync logic are working." -ForegroundColor Green
} else {
  Write-Host "  TEST FAILED - Review failures above." -ForegroundColor Red
}
Write-Host ""
