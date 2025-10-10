$quotes = @(
    @{
        productId = "68b7835cf402c3931acd7b35"
        agentId = "68bfa75d2cbc0f781d9de469"  
        price = 230000
        status = "Đã duyệt"
        notes = "Quote for Thẻ Tập Huấn 3 năm - Giấy Phép Vào Phố"
    },
    @{
        productId = "68b7835cf402c3931acd7b35"
        agentId = "68bfae652cbc0f781d9de478"
        price = 250000
        status = "Đã duyệt"
        notes = "Quote for Thẻ Tập Huấn 3 năm - Mạnh Nguyễn"
    },
    @{
        productId = "68b725607ec5d28a0d499d1e"
        agentId = "68bfae652cbc0f781d9de478"
        price = 180000
        status = "Đã duyệt"
        notes = "Quote for Phù Hiệu Xe 3 Năm - Mạnh Nguyễn"
    },
    @{
        productId = "68b7255f7ec5d28a0d499d12"
        agentId = "68bfae652cbc0f781d9de478"
        price = 320000
        status = "Đã duyệt"
        notes = "Quote for Phù Hiệu Xe 7 năm - Mạnh Nguyễn"
    },
    @{
        productId = "68b7833df402c3931acd7b2e"
        agentId = "68b9af7afb7a0875783bcf19"
        price = 280000
        status = "Đã duyệt"
        notes = "Quote for Thẻ Tập Huấn 5 năm - Trần Thị Vui"
    }
)

Write-Host "Creating sample quotes..."

foreach ($quote in $quotes) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/quotes" -Method Post -Body ($quote | ConvertTo-Json) -ContentType "application/json"
        Write-Host "Created quote: $($quote.notes)" -ForegroundColor Green
    }
    catch {
        Write-Host "Error creating quote: $($quote.notes) - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Sample quotes creation completed!"