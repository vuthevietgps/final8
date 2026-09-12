# AI Operator Token Optimization

## Trạng thái đã triển khai

- Đã thêm `AiOperatorTokenPolicy` và `AiOperatorTokenMode`.
- Đã gắn `tokenPolicy` vào route/context của AI Operator.
- `ad_group_profit_classification` chạy `mode = no_ai`.
- `ads_diagnostic_checklist` chạy `mode = no_ai`.
- Với `mode = no_ai`, backend không gọi OpenAI mà dùng deterministic renderer/fallback.
- `apiCatalog` chỉ được đưa vào OpenAI input khi `tokenPolicy.includeApiCatalog = true`, hiện áp dụng cho intent `api`.
- OpenAI input được chuyển sang object có cấu trúc: question, role, route, authorization, data, dataQuality, taskSummary, instructions.
- Context gửi model được lọc theo policy: bỏ apiCatalog, bỏ loaded source list, bỏ debug trace và giới hạn mảng dữ liệu theo `includeRawRowsLimit`.
- Có token usage object theo intent/workflow/model/mode; các lần gọi OpenAI được log bằng prefix `AI_OPERATOR_TOKEN_USAGE`.

## Policy chính

| Intent | Mode | Gọi OpenAI | API catalog | Raw rows limit |
|---|---|---:|---:|---:|
| `ad_group_profit_classification` | `no_ai` | Không | Không | 20 |
| `ads_diagnostic_checklist` | `no_ai` | Không | Không | 20 |
| `api` | `small_ai` | Có | Có | 0 |
| `token` | `small_ai` | Có | Không | 10 |
| Mặc định | `analysis_ai` | Có | Không | 10 |

## Test đã thêm

- Route câu hỏi “Có bao nhiêu nhóm quảng cáo...” phải vào `ad_group_profit_classification`.
- Route đó phải có `tokenPolicy.mode = no_ai`.
- Khi chat với intent `ad_group_profit_classification`, `tryAskOpenAI()` không được gọi.
- Response vẫn trả bảng phân loại bằng fallback.

## Phần chưa triển khai trong lượt này

- Chưa tạo dashboard thống kê token theo ngày/user/intent.
- Chưa thêm `TaskStore`, `ConversationSummary`, `LastResultRef`.
- Chưa tách service lớn thành các registry/workflow/context-builder file riêng.
- Chưa bổ sung các Business Summary API ngoài ads profit classification.
