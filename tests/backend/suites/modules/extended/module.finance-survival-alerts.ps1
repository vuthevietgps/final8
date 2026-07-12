#!/usr/bin/env pwsh

$ErrorActionPreference = 'Stop'

function Get-BackendBaseUrl {
    $baseUrl = $env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($baseUrl)) {
        return $baseUrl.TrimEnd('/')
    }
    return 'http://localhost:3000/api'
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

$BaseUrl = Get-BackendBaseUrl
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$HelperPath = Join-Path $RepoRoot 'backend\scripts\test-scenario-4-finance-health.js'
$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()

function Write-Section($title) {
    Write-Host ''
    Write-Host ('=' * 90) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ('=' * 90) -ForegroundColor Cyan
}

function Write-Step($step, $desc) {
    Write-Host ''
    Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow
}

function Write-Pass($msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passCount++
}

function Write-Fail($msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failCount++
    $script:failDetails += $msg
}

function Write-Info($msg) {
    Write-Host "  [INFO] $msg" -ForegroundColor Gray
}

function Safe-Request {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers,
        [string]$Body = $null,
        [string]$Label = ''
    )

    try {
        if ($Body -and $Method -ne 'GET') {
            $params = @{
                Method = $Method
                Uri = $Uri
                Headers = $Headers
                ContentType = 'application/json; charset=utf-8'
                Body = [System.Text.Encoding]::UTF8.GetBytes($Body)
                ErrorAction = 'Stop'
            }

            $response = Invoke-RestMethod @params
            if ($response -is [string]) {
                $trimmedBody = $response.Trim()
                if ($trimmedBody.StartsWith('{') -or $trimmedBody.StartsWith('[')) {
                    try {
                        return $trimmedBody | ConvertFrom-Json -ErrorAction Stop
                    } catch {
                        return $response
                    }
                }
            }
            return $response
        }

        $curlArgs = @('-sS', '-X', $Method, '-w', "`n%{http_code}", $Uri)

        foreach ($key in $Headers.Keys) {
            $curlArgs += @('-H', "${key}: $($Headers[$key])")
        }

        $rawOutput = & curl.exe @curlArgs 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERROR] $Label - curl failed: $rawOutput" -ForegroundColor Red
            return $null
        }

        $outputText = [string]::Join("`n", $rawOutput)
        $lines = $outputText -split "`r?`n"
        $statusLine = $lines[-1].Trim()
        $responseText = if ($lines.Length -gt 1) {
            [string]::Join("`n", $lines[0..($lines.Length - 2)]).Trim()
        } else {
            ''
        }

        $statusCode = 0
        [void][int]::TryParse($statusLine, [ref]$statusCode)

        if ($statusCode -ge 400) {
            Write-Host "  [ERROR] $Label - HTTP $statusCode : $responseText" -ForegroundColor Red
            return $null
        }

        if ([string]::IsNullOrWhiteSpace($responseText)) {
            return $null
        }

        $trimmed = $responseText.Trim()
        if ($trimmed.StartsWith('{') -or $trimmed.StartsWith('[')) {
            try {
                return $trimmed | ConvertFrom-Json -ErrorAction Stop
            } catch {
                return $responseText
            }
        }

        return $responseText
    } catch {
        $status = $null
        $bodyText = ''
        try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
        try { $bodyText = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $status : $bodyText" -ForegroundColor Red
        return $null
    }
}

function Invoke-ScenarioHelper {
    param(
        [string]$Action,
        [string]$Scenario,
        [string]$Tag
    )

    $output = & node $HelperPath $Action $Scenario $Tag
    if ($LASTEXITCODE -ne 0) {
        throw "Scenario helper failed: action=$Action scenario=$Scenario tag=$Tag"
    }

    if ([string]::IsNullOrWhiteSpace($output)) {
        return $null
    }

    return $output | ConvertFrom-Json
}

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Success,
        [string]$Failure
    )

    if ($Condition) {
        Write-Pass $Success
    } else {
        Write-Fail $Failure
    }
}

function Normalize-JsonResponse {
    param($Value)

    if ($Value -is [string]) {
        $trimmed = $Value.Trim()
        if ($trimmed.StartsWith('{') -or $trimmed.StartsWith('[')) {
            try {
                return $trimmed | ConvertFrom-Json -ErrorAction Stop
            } catch {
                return $Value
            }
        }
    }

    return $Value
}

Write-Section 'SCENARIO 4: FINANCIAL HEALTH & SURVIVAL ALERTS'

Write-Step '0.1' 'Health check'
$HealthUrl = Get-BackendHealthUrl
$health = Safe-Request -Method GET -Uri $HealthUrl -Headers @{} -Label 'Health'
if ($null -eq $health) {
    Write-Fail 'Backend is not reachable'
    exit 1
}
Write-Pass 'Backend health endpoint reachable'

Write-Step '0.2' 'Login Director'
$login = Safe-Request -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label 'Login'
if ($null -eq $login -or -not $login.access_token) {
    Write-Fail 'Login failed'
    exit 1
}

$headers = @{ Authorization = "Bearer $($login.access_token)" }
Write-Pass 'Login OK'

$scenario1Tag = "scenario1-$(Get-Date -Format 'yyyyMMddHHmmss')"
$scenario2Tag = "scenario2-$(Get-Date -Format 'yyyyMMddHHmmss')"
$scenario3Tag = "scenario3-$(Get-Date -Format 'yyyyMMddHHmmss')"

try {
    Write-Section 'PHASE 1: DPO < DSO'
    $scenario1 = Invoke-ScenarioHelper -Action 'setup' -Scenario 'scenario1' -Tag $scenario1Tag
    Write-Info "Scenario 1 data prepared for ad group $($scenario1.adGroupId)"

    $cashflowHealth1 = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label 'CashflowHealth-Scenario1'
    $cashflowHealth1 = Normalize-JsonResponse $cashflowHealth1
    if ($null -eq $cashflowHealth1) {
        Write-Fail 'finance/cashflow-health failed for scenario 1'
    } else {
        Assert-True (($cashflowHealth1.dso -gt $cashflowHealth1.dpo)) 'DSO is greater than DPO' 'DSO was not greater than DPO'
        Assert-True (($cashflowHealth1.status -eq 'warning') -or ($cashflowHealth1.status -eq 'critical') -or ($cashflowHealth1.status -eq 'danger')) "Cashflow status returned: $($cashflowHealth1.status)" 'Cashflow status missing'
        $dpoAlert = $cashflowHealth1.alerts | Where-Object { $_.code -eq 'DPO_LESS_THAN_DSO' }
        Assert-True ($null -ne $dpoAlert) 'DPO<DSO alert present' 'Missing DPO_LESS_THAN_DSO alert'
        if ($null -ne $dpoAlert) {
            Assert-True ($dpoAlert.message -eq 'Paying suppliers before collecting from agents') 'DPO<DSO alert message matches expected text' 'DPO<DSO alert message mismatch'
        }
    }

    [void](Invoke-ScenarioHelper -Action 'teardown' -Scenario 'all' -Tag $scenario1Tag)

    Write-Section 'PHASE 2: Catastrophic Return Rate'
    $scenario2 = Invoke-ScenarioHelper -Action 'setup' -Scenario 'scenario2' -Tag $scenario2Tag
    Write-Info "Scenario 2 data prepared for ad group $($scenario2.adGroupId)"

    $dashboard = Safe-Request -Method GET -Uri "$BaseUrl/finance/dashboard" -Headers $headers -Label 'FinanceDashboard-Scenario2'
    $dashboard = Normalize-JsonResponse $dashboard
    if ($null -eq $dashboard) {
        Write-Fail 'finance/dashboard failed for scenario 2'
    } else {
        $normalizedReturnRate = if ($dashboard.metrics -and $null -ne $dashboard.metrics.returnRate) { [double]$dashboard.metrics.returnRate } elseif ($dashboard.returnRate) { [double]$dashboard.returnRate } else { 0 }
        Assert-True ($normalizedReturnRate -gt 0.35) "Dashboard return rate is above catastrophic threshold ($normalizedReturnRate)" 'Dashboard return rate did not exceed 35%'
    }

    $recommendation = Safe-Request -Method GET -Uri "$BaseUrl/finance/ad-groups/$($scenario2.adGroupId)/recommendation" -Headers $headers -Label 'AdGroupRecommendation-Scenario2'
    $recommendation = Normalize-JsonResponse $recommendation
    if ($null -eq $recommendation) {
        Write-Fail 'finance/ad-groups/:id/recommendation failed for scenario 2'
    } else {
        Assert-True ($recommendation.decision -eq 'KILL') 'Recommendation decision is KILL' 'Recommendation decision was not KILL'
        Assert-True ($recommendation.action -eq 'EMERGENCY_RETURN_PROTECTION') 'Emergency return protection flag returned' 'Missing EMERGENCY_RETURN_PROTECTION flag'
        Assert-True ([double]$recommendation.newBudget -eq 0) 'Recommendation newBudget is 0' 'Recommendation newBudget was not 0'
        Assert-True ([bool]$recommendation.systemLocked) 'Recommendation systemLocked=true' 'Recommendation systemLocked was false'
    }

    [void](Invoke-ScenarioHelper -Action 'teardown' -Scenario 'all' -Tag $scenario2Tag)

    Write-Section 'PHASE 3: CSI < 0.7'
    $scenario3 = Invoke-ScenarioHelper -Action 'setup' -Scenario 'scenario3' -Tag $scenario3Tag
    Write-Info 'Scenario 3 data prepared'

    $cashflowHealth3 = Safe-Request -Method GET -Uri "$BaseUrl/finance/cashflow-health" -Headers $headers -Label 'CashflowHealth-Scenario3'
    $cashflowHealth3 = Normalize-JsonResponse $cashflowHealth3
    if ($null -eq $cashflowHealth3) {
        Write-Fail 'finance/cashflow-health failed for scenario 3'
    } else {
        Assert-True ([double]$cashflowHealth3.csi -lt 0.7) "CSI is critical ($($cashflowHealth3.csi))" 'CSI was not below 0.7'
        Assert-True ($cashflowHealth3.status -eq 'critical') 'Cashflow status is critical' 'Cashflow status was not critical'
        Assert-True ([double]$cashflowHealth3.runwayDays -lt 1) "Runway is below 1 day ($($cashflowHealth3.runwayDays))" 'Runway was not below 1 day'
    }

    $preview = Safe-Request -Method GET -Uri "$BaseUrl/budget-allocation/preview" -Headers $headers -Label 'BudgetPreview-Scenario3'
    $preview = Normalize-JsonResponse $preview
    if ($null -eq $preview) {
        Write-Fail 'budget-allocation/preview failed for scenario 3'
    } else {
        Assert-True ($preview.globalStatus -eq 'CRITICAL_CASH_SHORTAGE') 'Global status indicates critical cash shortage' 'Missing CRITICAL_CASH_SHORTAGE status'
        Assert-True ([double]$preview.globalAdjustmentRatio -eq 0.5) 'Global adjustment ratio is 0.5' 'Global adjustment ratio was not 0.5'
        Assert-True (($preview.recommendation -match '50%') -or ([string]$preview.recommendation).Contains('0.5')) 'Preview recommendation contains 50% reduction guidance' 'Preview recommendation missing 50% reduction guidance'
        $forcedCuts = @($preview.allocations | Where-Object { $_.currentBudget -gt 0 -and $_.allocatedBudget -le ($_.currentBudget * 0.5) })
        Assert-True ($forcedCuts.Count -ge 1) 'At least one allocation was forced down by 50%' 'No allocation showed forced 50% reduction'
    }
}
finally {
    foreach ($tag in @($scenario1Tag, $scenario2Tag, $scenario3Tag)) {
        try {
            [void](Invoke-ScenarioHelper -Action 'teardown' -Scenario 'all' -Tag $tag)
        } catch {
            Write-Info "Teardown skipped for ${tag}: $($_.Exception.Message)"
        }
    }
}

Write-Section 'RESULT'
Write-Info "Pass: $script:passCount"
Write-Info "Fail: $script:failCount"

if ($script:failCount -gt 0) {
    Write-Host ''
    Write-Host 'Failed assertions:' -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}

Write-Pass 'Scenario 4 completed successfully'
