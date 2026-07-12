<#
    =====================================================================================
    SCENARIO.05-LOAN-OWNER-FUND.PS1
    =====================================================================================
    Deep business scenario for owner fund, loan disbursement, repayment, and cash impact.
    =====================================================================================
#>
$ErrorActionPreference = 'Stop'

function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return 'http://localhost:3000/api'
}

$BASE_URL = Get-BackendBaseUrl
$global:PASS = 0
$global:FAIL = 0
$global:ERRORS = @()

function Write-Section {
    param([string]$Title)
    Write-Host ''
    Write-Host ('=' * 88) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 88) -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

function Write-Pass {
    param([string]$Message)
    Write-Host "  [PASS] $Message" -ForegroundColor Green
    $global:PASS++
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $global:FAIL++
    $global:ERRORS += $Message
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )

    try {
        $params = @{
            Method = $Method
            Uri = $Url
            Headers = $Headers
            ContentType = 'application/json; charset=utf-8'
        }

        if ($null -ne $Body -and $Method -ne 'GET') {
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 10))
        }

        $data = Invoke-RestMethod @params
        return @{ ok = $true; data = $data; status = 200 }
    } catch {
        $status = 0
        $errorBody = ''

        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode } catch { }
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
            } catch { }
        }

        Write-Host "  [HTTP] $Method $Url => $status" -ForegroundColor DarkYellow
        if ($errorBody) {
            Write-Host "         $errorBody" -ForegroundColor DarkYellow
        }

        return @{ ok = $false; status = $status; error = $errorBody }
    }
}

function Assert-Approx {
    param(
        [double]$Actual,
        [double]$Expected,
        [string]$Label,
        [double]$Tolerance = 1
    )

    $diff = [Math]::Abs($Actual - $Expected)
    if ($diff -le $Tolerance) {
        Write-Pass "$Label = $Actual"
    } else {
        Write-Fail "$Label expected $Expected but got $Actual"
    }
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Label
    )

    if ($Condition) {
        Write-Pass $Label
    } else {
        Write-Fail $Label
    }
}

function Invoke-ScenarioHelper {
    param(
        [string]$Action,
        [string]$Tag,
        [int64]$Amount = 0
    )

    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
    $helperPath = Join-Path $repoRoot 'backend\scripts\test-scenario-5-loan-owner-fund.js'

    try {
        $output = if ($Amount -gt 0) {
            & node $helperPath $Action $Tag $Amount
        } else {
            & node $helperPath $Action $Tag
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Scenario helper exited with code $LASTEXITCODE for action '$Action'"
            return $null
        }

        return $output | ConvertFrom-Json
    } catch {
        Write-Fail "Scenario helper failed for action '$Action': $($_.Exception.Message)"
        return $null
    }
}

$tag = 'S5-' + (Get-Date -Format 'yyyyMMddHHmmss')
$authHeaders = @{}
$loanId = $null
$repaymentId = $null
$setupDone = $false

Write-Section "SCENARIO.05-LOAN-OWNER-FUND ($tag)"

$login = Invoke-Api -Method 'POST' -Url "$BASE_URL/auth/login" -Body @{
    email = 'director@test.com'
    password = '123456'
}

if (-not $login.ok -or -not $login.data.access_token) {
    Write-Fail 'Director login failed'
} else {
    $authHeaders = @{ Authorization = "Bearer $($login.data.access_token)" }
    Write-Pass 'Director login succeeded'
}

if ($authHeaders.Count -gt 0) {
    $setup = Invoke-ScenarioHelper -Action 'setup' -Tag $tag
    if ($setup -and $setup.ok) {
        $setupDone = $true
        Write-Pass 'Scenario helper setup completed'
    }
}

$baselineDashboard = $null
$baselineDebt = $null

if ($setupDone) {
    Write-Section 'PHASE 1 - CREATE AND DISBURSE LOAN'

    $baselineDashboard = Invoke-Api -Method 'GET' -Url "$BASE_URL/financial-control/dashboard?forceRefresh=true" -Headers $authHeaders
    $baselineDebt = Invoke-Api -Method 'GET' -Url "$BASE_URL/finance/loan-contracts/summary/cashflow" -Headers $authHeaders

    if ($baselineDashboard.ok) {
        Write-Pass "Baseline bank balance captured: $($baselineDashboard.data.bankBalance)"
    } else {
        Write-Fail 'Failed to capture baseline dashboard'
    }

    if ($baselineDebt.ok) {
        Write-Pass 'Baseline debt summary captured'
    } else {
        Write-Fail 'Failed to capture baseline debt summary'
    }

    $loanCreate = Invoke-Api -Method 'POST' -Url "$BASE_URL/finance/loans" -Headers $authHeaders -Body @{
        name = "Vay Kinh Doanh $tag"
        lenderName = 'Techcombank'
        principal = 500000000
        interestRate = 10
        status = 'active'
        notes = "SCENARIO5-$tag"
    }

    if ($loanCreate.ok -and $loanCreate.data._id) {
        $loanId = [string]$loanCreate.data._id
        Write-Pass "Loan created: $loanId"
    } else {
        Write-Fail 'Loan creation failed'
    }

    if ($loanId) {
        $disburse = Invoke-Api -Method 'POST' -Url "$BASE_URL/finance/loans/$loanId/disburse" -Headers $authHeaders -Body @{
            amount = 500000000
            notes = 'Giai ngan toan bo'
        }

        if ($disburse.ok) {
            Write-Pass 'Loan disbursement completed'
            Start-Sleep -Milliseconds 500
        } else {
            Write-Fail 'Loan disbursement failed'
        }
    }

    $dashboardAfterDisbursement = Invoke-Api -Method 'GET' -Url "$BASE_URL/financial-control/dashboard?forceRefresh=true" -Headers $authHeaders
    if ($baselineDashboard.ok -and $dashboardAfterDisbursement.ok) {
        $disbursementDelta = [double]$dashboardAfterDisbursement.data.bankBalance - [double]$baselineDashboard.data.bankBalance
        Assert-Approx -Actual $disbursementDelta -Expected 500000000 -Label 'Bank balance increased by loan disbursement'
    } else {
        Write-Fail 'Could not verify bank balance after disbursement'
    }

    $loanDisbursementCashflow = Invoke-Api -Method 'GET' -Url "$BASE_URL/finance/cashflows?category=loan_disbursement&sourceType=loan" -Headers $authHeaders
    if ($loanDisbursementCashflow.ok) {
        $matchingDisbursement = @($loanDisbursementCashflow.data) | Where-Object {
            "$($_.referenceId)" -eq $loanId -and $_.direction -eq 'in' -and [double]$_.amount -eq 500000000
        } | Select-Object -First 1
        Assert-True -Condition ($null -ne $matchingDisbursement) -Label 'Cashflow entry exists for loan disbursement'
    } else {
        Write-Fail 'Could not query cashflows after disbursement'
    }

    Write-Section 'PHASE 2 - TOP UP OWNER FUND'
    $topup = Invoke-ScenarioHelper -Action 'topup-owner-fund' -Tag $tag -Amount 20000000
    if ($topup -and $topup.ok) {
        Write-Pass "Owner fund topped up to $($topup.balance)"
    }

    Write-Section 'PHASE 3 - REPAY LOAN FROM OWNER FUND'
    if ($loanId) {
        $repaymentCreate = Invoke-Api -Method 'POST' -Url "$BASE_URL/finance/loans/$loanId/repayments" -Headers $authHeaders -Body @{
            loanId = $loanId
            amountPrincipal = 10000000
            amountInterest = 1000000
            dueDate = '2026-04-16'
            paid = $false
            notes = "SCENARIO5-$tag-repayment"
        }

        if ($repaymentCreate.ok -and $repaymentCreate.data._id) {
            $repaymentId = [string]$repaymentCreate.data._id
            Write-Pass "Repayment schedule created: $repaymentId"
        } else {
            Write-Fail 'Repayment schedule creation failed'
        }
    }

    if ($repaymentId) {
        $repaymentPay = Invoke-Api -Method 'POST' -Url "$BASE_URL/finance/repayments/$repaymentId/pay" -Headers $authHeaders -Body @{
            paidDate = '2026-03-16'
            fundingSource = 'owner_fund'
            notes = 'Owner tu trich tien tui tra no'
        }

        if ($repaymentPay.ok) {
            Write-Pass 'Repayment paid from owner fund'
            Start-Sleep -Milliseconds 500
        } else {
            Write-Fail 'Repayment payment failed'
        }
    }

    $ownerFundAccount = Invoke-Api -Method 'GET' -Url "$BASE_URL/owner-fund/fund-account" -Headers $authHeaders
    if ($ownerFundAccount.ok -and $topup) {
        $expectedOwnerFundBalance = [double]$topup.balance - 11000000
        Assert-Approx -Actual ([double]$ownerFundAccount.data.account.balance) -Expected $expectedOwnerFundBalance -Label 'Owner fund balance reduced by principal and interest'
    } else {
        Write-Fail 'Could not verify owner fund balance after repayment'
    }

    $debtAfterRepayment = Invoke-Api -Method 'GET' -Url "$BASE_URL/finance/loan-contracts/summary/cashflow" -Headers $authHeaders
    if ($baselineDebt.ok -and $debtAfterRepayment.ok) {
        $outstandingDelta = [double]$debtAfterRepayment.data.totalDebtOutstanding - [double]$baselineDebt.data.totalDebtOutstanding
        $principalPaidDelta = [double]$debtAfterRepayment.data.totalPrincipalPaid - [double]$baselineDebt.data.totalPrincipalPaid
        Assert-Approx -Actual $outstandingDelta -Expected 490000000 -Label 'Outstanding debt delta matches remaining principal'
        Assert-Approx -Actual $principalPaidDelta -Expected 10000000 -Label 'Principal paid delta matches repayment'
    } else {
        Write-Fail 'Could not verify debt summary after repayment'
    }

    $repaymentCashflow = Invoke-Api -Method 'GET' -Url "$BASE_URL/finance/cashflows?category=loan_repayment&sourceType=owner_fund" -Headers $authHeaders
    if ($repaymentCashflow.ok) {
        $matchingRepaymentCashflow = @($repaymentCashflow.data) | Where-Object {
            "$($_.referenceId)" -eq $repaymentId -and $_.direction -eq 'out' -and [double]$_.amount -eq 11000000
        } | Select-Object -First 1
        Assert-True -Condition ($null -ne $matchingRepaymentCashflow) -Label 'Cashflow entry exists for owner fund repayment'
    } else {
        Write-Fail 'Could not query repayment cashflow'
    }

    $dashboardAfterRepayment = Invoke-Api -Method 'GET' -Url "$BASE_URL/financial-control/dashboard?forceRefresh=true" -Headers $authHeaders
    if ($dashboardAfterDisbursement.ok -and $dashboardAfterRepayment.ok) {
        Assert-Approx -Actual ([double]$dashboardAfterRepayment.data.bankBalance) -Expected ([double]$dashboardAfterDisbursement.data.bankBalance) -Label 'Bank balance unchanged after owner fund repayment'
    } else {
        Write-Fail 'Could not verify bank balance after owner fund repayment'
    }
}

Write-Section 'TEARDOWN'
if ($setupDone) {
    $teardown = Invoke-ScenarioHelper -Action 'teardown' -Tag $tag
    if ($teardown -and $teardown.ok) {
        Write-Pass 'Scenario helper teardown completed'
    }
}

Write-Host ''
Write-Host "RESULT: $($global:PASS) PASS / $($global:FAIL) FAIL" -ForegroundColor Cyan
if ($global:FAIL -gt 0) {
    exit 1
}
