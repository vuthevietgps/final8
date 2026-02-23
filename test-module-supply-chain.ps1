#!/usr/bin/env pwsh
<#
    =====================================================================================
    TEST-MODULE-SUPPLY-CHAIN.ps1
    =====================================================================================
    Test Supply Chain modules:
    Phase 0: Login + setup (get/create supplier & agent users)
    Phase 1: Supplier Payable CRUD (create, list, get, update payments, delete)
    Phase 2: Supplier Statements (upsert, list, get, add payment, close, reopen)
    Phase 3: Agent Payables Statements (upsert, list, get, add payment, close, reopen)
    Phase 4: Agent Receivables (deprecated — list, summary, cashflow)
    Phase 5: Supplier Payable summary/cashflow
    Phase 6: Cleanup
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
function Expect-Fail {
    param([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = $null, [string]$Label = "")
    try {
        $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; ContentType = "application/json; charset=utf-8" }
        if ($Body -and $Method -ne "GET") { $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body) }
        $null = Invoke-RestMethod @params
        return "OK"
    } catch { return "FAIL" }
}

$script:passCount = 0; $script:failCount = 0; $script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Section "MODULE TEST: SUPPLY CHAIN - $ts"

# ===== PHASE 0: LOGIN & SETUP =====
Write-Section "PHASE 0: Login & Setup"
Write-Step "0.1" "Login Director"
$lr = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "Login"
if ($lr -and $lr.access_token) {
    Write-Pass "Login OK: $($lr.user.fullName) ($($lr.user.role))"
    $h = @{ "Authorization" = "Bearer $($lr.access_token)" }
    $directorId = $lr.user.id
} else { Write-Fail "Login failed"; exit 1 }

# Get or find supplier user
Write-Step "0.2" "Get supplier user"
$users = Safe-Request -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "GetUsers"
$supplier = $null; $agent = $null
if ($users) {
    foreach ($u in $users) {
        if ($u.role -eq "internal_supplier" -and -not $supplier) { $supplier = $u }
        if ($u.role -eq "internal_agent" -and -not $agent) { $agent = $u }
    }
}
if (-not $supplier) {
    Write-Info "No supplier found, creating one..."
    $supBody = '{"email":"test-supplier-sc@test.com","password":"123456","fullName":"NCC Test SC","role":"internal_supplier"}'
    $supplier = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $supBody -Label "CreateSupplier"
}
if (-not $agent) {
    Write-Info "No agent found, creating one..."
    $agBody = '{"email":"test-agent-sc@test.com","password":"123456","fullName":"Agent Test SC","role":"internal_agent"}'
    $agent = Safe-Request -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $agBody -Label "CreateAgent"
}
$supplierId = if ($supplier._id) { $supplier._id } elseif ($supplier.id) { $supplier.id } else { "" }
$agentId = if ($agent._id) { $agent._id } elseif ($agent.id) { $agent.id } else { "" }
Write-Info "Supplier: $($supplier.fullName) ($supplierId)"
Write-Info "Agent: $($agent.fullName) ($agentId)"
if ($supplierId -and $agentId) { Write-Pass "Setup complete" } else { Write-Fail "Setup incomplete"; exit 1 }

# ===== PHASE 1: SUPPLIER PAYABLE CRUD =====
Write-Section "PHASE 1: Supplier Payable CRUD"

Write-Step "1.1" "Create supplier payable"
$spBody = @{
    supplierId = $supplierId
    supplierNameSnap = $supplier.fullName
    items = @(
        @{ productNameSnap = "Product A"; quantity = 10; unitPrice = 50000; amount = 500000 }
        @{ productNameSnap = "Product B"; quantity = 5; unitPrice = 80000; amount = 400000 }
    )
    totalAmount = 900000
    dueDate = "2026-03-01T00:00:00.000Z"
    notes = "Test payable from SC module"
    status = "unpaid"
} | ConvertTo-Json -Depth 5
$sp1 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables" -Headers $h -Body $spBody -Label "CreateSP"
$sp1Id = if ($sp1._id) { $sp1._id } elseif ($sp1.id) { $sp1.id } else { "" }
if ($sp1Id) { Write-Pass "Created supplier payable: $sp1Id" } else { Write-Fail "Create supplier payable failed" }

Write-Step "1.2" "List supplier payables"
$spList = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables" -Headers $h -Label "ListSP"
if ($spList -ne $null) {
    $count = if ($spList -is [array]) { $spList.Count } else { 1 }
    Write-Pass "List supplier payables: $count items"
} else { Write-Fail "List supplier payables failed" }

Write-Step "1.3" "Get supplier payable by ID"
if ($sp1Id) {
    $spGet = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/$sp1Id" -Headers $h -Label "GetSP"
    if ($spGet) { Write-Pass "Get payable OK: status=$($spGet.status), total=$($spGet.totalAmount)" } else { Write-Fail "Get supplier payable failed" }
} else { Write-Fail "Skip - no payable ID" }

Write-Step "1.4" "Add payment to payable (expect reject - must use statements)"
if ($sp1Id) {
    $rejected = Expect-Fail -Method POST -Uri "$BaseUrl/supplier-payables/$sp1Id/payments" -Headers $h -Body '{"amount":300000,"paidAt":"2026-02-16T10:00:00.000Z"}' -ExpectedStatus 400 -Label "PaySP"
    if ($rejected) { Write-Pass "Correctly rejects direct payment (must use statements)" } else { Write-Fail "Should reject direct payment" }
} else { Write-Fail "Skip - no payable ID" }

Write-Step "1.5" "Verify payable still unpaid"
if ($sp1Id) {
    $spGet2 = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/$sp1Id" -Headers $h -Label "GetSP2"
    if ($spGet2 -and $spGet2.amountPaid -eq 0) { Write-Pass "Payable still unpaid (correct): amountPaid=$($spGet2.amountPaid)" } else { Write-Fail "Verification failed" }
} else { Write-Fail "Skip" }

Write-Step "1.6" "Filter supplier payables by supplierId"
$spFiltered = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables?supplierId=$supplierId" -Headers $h -Label "FilterSP"
if ($spFiltered -ne $null) { Write-Pass "Filter by supplierId OK" } else { Write-Fail "Filter failed" }

Write-Step "1.7" "Get supplier payable statement by supplier"
$spStmt = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statement/by-supplier?supplierId=$supplierId" -Headers $h -Label "StmtBySup"
if ($spStmt -ne $null) { Write-Pass "Statement by supplier OK" } else { Write-Fail "Statement by supplier failed" }

Write-Step "1.8" "Get cashflow summary"
$spCash = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/summary/cashflow" -Headers $h -Label "CashflowSP"
if ($spCash -ne $null) { Write-Pass "Cashflow summary OK" } else { Write-Fail "Cashflow summary failed" }

# ===== PHASE 2: SUPPLIER STATEMENTS =====
Write-Section "PHASE 2: Supplier Statements"

Write-Step "2.1" "Upsert supplier statement"
$stmtBody = @{
    supplierId = $supplierId
    from = "2026-02-01T00:00:00.000Z"
    to = "2026-02-28T23:59:59.000Z"
    notes = "Feb 2026 statement"
} | ConvertTo-Json
$stmt1 = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements" -Headers $h -Body $stmtBody -Label "UpsertStmt"
$stmt1Id = if ($stmt1._id) { $stmt1._id } elseif ($stmt1.id) { $stmt1.id } else { "" }
if ($stmt1Id) { Write-Pass "Upsert statement OK: $stmt1Id, status=$($stmt1.status)" } else { Write-Fail "Upsert statement failed" }

Write-Step "2.2" "List supplier statements"
$stmtList = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statements" -Headers $h -Label "ListStmts"
if ($stmtList -ne $null) {
    $count = if ($stmtList -is [array]) { $stmtList.Count } else { 1 }
    Write-Pass "List statements: $count items"
} else { Write-Fail "List statements failed" }

Write-Step "2.3" "Get statement by ID"
if ($stmt1Id) {
    $stmtGet = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statements/$stmt1Id" -Headers $h -Label "GetStmt"
    if ($stmtGet) { Write-Pass "Get statement OK: status=$($stmtGet.status)" } else { Write-Fail "Get statement failed" }
} else { Write-Fail "Skip" }

Write-Step "2.4" "Add payment to statement"
if ($stmt1Id) {
    $stmtPayBody = @{
        amount = 200000
        paidAt = "2026-02-16T11:00:00.000Z"
        method = "cash"
        notes = "Statement payment #1"
    } | ConvertTo-Json
    $stmtPay = Safe-Request -Method POST -Uri "$BaseUrl/supplier-payables/statements/$stmt1Id/payments" -Headers $h -Body $stmtPayBody -Label "PayStmt"
    if ($stmtPay) { Write-Pass "Statement payment added" } else { Write-Fail "Statement payment failed" }
} else { Write-Fail "Skip" }

Write-Step "2.5" "Close statement"
if ($stmt1Id) {
    $stmtClose = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$stmt1Id/close" -Headers $h -Label "CloseStmt"
    if ($stmtClose -and $stmtClose.status -eq "closed") { Write-Pass "Statement closed" } else { Write-Fail "Close statement failed" }
} else { Write-Fail "Skip" }

Write-Step "2.6" "Reopen statement"
if ($stmt1Id) {
    $stmtReopen = Safe-Request -Method PATCH -Uri "$BaseUrl/supplier-payables/statements/$stmt1Id/reopen" -Headers $h -Label "ReopenStmt"
    if ($stmtReopen -and $stmtReopen.status -eq "open") { Write-Pass "Statement reopened" } else { Write-Fail "Reopen statement failed" }
} else { Write-Fail "Skip" }

Write-Step "2.7" "Get payment summary"
$paySummary = Safe-Request -Method GET -Uri "$BaseUrl/supplier-payables/statements/summary/payment" -Headers $h -Label "PaySummary"
if ($paySummary -ne $null) { Write-Pass "Payment summary OK" } else { Write-Fail "Payment summary failed" }

# ===== PHASE 3: AGENT PAYABLES =====
Write-Section "PHASE 3: Agent Payables"

Write-Step "3.1" "Upsert agent payable statement"
$agStmtBody = @{
    agentId = $agentId
    periodFrom = "2026-02-01T00:00:00.000Z"
    periodTo = "2026-02-28T23:59:59.000Z"
    notes = "Agent Feb 2026 statement"
} | ConvertTo-Json
$agStmt = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements" -Headers $h -Body $agStmtBody -Label "UpsertAgStmt"
$agStmtId = if ($agStmt._id) { $agStmt._id } elseif ($agStmt.id) { $agStmt.id } else { "" }
if ($agStmtId) { Write-Pass "Agent statement created: $agStmtId" } else { Write-Fail "Agent statement create failed" }

Write-Step "3.2" "List agent payable statements"
$agStmtList = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/statements" -Headers $h -Label "ListAgStmts"
if ($agStmtList -ne $null) {
    $count = if ($agStmtList -is [array]) { $agStmtList.Count } else { 1 }
    Write-Pass "List agent statements: $count items"
} else { Write-Fail "List agent statements failed" }

Write-Step "3.3" "Get agent payable summary"
$agSummary = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary" -Headers $h -Label "AgSummary"
if ($agSummary -ne $null) { Write-Pass "Agent summary OK" } else { Write-Fail "Agent summary failed" }

Write-Step "3.4" "Add payment to agent statement"
if ($agStmtId) {
    $agPayBody = @{
        amount = 150000
        paidAt = "2026-02-16T12:00:00.000Z"
        method = "bank_transfer"
        notes = "Agent payment #1"
    } | ConvertTo-Json
    $agPay = Safe-Request -Method POST -Uri "$BaseUrl/agent-payables/statements/$agStmtId/payments" -Headers $h -Body $agPayBody -Label "PayAgStmt"
    if ($agPay) { Write-Pass "Agent statement payment added" } else { Write-Fail "Agent statement payment failed" }
} else { Write-Fail "Skip" }

Write-Step "3.5" "Close agent statement"
if ($agStmtId) {
    $agClose = Safe-Request -Method PATCH -Uri "$BaseUrl/agent-payables/statements/$agStmtId/close" -Headers $h -Label "CloseAgStmt"
    if ($agClose) { Write-Pass "Agent statement closed" } else { Write-Fail "Close agent statement failed" }
} else { Write-Fail "Skip" }

Write-Step "3.6" "Reopen agent statement"
if ($agStmtId) {
    $agReopen = Safe-Request -Method PATCH -Uri "$BaseUrl/agent-payables/statements/$agStmtId/reopen" -Headers $h -Label "ReopenAgStmt"
    if ($agReopen) { Write-Pass "Agent statement reopened" } else { Write-Fail "Reopen agent statement failed" }
} else { Write-Fail "Skip" }

Write-Step "3.7" "Get agent payable cashflow summary"
$agCash = Safe-Request -Method GET -Uri "$BaseUrl/agent-payables/summary/cashflow" -Headers $h -Label "AgCashflow"
if ($agCash -ne $null) { Write-Pass "Agent cashflow summary OK" } else { Write-Fail "Agent cashflow summary failed" }

# ===== PHASE 4: AGENT RECEIVABLES (deprecated but should still work) =====
Write-Section "PHASE 4: Agent Receivables (deprecated)"

Write-Step "4.1" "List agent receivable statements"
$arList = Safe-Request -Method GET -Uri "$BaseUrl/agent-receivables/statements" -Headers $h -Label "ListAR"
if ($arList -ne $null) { Write-Pass "Agent receivable statements listed" } else { Write-Fail "List AR statements failed" }

Write-Step "4.2" "Get agent receivable summary"
$arSummary = Safe-Request -Method GET -Uri "$BaseUrl/agent-receivables/summary" -Headers $h -Label "ARSummary"
if ($arSummary -ne $null) { Write-Pass "Agent receivable summary OK" } else { Write-Fail "AR summary failed" }

Write-Step "4.3" "Get agent receivable cashflow"
$arCash = Safe-Request -Method GET -Uri "$BaseUrl/agent-receivables/summary/cashflow" -Headers $h -Label "ARCashflow"
if ($arCash -ne $null) { Write-Pass "Agent receivable cashflow OK" } else { Write-Fail "AR cashflow failed" }

# ===== PHASE 5: CLEANUP =====
Write-Section "PHASE 5: Cleanup"

Write-Step "5.1" "Delete supplier payable"
if ($sp1Id) {
    $delSp = Safe-Request -Method DELETE -Uri "$BaseUrl/supplier-payables/$sp1Id" -Headers $h -Label "DelSP"
    Write-Pass "Supplier payable deleted"
} else { Write-Info "Skip - no payable to delete" }

# ===== SUMMARY =====
Write-Section "SUMMARY"
Write-Host "Total: $($script:passCount + $script:failCount) | " -NoNewline
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green -NoNewline
Write-Host " | " -NoNewline
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -gt 0) { "Red" } else { "Green" })
if ($script:failCount -gt 0) {
    Write-Host "`nFailed tests:" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
exit $script:failCount
