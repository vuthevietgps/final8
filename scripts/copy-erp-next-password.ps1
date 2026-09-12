$ErrorActionPreference = 'Stop'
$credentialFile = Join-Path $PSScriptRoot '../tmp/erp-next-admin.credential.xml'
if (-not (Test-Path -LiteralPath $credentialFile)) { throw 'Encrypted credential file was not found on this PC.' }
$credential = Import-Clixml -LiteralPath $credentialFile
Set-Clipboard -Value $credential.GetNetworkCredential().Password
Write-Output ("Đã sao chép mật khẩu ERP mới vào clipboard. Đăng nhập bằng " + $credential.UserName + '.')
