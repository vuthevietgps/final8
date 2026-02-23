# Test Script cho API endpoints
# Chạy: .\test-api.ps1

$baseUrl = "http://localhost:3000/api"

# 1. Login
Write-Host "`n=== 1. LOGIN ===" -ForegroundColor Cyan
$loginBody = '{"email":"director@test.com","password":"123456"}'
$loginResult = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = $loginResult.access_token
Write-Host "✅ Login Success! Token obtained" -ForegroundColor Green

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 2. Test các endpoint GET cơ bản
Write-Host "`n=== 2. BASIC GET ENDPOINTS ===" -ForegroundColor Cyan

$endpoints = @(
    @{ Name = "Health"; Url = "http://localhost:3000/health"; NeedAuth = $false },
    @{ Name = "DB Health"; Url = "$baseUrl/health/db"; NeedAuth = $false },
    @{ Name = "Users"; Url = "$baseUrl/users"; NeedAuth = $true },
    @{ Name = "Products"; Url = "$baseUrl/products"; NeedAuth = $true },
    @{ Name = "Delivery Status"; Url = "$baseUrl/delivery-status"; NeedAuth = $false },
    @{ Name = "Production Status"; Url = "$baseUrl/production-status"; NeedAuth = $false },
    @{ Name = "Product Categories"; Url = "$baseUrl/product-category"; NeedAuth = $false },
    @{ Name = "Order Status"; Url = "$baseUrl/order-status"; NeedAuth = $false },
    @{ Name = "Ad Accounts"; Url = "$baseUrl/ad-accounts"; NeedAuth = $true },
    @{ Name = "Ad Groups"; Url = "$baseUrl/ad-groups"; NeedAuth = $true }
)

foreach ($ep in $endpoints) {
    try {
        if ($ep.NeedAuth) {
            $response = Invoke-RestMethod -Uri $ep.Url -Method Get -Headers $headers -TimeoutSec 10
        } else {
            $response = Invoke-RestMethod -Uri $ep.Url -Method Get -TimeoutSec 10
        }
        $count = if ($response -is [array]) { $response.Length } elseif ($response.data) { $response.data.Length } else { "OK" }
        Write-Host "✅ $($ep.Name): $count" -ForegroundColor Green
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ $($ep.Name): Error $status" -ForegroundColor Red
    }
}

# 3. Test Orders endpoints
Write-Host "`n=== 3. ORDERS (TestOrder2) ===" -ForegroundColor Cyan
try {
    $orders = Invoke-RestMethod -Uri "$baseUrl/test-order2" -Method Get -Headers $headers
    $count = if ($orders.data) { $orders.data.Length } else { $orders.Length }
    Write-Host "✅ Orders List: $count orders" -ForegroundColor Green
} catch {
    Write-Host "❌ Orders List: Error" -ForegroundColor Red
}

# 4. Test Finance endpoints
Write-Host "`n=== 4. FINANCE ===" -ForegroundColor Cyan

$financeEndpoints = @(
    @{ Name = "Available Funds Current"; Url = "$baseUrl/finance/available-funds/current" },
    @{ Name = "Cashflow Health"; Url = "$baseUrl/finance/cashflow-health" },
    @{ Name = "Finance Dashboard"; Url = "$baseUrl/finance/dashboard" },
    @{ Name = "Loans"; Url = "$baseUrl/finance/loans" },
    @{ Name = "Funding Sources"; Url = "$baseUrl/finance/funding-sources" }
)

foreach ($ep in $financeEndpoints) {
    try {
        $response = Invoke-RestMethod -Uri $ep.Url -Method Get -Headers $headers -TimeoutSec 10
        Write-Host "✅ $($ep.Name): OK" -ForegroundColor Green
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        Write-Host "❌ $($ep.Name): Error $status" -ForegroundColor Red
    }
}

# 5. Test Budget Allocation
Write-Host "`n=== 5. BUDGET ALLOCATION ===" -ForegroundColor Cyan
try {
    $preview = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/preview" -Method Get -Headers $headers
    Write-Host "✅ Budget Allocation Preview: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Budget Allocation Preview: Error" -ForegroundColor Red
}

try {
    $status = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/status" -Method Get -Headers $headers
    Write-Host "✅ Budget Allocation Status: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Budget Allocation Status: Error" -ForegroundColor Red
}

# 6. Test Payables/Receivables
Write-Host "`n=== 6. PAYABLES & RECEIVABLES ===" -ForegroundColor Cyan
try {
    $supplierPayables = Invoke-RestMethod -Uri "$baseUrl/supplier-payables/statements" -Method Get -Headers $headers
    Write-Host "✅ Supplier Payables: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Supplier Payables: Error" -ForegroundColor Red
}

try {
    $agentReceivables = Invoke-RestMethod -Uri "$baseUrl/agent-receivables/summary" -Method Get -Headers $headers
    Write-Host "✅ Agent Receivables Summary: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Agent Receivables Summary: Error" -ForegroundColor Red
}

# 7. Test Employee Ads KPI
Write-Host "`n=== 7. EMPLOYEE ADS KPI ===" -ForegroundColor Cyan
try {
    $kpi = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi" -Method Get -Headers $headers
    Write-Host "✅ Employee Ads KPI: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Employee Ads KPI: Error" -ForegroundColor Red
}

try {
    $employees = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi/meta/employees" -Method Get -Headers $headers
    Write-Host "✅ KPI Employees List: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ KPI Employees List: Error" -ForegroundColor Red
}

# 8. Test Reports
Write-Host "`n=== 8. REPORTS ===" -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
$monthAgo = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")

try {
    $returnReport = Invoke-RestMethod -Uri "$baseUrl/return-report/ad-group?fromDate=$monthAgo&toDate=$today" -Method Get -Headers $headers
    Write-Host "✅ Return Report (Ad Group): OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Return Report (Ad Group): Error" -ForegroundColor Red
}

try {
    $adGroupDaily = Invoke-RestMethod -Uri "$baseUrl/ad-group-daily-report?fromDate=$monthAgo&toDate=$today" -Method Get -Headers $headers
    Write-Host "✅ Ad Group Daily Report: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Ad Group Daily Report: Error" -ForegroundColor Red
}

# 9. Test Capital Allocation
Write-Host "`n=== 9. CAPITAL ALLOCATION ===" -ForegroundColor Cyan
try {
    $policies = Invoke-RestMethod -Uri "$baseUrl/capital-allocation/policies" -Method Get -Headers $headers
    Write-Host "✅ Capital Policies: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Capital Policies: Error" -ForegroundColor Red
}

try {
    $snapshots = Invoke-RestMethod -Uri "$baseUrl/capital-allocation/snapshots" -Method Get -Headers $headers
    Write-Host "✅ Capital Snapshots: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Capital Snapshots: Error" -ForegroundColor Red
}

# 10. Test Messenger/Chat
Write-Host "`n=== 10. CHAT & MESSENGER ===" -ForegroundColor Cyan
try {
    $conversations = Invoke-RestMethod -Uri "$baseUrl/chat-messages/conversations/list/all" -Method Get -Headers $headers
    Write-Host "✅ Conversations List: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Conversations List: Error" -ForegroundColor Red
}

try {
    $fanpages = Invoke-RestMethod -Uri "$baseUrl/fanpages" -Method Get -Headers $headers
    $count = if ($fanpages -is [array]) { $fanpages.Length } else { "OK" }
    Write-Host "✅ Fanpages: $count" -ForegroundColor Green
} catch {
    Write-Host "❌ Fanpages: Error" -ForegroundColor Red
}

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor Cyan
Write-Host "Check results above for any failures" -ForegroundColor Yellow
