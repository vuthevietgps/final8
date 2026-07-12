#!/usr/bin/env pwsh
<#
    =====================================================================================
    MODULE.USER-IMPORT-EXPORT.PS1
    =====================================================================================
    Covers BE-MASTER-04/05/06 at a practical automated level:
    1. User selector endpoints for ads/orders
    2. Export users stats / preview / CSV
    3. CSV injection defense on export
    4. Import users template / instructions / validate / csv
    5. Negative import cases and overwrite-by-email
    6. Auth boundary checks for unauthenticated access
    =====================================================================================
#>
$ErrorActionPreference = "Continue"

function Get-BackendBaseUrl {
    $override = [string]$env:BACKEND_BASE_URL
    if (-not [string]::IsNullOrWhiteSpace($override)) {
        return $override.TrimEnd('/')
    }

    $candidates = @(
        "http://localhost:3000/api",
        "http://localhost:3000"
    )
    foreach ($candidate in $candidates) {
        try {
            $resp = Invoke-WebRequest -Uri "$candidate/users" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -in 200, 401, 403) {
                return $candidate.TrimEnd('/')
            }
        } catch {
            $status = 0
            try { $status = $_.Exception.Response.StatusCode.value__ } catch { }
            if ($status -in 200, 401, 403) {
                return $candidate.TrimEnd('/')
            }
        }
    }

    return "http://localhost:3000"
}

$BaseUrl = Get-BackendBaseUrl
$null = Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
$testsRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$setupScript = Join-Path $testsRoot 'setup\ensure-regression-users.ps1'

if (Test-Path $setupScript) {
    $previousBaseUrl = $env:BACKEND_BASE_URL
    $env:BACKEND_BASE_URL = $BaseUrl
    try {
        & powershell -ExecutionPolicy Bypass -File $setupScript
        if ($LASTEXITCODE -ne 0) {
            throw "Regression setup exited with code $LASTEXITCODE"
        }
    } finally {
        if ($null -ne $previousBaseUrl -and $previousBaseUrl -ne '') {
            $env:BACKEND_BASE_URL = $previousBaseUrl
        } else {
            Remove-Item Env:BACKEND_BASE_URL -ErrorAction SilentlyContinue
        }
    }
}

function Write-Section($title) {
    Write-Host ""
    Write-Host ("=" * 90) -ForegroundColor Cyan
    Write-Host "  $title" -ForegroundColor Cyan
    Write-Host ("=" * 90) -ForegroundColor Cyan
}

function Write-Step($step, $desc) {
    Write-Host ""
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

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$Label = ""
    )

    try {
        $params = @{
            Method      = $Method
            Uri         = $Uri
            Headers     = $Headers
            ContentType = "application/json; charset=utf-8"
            ErrorAction = "Stop"
        }
        if ($null -ne $Body -and $Method -ne "GET") {
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }
        $data = Invoke-RestMethod @params
        return @{ success = $true; statusCode = 200; data = $data }
    } catch {
        $st = 0
        try { $st = $_.Exception.Response.StatusCode.value__ } catch { }
        $eb = ""
        try { $eb = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $eb" -ForegroundColor Red
        return @{ success = $false; statusCode = $st; body = $eb }
    }
}

function Invoke-RawRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$ContentType = $null,
        [string]$Label = ""
    )

    try {
        $params = @{
            Method      = $Method
            Uri         = $Uri
            Headers     = $Headers
            ErrorAction = "Stop"
        }
        if ($ContentType) {
            $params["ContentType"] = $ContentType
        }
        if ($null -ne $Body -and $Method -ne "GET") {
            $params["Body"] = [System.Text.Encoding]::UTF8.GetBytes($Body)
        }
        $resp = Invoke-WebRequest @params
        return @{
            success    = $true
            statusCode = [int]$resp.StatusCode
            body       = $resp.Content
            headers    = $resp.Headers
        }
    } catch {
        $st = 0
        $body = ""
        try { $st = $_.Exception.Response.StatusCode.value__ } catch { }
        try { $body = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd() } catch { }
        Write-Host "  [ERROR] $Label - HTTP $st : $body" -ForegroundColor Red
        return @{ success = $false; statusCode = $st; body = $body; headers = @{} }
    }
}

function Invoke-MultipartRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$FilePath,
        [string]$FileName,
        [string]$FileContentType = "text/csv",
        [string]$Label = ""
    )

    $responsePath = New-TempCsvFile -Name ("curl-response-" + [guid]::NewGuid().ToString('N') + ".txt") -Content ""
    $args = @(
        "-sS",
        "-o", $responsePath,
        "-w", "HTTP_STATUS:%{http_code}",
        "-X", $Method
    )
    foreach ($entry in $Headers.GetEnumerator()) {
        $args += @("-H", ("{0}: {1}" -f [string]$entry.Key, [string]$entry.Value))
    }
    $args += @("-F", ("file=@{0};type={1}" -f $FilePath, $FileContentType))
    $args += $Uri

    $output = & curl.exe @args
    $body = if (Test-Path -LiteralPath $responsePath) { Get-Content -LiteralPath $responsePath -Raw } else { "" }
    $statusCode = 0
    if ($output -match 'HTTP_STATUS:(\d{3})') {
        $statusCode = [int]$Matches[1]
    }

    return @{
        success    = ($statusCode -ge 200 -and $statusCode -lt 300)
        statusCode = $statusCode
        body       = $body
        headers    = @{}
    }
}

function Get-UserArray {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [array]) { return @($Value) }
    if ($Value.PSObject.Properties.Name -contains 'data') {
        $data = $Value.data
        if ($data -is [array]) { return @($data) }
        if ($null -ne $data) { return @($data) }
    }
    return @($Value)
}

function New-TempCsvFile {
    param(
        [string]$Name,
        [string]$Content
    )

    $dir = Join-Path ([System.IO.Path]::GetTempPath()) "user-import-export-$ts"
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    $path = Join-Path $dir $Name
    [System.IO.File]::WriteAllText($path, $Content, [System.Text.UTF8Encoding]::new($false))
    $script:cleanupPaths += $path
    return $path
}

function ConvertTo-RoleMap {
    param($Users)
    $map = @{}
    foreach ($u in $Users) {
        $role = [string]$u.role
        if (-not $map.ContainsKey($role)) {
            $map[$role] = 0
        }
        $map[$role]++
    }
    return $map
}

function Get-CellLineForEmail {
    param(
        [string]$CsvContent,
        [string]$Email
    )

    $clean = $CsvContent.TrimStart([char]0xFEFF)
    $lines = $clean -split "`r?`n"
    return ($lines | Where-Object { $_ -match [regex]::Escape($Email) } | Select-Object -First 1)
}

function Escape-CsvField {
    param([object]$Value)

    $text = [string]$Value
    if ($null -eq $Value) {
        $text = ""
    }

    $text = $text -replace '"', '""'
    if ($text -match '[,"\r\n]') {
        return '"' + $text + '"'
    }

    return $text
}

function Join-CsvRow {
    param([object[]]$Values)

    return (($Values | ForEach-Object { Escape-CsvField $_ }) -join ',')
}

function New-UserImportCsv {
    param(
        [string]$HeaderRow,
        [object[][]]$Rows
    )

    $content = New-Object System.Collections.Generic.List[string]
    $content.Add($HeaderRow) | Out-Null
    foreach ($row in $Rows) {
        $content.Add((Join-CsvRow -Values $row)) | Out-Null
    }

    return ($content -join "`n")
}

function ConvertFrom-ResponseJson {
    param([string]$Body)

    if ($null -eq $Body) {
        return $null
    }

    $clean = ([string]$Body).TrimStart([char]0xFEFF).Trim()
    if (-not $clean) {
        return $null
    }

    try {
        return $clean | ConvertFrom-Json
    } catch {
        return $null
    }
}

$script:passCount = 0
$script:failCount = 0
$script:failDetails = @()
$script:cleanupPaths = @()
$ts = Get-Date -Format "yyyyMMdd-HHmmss"

$tempAgentEmail = "user-import-export.agent.$ts@test.com"
$tempSupplierEmail = "user-import-export.supplier.$ts@test.com"
$tempImportedEmail = "user-import-export.imported.$ts@test.com"
$managerFormulaName = "=QA Formula $ts"
$managerFormulaNote = "=1+1"
$managerEmail = "manager@test.com"
$managerWasCreated = $false
$canonicalImportHeader = "full_name,email,password,phone,role,address,is_active,department_id,manager_id,notes,googleDriveLink"

Write-Section "MODULE TEST: USER IMPORT / EXPORT - $ts"
Write-Info "Base URL: $BaseUrl"

# ===== PHASE 0: LOGIN & FIXTURE SETUP =====
Write-Section "PHASE 0: Login & Setup"
Write-Step "0.1" "Login director"
$login = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/auth/login" -Headers @{} -Body '{"email":"director@test.com","password":"123456"}' -Label "DirectorLogin"
if ($login.success -and $login.data.access_token) {
    $directorToken = [string]$login.data.access_token
    $h = @{ Authorization = "Bearer $directorToken" }
    Write-Pass "Director login OK"
} else {
    Write-Fail "Director login failed"
    exit 1
}

Write-Step "0.2" "Load manager fixture for overwrite-by-email"
$manager = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/email/$([uri]::EscapeDataString($managerEmail))" -Headers $h -Label "GetManager"
if (-not $manager.success -or -not $manager.data) {
    Write-Info "Baseline manager not found, creating fallback manager fixture"
    $fallbackBody = @{
        fullName = "QA Manager $ts"
        email = "user-import-export.manager.$ts@test.com"
        password = "123456"
        phone = "09111111$($ts.Substring($ts.Length - 4))"
        role = "manager"
        isActive = $true
    } | ConvertTo-Json
    $manager = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $fallbackBody -Label "CreateFallbackManager"
    if ($manager.success -and $manager.data -and ($manager.data._id -or $manager.data.id)) {
        $managerWasCreated = $true
        $managerEmail = [string]$manager.data.email
        Write-Pass "Fallback manager created: $managerEmail"
    } else {
        Write-Fail "Unable to load or create manager fixture"
        exit 1
    }
}

$managerDoc = $manager.data
$managerId = if ($managerDoc._id) { [string]$managerDoc._id } elseif ($managerDoc.id) { [string]$managerDoc.id } else { $null }
$managerOriginal = @{
    fullName = [string]$managerDoc.fullName
    phone    = [string]$managerDoc.phone
    address  = [string]$managerDoc.address
    notes    = [string]$managerDoc.notes
    isActive = if ($null -ne $managerDoc.isActive) { [bool]$managerDoc.isActive } else { $true }
}
Write-Pass "Manager fixture ready: $managerEmail"

Write-Step "0.3" "Create selector fixtures"
$agentBody = @{
    fullName = "QA Agent $ts"
    email = $tempAgentEmail
    password = "123456"
    phone = "092000$($ts.Substring($ts.Length - 4))"
    role = "internal_agent"
    isActive = $false
} | ConvertTo-Json
$supplierBody = @{
    fullName = "QA Supplier $ts"
    email = $tempSupplierEmail
    password = "123456"
    phone = "093000$($ts.Substring($ts.Length - 4))"
    role = "internal_supplier"
    isActive = $false
} | ConvertTo-Json

$agentCreate = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $agentBody -Label "CreateTempAgent"
if ($agentCreate.success -and ($agentCreate.data._id -or $agentCreate.data.id)) {
    $tempAgentId = if ($agentCreate.data._id) { [string]$agentCreate.data._id } else { [string]$agentCreate.data.id }
    Write-Pass "Temp agent created: $tempAgentEmail"
} else {
    Write-Fail "Temp agent creation failed"
}

$supplierCreate = Invoke-JsonRequest -Method POST -Uri "$BaseUrl/users" -Headers $h -Body $supplierBody -Label "CreateTempSupplier"
if ($supplierCreate.success -and ($supplierCreate.data._id -or $supplierCreate.data.id)) {
    $tempSupplierId = if ($supplierCreate.data._id) { [string]$supplierCreate.data._id } else { [string]$supplierCreate.data.id }
    Write-Pass "Temp supplier created: $tempSupplierEmail"
} else {
    Write-Fail "Temp supplier creation failed"
}

# ===== PHASE 1: AUTH BOUNDARY =====
Write-Section "PHASE 1: Auth Boundary"
Write-Step "1.1" "Unauthenticated selector access is blocked"
$unauthUsers = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/agents" -Headers @{} -Label "NoAuthAgents"
if (-not $unauthUsers.success -and ($unauthUsers.statusCode -eq 401 -or $unauthUsers.statusCode -eq 403)) {
    Write-Pass "GET /users/agents blocked without auth ($($unauthUsers.statusCode))"
} else {
    Write-Fail "GET /users/agents should be blocked without auth"
}

Write-Step "1.2" "Unauthenticated export access is blocked"
$unauthExport = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/export-users/stats" -Headers @{} -Label "NoAuthExportStats"
if (-not $unauthExport.success -and ($unauthExport.statusCode -eq 401 -or $unauthExport.statusCode -eq 403)) {
    Write-Pass "GET /export-users/stats blocked without auth ($($unauthExport.statusCode))"
} else {
    Write-Fail "GET /export-users/stats should be blocked without auth"
}

Write-Step "1.3" "Unauthenticated import upload is blocked"
$authBoundaryFile = New-TempCsvFile -Name "auth-boundary.csv" -Content @"
HÃƒÂ¡Ã‚Â»Ã‚Â vÃƒÆ’Ã‚Â  TÃƒÆ’Ã‚Âªn,Email,MÃƒÂ¡Ã‚ÂºÃ‚Â­t khÃƒÂ¡Ã‚ÂºÃ‚Â©u,SÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ Ãƒâ€žÃ‚ÂiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n ThoÃƒÂ¡Ã‚ÂºÃ‚Â¡i,Vai TrÃƒÆ’Ã‚Â²
Auth Boundary,auth.boundary.$ts@test.com,123456,0900000000,employee
"@
$unauthImport = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/csv" -Headers @{} -FilePath $authBoundaryFile -FileName "auth-boundary.csv" -Label "NoAuthImport"
if (-not $unauthImport.success -and ($unauthImport.statusCode -eq 401 -or $unauthImport.statusCode -eq 403)) {
    Write-Pass "POST /import-users/csv blocked without auth ($($unauthImport.statusCode))"
} else {
    Write-Fail "POST /import-users/csv should be blocked without auth"
}

# ===== PHASE 2: USER SELECTORS =====
Write-Section "PHASE 2: User Selectors"
Write-Step "2.1" "Lookup temp supplier by email"
$supplierLookup = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/email/$([uri]::EscapeDataString($tempSupplierEmail))" -Headers $h -Label "SupplierByEmail"
if ($supplierLookup.success -and $supplierLookup.data.email -eq $tempSupplierEmail -and $supplierLookup.data.role -eq "internal_supplier") {
    Write-Pass "GET /users/email/:email returned the expected supplier fixture"
} else {
    Write-Fail "GET /users/email/:email failed for the temp supplier fixture"
}

Write-Step "2.2" "Orders agent selector with active=false includes temp inactive agent"
$agents = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/agents?active=false" -Headers $h -Label "AgentsSelectorInactive"
$agentsList = if ($agents.success) { Get-UserArray $agents.data } else { @() }
if ($agents.success -and (@($agentsList | Where-Object { $_.email -eq $tempAgentEmail }).Count -gt 0)) {
    Write-Pass "Temp inactive agent found in /users/agents?active=false"
} else {
    Write-Fail "Temp inactive agent missing from /users/agents?active=false"
}

Write-Step "2.3" "Orders agent selector with active=true excludes temp inactive agent"
$activeAgents = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/agents?active=true" -Headers $h -Label "AgentsSelectorActive"
$activeAgentsList = if ($activeAgents.success) { Get-UserArray $activeAgents.data } else { @() }
if ($activeAgents.success -and (@($activeAgentsList | Where-Object { $_.email -eq $tempAgentEmail }).Count -eq 0)) {
    Write-Pass "Temp inactive agent excluded from /users/agents?active=true"
} else {
    Write-Fail "Temp inactive agent should not appear in /users/agents?active=true"
}

Write-Step "2.4" "Agents for ads selector with active=false includes temp agent"
$agentsForAds = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/agents-for-ads?active=false" -Headers $h -Label "AgentsForAds"
$agentsForAdsList = if ($agentsForAds.success) { Get-UserArray $agentsForAds.data } else { @() }
if ($agentsForAds.success -and (@($agentsForAdsList | Where-Object { $_.email -eq $tempAgentEmail }).Count -gt 0)) {
    Write-Pass "Temp agent found in /users/agents-for-ads?active=false"
} else {
    Write-Fail "Temp agent missing from /users/agents-for-ads?active=false"
}

Write-Step "2.5" "Suppliers selector with q + minimal + active=false returns temp supplier without password"
$supplierQuery = [uri]::EscapeDataString("QA Supplier $ts")
$suppliersMinimal = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/suppliers?q=$supplierQuery&active=false&minimal=true" -Headers $h -Label "SuppliersMinimal"
$suppliersMinimalList = if ($suppliersMinimal.success) { Get-UserArray $suppliersMinimal.data } else { @() }
$tempSupplierMinimal = $suppliersMinimalList | Where-Object { $_.email -eq $tempSupplierEmail } | Select-Object -First 1
if ($suppliersMinimal.success -and $tempSupplierMinimal -and -not ($tempSupplierMinimal.PSObject.Properties.Name -contains 'password')) {
    Write-Pass "Minimal suppliers selector returned the temp supplier without password leakage"
} else {
    Write-Fail "Suppliers minimal selector failed to return the expected temp supplier"
}

Write-Step "2.6" "Suppliers for orders selector with active=false includes temp supplier"
$suppliersForOrders = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/suppliers-for-orders?active=false" -Headers $h -Label "SuppliersForOrders"
$suppliersForOrdersList = if ($suppliersForOrders.success) { Get-UserArray $suppliersForOrders.data } else { @() }
if ($suppliersForOrders.success -and (@($suppliersForOrdersList | Where-Object { $_.email -eq $tempSupplierEmail }).Count -gt 0)) {
    Write-Pass "Temp supplier found in /users/suppliers-for-orders?active=false"
} else {
    Write-Fail "Temp supplier missing from /users/suppliers-for-orders?active=false"
}

Write-Step "2.7" "Ads operators selector includes manager/director"
$adsOperators = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/ads-operators" -Headers $h -Label "AdsOperators"
$adsOperatorsList = if ($adsOperators.success) { Get-UserArray $adsOperators.data } else { @() }
if ($adsOperators.success -and (@($adsOperatorsList | Where-Object { $_.email -eq $managerEmail }).Count -gt 0)) {
    Write-Pass "Manager found in /users/ads-operators"
} else {
    Write-Fail "Manager missing from /users/ads-operators"
}

# ===== PHASE 3: EXPORT STATS / PREVIEW / CSV =====
Write-Section "PHASE 3: Export Stats / Preview / CSV"
Write-Step "3.1" "Export stats reflect current users"
$allUsers = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users" -Headers $h -Label "AllUsers"
$allUsersList = if ($allUsers.success) { Get-UserArray $allUsers.data } else { @() }
$expectedRoleCounts = ConvertTo-RoleMap -Users $allUsersList
$stats = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/export-users/stats" -Headers $h -Label "ExportStats"
if ($stats.success -and $stats.data.total -eq $allUsersList.Count) {
    $statsRoleMap = @{}
    if ($stats.data.byRole) {
        foreach ($prop in $stats.data.byRole.PSObject.Properties) {
            $statsRoleMap[$prop.Name] = [int]$prop.Value
        }
    }

    $roleMismatch = $false
    foreach ($role in $expectedRoleCounts.Keys) {
        $expected = [int]$expectedRoleCounts[$role]
        $actual = if ($statsRoleMap.ContainsKey($role)) { [int]$statsRoleMap[$role] } else { 0 }
        if ($expected -ne $actual) {
            $roleMismatch = $true
            Write-Fail "Role count mismatch for '$role': expected=$expected actual=$actual"
        }
    }

    if (-not $roleMismatch) {
        Write-Pass "Export stats total and role counts match current user set"
    }
} else {
    Write-Fail "Export stats mismatch: expected total $($allUsersList.Count), got $($stats.data.total)"
}

Write-Step "3.2" "Preview CSV for manager role"
$preview = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/export-users/preview?role=manager" -Headers $h -Label "PreviewManager"
if ($preview.success -and $preview.data.filters.role -eq "manager") {
    $headerCsv = ($preview.data.header -join ',').TrimStart([char]0xFEFF)
    $previewText = ($preview.data.preview | Out-String)
    if ($headerCsv -match 'STT' -and $headerCsv -match 'Email' -and $previewText -match [regex]::Escape($managerEmail)) {
        Write-Pass "Preview response includes manager data and expected headers"
    } else {
        Write-Fail "Preview response missing expected header or manager row"
    }
} else {
    Write-Fail "Preview endpoint failed for manager role"
}

Write-Step "3.3" "Seed manager row with formula payload before CSV export"
$managerFormulaBody = @{
    fullName = $managerFormulaName
    phone = $managerOriginal.phone
    address = $managerOriginal.address
    notes = $managerFormulaNote
    isActive = $managerOriginal.isActive
} | ConvertTo-Json
$managerFormulaUpdate = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/users/$managerId" -Headers $h -Body $managerFormulaBody -Label "PatchManagerFormula"
if ($managerFormulaUpdate.success -and $managerFormulaUpdate.data.fullName -eq $managerFormulaName) {
    Write-Pass "Manager updated with formula-like values for export hardening check"
} else {
    Write-Fail "Failed to seed manager formula payload before CSV export"
}

Write-Step "3.4" "CSV export for manager role neutralizes formula payload"
$managerExport = Invoke-RawRequest -Method GET -Uri "$BaseUrl/export-users/csv?role=manager" -Headers $h -Label "ExportManagerCsv"
if ($managerExport.success -and $managerExport.headers['Content-Disposition'] -match 'attachment; filename="users_.*\.csv"') {
    $csvContent = $managerExport.body.TrimStart([char]0xFEFF)
    $managerLine = Get-CellLineForEmail -CsvContent $csvContent -Email $managerEmail
    if ($managerLine) {
        $fullNameNeutralized = $managerLine -match (",'=" + [regex]::Escape($managerFormulaName.TrimStart('=')))
        $notesNeutralized = $managerLine -match [regex]::Escape("'" + $managerFormulaNote)
        $rawDangerous = $managerLine -match ',=QA Formula ' -or $managerLine -match ',=1\+1'
        if ($fullNameNeutralized -and $notesNeutralized -and -not $rawDangerous) {
            Write-Pass "CSV export neutralized manager formula payload in both fullName and notes"
        } else {
            Write-Fail "CSV injection defense missing or incomplete for manager row: $managerLine"
        }
    } else {
        Write-Fail "Manager row not found in CSV export"
    }
} else {
    Write-Fail "Manager CSV export failed or missing download headers"
}

Write-Step "3.5" "CSV export with activeOnly=true excludes inactive temp fixtures"
$activeOnlyExport = Invoke-RawRequest -Method GET -Uri "$BaseUrl/export-users/csv?activeOnly=true" -Headers $h -Label "ExportActiveOnly"
if ($activeOnlyExport.success) {
    $activeCsv = $activeOnlyExport.body.TrimStart([char]0xFEFF)
    $activeLines = @($activeCsv -split "`r?`n" | Where-Object { $_.Trim() })
    $hasTempAgent = $activeCsv -match [regex]::Escape($tempAgentEmail)
    $hasTempSupplier = $activeCsv -match [regex]::Escape($tempSupplierEmail)
    $hasImportedUser = $activeCsv -match [regex]::Escape($tempImportedEmail)
    if (-not $hasTempAgent -and -not $hasTempSupplier -and -not $hasImportedUser -and $activeLines.Count -ge 2) {
        Write-Pass "activeOnly export excludes inactive temp fixtures"
    } else {
        Write-Fail "activeOnly export still contains inactive temp fixtures"
    }
} else {
    Write-Fail "activeOnly export request failed"
}

# ===== PHASE 4: IMPORT TEMPLATE / INSTRUCTIONS =====
Write-Section "PHASE 4: Import Template / Instructions"
Write-Step "4.1" "Template endpoint returns CSV download"
$template = Invoke-RawRequest -Method GET -Uri "$BaseUrl/import-users/template" -Headers $h -Label "ImportTemplate"
if ($template.success -and $template.headers['Content-Type'] -match 'text/csv') {
    $templateContent = $template.body.TrimStart([char]0xFEFF)
    $templateHeaderRow = ($templateContent -split "`r?`n" | Select-Object -First 1).Trim()
    if ($templateContent -match 'Email' -and @($templateHeaderRow -split ',').Count -ge 11) {
        Write-Pass "Import template returned CSV content"
    } else {
        Write-Fail "Import template content missing expected columns"
    }
} else {
    Write-Fail "Import template endpoint failed or missing CSV headers"
}

Write-Step "4.2" "Instructions endpoint returns contract metadata"
$instructions = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/import-users/instructions" -Headers $h -Label "ImportInstructions"
if ($instructions.success -and $instructions.data.requiredColumns.Count -eq 5 -and $instructions.data.optionalColumns.Count -ge 6 -and $instructions.data.importRules.Count -ge 5) {
    Write-Pass "Import instructions include required columns, optional columns, and rules"
} else {
    Write-Fail "Import instructions response is incomplete"
}

# ===== PHASE 5: VALIDATE CSV =====
Write-Section "PHASE 5: Validate CSV"
$importCsvHeader = $canonicalImportHeader
$validCsvRows = @(
    @(
        "Imported New $ts"
        $tempImportedEmail
        '123456'
        "094000$($ts.Substring($ts.Length - 4))"
        'employee'
        'Test Address'
        'false'
        ''
        ''
        'validate/import row'
        ''
    ),
    @(
        "Overwrite Manager $ts"
        $managerEmail
        '123456'
        "095000$($ts.Substring($ts.Length - 4))"
        'manager'
        'Manager Address'
        'true'
        ''
        ''
        'manager overwrite row'
        ''
    )
)
$validCsvContent = New-UserImportCsv -HeaderRow $importCsvHeader -Rows $validCsvRows
$validCsv = New-TempCsvFile -Name "import-valid-$ts.csv" -Content ([string]([char]0xFEFF) + $validCsvContent)

Write-Step "5.1" "Validate a good CSV file"
$validateGood = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/validate" -Headers $h -FilePath $validCsv -FileName "import-valid-$ts.csv" -Label "ValidateGood"
if ($validateGood.success) {
    $validateGoodData = $null
    $validateGoodData = ConvertFrom-ResponseJson $validateGood.body
    if ($validateGoodData -and $validateGoodData.valid -eq $true -and $validateGoodData.totalRows -eq 2) {
        Write-Pass "Validate accepted the good CSV and counted rows correctly"
    } else {
        Write-Fail "Validate good CSV returned unexpected payload"
    }
} else {
    Write-Fail "Validate good CSV request failed"
}

Write-Step "5.2" "Validate rejects empty CSV content"
$emptyCsv = New-TempCsvFile -Name "import-empty-$ts.csv" -Content ""
$validateEmpty = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/validate" -Headers $h -FilePath $emptyCsv -FileName "import-empty-$ts.csv" -Label "ValidateEmpty"
if ($validateEmpty.success) {
    $validateEmptyData = $null
    $validateEmptyData = ConvertFrom-ResponseJson $validateEmpty.body
    if ($validateEmptyData -and $validateEmptyData.valid -eq $false) {
        Write-Pass "Empty CSV marked invalid by validate endpoint"
    } else {
        Write-Fail "Empty CSV should be marked invalid"
    }
} else {
    Write-Fail "Validate empty CSV request failed unexpectedly"
}

Write-Step "5.3" "Validate rejects non-CSV content type"
$textFile = New-TempCsvFile -Name "import-text-$ts.txt" -Content "not a csv"
$validateText = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/validate" -Headers $h -FilePath $textFile -FileName "import-text-$ts.txt" -FileContentType "text/plain" -Label "ValidateText"
if (-not $validateText.success -and ($validateText.statusCode -eq 400 -or $validateText.statusCode -eq 415)) {
    Write-Pass "Non-CSV upload rejected by file filter ($($validateText.statusCode))"
} else {
    Write-Fail "Non-CSV upload should be rejected"
}

# ===== PHASE 6: IMPORT CSV =====
Write-Section "PHASE 6: Import CSV"
Write-Step "6.1" "Import mixed CSV with one new row and one overwrite-by-email row"
$importResult = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/csv" -Headers $h -FilePath $validCsv -FileName "import-valid-$ts.csv" -Label "ImportGood"
if ($importResult.success) {
    $importData = $null
    $importData = ConvertFrom-ResponseJson $importResult.body
    if ($importData -and $importData.success -eq 1 -and $importData.updated -eq 1 -and $importData.failed -eq 0 -and $importData.total -eq 2) {
        Write-Pass "Import created one user and updated manager by email"
    } else {
        Write-Fail "Import result counts are incorrect"
    }
} else {
    Write-Fail "Import CSV request failed"
}

Write-Step "6.2" "Verify overwrite-by-email applied to manager"
$managerAfterImport = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/email/$([uri]::EscapeDataString($managerEmail))" -Headers $h -Label "ManagerAfterImport"
if ($managerAfterImport.success -and $managerAfterImport.data.fullName -eq "Overwrite Manager $ts") {
    Write-Pass "Manager row overwritten by email"
} else {
    Write-Fail "Manager row was not overwritten by email"
}

Write-Step "6.3" "Verify new imported user exists"
$importedUser = Invoke-JsonRequest -Method GET -Uri "$BaseUrl/users/email/$([uri]::EscapeDataString($tempImportedEmail))" -Headers $h -Label "ImportedUserLookup"
if ($importedUser.success -and $importedUser.data.email -eq $tempImportedEmail) {
    Write-Pass "Imported user created successfully"
} else {
    Write-Fail "Imported user not found after import"
}

Write-Step "6.4" "Import rejects malformed rows"
$badCsvRows = @(
    @(
        'Bad Email Row'
        'not-an-email'
        '123456'
        '0960000001'
        'employee'
        ''
        'false'
        ''
        ''
        'bad email row'
        ''
    ),
    @(
        'Bad Role Row'
        "bad.role.$ts@test.com"
        '123456'
        '0960000002'
        'not-a-role'
        ''
        'false'
        ''
        ''
        'bad role row'
        ''
    )
)
$badCsvContent = New-UserImportCsv -HeaderRow $importCsvHeader -Rows $badCsvRows
$badCsv = New-TempCsvFile -Name "import-bad-$ts.csv" -Content $badCsvContent
$badImport = Invoke-MultipartRequest -Method POST -Uri "$BaseUrl/import-users/csv" -Headers $h -FilePath $badCsv -FileName "import-bad-$ts.csv" -Label "ImportBad"
if ($badImport.success) {
    $badImportData = $null
    $badImportData = ConvertFrom-ResponseJson $badImport.body
    if ($badImportData -and $badImportData.total -eq 2 -and $badImportData.failed -eq 2 -and $badImportData.success -eq 0 -and $badImportData.updated -eq 0) {
        Write-Pass "Malformed rows were rejected row-by-row"
    } else {
        Write-Fail "Malformed row import did not report failures correctly"
    }
} else {
    Write-Fail "Malformed import request failed unexpectedly"
}
# ===== PHASE 7: CLEANUP =====
Write-Section "PHASE 7: Cleanup"
Write-Step "7.1" "Restore or remove manager fixture"
if ($managerWasCreated) {
    if ($managerId) {
        $deletedManager = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/users/$managerId" -Headers $h -Label "DeleteFallbackManager"
        if ($deletedManager.success) {
            Write-Pass "Fallback manager deleted"
        } else {
            Write-Fail "Fallback manager deletion failed"
        }
    }
} elseif ($managerId) {
    $restoreBody = @{
        fullName = $managerOriginal.fullName
        phone = $managerOriginal.phone
        address = $managerOriginal.address
        notes = $managerOriginal.notes
        isActive = $managerOriginal.isActive
    } | ConvertTo-Json
    $restoreManager = Invoke-JsonRequest -Method PATCH -Uri "$BaseUrl/users/$managerId" -Headers $h -Body $restoreBody -Label "RestoreManager"
    if ($restoreManager.success) {
        Write-Pass "Manager restored after overwrite test"
    } else {
        Write-Fail "Manager restore failed after overwrite test"
    }
}

Write-Step "7.2" "Delete temporary selector and import users"
foreach ($entry in @(
    @{ id = $tempAgentId; email = $tempAgentEmail; label = "DeleteTempAgent" },
    @{ id = $tempSupplierId; email = $tempSupplierEmail; label = "DeleteTempSupplier" },
    @{ id = if ($importedUser.success -and $importedUser.data._id) { [string]$importedUser.data._id } elseif ($importedUser.success -and $importedUser.data.id) { [string]$importedUser.data.id } else { $null }; email = $tempImportedEmail; label = "DeleteImportedUser" }
) ) {
    if ($entry.id) {
        $deleted = Invoke-JsonRequest -Method DELETE -Uri "$BaseUrl/users/$($entry.id)" -Headers $h -Label $entry.label
        if ($deleted.success) {
            Write-Pass "Deleted $($entry.email)"
        } else {
            Write-Fail "Failed to delete $($entry.email)"
        }
    } else {
        Write-Info "Skip cleanup for $($entry.email) - no id"
    }
}

foreach ($path in $script:cleanupPaths) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
}

# ===== SUMMARY =====
Write-Section "KET QUA - USER IMPORT / EXPORT MODULE"
Write-Host ""
Write-Host "  ============================================="
Write-Host "  Test Timestamp : $ts"
Write-Host "  PASS           : $($script:passCount)"
Write-Host "  FAIL           : $($script:failCount)"
Write-Host "  ============================================="
if ($script:failCount -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  SOME TESTS FAILED!" -ForegroundColor Red
    $script:failDetails | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}

exit $script:failCount
