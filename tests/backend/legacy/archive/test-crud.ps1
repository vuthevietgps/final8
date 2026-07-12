# Test CRUD Operations
# Chạy: .\test-crud.ps1

$baseUrl = "http://localhost:3000/api"

# Login
Write-Host "=== LOGIN ===" -ForegroundColor Cyan
$loginBody = '{"email":"director@test.com","password":"123456"}'
$login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $login.access_token
$headers = @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" }
Write-Host "Token obtained" -ForegroundColor Green

# ===== TEST 1: Products CRUD =====
Write-Host "`n=== TEST 1: PRODUCTS CRUD ===" -ForegroundColor Cyan

# Get first category for product
$categories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Method Get -Headers $headers
$categoryId = $categories[0]._id

$productData = @{
    name = "Test Product " + (Get-Date -Format "HHmmss")
    categoryId = $categoryId
    isActive = $true
} | ConvertTo-Json

try {
    $newProduct = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $productData
    Write-Host "✅ CREATE Product: $($newProduct.name)" -ForegroundColor Green
    $productId = $newProduct._id
    
    # Read Product
    $product = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Get -Headers $headers
    Write-Host "✅ READ Product: $($product.name)" -ForegroundColor Green
    
    # Update Product
    $updateData = @{ name = $product.name + " (Updated)" } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Patch -Headers $headers -Body $updateData
    Write-Host "✅ UPDATE Product: $($updated.name)" -ForegroundColor Green
    
    # Delete Product
    Invoke-RestMethod -Uri "$baseUrl/products/$productId" -Method Delete -Headers $headers
    Write-Host "✅ DELETE Product: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Products CRUD Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ===== TEST 2: Order Status CRUD =====
Write-Host "`n=== TEST 2: ORDER STATUS CRUD ===" -ForegroundColor Cyan

$statusData = @{
    name = "Test Status " + (Get-Date -Format "HHmmss")
    description = "Test status for API testing"
    color = "#3498db"
    order = 99
    isActive = $true
} | ConvertTo-Json

try {
    $newStatus = Invoke-RestMethod -Uri "$baseUrl/order-status" -Method Post -Headers $headers -Body $statusData
    Write-Host "✅ CREATE Order Status: $($newStatus.name)" -ForegroundColor Green
    $statusId = $newStatus._id
    
    # Read
    $status = Invoke-RestMethod -Uri "$baseUrl/order-status/$statusId" -Method Get -Headers $headers
    Write-Host "✅ READ Order Status: $($status.name)" -ForegroundColor Green
    
    # Update
    $updateData = @{ description = "Updated description" } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$baseUrl/order-status/$statusId" -Method Patch -Headers $headers -Body $updateData
    Write-Host "✅ UPDATE Order Status: OK" -ForegroundColor Green
    
    # Delete
    Invoke-RestMethod -Uri "$baseUrl/order-status/$statusId" -Method Delete -Headers $headers
    Write-Host "✅ DELETE Order Status: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Order Status CRUD Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ===== TEST 3: Finance - Funding Source =====
Write-Host "`n=== TEST 3: FUNDING SOURCE CRUD ===" -ForegroundColor Cyan

$fundingData = @{
    name = "Test Fund " + (Get-Date -Format "HHmmss")
    type = "cash"
    initialBalance = 1000000
    currentBalance = 1000000
    isActive = $true
} | ConvertTo-Json

try {
    $newFund = Invoke-RestMethod -Uri "$baseUrl/finance/funding-sources" -Method Post -Headers $headers -Body $fundingData
    Write-Host "✅ CREATE Funding Source: $($newFund.name)" -ForegroundColor Green
    $fundId = $newFund._id
    
    # Update
    $updateData = @{ currentBalance = 1500000 } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$baseUrl/finance/funding-sources/$fundId" -Method Patch -Headers $headers -Body $updateData
    Write-Host "✅ UPDATE Funding Source: balance = $($updated.currentBalance)" -ForegroundColor Green
} catch {
    Write-Host "❌ Funding Source Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ===== TEST 4: Ad Account CRUD =====
Write-Host "`n=== TEST 4: AD ACCOUNT CRUD ===" -ForegroundColor Cyan

$adAccountData = @{
    name = "Test Ad Account " + (Get-Date -Format "HHmmss")
    platform = "facebook"
    accountId = "act_" + (Get-Date -Format "yyyyMMddHHmmss")
    isActive = $true
} | ConvertTo-Json

try {
    $newAdAccount = Invoke-RestMethod -Uri "$baseUrl/ad-accounts" -Method Post -Headers $headers -Body $adAccountData
    Write-Host "✅ CREATE Ad Account: $($newAdAccount.name)" -ForegroundColor Green
    $adAccountId = $newAdAccount._id
    
    # Read
    $adAccount = Invoke-RestMethod -Uri "$baseUrl/ad-accounts/$adAccountId" -Method Get -Headers $headers
    Write-Host "✅ READ Ad Account: $($adAccount.name)" -ForegroundColor Green
    
    # Delete
    Invoke-RestMethod -Uri "$baseUrl/ad-accounts/$adAccountId" -Method Delete -Headers $headers
    Write-Host "✅ DELETE Ad Account: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Ad Account Error: $($_.Exception.Message)" -ForegroundColor Red
}

# ===== TEST 5: Capital Allocation Policy =====
Write-Host "`n=== TEST 5: CAPITAL POLICY CRUD ===" -ForegroundColor Cyan

$policyData = @{
    name = "Test Policy " + (Get-Date -Format "HHmmss")
    reinvestmentRate = 0.3
    reserveRate = 0.2
    profitWithdrawalRate = 0.5
    isActive = $true
} | ConvertTo-Json

try {
    $newPolicy = Invoke-RestMethod -Uri "$baseUrl/capital-allocation/policies" -Method Post -Headers $headers -Body $policyData
    Write-Host "✅ CREATE Capital Policy: $($newPolicy.name)" -ForegroundColor Green
    $policyId = $newPolicy._id
    
    # Update
    $updateData = @{ reinvestmentRate = 0.4 } | ConvertTo-Json
    $updated = Invoke-RestMethod -Uri "$baseUrl/capital-allocation/policies/$policyId" -Method Patch -Headers $headers -Body $updateData
    Write-Host "✅ UPDATE Capital Policy: reinvestmentRate = $($updated.reinvestmentRate)" -ForegroundColor Green
    
    # Delete
    Invoke-RestMethod -Uri "$baseUrl/capital-allocation/policies/$policyId" -Method Delete -Headers $headers
    Write-Host "✅ DELETE Capital Policy: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Capital Policy Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== CRUD TESTS COMPLETE ===" -ForegroundColor Cyan
