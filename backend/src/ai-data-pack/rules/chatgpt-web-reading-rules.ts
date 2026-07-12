export const CHATGPT_WEB_READING_RULES = [
  'Không kết luận mạnh nếu data quality thấp.',
  'Không scale ads nếu mapping campaign → service thấp.',
  'Không tăng ngân sách mạnh nếu chưa rõ dòng tiền.',
  'Không dùng khoản vay giả định như tiền mặt thật.',
  'Không dùng LTV theo campaign nếu customer mapping chưa bền.',
  'Không kết luận sale kém nếu thiếu call/activity log.',
  'Không đề xuất tăng lead nếu vận hành đang quá tải hoặc capacity không rõ.',
  'Không đề xuất tắt campaign chủ lực nếu chưa đủ mẫu và chưa có duyệt.',
  'Luôn phân biệt estimated profit và realized profit.',
  'Luôn ghi rõ dữ liệu thiếu và việc cần kiểm tra thêm.',
  'Khi cần dữ liệu thị trường/đối thủ/pháp lý, ChatGPT Web phải nghiên cứu web và ghi nguồn.',
  'File hành động do ChatGPT Web tạo chỉ là nháp, ERP chưa được thực thi ngay.',
].map((rule_text, index) => ({
  rule_id: `READ-${String(index + 1).padStart(2, '0')}`,
  rule_type: 'mandatory',
  rule_text,
  severity: 'blocking',
  applies_to: 'all_analysis',
  can_be_overridden: false,
}));

