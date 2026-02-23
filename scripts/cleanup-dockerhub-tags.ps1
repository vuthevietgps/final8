param(
  [string]$Repository = 'vutheviet/final8new',
  [string]$KeepTagBackend = 'backend-version7.0',
  [string]$KeepTagFrontend = 'frontend-version7.0'
)

# Requires: setx DOCKERHUB_USER "<user>"; setx DOCKERHUB_TOKEN "<PAT>" and reopen shell
$user = $env:DOCKERHUB_USER
$token = $env:DOCKERHUB_TOKEN
if(-not $user -or -not $token){
  Write-Error "Please set DOCKERHUB_USER and DOCKERHUB_TOKEN environment variables."
  exit 1
}

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${user}:${token}"))
$headers = @{ Authorization = "Basic $auth" }

function Get-Tags($repo){
  $tags = @()
  $url = "https://hub.docker.com/v2/repositories/$repo/tags?page_size=100"
  while($url){
    $resp = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
    $tags += $resp.results.name
    $url = $resp.next
  }
  return $tags
}

function Remove-Tag($repo, $tag){
  $url = "https://hub.docker.com/v2/repositories/$repo/tags/$tag/"
  try {
    Invoke-RestMethod -Method Delete -Uri $url -Headers $headers -ErrorAction Stop | Out-Null
  Write-Host "Deleted ${repo}:${tag}"
  } catch {
  Write-Warning "Failed to delete ${repo}:${tag} - $_"
  }
}

$keep = @($KeepTagBackend, $KeepTagFrontend)
$all = Get-Tags -repo $Repository
$toDelete = $all | Where-Object { $keep -notcontains $_ }

foreach($t in $toDelete){ Remove-Tag -repo $Repository -tag $t }

Write-Host "Remaining tags to keep:" -ForegroundColor Green
$keep | ForEach-Object { param($t); Write-Host "  ${Repository}:${t}" }
