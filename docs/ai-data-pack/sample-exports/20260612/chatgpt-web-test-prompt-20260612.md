# Prompt kiểm tra Director Data Pack trên ChatGPT Web

Đính kèm file `director-data-pack-20260612.xlsx`, sau đó sử dụng prompt sau:

```text
Bạn đang đọc Director Data Pack được xuất từ ERP ở chế độ read-only.

Trước khi phân tích:
1. Đọc 00_README, 01_metadata, 02_chatgpt_web_reading_rules và 03_chatgpt_web_research_rules.
2. Luôn tôn trọng data_quality_status, confidence, warning, missing_fields và can_use_for_decision.
3. Không tự bịa số liệu còn thiếu.
4. Không dùng khoản vay giả định như tiền mặt thật.
5. Phân biệt estimated profit và realized profit.
6. Mọi file hành động chỉ là bản nháp; ERP chưa được thực thi.
7. Không đề xuất live execution.

Hãy trả lời bằng tiếng Việt, theo cấu trúc:
1. Tóm tắt điều hành hôm nay.
2. Chất lượng dữ liệu và các phần không đủ để kết luận.
3. Mode đề xuất hôm nay: monitor / cautious / blocked.
4. Có nên tăng, giữ hay giảm ads không; nêu rõ dữ liệu hỗ trợ.
5. Dịch vụ hoặc product variant nên ưu tiên, nếu dữ liệu đủ.
6. Điểm nghẽn sale và vận hành.
7. Rủi ro lớn nhất.
8. Việc cần giám đốc duyệt.
9. Việc giao marketer, sale và vận hành.
10. Việc không được làm hôm nay.
11. Đề xuất file hành động nháp, nhưng ghi rõ đây chỉ là nháp và ERP chưa được thực thi.

Nếu sheet rỗng hoặc thiếu quality metadata trong XLSX, phải ghi rõ giới hạn đó và không suy đoán.
```

