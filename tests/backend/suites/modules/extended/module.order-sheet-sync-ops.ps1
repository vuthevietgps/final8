#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.ORDER-SHEET-SYNC-OPS.PS1
    =====================================================================================
    Target coverage:
    - BE-OPS-04: order-sheet-sync permissions, status/contracts, credentials negative handling
    - BE-OPS-05: linked agent/supplier listing, single-sync negative path, sync-all failure counters
    - BE-OPS-06: ops-actions permissions, emergency bulk-sync diff semantics, overdue boundary,
                 verification-failed alert path
    =====================================================================================
#>

$ErrorActionPreference = "Continue"
$BaseUrl = if ($env:BACKEND_BASE_URL) { $env:BACKEND_BASE_URL.TrimEnd('/') } else { "http://localhost:3000/api" }
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..\..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$VietnamTimeZone = [System.TimeZoneInfo]::FindSystemTimeZoneById('SE Asia Standard Time')

function Write-Section($title) { Write-Host ""; Write-Host ("=" * 96) -ForegroundColor Cyan; Write-Host "  $title" -ForegroundColor Cyan; Write-Host ("=" * 96) -ForegroundColor Cyan }
function Write-Step($step, $desc) { Write-Host ""; Write-Host "--- Step $step : $desc ---" -ForegroundColor Yellow }
function Write-Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:passCount++ }
function Write-Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:failCount++; $script:failDetails += $msg }
function Write-Info($msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }

function Get-ErrorBody([object]$Exception) {
  try {
    if ($Exception.Response -and $Exception.Response.GetResponseStream) {
      return [System.IO.StreamReader]::new($Exception.Response.GetResponseStream()).ReadToEnd()
    }
  } catch {}
  return ""
}

function Convert-ResponseJson {
  param([string]$Text)
  if ($null -eq $Text) { return $null }
  $clean = $Text.Trim()
  if ($clean.StartsWith([char]0xFEFF)) { $clean = $clean.TrimStart([char]0xFEFF) }
  if (-not $clean) { return $null }
  try { return $clean | ConvertFrom-Json } catch { return $clean }
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [string]$Label = ""
  )

  try {
    $params = @{
      Method = $Method
      Uri = $Uri
      Headers = $Headers
      ContentType = "application/json; charset=utf-8"
      UseBasicParsing = $true
      ErrorAction = "Stop"
    }
    if ($null -ne $Body -and $Method -ne "GET") {
      $jsonBody = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 20 }
      $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($jsonBody)
    }
    $response = Invoke-WebRequest @params
    return @{
      success = $true
      statusCode = [int]$response.StatusCode
      data = Convert-ResponseJson -Text $response.Content
      raw = $response.Content
    }
  } catch {
    $statusCode = 0
    try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
    $errorBody = Get-ErrorBody $_.Exception
    Write-Host "  [ERROR] $Label - HTTP $statusCode : $errorBody" -ForegroundColor Red
    return @{
      success = $false
      statusCode = $statusCode
      data = Convert-ResponseJson -Text $errorBody
      raw = $errorBody
    }
  }
}

function Login-User {
  param([string]$Email)
  return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/auth/login" -Body @{ email = $Email; password = "123456" } -Label "Login-$Email"
}

function Get-AuthHeaders {
  param([string]$Token)
  return @{ Authorization = "Bearer $Token" }
}

function Get-VietnamNow {
  return [System.TimeZoneInfo]::ConvertTime((Get-Date), $VietnamTimeZone)
}

function Get-SuiteMongoUri {
  if ($env:ORDER_SHEET_SYNC_OPS_MONGODB_URI) {
    return $env:ORDER_SHEET_SYNC_OPS_MONGODB_URI.Trim()
  }
  if ($env:MONGODB_URI) {
    return $env:MONGODB_URI.Trim()
  }

  $envPath = Join-Path $BackendDir '.env'
  if (-not (Test-Path $envPath)) {
    return $null
  }

  foreach ($line in Get-Content -Path $envPath) {
    if ($line -match '^\s*MONGODB_URI\s*=\s*(.+?)\s*$') {
      return $matches[1].Trim().Trim("'").Trim('"')
    }
  }

  return $null
}

function Set-ApiTokenAdsManagementFixture {
  param(
    [string]$TokenId,
    [string]$AdAccountId
  )

  $mongoUri = Get-SuiteMongoUri
  if (-not $mongoUri) {
    Write-Fail "Cannot seed api-token verification fixture because Mongo URI is unavailable"
    return $false
  }

  $repoRootJson = $RepoRoot | ConvertTo-Json -Compress
  $mongoUriJson = $mongoUri | ConvertTo-Json -Compress
  $tokenIdJson = $TokenId | ConvertTo-Json -Compress
  $adAccountIdJson = $AdAccountId | ConvertTo-Json -Compress
  $nodeScript = @"
const path = require('path');
const { createRequire } = require('module');
const repoRoot = $repoRootJson;
const mongoUri = $mongoUriJson;
const tokenId = $tokenIdJson;
const adAccountId = $adAccountIdJson;
const backendRequire = createRequire(path.join(repoRoot, 'backend', 'package.json'));
const mongoose = backendRequire('mongoose');

(async () => {
  await mongoose.connect(mongoUri);
  const { ObjectId } = mongoose.Types;
  const result = await mongoose.connection.db.collection('apitokens').updateOne(
    { _id: new ObjectId(tokenId) },
    {
      `$set: {
        status: 'active',
        isPrimary: true,
        lastCheckStatus: 'valid',
        lastCheckMessage: 'Seeded by module.order-sheet-sync-ops.ps1',
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
        scopes: ['ads_management'],
        adAccountId,
      },
    },
  );
  if (!result.matchedCount) {
    throw new Error('ApiToken not found');
  }
  console.log('OK');
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
"@

  $output = $nodeScript | node -
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "Could not seed api-token verification fixture for $TokenId"
    return $false
  }

  Write-Info "Seeded api-token verification fixture for $TokenId"
  return $true
}

function New-TempUser {
  param(
    [hashtable]$Headers,
    [string]$Role,
    [string]$Prefix,
    [string]$GoogleDriveLink = ""
  )

  $stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
  $phoneSuffix = $stamp.Substring($stamp.Length - 8)
  $body = @{
    fullName = "$Prefix $Role $stamp"
    email = "$Prefix.$Role.$stamp@test.com"
    password = "123456"
    phone = "09$phoneSuffix"
    role = $Role
    isActive = $true
  }
  if ($GoogleDriveLink) {
    $body.googleDriveLink = $GoogleDriveLink
  }

  return Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $Headers -Body $body -Label "CreateUser-$Role-$Prefix"
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$tsDigits = $ts -replace '[^0-9]', ''

$dirHeaders = @{}
$tempOrderIds = New-Object System.Collections.Generic.List[string]
$tempUserIds = New-Object System.Collections.Generic.List[string]
$tempTokenIds = New-Object System.Collections.Generic.List[string]
$tempAdGroupIds = New-Object System.Collections.Generic.List[string]
$tempAdAccountIds = New-Object System.Collections.Generic.List[string]
$tempFanpageIds = New-Object System.Collections.Generic.List[string]
$tempProductCategoryId = $null
$tempProductId = $null

Write-Section "MODULE TEST: ORDER SHEET SYNC + OPS - $ts"

try {
  Write-Section "PHASE 0: Login"
  $dirLogin = Login-User -Email "director@test.com"
  $manLogin = Login-User -Email "manager@test.com"
  $empLogin = Login-User -Email "employee@test.com"
  if (-not ($dirLogin.success -and $dirLogin.data.access_token)) { Write-Fail "Director login failed"; throw "director-login" }
  if (-not ($manLogin.success -and $manLogin.data.access_token)) { Write-Fail "Manager login failed"; throw "manager-login" }
  if (-not ($empLogin.success -and $empLogin.data.access_token)) { Write-Fail "Employee login failed"; throw "employee-login" }
  $dirHeaders = Get-AuthHeaders -Token $dirLogin.data.access_token
  $manHeaders = Get-AuthHeaders -Token $manLogin.data.access_token
  $empHeaders = Get-AuthHeaders -Token $empLogin.data.access_token
  Write-Pass "Logged in director, manager, employee"

  Write-Section "PHASE 1: Permission boundaries"
  $orderSheetDirector = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/order-sheet-sync/status" -Headers $dirHeaders -Label "DirOrderSheetStatus"
  if ($orderSheetDirector.statusCode -eq 200) { Write-Pass "Director allowed on order-sheet-sync" } else { Write-Fail "Director should be allowed on order-sheet-sync" }
  foreach ($entry in @(
    @{ Label = "Manager"; Headers = $manHeaders },
    @{ Label = "Employee"; Headers = $empHeaders }
  )) {
    $blocked = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/order-sheet-sync/status" -Headers $entry.Headers -Label "OrderSheet-$($entry.Label)"
    if ($blocked.statusCode -in @(401, 403)) { Write-Pass "$($entry.Label) blocked on order-sheet-sync" } else { Write-Fail "$($entry.Label) should be blocked on order-sheet-sync" }
  }

  $opsDirector = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ops-actions/suggestions" -Headers $dirHeaders -Label "DirOpsSuggestions"
  if ($opsDirector.statusCode -eq 200) { Write-Pass "Director allowed on ops-actions" } else { Write-Fail "Director should be allowed on ops-actions" }
  foreach ($entry in @(
    @{ Label = "Manager"; Headers = $manHeaders },
    @{ Label = "Employee"; Headers = $empHeaders }
  )) {
    $blocked = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ops-actions/suggestions" -Headers $entry.Headers -Label "Ops-$($entry.Label)"
    if ($blocked.statusCode -in @(401, 403)) { Write-Pass "$($entry.Label) blocked on ops-actions" } else { Write-Fail "$($entry.Label) should be blocked on ops-actions" }
  }

  $emDirector = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/emergency-actions" -Headers $dirHeaders -Label "DirEmergency"
  $emManager = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/emergency-actions" -Headers $manHeaders -Label "ManEmergency"
  $emEmployee = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/emergency-actions" -Headers $empHeaders -Label "EmpEmergency"
  if ($emDirector.statusCode -eq 200) { Write-Pass "Director allowed on emergency-actions" } else { Write-Fail "Director should be allowed on emergency-actions" }
  if ($emManager.statusCode -eq 200) { Write-Pass "Manager allowed on emergency-actions" } else { Write-Fail "Manager should be allowed on emergency-actions" }
  if ($emEmployee.statusCode -in @(401, 403)) { Write-Pass "Employee blocked on emergency-actions" } else { Write-Fail "Employee should be blocked on emergency-actions" }

  $alertsDirector = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ads-alerts" -Headers $dirHeaders -Label "DirAdsAlerts"
  $alertsManager = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ads-alerts" -Headers $manHeaders -Label "ManAdsAlerts"
  $alertsEmployee = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ads-alerts" -Headers $empHeaders -Label "EmpAdsAlerts"
  if ($alertsDirector.statusCode -eq 200) { Write-Pass "Director allowed on ads-alerts" } else { Write-Fail "Director should be allowed on ads-alerts" }
  if ($alertsManager.statusCode -eq 200) { Write-Pass "Manager allowed on ads-alerts" } else { Write-Fail "Manager should be allowed on ads-alerts" }
  if ($alertsEmployee.statusCode -in @(401, 403)) { Write-Pass "Employee blocked on ads-alerts" } else { Write-Fail "Employee should be blocked on ads-alerts" }

  [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/ads-alerts" -Headers $dirHeaders -Label "ClearAlerts")
  Write-Info "Cleared existing ads-alerts state for deterministic verification"

  Write-Section "PHASE 2: Fixture setup"
  $fanpage = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/fanpages" -Headers $dirHeaders -Body @{
    pageId = "oss-page-$tsDigits"
    name = "Order Sheet Sync Fanpage $ts"
    accessToken = "EAAtoken-oss-$tsDigits"
    status = "active"
  } -Label "CreateFanpage"
  if (-not ($fanpage.success -and $fanpage.data._id)) { Write-Fail "Fanpage create failed"; throw "fanpage" }
  $fanpageId = [string]$fanpage.data._id
  $tempFanpageIds.Add($fanpageId)
  Write-Pass "Fanpage created"

  $category = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/product-category" -Headers $dirHeaders -Body @{
    name = "Order Sheet Sync Category $ts"
    description = "Temporary category for module.order-sheet-sync-ops"
    isActive = $true
  } -Label "CreateCategory"
  if (-not ($category.success -and $category.data._id)) { Write-Fail "Category create failed"; throw "category" }
  $tempProductCategoryId = [string]$category.data._id
  Write-Pass "Category created"

  $product = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/products" -Headers $dirHeaders -Body @{
    name = "Order Sheet Sync Product $ts"
    categoryId = $tempProductCategoryId
    importPrice = 10000
  } -Label "CreateProduct"
  if (-not ($product.success -and $product.data._id)) { Write-Fail "Product create failed"; throw "product" }
  $tempProductId = [string]$product.data._id
  Write-Pass "Product created"

  $agentGoodLink = "https://docs.google.com/spreadsheets/d/ossagent$tsDigits/edit"
  $supplierGoodLink = "https://docs.google.com/spreadsheets/d/osssupplier$tsDigits/edit"
  $agentGood = New-TempUser -Headers $dirHeaders -Role "internal_agent" -Prefix "oss-agent-good" -GoogleDriveLink $agentGoodLink
  $agentBad = New-TempUser -Headers $dirHeaders -Role "internal_agent" -Prefix "oss-agent-bad" -GoogleDriveLink "bad-agent-link"
  $supplierGood = New-TempUser -Headers $dirHeaders -Role "internal_supplier" -Prefix "oss-supplier-good" -GoogleDriveLink $supplierGoodLink
  $supplierBad = New-TempUser -Headers $dirHeaders -Role "internal_supplier" -Prefix "oss-supplier-bad" -GoogleDriveLink "bad-supplier-link"
  foreach ($fixture in @(
    @{ Label = "agent good"; Response = $agentGood },
    @{ Label = "agent bad"; Response = $agentBad },
    @{ Label = "supplier good"; Response = $supplierGood },
    @{ Label = "supplier bad"; Response = $supplierBad }
  )) {
    if (-not ($fixture.Response.success -and $fixture.Response.data._id)) {
      Write-Fail "Fixture user create failed: $($fixture.Label)"
      throw "fixture-user"
    }
    $tempUserIds.Add([string]$fixture.Response.data._id)
    Write-Pass "Fixture user created: $($fixture.Label)"
  }
  $agentGoodId = [string]$agentGood.data._id
  $agentBadId = [string]$agentBad.data._id
  $supplierGoodId = [string]$supplierGood.data._id
  $supplierBadId = [string]$supplierBad.data._id

  $adAccountExternalId = "1$tsDigits"
  $adAccount = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/ad-accounts" -Headers $dirHeaders -Body @{
    name = "Order Sheet Sync Ad Account $ts"
    accountId = $adAccountExternalId
    accountType = "facebook"
    isActive = $true
  } -Label "CreateAdAccount"
  if (-not ($adAccount.success -and $adAccount.data._id)) { Write-Fail "Ad account create failed"; throw "ad-account" }
  $adAccountId = [string]$adAccount.data._id
  $tempAdAccountIds.Add($adAccountId)
  Write-Pass "Ad account created"

  $adGroupExternalId = "oss-ag-$tsDigits"
  $adGroup = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/ad-groups" -Headers $dirHeaders -Body @{
    name = "Order Sheet Sync AdGroup $ts"
    adGroupId = $adGroupExternalId
    fanpageId = $fanpageId
    productCategoryId = $tempProductCategoryId
    selectedProducts = @($tempProductId)
    agentId = $agentGoodId
    adAccountId = $adAccountId
    platform = "facebook"
    isActive = $true
  } -Label "CreateAdGroup"
  if (-not ($adGroup.success -and $adGroup.data._id)) { Write-Fail "Ad group create failed"; throw "ad-group" }
  $adGroupId = [string]$adGroup.data._id
  $tempAdGroupIds.Add($adGroupId)
  Write-Pass "Ad group created"

  foreach ($orderBody in @(
    @{
      customerName = "OSS Agent Customer $ts"
      quantity = 1
      agentId = $agentGoodId
      adGroupId = $adGroupExternalId
      productId = $tempProductId
      orderDate = (Get-Date).ToString('yyyy-MM-dd')
      codAmount = 300000
      supplierAppliedPrice = 100000
      supplierQuote = 100000
      shippingFee = 30000
      orderStatus = "Delivered"
    },
    @{
      customerName = "OSS Supplier Customer $ts"
      quantity = 1
      supplierId = $supplierGoodId
      adGroupId = $adGroupExternalId
      productId = $tempProductId
      orderDate = (Get-Date).ToString('yyyy-MM-dd')
      codAmount = 280000
      supplierAppliedPrice = 90000
      supplierQuote = 90000
      shippingFee = 25000
      orderStatus = "Delivered"
    }
  )) {
    $order = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/test-order2" -Headers $dirHeaders -Body $orderBody -Label "CreateOrder"
    if ($order.success -and $order.data._id) {
      $tempOrderIds.Add([string]$order.data._id)
    } else {
      Write-Fail "Order create failed"
      throw "order"
    }
  }
  Write-Pass "Fixture orders created"

  Write-Section "PHASE 3: order-sheet-sync contracts"
  $status = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/order-sheet-sync/status" -Headers $dirHeaders -Label "OrderSheetStatus"
  if ($status.success -and $status.statusCode -eq 200 -and $null -ne $status.data.enabled) {
    Write-Pass "Status endpoint returned payload"
  } else {
    Write-Fail "Status endpoint failed"
  }

  $agentsSuppliers = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/order-sheet-sync/agents-suppliers" -Headers $dirHeaders -Label "AgentsSuppliers"
  if (-not ($agentsSuppliers.success -and $agentsSuppliers.statusCode -eq 200 -and $agentsSuppliers.data)) {
    Write-Fail "agents-suppliers endpoint failed"
    throw "agents-suppliers"
  }
  Write-Pass "agents-suppliers endpoint returned payload"
  $listedAgent = @($agentsSuppliers.data.agents | Where-Object { $_._id -eq $agentGoodId }) | Select-Object -First 1
  $listedSupplier = @($agentsSuppliers.data.suppliers | Where-Object { $_._id -eq $supplierGoodId }) | Select-Object -First 1
  if ($listedAgent -and $listedAgent.googleDriveLink -eq $agentGoodLink -and [int]$listedAgent.orderCount -ge 1) {
    Write-Pass "agents-suppliers includes linked agent fixture with order count"
  } else {
    Write-Fail "agents-suppliers should include linked agent fixture with order count"
  }
  if ($listedSupplier -and $listedSupplier.googleDriveLink -eq $supplierGoodLink -and [int]$listedSupplier.orderCount -ge 1) {
    Write-Pass "agents-suppliers includes linked supplier fixture with order count"
  } else {
    Write-Fail "agents-suppliers should include linked supplier fixture with order count"
  }

  Write-Step "3.1" "Credential validation negative cases"
  $badJson = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/credentials" -Headers $dirHeaders -Body '{"credentialsJson":' -Label "MalformedCredentialsJson"
  if ($badJson.statusCode -in @(400, 422)) { Write-Pass "Malformed JSON rejected for credentials" } else { Write-Fail "Malformed JSON should be rejected for credentials" }

  $missingCredentials = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/credentials" -Headers $dirHeaders -Body @{} -Label "MissingCredentialsField"
  if ($missingCredentials.statusCode -in @(200, 201) -and $missingCredentials.data -and $missingCredentials.data.success -eq $false) {
    Write-Pass "Missing credentialsJson returns handled failure payload"
  } else {
    Write-Fail "Missing credentialsJson should return handled failure payload"
  }

  $badTestJson = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/test-credentials" -Headers $dirHeaders -Body '{"credentialsJson":' -Label "MalformedTestCredentialsJson"
  if ($badTestJson.statusCode -in @(400, 422)) { Write-Pass "Malformed JSON rejected for test-credentials" } else { Write-Fail "Malformed JSON should be rejected for test-credentials" }

  $missingTestCredentials = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/test-credentials" -Headers $dirHeaders -Body @{} -Label "MissingTestCredentialsField"
  if ($missingTestCredentials.statusCode -in @(200, 201) -and $missingTestCredentials.data -and $missingTestCredentials.data.success -eq $false) {
    Write-Pass "Missing test credentialsJson returns handled failure payload"
  } else {
    Write-Fail "Missing test credentialsJson should return handled failure payload"
  }

  Write-Step "3.2" "Single sync negative path for invalid link"
  $badAgentSync = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/agent/$agentBadId" -Headers $dirHeaders -Body @{} -Label "BadAgentSync"
  if ($badAgentSync.statusCode -in @(200, 201) -and $badAgentSync.data -and $badAgentSync.data.success -eq $false -and $badAgentSync.data.message -like '*Invalid Google Drive link*') {
    Write-Pass "Invalid agent link returned failure payload"
  } else {
    Write-Fail "Invalid agent link should fail gracefully"
  }

  $badSupplierSync = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/supplier/$supplierBadId" -Headers $dirHeaders -Body @{} -Label "BadSupplierSync"
  if ($badSupplierSync.statusCode -in @(200, 201) -and $badSupplierSync.data -and $badSupplierSync.data.success -eq $false -and $badSupplierSync.data.message -like '*Invalid Google Drive link*') {
    Write-Pass "Invalid supplier link returned failure payload"
  } else {
    Write-Fail "Invalid supplier link should fail gracefully"
  }

  Write-Step "3.3" "Sync-all counters treat failed sync as failed"
  $syncAllAgents = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/agents/all" -Headers $dirHeaders -Body @{} -Label "SyncAllAgents"
  if (-not ($syncAllAgents.success -and $syncAllAgents.statusCode -in @(200, 201) -and $syncAllAgents.data)) {
    Write-Fail "sync-all agents request failed"
    throw "sync-all-agents"
  }
  Write-Pass "sync-all agents returned payload"
  if ([int]$syncAllAgents.data.total -eq 2 -and [int]$syncAllAgents.data.failed -ge 1 -and ([int]$syncAllAgents.data.success + [int]$syncAllAgents.data.failed) -eq [int]$syncAllAgents.data.total) {
    Write-Pass "sync-all agents counted failed items correctly"
  } else {
    Write-Fail "sync-all agents should reconcile success/failed counters against total"
  }
  if (@($syncAllAgents.data.errors).Count -ge [int]$syncAllAgents.data.failed) {
    Write-Pass "sync-all agents emitted traceable errors for failed items"
  } else {
    Write-Fail "sync-all agents should emit traceable errors for failed items"
  }

  $syncAllSuppliers = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/order-sheet-sync/suppliers/all" -Headers $dirHeaders -Body @{} -Label "SyncAllSuppliers"
  if (-not ($syncAllSuppliers.success -and $syncAllSuppliers.statusCode -in @(200, 201) -and $syncAllSuppliers.data)) {
    Write-Fail "sync-all suppliers request failed"
    throw "sync-all-suppliers"
  }
  Write-Pass "sync-all suppliers returned payload"
  if ([int]$syncAllSuppliers.data.total -eq 2 -and [int]$syncAllSuppliers.data.failed -ge 1 -and ([int]$syncAllSuppliers.data.success + [int]$syncAllSuppliers.data.failed) -eq [int]$syncAllSuppliers.data.total) {
    Write-Pass "sync-all suppliers counted failed items correctly"
  } else {
    Write-Fail "sync-all suppliers should reconcile success/failed counters against total"
  }

  Write-Section "PHASE 4: emergency-actions + ops"
  $dateKey = (Get-VietnamNow).ToString('yyyy-MM-dd')
  $taskExisting = "oss-existing-$tsDigits"
  $taskUpdated = "oss-updated-$tsDigits"
  $taskRemoved = "oss-removed-$tsDigits"
  $taskReset = "oss-reset-$tsDigits"
  $taskNew = "oss-new-$tsDigits"
  $seedTasks = @(
    @{ taskId = $taskExisting; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Existing task"; reason = "seed"; deadline = "Truoc 10:00" },
    @{ taskId = $taskUpdated; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Old task"; reason = "seed"; deadline = "Truoc 10:00" },
    @{ taskId = $taskRemoved; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Removed task"; reason = "seed"; deadline = "Truoc 10:00" },
    @{ taskId = $taskReset; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Reset task"; reason = "seed"; deadline = "Truoc 10:00" }
  )
  $seed = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/emergency-actions/bulk-sync" -Headers $dirHeaders -Body @{ date = $dateKey; tasks = $seedTasks } -Label "EmergencySeed"
  if ($seed.statusCode -in @(200, 201) -and $seed.data.success -eq $true) { Write-Pass "Emergency seed bulk-sync succeeded" } else { Write-Fail "Emergency seed bulk-sync failed" }

  $toggleReset = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/emergency-actions/$taskReset/toggle?date=$dateKey" -Headers $dirHeaders -Body @{} -Label "ToggleResetTask"
  if ($toggleReset.statusCode -eq 200 -and $toggleReset.data.task.done -eq $true) { Write-Pass "Seed task toggled done for reset coverage" } else { Write-Fail "Could not toggle seed task for reset coverage" }

  $diff = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/emergency-actions/bulk-sync" -Headers $dirHeaders -Body @{
    date = $dateKey
    tasks = @(
      @{ taskId = $taskExisting; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Existing task"; reason = "seed"; deadline = "Truoc 10:00" },
      @{ taskId = $taskUpdated; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Updated task"; reason = "updated"; deadline = "Truoc 11:00" },
      @{ taskId = $taskReset; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Reset task"; reason = "reset"; deadline = "Truoc 11:00" },
      @{ taskId = $taskNew; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "New task"; reason = "new"; deadline = "Truoc 12:00" }
    )
  } -Label "EmergencyDiff"
  if (-not ($diff.statusCode -in @(200, 201) -and $diff.data.success -eq $true)) {
    Write-Fail "Emergency diff bulk-sync failed"
    throw "emergency-diff"
  }
  Write-Pass "Emergency diff bulk-sync succeeded"
  if ([int]$diff.data.existing -eq 1) { Write-Pass "existing semantics preserved" } else { Write-Fail "existing semantics should equal 1" }
  if ([int]$diff.data.updated -eq 2) { Write-Pass "updated semantics detected for changed tasks" } else { Write-Fail "updated semantics should equal 2" }
  if ([int]$diff.data.removed -eq 1) { Write-Pass "removed semantics detected" } else { Write-Fail "removed semantics should equal 1" }
  if ([int]$diff.data.reset -eq 1) { Write-Pass "reset semantics detected" } else { Write-Fail "reset semantics should equal 1" }
  if ([int]$diff.data.upserted -eq 1) { Write-Pass "upserted semantics detected" } else { Write-Fail "upserted semantics should equal 1" }

  $opsSuggestions = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ops-actions/suggestions" -Headers $dirHeaders -Label "OpsSuggestions"
  if ($opsSuggestions.statusCode -eq 200 -and $opsSuggestions.data -and $null -ne $opsSuggestions.data.totalCount) {
    Write-Pass "ops-actions suggestions returned aggregation payload"
  } else {
    Write-Fail "ops-actions suggestions should return aggregation payload"
  }

  $vietnamNow = Get-VietnamNow
  $currentHour = [int]$vietnamNow.Hour
  $pastHour = if ($currentHour -gt 0) { $currentHour - 1 } else { 0 }
  $futureHour = if ($currentHour -lt 22) { $currentHour + 1 } else { 23 }
  $overdueTaskId = "oss-overdue-$tsDigits"
  $futureTaskId = "oss-future-$tsDigits"
  $boundarySeed = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/emergency-actions/bulk-sync" -Headers $dirHeaders -Body @{
    date = $dateKey
    tasks = @(
      @{ taskId = $overdueTaskId; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Overdue task"; reason = "boundary"; deadline = ("Truoc {0:00}:00" -f $pastHour) },
      @{ taskId = $futureTaskId; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Future task"; reason = "boundary"; deadline = ("Truoc {0:00}:00" -f $futureHour) }
    )
  } -Label "BoundarySeed"
  if ($boundarySeed.statusCode -in @(200, 201) -and $boundarySeed.data.success -eq $true) { Write-Pass "Boundary task seed succeeded" } else { Write-Fail "Boundary task seed failed" }

  $overdue = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/emergency-actions/overdue?date=$dateKey" -Headers $dirHeaders -Label "EmergencyOverdue"
  if (-not ($overdue.statusCode -eq 200 -and $overdue.data)) {
    Write-Fail "Overdue query failed"
    throw "overdue-query"
  }
  Write-Pass "Overdue query returned payload"
  $overdueIds = @($overdue.data.tasks | ForEach-Object { $_.taskId })
  if ($currentHour -gt 0) {
    if ($overdueIds -contains $overdueTaskId) { Write-Pass "Past-hour task is overdue in Vietnam time" } else { Write-Fail "Past-hour task should be overdue in Vietnam time" }
  } else {
    Write-Info "Skipping positive overdue assertion at Vietnam hour 00 because service compares hour-only boundaries"
  }
  if ($overdueIds -notcontains $futureTaskId) { Write-Pass "Future-hour task is not overdue" } else { Write-Fail "Future-hour task should not be overdue" }

  Write-Step "4.1" "Verification-failed alert path"
  $fakeToken = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/api-tokens" -Headers $dirHeaders -Body @{
    name = "Fake Facebook Token $ts"
    token = "EAAfake-$tsDigits"
    provider = "facebook"
    fanpageId = $fanpageId
    status = "active"
  } -Label "CreateFakeToken"
  if (-not ($fakeToken.success -and $fakeToken.data._id)) { Write-Fail "Fake Facebook token create failed"; throw "fake-token" }
  $fakeTokenId = [string]$fakeToken.data._id
  $tempTokenIds.Add($fakeTokenId)
  Write-Pass "Fake Facebook token created"

  if (-not (Set-ApiTokenAdsManagementFixture -TokenId $fakeTokenId -AdAccountId ("act_{0}" -f $adAccountExternalId))) {
    throw "fake-token-seed"
  }

  $verifyTaskId = "oss-verify-$tsDigits"
  $verifySeed = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/emergency-actions/bulk-sync" -Headers $dirHeaders -Body @{
    date = $dateKey
    tasks = @(
      @{ taskId = $verifyTaskId; taskType = "change-budget"; priority = "high"; platform = "facebook"; adGroupId = $adGroupExternalId; adGroupName = "OSS AG $ts"; actionText = "Verify failure task"; reason = "verify"; deadline = "Truoc 23:00"; targetSpend = 999999 }
    )
  } -Label "VerifySeed"
  if ($verifySeed.statusCode -in @(200, 201) -and $verifySeed.data.success -eq $true) { Write-Pass "Verification seed task created" } else { Write-Fail "Verification seed task failed" }

  $toggleVerify = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/emergency-actions/$verifyTaskId/toggle?date=$dateKey" -Headers $dirHeaders -Body @{} -Label "ToggleVerifyTask"
  if ($toggleVerify.statusCode -eq 200 -and $toggleVerify.data.task.done -eq $true) { Write-Pass "Verification task toggled done" } else { Write-Fail "Verification task toggle failed" }

  Start-Sleep -Seconds 2
  $taskListAfterVerify = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/emergency-actions?date=$dateKey" -Headers $dirHeaders -Label "EmergencyAfterVerify"
  $verifyTask = @($taskListAfterVerify.data.tasks | Where-Object { $_.taskId -eq $verifyTaskId }) | Select-Object -First 1
  if ($verifyTask -and $verifyTask.verificationStatus -eq 'failed') {
    Write-Pass "Verification task moved to failed status"
  } else {
    Write-Fail "Verification task should move to failed status"
  }

  $alertsAfterVerify = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/ads-alerts?type=WARNING&category=BUDGET" -Headers $dirHeaders -Label "AdsAlertsAfterVerify"
  if (-not ($alertsAfterVerify.statusCode -eq 200 -and $alertsAfterVerify.data)) {
    Write-Fail "ads-alerts lookup after verification failed"
    throw "ads-alerts-after-verify"
  }
  $verifyAlert = @($alertsAfterVerify.data.alerts | Where-Object { $_.adGroupId -eq $adGroupExternalId -and $_.title -like 'Xac minh that bai*' }) | Select-Object -First 1
  if ($verifyAlert) {
    Write-Pass "Verification-failed alert observed"
  } else {
    Write-Fail "Expected verification-failed alert not found"
  }
}
catch {
  Write-Fail "Suite aborted: $($_.Exception.Message)"
}
finally {
  Write-Section "PHASE 5: Cleanup"
  foreach ($id in @($tempOrderIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/test-order2/$id" -Headers $dirHeaders -Label "DeleteOrder") }
  }
  foreach ($id in @($tempTokenIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/api-tokens/$id" -Headers $dirHeaders -Label "DeleteToken") }
  }
  foreach ($id in @($tempAdGroupIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/ad-groups/$id" -Headers $dirHeaders -Label "DeleteAdGroup") }
  }
  foreach ($id in @($tempAdAccountIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/ad-accounts/$id" -Headers $dirHeaders -Label "DeleteAdAccount") }
  }
  foreach ($id in @($tempFanpageIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/fanpages/$id" -Headers $dirHeaders -Label "DeleteFanpage") }
  }
  foreach ($id in @($tempUserIds)) {
    if ($id) { [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/users/$id" -Headers $dirHeaders -Label "DeleteUser") }
  }
  if ($tempProductId) {
    [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/products/$tempProductId" -Headers $dirHeaders -Label "DeleteProduct")
  }
  if ($tempProductCategoryId) {
    [void](Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/product-category/$tempProductCategoryId" -Headers $dirHeaders -Label "DeleteCategory")
  }
}

Write-Section "SUMMARY"
Write-Host "PASS: $($script:passCount)" -ForegroundColor Green
Write-Host "FAIL: $($script:failCount)" -ForegroundColor $(if ($script:failCount -eq 0) { "Green" } else { "Red" })
if ($script:failDetails.Count -gt 0) {
  Write-Host ""
  Write-Host "Failures:" -ForegroundColor Red
  foreach ($fd in $script:failDetails) {
    Write-Host "  - $fd" -ForegroundColor Red
  }
}

exit $script:failCount
