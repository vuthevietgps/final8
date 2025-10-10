param(
  [string]$PackageName = 'final8-new.zip'
)

$ErrorActionPreference = 'Stop'

# Determine project root (one level up from this script's folder)
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pkgDir      = Join-Path $projectRoot 'package-final8new'
$zipPath     = Join-Path $projectRoot $PackageName

Write-Host "Project root: $projectRoot"

# Clean previous artifacts
if (Test-Path $pkgDir) { Write-Host "Removing old $pkgDir"; Remove-Item -Recurse -Force $pkgDir }
if (Test-Path $zipPath) { Write-Host "Removing old $zipPath"; Remove-Item -Force $zipPath }

# Create staging directory
New-Item -ItemType Directory -Path $pkgDir | Out-Null

# Copy backend and frontend source
Copy-Item -Recurse -Force (Join-Path $projectRoot 'backend')  -Destination (Join-Path $pkgDir 'backend')
Copy-Item -Recurse -Force (Join-Path $projectRoot 'frontend') -Destination (Join-Path $pkgDir 'frontend')

# Trim heavy/unneeded folders
$pathsToRemove = @(
  (Join-Path $pkgDir 'backend\node_modules'),
  (Join-Path $pkgDir 'frontend\node_modules'),
  (Join-Path $pkgDir 'frontend\dist'),
  (Join-Path $pkgDir 'backend\uploads')
)
foreach ($p in $pathsToRemove) { if (Test-Path $p) { Write-Host "Removing $p"; Remove-Item -Recurse -Force $p } }

# Ensure credential JSON is included (Method 1)
$credSrc = Join-Path $projectRoot 'backend\dongbodulieuweb-8de0c9a12896.json'
$credDst = Join-Path $pkgDir      'backend\dongbodulieuweb-8de0c9a12896.json'
if (Test-Path $credSrc) {
  Write-Host "Including credential JSON: $credSrc"
  Copy-Item $credSrc -Destination $credDst -Force
} else {
  Write-Warning "Credential JSON not found at $credSrc. Package will be created without it."
}

# Copy compose files and README if present
$maybeFiles = @('docker-compose.yml','docker-compose.server.yml','docker-compose.server.full.yml','docker-compose.credentials-env.yml','README.md')
foreach ($f in $maybeFiles) {
  $src = Join-Path $projectRoot $f
  if (Test-Path $src) { Copy-Item $src -Destination $pkgDir -Force }
}

# Create zip
Write-Host "Creating zip: $zipPath"
Compress-Archive -Path (Join-Path $pkgDir '*') -DestinationPath $zipPath -Force

# Output result
$fi = Get-Item $zipPath
[PSCustomObject]@{
  ZipPath = $fi.FullName
  SizeMB  = [Math]::Round($fi.Length/1MB,2)
  Modified= $fi.LastWriteTime
}
