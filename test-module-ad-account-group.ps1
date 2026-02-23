#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-MODULE-AD-ACCOUNT-GROUP.ps1
    =====================================================================================
    Test Ad Account & Ad Group modules:
    1. Ad Account CRUD (create, list, search, validate, update, delete)
    2. Ad Account stats
    3. Ad Group CRUD (create, list, search, validate, update, delete)
    4. Ad Group recommendations, lookup, sync status
    =====================================================================================
#>
$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000/api"

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

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Section "MODULE TEST: AD ACCOUNT & AD GROUP - $ts"

# ===== LOGIN =====
Write-Section "PHASE 0: Login"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
} else { Write-Fail "Login failed"; exit 1 }

# ===== PHASE 1: AD ACCOUNT CRUD =====
Write-Section "PHASE 1: Ad Account CRUD"

Write-Step "1.1" "Create Ad Account (Facebook)"
$acc1Body = @{
    name = "Test FB Account $ts"
    accountId = "act_test_fb_$ts"
    accountType = "facebook"
    isActive = $true
    notes = "Test account created by automation"
} | ConvertTo-Json
$acc1 = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $acc1Body -Label "CreateAdAccount1"
if ($acc1 -and $acc1._id) {
    $acc1Id = $acc1._id
    Write-Pass "Ad Account FB created: $acc1Id ($($acc1.name))"
} else { Write-Fail "Create FB ad account failed" }

Write-Step "1.2" "Create Ad Account (Google)"
$acc2Body = @{
    name = "Test Google Account $ts"
    accountId = "act_test_gg_$ts"
    accountType = "google"
    isActive = $true
    loginCustomerId = "123-456-7890"
} | ConvertTo-Json
$acc2 = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $acc2Body -Label "CreateAdAccount2"
if ($acc2 -and $acc2._id) {
    $acc2Id = $acc2._id
    Write-Pass "Ad Account Google created: $acc2Id"
} else { Write-Fail "Create Google ad account failed" }

Write-Step "1.3" "Create Ad Account (TikTok)"
$acc3Body = @{
    name = "Test TikTok Account $ts"
    accountId = "act_test_tt_$ts"
    accountType = "tiktok"
    isActive = $true
} | ConvertTo-Json
$acc3 = Safe-Request -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $h -Body $acc3Body -Label "CreateAdAccount3"
if ($acc3 -and $acc3._id) {
    $acc3Id = $acc3._id
    Write-Pass "Ad Account TikTok created: $acc3Id"
} else { Write-Fail "Create TikTok ad account failed" }

Write-Step "1.4" "List Ad Accounts"
$accList = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts" -Headers $h -Label "ListAdAccounts"
if ($accList) {
    $accs = if ($accList -is [array]) { $accList } elseif ($accList.data) { $accList.data } else { @($accList) }
    Write-Pass "Ad Accounts found: $($accs.Count)"
} else { Write-Fail "List ad accounts failed" }

Write-Step "1.5" "Search Ad Accounts"
$accSearch = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts/search?query=Test" -Headers $h -Label "SearchAdAccounts"
if ($accSearch -ne $null) { Write-Pass "Search ad accounts OK" } else { Write-Fail "Search ad accounts failed" }

Write-Step "1.6" "Validate account ID"
$accVal = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts/validate/account-id/act_test_fb_$ts" -Headers $h -Label "ValidateAcc"
if ($accVal -ne $null) { Write-Pass "Validate account ID OK" } else { Write-Fail "Validate account ID failed" }

Write-Step "1.7" "Counts by type"
$accStats = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts/stats/counts-by-type" -Headers $h -Label "CountsByType"
if ($accStats) { Write-Pass "Counts by type OK" } else { Write-Fail "Counts by type failed" }

Write-Step "1.8" "Update Ad Account"
if ($acc1Id) {
    $accUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/ad-accounts/$acc1Id" -Headers $h -Body '{"notes":"Updated by test"}' -Label "UpdateAdAccount"
    if ($accUpd) { Write-Pass "Ad Account updated" } else { Write-Fail "Update ad account failed" }
}

Write-Step "1.9" "Get single Ad Account"
if ($acc1Id) {
    $accGet = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts/$acc1Id" -Headers $h -Label "GetAdAccount"
    if ($accGet -and $accGet._id) { Write-Pass "Get ad account OK: $($accGet.name)" } else { Write-Fail "Get ad account failed" }
}

Write-Step "1.10" "Delete Ad Account (TikTok)"
if ($acc3Id) {
    $accDel = Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$acc3Id" -Headers $h -Label "DeleteAdAccount"
    if ($accDel -ne $null) { Write-Pass "Ad Account deleted: $acc3Id" } else { Write-Fail "Delete ad account failed" }
}

Write-Step "1.11" "Verify deletion (expect 404)"
if ($acc3Id) {
    $accCheck = Safe-Request -Method GET -Uri "$BaseUrl/ad-accounts/$acc3Id" -Headers $h -Label "VerifyDeleted"
    if ($accCheck -eq $null) { Write-Pass "Confirmed deleted (404)" } else { Write-Fail "Account still exists after deletion" }
}

# ===== PHASE 2: AD GROUP CRUD =====
Write-Section "PHASE 2: Ad Group CRUD"

# Get existing product & category for ad group creation
$products = Safe-Request -Method GET -Uri "$BaseUrl/products" -Headers $h -Label "GetProducts"
$prodList = if ($products -is [array]) { $products } elseif ($products.data) { $products.data } else { @($products) }
$testProductId = if ($prodList.Count -gt 0) { $prodList[0]._id } else { $null }

$categories = Safe-Request -Method GET -Uri "$BaseUrl/product-category" -Headers $h -Label "GetCategories"
$catList = if ($categories -is [array]) { $categories } elseif ($categories.data) { $categories.data } else { @($categories) }
$testCatId = if ($catList.Count -gt 0) { $catList[0]._id } else { $null }

# Get an agent for assignment
$agents = Safe-Request -Method GET -Uri "$BaseUrl/users/agents" -Headers $h -Label "GetAgents"
$agentList = if ($agents -is [array]) { $agents } elseif ($agents.data) { $agents.data } else { @($agents) }
$testAgentId = if ($agentList.Count -gt 0) { $agentList[0]._id } else { $null }

# Create a test fanpage for ad group
$fanpageBody = @{
    pageId = "test_page_$ts"
    name = "Test Fanpage $ts"
    accessToken = "test_token_$ts"
    status = "active"
} | ConvertTo-Json
$fanpage = Safe-Request -Method POST -Uri "$BaseUrl/fanpages" -Headers $h -Body $fanpageBody -Label "CreateFanpage"
$testFanpageId = if ($fanpage -and $fanpage._id) { $fanpage._id } else { $null }
if ($testFanpageId) { Write-Info "Fanpage created: $testFanpageId" }

# If no agent found, use logged-in director user as fallback
if (-not $testAgentId) {
    $profile = Safe-Request -Method GET -Uri "$BaseUrl/auth/profile" -Headers $h -Label "GetProfile"
    $testAgentId = if ($profile -and $profile._id) { $profile._id } else { $null }
    if ($testAgentId) { Write-Info "Using director as agentId fallback: $testAgentId" }
}

Write-Step "2.1" "Create Ad Group"
$ag1Body = @{
    name = "Test AG $ts"
    adGroupId = "test-ag-auto-$ts"
    platform = "facebook"
    adAccountId = if ($acc1Id) { $acc1Id } else { "000000000000000000000000" }
    productCategoryId = $testCatId
    agentId = $testAgentId
    fanpageId = $testFanpageId
    isActive = $true
    notes = "Auto test ad group"
    description = "Test ad group for automation"
} | ConvertTo-Json
$ag1 = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $ag1Body -Label "CreateAdGroup1"
if ($ag1 -and $ag1._id) {
    $ag1Id = $ag1._id
    $ag1AdGroupId = $ag1.adGroupId
    Write-Pass "Ad Group created: $ag1Id (adGroupId=$ag1AdGroupId)"
} else { Write-Fail "Create ad group failed" }

Write-Step "2.2" "Create second Ad Group (Google)"
$ag2Body = @{
    name = "Test AG Google $ts"
    adGroupId = "test-ag-gg-$ts"
    platform = "google"
    adAccountId = if ($acc2Id) { $acc2Id } else { "000000000000000000000000" }
    productCategoryId = $testCatId
    agentId = $testAgentId
    fanpageId = $testFanpageId
    isActive = $true
} | ConvertTo-Json
$ag2 = Safe-Request -Method POST -Uri "$BaseUrl/ad-groups" -Headers $h -Body $ag2Body -Label "CreateAdGroup2"
if ($ag2 -and $ag2._id) {
    $ag2Id = $ag2._id
    Write-Pass "Ad Group Google created: $ag2Id"
} else { Write-Fail "Create Google ad group failed" }

Write-Step "2.3" "List Ad Groups"
$agList = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups" -Headers $h -Label "ListAdGroups"
if ($agList -ne $null) {
    $ags = if ($agList -is [array]) { $agList } elseif ($agList.data) { $agList.data } else { @($agList) }
    Write-Pass "Ad Groups found: $($ags.Count)"
} else { Write-Fail "List ad groups failed" }

Write-Step "2.4" "Search Ad Groups"
$agSearch = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/search?query=Test" -Headers $h -Label "SearchAdGroups"
if ($agSearch -ne $null) { Write-Pass "Search ad groups OK" } else { Write-Fail "Search ad groups failed" }

Write-Step "2.5" "Validate adGroupId"
if ($ag1AdGroupId) {
    $agVal = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/validate/adgroupid/$ag1AdGroupId" -Headers $h -Label "ValidateAG"
    if ($agVal -ne $null) { Write-Pass "Validate adGroupId OK" } else { Write-Fail "Validate adGroupId failed" }
}

Write-Step "2.6" "Get single Ad Group"
if ($ag1Id) {
    $agGet = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/$ag1Id" -Headers $h -Label "GetAdGroup"
    if ($agGet -and $agGet._id) { Write-Pass "Get ad group OK: $($agGet.name)" } else { Write-Fail "Get ad group failed" }
}

Write-Step "2.7" "Update Ad Group"
if ($ag1Id) {
    $agUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/ad-groups/$ag1Id" -Headers $h -Body '{"notes":"Updated by auto test","isActive":true}' -Label "UpdateAdGroup"
    if ($agUpd) { Write-Pass "Ad Group updated" } else { Write-Fail "Update ad group failed" }
}

Write-Step "2.8" "Lookup by adGroupId"
if ($ag1AdGroupId) {
    $agLookup = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/lookup/$ag1AdGroupId" -Headers $h -Label "LookupAdGroup"
    if ($agLookup) { Write-Pass "Lookup OK" } else { Write-Fail "Lookup failed" }
}

Write-Step "2.9" "Sync status"
$syncSt = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/sync/status" -Headers $h -Label "SyncStatus"
if ($syncSt -ne $null) { Write-Pass "Sync status OK" } else { Write-Fail "Sync status failed" }

Write-Step "2.10" "Ad Group recommendations"
$agRec = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/recommendations" -Headers $h -Label "Recommendations"
if ($agRec -ne $null) { Write-Pass "Recommendations OK" } else { Write-Info "Recommendations returned empty (may require data)" }

Write-Step "2.11" "Counts by product"
$agCounts = Safe-Request -Method GET -Uri "$BaseUrl/ad-groups/stats/counts-by-product" -Headers $h -Label "CountsByProduct"
if ($agCounts -ne $null) { Write-Pass "Counts by product OK" } else { Write-Info "Counts by product returned empty (may require data)" }

Write-Step "2.12" "Delete Ad Group (Google)"
if ($ag2Id) {
    $agDel = Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$ag2Id" -Headers $h -Label "DeleteAdGroup"
    if ($agDel -ne $null) { Write-Pass "Ad Group deleted: $ag2Id" } else { Write-Fail "Delete ad group failed" }
}

# ===== PHASE 3: ADVERTISING COST =====
Write-Section "PHASE 3: Advertising Cost"

# Use the ad group we just created in Phase 2
$costAdGroupId = $ag1AdGroupId
if (-not $costAdGroupId) {
    Write-Info "No ad group adGroupId available for advertising cost tests"
}

Write-Step "3.1" "Create advertising cost entry"
if ($costAdGroupId) {
    $acBody = @{
        adGroupId = $costAdGroupId
        channel = "facebook"
        date = "2026-02-15"
        spentAmount = 2500000
        impressions = 50000
        clicks = 1500
        reach = 30000
        cpm = 50000
        cpc = 1667
        messagingConversationStarted7d = 200
        costPerMessagingConversation = 12500
    } | ConvertTo-Json
    $ac1 = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $acBody -Label "CreateAdCost"
    if ($ac1 -and $ac1._id) {
        $ac1Id = $ac1._id
        Write-Pass "Ad cost created: $ac1Id (spent=$($ac1.spentAmount))"
    } else { Write-Fail "Create ad cost failed" }
}

Write-Step "3.2" "Create second ad cost entry (different date)"
if ($costAdGroupId) {
    $ac2Body = @{
        adGroupId = $costAdGroupId
        channel = "facebook"
        date = "2026-02-14"
        spentAmount = 1800000
        impressions = 35000
        clicks = 1000
        reach = 22000
    } | ConvertTo-Json
    $ac2 = Safe-Request -Method POST -Uri "$BaseUrl/advertising-cost" -Headers $h -Body $ac2Body -Label "CreateAdCost2"
    if ($ac2 -and $ac2._id) {
        $ac2Id = $ac2._id
        Write-Pass "Ad cost #2 created: $ac2Id"
    } else { Write-Fail "Create ad cost #2 failed" }
}

Write-Step "3.3" "List advertising costs"
$acList = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost" -Headers $h -Label "ListAdCosts"
if ($acList -ne $null) { Write-Pass "List ad costs OK" } else { Write-Fail "List ad costs failed" }

Write-Step "3.4" "Summary stats"
$acSummary = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost/stats/summary" -Headers $h -Label "AdCostSummary"
if ($acSummary) { Write-Pass "Ad cost summary OK" } else { Write-Fail "Ad cost summary failed" }

Write-Step "3.5" "Daily summary"
$acDaily = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost/stats/daily-summary?dateFrom=2026-02-01&dateTo=2026-02-28" -Headers $h -Label "DailySummary"
if ($acDaily -ne $null) { Write-Pass "Daily summary OK" } else { Write-Fail "Daily summary failed" }

Write-Step "3.6" "Stats by ad group"
if ($costAdGroupId) {
    $acByAG = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost/stats/by-adgroup?adGroupId=$costAdGroupId" -Headers $h -Label "ByAdGroup"
    if ($acByAG -ne $null) { Write-Pass "Stats by ad group OK" } else { Write-Fail "Stats by ad group failed" }
}

Write-Step "3.7" "Conversation cost"
if ($costAdGroupId) {
    $acConv = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost/stats/conversation-cost?adGroupId=$costAdGroupId" -Headers $h -Label "ConvCost"
    if ($acConv -ne $null) { Write-Pass "Conversation cost OK" } else { Write-Fail "Conversation cost failed" }
}

Write-Step "3.8" "Cashflow summary"
$acCF = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost/summary/cashflow" -Headers $h -Label "AdCostCashflow"
if ($acCF -ne $null) { Write-Pass "Ad cost cashflow summary OK" } else { Write-Fail "Ad cost cashflow failed" }

Write-Step "3.9" "Update advertising cost"
if ($ac1Id) {
    $acUpd = Safe-Request -Method PATCH -Uri "$BaseUrl/advertising-cost/$ac1Id" -Headers $h -Body '{"spentAmount":2700000}' -Label "UpdateAdCost"
    if ($acUpd) { Write-Pass "Ad cost updated to 2700000" } else { Write-Fail "Update ad cost failed" }
}

Write-Step "3.10" "Delete advertising cost #2"
if ($ac2Id) {
    $acDel = Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$ac2Id" -Headers $h -Label "DeleteAdCost"
    if ($acDel -ne $null) { Write-Pass "Ad cost #2 deleted" } else { Write-Fail "Delete ad cost failed" }
}

Write-Step "3.11" "Yesterday spent (public)"
$yest = Safe-Request -Method GET -Uri "$BaseUrl/advertising-cost-public/yesterday-spent" -Headers @{} -Label "YesterdaySpent"
if ($yest -ne $null) { Write-Pass "Yesterday spent OK" } else { Write-Fail "Yesterday spent failed" }

# ===== CLEANUP =====
Write-Section "PHASE 4: Cleanup"

Write-Step "4.1" "Cleanup test ad accounts"
if ($acc1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$acc1Id" -Headers $h -Label "CleanAcc1" | Out-Null; Write-Info "Deleted acc1" }
if ($acc2Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/ad-accounts/$acc2Id" -Headers $h -Label "CleanAcc2" | Out-Null; Write-Info "Deleted acc2" }

Write-Step "4.2" "Cleanup test ad groups"
if ($ag1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/ad-groups/$ag1Id" -Headers $h -Label "CleanAG1" | Out-Null; Write-Info "Deleted ag1" }

Write-Step "4.3" "Cleanup test ad costs"
if ($ac1Id) { Safe-Request -Method DELETE -Uri "$BaseUrl/advertising-cost/$ac1Id" -Headers $h -Label "CleanAC1" | Out-Null; Write-Info "Deleted ac1" }

Write-Step "4.4" "Cleanup test fanpage"
if ($testFanpageId) { Safe-Request -Method DELETE -Uri "$BaseUrl/fanpages/$testFanpageId" -Headers $h -Label "CleanFanpage" | Out-Null; Write-Info "Deleted fanpage" }

# ===== SUMMARY =====
Write-Section "KET QUA - AD ACCOUNT & AD GROUP MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) { Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green }
else { Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red; $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red } }
