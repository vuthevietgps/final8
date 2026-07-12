# TEST LABOR STATEMENT API
# ========================

$baseUrl = "http://localhost:3000"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 1: Lấy danh sách statements" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements" -Method Get -UseBasicParsing
$statements = $response.Content | ConvertFrom-Json
Write-Host "Total statements: $($statements.Count)" -ForegroundColor Green
$statements | ConvertTo-Json -Depth 3

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 2: Tạo statement mới (kỳ 7 ngày)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Lấy user ID đầu tiên từ database
$users = Invoke-WebRequest -Uri "$baseUrl/users" -Method Get -UseBasicParsing | ConvertFrom-Json
$employeeId = $users[0]._id

$periodFrom = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
$periodTo = (Get-Date).ToString("yyyy-MM-dd")

$createDto = @{
    employeeId = $employeeId
    periodFrom = $periodFrom
    periodTo = $periodTo
    openingBalance = 0
    bonus = 50000
    deduction = 0
    notes = "Test statement for week"
} | ConvertTo-Json

Write-Host "Creating statement for employee: $employeeId" -ForegroundColor Yellow
Write-Host "Period: $periodFrom to $periodTo" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements" -Method Post -Body $createDto -ContentType "application/json" -UseBasicParsing
    $statement = $response.Content | ConvertFrom-Json
    Write-Host "Statement created successfully!" -ForegroundColor Green
    $statementId = $statement._id
    $statement | ConvertTo-Json -Depth 3
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    exit
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 3: Xem chi tiết statement" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements/$statementId" -Method Get -UseBasicParsing
$detail = $response.Content | ConvertFrom-Json
Write-Host "Statement details:" -ForegroundColor Green
$detail | ConvertTo-Json -Depth 4

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 4: Confirm statement (draft → open)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$confirmDto = @{
    confirmedBy = "admin"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements/$statementId/confirm" -Method Post -Body $confirmDto -ContentType "application/json" -UseBasicParsing
$confirmed = $response.Content | ConvertFrom-Json
Write-Host "Statement confirmed!" -ForegroundColor Green
Write-Host "Status: $($confirmed.status)" -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 5: Thêm thanh toán" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$paymentDto = @{
    amount = 500000
    paidAt = (Get-Date).ToString("yyyy-MM-dd")
    method = "bank_transfer"
    reference = "TXN123456"
    notes = "Thanh toán lương kỳ 1"
    createdBy = "admin"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements/$statementId/payments" -Method Post -Body $paymentDto -ContentType "application/json" -UseBasicParsing
$paid = $response.Content | ConvertFrom-Json
Write-Host "Payment added!" -ForegroundColor Green
Write-Host "Total paid: $($paid.statementPaymentTotal)" -ForegroundColor Yellow
Write-Host "Closing balance: $($paid.closingBalance)" -ForegroundColor Yellow
Write-Host "Status: $($paid.status)" -ForegroundColor Yellow

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 6: Lấy tổng lương chưa thanh toán" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements/summary/total-unpaid" -Method Get -UseBasicParsing
$totalUnpaid = $response.Content
Write-Host "Total unpaid labor cost: $totalUnpaid VND" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 7: Tổng hợp theo nhân viên" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$baseUrl/labor-cost1/statements/summary/by-employee" -Method Get -UseBasicParsing
$summary = $response.Content | ConvertFrom-Json
Write-Host "Employee summary:" -ForegroundColor Green
$summary | ConvertTo-Json -Depth 3

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST 8: Kiểm tra Committed Cash Fund" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$response = Invoke-WebRequest -Uri "$baseUrl/api/funds/overview" -Method Get -UseBasicParsing
$funds = $response.Content | ConvertFrom-Json
Write-Host "Committed Cash Fund:" -ForegroundColor Green
$funds.committedCash | ConvertTo-Json -Depth 2

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "ALL TESTS COMPLETED!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green
