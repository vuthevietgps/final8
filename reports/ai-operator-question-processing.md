# Cách AI Operator xử lý câu hỏi

Ngày cập nhật: 2026-06-10

Tài liệu chi tiết cho các nhóm câu hỏi điều hành nằm tại:

- `reports/ai-operator-executive-question-playbook.md`

## 1. Endpoint chính

```http
POST /api/ai-operator/chat
Authorization: Bearer <jwt>
Content-Type: application/json
```

Body:

```json
{
  "message": "Hôm nay công ty có vấn đề gì lớn?",
  "windowDays": 7,
  "role": "director",
  "intent": null,
  "scenarioId": null
}
```

## 2. Luồng xử lý

1. Controller yêu cầu JWT và permission `ai-assistant`.
2. Service route câu hỏi bằng `resolveContextRoute()`.
3. Nếu người dùng truyền `scenarioId` hoặc `intent` hợp lệ thì ưu tiên giá trị explicit.
4. Nếu không, service nhận diện keyword tiếng Việt và map sang intent chuyên biệt.
5. Service load ERP source tương ứng bằng `loadScenarioSources()`.
6. Permission được kiểm tra theo từng source. Source bị chặn sẽ được ghi `permission_denied`.
7. Context được compact bằng `compactScenarioContext()`, gồm route, data, API coverage, assistantQuality, dataQuality, decisionSupport và questionPlaybook.
8. Nếu token policy là `no_ai`, hệ thống dùng rule-based answer.
9. Nếu được phép gọi OpenAI, service gọi `https://api.openai.com/v1/responses` bằng OpenAI Config có `purpose = admin-assistant`.
10. Nếu OpenAI lỗi hoặc không có key hợp lệ, fallback deterministic được dùng.

## 3. Intent trọng tâm hiện có

| Nhóm | Intent |
|---|---|
| Tổng quan điều hành | `director_daily_overview`, `business_risk_ranking`, `decision_waiting_approval`, `company_kpi_scorecard`, `root_cause_analysis`, `anomaly_detection_daily`, `priority_ranking`, `owner_accountability_review`, `target_gap_analysis`, `period_comparison`, `ai_recommendation_review`, `concise_role_briefing` |
| CFO/dòng tiền | `finance`, `free_cash_summary`, `cashflow_forecast`, `ads_budget_cashflow_gate`, `advanced_cashflow_scenario`, `scenario_analysis`, `owner_withdrawal_readiness`, `supplier_payment_priority`, `receivables_collection_priority`, `double_payment_risk`, `unit_economics` |
| Ads/marketing | `ads`, `ad_group_profit_classification`, `ads_diagnostic_checklist`, `marketing_funnel_health`, `creative_fatigue_review`, `offer_performance_review`, `channel_mix_review`, `channel_profitability_review`, `resource_allocation_decision`, `product_decision_review`, `ads_scale_readiness`, `ads_kill_or_pause_recommendation`, `lead_quality_by_campaign`, `attribution_quality_check` |
| Sale/lead | `sales`, `customer_value_analysis`, `lead_followup_health`, `sales_conversion_by_user`, `lead_quality_by_source`, `lost_reason_summary`, `sales_sla_violation`, `sales_sla_task_creation`, `quote_readiness` |
| Đơn hàng/vận hành | `orders`, `late_order_diagnostic`, `fulfillment_bottleneck`, `tracking_issue_check`, `cancel_refund_risk`, `supplier_delay_risk`, `operations` |
| Business facts | `product_count`, `product_list`, `product_profit_leaderboard`, `fanpage_performance_lookup`, `chatbot_fanpage_performance_lookup`, `agent_revenue_leaderboard`, `agent_profit_leaderboard`, `ads_product_profit_leaderboard`, `product_ads_revenue_ratio` |
| Tích hợp/token | `token`, `token_health_check`, `fanpage_permission_check`, `platform_sync_health`, `openai_config_health`, `webhook_failure_diagnostic` |
| Khác | `api`, `supplier`, `overview`, `loose` |

## 4. Các route mới được ưu tiên

Các câu hỏi sau đã được route trực tiếp để không rơi về `loose`:

- “Hôm nay công ty có vấn đề gì lớn?” -> `business_risk_ranking`
- “Có việc gì cần tôi xử lý hôm nay?” -> `director_daily_overview`
- “Hôm qua doanh thu/lợi nhuận bao nhiêu?” -> `company_kpi_scorecard`
- “Tháng này doanh thu đạt bao nhiêu phần trăm mục tiêu?” -> `target_gap_analysis`
- “Có đủ tiền chi 7 ngày tới không?” -> `cashflow_forecast`
- “Camp nào đang đốt tiền?” -> `ads_kill_or_pause_recommendation`
- “Có nên tăng ngân sách nhóm nào không?” -> `ads_scale_readiness`
- “Lead nào chưa xử lý?” -> `lead_followup_health`
- “Sale nào phản hồi chậm?” -> `sales_sla_violation`
- “Nguồn lead nào chất lượng nhất?” -> `lead_quality_by_source`
- “Có bao nhiêu đơn đang trễ?” -> `late_order_diagnostic`
- “Đơn trễ vì lý do gì?” -> `late_order_diagnostic`
- “Công nợ nào cần thu ngay?” -> `receivables_collection_priority`
- “Facebook hay Google hiệu quả hơn?” -> `channel_mix_review`
- “Có việc gì đang chờ tôi duyệt?” -> `decision_waiting_approval`

Các route phân tích bổ sung:

- “Vì sao doanh thu tăng nhưng lợi nhuận không tăng?” -> `root_cause_analysis`
- “Vì sao lead tăng nhưng đơn không tăng?” -> `root_cause_analysis`
- “Hôm nay có gì bất thường không?” -> `anomaly_detection_daily`
- “Nếu chỉ xử lý 3 việc hôm nay thì là việc gì?” -> `priority_ranking`
- “Việc nào ảnh hưởng tiền nhiều nhất?” -> `priority_ranking`
- “Ai đang xử lý việc chậm nhất?” -> `owner_accountability_review`
- “Bộ phận nào đang kéo lùi kết quả?” -> `owner_accountability_review`
- “Kênh nào mang lại lợi nhuận tốt nhất?” -> `channel_profitability_review`
- “Sản phẩm nào bán nhiều nhưng lãi thấp?” -> `product_decision_review`
- “Sản phẩm nào nên đẩy mạnh?” -> `product_decision_review`
- “Sản phẩm nào nên dừng?” -> `product_decision_review`
- “Khách hàng nào có giá trị cao nhất?” -> `customer_value_analysis`
- “Khách nào cần chăm sóc lại?” -> `customer_value_analysis`
- “Tiền đang kẹt ở đâu?” -> `advanced_cashflow_scenario`
- “Nếu tăng ads thêm 1 triệu/ngày thì dòng tiền có chịu được không?” -> `ads_budget_cashflow_gate`
- “Tháng này có đạt mục tiêu không?” -> `target_gap_analysis`
- “Cần bao nhiêu đơn/ngày để đạt mục tiêu?” -> `target_gap_analysis`
- “Tuần này so với tuần trước tốt lên hay xấu đi?” -> `period_comparison`
- “Sau khi chỉnh ads hôm qua kết quả thế nào?” -> `ai_recommendation_review`
- “Hôm qua AI đề xuất gì và đã làm được gì?” -> `ai_recommendation_review`

## 5. Response contract

| Intent/nhóm | Contract |
|---|---|
| Tổng quan/KPI/risk/root-cause/anomaly/priority/owner/target/period/customer/briefing | `executiveSummary` |
| CFO/dòng tiền/scenario | `cfoDecision` |
| Ads/marketing optimization/kênh/sản phẩm/nguồn lực | `marketingOptimization` |
| Việc chờ duyệt/task draft/hậu kiểm AI | `actionApproval` |
| Phân loại lãi/lỗ nhóm ads | `adGroupProfitTable` |
| Checklist ads | `adsDiagnosticChecklist` |
| Business facts | `businessFacts` |
| Hỏi API | `apiExplanation` |

## 6. Dữ liệu mới trong context

`business-facts` đã có thêm:

- `productProfit.today`
- `productProfit.yesterday`
- `productProfit.monthToDate`

Các phần này giúp trả lời câu hỏi “hôm nay”, “hôm qua”, “tháng này” mà không phụ thuộc vào `windowDays` mặc định.

Các intent phân tích mới dùng thêm:

- Baseline so sánh hôm qua, 7 ngày và 30 ngày cho `root_cause_analysis`, `anomaly_detection_daily`, `period_comparison`.
- Target config cho `target_gap_analysis`; nếu thiếu target, AI chỉ trả actual và gap dữ liệu.
- Finance gate, budget preview và forecast cho `advanced_cashflow_scenario`, `ads_budget_cashflow_gate`, `scenario_analysis`.
- Audit log recommendation/approval/executor cho `ai_recommendation_review`; nếu thiếu log, AI không được nói đề xuất đã được thực hiện.
- CRM/segment/consent cho `customer_value_analysis`; nếu thiếu, AI dùng order/conversation/source làm proxy và phải nói rõ.
- Capacity/task owner/SLA cho `owner_accountability_review` và `resource_allocation_decision`.

## 7. Guardrail

- AI Operator mặc định read-only.
- Mọi hành động thật phải đi qua draft action, approval request, executor và audit log.
- Không hiển thị full secret/token/API key.
- Nếu thiếu API hoặc dataQuality thấp, AI phải nói rõ thiếu nguồn nào và không kết luận chắc.
