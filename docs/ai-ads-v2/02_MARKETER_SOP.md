# 02 — Marketer SOP

## 1. Mục tiêu

Marketer không cần thao tác trực tiếp trong Google Ads hoặc nhiều màn hình ERP. Marketer làm việc chủ yếu qua Codex và ChatGPT Web.

## 2. Quy trình làm việc chuẩn

### Bước 1 — Yêu cầu Codex tải dữ liệu ads

Prompt:

```text
Tải dữ liệu Google Ads còn sống trong 14 ngày gần nhất từ ERP để tôi đưa lên ChatGPT Web phân tích.
```

Codex phải trả:

```text
- exportId
- file path của ads_live_export.zip
- ngày bắt đầu/kết thúc
- số campaign/ad group/keyword/RSA
- cảnh báo data quality nếu có
```

### Bước 2 — Upload lên ChatGPT Web

Upload file:

```text
ads_live_export_<exportId>.zip
```

Prompt ngắn:

```text
Hãy đọc file tôi upload. Trong file có expert_analysis_prompt.md. Hãy phân tích đúng trình tự và xuất ads_execution_plan.zip để tôi đưa cho Codex thực thi qua ERP.
```

### Bước 3 — Duyệt ý tưởng trong ChatGPT Web

Marketer phải xem:

```text
executive_summary.md
human_review_checklist.md
creative_variants.csv
keyword_plan.csv
risk_register.md
rollback_plan.md
action_plan.json
```

Cần kiểm tra:

- Chiến lược có đúng mục tiêu kinh doanh không.
- Sản phẩm có đủ tồn kho không.
- Keyword có đúng intent mua hàng không.
- RSA có quá cam kết không.
- Landing page có đúng domain và đúng nội dung không.
- Budget có vượt policy không.
- Campaign mới có `PAUSED` không.
- Action rủi ro cao có nên đổi thành `monitor_only` không.

### Bước 4 — Yêu cầu ChatGPT Web xuất file cuối

Prompt:

```text
Tôi duyệt bản này. Hãy xuất ads_execution_plan.zip bản cuối cùng, mọi action để approvalRequired=true và executionMode=pending_approval.
```

### Bước 5 — Đưa file cho Codex import vào ERP

Prompt:

```text
Đây là file ads_execution_plan.zip tôi đã duyệt ý tưởng trên ChatGPT Web.
Hãy import vào ERP, validate schema, validate business rules, chạy provider validateOnly và tạo pending actions. Chưa execute live.
```

### Bước 6 — Duyệt và execute qua Codex

Không nói:

```text
Duyệt hết và chạy hết.
```

Nên nói rõ:

```text
Duyệt và thực thi ACT001, ACT002. Các action còn lại để pending.
```

Sau execute, yêu cầu Codex báo:

```text
- action nào thành công
- action nào lỗi
- provider request ID
- campaign/ad group/keyword/RSA đã tạo
- campaign mới có PAUSED không
- ERP đã sync lại chưa
- khi nào đánh giá sau 3/7 ngày
```

## 3. Tần suất vận hành

### Hằng ngày

- Kiểm tra ads lỗ, CPA tăng, đơn hủy/hoàn.
- Ghi `business_daily_notes` nếu có bất thường.
- Kiểm tra action hôm qua có lỗi không.
- Kiểm tra campaign mới có đúng trạng thái không.

### Mỗi 2–3 ngày

- Tải dữ liệu 7–14 ngày bằng Codex.
- Đưa lên ChatGPT Web phân tích.
- Chỉ duyệt action có evidence đủ.

### Hằng tuần

- Tổng kết keyword thắng/thua.
- Tổng kết RSA/headline/description thắng/thua.
- Cập nhật negative keyword.
- Cập nhật decision rules.
- Đánh giá action sau 3/7 ngày.

## 4. Không nên làm

- Không scale chỉ vì ROAS cao.
- Không bỏ qua `net_profit`.
- Không chạy campaign mới ở `ENABLED` ngay.
- Không dùng quá nhiều broad keyword ở MVP.
- Không duyệt nội dung quá cam kết.
- Không execute nếu provider validateOnly failed.
- Không để Codex gọi trực tiếp Google Ads API.
