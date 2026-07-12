# ============================================================
# E2E.ADS-AUTO-SCALE.PS1 [E2E-TC-002]
# ============================================================
# Goal: Verify advertising cost allocation, daily ROI reporting,
#       and capped auto-scale recommendations.
# Run : powershell -ExecutionPolicy Bypass -File .\tests\backend\suites\e2e\e2e.ads-auto-scale.ps1
# ============================================================

function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}

function Get-BackendHealthUrl {
    $healthUrl = $env:BACKEND_HEALTH_URL
    if (-not [string]::IsNullOrWhiteSpace($healthUrl)) {
        return $healthUrl.TrimEnd('/')
    }

    $baseUrl = Get-BackendBaseUrl
    if ($baseUrl -match '/api/?$') {
        return (($baseUrl -replace '/api/?$', '') + '/health')
    }

    return ($baseUrl.TrimEnd('/') + '/health')
}

$BASE_URL = Get-BackendBaseUrl
$HEALTH_URL = Get-BackendHealthUrl
$PASS = 0
$FAIL = 0
$SKIP = 0
$ERRORS = @()

$ctx = @{
    token = $null
    headers = @{}
    templateAdGroup = $null
    testAdGroup = $null
    testAdGroupId = $null
    restoreTemplateAdGroup = $null
    createdOrderIds = New-Object System.Collections.ArrayList
    createdAdCostIds = New-Object System.Collections.ArrayList
    createdFundingSourceId = $null
    yesterdayOrderIds = @()
    dateConfigs = @()
}

function Write-Pass { param($msg); Write-Host "  [PASS] $msg" -ForegroundColor Green; $global:PASS++ }
function Write-Fail { param($msg); Write-Host "  [FAIL] $msg" -ForegroundColor Red; $global:FAIL++; $global:ERRORS += $msg }
function Write-Skip { param($msg); Write-Host "  [SKIP] $msg" -ForegroundColor Yellow; $global:SKIP++ }
function Write-Info { param($msg); Write-Host "  [INFO] $msg" -ForegroundColor Cyan }

function Write-Section {
    param([string]$title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host " $title" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
}

function Invoke-Api {
    param(
        [string]$Method = "GET",
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
        }
        if ($null -ne $Body) {
            $params.ContentType = "application/json"
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        $resp = Invoke-RestMethod @params
        return @{ ok = $true; status = 200; data = $resp }
    } catch {
        $code = 0
        $errBody = ""
        if ($_.Exception.Response) {
            try { $code = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $errBody = $reader.ReadToEnd()
                }
            } catch {}
        }
        Write-Host "  [HTTP] $Method $Url => $code" -ForegroundColor DarkYellow
        if ($errBody) { Write-Host "         $errBody" -ForegroundColor DarkYellow }
        return @{ ok = $false; status = $code; error = $errBody }
    }
}

function Get-CollectionItems {
    param($data)

    if ($null -eq $data) { return @() }
    if ($data -is [System.Array]) { return $data }
    if ($data.data -is [System.Array]) { return $data.data }
    if ($data.items -is [System.Array]) { return $data.items }
    return @()
}

function Assert-Eq {
    param($actual, $expected, [string]$label)
    if ("$actual" -eq "$expected") {
        Write-Pass "$label = $actual"
    } else {
        Write-Fail "$label expected=$expected got=$actual"
    }
}

function Assert-Approx {
    param([double]$actual, [double]$expected, [double]$tolerance, [string]$label)
    if ([Math]::Abs($actual - $expected) -le $tolerance) {
        Write-Pass "$label ~= $expected (actual=$actual)"
    } else {
        Write-Fail "$label expected~=$expected actual=$actual tolerance=$tolerance"
    }
}

function Assert-GT {
    param([double]$actual, [double]$threshold, [string]$label)
    if ($actual -gt $threshold) {
        Write-Pass "$label ($actual) > $threshold"
    } else {
        Write-Fail "$label expected > $threshold got=$actual"
    }
}

function Assert-GTE {
    param([double]$actual, [double]$threshold, [string]$label)
    if ($actual -ge $threshold) {
        Write-Pass "$label ($actual) >= $threshold"
    } else {
        Write-Fail "$label expected >= $threshold got=$actual"
    }
}

function Assert-True {
    param([bool]$condition, [string]$label)
    if ($condition) {
        Write-Pass $label
    } else {
        Write-Fail $label
    }
}

function New-UtcDayConfig {
    param(
        [int]$DaysAgo,
        [int]$SpentAmount,
        [int]$CodAmount,
        [string]$Label
    )

    $base = (Get-Date).ToUniversalTime().Date.AddDays(-$DaysAgo)
    return @{
        label = $Label
        day = $base.ToString("yyyy-MM-dd")
        iso = $base.ToString("yyyy-MM-ddT00:00:00.000Z")
        spentAmount = $SpentAmount
        codAmount = $CodAmount
    }
}

function Remove-ByIdSafe {
    param(
        [string]$Url,
        [hashtable]$Headers
    )

    if (-not $Url) { return }
    $resp = Invoke-Api -Method DELETE -Url $Url -Headers $Headers
    if ($resp.ok) {
        Write-Info "Cleanup deleted: $Url"
    } else {
        Write-Info "Cleanup skip/fail: $Url"
    }
}

function Get-RelationId {
    param($value)

    if ($null -eq $value) { return $null }
    if ($value -is [string]) { return $value }
    if ($value._id) { return "$($value._id)" }
    if ($value.id) { return "$($value.id)" }
    return $null
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  E2E-TC-002: ADS OPTIMIZATION & AUTO-SCALE LOOP" -ForegroundColor White
Write-Host "  Target: $BASE_URL" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White

try {
    Write-Section "STEP 0: Login and isolated setup"

    $health = Invoke-Api -Method GET -Url $HEALTH_URL
    if (-not $health.ok) {
        Write-Fail "Backend health check failed. Start the backend before running this test."
        exit 1
    }
    Write-Pass "Health endpoint reachable"

    $login = Invoke-Api -Method POST -Url "$BASE_URL/auth/login" -Body @{
        email = "director@test.com"
        password = "123456"
    }
    if (-not $login.ok -or -not $login.data.access_token) {
        Write-Fail "Login failed"
        exit 1
    }
    $ctx.token = $login.data.access_token
    $ctx.headers = @{ Authorization = "Bearer $($ctx.token)" }
    Write-Pass "Login succeeded"

    $ctx.dateConfigs = @(
        (New-UtcDayConfig -DaysAgo 3 -SpentAmount 800000 -CodAmount 2200000 -Label "D-3"),
        (New-UtcDayConfig -DaysAgo 2 -SpentAmount 1300000 -CodAmount 3200000 -Label "D-2"),
        (New-UtcDayConfig -DaysAgo 1 -SpentAmount 500000 -CodAmount 1700000 -Label "Yesterday")
    )

    $adGroupsResp = Invoke-Api -Method GET -Url "$BASE_URL/ad-groups?limit=100" -Headers $ctx.headers
    $adGroups = Get-CollectionItems $adGroupsResp.data
    $template = $adGroups | Where-Object {
        $_.isActive -ne $false -and $_.platform -eq 'facebook' -and $_.fanpageId -and $_.agentId -and $_.adAccountId
    } | Select-Object -First 1
    if (-not $template) {
        $template = $adGroups | Where-Object {
            $_.isActive -ne $false -and $_.fanpageId -and $_.agentId -and $_.adAccountId
        } | Select-Object -First 1
    }
    if (-not $template) {
        Write-Fail "No active ad group template with fanpageId/agentId/adAccountId found"
        exit 1
    }
    $ctx.templateAdGroup = $template
    Write-Pass "Template ad group found: $($template.adGroupId)"

    $templateFanpageId = Get-RelationId $template.fanpageId
    $templateAgentId = Get-RelationId $template.agentId
    $templateAdAccountId = Get-RelationId $template.adAccountId
    if (-not $templateFanpageId -or -not $templateAgentId -or -not $templateAdAccountId) {
        Write-Fail "Template ad group does not expose fanpageId/agentId/adAccountId as usable IDs"
        exit 1
    }

    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $testAdGroupBody = @{
        name = "E2E Auto Scale $stamp"
        adGroupId = "E2E-AUTO-$stamp"
        fanpageId = $templateFanpageId
        agentId = $templateAgentId
        adAccountId = $templateAdAccountId
        platform = "$($template.platform)"
        isActive = $true
        autoControlEnabled = $false
        dailyBudget = 1000000
        testingPhase = "MATURE"
        daysSinceLaunch = 45
        frequency = 1.2
        reach = 150000
        audienceSize = 1200000
        preferHorizontalScaling = $true
        notes = "Created by E2E-TC-002"
    }
    $createAdGroup = Invoke-Api -Method POST -Url "$BASE_URL/ad-groups" -Headers $ctx.headers -Body $testAdGroupBody
    if ($createAdGroup.ok -and $createAdGroup.data._id) {
        $ctx.testAdGroup = $createAdGroup.data
        $ctx.testAdGroupId = $createAdGroup.data.adGroupId
        Write-Pass "Created isolated ad group: $($ctx.testAdGroupId)"
    } else {
        Write-Skip "Isolated ad group creation failed, reusing the template ad group for this run"
        $ctx.restoreTemplateAdGroup = @{
            dailyBudget = $template.dailyBudget
            testingPhase = $template.testingPhase
            daysSinceLaunch = $template.daysSinceLaunch
            frequency = $template.frequency
            reach = $template.reach
            audienceSize = $template.audienceSize
            preferHorizontalScaling = $template.preferHorizontalScaling
            notes = $template.notes
        }

        $templatePatch = Invoke-Api -Method PATCH -Url "$BASE_URL/ad-groups/$($template._id)" -Headers $ctx.headers -Body @{
            dailyBudget = 1000000
            testingPhase = 'MATURE'
            daysSinceLaunch = 45
            frequency = 1.2
            reach = 150000
            audienceSize = 1200000
            preferHorizontalScaling = $true
            notes = 'Temporarily updated by E2E-TC-002'
        }
        if (-not $templatePatch.ok) {
            Write-Fail "Failed to patch template ad group after create fallback"
            exit 1
        }
        $ctx.testAdGroup = $templatePatch.data
        $ctx.testAdGroupId = $template.adGroupId
        Write-Pass "Reused template ad group: $($ctx.testAdGroupId)"
    }

    $fundingSourcesResp = Invoke-Api -Method GET -Url "$BASE_URL/finance/funding-sources?status=active" -Headers $ctx.headers
    $fundingSources = Get-CollectionItems $fundingSourcesResp.data
    $activeFundingBalance = ($fundingSources | Measure-Object -Property availableBalance -Sum).Sum
    if (-not $activeFundingBalance) { $activeFundingBalance = 0 }
    if ([double]$activeFundingBalance -lt 10000000) {
        $fundingBody = @{
            name = "E2E Reinvestment $stamp"
            type = "internal"
            availableBalance = 20000000
            principal = 20000000
            status = "active"
            notes = "Temporary source for E2E-TC-002"
            startDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
        }
        $fundingCreate = Invoke-Api -Method POST -Url "$BASE_URL/finance/funding-sources" -Headers $ctx.headers -Body $fundingBody
        if ($fundingCreate.ok -and $fundingCreate.data._id) {
            $ctx.createdFundingSourceId = $fundingCreate.data._id
            Write-Pass "Created temporary funding source for reinvestment capacity"
        } else {
            Write-Skip "Could not create temporary funding source; relying on existing capital"
        }
    } else {
        Write-Pass "Existing active funding sources are sufficient"
    }

    Write-Section "STEP 1: Seed orders and mock advertising costs"

    foreach ($config in $ctx.dateConfigs) {
        Write-Info "Seeding $($config.label): date=$($config.day), spend=$($config.spentAmount), COD=$($config.codAmount)"

        $dateOrderIds = @()
        foreach ($index in 1..2) {
            $orderBody = @{
                customerName = "E2E Ads $stamp $($config.label) #$index"
                adGroupId = $ctx.testAdGroupId
                quantity = 1
                orderStatus = "Giao thành công"
                codAmount = $config.codAmount
                codCollectedBySupplier = $config.codAmount
                shippingFee = 50000
                supplierAppliedPrice = 150000
                orderDate = $config.iso
                isActive = $true
            }

            $createOrder = Invoke-Api -Method POST -Url "$BASE_URL/test-order2" -Headers $ctx.headers -Body $orderBody
            if (-not $createOrder.ok -or -not $createOrder.data._id) {
                Write-Fail "Failed to create order for $($config.label)"
                exit 1
            }

            [void]$ctx.createdOrderIds.Add($createOrder.data._id)
            $dateOrderIds += $createOrder.data._id
            Write-Pass "Created order $($createOrder.data._id) for $($config.label)"
        }

        if ($config.label -eq 'Yesterday') {
            $ctx.yesterdayOrderIds = $dateOrderIds
        }

        $adCostBody = @{
            adGroupId = $ctx.testAdGroupId
            date = $config.iso
            spentAmount = $config.spentAmount
            impressions = 5000
            clicks = 200
            reach = 3500
            messagingConversationStarted7d = 2
        }
        $createAdCost = Invoke-Api -Method POST -Url "$BASE_URL/advertising-cost" -Headers $ctx.headers -Body $adCostBody
        if (-not $createAdCost.ok -or -not $createAdCost.data._id) {
            Write-Fail "Failed to create advertising cost for $($config.label)"
            exit 1
        }
        [void]$ctx.createdAdCostIds.Add($createAdCost.data._id)
        Write-Pass "Created advertising cost $($createAdCost.data._id) for $($config.label)"

        $recalc = Invoke-Api -Method POST -Url "$BASE_URL/test-order2/cron/recalculate-costs?date=$($config.day)" -Headers $ctx.headers
        if ($recalc.ok) {
            Write-Pass "Recalculated cost allocations for $($config.day)"
        } else {
            Write-Fail "Failed to recalculate cost allocations for $($config.day)"
            exit 1
        }
    }

    Write-Section "STEP 2: Verify yesterday order cost allocation"

    foreach ($orderId in $ctx.yesterdayOrderIds) {
        $orderResp = Invoke-Api -Method GET -Url "$BASE_URL/test-order2/$orderId" -Headers $ctx.headers
        if (-not $orderResp.ok -or -not $orderResp.data) {
            Write-Fail "Could not load order $orderId"
            continue
        }

        $order = $orderResp.data
        Assert-Approx -actual ([double]$order.advertisingCost) -expected 250000 -tolerance 1 -label "Order $orderId advertisingCost"

        $expectedNet = [double]$order.grossProfit - [double]($order.advertisingCost | ForEach-Object { $_ }) - [double]($order.laborCostAllocation | ForEach-Object { if ($null -eq $_) { 0 } else { $_ } }) - [double]($order.otherCostAllocation | ForEach-Object { if ($null -eq $_) { 0 } else { $_ } })
        Assert-Approx -actual ([double]$order.netProfit) -expected $expectedNet -tolerance 1 -label "Order $orderId netProfit formula"
    }

    Write-Section "STEP 3: Sync daily report and verify ROI + funds"

    $yesterdayConfig = $ctx.dateConfigs | Where-Object { $_.label -eq 'Yesterday' } | Select-Object -First 1
    $syncReport = Invoke-Api -Method POST -Url "$BASE_URL/ad-group-daily-report/sync?date=$($yesterdayConfig.day)" -Headers $ctx.headers
    if (-not $syncReport.ok) {
        Write-Fail "Daily report sync failed"
        exit 1
    }
    Write-Pass "Daily report sync completed for $($yesterdayConfig.day)"

    $reportResp = Invoke-Api -Method GET -Url "$BASE_URL/ad-group-daily-report?adGroupId=$($ctx.testAdGroupId)&fromDate=$($yesterdayConfig.day)&toDate=$($yesterdayConfig.day)" -Headers $ctx.headers
    if (-not $reportResp.ok) {
        Write-Fail "Failed to fetch daily report"
        exit 1
    }

    $report = $reportResp.data
    $summaryAdsCost = [double]($report.summary.totalAdsCost)
    $summaryNetProfit = [double]($report.summary.totalNetProfit)
    $computedRoi = if ($summaryAdsCost -gt 0) { $summaryNetProfit / $summaryAdsCost } else { 0 }

    Assert-Approx -actual $summaryAdsCost -expected 500000 -tolerance 1 -label "Daily report totalAdsCost"
    Assert-GT -actual $computedRoi -threshold 1.5 -label "Daily report ROI ratio"

    Start-Sleep -Seconds 1
    $adsFundResp = Invoke-Api -Method GET -Url "$BASE_URL/funds/ads" -Headers $ctx.headers
    if ($adsFundResp.ok -and $adsFundResp.data.breakdown) {
        Assert-GTE -actual ([double]$adsFundResp.data.breakdown.adsSpent) -threshold 500000 -label "Ads fund spent breakdown"
    } else {
        Write-Skip "Funds API not available for ads breakdown assertion"
    }

    Write-Section "STEP 4: Verify auto-scale recommendation and clone hint"

    $allocationResp = Invoke-Api -Method POST -Url "$BASE_URL/budget-allocation/auto" -Headers $ctx.headers -Body @{
        dryRun = $true
        priorityMode = "roi"
        minBudget = 50000
        maxBudget = 10000000
    }
    if (-not $allocationResp.ok) {
        Write-Fail "Budget allocation auto run failed"
        exit 1
    }

    $allocation = $allocationResp.data.allocations | Where-Object { $_.adGroupId -eq $ctx.testAdGroupId } | Select-Object -First 1
    if (-not $allocation) {
        Write-Fail "Isolated ad group not present in budget allocation result"
        exit 1
    }

    Assert-Eq -actual $allocation.action -expected "SCALE_UP" -label "Allocation action"
    Assert-Approx -actual ([double]$allocation.currentBudget) -expected 1000000 -tolerance 1 -label "Allocation baseline budget"
    Assert-Approx -actual ([double]$allocation.allocatedBudget) -expected 1200000 -tolerance 1 -label "Allocation capped budget"
    Assert-True -condition ([bool]$allocation.scaleCapped) -label "Scale capped at +20%"

    $suggestions = @($allocationResp.data.suggestions)
    Assert-True -condition ($suggestions -contains 'CLONE_AD_GROUP') -label "Top-level suggestions contain CLONE_AD_GROUP"
    $suggestionText = ($suggestions -join ' | ')
    Assert-True -condition ($suggestionText -match 'Lookalike Audience|Broad') -label "Top-level suggestions include audience expansion hint"

    if ($allocationResp.data.horizontalScaling) {
        Assert-True -condition ([bool]$allocationResp.data.horizontalScaling.canCreateNewGroups) -label "Horizontal scaling available"
    } else {
        Write-Fail "Horizontal scaling recommendation was not generated"
    }
}
finally {
    Write-Section "TEARDOWN"

    if ($ctx.headers.Authorization) {
        foreach ($adCostId in @($ctx.createdAdCostIds)) {
            Remove-ByIdSafe -Url "$BASE_URL/advertising-cost/$adCostId" -Headers $ctx.headers
        }

        foreach ($orderId in @($ctx.createdOrderIds)) {
            Remove-ByIdSafe -Url "$BASE_URL/test-order2/$orderId" -Headers $ctx.headers
        }

        if ($ctx.restoreTemplateAdGroup -and $ctx.templateAdGroup -and $ctx.templateAdGroup._id) {
            $restoreResp = Invoke-Api -Method PATCH -Url "$BASE_URL/ad-groups/$($ctx.templateAdGroup._id)" -Headers $ctx.headers -Body $ctx.restoreTemplateAdGroup
            if ($restoreResp.ok) {
                Write-Info "Cleanup restored template ad group $($ctx.templateAdGroup.adGroupId)"
            } else {
                Write-Info "Cleanup could not restore template ad group $($ctx.templateAdGroup.adGroupId)"
            }
        } elseif ($ctx.testAdGroup -and $ctx.testAdGroup._id) {
            Remove-ByIdSafe -Url "$BASE_URL/ad-groups/$($ctx.testAdGroup._id)" -Headers $ctx.headers
        }

        if ($ctx.createdFundingSourceId) {
            $closeFunding = Invoke-Api -Method PATCH -Url "$BASE_URL/finance/funding-sources/$($ctx.createdFundingSourceId)" -Headers $ctx.headers -Body @{
                status = 'closed'
                availableBalance = 0
                notes = 'Closed by E2E-TC-002 cleanup'
            }
            if ($closeFunding.ok) {
                Write-Info "Cleanup closed funding source $($ctx.createdFundingSourceId)"
            } else {
                Write-Info "Cleanup could not close funding source $($ctx.createdFundingSourceId)"
            }
        }
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  RESULT: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White

if ($FAIL -gt 0) {
    Write-Host ""
    Write-Host "Errors:" -ForegroundColor Red
    $ERRORS | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
}

exit 0
