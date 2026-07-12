$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\backend'
$env:PORT = '3000'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/htxbachgia'
$env:PLAN_TYPE = 'enterprise'
Write-Output "PORT=$env:PORT"
Write-Output "MONGODB_URI=$env:MONGODB_URI"
Write-Output "PLAN_TYPE=$env:PLAN_TYPE"
node dist/main
