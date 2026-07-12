#!/usr/bin/env powershell
<#
  Integration test for return rate by product:
  - only finalized orders count in the denominator
  - returned orders count in the numerator
  - non-final orders must not dilute return rate
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
  Write-Host ("=" * 90) -ForegroundColor Cyan
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host ("=" * 90) -ForegroundColor Cyan
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

function Assert-Equal {
  param(
    $Actual,
    $Expected,
    [string]$Label = ""
  )
  if ($Actual -eq $Expected) {
    Write-Pass "$Label (actual=$Actual, expected=$Expected)"
    return $true
  }
  Write-Fail "$Label (actual=$Actual, expected=$Expected)"
  return $false
}

function Assert-Approx {
  param(
    [double]$Actual,
    [double]$Expected,
    [double]$Tolerance = 0.001,
    [string]$Label = ""
  )
  $diff = [Math]::Abs($Actual - $Expected)
  if ($diff -le $Tolerance) {
    Write-Pass "$Label (actual=$Actual, expected=$Expected, diff=$diff)"
    return $true
  }
  Write-Fail "$Label (actual=$Actual, expected=$Expected, diff=$diff, tolerance=$Tolerance)"
  return $false
}

function New-Order {
  param(
    [string]$ProductId,
    [string]$CustomerName,
    [string]$OrderDateIso,
    [string]$OrderStatus,
    [hashtable]$Headers
  )

  $body = @{
    customerName = $CustomerName
    quantity = 1
    productId = $ProductId
    orderDate = $OrderDateIso
    codAmount = 350000
    supplierAppliedPrice = 120000
    supplierQuote = 120000
    shippingFee = 30000
  } | ConvertTo-Json -Compress

  $order = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $Headers -Body $body -Label "CreateOrder-$CustomerName"
  if (-not ($order -and $order._id)) {
    Write-Fail "Create order failed: $CustomerName"
    return $null
  }

  $patchBody = @{ orderStatus = $OrderStatus } | ConvertTo-Json -Compress
  [void](Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$($order._id)" -Headers $Headers -Body $patchBody -Label "PatchOrder-$CustomerName")
  [void](Safe-Request -Method POST -Uri "$BaseUrl/test-order2/$($order._id)/recalculate-profits" -Headers $Headers -Body "{}" -Label "Recalculate-$CustomerName")
  Start-Sleep -Milliseconds 200
  return $order
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$headers = @{}
$createdCategoryId = $null
$createdProductIds = @()
$createdOrderIds = @()
$deliveredStatus = $null
$returnedStatus = $null
$shippingStatus = $null
$testDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$testDateIso = "$testDate" + "T00:00:00.000Z"
$fromDate = (Get-Date).AddDays(-3).ToString("yyyy-MM-dd")
$toDate = (Get-Date).ToString("yyyy-MM-dd")

Write-Section "RETURN REPORT BY PRODUCT - $ts"

try {
  Write-Step "0.1" "Login director"
  $login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
  if ($login -and $login.access_token) {
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    Write-Pass "Login OK"
  } else {
    throw "Login failed"
  }

  Write-Step "0.2" "Resolve canonical statuses"
  $statuses = @(Safe-Request -Method GET -Uri "$BaseUrl/delivery-status" -Headers $headers -Label "GetDeliveryStatuses")
  $delivered = $statuses | Where-Object { $_ -and $_.isFinal -eq $true -and $_.isReturnStatus -ne $true } | Select-Object -First 1
  $returned = $statuses | Where-Object { $_ -and $_.isReturnStatus -eq $true } | Select-Object -First 1
  $shipping = $statuses | Where-Object { $_ -and $_.isFinal -ne $true -and (($_.estimatedDays -as [int]) -gt 0) } | Select-Object -First 1
  if (-not $shipping) {
    $shipping = $statuses | Where-Object { $_ -and $_.isFinal -ne $true } | Select-Object -First 1
  }

  if (-not ($delivered -and $delivered.name -and $returned -and $returned.name -and $shipping -and $shipping.name)) {
    throw "Cannot resolve canonical delivery statuses"
  }

  $deliveredStatus = [string]$delivered.name
  $returnedStatus = [string]$returned.name
  $shippingStatus = [string]$shipping.name
  Write-Pass "Delivered status: $deliveredStatus"
  Write-Pass "Returned status: $returnedStatus"
  Write-Pass "Non-final status: $shippingStatus"

  Write-Step "1.1" "Create product category"
  $categoryBody = @{
    name = "Return Product Category $ts"
    description = "Return report integration test"
    color = "#0F766E"
    isActive = $true
  } | ConvertTo-Json -Compress
  $category = Safe-Request -Method POST -Uri "$BaseUrl/product-category" -Headers $headers -Body $categoryBody -Label "CreateCategory"
  if (-not ($category -and $category._id)) {
    throw "Create category failed"
  }
  $createdCategoryId = [string]$category._id
  Write-Pass "Category created: $createdCategoryId"

  Write-Step "1.2" "Create products"
  $productBodies = @(
    @{ name = "Return Product A $ts"; categoryId = $createdCategoryId; importPrice = 0; shippingCost = 0; packagingCost = 0 },
    @{ name = "Return Product B $ts"; categoryId = $createdCategoryId; importPrice = 0; shippingCost = 0; packagingCost = 0 }
  )

  $products = @()
  foreach ($bodyObj in $productBodies) {
    $product = Safe-Request -Method POST -Uri "$BaseUrl/products" -Headers $headers -Body ($bodyObj | ConvertTo-Json -Compress) -Label "CreateProduct-$($bodyObj.name)"
    if (-not ($product -and $product._id)) {
      throw "Create product failed: $($bodyObj.name)"
    }
    $products += $product
    $createdProductIds += [string]$product._id
    Write-Pass "Product created: $($product.name)"
  }

  $productA = $products[0]
  $productB = $products[1]

  Write-Step "2.1" "Create finalized and non-final orders"
  $orders = @(
    (New-Order -ProductId ([string]$productA._id) -CustomerName "Product A Delivered $ts" -OrderDateIso $testDateIso -OrderStatus $deliveredStatus -Headers $headers),
    (New-Order -ProductId ([string]$productA._id) -CustomerName "Product A Returned $ts" -OrderDateIso $testDateIso -OrderStatus $returnedStatus -Headers $headers),
    (New-Order -ProductId ([string]$productA._id) -CustomerName "Product A Shipping $ts" -OrderDateIso $testDateIso -OrderStatus $shippingStatus -Headers $headers),
    (New-Order -ProductId ([string]$productB._id) -CustomerName "Product B Returned $ts" -OrderDateIso $testDateIso -OrderStatus $returnedStatus -Headers $headers),
    (New-Order -ProductId ([string]$productB._id) -CustomerName "Product B Delivered $ts" -OrderDateIso $testDateIso -OrderStatus $deliveredStatus -Headers $headers)
  )

  foreach ($order in $orders) {
    if (-not ($order -and $order._id)) {
      throw "Order creation failed"
    }
    $createdOrderIds += [string]$order._id
  }
  Write-Pass "Created $($createdOrderIds.Count) orders"

  Write-Step "3.1" "Query return report by product"
  $report = @(Safe-Request -Method GET -Uri "$BaseUrl/return-report/product?fromDate=$fromDate&toDate=$toDate" -Headers $headers -Label "GetReturnReportProduct")
  if (-not $report) {
    throw "Return report by product failed"
  }

  $rowA = $report | Where-Object { [string]$_.key -eq [string]$productA._id } | Select-Object -First 1
  $rowB = $report | Where-Object { [string]$_.key -eq [string]$productB._id } | Select-Object -First 1

  if (-not $rowA) { throw "Product A row missing" }
  if (-not $rowB) { throw "Product B row missing" }

  [void](Assert-Equal -Actual ([string]$rowA.name) -Expected ([string]$productA.name) -Label "Product A name lookup")
  [void](Assert-Equal -Actual ([int](N0 $rowA.totalOrders)) -Expected 2 -Label "Product A finalized order count")
  [void](Assert-Equal -Actual ([int](N0 $rowA.returnOrders)) -Expected 1 -Label "Product A return order count")
  [void](Assert-Approx -Actual (N0 $rowA.returnRate) -Expected 0.5 -Tolerance 0.0001 -Label "Product A return rate")

  [void](Assert-Equal -Actual ([string]$rowB.name) -Expected ([string]$productB.name) -Label "Product B name lookup")
  [void](Assert-Equal -Actual ([int](N0 $rowB.totalOrders)) -Expected 2 -Label "Product B finalized order count")
  [void](Assert-Equal -Actual ([int](N0 $rowB.returnOrders)) -Expected 1 -Label "Product B return order count")
  [void](Assert-Approx -Actual (N0 $rowB.returnRate) -Expected 0.5 -Tolerance 0.0001 -Label "Product B return rate")

  Write-Step "3.2" "Query filtered report for product A"
  $filtered = @(Safe-Request -Method GET -Uri "$BaseUrl/return-report/product?fromDate=$fromDate&toDate=$toDate&productId=$($productA._id)" -Headers $headers -Label "GetReturnReportProductFiltered")
  if (-not $filtered) {
    throw "Filtered return report failed"
  }

  [void](Assert-Equal -Actual $filtered.Count -Expected 1 -Label "Filtered product report row count")
  [void](Assert-Equal -Actual ([string]$filtered[0].key) -Expected ([string]$productA._id) -Label "Filtered product report key")
  [void](Assert-Equal -Actual ([int](N0 $filtered[0].totalOrders)) -Expected 2 -Label "Filtered product A finalized order count")
  [void](Assert-Approx -Actual (N0 $filtered[0].returnRate) -Expected 0.5 -Tolerance 0.0001 -Label "Filtered product A return rate")
}
catch {
  Write-Fail $_.Exception.Message
}
finally {
  Write-Section "CLEANUP"
  foreach ($orderId in $createdOrderIds) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/test-order2/$orderId" -Headers $headers -Label "DeleteOrder-$orderId")
    Write-Info "Deleted order: $orderId"
  }

  foreach ($productId in $createdProductIds) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/products/$productId" -Headers $headers -Label "DeleteProduct-$productId")
    Write-Info "Deleted product: $productId"
  }

  if ($createdCategoryId) {
    [void](Safe-Request -Method DELETE -Uri "$BaseUrl/product-category/$createdCategoryId" -Headers $headers -Label "DeleteCategory-$createdCategoryId")
    Write-Info "Deleted product category: $createdCategoryId"
  }
}

Write-Section "FINAL SUMMARY"
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "FAIL: $($script:failCount)" -ForegroundColor Red
if ($script:failCount -gt 0) {
  Write-Host ""
  Write-Host "Failure details:" -ForegroundColor Red
  $script:failDetails | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

exit 0
