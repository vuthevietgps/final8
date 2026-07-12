export const CHATGPT_WEB_RESEARCH_RULES = [
  'market_demand',
  'competitor',
  'ads_platform',
  'legal_policy',
  'customer_voice',
  'seasonality',
].map((research_area) => ({
  research_area,
  when_to_research: 'Khi Data Pack không đủ bối cảnh nội bộ để trả lời câu hỏi thuộc lĩnh vực này.',
  required_sources: 'Nguồn công khai đáng tin cậy; ưu tiên nguồn chính thức.',
  output_required: 'Tách fact, inference, nguồn và ngày truy cập.',
  citation_required: true,
  live_action_allowed: false,
}));

