# Nghiệm thu Giai đoạn 2.1 - AI Data Pack Sample Export

Ngày nghiệm thu: 2026-06-12

## Kết quả tổng quát

Backend và module `ai-data-pack` chạy thành công với local DB hiện có. Đăng nhập bằng user director và gọi thành công toàn bộ 7 endpoint yêu cầu. Các file JSON/XLSX đã được lưu tại `docs/ai-data-pack/sample-exports/20260612/`.

## Endpoint thành công

Tất cả endpoint sau trả HTTP 200:

- Director Data Pack JSON/XLSX.
- Marketer Data Pack JSON/XLSX.
- Data Quality Report JSON.
- Mapping Report JSON.
- Decision History JSON.

## File đã xuất

- `director-data-pack-20260612.json`
- `director-data-pack-20260612.xlsx`
- `marketer-data-pack-20260612.json`
- `marketer-data-pack-20260612.xlsx`
- `data-quality-report-20260612.json`
- `mapping-report-20260612.json`
- `decision-history-20260612.json`
- `checksums.json`
- `sample-export-verification-20260612.md`
- `chatgpt-web-test-prompt-20260612.md`

## Dữ liệu thực tế và schema-only

Director Pack có dữ liệu thực tế/hiện hữu cho finance, financing, cashflow scenario, finance alerts, operation status counts, quality/mapping reports và static rules/limits/aliases.

Các phần rỗng hoặc không đủ dữ liệu cho ngày `2026-06-12` gồm manual inputs, marketing profitability, service/product performance, unit economics, sales funnel/team, decision history, decision options và external market summary. Business summary chỉ chứa số 0 vì DB có 0 order trong ngày.

Marketer Pack không có dữ liệu Google thực tế trong DB nghiệm thu. Allowed actions vẫn đúng: `monitor_only=true`, `live_execution=false`.

## Data quality và mapping

- 10 metric có giá trị `null` và status `missing`.
- `attribution_confidence=0`, status `blocked`.
- Toàn bộ decision gate nhạy cảm giữ trạng thái false, gồm action import, dry-run và live execution.
- Chỉ `product_variant_to_service_group` đạt 100%; các mapping segment còn lại missing trong sample ngày báo cáo.

## Finance

- Cash available lấy từ canonical bank balance.
- Approved-not-disbursed loan chỉ vào expected inflow.
- Debt service 30/90 ngày có warning cho missing schedule/overdue.
- Không dùng ba hàm finance bị cấm, mock hoặc random source.
- Sample không có proposed loan để xác minh thực nghiệm quy tắc proposed; quy tắc đã được xác minh bằng code/test trước đó.

## Security

Không phát hiện secret/API key/token/credential/password/private key, email khách hàng hoặc số điện thoại đầy đủ trong toàn bộ sample JSON/XLSX.

## Khả năng dùng với ChatGPT Web

File XLSX hợp lệ, có đủ 25 Director sheet và đọc được bằng parser XLSX local. File có thể dùng để upload và kiểm tra phân tích thận trọng. Chưa xác minh bằng upload thật lên ChatGPT Web trong phiên này.

Do dữ liệu ngày báo cáo thiếu, ChatGPT Web chỉ nên kết luận ở mode `blocked/cautious`, không được scale ads hoặc tạo hành động live.

Tài liệu OpenAI hiện xác nhận ChatGPT hỗ trợ phân tích các file spreadsheet `.xlsx` và file `.json`; khả năng thực tế vẫn phụ thuộc model, plan và workspace settings:

- https://help.openai.com/en/articles/8983675-what-types-of-files-are-supported
- https://help.openai.com/en/articles/8437071-data-analysis-with-chatgpt

## Lỗi cần sửa ở Giai đoạn 2.2

1. XLSX sheet rỗng mất warning, confidence, missing fields và `can_use_for_decision`; hiện chỉ còn `status=empty`.
2. Metadata checksum không deterministic giữa hai lần gọi cùng ngày do finance/forecast timestamp động.
3. `generated_by` serialize thành ObjectId buffer thay vì chuỗi ID đã redact/chuẩn hóa.
4. Cần có dữ liệu Google Ads sync, lead và order đúng ngày để nghiệm thu giá trị thực của Marketer Pack và attribution.
5. Cần làm rõ quality status finance: đang là `ok/yes` dù có missing debt schedule 30/90 ngày.
6. Cần nghiệm thu proposed-loan rule trên sample DB có proposed loan.
7. Cần upload thật XLSX lên ChatGPT Web và lưu kết quả đọc/phân tích.

## Quyết định chuyển giai đoạn

**Chưa được phép chuyển sang Giai đoạn 3 OpenAI API key.**

Lý do: chưa có phê duyệt; sample chưa đủ dữ liệu ads/lead/order theo ngày; còn lỗi XLSX quality metadata, deterministic checksum và metadata serialization. Không tự bật OpenAI integration, action import, dry-run chung hoặc live execution.
