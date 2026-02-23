$e = $null
$t = $null
[void][System.Management.Automation.Language.Parser]::ParseFile('d:\code\final8-version14.0\test-core-flow-e2e.ps1', [ref]$t, [ref]$e)
foreach($err in $e) { 
    Write-Host "$($err.Message) (Line: $($err.Extent.StartLineNumber), Col: $($err.Extent.StartColumnNumber))" -ForegroundColor Red
}
if ($e.Count -eq 0) { Write-Host "No parse errors found!" -ForegroundColor Green }
