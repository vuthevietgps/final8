#!/usr/bin/env pwsh
<#
  E2E concurrency and idempotency checks for finance ripple paths.
  Covers:
  - CON-05 supplier payment retry/idempotency
  - CON-06 agent payment retry + atomic race
  - CON-07 owner withdrawal approve race + conflicting terminal actions
  - CON-10 post-ripple reconciliation on order/owner state
#>

$ErrorActionPreference = 'Stop'

function Write-Section($Title) {
    Write-Host ''
    Write-Host ('=' * 90) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ('=' * 90) -ForegroundColor Cyan
}

function Write-Step($Step, $Title) {
    Write-Host ''
    Write-Host "--- Step $Step : $Title ---" -ForegroundColor Yellow
}

function Write-Pass($Message) {
    Write-Host "  [PASS] $Message" -ForegroundColor Green
    $script:PassCount++
}

function Write-Fail($Message) {
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    $script:FailCount++
    $script:FailDetails += $Message
}

function Write-Info($Message) {
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

function Get-Id($Object) {
    if ($null -eq $Object) { return '' }
    if ($Object -is [string]) { return $Object }
    if ($Object._id) { return [string]$Object._id }
    if ($Object.id) { return [string]$Object.id }
    return ''
}

function New-JsonBody($Data) {
    return ($Data | ConvertTo-Json -Depth 10)
}

function Number-OrZero($Value) {
    if ($null -eq $Value -or $Value -eq '') { return 0 }
    return [double]$Value
}

function Assert-True($Name, $Condition, $FailureMessage) {
    if ($Condition) {
        Write-Pass $Name
    } else {
        Write-Fail $FailureMessage
    }
}

function Assert-Equal($Name, $Expected, $Actual) {
    if ("$Expected" -eq "$Actual") {
        Write-Pass "$Name = $Actual"
    } else {
        Write-Fail "$Name = $Actual (expected $Expected)"
    }
}

function Assert-Approx($Name, $Expected, $Actual, [double]$Tolerance = 1) {
    $expectedNumber = [double]$Expected
    $actualNumber = [double]$Actual
    if ([math]::Abs($expectedNumber - $actualNumber) -le $Tolerance) {
        Write-Pass "$Name = $actualNumber"
    } else {
        Write-Fail "$Name = $actualNumber (expected $expectedNumber)"
    }
}

function Assert-WithdrawalBalanceConsistency {
    param(
        [string]$Name,
        [double]$Amount,
        $OwnerBefore,
        $OwnerAfter,
        $WithdrawalAfter,
        [string]$ApprovedStatus = 'approved',
        [string[]]$RejectedStatuses = @('rejected', 'cancelled')
    )

    $status = "$($WithdrawalAfter.status)"
    $availableBefore = Number-OrZero $OwnerBefore.availableBalance
    $availableAfter = Number-OrZero $OwnerAfter.availableBalance
    $withdrawnBefore = Number-OrZero $OwnerBefore.totalWithdrawn
    $withdrawnAfter = Number-OrZero $OwnerAfter.totalWithdrawn
    $availableDelta = $availableBefore - $availableAfter
    $withdrawnDelta = $withdrawnAfter - $withdrawnBefore

    if ($status -eq $ApprovedStatus) {
        Assert-Approx "$Name final status approved decrements owner balance once" $Amount $availableDelta
        Assert-Approx "$Name final status approved increments totalWithdrawn once" $Amount $withdrawnDelta
        return
    }

    if ($RejectedStatuses -contains $status) {
        Assert-Approx "$Name final status $status keeps owner balance unchanged" 0 $availableDelta
        Assert-Approx "$Name final status $status keeps totalWithdrawn unchanged" 0 $withdrawnDelta
        return
    }

    Write-Fail "$Name ended in unexpected withdrawal status '$status'"
}

function Assert-WithdrawalTerminalMetadata {
    param(
        [string]$Name,
        $WithdrawalAfter,
        [string[]]$AllowedApprovedReferences = @(),
        [switch]$ExpectApprovalMetadata,
        [switch]$ExpectTransactionReference,
        [switch]$ExpectNoApprovalMetadata,
        [switch]$ExpectNoTransactionReference
    )

    $approvedBy = "$($WithdrawalAfter.approvedBy)"
    $approvedDate = "$($WithdrawalAfter.approvedDate)"
    $transactionReference = "$($WithdrawalAfter.transactionReference)"

    if ($ExpectApprovalMetadata) {
        Assert-True "$Name keeps approval actor" (-not [string]::IsNullOrWhiteSpace($approvedBy)) "$Name missing approvedBy"
        Assert-True "$Name keeps approval timestamp" (-not [string]::IsNullOrWhiteSpace($approvedDate)) "$Name missing approvedDate"
    }

    if ($ExpectNoApprovalMetadata) {
        Assert-True "$Name clears approval actor" ([string]::IsNullOrWhiteSpace($approvedBy)) "$Name should not keep approvedBy='$approvedBy'"
        Assert-True "$Name clears approval timestamp" ([string]::IsNullOrWhiteSpace($approvedDate)) "$Name should not keep approvedDate='$approvedDate'"
    }

    if ($ExpectTransactionReference) {
        if ($AllowedApprovedReferences.Count -gt 0) {
            Assert-True "$Name keeps winning transaction reference" ($AllowedApprovedReferences -contains $transactionReference) "$Name transactionReference '$transactionReference' did not match any winning approve reference"
        } else {
            Assert-True "$Name keeps transaction reference" (-not [string]::IsNullOrWhiteSpace($transactionReference)) "$Name missing transactionReference"
        }
    }

    if ($ExpectNoTransactionReference) {
        Assert-True "$Name clears transaction reference" ([string]::IsNullOrWhiteSpace($transactionReference)) "$Name should not keep transactionReference '$transactionReference'"
    }
}

function Get-WithdrawalLedgerRows {
    param(
        [string]$BaseUrl,
        [hashtable]$Headers,
        [string]$OwnerId,
        [string]$WithdrawalId
    )

    $ownerTx = Safe-Request -Method GET -Uri "$BaseUrl/owner-fund/owners/$OwnerId/transactions" -Headers $Headers -Label "OwnerTx-$WithdrawalId"
    if ($null -eq $ownerTx) {
        Write-Fail "Owner transaction history read failed for withdrawal $WithdrawalId"
        return @()
    }

    $txList = if ($ownerTx.transactions -is [array]) { $ownerTx.transactions } elseif ($ownerTx.transactions) { @($ownerTx.transactions) } else { @() }
    return ,@($txList | Where-Object { "$($_.referenceId)" -eq "$WithdrawalId" -and "$($_.referenceType)" -eq 'withdrawal' })
}

function Safe-Request {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$Label = ''
    )

    try {
        $params = @{
            Method      = $Method
            Uri         = $Uri
            Headers     = $Headers
            ContentType = 'application/json; charset=utf-8'
        }

        if ($Body -and $Method -ne 'GET') {
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }

        return Invoke-RestMethod @params
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
        Write-Host "  [ERROR] $Label - HTTP $status : $errorBody" -ForegroundColor Red
        return $null
    }
}

function Expect-Failure {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )

    try {
        $params = @{
            Method      = $Method
            Uri         = $Uri
            Headers     = $Headers
            ContentType = 'application/json; charset=utf-8'
        }
        if ($Body -and $Method -ne 'GET') {
            $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }
        $response = Invoke-RestMethod @params
        return @{
            ok     = $true
            status = 200
            data   = $response
            error  = ''
        }
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
        return @{
            ok     = $false
            status = $status
            data   = $null
            error  = $errorBody
        }
    }
}

function Invoke-ParallelJsonPosts {
    param(
        [string]$Uri,
        [hashtable]$Headers,
        [string[]]$Bodies
    )

    $jobs = @()
    foreach ($body in $Bodies) {
        $jobs += Start-Job -ScriptBlock {
            param($JobUri, $JobHeaders, $JobBody)
            try {
                $response = Invoke-WebRequest -Method POST -Uri $JobUri -Headers $JobHeaders -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($JobBody))
                [pscustomobject]@{
                    ok         = $true
                    statusCode = [int]$response.StatusCode
                    body       = $response.Content
                }
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
                [pscustomobject]@{
                    ok         = $false
                    statusCode = $status
                    body       = $errorBody
                }
            }
        } -ArgumentList $Uri, $Headers, $body
    }

    try {
        return $jobs | Receive-Job -Wait -AutoRemoveJob
    } finally {
        foreach ($job in $jobs) {
            if ($job.State -ne 'Completed') {
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Invoke-ParallelRequests {
    param(
        [object[]]$Requests
    )

    $jobs = @()
    foreach ($request in $Requests) {
        $jobs += Start-Job -ScriptBlock {
            param($JobRequest)
            try {
                $params = @{
                    Method      = $JobRequest.Method
                    Uri         = $JobRequest.Uri
                    Headers     = $JobRequest.Headers
                    ContentType = 'application/json; charset=utf-8'
                }
                if ($null -ne $JobRequest.Body -and $JobRequest.Method -ne 'GET') {
                    $params.Body = [System.Text.Encoding]::UTF8.GetBytes([string]$JobRequest.Body)
                }

                $response = Invoke-WebRequest @params
                [pscustomobject]@{
                    ok         = $true
                    statusCode = [int]$response.StatusCode
                    body       = $response.Content
                }
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
                [pscustomobject]@{
                    ok         = $false
                    statusCode = $status
                    body       = $errorBody
                }
            }
        } -ArgumentList $request
    }

    try {
        return $jobs | Receive-Job -Wait -AutoRemoveJob
    } finally {
        foreach ($job in $jobs) {
            if ($job.State -ne 'Completed') {
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Wait-HttpHealthy {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Method GET -Uri $Uri -TimeoutSec 5
            if ([int]$response.StatusCode -eq 200) {
                return $true
            }
        } catch { }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-BackendInstance {
    param(
        [string]$Name,
        [int]$Port,
        [string]$MongoUri
    )

    $outLog = Join-Path $script:ArtifactsDir ("tmp-$Name-$Port.out.log")
    $errLog = Join-Path $script:ArtifactsDir ("tmp-$Name-$Port.err.log")
    if (Test-Path $outLog) { Remove-Item $outLog -Force }
    if (Test-Path $errLog) { Remove-Item $errLog -Force }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        try { Stop-Process -Id $listener.OwningProcess -Force } catch { }
        Start-Sleep -Seconds 1
    }

    $envKeys = @('PORT', 'MONGODB_URI', 'PLAN_TYPE', 'NODE_ENV')
    $snapshot = @{}
    foreach ($key in $envKeys) {
        $snapshot[$key] = (Get-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue).Value
    }

    try {
        $env:PORT = [string]$Port
        $env:MONGODB_URI = $MongoUri
        $env:PLAN_TYPE = 'enterprise'
        $env:NODE_ENV = 'development'
        $proc = Start-Process node -ArgumentList 'dist/main.js' -WorkingDirectory $script:BackendDir -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru
    } finally {
        foreach ($key in $envKeys) {
            if ($null -ne $snapshot[$key] -and $snapshot[$key] -ne '') {
                Set-Item -Path ("Env:" + $key) -Value $snapshot[$key]
            } else {
                Remove-Item -Path ("Env:" + $key) -ErrorAction SilentlyContinue
            }
        }
    }

    $healthUrl = "http://localhost:$Port/health"
    if (-not (Wait-HttpHealthy -Uri $healthUrl -TimeoutSeconds 60)) {
        throw "Backend instance '$Name' failed to become healthy. See $outLog and $errLog"
    }

    $nodePid = $null
    $freshListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($freshListener) { $nodePid = $freshListener.OwningProcess }

    $instance = [pscustomobject]@{
        Name       = $Name
        Port       = $Port
        BaseUrl    = "http://localhost:$Port/api"
        HealthUrl  = $healthUrl
        MongoUri   = $MongoUri
        OutLog     = $outLog
        ErrLog     = $errLog
        WrapperPid = $proc.Id
        NodePid    = $nodePid
    }

    $script:StartedBackends.Add($instance)
    return $instance
}

function Stop-BackendInstance {
    param([object]$Instance)

    if ($null -eq $Instance) { return }

    try {
        $listener = Get-NetTCPConnection -LocalPort $Instance.Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch { }

    try {
        if ($Instance.WrapperPid) {
            Stop-Process -Id $Instance.WrapperPid -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

function Ensure-RegressionUsers {
    param(
        [string]$BaseUrl,
        [string]$MongoUri
    )

    $previousBaseUrl = (Get-Item -Path Env:BACKEND_BASE_URL -ErrorAction SilentlyContinue).Value
    $previousMongoUri = (Get-Item -Path Env:MONGODB_URI -ErrorAction SilentlyContinue).Value
    try {
        Set-Item -Path Env:BACKEND_BASE_URL -Value $BaseUrl
        Set-Item -Path Env:MONGODB_URI -Value $MongoUri
        & powershell -ExecutionPolicy Bypass -File $script:SetupScript
        if ($LASTEXITCODE -ne 0) {
            throw "Regression setup exited with code $LASTEXITCODE"
        }
    } finally {
        if ($null -ne $previousBaseUrl -and $previousBaseUrl -ne '') {
            Set-Item -Path Env:BACKEND_BASE_URL -Value $previousBaseUrl
        } else {
            Remove-Item Env:BACKEND_BASE_URL -ErrorAction SilentlyContinue
        }
        if ($null -ne $previousMongoUri -and $previousMongoUri -ne '') {
            Set-Item -Path Env:MONGODB_URI -Value $previousMongoUri
        } else {
            Remove-Item Env:MONGODB_URI -ErrorAction SilentlyContinue
        }
    }
}

function Build-OrderPayload {
    param(
        [string]$CustomerName,
        [string]$ProductId,
        [string]$SupplierId,
        [string]$AgentId,
        [int]$Quantity,
        [int]$CodAmount
    )

    return (New-JsonBody @{
        customerName      = $CustomerName
        productId         = $ProductId
        supplierId        = $SupplierId
        agentId           = $AgentId
        quantity          = $Quantity
        codAmount         = $CodAmount
        orderDate         = (Get-Date).ToString('yyyy-MM-dd')
        agentQuoteId      = "qa-agent-quote-$($script:Ts)-$CustomerName"
        agentAppliedPrice = 80000
        agentQuote        = 80000
    })
}

function Create-CompletedOrder {
    param(
        [string]$Label,
        [hashtable]$Headers,
        [string]$BaseUrl,
        [string]$ProductId,
        [string]$SupplierId,
        [string]$AgentId,
        [string]$DeliveredStatus
    )

    $createBody = Build-OrderPayload -CustomerName $Label -ProductId $ProductId -SupplierId $SupplierId -AgentId $AgentId -Quantity 1 -CodAmount 200000
    $order = Safe-Request -Method POST -Uri "$BaseUrl/test-order2" -Headers $Headers -Body $createBody -Label "Create-$Label"
    $orderId = Get-Id $order
    if (-not $orderId) {
        Write-Fail "Create order failed for $Label"
        throw "create_order_failed_$Label"
    }
    Write-Pass "Created order for ${Label}: $orderId"

    $updated = Safe-Request -Method PATCH -Uri "$BaseUrl/test-order2/$orderId" -Headers $Headers -Body (New-JsonBody @{ orderStatus = $DeliveredStatus }) -Label "Complete-$Label"
    if (-not $updated) {
        Write-Fail "Complete order failed for $Label"
        throw "complete_order_failed_$Label"
    }
    Write-Pass "Completed order for $Label"
    return $updated
}

$script:PassCount = 0
$script:FailCount = 0
$script:FailDetails = @()
$script:StartedBackends = New-Object System.Collections.ArrayList
$script:Ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
$script:BackendDir = Join-Path $script:RepoRoot 'backend'
$script:ArtifactsDir = Join-Path $script:RepoRoot 'tests\backend\artifacts\results'
$script:SetupScript = Join-Path $script:RepoRoot 'tests\backend\setup\ensure-regression-users.ps1'

New-Item -ItemType Directory -Path $script:ArtifactsDir -Force | Out-Null
$logPath = Join-Path $script:ArtifactsDir ("e2e.concurrent-finance-ripple-run-$($script:Ts).log")
Start-Transcript -Path $logPath -Force | Out-Null

try {
    Write-Section "E2E TEST: CONCURRENT FINANCE RIPPLE - $($script:Ts)"

    $port = 3660
    $mongoUri = "mongodb://127.0.0.1:27017/htxbachgia_concurrent_finance_ripple_$($script:Ts)"
    $instance = $null
    $headers = $null
    $directorId = ''
    $deliveredStatus = ''

    Write-Step '0.1' 'Start isolated backend'
    $instance = Start-BackendInstance -Name 'concurrent-finance-ripple' -Port $port -MongoUri $mongoUri
    Write-Pass "Isolated backend healthy on $($instance.BaseUrl)"

    Write-Step '0.2' 'Ensure baseline regression users'
    Ensure-RegressionUsers -BaseUrl $instance.BaseUrl -MongoUri $mongoUri
    Write-Pass 'Regression users ensured'

    Write-Step '0.3' 'Login director and resolve canonical delivery status'
    $login = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label 'Login'
    if (-not $login -or -not $login.access_token) {
        Write-Fail 'Director login failed'
        throw 'director_login_failed'
    }
    $headers = @{ Authorization = "Bearer $($login.access_token)" }
    $directorId = [string]$login.user.id
    Write-Pass "Director login OK: $directorId"

    $deliveryStatuses = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/delivery-status" -Headers $headers -Label 'DeliveryStatuses'
    $delivered = @($deliveryStatuses | Where-Object { $_.isPaymentTrigger -eq $true -and $_.isReturnStatus -ne $true } | Sort-Object order | Select-Object -First 1)
    if ($delivered.Count -eq 0) {
        Write-Fail 'Could not resolve canonical delivered status'
        throw 'delivery_status_missing'
    }
    $deliveredStatus = [string]$delivered[0].name
    Write-Pass "Resolved delivered status: $deliveredStatus"

    Write-Step '0.4' 'Create isolated finance fixtures'
    $extAgent = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/users" -Headers $headers -Body (New-JsonBody @{
        email = "concurrency-ext-agent-$($script:Ts)@test.com"; password = '123456'; fullName = 'Concurrency Ext Agent'; role = 'external_agent'; phone = '0901110001'; isActive = $true
    }) -Label 'CreateExtAgent'
    $supplier = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/users" -Headers $headers -Body (New-JsonBody @{
        email = "concurrency-supplier-$($script:Ts)@test.com"; password = '123456'; fullName = 'Concurrency Supplier'; role = 'internal_supplier'; phone = '0901110002'; isActive = $true
    }) -Label 'CreateSupplier'
    $extAgentId = Get-Id $extAgent
    $supplierId = Get-Id $supplier
    Assert-True 'Created external agent fixture' (-not [string]::IsNullOrWhiteSpace($extAgentId)) 'External agent fixture create failed'
    Assert-True 'Created supplier fixture' (-not [string]::IsNullOrWhiteSpace($supplierId)) 'Supplier fixture create failed'

    $category = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/product-category" -Headers $headers -Body (New-JsonBody @{
        name = "Concurrency Category $($script:Ts)"; description = 'Concurrency finance ripple'; isActive = $true
    }) -Label 'CreateCategory'
    $categoryId = Get-Id $category
    Assert-True 'Created category fixture' (-not [string]::IsNullOrWhiteSpace($categoryId)) 'Category fixture create failed'

    $product = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/products" -Headers $headers -Body (New-JsonBody @{
        name = "Concurrency Product $($script:Ts)"
        categoryId = $categoryId
        isReturnable = $true
        importPrice = 50000
        shippingCost = 30000
        packagingCost = 25000
    }) -Label 'CreateProduct'
    $productId = Get-Id $product
    Assert-True 'Created product fixture' (-not [string]::IsNullOrWhiteSpace($productId)) 'Product fixture create failed'

    $supplierQuote = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/supplier-quotes" -Headers $headers -Body (New-JsonBody @{
        supplierId = $supplierId
        productId = $productId
        price = 50000
        shippingFee = 30000
        returnFee = 25000
        effectiveAt = (Get-Date).ToString('yyyy-MM-dd')
        isReturnableOverride = $true
    }) -Label 'CreateSupplierQuote'
    $supplierQuoteId = Get-Id $supplierQuote
    Assert-True 'Created supplier quote fixture' (-not [string]::IsNullOrWhiteSpace($supplierQuoteId)) 'Supplier quote fixture create failed'

    $owner = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/owner-fund/owners" -Headers $headers -Body (New-JsonBody @{
        name = "Concurrency Owner $($script:Ts)"
        email = "concurrency-owner-$($script:Ts)@test.com"
        phone = '0901110003'
        profitSharePercentage = 100
        isActive = $true
    }) -Label 'CreateOwner'
    $ownerId = Get-Id $owner
    Assert-True 'Created owner fixture' (-not [string]::IsNullOrWhiteSpace($ownerId)) 'Owner fixture create failed'

    $ownerBalance = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId/update-balance" -Headers $headers -Body (New-JsonBody @{ profitAmount = 500000 }) -Label 'SeedOwnerBalance'
    if ($ownerBalance) {
        Write-Pass 'Owner balance seeded to 500000'
    } else {
        Write-Fail 'Owner balance seed failed'
        throw 'owner_balance_seed_failed'
    }

    Write-Section 'CASE 1: Supplier payment retry/idempotency'
    $supplierOrder = Create-CompletedOrder -Label "SupplierDup-$($script:Ts)" -Headers $headers -BaseUrl $instance.BaseUrl -ProductId $productId -SupplierId $supplierId -AgentId $extAgentId -DeliveredStatus $deliveredStatus
    $supplierOrderId = Get-Id $supplierOrder
    $supplierBatchOne = "SUP-CON-1-$($script:Ts)"
    $supplierBatchTwo = "SUP-CON-2-$($script:Ts)"
    $supplierPaidDateOne = (Get-Date).ToString('yyyy-MM-dd')
    $supplierPaidDateTwo = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

    Write-Step '1.1' 'Create first supplier payment batch'
    $firstSupplierBatch = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/test-order2/supplier-payment-batch" -Headers $headers -Body (New-JsonBody @{
        orderIds = @($supplierOrderId)
        batchId = $supplierBatchOne
        paidDate = $supplierPaidDateOne
        note = 'First supplier batch'
    }) -Label 'SupplierBatchFirst'
    if ($firstSupplierBatch) {
        Write-Pass 'First supplier payment batch created'
    } else {
        Write-Fail 'First supplier payment batch failed'
    }

    $supplierAfterFirst = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/test-order2/$supplierOrderId" -Headers $headers -Label 'SupplierOrderAfterFirst'
    Assert-Equal 'Supplier order batch after first payment' $supplierBatchOne "$($supplierAfterFirst.supplierPaymentBatchId)"
    Assert-Equal 'Supplier payment status after first payment' 'paid' "$($supplierAfterFirst.supplierPaymentStatus)"
    $supplierPaidAtFirst = "$($supplierAfterFirst.supplierPaidAt)"

    Write-Step '1.2' 'Retry supplier payment on the same order with a new batch'
    $secondSupplierBatch = Expect-Failure -Method POST -Uri "$($instance.BaseUrl)/test-order2/supplier-payment-batch" -Headers $headers -Body (New-JsonBody @{
        orderIds = @($supplierOrderId)
        batchId = $supplierBatchTwo
        paidDate = $supplierPaidDateTwo
        note = 'Retry supplier batch should fail'
    })
    Assert-True 'Duplicate supplier payment batch is rejected' (-not $secondSupplierBatch.ok -and $secondSupplierBatch.status -ge 400) "Duplicate supplier payment batch should fail but got HTTP $($secondSupplierBatch.status)"

    $supplierAfterRetry = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/test-order2/$supplierOrderId" -Headers $headers -Label 'SupplierOrderAfterRetry'
    Assert-Equal 'Supplier order batch remains first batch' $supplierBatchOne "$($supplierAfterRetry.supplierPaymentBatchId)"
    Assert-Equal 'Supplier paidAt remains first payment timestamp' $supplierPaidAtFirst "$($supplierAfterRetry.supplierPaidAt)"

    Write-Section 'CASE 2: Agent payment retry/idempotency'
    $agentOrder = Create-CompletedOrder -Label "AgentDup-$($script:Ts)" -Headers $headers -BaseUrl $instance.BaseUrl -ProductId $productId -SupplierId $supplierId -AgentId $extAgentId -DeliveredStatus $deliveredStatus
    $agentOrderId = Get-Id $agentOrder
    $agentBatchOne = "AG-CON-1-$($script:Ts)"
    $agentBatchTwo = "AG-CON-2-$($script:Ts)"
    $agentPaidDateOne = (Get-Date).ToString('yyyy-MM-dd')
    $agentPaidDateTwo = (Get-Date).AddDays(1).ToString('yyyy-MM-dd')

    Write-Step '2.1' 'Create first agent payment batch'
    $firstAgentBatch = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/test-order2/agent-payment-batch" -Headers $headers -Body (New-JsonBody @{
        orderIds = @($agentOrderId)
        batchId = $agentBatchOne
        paidDate = $agentPaidDateOne
        note = 'First agent batch'
    }) -Label 'AgentBatchFirst'
    if ($firstAgentBatch) {
        Write-Pass 'First agent payment batch created'
    } else {
        Write-Fail 'First agent payment batch failed'
    }

    $agentAfterFirst = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/test-order2/$agentOrderId" -Headers $headers -Label 'AgentOrderAfterFirst'
    Assert-Equal 'Agent order batch after first payment' $agentBatchOne "$($agentAfterFirst.agentPaymentBatchId)"
    Assert-Equal 'Agent payment status after first payment' 'paid' "$($agentAfterFirst.agentPaymentStatus)"
    $agentPaidAtFirst = "$($agentAfterFirst.agentPaidAt)"

    Write-Step '2.2' 'Retry agent payment on the same order with a new batch'
    $secondAgentBatch = Expect-Failure -Method POST -Uri "$($instance.BaseUrl)/test-order2/agent-payment-batch" -Headers $headers -Body (New-JsonBody @{
        orderIds = @($agentOrderId)
        batchId = $agentBatchTwo
        paidDate = $agentPaidDateTwo
        note = 'Retry agent batch should fail'
    })
    Assert-True 'Duplicate agent payment batch is rejected' (-not $secondAgentBatch.ok -and $secondAgentBatch.status -ge 400) "Duplicate agent payment batch should fail but got HTTP $($secondAgentBatch.status)"

    $agentAfterRetry = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/test-order2/$agentOrderId" -Headers $headers -Label 'AgentOrderAfterRetry'
    Assert-Equal 'Agent order batch remains first batch' $agentBatchOne "$($agentAfterRetry.agentPaymentBatchId)"
    Assert-Equal 'Agent paidAt remains first payment timestamp' $agentPaidAtFirst "$($agentAfterRetry.agentPaidAt)"

    Write-Section 'CASE 3: Agent atomic race'
    $atomicOrder = Create-CompletedOrder -Label "AgentAtomic-$($script:Ts)" -Headers $headers -BaseUrl $instance.BaseUrl -ProductId $productId -SupplierId $supplierId -AgentId $extAgentId -DeliveredStatus $deliveredStatus
    $atomicOrderId = Get-Id $atomicOrder
    $atomicBodies = @(
        (New-JsonBody @{
            orderIds = @($atomicOrderId)
            batchId = "AG-ATOMIC-A-$($script:Ts)"
            paidDate = (Get-Date).ToString('yyyy-MM-dd')
            note = 'Atomic batch A'
        }),
        (New-JsonBody @{
            orderIds = @($atomicOrderId)
            batchId = "AG-ATOMIC-B-$($script:Ts)"
            paidDate = (Get-Date).ToString('yyyy-MM-dd')
            note = 'Atomic batch B'
        })
    )
    $atomicResults = Invoke-ParallelJsonPosts -Uri "$($instance.BaseUrl)/test-order2/agent-payment-batch/atomic" -Headers $headers -Bodies $atomicBodies
    $atomicSuccess = @($atomicResults | Where-Object { $_.ok -and ($_.statusCode -eq 201 -or $_.statusCode -eq 200) })
    $atomicFailures = @($atomicResults | Where-Object { -not $_.ok -or $_.statusCode -ge 400 })
    Assert-Equal 'Agent atomic race success count' '1' "$($atomicSuccess.Count)"
    Assert-Equal 'Agent atomic race failure count' '1' "$($atomicFailures.Count)"

    $atomicAfter = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/test-order2/$atomicOrderId" -Headers $headers -Label 'AtomicOrderAfter'
    $atomicBatchId = "$($atomicAfter.agentPaymentBatchId)"
    Assert-True 'Atomic order has one persisted batch id' ($atomicBatchId -like 'AG-ATOMIC-*-*') "Atomic order batch id missing after race"
    Assert-Equal 'Atomic order payment status is paid' 'paid' "$($atomicAfter.agentPaymentStatus)"

    Write-Section 'CASE 4: Owner withdrawal approve race'
    $withdrawal = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/owner-fund/withdrawals" -Headers $headers -Body (New-JsonBody @{
        ownerId = $ownerId
        amount = 200000
        reason = 'Concurrency approve race'
        bankAccount = '123456789'
        bankName = 'VCB'
        bankAccountName = 'Concurrency Owner'
    }) -Label 'CreateWithdrawal'
    $withdrawalId = Get-Id $withdrawal
    Assert-True 'Created pending withdrawal' (-not [string]::IsNullOrWhiteSpace($withdrawalId)) 'Create withdrawal failed'

    $approveBodies = @(
        (New-JsonBody @{
            approvedBy = $directorId
            approvalNotes = 'approve A'
            transactionReference = "WD-A-$($script:Ts)"
        }),
        (New-JsonBody @{
            approvedBy = $directorId
            approvalNotes = 'approve B'
            transactionReference = "WD-B-$($script:Ts)"
        })
    )
    $approveResults = Invoke-ParallelJsonPosts -Uri "$($instance.BaseUrl)/owner-fund/withdrawals/$withdrawalId/approve" -Headers $headers -Bodies $approveBodies
    $approveSuccess = @($approveResults | Where-Object { $_.ok -and ($_.statusCode -eq 200 -or $_.statusCode -eq 201) })
    $approveFailures = @($approveResults | Where-Object { -not $_.ok -or $_.statusCode -ge 400 })
    Assert-Equal 'Withdrawal approve race success count' '1' "$($approveSuccess.Count)"
    Assert-Equal 'Withdrawal approve race failure count' '1' "$($approveFailures.Count)"

    $ownerAfterApprove = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerAfterApprove'
    Assert-Approx 'Owner available balance decremented once' 300000 (Number-OrZero $ownerAfterApprove.availableBalance)
    Assert-Approx 'Owner totalWithdrawn incremented once' 200000 (Number-OrZero $ownerAfterApprove.totalWithdrawn)

    $withdrawalAfterApprove = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/withdrawals/$withdrawalId" -Headers $headers -Label 'WithdrawalAfterApprove'
    Assert-Equal 'Withdrawal status after approve race' 'approved' "$($withdrawalAfterApprove.status)"
    Assert-True 'Withdrawal transaction reference belongs to one winner' (("$($withdrawalAfterApprove.transactionReference)" -eq "WD-A-$($script:Ts)") -or ("$($withdrawalAfterApprove.transactionReference)" -eq "WD-B-$($script:Ts)")) 'Withdrawal transaction reference was not preserved from a single winner'
    Assert-WithdrawalTerminalMetadata -Name 'Approve race winner' -WithdrawalAfter $withdrawalAfterApprove -AllowedApprovedReferences @("WD-A-$($script:Ts)", "WD-B-$($script:Ts)") -ExpectApprovalMetadata -ExpectTransactionReference
    $approveRaceLedgerRows = @(Get-WithdrawalLedgerRows -BaseUrl $instance.BaseUrl -Headers $headers -OwnerId $ownerId -WithdrawalId $withdrawalId)
    Assert-Equal 'Withdrawal approve race ledger row count' '1' "$($approveRaceLedgerRows.Count)"
    if ($approveRaceLedgerRows.Count -eq 1) {
        Assert-Approx 'Withdrawal approve race ledger amount' 200000 (Number-OrZero $approveRaceLedgerRows[0].amount)
    }

    Write-Section 'CASE 5: Owner withdrawal approve vs reject race'
    $approveRejectWithdrawal = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/owner-fund/withdrawals" -Headers $headers -Body (New-JsonBody @{
        ownerId = $ownerId
        amount = 50000
        reason = 'Concurrency approve reject race'
        bankAccount = '123456789'
        bankName = 'VCB'
        bankAccountName = 'Concurrency Owner'
    }) -Label 'CreateApproveRejectWithdrawal'
    $approveRejectWithdrawalId = Get-Id $approveRejectWithdrawal
    Assert-True 'Created approve vs reject pending withdrawal' (-not [string]::IsNullOrWhiteSpace($approveRejectWithdrawalId)) 'Create approve vs reject withdrawal failed'

    $ownerBeforeApproveReject = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerBeforeApproveReject'
    $approveRejectResults = Invoke-ParallelRequests -Requests @(
        [pscustomobject]@{
            Method  = 'POST'
            Uri     = "$($instance.BaseUrl)/owner-fund/withdrawals/$approveRejectWithdrawalId/approve"
            Headers = $headers
            Body    = (New-JsonBody @{
                approvedBy = $directorId
                approvalNotes = 'approve beats reject'
                transactionReference = "WD-AR-APPROVE-$($script:Ts)"
            })
        },
        [pscustomobject]@{
            Method  = 'POST'
            Uri     = "$($instance.BaseUrl)/owner-fund/withdrawals/$approveRejectWithdrawalId/reject"
            Headers = $headers
            Body    = (New-JsonBody @{
                approvedBy = $directorId
                approvalNotes = 'reject beats approve'
            })
        }
    )
    $approveRejectSuccess = @($approveRejectResults | Where-Object { $_.ok -and ($_.statusCode -eq 200 -or $_.statusCode -eq 201) })
    $approveRejectFailures = @($approveRejectResults | Where-Object { -not $_.ok -or $_.statusCode -ge 400 })
    Assert-Equal 'Withdrawal approve vs reject race success count' '1' "$($approveRejectSuccess.Count)"
    Assert-Equal 'Withdrawal approve vs reject race failure count' '1' "$($approveRejectFailures.Count)"

    $ownerAfterApproveReject = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerAfterApproveReject'
    $withdrawalAfterApproveReject = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/withdrawals/$approveRejectWithdrawalId" -Headers $headers -Label 'WithdrawalAfterApproveReject'
    Assert-True 'Approve vs reject final status is one terminal winner' (@('approved', 'rejected') -contains "$($withdrawalAfterApproveReject.status)") "Approve vs reject ended with unexpected status $($withdrawalAfterApproveReject.status)"
    Assert-WithdrawalBalanceConsistency -Name 'Approve vs reject race' -Amount 50000 -OwnerBefore $ownerBeforeApproveReject -OwnerAfter $ownerAfterApproveReject -WithdrawalAfter $withdrawalAfterApproveReject -RejectedStatuses @('rejected')
    $approveRejectLedgerRows = @(Get-WithdrawalLedgerRows -BaseUrl $instance.BaseUrl -Headers $headers -OwnerId $ownerId -WithdrawalId $approveRejectWithdrawalId)
    if ("$($withdrawalAfterApproveReject.status)" -eq 'approved') {
        Assert-WithdrawalTerminalMetadata -Name 'Approve vs reject approved winner' -WithdrawalAfter $withdrawalAfterApproveReject -AllowedApprovedReferences @("WD-AR-APPROVE-$($script:Ts)") -ExpectApprovalMetadata -ExpectTransactionReference
        Assert-Equal 'Approve vs reject approved ledger row count' '1' "$($approveRejectLedgerRows.Count)"
        if ($approveRejectLedgerRows.Count -eq 1) {
            Assert-Approx 'Approve vs reject approved ledger amount' 50000 (Number-OrZero $approveRejectLedgerRows[0].amount)
        }
    } else {
        Assert-WithdrawalTerminalMetadata -Name 'Approve vs reject rejected winner' -WithdrawalAfter $withdrawalAfterApproveReject -ExpectApprovalMetadata -ExpectNoTransactionReference
        Assert-Equal 'Approve vs reject rejected ledger row count' '0' "$($approveRejectLedgerRows.Count)"
    }

    Write-Section 'CASE 6: Owner withdrawal approve vs cancel race'
    $approveCancelWithdrawal = Safe-Request -Method POST -Uri "$($instance.BaseUrl)/owner-fund/withdrawals" -Headers $headers -Body (New-JsonBody @{
        ownerId = $ownerId
        amount = 60000
        reason = 'Concurrency approve cancel race'
        bankAccount = '123456789'
        bankName = 'VCB'
        bankAccountName = 'Concurrency Owner'
    }) -Label 'CreateApproveCancelWithdrawal'
    $approveCancelWithdrawalId = Get-Id $approveCancelWithdrawal
    Assert-True 'Created approve vs cancel pending withdrawal' (-not [string]::IsNullOrWhiteSpace($approveCancelWithdrawalId)) 'Create approve vs cancel withdrawal failed'

    $ownerBeforeApproveCancel = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerBeforeApproveCancel'
    $approveCancelResults = Invoke-ParallelRequests -Requests @(
        [pscustomobject]@{
            Method  = 'POST'
            Uri     = "$($instance.BaseUrl)/owner-fund/withdrawals/$approveCancelWithdrawalId/approve"
            Headers = $headers
            Body    = (New-JsonBody @{
                approvedBy = $directorId
                approvalNotes = 'approve beats cancel'
                transactionReference = "WD-AC-APPROVE-$($script:Ts)"
            })
        },
        [pscustomobject]@{
            Method  = 'POST'
            Uri     = "$($instance.BaseUrl)/owner-fund/withdrawals/$approveCancelWithdrawalId/cancel"
            Headers = $headers
            Body    = '{}'
        }
    )
    $approveCancelSuccess = @($approveCancelResults | Where-Object { $_.ok -and ($_.statusCode -eq 200 -or $_.statusCode -eq 201) })
    $approveCancelFailures = @($approveCancelResults | Where-Object { -not $_.ok -or $_.statusCode -ge 400 })
    Assert-Equal 'Withdrawal approve vs cancel race success count' '1' "$($approveCancelSuccess.Count)"
    Assert-Equal 'Withdrawal approve vs cancel race failure count' '1' "$($approveCancelFailures.Count)"

    $ownerAfterApproveCancel = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/owners/$ownerId" -Headers $headers -Label 'OwnerAfterApproveCancel'
    $withdrawalAfterApproveCancel = Safe-Request -Method GET -Uri "$($instance.BaseUrl)/owner-fund/withdrawals/$approveCancelWithdrawalId" -Headers $headers -Label 'WithdrawalAfterApproveCancel'
    Assert-True 'Approve vs cancel final status is one terminal winner' (@('approved', 'cancelled') -contains "$($withdrawalAfterApproveCancel.status)") "Approve vs cancel ended with unexpected status $($withdrawalAfterApproveCancel.status)"
    Assert-WithdrawalBalanceConsistency -Name 'Approve vs cancel race' -Amount 60000 -OwnerBefore $ownerBeforeApproveCancel -OwnerAfter $ownerAfterApproveCancel -WithdrawalAfter $withdrawalAfterApproveCancel -RejectedStatuses @('cancelled')
    $approveCancelLedgerRows = @(Get-WithdrawalLedgerRows -BaseUrl $instance.BaseUrl -Headers $headers -OwnerId $ownerId -WithdrawalId $approveCancelWithdrawalId)
    if ("$($withdrawalAfterApproveCancel.status)" -eq 'approved') {
        Assert-WithdrawalTerminalMetadata -Name 'Approve vs cancel approved winner' -WithdrawalAfter $withdrawalAfterApproveCancel -AllowedApprovedReferences @("WD-AC-APPROVE-$($script:Ts)") -ExpectApprovalMetadata -ExpectTransactionReference
        Assert-Equal 'Approve vs cancel approved ledger row count' '1' "$($approveCancelLedgerRows.Count)"
        if ($approveCancelLedgerRows.Count -eq 1) {
            Assert-Approx 'Approve vs cancel approved ledger amount' 60000 (Number-OrZero $approveCancelLedgerRows[0].amount)
        }
    } else {
        Assert-WithdrawalTerminalMetadata -Name 'Approve vs cancel cancelled winner' -WithdrawalAfter $withdrawalAfterApproveCancel -ExpectNoApprovalMetadata -ExpectNoTransactionReference
        Assert-Equal 'Approve vs cancel cancelled ledger row count' '0' "$($approveCancelLedgerRows.Count)"
    }

    Write-Section 'SUMMARY'
    Write-Host "Total: $($script:PassCount + $script:FailCount) | PASS: $($script:PassCount) | FAIL: $($script:FailCount)"
    if ($script:FailCount -gt 0) {
        Write-Host ''
        Write-Host 'Failed checks:' -ForegroundColor Red
        foreach ($failure in $script:FailDetails) {
            Write-Host "  - $failure" -ForegroundColor Red
        }
        exit 1
    }

    exit 0
} finally {
    foreach ($started in @($script:StartedBackends)) {
        Stop-BackendInstance -Instance $started
    }
    Stop-Transcript | Out-Null
}
