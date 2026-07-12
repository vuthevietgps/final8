param(
  [string]$OutputDir = "reports/api-review",
  [string]$LatestFbGraphVersion = "",
  [string]$LatestGoogleAdsVersion = "",
  [string]$LatestTiktokApiVersion = "",
  [switch]$Strict
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not [System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir = Join-Path $RepoRoot $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

function Write-ScanFile {
  param(
    [string]$Name,
    [string[]]$Lines
  )
  $path = Join-Path $OutputDir $Name
  if (-not $Lines) { $Lines = @() }
  Set-Content -Path $path -Value $Lines -Encoding UTF8
  return $path
}

function Invoke-Scan {
  param(
    [string]$Pattern,
    [string]$Path = "backend/src"
  )

  if (Get-Command rg -ErrorAction SilentlyContinue) {
    $result = & rg -n --no-heading --color never $Pattern $Path 2>$null
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {
      return @($result | Where-Object { $_ -and $_.Trim() -ne "" })
    }
    throw "rg scan failed for pattern: $Pattern"
  }

  $matches = @()
  $files = Get-ChildItem -Path $Path -Recurse -File
  foreach ($file in $files) {
    $hits = Select-String -Path $file.FullName -Pattern $Pattern
    foreach ($h in $hits) {
      $matches += "$($h.Path):$($h.LineNumber):$($h.Line.Trim())"
    }
  }
  return $matches
}

function Get-FirstMatchGroup {
  param(
    [string]$FilePath,
    [string]$Pattern
  )

  if (-not (Test-Path $FilePath)) { return "" }
  $m = Select-String -Path $FilePath -Pattern $Pattern | Select-Object -First 1
  if (-not $m) { return "" }
  $regex = [regex]$Pattern
  $mm = $regex.Match($m.Line)
  if (-not $mm.Success -or $mm.Groups.Count -lt 2) { return "" }
  return $mm.Groups[1].Value
}

function Get-VersionStatus {
  param(
    [string]$Current,
    [string]$Latest
  )
  if (-not $Current) { return "missing-current" }
  if (-not $Latest) { return "latest-not-provided" }
  if ($Current -eq $Latest) { return "match" }
  return "mismatch"
}

function Test-UrlStatus {
  param([string]$Url)
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 20
    return "$($r.StatusCode)"
  } catch {
    try {
      $r = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 20
      return "$($r.StatusCode)"
    } catch {
      return "error"
    }
  }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"

$fbScan = Invoke-Scan -Pattern "graph\.facebook|facebook\.com|FB_|messenger|webhook\/messenger|access_token|adset"
$googleScan = Invoke-Scan -Pattern "googleads\.googleapis|GOOGLE_ADS_|googleapis|refresh_token|developer-token|GOOGLE_APPLICATION_CREDENTIALS|GOOGLE_CREDENTIALS_JSON"
$tiktokScan = Invoke-Scan -Pattern "business-api\.tiktok|TIKTOK_|provider:\s*'tiktok'|provider:\s*""tiktok"""
$tokenScan = Invoke-Scan -Pattern "api-token|tokenEnc|tokenHash|expireAt|lastCheckStatus|rotate|set-primary|ApiToken"

$fbScanPath = Write-ScanFile -Name "facebook-callsites.txt" -Lines $fbScan
$googleScanPath = Write-ScanFile -Name "google-callsites.txt" -Lines $googleScan
$tiktokScanPath = Write-ScanFile -Name "tiktok-callsites.txt" -Lines $tiktokScan
$tokenScanPath = Write-ScanFile -Name "token-callsites.txt" -Lines $tokenScan

$fbVersionCurrent = Get-FirstMatchGroup -FilePath "backend/src/advertising-cost/advertising-cost.facebook-sync.service.ts" -Pattern "FB_GRAPH_API_VERSION\s*=\s*.*'([^']+)'"
$googleVersionCurrent = Get-FirstMatchGroup -FilePath "backend/src/advertising-cost/advertising-cost.google-sync.service.ts" -Pattern "GOOGLE_ADS_API_VERSION\s*=\s*.*'([^']+)'"
$tiktokVersionCurrent = Get-FirstMatchGroup -FilePath "backend/src/advertising-cost/advertising-cost.tiktok-sync.service.ts" -Pattern "open_api\/(v[0-9]+\.[0-9]+)\/"

$fbStatus = Get-VersionStatus -Current $fbVersionCurrent -Latest $LatestFbGraphVersion
$googleStatus = Get-VersionStatus -Current $googleVersionCurrent -Latest $LatestGoogleAdsVersion
$tiktokStatus = Get-VersionStatus -Current $tiktokVersionCurrent -Latest $LatestTiktokApiVersion

$docChecks = @(
  [pscustomobject]@{ Name = "Meta Graph Changelog"; Url = "https://developers.facebook.com/docs/graph-api/changelog/"; Status = (Test-UrlStatus "https://developers.facebook.com/docs/graph-api/changelog/") },
  [pscustomobject]@{ Name = "Meta Marketing API"; Url = "https://developers.facebook.com/docs/marketing-api/"; Status = (Test-UrlStatus "https://developers.facebook.com/docs/marketing-api/") },
  [pscustomobject]@{ Name = "Google Ads Release Notes"; Url = "https://developers.google.com/google-ads/api/docs/release-notes"; Status = (Test-UrlStatus "https://developers.google.com/google-ads/api/docs/release-notes") },
  [pscustomobject]@{ Name = "TikTok Marketing API Docs"; Url = "https://business-api.tiktok.com/portal/docs"; Status = (Test-UrlStatus "https://business-api.tiktok.com/portal/docs") }
)

$summary = [pscustomobject]@{
  generatedAt = $timestamp
  scans = [pscustomobject]@{
    facebookHits = $fbScan.Count
    googleHits = $googleScan.Count
    tiktokHits = $tiktokScan.Count
    tokenHits = $tokenScan.Count
  }
  versions = [pscustomobject]@{
    facebook = [pscustomobject]@{
      current = $fbVersionCurrent
      latest = $LatestFbGraphVersion
      status = $fbStatus
    }
    google = [pscustomobject]@{
      current = $googleVersionCurrent
      latest = $LatestGoogleAdsVersion
      status = $googleStatus
    }
    tiktok = [pscustomobject]@{
      current = $tiktokVersionCurrent
      latest = $LatestTiktokApiVersion
      status = $tiktokStatus
    }
  }
  docs = $docChecks
  artifacts = [pscustomobject]@{
    facebookCallsites = $fbScanPath
    googleCallsites = $googleScanPath
    tiktokCallsites = $tiktokScanPath
    tokenCallsites = $tokenScanPath
  }
}

$summaryPath = Join-Path $OutputDir "api-review-summary.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -Path $summaryPath -Encoding UTF8

$report = New-Object System.Collections.Generic.List[string]
$report.Add("# API Compatibility Review Report")
$report.Add("")
$report.Add("- Generated at: $timestamp")
$report.Add("- Repo root: $RepoRoot")
$report.Add("")
$report.Add("## Coverage")
$report.Add("")
$report.Add("| Scope | Hits | Artifact |")
$report.Add("|---|---:|---|")
$report.Add("| Facebook callsites | $($fbScan.Count) | facebook-callsites.txt |")
$report.Add("| Google callsites | $($googleScan.Count) | google-callsites.txt |")
$report.Add("| TikTok callsites | $($tiktokScan.Count) | tiktok-callsites.txt |")
$report.Add("| Token lifecycle callsites | $($tokenScan.Count) | token-callsites.txt |")
$report.Add("")
$report.Add("## Version Check")
$report.Add("")
$report.Add("| Platform | Current in code | Latest input | Status |")
$report.Add("|---|---|---|---|")
$report.Add("| Facebook Graph | $fbVersionCurrent | $LatestFbGraphVersion | $fbStatus |")
$report.Add("| Google Ads | $googleVersionCurrent | $LatestGoogleAdsVersion | $googleStatus |")
$report.Add("| TikTok Marketing API | $tiktokVersionCurrent | $LatestTiktokApiVersion | $tiktokStatus |")
$report.Add("")
$report.Add("## Official Docs Reachability")
$report.Add("")
$report.Add("| Source | URL | HTTP status |")
$report.Add("|---|---|---|")
foreach ($d in $docChecks) {
  $report.Add("| $($d.Name) | $($d.Url) | $($d.Status) |")
}
$report.Add("")
$report.Add("## Action Items")
$report.Add("")
$report.Add("1. If any version status is mismatch, patch API version and affected request/response fields.")
$report.Add("2. Re-run sync health endpoint: GET /advertising-cost/sync/health.")
$report.Add("3. Trigger manual sync after patch:")
$report.Add("   - POST /advertising-cost/fetch/facebook?days=1")
$report.Add("   - POST /advertising-cost/fetch/google?days=1")
$report.Add("   - POST /advertising-cost/fetch/tiktok?days=1")
$report.Add("4. Validate and rotate tokens if needed via /api-tokens endpoints.")
$report.Add("")
$report.Add("## Sample Findings (first 25 lines each)")
$report.Add("")
$report.Add("### Facebook")
if ($fbScan.Count -gt 0) {
  $fbScan | Select-Object -First 25 | ForEach-Object { $report.Add("- $_") }
} else {
  $report.Add("- No matches")
}
$report.Add("")
$report.Add("### Google")
if ($googleScan.Count -gt 0) {
  $googleScan | Select-Object -First 25 | ForEach-Object { $report.Add("- $_") }
} else {
  $report.Add("- No matches")
}
$report.Add("")
$report.Add("### TikTok")
if ($tiktokScan.Count -gt 0) {
  $tiktokScan | Select-Object -First 25 | ForEach-Object { $report.Add("- $_") }
} else {
  $report.Add("- No matches")
}
$report.Add("")
$report.Add("### Token lifecycle")
if ($tokenScan.Count -gt 0) {
  $tokenScan | Select-Object -First 25 | ForEach-Object { $report.Add("- $_") }
} else {
  $report.Add("- No matches")
}

$reportPath = Join-Path $OutputDir "api-review-report.md"
Set-Content -Path $reportPath -Value $report -Encoding UTF8

Write-Host "API review artifacts:"
Write-Host " - $reportPath"
Write-Host " - $summaryPath"
Write-Host " - $fbScanPath"
Write-Host " - $googleScanPath"
Write-Host " - $tiktokScanPath"
Write-Host " - $tokenScanPath"

$mismatchCount = @($fbStatus, $googleStatus, $tiktokStatus | Where-Object { $_ -eq "mismatch" }).Count
if ($Strict -and $mismatchCount -gt 0) {
  throw "Strict mode failed: found $mismatchCount version mismatch(es)."
}
