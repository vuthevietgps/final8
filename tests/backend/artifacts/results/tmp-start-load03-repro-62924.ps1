$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\backend'
$env:PORT = '62924'
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/htxbachgia_load03_fix3_20260424210944'
$env:MEDIA_DIR = 'C:\Users\PC\Documents\code\htxbachgia.shop\final8-version16\tests\backend\artifacts\results\tmp-load03-fix3-media-20260424210944'
$env:JWT_SECRET = 'load03-fix-secret'
node dist/main.js
