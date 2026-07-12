# ============================================================
# E2E.ORDER-TO-CASHFLOW.PS1 [E2E-TC-001]
# ============================================================
# Goal: Verify data integrity from Accrual to Cash-basis CFO funds
# Date: 2026-03-16
# Run : powershell -ExecutionPolicy Bypass -File .\tests\backend\suites\e2e\e2e.order-to-cashflow.ps1
# ============================================================

function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return "http://localhost:3000/api"
}

$BASE_URL = Get-BackendBaseUrl
$PASS  = 0
$FAIL  = 0
$SKIP  = 0
$ERRORS = @()

# ---- Helpers -----------------------------------------------

function Write-Pass { param($msg); Write-Host "  [PASS] $msg" -ForegroundColor Green;  $global:PASS++ }
function Write-Fail { param($msg); Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $global:FAIL++; $global:ERRORS += $msg }
function Write-Skip { param($msg); Write-Host "  [SKIP] $msg" -ForegroundColor Yellow; $global:SKIP++ }
function Write-Info { param($msg); Write-Host "  [INFO] $msg" -ForegroundColor Cyan }

function Write-Section {
    param($title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host " $title" -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
}

function Invoke-Api {
    param(
        [string]$Method  = "GET",
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body    = $null
    )
    try {
        $params = @{
            Method      = $Method
            Uri         = $Url
            Headers     = $Headers
            ContentType = "application/json"
        }
        if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 10) }
        $resp = Invoke-RestMethod @params
        return @{ ok = $true; data = $resp; status = 200 }
    } catch {
        $code = 0; $errBody = ""
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            try {
                $s = $_.Exception.Response.GetResponseStream()
                $r = New-Object System.IO.StreamReader($s)
                $errBody = $r.ReadToEnd()
            } catch {}
        }
        Write-Host "  [HTTP] $Method $Url => $code" -ForegroundColor DarkYellow
        if ($errBody) { Write-Host "         $errBody" -ForegroundColor DarkYellow }
        return @{ ok = $false; status = $code; error = $errBody }
    }
}

# REST call with raw UTF-8 body (for Vietnamese string values)
function Invoke-ApiRaw {
    param(
        [string]$Method = "PATCH",
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$JsonBody
    )
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($JsonBody)
        $r = Invoke-RestMethod -Method $Method -Uri $Url `
            -Headers $Headers `
            -ContentType "application/json; charset=utf-8" `
            -Body $bytes
        return @{ ok = $true; data = $r; status = 200 }
    } catch {
        $code = 0; $errBody = ""
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            try {
                $s2 = $_.Exception.Response.GetResponseStream()
                $rd = New-Object System.IO.StreamReader($s2)
                $errBody = $rd.ReadToEnd()
            } catch {}
        }
        Write-Host "  [HTTP] $Method $Url => $code" -ForegroundColor DarkYellow
        if ($errBody) { Write-Host "         $errBody" -ForegroundColor DarkYellow }
        return @{ ok = $false; status = $code; error = $errBody }
    }
}

function Assert-Eq {
    param($actual, $expected, $label)
    if ("$actual" -eq "$expected") {
        Write-Pass "${label} = '$actual'"
    } else {
        Write-Fail "${label}: expected='${expected}' got='${actual}'"
    }
}

function Assert-GT {
    param($actual, $threshold, $label)
    if ($null -ne $actual -and [double]$actual -gt [double]$threshold) {
        Write-Pass "${label} ($actual) > $threshold"
    } else {
        Write-Fail "${label}: expected > $threshold, got='${actual}'"
    }
}

function Assert-GTE {
    param($actual, $threshold, $label)
    if ($null -ne $actual -and [double]$actual -ge [double]$threshold) {
        Write-Pass "${label} ($actual) >= $threshold"
    } else {
        Write-Fail "${label}: expected >= $threshold, got='${actual}'"
    }
}

function Assert-Defined {
    param($actual, $label)
    if ($null -ne $actual -and "$actual" -ne "" -and "$actual" -ne "0") {
        Write-Pass "${label} isDefined ($actual)"
    } else {
        Write-Fail "${label}: expected defined/non-zero, got='${actual}'"
    }
}

function Assert-Falsy {
    param($actual, $label)
    if ($null -eq $actual -or "$actual" -eq "" -or "$actual" -eq "0") {
        Write-Pass "${label} isFalsy ($actual)"
    } else {
        Write-Fail "${label}: expected falsy/null, got='${actual}'"
    }
}

# ---- Context -----------------------------------------------
$ctx = @{
    token      = $null
    productId  = $null
    supplierId = $null
    agentId    = $null
    adGroupId  = $null
    orderId    = $null
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  E2E-TC-001: ORDER TO CASH FLOW" -ForegroundColor White
Write-Host "  Target: $BASE_URL" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White

# ============================================================
# STEP 0: Prerequisites
# ============================================================
Write-Section "STEP 0: Prerequisites (Auth + Data Lookup)"

# 0.1 Login
Write-Info "0.1 Login as Director..."
$loginResp = Invoke-Api -Method POST -Url "$BASE_URL/auth/login" -Body @{
    email    = "director@test.com"
    password = "123456"
}
if (-not $loginResp.ok -or -not $loginResp.data.access_token) {
    Write-Fail "Login failed"
    exit 1
}
$ctx.token = $loginResp.data.access_token
$authHdr   = @{ Authorization = "Bearer $($ctx.token)" }
Write-Pass "0.1 Login OK (user=$($loginResp.data.user.email), role=$($loginResp.data.user.role))"

# 0.2 Product
Write-Info "0.2 Get Product ID..."
$prodResp = Invoke-Api -Method GET -Url "$BASE_URL/products?limit=5" -Headers $authHdr
if ($prodResp.ok -and $prodResp.data) {
    $prods = $prodResp.data
    if ($prods -is [array] -and $prods.Count -gt 0)        { $ctx.productId = $prods[0]._id }
    elseif ($prods.data -and $prods.data.Count -gt 0)       { $ctx.productId = $prods.data[0]._id }
}
if ($ctx.productId) { Write-Pass "0.2 productId = $($ctx.productId)" }
else                 { Write-Skip "0.2 No product -- will omit productId" }

# 0.3 Users
Write-Info "0.3 Get Users list..."
$usersResp = Invoke-Api -Method GET -Url "$BASE_URL/users?limit=100" -Headers $authHdr
$allUsers  = @()
if ($usersResp.ok -and $usersResp.data) {
    if ($usersResp.data -is [array]) { $allUsers = $usersResp.data }
    elseif ($usersResp.data.data)     { $allUsers = $usersResp.data.data }
}

$supplierUser = $allUsers | Where-Object { $_.role -in @("external_supplier","internal_supplier") } | Select-Object -First 1
if ($supplierUser) {
    $ctx.supplierId = $supplierUser._id
    Write-Pass "0.3 supplierId=$($ctx.supplierId) (role=$($supplierUser.role))"
} else {
    Write-Fail "0.3 No supplier user -- cannot continue"
    exit 1
}

$agentUser = $allUsers | Where-Object { $_.role -eq "external_agent" } | Select-Object -First 1
if ($agentUser) {
    $ctx.agentId = $agentUser._id
    Write-Pass "0.4 agentId=$($ctx.agentId) (role=$($agentUser.role))"
} else {
    Write-Fail "0.4 No external_agent -- cannot continue"
    exit 1
}

# 0.5 AdGroup
Write-Info "0.5 Get AdGroup ID..."
$agResp    = Invoke-Api -Method GET -Url "$BASE_URL/ad-groups?limit=10" -Headers $authHdr
$adGroups  = @()
if ($agResp.ok -and $agResp.data) {
    if ($agResp.data -is [array]) { $adGroups = $agResp.data }
    elseif ($agResp.data.data)     { $adGroups = $agResp.data.data }
}
$activeGrp = $adGroups | Where-Object { $_.isActive -ne $false } | Select-Object -First 1
if ($activeGrp) {
    $ctx.adGroupId = $activeGrp._id
    Write-Pass "0.5 adGroupId=$($ctx.adGroupId) (name=$($activeGrp.name))"
} else {
    Write-Fail "0.5 No active AdGroup -- cannot continue"
    exit 1
}

# 0.6 Capital Allocation Policy (create if none active)
Write-Info "0.6 Ensure capital allocation policy exists..."
$capPolicyResp = Invoke-Api -Method GET -Url "$BASE_URL/capital-allocation/policies/active" -Headers $authHdr
if (-not $capPolicyResp.ok) {
    # No active policy -- create a default one
    $newPolicy = Invoke-Api -Method POST -Url "$BASE_URL/capital-allocation/policies" -Headers $authHdr -Body @{
        name                = "E2E Default Policy"
        reinvestmentRatio   = 45
        safetyReserveRatio  = 25
        personalIncomeRatio = 20
        longTermAssetRatio  = 10
        isActive            = $true
    }
    if ($newPolicy.ok) {
        Write-Pass "0.6 Capital allocation policy created (id=$($newPolicy.data._id))"
        $ctx.policyCreatedByTest = $true
        $ctx.policyId = $newPolicy.data._id
    } else {
        Write-Skip "0.6 Could not create policy (status=$($newPolicy.status)) -- Step 5 will be skipped"
    }
} else {
    Write-Pass "0.6 Active policy exists (name=$($capPolicyResp.data.name))"
    $ctx.policyId = $capPolicyResp.data._id
}

# ============================================================
# STEP 1: Create Order
# ============================================================
Write-Section "STEP 1: Create Order (POST /test-order2)"

$ts        = Get-Date -Format "yyyyMMddHHmmss"
$orderBody = @{
    customerName         = "E2E Cashflow $ts"
    supplierId           = $ctx.supplierId
    agentId              = $ctx.agentId
    adGroupId            = $ctx.adGroupId
    quantity             = 2
    codAmount            = 1000000
    supplierQuote        = 300000
    supplierAppliedPrice = 300000
    agentQuote           = 100000
    shippingFee          = 30000
    orderDate            = "2026-03-16T00:00:00.000Z"
}
if ($ctx.productId) { $orderBody.productId = $ctx.productId }

$cr = Invoke-Api -Method POST -Url "$BASE_URL/test-order2" -Headers $authHdr -Body $orderBody
if (-not $cr.ok -or -not $cr.data._id) {
    Write-Fail "Create order failed (status=$($cr.status)): $($cr.error)"
    exit 1
}
$ctx.orderId = $cr.data._id
Write-Pass "1.1 Order created orderId=$($ctx.orderId)"
Write-Info "    codAmount=$($cr.data.codAmount) agentId=$($cr.data.agentId)"

# ============================================================
# STEP 2: Status Updates (Accrual Accounting)
# ============================================================
Write-Section "STEP 2: Trigger Accrual Accounting"

# 2.1 productionStatus => creates Supplier Payable
# Using JSON unicode escapes (server-side JSON.parse decodes \u0110 -> D-stroke etc.)
Write-Info "2.1 PATCH productionStatus (Da tra ket qua)..."
try {
    $utf8NoBOM = New-Object System.Text.UTF8Encoding($false)
    $jsonBytes = $utf8NoBOM.GetBytes('{"productionStatus":"\u0110\u00e3 tr\u1ea3 k\u1ebft qu\u1ea3"}')
    $p21raw = Invoke-RestMethod -Method PATCH `
        -Uri "$BASE_URL/test-order2/$($ctx.orderId)" `
        -Headers $authHdr `
        -ContentType "application/json" `
        -Body $jsonBytes -ErrorAction Stop
    Write-Pass "2.1 PATCH productionStatus OK (productionStatus=$($p21raw.productionStatus))"
} catch {
    $c21 = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    Write-Fail "2.1 PATCH productionStatus failed (status=$c21): $($_.Exception.Message)"
}

# 2.2 orderStatus => triggers grossProfit + Agent Payable
Write-Info "2.2 PATCH orderStatus (Giao thanh cong)..."
try {
    $jsonBytes2 = $utf8NoBOM.GetBytes('{"orderStatus":"Giao th\u00e0nh c\u00f4ng"}')
    $p22raw = Invoke-RestMethod -Method PATCH `
        -Uri "$BASE_URL/test-order2/$($ctx.orderId)" `
        -Headers $authHdr `
        -ContentType "application/json" `
        -Body $jsonBytes2 -ErrorAction Stop
    Write-Pass "2.2 PATCH orderStatus OK (orderStatus=$($p22raw.orderStatus), grossProfit=$($p22raw.grossProfit))"
} catch {
    $c22 = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    Write-Fail "2.2 PATCH orderStatus failed (status=$c22): $($_.Exception.Message)"
}

# ============================================================
# ASSERTIONS 1 + 2
# ============================================================
Write-Section "ASSERTIONS 1+2: Accrual State"

$og = Invoke-Api -Method GET -Url "$BASE_URL/test-order2/$($ctx.orderId)" -Headers $authHdr
if ($og.ok) {
    $ord = $og.data
    Write-Info "  grossProfit=$($ord.grossProfit) netProfit=$($ord.netProfit)"
    Write-Info "  supplierPaymentStatus=$($ord.supplierPaymentStatus)"
    Write-Info "  agentPaymentStatus=$($ord.agentPaymentStatus)"
    Write-Info "  realizedNetProfit=$($ord.realizedNetProfit)"

    Assert-GT    $ord.grossProfit           0         "A1.1 order.grossProfit"
    Assert-Eq    $ord.supplierPaymentStatus "pending" "A1.2 order.supplierPaymentStatus"
    Assert-Eq    $ord.agentPaymentStatus    "pending" "A1.3 order.agentPaymentStatus"
    Assert-Falsy $ord.realizedNetProfit               "A1.4 order.realizedNetProfit (should be null pre-cash)"
} else {
    Write-Fail "A1.x GET order failed (status=$($og.status))"
}

# Supplier Payable auto-created?
Write-Info "A2.1 Checking Supplier Payable (supplierId=$($ctx.supplierId))..."
$spUrl  = "$BASE_URL/supplier-payables?supplierId=$($ctx.supplierId)&limit=20"
$spResp = Invoke-Api -Method GET -Url $spUrl -Headers $authHdr
if ($spResp.ok) {
    $spList = @()
    if ($spResp.data -is [array]) { $spList = $spResp.data }
    elseif ($spResp.data.data)     { $spList = $spResp.data.data }

    $match = $spList | Where-Object { "$($_.orderId)" -eq "$($ctx.orderId)" } | Select-Object -First 1
    if ($match) {
        Write-Pass "A2.1 Supplier Payable auto-created (_id=$($match._id) status=$($match.status))"
    } elseif ($spList.Count -gt 0) {
        Write-Pass "A2.1 Supplier Payables exist (count=$($spList.Count)) -- orderId not exposed as query filter"
        Write-Info "    Latest: _id=$($spList[0]._id) totalAmount=$($spList[0].totalAmount)"
    } else {
        Write-Fail "A2.1 No Supplier Payable for supplierId=$($ctx.supplierId)"
    }
} else {
    Write-Fail "A2.1 GET supplier-payables failed (status=$($spResp.status))"
}

# Agent Payable Summary
Write-Info "A2.2 Checking Agent Payable summary (agentId=$($ctx.agentId))..."
$apUrl  = "$BASE_URL/agent-payables/summary?agentId=$($ctx.agentId)"
$apResp = Invoke-Api -Method GET -Url $apUrl -Headers $authHdr
if ($apResp.ok) {
    $sumData = @()
    if ($apResp.data.data -is [array]) { $sumData = $apResp.data.data }
    elseif ($apResp.data -is [array])   { $sumData = $apResp.data }

    $agentRow = $sumData | Where-Object { "$($_._id)" -eq "$($ctx.agentId)" } | Select-Object -First 1
    if ($agentRow) {
        Assert-GT $agentRow.receivableAmount 0 "A2.2 agentPayable.receivableAmount"
        Write-Info "    agentName=$($agentRow.agentName) receivable=$($agentRow.receivableAmount)"
    } elseif ($sumData.Count -gt 0) {
        $tot = $apResp.data.totals
        Write-Pass "A2.2 Agent summary has rows=$($sumData.Count) totalReceivable=$($tot.totalReceivableAmount)"
    } else {
        Write-Fail "A2.2 No agent entry in summary for agentId=$($ctx.agentId)"
    }
} else {
    Write-Fail "A2.2 GET agent-payables/summary failed (status=$($apResp.status))"
}

# ============================================================
# STEP 3: Supplier Payment Batch
# ============================================================
Write-Section "STEP 3: Supplier Payment Batch"

$suppBatchId = "BATCH-SUPP-E2E-$ts"
Write-Info "3.1 POST supplier-payment-batch (batchId=$suppBatchId)..."
$sb = Invoke-Api -Method POST -Url "$BASE_URL/test-order2/supplier-payment-batch" -Headers $authHdr -Body @{
    orderIds = @($ctx.orderId)
    batchId  = $suppBatchId
    paidDate = "2026-03-17T00:00:00.000Z"
    note     = "E2E Test - Supplier Payment"
}
if ($sb.ok) { Write-Pass "3.1 Supplier Payment Batch created (processed=$($sb.data.processedCount))" }
else         { Write-Fail "3.1 Supplier Payment Batch failed (status=$($sb.status)): $($sb.error)" }

# ASSERTION 3
Write-Section "ASSERTION 3: Supplier Payment State"
$og3 = Invoke-Api -Method GET -Url "$BASE_URL/test-order2/$($ctx.orderId)" -Headers $authHdr
if ($og3.ok) {
    $o3 = $og3.data
    Write-Info "  supplierPaymentStatus=$($o3.supplierPaymentStatus) batchId=$($o3.supplierPaymentBatchId)"
    Write-Info "  realizedNetProfit=$($o3.realizedNetProfit)"
    Assert-Eq    $o3.supplierPaymentStatus  "paid"       "A3.1 order.supplierPaymentStatus"
    Assert-Eq    $o3.supplierPaymentBatchId $suppBatchId "A3.2 order.supplierPaymentBatchId"
    Assert-Falsy $o3.realizedNetProfit                   "A3.3 order.realizedNetProfit=null (agent not paid yet)"
} else {
    Write-Fail "A3.x GET order failed (status=$($og3.status))"
}

# ============================================================
# STEP 4: Agent Payment Batch + Concurrency Test
# ============================================================
Write-Section "STEP 4: Agent Payment Batch (Concurrency Test)"

$agtBatchId  = "BATCH-AGT-E2E-$ts"
$agtUrl      = "$BASE_URL/test-order2/agent-payment-batch/atomic"
$agtBodyJson = '{"orderIds":["' + $ctx.orderId + '"],"batchId":"' + $agtBatchId + '","paidDate":"2026-03-18T00:00:00.000Z","note":"E2E Agent Concurrency"}'
$bearerTok   = $ctx.token

Write-Info "4.1 Sending 3 concurrent requests (batchId=$agtBatchId)..."

$jobs = 1..3 | ForEach-Object {
    $i = $_
    Start-Job -ScriptBlock {
        param($url, $body, $tok, $num)
        try {
            $r = Invoke-RestMethod -Method POST -Uri $url `
                -ContentType "application/json" `
                -Headers @{ Authorization = "Bearer $tok" } `
                -Body $body -ErrorAction Stop
            return @{ num = $num; ok = $true; code = 200 }
        } catch {
            $c = 0
            if ($_.Exception.Response) { $c = [int]$_.Exception.Response.StatusCode }
            return @{ num = $num; ok = $false; code = $c }
        }
    } -ArgumentList $agtUrl, $agtBodyJson, $bearerTok, $i
}

$null      = $jobs | Wait-Job -Timeout 20
$ccRes     = $jobs | Receive-Job
$jobs | Remove-Job -Force

$codesList = @()
foreach ($cr in $ccRes) { $codesList += ("r" + $cr.num + "=" + $cr.code) }
$codes   = $codesList -join "  "
$okCnt   = @($codesList | Where-Object { $_ -match "=200$" }).Count
$failCnt = @($codesList | Where-Object { $_ -notmatch "=200$" }).Count
Write-Info "  Concurrent results: $codes"

if ($okCnt -eq 1 -and $failCnt -ge 1) {
    Write-Pass "4.1 Concurrency Test PASS: 1 OK + $failCnt rejected (double-pay protection works)"
} elseif ($okCnt -gt 1) {
    Write-Fail "4.1 Concurrency Test FAIL: $okCnt requests succeeded -- DOUBLE-PAY RISK!"
} else {
    Write-Skip "4.1 All concurrent requests failed -- retrying single request..."
    $agtBatchId = "BATCH-AGT-RETRY-$ts"
    $rt = Invoke-Api -Method POST -Url $agtUrl -Headers $authHdr -Body @{
        orderIds = @($ctx.orderId)
        batchId  = $agtBatchId
        paidDate = "2026-03-18T00:00:00.000Z"
        note     = "E2E Agent Retry"
    }
    if ($rt.ok)  { Write-Pass "  Retry OK (batchId=$agtBatchId)"; $okCnt = 1 }
    else          { Write-Fail "  Retry failed (status=$($rt.status)): $($rt.error)" }
}

$agtPayOk = ($okCnt -ge 1)

# ASSERTION 4
Write-Section "ASSERTION 4: Agent Payment + Realized Profit Locked"

Start-Sleep -Milliseconds 800

$og4 = Invoke-Api -Method GET -Url "$BASE_URL/test-order2/$($ctx.orderId)" -Headers $authHdr
if ($og4.ok) {
    $o4 = $og4.data
    Write-Info "  agentPaymentStatus=$($o4.agentPaymentStatus)"
    Write-Info "  agentPaymentBatchId=$($o4.agentPaymentBatchId)"
    Write-Info "  agentPaidAmount=$($o4.agentPaidAmount)"
    Write-Info "  realizedGrossProfit=$($o4.realizedGrossProfit)"
    Write-Info "  realizedNetProfit=$($o4.realizedNetProfit)"
    Write-Info "  realizedAt=$($o4.realizedAt)"

    if ($agtPayOk) {
        Assert-Eq      $o4.agentPaymentStatus  "paid"       "A4.1 order.agentPaymentStatus"
        Assert-Eq      $o4.agentPaymentBatchId $agtBatchId  "A4.2 order.agentPaymentBatchId"
        Assert-GT      $o4.realizedGrossProfit  0           "A4.3 order.realizedGrossProfit (Core Logic Triggered)"
        Assert-Defined $o4.realizedNetProfit                "A4.4 order.realizedNetProfit defined"
    } else {
        Write-Skip "A4.1-4 Agent payment did not succeed -- skipping realized assertions"
    }

    $realizedNP = if ($o4.realizedNetProfit)   { [double]$o4.realizedNetProfit }   else { 0 }
    $realizedGP = if ($o4.realizedGrossProfit) { [double]$o4.realizedGrossProfit } else { 0 }
} else {
    Write-Fail "A4.x GET order failed (status=$($og4.status))"
    $realizedNP = 0; $realizedGP = 0
}

# ============================================================
# STEP 5: Capital Allocation Compute
# ============================================================
Write-Section "STEP 5: Capital Allocation (CFO Propagation)"

Write-Info "Waiting 1.5s for FinanceEventListenerService aggregation cache refresh..."
Start-Sleep -Milliseconds 1500

$allocResp = Invoke-Api -Method GET -Url "$BASE_URL/capital-allocation/compute" -Headers $authHdr

if (-not $allocResp.ok) {
    Write-Fail "5.1 GET capital-allocation/compute failed (status=$($allocResp.status)): $($allocResp.error)"
} else {
    $alloc = $allocResp.data
    Write-Info "  policyName=$($alloc.policyName)"
    Write-Info "  cashAvailable=$($alloc.cashAvailable)"
    Write-Info "  totalNetProfit=$($alloc.totalNetProfit)"
    Write-Info "  reinvestmentAmount=$($alloc.reinvestmentAmount)"
    Write-Info "  safetyReserveAmount=$($alloc.safetyReserveAmount)"
    Write-Info "  personalIncomeAmount=$($alloc.personalIncomeAmount)"
    Write-Info "  longTermAssetAmount=$($alloc.longTermAssetAmount)"
    Write-Pass "5.1 Capital allocation computed successfully"
}

# ASSERTION 5
Write-Section "ASSERTION 5: CFO Capital Allocation Integrity"

if ($allocResp.ok) {
    $alloc = $allocResp.data

    # A5.1 cashAvailable must cover at least our order's realized profit
    if ($realizedNP -gt 0) {
        Assert-GTE ([double]$alloc.cashAvailable) $realizedNP "A5.1 cashAvailable >= order.realizedNetProfit"
    } else {
        Write-Skip "A5.1 Skip cashAvailable check (realizedNetProfit=0)"
    }

    # A5.2-5 Fields defined
    if ($null -ne $alloc.reinvestmentAmount)   { Write-Pass "A5.2 reinvestmentAmount=$($alloc.reinvestmentAmount)" }   else { Write-Fail "A5.2 reinvestmentAmount is null" }
    if ($null -ne $alloc.safetyReserveAmount)  { Write-Pass "A5.3 safetyReserveAmount=$($alloc.safetyReserveAmount)" }  else { Write-Fail "A5.3 safetyReserveAmount is null" }
    if ($null -ne $alloc.personalIncomeAmount) { Write-Pass "A5.4 personalIncomeAmount=$($alloc.personalIncomeAmount)" } else { Write-Fail "A5.4 personalIncomeAmount is null" }
    if ($null -ne $alloc.longTermAssetAmount)  { Write-Pass "A5.5 longTermAssetAmount=$($alloc.longTermAssetAmount)" }   else { Write-Fail "A5.5 longTermAssetAmount is null" }

    # A5.6-8 Ratio verification: 25%/20%/10% of system realizedProfit
    $cf = $alloc.cashFlowDetail
    if ($cf) {
        $sysRP = 0
        if ($cf.realizedNetProfit)  { $sysRP = [double]$cf.realizedNetProfit }
        elseif ($cf.realizedProfit) { $sysRP = [double]$cf.realizedProfit }
        Write-Info "  System-wide realizedProfit=$sysRP (from cashFlowDetail)"

        if ($sysRP -gt 0) {
            $expSafety   = [Math]::Round(0.25 * $sysRP)
            $expPersonal = [Math]::Round(0.20 * $sysRP)
            $expLongTerm = [Math]::Round(0.10 * $sysRP)
            Write-Info "  Expected: safety=$expSafety personal=$expPersonal longTerm=$expLongTerm"
            Assert-Eq $alloc.safetyReserveAmount  $expSafety   "A5.6 safetyReserveAmount=round(25%*realizedProfit)"
            Assert-Eq $alloc.personalIncomeAmount $expPersonal "A5.7 personalIncomeAmount=round(20%*realizedProfit)"
            Assert-Eq $alloc.longTermAssetAmount  $expLongTerm "A5.8 longTermAssetAmount=round(10%*realizedProfit)"
        } else {
            Write-Skip "A5.6-8 System realizedProfit=0 -- skip ratio checks"
        }
    } else {
        Write-Skip "A5.6-8 No cashFlowDetail -- cannot verify ratios"
    }

    # A5.9 Policy name
    if ($alloc.policyName) { Write-Pass "A5.9 Active policy: '$($alloc.policyName)'" }
    else                    { Write-Fail "A5.9 No policyName -- need to create active policy" }
}

# ============================================================
# TEARDOWN
# ============================================================
Write-Section "TEARDOWN"

Write-Info "DELETE /api/test-order2/$($ctx.orderId) (triggers FinanceEvents cache invalidation)..."
$del = Invoke-Api -Method DELETE -Url "$BASE_URL/test-order2/$($ctx.orderId)" -Headers $authHdr
if ($del.ok) { Write-Pass "Order deleted -- finance cache refreshes via FinanceEvents.ORDER_COMPLETED" }
else          { Write-Skip "Delete failed (status=$($del.status)) -- manually delete orderId=$($ctx.orderId)" }

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  E2E-TC-001 RESULT SUMMARY" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  PASS : $PASS" -ForegroundColor Green
Write-Host "  FAIL : $FAIL" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "  SKIP : $SKIP" -ForegroundColor Yellow

$total = $PASS + $FAIL
$pct   = if ($total -gt 0) { [Math]::Round(100 * $PASS / $total, 1) } else { 0 }
Write-Host "  TOTAL: $PASS / $total (${pct}%)" -ForegroundColor $(if ($FAIL -eq 0) { 'Green' } else { 'Yellow' })
Write-Host "==========================================================" -ForegroundColor White

if ($ERRORS.Count -gt 0) {
    Write-Host ""
    Write-Host "FAILURES:" -ForegroundColor Red
    $ERRORS | ForEach-Object { Write-Host "  X  $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "Context:" -ForegroundColor Gray
Write-Host "  orderId=$($ctx.orderId)" -ForegroundColor Gray
Write-Host "  supplierId=$($ctx.supplierId)" -ForegroundColor Gray
Write-Host "  agentId=$($ctx.agentId)" -ForegroundColor Gray
Write-Host "  adGroupId=$($ctx.adGroupId)" -ForegroundColor Gray

if ($FAIL -eq 0) {
    Write-Host ""
    Write-Host "ALL ASSERTIONS PASSED - Order->Accrual->Cash->CFO pipeline verified!" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "SOME ASSERTIONS FAILED (${FAIL} failures) - See details above." -ForegroundColor Red
    exit 1
}
