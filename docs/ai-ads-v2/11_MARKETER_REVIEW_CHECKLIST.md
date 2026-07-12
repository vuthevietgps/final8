# 11 — Marketer Review Checklist

## 1. Trước khi upload lên ChatGPT Web

```text
[ ] Đã chọn đúng date range.
[ ] Data quality không có lỗi nghiêm trọng.
[ ] Có net_profit.
[ ] Có inventory.
[ ] Có change_log.
[ ] Có landing_pages.
[ ] Có order/profit attribution.
[ ] Có decision_rules.json.
[ ] Có expert_analysis_prompt.md.
```

## 2. Khi duyệt executive summary

```text
[ ] AI ưu tiên net_profit hơn revenue/ROAS.
[ ] AI không kết luận mạnh khi dữ liệu thiếu.
[ ] AI phân biệt campaign/ad group/keyword/RSA thắng thua rõ ràng.
[ ] AI có nêu rủi ro attribution.
[ ] AI có tự phản biện đề xuất.
```

## 3. Khi duyệt keyword

```text
[ ] Keyword đúng intent mua hàng.
[ ] Keyword không quá rộng.
[ ] Broad keyword có lý do rõ.
[ ] Có negative keyword nếu cần.
[ ] Match type hợp lý.
[ ] Không thêm quá nhiều keyword cùng lúc.
```

## 4. Khi duyệt RSA

```text
[ ] Có ít nhất 3 headline.
[ ] Có ít nhất 2 description.
[ ] Có final URL hợp lệ.
[ ] Không dùng câu quá cam kết.
[ ] Không dùng từ dễ vi phạm chính sách.
[ ] CTA rõ ràng.
[ ] Phù hợp landing page.
```

Ví dụ nên tránh:

```text
Cam kết 100% thành công
Nhanh nhất thị trường
Không cần điều kiện gì
Chắc chắn có giấy phép
```

Nên dùng:

```text
Tư vấn hồ sơ phù hợp
Hỗ trợ đúng quy trình
Trao đổi rõ chi phí và thời gian
Gọi để được tư vấn
```

## 5. Khi duyệt ngân sách

```text
[ ] Ngân sách/ngày không vượt policy.
[ ] Tăng ngân sách không vượt 20%/action.
[ ] Có đủ dữ liệu 3–7 ngày.
[ ] CPA/net_profit đủ tốt.
[ ] Sản phẩm/tồn kho đủ để scale.
```

## 6. Khi duyệt landing page

```text
[ ] Domain thuộc allowlist.
[ ] URL dùng HTTPS.
[ ] Nội dung khớp keyword.
[ ] CTA rõ.
[ ] Không cam kết quá mức.
[ ] Không sai chính sách.
```

## 7. Trước khi đưa file cho Codex

```text
[ ] Đã duyệt ý tưởng marketing.
[ ] File cuối tên ads_execution_plan.zip.
[ ] Mọi action approvalRequired=true.
[ ] Campaign mới status=PAUSED.
[ ] Không có delete action.
[ ] Không có auto_publish.
```

## 8. Trước khi execute

```text
[ ] ERP schema validation passed.
[ ] ERP business validation passed.
[ ] Provider validateOnly passed.
[ ] Người dùng chỉ định action ID rõ ràng.
[ ] Không execute toàn bộ plan nếu chưa cần.
[ ] Codex chỉ gọi ERP API.
```
