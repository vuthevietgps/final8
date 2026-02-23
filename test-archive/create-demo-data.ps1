# =============================================
# CREATE DEMO DATA - Tao du lieu demo chuan
# =============================================

$baseUrl = "http://localhost:3000/api"
$token = $null

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Success($text) {
    Write-Host "  [OK] $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "  [FAIL] $text" -ForegroundColor Red
}

function Write-Info($text) {
    Write-Host "  [INFO] $text" -ForegroundColor Gray
}

# =============================================
# DANG NHAP
# =============================================
Write-Header "DANG NHAP HE THONG"

$loginBody = @{
    email = "director@test.com"
    password = "123456"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    Write-Success "Dang nhap thanh cong!"
} catch {
    Write-Fail "Khong the dang nhap: $_"
    exit
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# =============================================
# 1. TAO NHOM SAN PHAM CHUAN
# =============================================
Write-Header "1. TAO NHOM SAN PHAM CHUAN"

$categories = @(
    @{
        name = "Dien tu"
        code = "ELECTRONICS"
        description = "Dien thoai, may tinh, thiet bi dien tu"
        icon = "phone"
        color = "#3B82F6"
        order = 1
        isActive = $true
    },
    @{
        name = "Thoi trang"
        code = "FASHION"
        description = "Quan ao, giay dep, phu kien"
        icon = "shirt"
        color = "#EC4899"
        order = 2
        isActive = $true
    },
    @{
        name = "Gia dung"
        code = "HOME"
        description = "Do gia dung, nha bep, noi that"
        icon = "home"
        color = "#10B981"
        order = 3
        isActive = $true
    },
    @{
        name = "Sach"
        code = "BOOKS"
        description = "Sach, van phong pham"
        icon = "book"
        color = "#F59E0B"
        order = 4
        isActive = $true
    },
    @{
        name = "The thao"
        code = "SPORTS"
        description = "Dung cu the thao, do tap"
        icon = "ball"
        color = "#8B5CF6"
        order = 5
        isActive = $true
    }
)

$categoryMap = @{}

# Lay danh sach category hien tai truoc
$existingCats = Invoke-RestMethod -Uri "$baseUrl/product-category" -Method Get -Headers $headers
foreach ($c in $existingCats) {
    if ($c.code) {
        $categoryMap[$c.code] = $c._id
        Write-Info "Nhom da ton tai: $($c.name) [$($c.code)]"
    }
}

foreach ($cat in $categories) {
    if ($categoryMap[$cat.code]) {
        # Da ton tai, bo qua
        continue
    }
    try {
        $body = $cat | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$baseUrl/product-category" -Method Post -Headers $headers -Body $body
        Write-Success "Da tao nhom: $($cat.name) (ID: $($result._id))"
        $categoryMap[$cat.code] = $result._id
    } catch {
        Write-Fail "Loi tao nhom $($cat.name): $_"
    }
}

Write-Info "Tong so nhom san pham: $($categoryMap.Count)"

# =============================================
# 2. TAO SAN PHAM DEMO
# =============================================
Write-Header "2. TAO SAN PHAM DEMO"

$suppliers = Invoke-RestMethod -Uri "$baseUrl/users?type=internal_supplier" -Method Get -Headers $headers
$supplierId = if ($suppliers.data) { $suppliers.data[0]._id } else { $null }

$products = @(
    @{
        name = "iPhone 16 Pro Max"
        categoryId = $categoryMap["ELECTRONICS"]
        importPrice = 28000000
        shippingCost = 50000
        packagingCost = 30000
        notes = "Flagship Apple 2026"
    },
    @{
        name = "Samsung Galaxy S25 Ultra"
        categoryId = $categoryMap["ELECTRONICS"]
        importPrice = 25000000
        shippingCost = 50000
        packagingCost = 30000
        notes = "Flagship Samsung 2026"
    },
    @{
        name = "MacBook Air M4"
        categoryId = $categoryMap["ELECTRONICS"]
        importPrice = 32000000
        shippingCost = 100000
        packagingCost = 50000
        notes = "Laptop Apple chip M4"
    },
    @{
        name = "Ao thun Polo nam"
        categoryId = $categoryMap["FASHION"]
        importPrice = 180000
        shippingCost = 25000
        packagingCost = 10000
        notes = "Cotton 100 phan tram, form regular"
    },
    @{
        name = "Quan jeans slim fit"
        categoryId = $categoryMap["FASHION"]
        importPrice = 350000
        shippingCost = 30000
        packagingCost = 15000
        notes = "Denim cao cap, co gian"
    },
    @{
        name = "Giay the thao Nike Air"
        categoryId = $categoryMap["FASHION"]
        importPrice = 1800000
        shippingCost = 40000
        packagingCost = 20000
        notes = "Nike Air Max 2026"
    },
    @{
        name = "Noi chien khong dau Philips"
        categoryId = $categoryMap["HOME"]
        importPrice = 2500000
        shippingCost = 80000
        packagingCost = 50000
        notes = "Dung tich 6L, cong nghe Rapid Air"
    },
    @{
        name = "May loc khong khi Xiaomi"
        categoryId = $categoryMap["HOME"]
        importPrice = 3200000
        shippingCost = 100000
        packagingCost = 60000
        notes = "Loc HEPA, dien tich 48m2"
    },
    @{
        name = "Sach Dac Nhan Tam"
        categoryId = $categoryMap["BOOKS"]
        importPrice = 85000
        shippingCost = 15000
        packagingCost = 5000
        notes = "Dale Carnegie - Ban dich tieng Viet"
    },
    @{
        name = "Sach Clean Code"
        categoryId = $categoryMap["BOOKS"]
        importPrice = 450000
        shippingCost = 20000
        packagingCost = 10000
        notes = "Robert C. Martin - Tieng Anh"
    },
    @{
        name = "Vot cau long Yonex"
        categoryId = $categoryMap["SPORTS"]
        importPrice = 1200000
        shippingCost = 35000
        packagingCost = 20000
        notes = "Yonex Astrox 88D Pro"
    },
    @{
        name = "Bong da Adidas"
        categoryId = $categoryMap["SPORTS"]
        importPrice = 800000
        shippingCost = 30000
        packagingCost = 15000
        notes = "Adidas UCL Pro 2026"
    }
)

$createdProducts = @()

foreach ($prod in $products) {
    if (-not $prod.categoryId) {
        Write-Info "Bo qua $($prod.name) - khong co categoryId"
        continue
    }
    try {
        $body = $prod | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$baseUrl/products" -Method Post -Headers $headers -Body $body
        Write-Success "Da tao: $($prod.name) - Gia nhap: $($prod.importPrice.ToString('N0')) VND"
        $createdProducts += $result
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -like "*duplicate*" -or $errorMsg -like "*exists*") {
            Write-Info "San pham '$($prod.name)' da ton tai"
        } else {
            Write-Fail "Loi tao san pham $($prod.name): $errorMsg"
        }
    }
}

Write-Info "Da tao $($createdProducts.Count) san pham moi"

# =============================================
# 3. TAO BAO GIA NHA CUNG CAP
# =============================================
Write-Header "3. TAO BAO GIA NHA CUNG CAP"

if ($supplierId -and $createdProducts.Count -gt 0) {
    $count = 0
    foreach ($prod in $createdProducts) {
        if (-not $prod._id) { continue }
        try {
            $quoteBody = @{
                productId = $prod._id
                supplierId = $supplierId
                price = $prod.importPrice
            } | ConvertTo-Json
            
            $result = Invoke-RestMethod -Uri "$baseUrl/supplier-quotes" -Method Post -Headers $headers -Body $quoteBody
            $count++
        } catch {
            # Skip errors
        }
    }
    Write-Success "Da tao $count bao gia NCC"
} else {
    Write-Info "Khong co NCC hoac san pham de tao bao gia"
}

# =============================================
# 4. TAO BAO GIA DAI LY
# =============================================
Write-Header "4. TAO BAO GIA DAI LY"

$agents = Invoke-RestMethod -Uri "$baseUrl/users?type=external_agent" -Method Get -Headers $headers
$agentId = if ($agents.data -and $agents.data.Count -gt 0) { $agents.data[0]._id } else { $null }

if ($agentId -and $createdProducts.Count -gt 0) {
    $validFrom = (Get-Date).ToString("yyyy-MM-dd")
    $validUntil = (Get-Date).AddMonths(6).ToString("yyyy-MM-dd")
    $count = 0
    
    foreach ($prod in $createdProducts) {
        if (-not $prod._id) { continue }
        try {
            $sellingPrice = [math]::Round($prod.importPrice * 1.3)
            
            $quoteBody = @{
                productId = $prod._id
                agentId = $agentId
                unitPrice = $sellingPrice
                status = "approved"
                validFrom = $validFrom
                validUntil = $validUntil
            } | ConvertTo-Json
            
            $result = Invoke-RestMethod -Uri "$baseUrl/quotes" -Method Post -Headers $headers -Body $quoteBody
            $count++
        } catch {
            # Skip errors
        }
    }
    Write-Success "Da tao $count bao gia dai ly (LN 30 phan tram)"
} else {
    Write-Info "Khong co dai ly hoac san pham de tao bao gia"
}

# =============================================
# 5. TAO DON HANG MAU
# =============================================
Write-Header "5. TAO DON HANG MAU"

if ($createdProducts.Count -ge 3) {
    $orderCount = 0
    
    $prod1 = $createdProducts[0]
    $prod2 = $createdProducts[3]
    $prod3 = $createdProducts[6]
    
    $sampleOrders = @(
        @{
            productId = $prod1._id
            quantity = 1
            agentQuote = [math]::Round($prod1.importPrice * 1.3)
            supplierQuote = $prod1.importPrice
            customerName = "Nguyen Van A"
            receiverName = "Nguyen Van A"
            receiverPhone = "0901234567"
            receiverAddress = "123 Le Loi, Q1, TP.HCM"
            shippingFee = 30000
            depositAmount = 5000000
            orderStatus = "pending"
        },
        @{
            productId = $prod2._id
            quantity = 5
            agentQuote = [math]::Round($prod2.importPrice * 1.3)
            supplierQuote = $prod2.importPrice
            customerName = "Tran Thi B"
            receiverName = "Tran Thi B"
            receiverPhone = "0912345678"
            receiverAddress = "456 Nguyen Hue, Q3, TP.HCM"
            shippingFee = 25000
            depositAmount = 500000
            orderStatus = "processing"
        },
        @{
            productId = $prod3._id
            quantity = 2
            agentQuote = [math]::Round($prod3.importPrice * 1.3)
            supplierQuote = $prod3.importPrice
            customerName = "Le Van C"
            receiverName = "Le Van C"
            receiverPhone = "0923456789"
            receiverAddress = "789 Hai Ba Trung, Ha Noi"
            shippingFee = 50000
            depositAmount = 2000000
            orderStatus = "delivered"
        }
    )
    
    foreach ($order in $sampleOrders) {
        try {
            $orderBody = $order | ConvertTo-Json
            $result = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Method Post -Headers $headers -Body $orderBody
            $orderCount++
            $total = $order.agentQuote * $order.quantity
            $profit = ($order.agentQuote - $order.supplierQuote) * $order.quantity - $order.shippingFee
            Write-Success "Don hang $orderCount : $($order.customerName) x$($order.quantity) SP - LN: $($profit.ToString('N0')) VND"
        } catch {
            Write-Fail "Loi tao don hang: $_"
        }
    }
} else {
    Write-Info "Khong du san pham de tao don hang mau"
}

# =============================================
# TONG KET
# =============================================
Write-Header "TONG KET DU LIEU DEMO"

Write-Host ""
Write-Host "  NHOM SAN PHAM:" -ForegroundColor Yellow
$finalCategories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Method Get -Headers $headers
foreach ($c in $finalCategories) {
    Write-Host "    [$($c.code)] $($c.name)" -ForegroundColor White
}

Write-Host ""
Write-Host "  SAN PHAM MOI TAO: $($createdProducts.Count)" -ForegroundColor Yellow

Write-Host ""
Write-Host "  TONG DON HANG:" -ForegroundColor Yellow
$orders = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Method Get -Headers $headers
Write-Host "    $($orders.data.Count) don hang" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "HOAN THANH TAO DU LIEU DEMO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
