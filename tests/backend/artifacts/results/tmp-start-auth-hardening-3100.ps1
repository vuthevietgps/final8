$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\backend'
$env:PORT = '3100'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/htxbachgia_authhardening'
$env:AUTH_ENABLE_IP_RESTRICTION = 'true'
Write-Output "PORT=$env:PORT"
Write-Output "MONGODB_URI=$env:MONGODB_URI"
Write-Output "AUTH_ENABLE_IP_RESTRICTION=$env:AUTH_ENABLE_IP_RESTRICTION"
node dist/main
