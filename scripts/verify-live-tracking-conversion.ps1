param([switch]$ProbeWebsite)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$credential = Import-Clixml (Join-Path $repo 'tmp/erp-next-admin.credential.xml')
$login = Invoke-RestMethod -Method Post -Uri 'http://192.168.100.236:8107/api/auth/login' -ContentType 'application/json' -Body (@{email=$credential.UserName;password=$credential.GetNetworkCredential().Password}|ConvertTo-Json -Compress)
$headers = @{Authorization=('Bearer '+$login.access_token)}
$base = 'http://192.168.100.236:8107/api/tracking-crm'
$options = Invoke-RestMethod -Uri "$base/options" -Headers $headers
$source = @($options.sources | Where-Object name -Match 'nghiepvuvantai.com')
if ($source.Count -ne 1) { throw 'Expected exactly one website source' }
$scope = 'sourceId=' + $source[0]._id
$all = Invoke-RestMethod -Uri ($base+'?'+$scope) -Headers $headers
$converted = Invoke-RestMethod -Uri ($base+'?'+$scope+'&type=conversion') -Headers $headers
$clicks = Invoke-RestMethod -Uri ($base+'?'+$scope+'&type=click') -Headers $headers
if ($all.total -ne ($converted.total + $clicks.total)) { throw 'Classification totals do not reconcile' }
if (@($converted.items | Where-Object interactionKind -NE 'conversion').Count) { throw 'Incorrect conversion label' }
if (@($clicks.items | Where-Object interactionKind -NE 'click').Count) { throw 'Incorrect click label' }
@{visits=$all.total;conversions=$converted.total;clicks=$clicks.total} | ConvertTo-Json -Compress
if (!$ProbeWebsite) { exit 0 }

$marker = 'ERP_TRACKING_TEST_' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$markerPath = Join-Path $repo 'tmp/tracking-conversion-live-fix-marker.txt'
Set-Content -LiteralPath $markerPath -Value $marker
$testQuery = $base+'?'+$scope+'&search='+$marker
function Wait-Classification([string]$kind) {
  for ($i=0; $i -lt 15; $i++) {
    $result = Invoke-RestMethod -Uri $testQuery -Headers $headers
    if ($result.total -eq 1 -and $result.items[0].interactionKind -eq $kind) { return $result.items[0] }
    Start-Sleep -Seconds 5
  }
  throw "Website test did not become $kind"
}
try {
  $page = Invoke-WebRequest -Uri ('https://nghiepvuvantai.com/?gclid='+$marker+'&kw=ERP_TEST_TRACKING') -SessionVariable websiteSession
  if ($page.StatusCode -ne 200) { throw 'Website probe failed' }
  $null = Wait-Classification 'click'
  Write-Output 'LIVE_NEW_VISIT_IS_CLICK'
  foreach ($eventName in @('contact','form_submit')) {
    $response = Invoke-WebRequest -Method Post -Uri 'https://nghiepvuvantai.com/api/ad-traffic/event' -WebSession $websiteSession -Headers @{Origin='https://nghiepvuvantai.com';Referer='https://nghiepvuvantai.com/'} -ContentType 'application/json' -Body (@{event=$eventName;value=1}|ConvertTo-Json -Compress)
    if ($response.StatusCode -ne 204) { throw 'Collector did not accept test event' }
  }
  $row = Wait-Classification 'conversion'
  if ('contact' -notin $row.conversionTypes -or 'form_submit' -notin $row.conversionTypes -or $row.visit.engagement.contactActions -ne 1 -or $row.visit.engagement.formSubmits -ne 1) { throw 'Conversion evidence mismatch' }
  $excluded = Invoke-RestMethod -Uri ($testQuery+'&type=click') -Headers $headers
  $included = Invoke-RestMethod -Uri ($testQuery+'&type=conversion') -Headers $headers
  if ($excluded.total -ne 0 -or $included.total -ne 1) { throw 'Conversion filters mismatch' }
  Write-Output 'LIVE_CONTACT_AND_FORM_ARE_CONVERSION_AND_EXCLUDED_FROM_CLICKS'
} finally {
  $marker | ssh -o HostName=192.168.100.236 -o HostKeyAlias=fd00:db80::a htxbachgia python3 /home/admin-001/erp-next/cleanup-tracking-owned-test.py
  if ($LASTEXITCODE -ne 0) { Write-Error 'Cleanup failed; retain marker file for exact recovery' }
}
