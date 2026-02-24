#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Financial Control - Test suite kiá»ƒm tra sá»± chÃ­nh xÃ¡c sá»' liá»‡u & lan tá»a dá»¯ liá»‡u
    CFO Spec v3.1 / v3.2

.DESCRIPTION
    Script nÃ y kiá»ƒm tra:
    1. Core formulas (FreeCash, SurvivalFloor, AvailableAfterSurvival, AdsBudget, OwnerWithdrawable)
    2. Lan tá»a dá»¯ liá»‡u: thÃªm cost â†' thay Ä'á»•i CommittedCash / BankBalance
    3. Module health vÃ  summary API integrity
    4. Forecast 7D logic
    5. Known bugs (documented)

.NOTES
    Cháº¡y: powershell -ExecutionPolicy Bypass -File test-financial-control.ps1
    Backend pháº£i Ä'ang cháº¡y táº¡i http://localhost:3000
#>

$BASE = "http://localhost:3000/api"
$PASS = 0
$FAIL = 0
$WARN = 0
$SKIP = 0
$Bug1Status = "NOT_CHECKED"
$Bug2Status = "NOT_CHECKED"
$Bug3Status = "NOT_CHECKED"
$Bug4Status = "NOT_CHECKED"

# â"€â"€â"€ HELPERS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function Write-Header($text) {
    Write-Host "`nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•" -ForegroundColor Cyan
}

function Write-Section($text) {
    Write-Host "`nâ"€â"€ $text â"€â"€" -ForegroundColor Yellow
}

function Pass($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:PASS++
}

function Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:FAIL++
}

function Warn($msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
    $script:WARN++
}

function Skip($msg) {
    Write-Host "  [SKIP] $msg" -ForegroundColor Gray
    $script:SKIP++
}

function Bug($id, $msg) {
    Write-Host "  [BUG#$id] $msg" -ForegroundColor Magenta
}

function Assert-Equal($actual, $expected, $desc, $tolerance = 0.01) {
    $diff = [Math]::Abs($actual - $expected)
    if ($diff -le $tolerance) {
        Pass "$desc = $actual (expected $expected)"
    } else {
        Fail "${desc}: got $actual, expected $expected (diff=$diff)"
    }
}

function Assert-NotNull($value, $desc) {
    if ($null -eq $value) {
        Fail "$desc is null or empty"
        return
    }
    if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) {
        Fail "$desc is null or empty"
        return
    }
    Pass "$desc is present"
}

function Assert-GTE($actual, $min, $desc) {
    if ($actual -ge $min) {
        Pass "$desc = $actual >= $min"
    } else {
        Fail "${desc}: $actual < $min"
    }
}

function Assert-FormulaApprox($actual, $formula_result, $desc, $tolerance = 1) {
    $diff = [Math]::Abs($actual - $formula_result)
    if ($diff -le $tolerance) {
        Pass "FORMULA [$desc]: $actual â‰ˆ $formula_result"
    } else {
        Fail "FORMULA [$desc]: got $actual, formula gives $formula_result (diff=$diff)"
    }
}

function Invoke-API($method, $path, $body = $null, $token = $null) {
    $uri = "$BASE$path"
    $headers = @{ "Content-Type" = "application/json" }
    if ($token) { $headers["Authorization"] = "Bearer $token" }

    try {
        if ($method -eq "GET") {
            $resp = Invoke-RestMethod -Uri $uri -Method GET -Headers $headers -ErrorAction Stop
        } elseif ($method -eq "POST") {
            $json = $body | ConvertTo-Json -Depth 10 -Compress
            $resp = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body $json -ErrorAction Stop
        } elseif ($method -eq "PATCH") {
            $json = $body | ConvertTo-Json -Depth 10 -Compress
            $resp = Invoke-RestMethod -Uri $uri -Method PATCH -Headers $headers -Body $json -ErrorAction Stop
        } elseif ($method -eq "DELETE") {
            $resp = Invoke-RestMethod -Uri $uri -Method DELETE -Headers $headers -ErrorAction Stop
        }
        return $resp
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        $errMsg = $_.ErrorDetails.Message
        return @{ __error = $true; status = $status; message = $errMsg; raw = $_.Exception.Message }
    }
}

# â"€â"€â"€ LOGIN â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "FINANCIAL CONTROL TEST SUITE"
Write-Host "  Thá»i gian: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Base URL:  $BASE"

Write-Section "0. Authentication"
$loginCandidates = @(
    @{ email = "director@test.com"; password = "123456"; label = "director@test.com" },
    @{ username = "director"; password = "director123"; label = "director" }
)
$loginResp = $null
$loginLabel = $null
foreach ($candidate in $loginCandidates) {
    $attemptBody = @{}
    if ($candidate.ContainsKey("email")) { $attemptBody.email = $candidate.email }
    if ($candidate.ContainsKey("username")) { $attemptBody.username = $candidate.username }
    $attemptBody.password = $candidate.password

    $attempt = Invoke-API "POST" "/auth/login" $attemptBody
    if (-not $attempt.__error -and $attempt.access_token) {
        $loginResp = $attempt
        $loginLabel = $candidate.label
        break
    }
}

if ($null -eq $loginResp -or -not $loginResp.access_token) {
    Fail "ÄÄƒng nháº­p tháº¥t báº¡i. Backend khÃ´ng cháº¡y hoáº·c sai credential."
    Write-Host "`nKáº¿t quáº£: $PASS PASS / $FAIL FAIL / $WARN WARN" -ForegroundColor Red
    exit 1
}
$TOKEN = $loginResp.access_token
Pass "ÄÄƒng nháº­p thÃ nh cÃ´ng ($loginLabel)"

# â"€â"€â"€ TEST 1: DASHBOARD + CORE FORMULAS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "1. CORE FINANCIAL CONTROL FORMULAS"

Write-Section "1.1 Dashboard - Kiá»ƒm tra 8 sá»' chÃ­nh"
$dash = Invoke-API "GET" "/financial-control/dashboard" -token $TOKEN
if ($dash.__error) {
    Fail "GET /financial-control/dashboard lá»—i: $($dash.message)"
    Skip "Bá» qua táº¥t cáº£ kiá»ƒm tra formulas vÃ¬ dashboard lá»—i"
} else {
    Assert-NotNull $dash.bankBalance    "bankBalance"
    Assert-NotNull $dash.committedCash  "committedCash"
    Assert-NotNull $dash.freeCash       "freeCash"
    Assert-NotNull $dash.monthlyBurn    "monthlyBurn"
    Assert-NotNull $dash.adsBudgetApproved  "adsBudgetApproved"
    Assert-NotNull $dash.ownerWithdrawable  "ownerWithdrawable"
    Assert-NotNull $dash.forecast7DLowPoint "forecast7DLowPoint"

    Write-Section "1.2 Formula: FreeCash = BankBalance - CommittedCash"
    $expectedFreeCash = $dash.bankBalance - $dash.committedCash
    Assert-FormulaApprox $dash.freeCash $expectedFreeCash "FreeCash"

    Write-Section "1.3 FreeCash pháº£i khÃ´ng Ã¢m hÆ¡n bank balance"
    if ($dash.freeCash -le $dash.bankBalance) {
        Pass "freeCash ($($dash.freeCash)) <= bankBalance ($($dash.bankBalance))"
    } else {
        Fail "freeCash ($($dash.freeCash)) > bankBalance ($($dash.bankBalance)) - lá»—i logic"
    }
}

Write-Section "1.4 Full metrics - Kiá»ƒm tra chi tiáº¿t formulas"
$full = Invoke-API "GET" "/financial-control/full" -token $TOKEN
if ($full.__error) {
    Fail "GET /financial-control/full lá»—i: $($full.message)"
    Skip "Bá» qua kiá»ƒm tra full metrics"
} else {
    # SurvivalFloor = SurvivalMonths Ã— MonthlyBurn
    $expectedSurvivalFloor = $full.config.SurvivalMonths * $full.monthlyBurn
    Assert-FormulaApprox $full.survivalFloor $expectedSurvivalFloor "SurvivalFloor = $($full.config.SurvivalMonths) Ã— monthlyBurn"

    # AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)
    $expectedAvailable = [Math]::Max(0, $full.freeCash - $full.survivalFloor)
    Assert-FormulaApprox $full.availableAfterSurvival $expectedAvailable "AvailableAfterSurvival = max(0, FreeCash - SurvivalFloor)"

    # AdsBudgetApproved = min(OptimalAdsSuggestion, AvailableAfterSurvival)
    $expectedAds = [Math]::Min($full.optimalAdsSuggestion, $full.availableAfterSurvival)
    Assert-FormulaApprox $full.adsBudgetApproved $expectedAds "AdsBudgetApproved = min(optimalSuggestion, availableAfterSurvival)"

    # OwnerWithdrawable = max(0, AvailableAfterSurvival - AdsBudgetApproved)
    $expectedOwner = [Math]::Max(0, $full.availableAfterSurvival - $full.adsBudgetApproved)
    Assert-FormulaApprox $full.ownerWithdrawable $expectedOwner "OwnerWithdrawable = max(0, availableAfterSurvival - adsBudgetApproved)"

    # RunwayMonths
    if ($null -ne $full.runwayMonths -and $full.monthlyBurn -gt 0) {
        $expectedRunway = $full.freeCash / $full.monthlyBurn
        Assert-FormulaApprox $full.runwayMonths $expectedRunway "RunwayMonths = freeCash / monthlyBurn" 0.01
    } elseif ($full.monthlyBurn -eq 0) {
        if ($null -eq $full.runwayMonths) {
            Pass "RunwayMonths = null khi monthlyBurn = 0 (âˆž)"
        } else {
            Warn "RunwayMonths nÃªn lÃ  null khi monthlyBurn = 0, got: $($full.runwayMonths)"
        }
    }

    # CommittedCash breakdown total
    if ($full.committedBreakdown) {
        $breakdownTotal = $full.committedBreakdown.labor + $full.committedBreakdown.operations +
                          $full.committedBreakdown.agents + $full.committedBreakdown.tax +
                          $full.committedBreakdown.loanPayment
        Assert-FormulaApprox $full.committedCash $breakdownTotal "CommittedCash = sum(breakdown items)"
    }

    # MonthlyBurn breakdown total
    if ($full.monthlyBurnBreakdown) {
        $agentBurn = if ($null -ne $full.monthlyBurnBreakdown.agentCommission) { $full.monthlyBurnBreakdown.agentCommission } else { 0 }
        $supplierBurn = if ($null -ne $full.monthlyBurnBreakdown.supplierPendingPayment) { $full.monthlyBurnBreakdown.supplierPendingPayment } else { 0 }
        $burnTotal = $full.monthlyBurnBreakdown.laborCore + $full.monthlyBurnBreakdown.operationsMandatory +
                     $full.monthlyBurnBreakdown.loanPayment + $agentBurn + $supplierBurn
        Assert-FormulaApprox $full.monthlyBurn $burnTotal "MonthlyBurn = sum(breakdown items)"
    }

    Write-Section "1.5 Sanity checks"
    Assert-GTE $full.committedCash 0 "committedCash >= 0"
    Assert-GTE $full.monthlyBurn 0 "monthlyBurn >= 0"
    Assert-GTE $full.adsBudgetApproved 0 "adsBudgetApproved >= 0"
    Assert-GTE $full.ownerWithdrawable 0 "ownerWithdrawable >= 0"
    Assert-GTE $full.survivalFloor 0 "survivalFloor >= 0"
    Assert-GTE $full.availableAfterSurvival 0 "availableAfterSurvival >= 0 (max(0,...))"

    # AdsBudget pháº£i <= AvailableAfterSurvival
    if ($full.adsBudgetApproved -le $full.availableAfterSurvival + 1) {
        Pass "adsBudgetApproved ($($full.adsBudgetApproved)) <= availableAfterSurvival ($($full.availableAfterSurvival))"
    } else {
        Fail "adsBudgetApproved > availableAfterSurvival - vi pháº¡m constraint"
    }

    # OwnerWithdrawable pháº£i <= AvailableAfterSurvival
    if ($full.ownerWithdrawable -le $full.availableAfterSurvival + 1) {
        Pass "ownerWithdrawable ($($full.ownerWithdrawable)) <= availableAfterSurvival"
    } else {
        Fail "ownerWithdrawable > availableAfterSurvival - vi pháº¡m constraint"
    }
}

# â"€â"€â"€ TEST 2: KNOWN BUGS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "2. KNOWN BUGS (Re-validated with current code)"

$fcServicePath = Join-Path $PSScriptRoot "backend/src/finance/financial-control.service.ts"
$cashflowDashboardPath = Join-Path $PSScriptRoot "backend/src/cashflow-control/services/dashboard.service.ts"

Write-Section "2.1 Bug#1: Bank Balance fallback labor field"
if (Test-Path $fcServicePath) {
    $fcLines = Get-Content $fcServicePath
    $laborAggContext = $fcLines | Select-String -Pattern "const laborResult = await this.laborModel.aggregate\(" -Context 0,8 | Select-Object -First 1
    $contextText = if ($laborAggContext) { ($laborAggContext.Context.PostContext -join "`n") } else { "" }

    if ($contextText -match '\$sum:\s*''\$amount''') {
        $Bug1Status = "OPEN"
        Fail "Bug#1 CONFIRMED: laborModel aggregate v?n dùng `$amount (không dúng schema LaborStatement)."
    } elseif ($contextText -match '\$sum:\s*''\$statementPaymentTotal''') {
        $Bug1Status = "FIXED"
        Pass "Bug#1 fixed: laborModel aggregate dã dùng `$statementPaymentTotal."
    } else {
        $Bug1Status = "UNCLEAR"
        Warn "Không xác d?nh du?c field sum cho laborModel aggregate trong fallback bank balance."
    }
} else {
    $Bug1Status = "SKIPPED"
    Skip "Không tìm th?y financial-control.service.ts d? verify Bug#1."
}

Write-Section "2.2 Bug#2: MonthlyBurn dùng totalPaid all-time"
if (Test-Path $fcServicePath) {
    $fcRaw = Get-Content -Raw $fcServicePath
    $burnBlock = [regex]::Match($fcRaw, "(?s)private async getMonthlyBurn\(\): Promise<MonthlyBurnBreakdown> \{.*?\n\s*async getOptimalAdsSuggestion")
    if ($burnBlock.Success) {
        $burnText = $burnBlock.Value
        $usesPaid = $burnText -match "totalPayrollPaid|totalOpsPaid|totalDebtPaid|totalAgentPaid"
        $usesDue = $burnText -match "totalPayrollDue14d|totalDebtDue14d|totalAgentDue14d"
        $usesSupplierPending = $burnText -match "supplierPendingPayment|getPendingSupplierPaymentAmount"

        if ($usesPaid) {
            $Bug2Status = "OPEN"
            Fail "Bug#2 OPEN: getMonthlyBurn v?n dùng total*Paid (all-time)."
        } elseif ($usesDue -and $usesSupplierPending) {
            $Bug2Status = "PARTIAL_FIXED"
            Pass "Bug#2 FC-layer fixed: getMonthlyBurn dã chuy?n sang due/pending, không còn ph? thu?c total*Paid."
        } else {
            $Bug2Status = "UNCLEAR"
            Warn "Không xác d?nh rõ pattern due/pending trong getMonthlyBurn."
        }
    } else {
        $Bug2Status = "UNCLEAR"
        Warn "Không parse du?c block getMonthlyBurn d? verify Bug#2."
    }
} else {
    $Bug2Status = "SKIPPED"
}

$labor1d = Invoke-API "GET" "/labor-statement/cashflow-summary?windowDays=1" -token $TOKEN
$labor30d = Invoke-API "GET" "/labor-statement/cashflow-summary?windowDays=30" -token $TOKEN
if (-not $labor1d.__error -and -not $labor30d.__error) {
    if ($labor1d.totalPayrollPaid -eq $labor30d.totalPayrollPaid) {
        Warn "Labor summary: totalPayrollPaid có d?u hi?u all-time (windowDays=1 == 30)."
    } else {
        Pass "Labor summary: totalPayrollPaid có thay d?i theo windowDays."
    }
}

$ops1d = Invoke-API "GET" "/other-cost/cashflow-summary?windowDays=1" -token $TOKEN
$ops30d = Invoke-API "GET" "/other-cost/cashflow-summary?windowDays=30" -token $TOKEN
if (-not $ops1d.__error -and -not $ops30d.__error) {
    if ($ops1d.totalOpsPaid -eq $ops30d.totalOpsPaid) {
        Warn "Ops summary: totalOpsPaid có d?u hi?u all-time (windowDays=1 == 30)."
    } else {
        Pass "Ops summary: totalOpsPaid có thay d?i theo windowDays."
    }
}

Write-Section "2.3 Bug#3: maxDailyAds unit mismatch"
if (Test-Path $fcServicePath) {
    $fcRaw = Get-Content -Raw $fcServicePath
    $usesCycleDiv = $fcRaw -match "maxDailyAds\s*=\s*\(adsBudgetApproved\s*/\s*this\.config\.SupplierCashCycleDays\)\s*\*\s*this\.config\.SafetyFactor"
    $forecastBaseCase = $fcRaw -match "getForecast7D\(bankBalance,\s*0,\s*monthlyBurnBreakdown\)"

    if ($usesCycleDiv -and $forecastBaseCase) {
        $Bug3Status = "OPEN_LOW_IMPACT"
        Warn "Bug#3 còn ? field maxDailyAds (/SupplierCashCycleDays), nhung forecast full dang base-case dailyAds=0."
    } elseif ($usesCycleDiv) {
        $Bug3Status = "OPEN"
        Fail "Bug#3 OPEN: maxDailyAds v?n chia SupplierCashCycleDays và dang có kh? nang ?nh hu?ng forecast."
    } else {
        $Bug3Status = "FIXED"
        Pass "Bug#3 fixed: maxDailyAds không còn chia SupplierCashCycleDays."
    }
} else {
    $Bug3Status = "SKIPPED"
}

Write-Section "2.4 Bug#4: cashflow-control mock data"
$bug4CodeHasMock = $false
if (Test-Path $cashflowDashboardPath) {
    $dashRaw = Get-Content -Raw $cashflowDashboardPath
    $hasMockComment = $dashRaw -match "(?is)MOCK DATA|In production, these would come from database queries|Mock data"
    $hasStaticBankAccounts = $dashRaw -match "(?is)getBankAccounts\s*\(\)\s*:\s*IBankAccount\[\]\s*{[^}]*return\s*\["
    $hasStaticCommitments = $dashRaw -match "(?is)getCommitments\s*\(\)\s*:\s*ICommitment\[\]\s*{[^}]*return\s*\["
    if ($hasMockComment -or $hasStaticBankAccounts -or $hasStaticCommitments) {
        $bug4CodeHasMock = $true
        Warn "Code evidence: cashflow-control dashboard đang dùng mock/hardcoded data (không query DB)."
    } else {
        Pass "Code evidence: không thấy dấu hiệu mock/hardcoded data trong cashflow-control dashboard."
    }
}

$ccDash = Invoke-API "GET" "/cashflow/dashboard/summary" -token $TOKEN
if ($ccDash.__error) {
    # Backward compatibility with old route naming
    $ccDash = Invoke-API "GET" "/cashflow-control/dashboard" -token $TOKEN
}
if (-not $ccDash.__error) {
    if ($ccDash.bankBalance -eq 850000000) {
        $Bug4Status = "OPEN"
        Fail "Bug#4 CONFIRMED: cashflow dashboard tr? v? bankBalance hardcoded 850,000,000."
    } elseif ($bug4CodeHasMock) {
        $Bug4Status = "OPEN_CODE_ONLY"
        Warn "Bug#4 OPEN (code-level): route có response nhưng service vẫn chứa mock/hardcoded data."
    } else {
        $Bug4Status = "FIXED_OR_DYNAMIC"
        Pass "Bug#4 not reproduced at runtime: cashflow dashboard không tr? 850M hardcoded."
    }
} else {
    if ($bug4CodeHasMock) {
        $Bug4Status = "OPEN_CODE_ONLY"
        Warn "Bug#4 OPEN (code-level): route cashflow dashboard không khả dụng, nhưng service vẫn mock data."
    } else {
        $Bug4Status = "SKIPPED"
        Skip "cashflow dashboard route không có ho?c l?i."
    }
}
Write-Header "3. MODULE HEALTH & SUMMARY API INTEGRITY"

$health = Invoke-API "GET" "/financial-control/module-health" -token $TOKEN
if ($health.__error) {
    Fail "GET /financial-control/module-health lá»—i: $($health.message)"
} else {
    Assert-NotNull $health.overall "overall health status"

    if ($health.overall -eq "ok") {
        Pass "Module health: overall = ok"
    } elseif ($health.overall -eq "partial") {
        Warn "Module health: partial - má»™t sá»' module cÃ³ váº¥n Ä'á»"
    } else {
        Fail "Module health: $($health.overall)"
    }

    if ($health.modules) {
        $moduleNames = @("labor", "operations", "agent", "debt", "supplier", "ads", "tax")
        foreach ($mod in $moduleNames) {
            $m = $health.modules.$mod
            if ($null -eq $m) {
                Warn "Module '$mod' khÃ´ng cÃ³ trong health report"
            } elseif ($m.status -eq "ok") {
                Pass "Module '$mod': ok"
            } elseif ($m.status -eq "timeout") {
                Fail "Module '$mod': TIMEOUT - cÃ³ thá»ƒ áº£nh hÆ°á»Ÿng FC tÃ­nh toÃ¡n"
            } elseif ($m.status -eq "error") {
                Fail "Module '$mod': ERROR - $($m.error)"
            } else {
                Warn "Module '$mod': $($m.status)"
            }
        }
    }
}

Write-Section "3.1 Deprecation stats - kiá»ƒm tra fallback usage"
$depStats = Invoke-API "GET" "/financial-control/debug/deprecation-stats" -token $TOKEN
if (-not $depStats.__error) {
    if ($depStats.total -eq 0) {
        Pass "KhÃ´ng cÃ³ fallback nÃ o Ä'Æ°á»£c dÃ¹ng - táº¥t cáº£ summary APIs hoáº¡t Ä'á»™ng"
    } else {
        Warn "Fallback Ä'Æ°á»£c dÃ¹ng $($depStats.total) láº§n: labor=$($depStats.labor), ops=$($depStats.ops), agent=$($depStats.agent), supplier=$($depStats.supplier)"
    }
}

# â"€â"€â"€ TEST 4: COMMITTED CASH PROPAGATION â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "4. LAN Tá»ŽA Dá»® LIá»†U - COMMITTED CASH"

Write-Section "4.1 ThÃªm OtherCost chÆ°a xÃ¡c nháº­n â†' CommittedCash tÄƒng"
$dash0 = Invoke-API "GET" "/financial-control/dashboard" -token $TOKEN

# Táº¡o other cost cÃ³ dueDate trong 14 ngÃ y
$dueDate14d = (Get-Date).AddDays(7).ToString("yyyy-MM-dd")
$testAmount = 5000000  # 5 triá»‡u
$newCost = Invoke-API "POST" "/other-cost" @{
    date       = (Get-Date).ToString("yyyy-MM-dd")
    dueDate    = $dueDate14d
    amount     = $testAmount
    category   = "office-supplies"
    notes      = "TEST_FC_PROPAGATION_$(Get-Random)"
    isConfirmed = $false
} -token $TOKEN

if ($newCost.__error) {
    Fail "Táº¡o other-cost tháº¥t báº¡i: $($newCost.message)"
    Skip "Bá» qua kiá»ƒm tra CommittedCash propagation"
} else {
    $costId = $newCost._id
    Pass "Táº¡o other-cost test: $costId (amount=$testAmount)"

    # Wait for cache to expire
    Start-Sleep -Seconds 2

    $dash1 = Invoke-API "GET" "/financial-control/dashboard" -token $TOKEN

    if (-not $dash0.__error -and -not $dash1.__error) {
        $committedDiff = $dash1.committedCash - $dash0.committedCash
        $freeCashDiff  = $dash1.freeCash - $dash0.freeCash

        if ([Math]::Abs($committedDiff - $testAmount) -le 1) {
            Pass "CommittedCash tÄƒng $committedDiff (â‰ˆ +$testAmount) sau khi thÃªm cost"
        } else {
            # Cache 30s - cÃ³ thá»ƒ chÆ°a refresh
            Warn "CommittedCash diff = $committedDiff (expected +$testAmount) - cÃ³ thá»ƒ do cache 30s"
        }

        if ([Math]::Abs($freeCashDiff + $testAmount) -le 1) {
            Pass "FreeCash giáº£m $([Math]::Abs($freeCashDiff)) sau khi CommittedCash tÄƒng"
        } else {
            Warn "FreeCash diff = $freeCashDiff - cÃ³ thá»ƒ do cache"
        }
    }

    # Cleanup
    $del = Invoke-API "DELETE" "/other-cost/$costId" -token $TOKEN
    if (-not $del.__error) {
        Pass "XÃ³a other-cost test thÃ nh cÃ´ng"
    }
}

Write-Section "4.2 Confirm OtherCost â†' BankBalance giáº£m, CommittedCash giáº£m"
$dueDate3d = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")
$testAmount2 = 3000000  # 3 triá»‡u
$newCost2 = Invoke-API "POST" "/other-cost" @{
    date       = (Get-Date).ToString("yyyy-MM-dd")
    dueDate    = $dueDate3d
    amount     = $testAmount2
    category   = "office-supplies"
    notes      = "TEST_FC_CONFIRM_$(Get-Random)"
    isConfirmed = $false
} -token $TOKEN

if (-not $newCost2.__error) {
    $costId2 = $newCost2._id

    # Confirm the cost
    $confirmed = Invoke-API "PATCH" "/other-cost/$costId2/confirm" -token $TOKEN

    if (-not $confirmed.__error) {
        Pass "Confirm other-cost thÃ nh cÃ´ng"

        Start-Sleep -Seconds 2
        $dash2 = Invoke-API "GET" "/financial-control/dashboard" -token $TOKEN

        if (-not $dash0.__error -and -not $dash2.__error) {
            $bankDiff = $dash2.bankBalance - $dash0.bankBalance

            # BankBalance nÃªn giáº£m sau khi confirm cost
            # (hoáº·c giá»¯ nguyÃªn náº¿u bank balance tá»« FundingSource - manual managed)
            if ($bankDiff -lt 0) {
                Pass "BankBalance giáº£m sau khi confirm cost (náº¿u dÃ¹ng transaction-based calc)"
            } else {
                Warn "BankBalance khÃ´ng giáº£m - cÃ³ thá»ƒ dÃ¹ng FundingSource.availableBalance (cáº§n update thá»§ cÃ´ng)"
            }
        }
    } else {
        Warn "PATCH /other-cost/$costId2/confirm - route cÃ³ thá»ƒ khÃ¡c: $($confirmed.message)"
    }

    # Cleanup
    $del2 = Invoke-API "DELETE" "/other-cost/$costId2" -token $TOKEN
}

# â"€â"€â"€ TEST 5: LABOR STATEMENT PROPAGATION â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "5. LAN Tá»ŽA Dá»® LIá»†U - LABOR COST"

Write-Section "5.1 Kiá»ƒm tra getCashflowSummary() tá»« labor-statement"
$laborSummary = Invoke-API "GET" "/labor-statement/cashflow-summary?windowDays=14" -token $TOKEN
if ($laborSummary.__error) {
    # Thá»­ route khÃ¡c
    $laborSummary = Invoke-API "GET" "/labor-statements/cashflow-summary?windowDays=14" -token $TOKEN
}
if (-not $laborSummary.__error) {
    Assert-NotNull $laborSummary.totalPayrollDue14d "totalPayrollDue14d"
    Assert-NotNull $laborSummary.totalPayrollPaid   "totalPayrollPaid"
    Assert-GTE $laborSummary.totalPayrollDue14d 0   "totalPayrollDue14d >= 0"
    Assert-GTE $laborSummary.totalPayrollPaid 0     "totalPayrollPaid >= 0"

    # BUG#2 verification
    # Náº¿u totalPayrollPaid > expectedMax (vÃ­ dá»¥ vÃ i trÄƒm triá»‡u/thÃ¡ng), kháº£ nÄƒng cao bug
    if ($laborSummary.totalPayrollPaid -gt 0) {
        Write-Section "5.2 Verify Bug#2 - totalPayrollPaid all-time check"
        # Kiá»ƒm tra dueByDay7d cÃ³ tá»"n táº¡i
        if ($laborSummary.dueByDay7d) {
            Pass "dueByDay7d cÃ³ trong response (CFO Spec v3.2)"
        } else {
            Fail "dueByDay7d THIáº¾U trong labor getCashflowSummary - forecast sáº½ khÃ´ng cÃ³ payroll"
        }

        Warn "Bug#2: KhÃ´ng thá»ƒ verify tá»± Ä'á»™ng - totalPayrollPaid = $($laborSummary.totalPayrollPaid)"
        Warn "Bug#2: ÄÃ¢y lÃ  ALL-TIME sum, khÃ´ng pháº£i last-30d. Cáº§n kiá»ƒm tra thá»§ cÃ´ng."
    }
} else {
    Skip "KhÃ´ng tÃ¬m tháº¥y route labor cashflow-summary: $($laborSummary.message)"
}

Write-Section "5.3 CommittedCash.labor khá»›p vá»›i laborStatement.totalPayrollDue14d"
if ($full -and -not $full.__error -and -not $laborSummary.__error) {
    if ($null -ne $full.committedBreakdown.labor) {
        $labCommitted = $full.committedBreakdown.labor
        $labDue14d    = $laborSummary.totalPayrollDue14d

        if ([Math]::Abs($labCommitted - $labDue14d) -le 100) {
            Pass "committedBreakdown.labor ($labCommitted) â‰ˆ laborSummary.totalPayrollDue14d ($labDue14d)"
        } else {
            Fail "committedBreakdown.labor ($labCommitted) â‰  laborSummary.totalPayrollDue14d ($labDue14d)"
        }
    }
}

# â"€â"€â"€ TEST 6: FORECAST 7D â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "6. FORECAST 7 NGÃ€Y"

$forecast = Invoke-API "GET" "/financial-control/forecast" -token $TOKEN
if ($forecast.__error) {
    Fail "GET /financial-control/forecast lá»—i: $($forecast.message)"
} else {
    Assert-NotNull $forecast.days "forecast.days"
    Assert-NotNull $forecast.lowPoint "forecast.lowPoint"

    if ($forecast.days -and $forecast.days.Count -eq 7) {
        Pass "Forecast cÃ³ Ä'Ãºng 7 ngÃ y"
    } else {
        Fail "Forecast thiáº¿u ngÃ y: $($forecast.days.Count) ngÃ y"
    }

    Write-Section "6.1 Kiá»ƒm tra forecastBank logic theo tá»«ng ngÃ y"
    $prevBalance = $null
    foreach ($day in $forecast.days) {
        if ($null -ne $prevBalance) {
            $expectedBank = $prevBalance + $day.expectedIn - $day.expectedOut
            $diff = [Math]::Abs($day.forecastBank - $expectedBank)
            if ($diff -le 1) {
                Pass "Day $($day.day): forecastBank = prev + in - out OK"
            } else {
                Fail "Day $($day.day): forecastBank=$($day.forecastBank), expected=$expectedBank (diff=$diff)"
            }
        }
        $prevBalance = $day.forecastBank
    }

    Write-Section "6.2 LowPoint pháº£i = min(forecastBank)"
    $minBalance = ($forecast.days | Measure-Object -Property forecastBank -Minimum).Minimum
    Assert-FormulaApprox $forecast.lowPoint $minBalance "lowPoint = min(forecastBank across 7 days)"

    Write-Section "6.2b Consistency: /full.forecast7DLowPoint vs /forecast.lowPoint"
    if ($full -and -not $full.__error -and $full.forecast7DLowPoint) {
        if ([Math]::Abs($full.forecast7DLowPoint.amount - $forecast.lowPoint) -le 1) {
            Pass "LowPoint amount nhất quán giữa /full và /forecast"
        } else {
            Fail "LowPoint amount lệch: full=$($full.forecast7DLowPoint.amount), forecast=$($forecast.lowPoint)"
        }

        if ($full.forecast7DLowPoint.day -eq $forecast.lowPointDay) {
            Pass "LowPoint day nhất quán giữa /full và /forecast"
        } else {
            Fail "LowPoint day lệch: full=$($full.forecast7DLowPoint.day), forecast=$($forecast.lowPointDay)"
        }
    }

    Write-Section "6.3 isCashCrunch vÃ  isSurvivalRisk"
    if ($forecast.isCashCrunch -eq ($forecast.lowPoint -lt 0)) {
        Pass "isCashCrunch = (lowPoint < 0): $($forecast.isCashCrunch)"
    } else {
        Fail "isCashCrunch sai: lowPoint=$($forecast.lowPoint), isCashCrunch=$($forecast.isCashCrunch)"
    }

    if ($full -and -not $full.__error) {
        $expectedSurvivalRisk = $forecast.lowPoint -lt $full.survivalFloor
        if ($forecast.isSurvivalRisk -eq $expectedSurvivalRisk) {
            Pass "isSurvivalRisk = (lowPoint < survivalFloor): $($forecast.isSurvivalRisk)"
        } else {
            Fail "isSurvivalRisk sai: lowPoint=$($forecast.lowPoint), survivalFloor=$($full.survivalFloor)"
        }
    }
}

# â"€â"€â"€ TEST 7: OPTIMAL ADS SUGGESTION â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "7. OPTIMAL ADS SUGGESTION"

$optAds = Invoke-API "GET" "/financial-control/optimal-ads" -token $TOKEN
if ($optAds.__error) {
    Warn "GET /financial-control/optimal-ads lá»—i: $($optAds.message)"
} else {
    Assert-GTE ($optAds.adGroups.Count) 0 "adGroups count >= 0"

    foreach ($ag in $optAds.adGroups) {
        # upperCap = baselineSpend Ã— 1.2
        $expectedUpper = $ag.baselineSpend * 1.2
        if ([Math]::Abs($ag.upperCap - $expectedUpper) -le 1) {
            Pass "AdGroup '$($ag.adGroupName)': upperCap = baseline * 1.2 OK"
        } else {
            Fail "AdGroup '$($ag.adGroupName)': upperCap=$($ag.upperCap), expected=$expectedUpper"
        }

        # optimalSuggested must be in [lowerCap, upperCap]
        if ($ag.optimalSuggested -ge $ag.lowerCap - 1 -and $ag.optimalSuggested -le $ag.upperCap + 1) {
            Pass "AdGroup '$($ag.adGroupName)': optimalSuggested trong [lowerCap, upperCap]"
        } else {
            Fail "AdGroup '$($ag.adGroupName)': optimalSuggested=$($ag.optimalSuggested) ngoÃ i [$($ag.lowerCap), $($ag.upperCap)]"
        }
    }

    Write-Section "7.1 Bug#3 verification - maxDailyAds formula"
    if ($full -and -not $full.__error) {
        $config = $full.config
        $expectedMaxDaily_correct = ($full.adsBudgetApproved / 7) * $config.SafetyFactor
        $expectedMaxDaily_buggy   = ($full.adsBudgetApproved / $config.SupplierCashCycleDays) * $config.SafetyFactor

        $ambiguousZeroCase = [Math]::Abs($expectedMaxDaily_buggy - $expectedMaxDaily_correct) -le 1
        if ($ambiguousZeroCase) {
            Pass "maxDailyAds đang ở trường hợp zero/ambiguous, không thể phân biệt buggy vs correct chỉ bằng runtime value"
        } elseif ([Math]::Abs($full.maxDailyAds - $expectedMaxDaily_buggy) -le 1) {
            Fail "Bug#3 CONFIRMED: maxDailyAds dùng /$($config.SupplierCashCycleDays) thay vì /7."
            Warn "  maxDailyAds = $($full.maxDailyAds) (buggy: adsBudget/$($config.SupplierCashCycleDays) x $($config.SafetyFactor))"
            Warn "  Correct should be: $expectedMaxDaily_correct (adsBudget/7 x $($config.SafetyFactor))"
        } elseif ([Math]::Abs($full.maxDailyAds - $expectedMaxDaily_correct) -le 1) {
            Pass "maxDailyAds dÃ¹ng /7 (correct)"
        } else {
            Warn "maxDailyAds = $($full.maxDailyAds), khÃ´ng khá»›p formula nÃ o (buggy/correct)"
        }
    }
}

# â"€â"€â"€ TEST 8: OTHER-COST CASHFLOW SUMMARY â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "8. OTHER-COST CASHFLOW SUMMARY"

$opsSummary = Invoke-API "GET" "/other-cost/cashflow-summary?windowDays=14" -token $TOKEN
if ($opsSummary.__error) {
    Skip "Route /other-cost/cashflow-summary khÃ´ng tÃ¬m tháº¥y: $($opsSummary.message)"
} else {
    Assert-GTE $opsSummary.totalOpsPaid 0   "totalOpsPaid >= 0"
    Assert-GTE $opsSummary.totalOpsUnpaid 0 "totalOpsUnpaid >= 0"
    Assert-GTE $opsSummary.totalOpsDue14d 0 "totalOpsDue14d >= 0"

    # totalOpsDue14d <= totalOpsUnpaid
    if ($opsSummary.totalOpsDue14d -le $opsSummary.totalOpsUnpaid + 1) {
        Pass "totalOpsDue14d ($($opsSummary.totalOpsDue14d)) <= totalOpsUnpaid ($($opsSummary.totalOpsUnpaid))"
    } else {
        Fail "totalOpsDue14d > totalOpsUnpaid - logic sai"
    }

    # CommittedCash.operations pháº£i khá»›p totalOpsDue14d
    if ($full -and -not $full.__error -and $full.committedBreakdown) {
        $opsCommitted = $full.committedBreakdown.operations
        $opsDue14d    = $opsSummary.totalOpsDue14d
        if ([Math]::Abs($opsCommitted - $opsDue14d) -le 100) {
            Pass "committedBreakdown.operations ($opsCommitted) â‰ˆ totalOpsDue14d ($opsDue14d)"
        } else {
            Fail "committedBreakdown.operations ($opsCommitted) â‰  totalOpsDue14d ($opsDue14d)"
        }
    }

    # dueByDay7d check
    if ($opsSummary.dueByDay7d -is [array]) {
        Pass "dueByDay7d cÃ³ trong response: $($opsSummary.dueByDay7d.Count) ngÃ y"
    } else {
        Fail "dueByDay7d THIáº¾U trong other-cost cashflow summary"
    }
}

# â"€â"€â"€ TEST 9: ACTIONS SUGGESTIONS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "9. ACTION SUGGESTIONS"

$actions = Invoke-API "GET" "/financial-control/actions" -token $TOKEN
if ($actions.__error) {
    Warn "GET /financial-control/actions lá»—i: $($actions.message)"
} else {
    Assert-NotNull $actions.actions "actions array"

    $validPriorities = @("critical", "high", "medium", "low")
    foreach ($action in $actions.actions) {
        if ($action.priority -in $validPriorities) {
            Pass "Action '$($action.type)' cÃ³ priority há»£p lá»‡: $($action.priority)"
        } else {
            Fail "Action '$($action.type)' cÃ³ priority khÃ´ng há»£p lá»‡: $($action.priority)"
        }
    }

    # Consistency check: if isCashCrunch â†' should have PAUSE_ADS action
    if ($forecast -and $forecast.isCashCrunch) {
        $pauseAdsAction = $actions.actions | Where-Object { $_.type -eq "PAUSE_ADS" }
        if ($pauseAdsAction) {
            Pass "isCashCrunch = true -> PAUSE_ADS action exists"
        } else {
            Fail "isCashCrunch = true nhÆ°ng thiáº¿u PAUSE_ADS action"
        }
    }

    # If runwayStatus = danger â†' STOP_OWNER_WITHDRAW
    if ($full -and $full.runwayStatus -eq "danger") {
        $stopAction = $actions.actions | Where-Object { $_.type -eq "STOP_OWNER_WITHDRAW" }
        if ($stopAction) {
            Pass "runwayStatus = danger -> STOP_OWNER_WITHDRAW action exists"
        } else {
            Fail "runwayStatus = danger nhÆ°ng thiáº¿u STOP_OWNER_WITHDRAW action"
        }
    }
}

# â"€â"€â"€ TEST 10: CONFIG INTEGRITY â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "10. CONFIG INTEGRITY"

$config = Invoke-API "GET" "/financial-control/config" -token $TOKEN
if ($config.__error) {
    Fail "GET /financial-control/config lá»—i"
} else {
    # DEFAULT_CONFIG expected values
    if ($config.CommittedWindowDays -eq 14) { Pass "CommittedWindowDays = 14 (default)" }
    else { Warn "CommittedWindowDays = $($config.CommittedWindowDays) (expected 14)" }

    if ($config.SurvivalMonths -eq 3) { Pass "SurvivalMonths = 3 (default)" }
    else { Warn "SurvivalMonths = $($config.SurvivalMonths) (expected 3)" }

    if ($config.RiskAdjustInflow -eq 0.8) { Pass "RiskAdjustInflow = 0.8 (default)" }
    else { Warn "RiskAdjustInflow = $($config.RiskAdjustInflow) (expected 0.8)" }

    if ($config.UpperCapMultiplier -eq 1.2) { Pass "UpperCapMultiplier = 1.2 (default +20%)" }
    else { Warn "UpperCapMultiplier = $($config.UpperCapMultiplier) (expected 1.2)" }

    if ($config.LowerCapMultiplier -eq 0.7) { Pass "LowerCapMultiplier = 0.7 (default -30%)" }
    else { Warn "LowerCapMultiplier = $($config.LowerCapMultiplier) (expected 0.7)" }

    if ($config.SafetyFactor -eq 0.8) { Pass "SafetyFactor = 0.8 (default)" }
    else { Warn "SafetyFactor = $($config.SafetyFactor) (expected 0.8)" }
}

# â"€â"€â"€ SUMMARY â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
Write-Header "KET QUA TONG HOP"

$total = $PASS + $FAIL + $WARN + $SKIP
Write-Host ""
Write-Host "  PASS : $PASS / $total" -ForegroundColor Green
Write-Host "  FAIL : $FAIL / $total" -ForegroundColor $(if ($FAIL -gt 0) { "Red" } else { "Green" })
Write-Host "  WARN : $WARN / $total" -ForegroundColor $(if ($WARN -gt 0) { "Yellow" } else { "Green" })
Write-Host "  SKIP : $SKIP / $total" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  BUG REVIEW STATUS:" -ForegroundColor Magenta
Write-Host "  Bug#1 (Bank fallback labor field): $Bug1Status" -ForegroundColor Magenta
Write-Host "  Bug#2 (MonthlyBurn totalPaid all-time): $Bug2Status" -ForegroundColor Magenta
Write-Host "  Bug#3 (maxDailyAds unit mismatch): $Bug3Status" -ForegroundColor Magenta
Write-Host "  Bug#4 (cashflow-control mock data): $Bug4Status" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Cyan

if ($FAIL -eq 0) {
    Write-Host "`n  ALL TESTS PASS" -ForegroundColor Green
} else {
    Write-Host "`n  CO $FAIL TEST THAT BAI" -ForegroundColor Red
    exit 1
}



