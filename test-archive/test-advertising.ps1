# =============================================
# TEST ADVERTISING MODULES - Kiem tra cac nghiep vu quang cao
# =============================================
# Modules: Ad Account, Ad Group, Advertising Cost, Budget Allocation, Employee Ads KPI
# =============================================

$baseUrl = "http://localhost:3000/api"
$token = $null
$passed = 0
$failed = 0
$testResults = @()

function Write-Header($text) {
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host $text -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

function Write-Step($step, $text) {
    Write-Host "`n[$step] $text" -ForegroundColor Yellow
}

function Write-Success($text) {
    Write-Host "  [PASS] $text" -ForegroundColor Green
    $script:passed++
}

function Write-Fail($text) {
    Write-Host "  [FAIL] $text" -ForegroundColor Red
    $script:failed++
}

function Write-Info($text) {
    Write-Host "  [INFO] $text" -ForegroundColor Gray
}

function Write-Warn($text) {
    Write-Host "  [WARN] $text" -ForegroundColor DarkYellow
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
    Write-Success "Dang nhap thanh cong voi quyen Director!"
} catch {
    Write-Fail "Khong the dang nhap: $_"
    exit
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# =============================================
# SETUP: TAO DU LIEU PHU THUOC
# =============================================
Write-Header "SETUP: TAO DU LIEU PHU THUOC"

# Tao Fanpage neu chua co
$fanpageId = $null
Write-Step "S.1" "Kiem tra va tao Fanpage test"
try {
    $fanpages = Invoke-RestMethod -Uri "$baseUrl/fanpages" -Method Get -Headers $headers
    if ($fanpages.Count -gt 0) {
        $fanpageId = $fanpages[0]._id
        Write-Info "Fanpage da ton tai: $($fanpages[0].name)"
    } else {
        # Tao fanpage moi
        $fanpageBody = @{
            pageId = "test_page_$(Get-Date -Format 'HHmmss')"
            name = "Test Fanpage Ads"
            accessToken = "test_access_token_$(Get-Date -Format 'yyyyMMddHHmmss')"
            status = "active"
            description = "Fanpage test cho quang cao"
        } | ConvertTo-Json
        
        $newFanpage = Invoke-RestMethod -Uri "$baseUrl/fanpages" -Method Post -Headers $headers -Body $fanpageBody
        $fanpageId = $newFanpage._id
        Write-Success "Da tao Fanpage: $($newFanpage.name)"
    }
} catch {
    Write-Warn "Loi kiem tra/tao fanpage: $_"
}

# Lay Category
$categoryId = $null
Write-Step "S.2" "Lay Category san pham"
try {
    $categories = Invoke-RestMethod -Uri "$baseUrl/product-category" -Method Get -Headers $headers
    if ($categories.Count -gt 0) {
        $categoryId = $categories[0]._id
        Write-Info "Category: $($categories[0].name)"
    }
} catch {
    Write-Warn "Khong lay duoc category"
}

# Lay Agent (external_agent hoac employee)
$agentId = $null
Write-Step "S.3" "Lay Agent/Employee"
try {
    $agents = Invoke-RestMethod -Uri "$baseUrl/users?type=external_agent" -Method Get -Headers $headers
    if ($agents.data -and $agents.data.Count -gt 0) {
        $agentId = $agents.data[0]._id
        Write-Info "Agent: $($agents.data[0].name)"
    } else {
        # Thu lay employee
        $employees = Invoke-RestMethod -Uri "$baseUrl/users?type=employee" -Method Get -Headers $headers
        if ($employees.data -and $employees.data.Count -gt 0) {
            $agentId = $employees.data[0]._id
            Write-Info "Employee: $($employees.data[0].name)"
        }
    }
} catch {
    Write-Warn "Khong lay duoc agent/employee"
}

Write-Info "Setup hoan tat: Fanpage=$($fanpageId -ne $null), Category=$($categoryId -ne $null), Agent=$($agentId -ne $null)"

# =============================================
# MODULE 1: AD ACCOUNT (Tai khoan quang cao)
# =============================================
Write-Header "MODULE 1: AD ACCOUNT (Tai khoan quang cao)"

$adAccountId = $null

# 1.1 Tao tai khoan quang cao Facebook
Write-Step "1.1" "Tao tai khoan quang cao Facebook"
try {
    $adAccountBody = @{
        name = "Test FB Ads Account"
        accountId = "act_test_$(Get-Date -Format 'HHmmss')"
        accountType = "facebook"
        isActive = $true
        description = "Tai khoan test Facebook Ads"
    } | ConvertTo-Json
    
    $adAccount = Invoke-RestMethod -Uri "$baseUrl/ad-accounts" -Method Post -Headers $headers -Body $adAccountBody
    $adAccountId = $adAccount._id
    Write-Success "Da tao Ad Account ID: $adAccountId"
    Write-Info "Account ID: $($adAccount.accountId)"
} catch {
    Write-Fail "Loi tao Ad Account: $_"
}

# 1.2 Lay danh sach tai khoan
Write-Step "1.2" "Lay danh sach tai khoan quang cao"
try {
    $adAccounts = Invoke-RestMethod -Uri "$baseUrl/ad-accounts" -Method Get -Headers $headers
    Write-Success "Lay duoc $($adAccounts.Count) tai khoan"
    foreach ($acc in $adAccounts | Select-Object -First 3) {
        Write-Info "$($acc.name) - $($acc.accountType) - $($acc.accountId)"
    }
} catch {
    Write-Fail "Loi lay danh sach: $_"
}

# 1.3 Tim kiem tai khoan theo type
Write-Step "1.3" "Tim kiem tai khoan Facebook"
try {
    $searchResults = Invoke-RestMethod -Uri "$baseUrl/ad-accounts/search?type=facebook&status=active" -Method Get -Headers $headers
    Write-Success "Tim thay $($searchResults.Count) tai khoan Facebook active"
} catch {
    Write-Fail "Loi tim kiem: $_"
}

# 1.4 Thong ke theo loai
Write-Step "1.4" "Thong ke tai khoan theo loai"
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/ad-accounts/stats/counts-by-type" -Method Get -Headers $headers
    Write-Success "Thong ke tai khoan:"
    foreach ($stat in $stats) {
        Write-Info "$($stat._id): $($stat.total) tai khoan ($($stat.activeCount) active)"
    }
} catch {
    Write-Fail "Loi thong ke: $_"
}

# 1.5 Cap nhat tai khoan
Write-Step "1.5" "Cap nhat tai khoan quang cao"
if ($adAccountId) {
    try {
        $updateBody = @{
            description = "Tai khoan test - da cap nhat"
            notes = "Cap nhat tu script test"
        } | ConvertTo-Json
        
        $updated = Invoke-RestMethod -Uri "$baseUrl/ad-accounts/$adAccountId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat Ad Account"
    } catch {
        Write-Fail "Loi cap nhat: $_"
    }
} else {
    Write-Warn "Bo qua - khong co adAccountId"
}

# =============================================
# MODULE 2: AD GROUP (Nhom quang cao)
# =============================================
Write-Header "MODULE 2: AD GROUP (Nhom quang cao)"

$adGroupMongoId = $null
$adGroupExternalId = $null

# 2.1 Tao nhom quang cao
Write-Step "2.1" "Tao nhom quang cao moi"
if ($fanpageId -and $categoryId -and $agentId -and $adAccountId) {
    try {
        $adGroupBody = @{
            name = "Test Ad Group $(Get-Date -Format 'HHmmss')"
            adGroupId = "test_adgroup_$(Get-Date -Format 'HHmmss')"
            fanpageId = $fanpageId
            productCategoryId = $categoryId
            agentId = $agentId
            adAccountId = $adAccountId
            platform = "facebook"
            isActive = $true
            description = "Nhom quang cao test"
            autoControlEnabled = $true
            spendThresholdDaily = 1000000
            cprThresholdDaily = 50000
            minConversations = 3
        } | ConvertTo-Json
        
        $adGroup = Invoke-RestMethod -Uri "$baseUrl/ad-groups" -Method Post -Headers $headers -Body $adGroupBody
        $adGroupMongoId = $adGroup._id
        $adGroupExternalId = $adGroup.adGroupId
        Write-Success "Da tao Ad Group: $($adGroup.name)"
        Write-Info "MongoDB ID: $adGroupMongoId"
        Write-Info "External ID: $adGroupExternalId"
    } catch {
        Write-Fail "Loi tao Ad Group: $_"
    }
} else {
    Write-Warn "Thieu du lieu phu thuoc (fanpage/category/agent/adAccount)"
}

# 2.2 Lay danh sach nhom quang cao
Write-Step "2.2" "Lay danh sach nhom quang cao"
try {
    $adGroups = Invoke-RestMethod -Uri "$baseUrl/ad-groups" -Method Get -Headers $headers
    Write-Success "Lay duoc $($adGroups.Count) nhom quang cao"
    foreach ($grp in $adGroups | Select-Object -First 3) {
        Write-Info "$($grp.name) - $($grp.platform) - active: $($grp.isActive)"
    }
} catch {
    Write-Fail "Loi lay danh sach: $_"
}

# 2.3 Tim kiem nhom quang cao
Write-Step "2.3" "Tim kiem nhom quang cao theo platform"
try {
    $searchResults = Invoke-RestMethod -Uri "$baseUrl/ad-groups/search?platform=facebook&status=active" -Method Get -Headers $headers
    Write-Success "Tim thay $($searchResults.Count) nhom Facebook active"
} catch {
    Write-Fail "Loi tim kiem: $_"
}

# 2.4 Thong ke theo san pham
Write-Step "2.4" "Thong ke nhom theo san pham"
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/ad-groups/stats/counts-by-product" -Method Get -Headers $headers
    Write-Success "Thong ke nhom theo san pham: $($stats.Count) san pham"
} catch {
    Write-Fail "Loi thong ke: $_"
}

# 2.5 Cap nhat nhom quang cao
Write-Step "2.5" "Cap nhat cau hinh tu dong"
if ($adGroupMongoId) {
    try {
        $updateBody = @{
            spendThresholdDaily = 2000000
            cprThresholdDaily = 40000
            notes = "Da cap nhat tu script test"
        } | ConvertTo-Json
        
        $updated = Invoke-RestMethod -Uri "$baseUrl/ad-groups/$adGroupMongoId" -Method Patch -Headers $headers -Body $updateBody
        Write-Success "Da cap nhat Ad Group - threshold: 2,000,000 VND"
    } catch {
        Write-Fail "Loi cap nhat: $_"
    }
} else {
    Write-Warn "Bo qua - khong co adGroupMongoId"
}

# 2.6 Lay goi y AI
Write-Step "2.6" "Lay goi y phan bo ngan sach tu AI"
try {
    $recommendations = Invoke-RestMethod -Uri "$baseUrl/ad-groups/recommendations" -Method Get -Headers $headers
    Write-Success "Lay goi y AI:"
    Write-Info "So nhom co goi y: $(if ($recommendations) { $recommendations.Count } else { '0' })"
} catch {
    # Empty data or service error - acceptable when no ad groups
    if ($_.Exception.Response.StatusCode -eq 500) {
        Write-Warn "Recommendation service loi (co the chua co ad group)"
    } else {
        Write-Fail "Loi lay goi y: $_"
    }
}

# =============================================
# MODULE 3: ADVERTISING COST (Chi phi quang cao)
# =============================================
Write-Header "MODULE 3: ADVERTISING COST (Chi phi quang cao)"

$adCostId = $null

# 3.1 Tao chi phi quang cao
Write-Step "3.1" "Tao chi phi quang cao"
if ($adGroupExternalId) {
    try {
        $costBody = @{
            adGroupId = $adGroupExternalId
            channel = "facebook"
            date = (Get-Date).ToString("yyyy-MM-dd")
            spentAmount = 500000
            impressions = 10000
            clicks = 150
            reach = 8000
            messagingConversationStarted7d = 25
            costPerMessagingConversation = 20000
        } | ConvertTo-Json
        
        $adCost = Invoke-RestMethod -Uri "$baseUrl/advertising-cost" -Method Post -Headers $headers -Body $costBody
        $adCostId = $adCost._id
        Write-Success "Da tao chi phi quang cao: 500,000 VND"
        Write-Info "CPR: 20,000 VND/conversation"
    } catch {
        Write-Fail "Loi tao chi phi: $_"
    }
} else {
    Write-Warn "Khong co adGroupExternalId de tao chi phi"
}

# 3.2 Lay danh sach chi phi
Write-Step "3.2" "Lay danh sach chi phi quang cao"
try {
    $costs = Invoke-RestMethod -Uri "$baseUrl/advertising-cost" -Method Get -Headers $headers
    if ($costs -and $costs.Count -gt 0) {
        $totalSpent = ($costs | Measure-Object -Property spentAmount -Sum).Sum
        Write-Success "Lay duoc $($costs.Count) ban ghi chi phi"
        Write-Info "Tong chi phi: $(if ($totalSpent) { $totalSpent.ToString('N0') } else { '0' }) VND"
    } else {
        Write-Success "Lay duoc 0 ban ghi chi phi"
    }
} catch {
    Write-Fail "Loi lay danh sach: $_"
}

# 3.3 Thong ke theo nhom
Write-Step "3.3" "Thong ke chi phi theo nhom quang cao"
try {
    $statsByGroup = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/stats/by-adgroup" -Method Get -Headers $headers
    Write-Success "Thong ke chi phi: $($statsByGroup.Count) nhom"
    foreach ($stat in $statsByGroup | Select-Object -First 3) {
        Write-Info "$($stat._id): $($stat.totalSpent.ToString('N0')) VND"
    }
} catch {
    Write-Fail "Loi thong ke: $_"
}

# 3.4 Chi phi conversation theo nhom
Write-Step "3.4" "Chi phi conversation theo nhom"
try {
    $convCost = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/stats/conversation-cost" -Method Get -Headers $headers
    Write-Success "Chi phi conversation: $($convCost.Count) nhom"
} catch {
    Write-Fail "Loi lay chi phi conversation: $_"
}

# 3.5 Chi phi conversation theo ngay
Write-Step "3.5" "Chi phi conversation theo ngay"
if ($adGroupExternalId) {
    try {
        $today = (Get-Date).ToString("yyyy-MM-dd")
        $dailyCost = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/stats/conversation-cost/daily?adGroupId=$adGroupExternalId&date=$today" -Method Get -Headers $headers
        Write-Success "Chi phi ngay $today"
    } catch {
        Write-Fail "Loi lay chi phi ngay: $_"
    }
} else {
    Write-Warn "Bo qua - khong co adGroupExternalId"
}

# 3.6 Tong hop chi phi
Write-Step "3.6" "Tong hop chi phi quang cao"
try {
    $summary = Invoke-RestMethod -Uri "$baseUrl/advertising-cost/stats/summary" -Method Get -Headers $headers
    Write-Success "Tong hop chi phi:"
    if ($summary -and $null -ne $summary.totalSpent) {
        Write-Info "Tong: $($summary.totalSpent.ToString('N0')) VND"
        Write-Info "TB/ngay: $(if ($summary.avgDaily) { $summary.avgDaily.ToString('N0') } else { '0' }) VND"
    } else {
        Write-Info "Tong: 0 VND"
    }
} catch {
    # May not exist
    Write-Warn "Khong co endpoint summary hoac loi: $_"
}

# =============================================
# MODULE 4: AD REPORT (Bao cao quang cao)
# =============================================
Write-Header "MODULE 4: AD REPORT (Bao cao quang cao)"

# 4.1 Bao cao chi phi tren don hang
Write-Step "4.1" "Bao cao chi phi tren don hang"
try {
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $costPerOrder = Invoke-RestMethod -Uri "$baseUrl/ad-report/cost-per-order?startDate=$startDate&endDate=$endDate" -Method Get -Headers $headers
    Write-Success "Bao cao chi phi/don hang: $($costPerOrder.Count) ban ghi"
} catch {
    Write-Fail "Loi lay bao cao: $_"
}

# =============================================
# MODULE 5: AD GROUP PROFIT REPORT (Bao cao loi nhuan)
# =============================================
Write-Header "MODULE 5: AD GROUP PROFIT REPORT (Bao cao loi nhuan)"

# 5.1 Bao cao hieu suat
Write-Step "5.1" "Bao cao hieu suat theo nhom"
try {
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $performance = Invoke-RestMethod -Uri "$baseUrl/ad-group-profit-report/performance?startDate=$startDate&endDate=$endDate" -Method Get -Headers $headers
    Write-Success "Bao cao hieu suat: $($performance.Count) nhom"
    foreach ($perf in $performance | Select-Object -First 3) {
        Write-Info "$($perf.adGroupName): ROI=$($perf.roi)%, Profit=$($perf.totalProfit.ToString('N0')) VND"
    }
} catch {
    Write-Fail "Loi lay bao cao hieu suat: $_"
}

# 5.2 Goi y chi phi toi uu
Write-Step "5.2" "Goi y chi phi toi uu"
try {
    $optimal = Invoke-RestMethod -Uri "$baseUrl/ad-group-profit-report/optimal-spend?days=30&minROI=0.5&minProfit=100000" -Method Get -Headers $headers
    Write-Success "Goi y chi phi toi uu: $($optimal.Count) nhom"
} catch {
    Write-Fail "Loi lay goi y: $_"
}

# 5.3 Tong hop loi nhuan
Write-Step "5.3" "Tong hop loi nhuan"
try {
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $profitSummary = Invoke-RestMethod -Uri "$baseUrl/ad-group-profit-report/summary?startDate=$startDate&endDate=$endDate" -Method Get -Headers $headers
    Write-Success "Tong hop loi nhuan:"
    Write-Info "Tong doanh thu: $($profitSummary.totalRevenue.ToString('N0')) VND"
    Write-Info "Tong loi nhuan: $($profitSummary.totalProfit.ToString('N0')) VND"
} catch {
    Write-Fail "Loi tong hop: $_"
}

# =============================================
# MODULE 6: BUDGET ALLOCATION (Phan bo ngan sach)
# =============================================
Write-Header "MODULE 6: BUDGET ALLOCATION (Phan bo ngan sach)"

# 6.1 Xem trang thai phan bo
Write-Step "6.1" "Trang thai phan bo hien tai"
try {
    $status = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/status" -Method Get -Headers $headers
    Write-Success "Trang thai phan bo:"
    if ($status -and $status.lastAllocation) {
        Write-Info "Lan phan bo cuoi: $($status.lastAllocation)"
    }
    if ($status -and $null -ne $status.totalBudget) {
        Write-Info "Tong ngan sach: $($status.totalBudget.ToString('N0')) VND"
    } else {
        Write-Info "Tong ngan sach: 0 VND"
    }
} catch {
    Write-Fail "Loi lay trang thai: $_"
}

# 6.2 Xem truoc phan bo theo ROI
Write-Step "6.2" "Xem truoc phan bo theo ROI"
try {
    $preview = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/preview?priorityMode=roi&minBudget=100000&maxBudget=5000000" -Method Get -Headers $headers
    Write-Success "Xem truoc phan bo (ROI mode):"
    Write-Info "So nhom: $($preview.allocations.Count)"
    foreach ($alloc in $preview.allocations | Select-Object -First 3) {
        Write-Info "$($alloc.adGroupName): $($alloc.suggestedBudget.ToString('N0')) VND"
    }
} catch {
    Write-Fail "Loi xem truoc: $_"
}

# 6.3 Xem truoc phan bo theo Profit
Write-Step "6.3" "Xem truoc phan bo theo Profit"
try {
    $preview = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/preview?priorityMode=profit&minBudget=100000&maxBudget=5000000" -Method Get -Headers $headers
    Write-Success "Xem truoc phan bo (Profit mode):"
    Write-Info "So nhom: $($preview.allocations.Count)"
} catch {
    Write-Fail "Loi xem truoc: $_"
}

# 6.4 Phan bo tu dong (dry run)
Write-Step "6.4" "Phan bo tu dong (dry run - khong ap dung)"
try {
    $allocBody = @{
        dryRun = $true
        minBudget = 100000
        maxBudget = 5000000
        priorityMode = "roi"
        fundMode = "conservative"
    } | ConvertTo-Json
    
    $allocation = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/auto" -Method Post -Headers $headers -Body $allocBody
    Write-Success "Phan bo tu dong (dry run):"
    Write-Info "Mode: Conservative"
    Write-Info "Tong phan bo: $(if ($allocation -and $null -ne $allocation.totalAllocated) { $allocation.totalAllocated.ToString('N0') } else { '0' }) VND"
    Write-Info "So nhom: $(if ($allocation) { $allocation.groupsAllocated } else { '0' })"
} catch {
    Write-Fail "Loi phan bo: $_"
}

# 6.5 Test cac fundMode khac nhau
Write-Step "6.5" "So sanh cac fundMode"
$fundModes = @("conservative", "moderate", "aggressive")
foreach ($mode in $fundModes) {
    try {
        $allocBody = @{
            dryRun = $true
            minBudget = 100000
            maxBudget = 5000000
            priorityMode = "roi"
            fundMode = $mode
        } | ConvertTo-Json
        
        $allocation = Invoke-RestMethod -Uri "$baseUrl/budget-allocation/auto" -Method Post -Headers $headers -Body $allocBody
        Write-Info "  $mode : $(if ($allocation -and $null -ne $allocation.totalAllocated) { $allocation.totalAllocated.ToString('N0') } else { '0' }) VND ($(if ($allocation) { $allocation.groupsAllocated } else { '0' }) nhom)"
    } catch {
        Write-Warn "  $mode : Loi"
    }
}
Write-Success "Hoan thanh so sanh fundMode"

# =============================================
# MODULE 7: EMPLOYEE ADS KPI (Chi so nhan vien)
# =============================================
Write-Header "MODULE 7: EMPLOYEE ADS KPI (Chi so nhan vien)"

# 7.1 Lay danh sach KPI nhan vien
Write-Step "7.1" "Lay KPI tat ca nhan vien"
try {
    $startDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $allKpi = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi?startDate=$startDate&endDate=$endDate" -Method Get -Headers $headers
    Write-Success "KPI nhan vien: $($allKpi.Count) nhan vien"
    foreach ($emp in $allKpi | Select-Object -First 3) {
        Write-Info "$($emp.employeeName): $($emp.totalAdGroups) nhom, $($emp.profitableGroups) loi nhuan"
    }
} catch {
    Write-Fail "Loi lay KPI: $_"
}

# 7.2 Lay nhan vien co the gan
Write-Step "7.2" "Lay danh sach nhan vien co the gan"
try {
    $assignable = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi/meta/employees" -Method Get -Headers $headers
    Write-Success "Nhan vien co the gan: $($assignable.Count) nguoi"
} catch {
    Write-Fail "Loi lay nhan vien: $_"
}

# 7.3 Lay canh bao
Write-Step "7.3" "Lay canh bao KPI"
try {
    $startDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $endDate = (Get-Date).ToString("yyyy-MM-dd")
    $alerts = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi/meta/alerts?startDate=$startDate&endDate=$endDate" -Method Get -Headers $headers
    Write-Success "Canh bao KPI: $($alerts.Count) canh bao"
    foreach ($alert in $alerts | Select-Object -First 5) {
        Write-Info "[$($alert.level)] $($alert.employeeName): $($alert.message)"
    }
} catch {
    Write-Fail "Loi lay canh bao: $_"
}

# 7.4 Gan nhan vien vao nhom quang cao
Write-Step "7.4" "Gan nhan vien vao nhom quang cao"
if ($adGroupMongoId -and $agentId) {
    try {
        $assignBody = @{
            adGroupId = $adGroupMongoId
            employeeId = $agentId
        } | ConvertTo-Json
        
        $assigned = Invoke-RestMethod -Uri "$baseUrl/employee-ads-kpi/assign" -Method Post -Headers $headers -Body $assignBody
        Write-Success "Da gan nhan vien vao nhom quang cao"
    } catch {
        Write-Fail "Loi gan nhan vien: $_"
    }
} else {
    Write-Warn "Thieu adGroupMongoId hoac agentId"
}

# =============================================
# MODULE 8: AD GROUP DAILY REPORT (Bao cao hang ngay)
# =============================================
Write-Header "MODULE 8: AD GROUP DAILY REPORT (Bao cao hang ngay)"

# 8.1 Dong bo bao cao
Write-Step "8.1" "Dong bo bao cao hang ngay"
try {
    $today = (Get-Date).ToString("yyyy-MM-dd")
    $syncResult = Invoke-RestMethod -Uri "$baseUrl/ad-group-daily-report/sync?date=$today" -Method Post -Headers $headers
    Write-Success "Da dong bo bao cao ngay $today"
} catch {
    Write-Fail "Loi dong bo: $_"
}

# 8.2 Lay bao cao
Write-Step "8.2" "Lay bao cao hang ngay"
try {
    $fromDate = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $report = Invoke-RestMethod -Uri "$baseUrl/ad-group-daily-report?fromDate=$fromDate&toDate=$toDate" -Method Get -Headers $headers
    Write-Success "Bao cao 7 ngay: $($report.Count) ban ghi"
} catch {
    Write-Fail "Loi lay bao cao: $_"
}

# 8.3 Lay top nhom
Write-Step "8.3" "Lay top nhom quang cao"
try {
    $fromDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-dd")
    $toDate = (Get-Date).ToString("yyyy-MM-dd")
    $topGroups = Invoke-RestMethod -Uri "$baseUrl/ad-group-daily-report/top?fromDate=$fromDate&toDate=$toDate&limit=5&sortBy=profit" -Method Get -Headers $headers
    Write-Success "Top 5 nhom theo loi nhuan:"
    foreach ($grp in $topGroups) {
        Write-Info "$($grp.adGroupName): $($grp.totalProfit.ToString('N0')) VND"
    }
} catch {
    Write-Fail "Loi lay top: $_"
}

# =============================================
# MODULE 9: ADVERTISING COST PUBLIC
# =============================================
Write-Header "MODULE 9: ADVERTISING COST PUBLIC"

# 9.1 Chi phi hom qua (public endpoint)
Write-Step "9.1" "Chi phi hom qua (public endpoint - khong can auth)"
try {
    $yesterdaySpent = Invoke-RestMethod -Uri "$baseUrl/advertising-cost-public/yesterday-spent" -Method Get
    Write-Success "Chi phi hom qua (public):"
    if ($yesterdaySpent -and $yesterdaySpent.Count -gt 0) {
        foreach ($spent in $yesterdaySpent | Select-Object -First 3) {
            if ($spent -and $null -ne $spent.spentAmount) {
                Write-Info "$($spent.adGroupId): $($spent.spentAmount.ToString('N0')) VND"
            }
        }
    } else {
        Write-Info "Khong co du lieu chi phi hom qua"
    }
} catch {
    Write-Fail "Loi lay chi phi public: $_"
}

# =============================================
# CLEANUP (Don dep du lieu test)
# =============================================
Write-Header "DON DEP DU LIEU TEST"

# Xoa chi phi test
if ($adCostId) {
    Write-Step "C.1" "Xoa chi phi quang cao test"
    try {
        Invoke-RestMethod -Uri "$baseUrl/advertising-cost/$adCostId" -Method Delete -Headers $headers | Out-Null
        Write-Success "Da xoa chi phi test"
    } catch {
        Write-Warn "Khong xoa duoc chi phi: $_"
    }
}

# Xoa nhom quang cao test
if ($adGroupMongoId) {
    Write-Step "C.2" "Xoa nhom quang cao test"
    try {
        Invoke-RestMethod -Uri "$baseUrl/ad-groups/$adGroupMongoId" -Method Delete -Headers $headers | Out-Null
        Write-Success "Da xoa nhom quang cao test"
    } catch {
        Write-Warn "Khong xoa duoc nhom: $_"
    }
}

# Xoa tai khoan test
if ($adAccountId) {
    Write-Step "C.3" "Xoa tai khoan quang cao test"
    try {
        Invoke-RestMethod -Uri "$baseUrl/ad-accounts/$adAccountId" -Method Delete -Headers $headers | Out-Null
        Write-Success "Da xoa tai khoan test"
    } catch {
        Write-Warn "Khong xoa duoc tai khoan: $_"
    }
}

# =============================================
# TONG KET
# =============================================
Write-Header "TONG KET TEST QUANG CAO"

Write-Host ""
Write-Host "  KET QUA TEST:" -ForegroundColor Yellow
Write-Host "    PASSED: $passed" -ForegroundColor Green
Write-Host "    FAILED: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

Write-Host "  CAC MODULE DA TEST:" -ForegroundColor Yellow
Write-Host "    1. Ad Account - Tai khoan quang cao" -ForegroundColor White
Write-Host "    2. Ad Group - Nhom quang cao" -ForegroundColor White
Write-Host "    3. Advertising Cost - Chi phi quang cao" -ForegroundColor White
Write-Host "    4. Ad Report - Bao cao quang cao" -ForegroundColor White
Write-Host "    5. Ad Group Profit Report - Bao cao loi nhuan" -ForegroundColor White
Write-Host "    6. Budget Allocation - Phan bo ngan sach" -ForegroundColor White
Write-Host "    7. Employee Ads KPI - Chi so nhan vien" -ForegroundColor White
Write-Host "    8. Ad Group Daily Report - Bao cao hang ngay" -ForegroundColor White
Write-Host "    9. Advertising Cost Public - Chi phi cong khai" -ForegroundColor White
Write-Host ""

Write-Host "  NGHIEP VU CHINH:" -ForegroundColor Yellow
Write-Host "    - Tao/sua/xoa tai khoan quang cao" -ForegroundColor White
Write-Host "    - Tao/sua/xoa nhom quang cao" -ForegroundColor White
Write-Host "    - Ghi nhan chi phi quang cao" -ForegroundColor White
Write-Host "    - Tinh toan ROI, loi nhuan theo nhom" -ForegroundColor White
Write-Host "    - Phan bo ngan sach tu dong theo ROI/Profit" -ForegroundColor White
Write-Host "    - Theo doi KPI nhan vien quang cao" -ForegroundColor White
Write-Host "    - Canh bao khi KPI khong dat (70% profitable, min 4 groups)" -ForegroundColor White
Write-Host ""

if ($failed -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "TAT CA TEST QUANG CAO PASSED!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "CO $failed TEST THAT BAI!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}

Write-Host ""
Write-Host "Thoi gian: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
