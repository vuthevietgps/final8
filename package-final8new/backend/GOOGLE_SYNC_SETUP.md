# Thiết lập đồng bộ Google Sheets

Để backend có thể ghi dữ liệu "Tổng hợp 1" lên Google Sheets theo từng đại lý, cần cấu hình thông tin xác thực Google API:

1. Tạo Service Account trên Google Cloud và cấp quyền với Google Sheets API (Scope: `https://www.googleapis.com/auth/spreadsheets`).
2. Tải file JSON key và cấu hình một trong hai biến môi trường:

- Cách A: trỏ tới file JSON key
  - WINDOWS PowerShell
    - `$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\path\\to\\service-account.json"`
- Cách B: nhúng nội dung JSON key
  - WINDOWS PowerShell
    - `$env:GOOGLE_CREDENTIALS_JSON = Get-Content -Raw "C:\\path\\to\\service-account.json"`

3. Trong trang Quản lý Người dùng, điền link Google Sheets vào cột "googleDriveLink" cho đại lý (dạng: `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`).

4. Cron job mặc định chạy mỗi 10 phút. Có thể trigger thủ công:
   - `POST http://localhost:3000/google-sync/all`
   - `POST http://localhost:3000/google-sync/agent/<agentId>`

Lưu ý: Service sẽ ghi đè toàn bộ sheet `Summary1` (phạm vi `Summary1!A1`). Hãy đảm bảo sheet này tồn tại và đại lý có link hợp lệ.
