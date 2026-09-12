# AI Operator Executive Question Playbook

Ngày cập nhật: 2026-06-10

Tài liệu này là bản hướng dẫn chuẩn để Trợ lý AI trả lời các câu hỏi điều hành, tài chính, ads, sale, vận hành và phê duyệt. Nguồn triển khai chính:

- `backend/src/ai-operator/ai-operator.service.ts`
- `backend/src/ai-operator/ai-operator.knowledge.ts`
- `backend/src/ai-operator/ai-operator.v2-registry.ts`
- Endpoint chat: `POST /api/ai-operator/chat`

## 1. Luồng gọi AI Operator

Frontend hoặc client gọi:

```http
POST /api/ai-operator/chat
Authorization: Bearer <jwt>
Content-Type: application/json
```

Body đề xuất:

```json
{
  "message": "Hôm nay công ty có vấn đề gì lớn?",
  "windowDays": 7,
  "role": "director"
}
```

Backend xử lý theo thứ tự:

1. Kiểm tra JWT và permission `ai-assistant`.
2. Route câu hỏi sang `intent` và `scenarioWorkflow`.
3. Load các ERP source tương ứng với intent.
4. Kiểm tra permission từng source.
5. Tạo context compact gồm finance, ads, orders, receivables, operations, businessFacts, dataQuality, decisionSupport và questionPlaybook.
6. Nếu token policy là `no_ai` thì dùng rule-based answer.
7. Nếu được phép gọi OpenAI thì gửi snapshot đã compact sang model `admin-assistant`.
8. Nếu OpenAI lỗi/key thiếu/quota lỗi thì fallback deterministic.
9. Trả answer, route, context, recommendations, assistantQuality, agentTrace.

## 2. Nguyên tắc trả lời

Với câu hỏi số liệu, AI phải trả con số trước, sau đó nêu nguồn tính và cảnh báo thiếu dữ liệu.

Ví dụ:

- `Hôm qua doanh thu/lợi nhuận bao nhiêu?`
- Trả: doanh thu, lợi nhuận, số đơn hoàn tất, kỳ dữ liệu, nguồn `business-facts`/`test-order2`.

Với câu hỏi chẩn đoán, AI trả theo cấu trúc:

1. Kết luận ngắn.
2. Dữ liệu đã đọc.
3. Nguyên nhân khả nghi.
4. Việc cần làm ngay.
5. Rủi ro/thiếu dữ liệu.
6. Việc cần duyệt.

Với câu hỏi phê duyệt hoặc hành động, AI không được nói đã thực hiện. Chỉ được nói `draft`, `waiting_approval`, `needs_review`, hoặc `blocked` nếu chưa có executor/audit log xác nhận.

## 3. Bản đồ nhóm câu hỏi

| Nhóm | Intent chính | ERP API cần đọc | Cách phân tích | Cách trả lời |
|---|---|---|---|---|
| Tổng quan đầu ngày | `director_daily_overview`, `business_risk_ranking`, `decision_waiting_approval`, `company_kpi_scorecard` | `GET /api/financial-control/dashboard`, `GET /api/financial-control/forecast`, `GET /api/financial-control/actions`, `GET /api/ads-alerts`, `GET /api/test-order2`, `GET /api/supplier-payables/summary/cashflow`, `GET /api/agent-payables/summary/cashflow`, `GET /api/ops-actions/suggestions` | Xếp hạng finance, ads, order, công nợ, token/sync, ops theo mức độ ảnh hưởng. | Kết luận tình hình, top vấn đề, owner/module, việc cần làm, việc cần duyệt. |
| Doanh thu/lợi nhuận | `company_kpi_scorecard`, `product_profit_leaderboard`, `unit_economics`, `channel_mix_review` | `GET /api/test-order2/daily-profit-report`, `GET /api/test-order2/product-profit-report`, `GET /api/ads/ad-groups/profit-classification?days=7`, `GET /api/ad-group-profit-report/performance` | Tính theo đơn hoàn tất; tách revenue, gross profit, net profit, profit after ads. | Trả số liệu hôm nay/hôm qua/tháng này, top sản phẩm/kênh, thiếu target nếu chưa có mục tiêu. |
| Ads/marketing | `ads`, `ad_group_profit_classification`, `ads_scale_readiness`, `ads_kill_or_pause_recommendation`, `marketing_funnel_health`, `creative_fatigue_review`, `channel_mix_review` | `GET /api/ads-alerts`, `GET /api/ads/ad-groups/profit-classification?days=7`, `GET /api/ad-group-profit-report/performance`, `GET /api/ad-group-profit-report/optimal-spend`, `GET /api/advertising-cost/stats/summary`, `GET /api/advertising-cost/stats/by-adgroup`, `GET /api/advertising-cost/sync/health`, `GET /api/ai-marketing/leads/funnel`, `GET /api/ai-marketing/creatives/performance`, `GET /api/budget-allocation/preview` | Đối chiếu spend, lead, order, revenue, net profit after ads, sync, attribution, cashflow gate. | Với lãi/lỗ phải có bảng nhóm ads; với scale/pause phải có finance gate và approval. |
| Sale/lead | `lead_followup_health`, `sales_sla_violation`, `sales_conversion_by_user`, `lead_quality_by_source`, `marketing_funnel_health` | `GET /api/ai-marketing/leads/funnel`, `GET /api/chat-messages/conversations/list/all`, `GET /api/pending-orders`, `GET /api/test-order2`, `GET /api/ops-actions/suggestions` | Lead hiện suy từ ai-marketing, conversation, pending order và order. Tính SLA, lead chưa xử lý, tỷ lệ chốt, nguồn lead. | Danh sách lead/sale/source cần xử lý, lý do, deadline đề xuất, task draft nếu cần. |
| Đơn hàng/vận hành | `orders`, `late_order_diagnostic`, `fulfillment_bottleneck`, `tracking_issue_check`, `cancel_refund_risk` | `GET /api/test-order2`, `GET /api/order-status`, `GET /api/production-status`, `GET /api/delivery-status`, `GET /api/chat-messages/conversations/list/all`, `GET /api/return-report/product` | Đếm đơn mới/trễ/thếu tracking; gán nghẽn theo sale, kho/sản xuất, giao hàng, supplier. | Trả số lượng trước, sau đó top đơn cần xử lý, lý do trễ, owner. |
| Dòng tiền/CFO | `finance`, `free_cash_summary`, `cashflow_forecast`, `ads_budget_cashflow_gate`, `owner_withdrawal_readiness`, `double_payment_risk` | `GET /api/financial-control/dashboard`, `GET /api/financial-control/forecast`, `GET /api/finance/available-funds/current`, `GET /api/finance/cashflow-health`, `GET /api/finance/repayments/upcoming`, `GET /api/supplier-payables/summary/cashflow`, `GET /api/agent-payables/summary/cashflow`, `GET /api/budget-allocation/preview` | Tính free cash, committed cash, forecast low point, survival floor, upcoming payments. | Trả `cashStatus`, free cash, allowedActions, blockedActions, payment priorities. |
| Công nợ | `receivables`, `receivables_collection_priority`, `supplier_payment_priority` | `GET /api/supplier-payables/statements`, `GET /api/supplier-payables/summary/cashflow`, `GET /api/agent-payables/summary/cashflow`, `GET /api/agent-receivables/summary`, `GET /api/test-order2/payment-pending/supplier`, `GET /api/test-order2/payment-pending/agent` | Tính open balance, overdue, aging, due date, cashflow impact. | Top khoản cần thu/trả, số ngày quá hạn, số tiền, hành động đề xuất. |
| Sản phẩm/tồn kho | `product_profit_leaderboard`, `ads_product_profit_leaderboard`, `unit_economics`, `offer_performance_review` | `GET /api/products`, `GET /api/test-order2/product-profit-report`, `GET /api/return-report/product`, `GET /api/ads/ad-groups/profit-classification?days=7` | Xếp theo orders, revenue, net profit, margin, return/cancel rate. | Bảng sản phẩm bán chạy/lãi/lỗ; nếu hỏi tồn kho thì nói rõ thiếu inventory realtime nếu chưa có API. |
| Nhân sự/hiệu suất | `operations`, `sales_sla_violation`, `sales_conversion_by_user`, `lead_followup_health` | `GET /api/ops-actions/suggestions`, `GET /api/employee-ads-kpi`, `GET /api/chat-messages/conversations/list/all`, `GET /api/test-order2` | Đối chiếu workload, task, SLA, KPI. | Nêu người/bộ phận cần nhắc theo metric; không kết luận kỷ luật nếu dữ liệu thiếu. |
| Khách hàng | `sales`, `lead_quality_by_source`, `marketing_funnel_health` | `GET /api/customers`, `GET /api/test-order2`, `GET /api/chat-messages/conversations/list/all`, `GET /api/ai-marketing/leads/funnel` | Tính LTV/revenue/profit/recency và complaint signal. | Danh sách khách cần chăm sóc/remarketing, nguồn lợi nhuận, cảnh báo thiếu CRM consent/segment. |
| Hệ thống/tích hợp | `token_health_check`, `fanpage_permission_check`, `platform_sync_health`, `openai_config_health`, `webhook_failure_diagnostic` | `GET /api/api-tokens`, `GET /api/api-tokens/settings`, `GET /api/fanpages`, `GET /api/advertising-cost/sync/health`, `GET /api/openai-configs`, `GET /api/chat-messages/events` | Kiểm token expired/failing, fanpage disconnected, sync stale/fail, webhook/OpenAI issue. | Trả theo platform/source, không hiển thị full token/API key. |
| Quyết định cần duyệt | `decision_waiting_approval` | `GET /api/financial-control/actions`, `GET /api/ai-marketing/plans`, `GET /api/ai-marketing/actions/evaluations`, `GET /api/ops-actions/suggestions`, `GET /api/supplier-payables/statements`, `GET /api/test-order2` | Gom mọi suggestion/plan/action có `approvalRequired` hoặc trạng thái chờ. | Bảng việc chờ duyệt: module, lý do, tác động, deadline, phê duyệt gì. |

## 3.1. Nhóm phân tích bổ sung

| Nhóm | Intent chính | ERP API cần đọc | Cách phân tích | Cách trả lời |
|---|---|---|---|---|
| Phân tích vì sao | `root_cause_analysis` | daily/product profit, ad-group performance, lead funnel, conversations, finance dashboard | Tách metric bị lệch rồi so driver: volume, margin, ads spend, conversion, refund/cancel, collection timing. | Kết luận, 3 nguyên nhân khả nghi, bằng chứng, việc cần làm, dữ liệu thiếu. |
| Bất thường trong ngày | `anomaly_detection_daily` | daily profit, ads cost, ads alerts, employee KPI, sync health | So hôm nay với hôm qua, 7 ngày và 30 ngày nếu có baseline. | Nói có/không có bất thường, mức ảnh hưởng tiền, owner/module. |
| Xếp hạng ưu tiên | `priority_ranking` | finance actions, ads alerts, orders, receivables, ops suggestions | Chấm impact tiền, urgency, customer impact, operational impact, approval need. | Top 3-5 việc phải xử lý, owner, next step, cần duyệt hay không. |
| Tăng/giảm nguồn lực | `resource_allocation_decision` | budget preview, forecast, optimal spend, product profit, employee KPI | Kiểm demand, capacity, margin và cash gate trước khi tăng người/ads/hàng. | `allow/hold/block`, lý do, điều kiện dừng, approval. |
| Owner/accountability | `owner_accountability_review` | employee KPI, ops actions, conversations, orders | Đối chiếu SLA, backlog, overdue, owner field và KPI. | Nêu người/bộ phận theo metric; nếu thiếu owner thì trả theo module. |
| Lợi nhuận theo kênh | `channel_profitability_review` | ad-group performance, profit classification, lead funnel, orders | Nhóm theo platform/source/fanpage/ad group; tính spend, order, revenue, profit after ads. | Bảng kênh, lãi/lỗ, độ tin cậy attribution, đề xuất draft. |
| Quyết định sản phẩm | `product_decision_review` | products, product-profit-report, returns, ad-group performance, ai-marketing | Xếp theo order, revenue, net profit, margin, return/cancel, stock/media readiness. | Phân loại đẩy mạnh/giữ/sửa offer/dừng nhập/dừng ads. |
| Giá trị khách hàng | `customer_value_analysis` | customers, orders, conversations, lead funnel | Tính revenue, profit, order count, recency, complaint và source. | Top khách/tệp cần chăm sóc/remarketing, không gửi tự động. |
| Dòng tiền nâng cao | `advanced_cashflow_scenario` | finance dashboard/forecast, available funds, payables, budget preview, optimal spend | Tách tiền mặt, công nợ, tồn kho, order chưa thu, committed cash, payment timing. | cashStatus, freeCash, lowPoint, tiền kẹt ở đâu, allowed/blocked actions. |
| Xếp hạng rủi ro | `business_risk_ranking`, `priority_ranking` | finance actions, ads alerts, orders, api tokens, sync health, ops | Chấm severity theo financial impact, likelihood, urgency, owner. | Top risk, tác động, owner, hành động giảm rủi ro. |
| Mục tiêu/gap | `target_gap_analysis` | MTD business facts, daily profit, finance dashboard, ai-marketing, target config nếu có | Tính actual, target, gap, required daily run-rate và driver cần cải thiện. | Nếu thiếu target thì nói rõ; nếu có target thì trả gap và đơn/doanh thu cần mỗi ngày. |
| So sánh kỳ | `period_comparison` | daily profit history, ads performance, finance dashboard, ai-marketing | So hai kỳ đúng theo câu hỏi; tính delta absolute và percent. | Nói tốt lên/xấu đi theo từng metric, không gộp khi metric trái chiều. |
| Nếu-thì | `scenario_analysis` | product profit, forecast, budget preview, employee KPI, products | Tách số liệu thật với giả định; tính base/best/worst case nếu đủ dữ liệu. | Trả giả định, công thức, kết quả ước tính, không coi là forecast chắc chắn. |
| Hậu kiểm đề xuất AI | `ai_recommendation_review` | ai-marketing evaluations/plans, financial actions, ops suggestions, ad performance | So recommendation, approval/execution status và metric before/after. | Đã làm/chưa làm/chờ duyệt/cần sửa playbook; không nói executed nếu thiếu audit. |
| Tóm tắt theo vai trò | `concise_role_briefing` | finance dashboard, ads alerts, orders, ops, api tokens | Lọc theo role và giữ top issue/action, không bỏ qua critical risk. | Tối đa 3-5 dòng nếu user yêu cầu ngắn, mỗi dòng có số liệu hoặc hành động. |

## 4. Mapping 20 câu hỏi trọng tâm

| Câu hỏi | Intent | API/source chính | Phân tích cần làm | Response bắt buộc |
|---|---|---|---|---|
| Hôm nay công ty có vấn đề gì lớn? | `business_risk_ranking` | finance dashboard/forecast, ads alerts, orders, receivables, ops | Xếp hạng top risk theo finance impact, customer impact, urgency. | Kết luận tình hình và top 3-7 vấn đề. |
| Có việc gì cần tôi xử lý hôm nay? | `director_daily_overview` | finance, ads, orders, ops, receivables | Lọc việc ảnh hưởng hôm nay và có owner rõ. | Danh sách ưu tiên, owner, deadline đề xuất. |
| Hôm qua doanh thu/lợi nhuận bao nhiêu? | `company_kpi_scorecard` | `business-facts.productProfit.yesterday`, `GET /api/test-order2/product-profit-report` | Tính revenue/net profit từ đơn hoàn tất ngày hôm qua. | Trả doanh thu, lợi nhuận, số đơn, nguồn tính. |
| Tháng này doanh thu đạt bao nhiêu phần trăm mục tiêu? | `target_gap_analysis` | `business-facts.productProfit.monthToDate`, target config nếu có | So actual MTD với target tháng. | Nếu thiếu target, trả actual MTD và nói thiếu target. |
| Dòng tiền có an toàn không? | `finance` | financial-control dashboard/forecast, available funds | Tính cashStatus bằng free cash, committed cash, forecast low point. | `safe/watch/tight/danger`, lý do. |
| Tiền tự do còn bao nhiêu? | `free_cash_summary` | `GET /api/financial-control/dashboard`, `GET /api/finance/available-funds/current` | Lấy free cash/conservative available, trừ reserve/committed. | Trả freeCash trước, sau đó caveat. |
| Có đủ tiền chi 7 ngày tới không? | `cashflow_forecast` | financial-control forecast, cashflow health, upcoming repayments/payables | So low point 7 ngày với 0/survival floor. | Đủ/không đủ, khoản làm căng dòng tiền. |
| Ads hôm nay có vấn đề gì không? | `ads` | ads alerts, profit report, sync health, cost per order | Tìm alert critical, no-order spend, sync fail, loss group. | Kết luận, top vấn đề ads, action đề xuất. |
| Nhóm quảng cáo nào lãi nhất? | `ad_group_profit_classification` | `GET /api/ads/ad-groups/profit-classification?days=7` | Sort nhóm `profitable` theo netProfitAfterAds. | Bảng nhóm, spend, lead, đơn, revenue, profit. |
| Nhóm quảng cáo nào đang lỗ? | `ad_group_profit_classification` | cùng API trên | Lọc `status=loss`, ưu tiên spend cao/lỗ nặng. | Bảng nhóm lỗ và lý do. |
| Camp nào đang đốt tiền? | `ads_kill_or_pause_recommendation` | profit classification, cost by adgroup, CPO | Lọc spend cao, không đơn hoặc net profit âm. | Pause/kill candidates, không tự tắt. |
| Có nên tăng ngân sách nhóm nào không? | `ads_scale_readiness` | optimal spend, profit classification, budget preview | Kiểm profit, orders, attribution quality, cashflow gate. | Scale candidates, mức đề xuất nếu có, cần duyệt. |
| Lead nào chưa xử lý? | `lead_followup_health` | ai-marketing leads, chat conversations, pending orders | Lọc needsHuman/awaitingOrder/lead quá SLA. | Danh sách lead cần gọi ngay, owner đề xuất. |
| Sale nào phản hồi chậm? | `sales_sla_violation` | chat conversations, pending orders, ops actions | Tính first response/last response/SLA proxy. | Sale, số lead trễ, mức độ, task draft nếu cần. |
| Nguồn lead nào chất lượng nhất? | `lead_quality_by_source` | lead funnel, orders, ads attribution | So lead-to-order, revenue/profit theo source. | Top nguồn lead và nguồn nhiều nhưng không ra đơn. |
| Có bao nhiêu đơn đang trễ? | `late_order_diagnostic` | orders, order/production/delivery status | Đếm đơn trễ theo status/deadline proxy. | Số đơn trễ, top đơn trễ lâu nhất. |
| Đơn trễ vì lý do gì? | `late_order_diagnostic` | orders, status, delivery, supplier signal | Phân loại lý do: sale, kho/sản xuất, giao hàng, NCC, tracking. | Lý do chính, số đơn từng lý do, owner. |
| Công nợ nào cần thu ngay? | `receivables_collection_priority` | supplier/agent statements, pending payments | Xếp khoản theo quá hạn, số tiền, risk. | Top khoản cần thu/trả ngay, số tiền, ngày quá hạn. |
| Sản phẩm nào lãi nhất? | `product_profit_leaderboard` | `business-facts.productProfit.week/month`, product-profit-report | Sort net profit/margin/orders. | Top sản phẩm, revenue, profit, margin, đơn. |
| Có việc gì đang chờ tôi duyệt? | `decision_waiting_approval` | financial actions, ai-marketing plans/evaluations, ops suggestions | Gom action có approvalRequired/waiting. | Bảng việc chờ duyệt, impact, required approval. |

## 4.1. Mapping 20 câu hỏi phân tích bổ sung

| Câu hỏi | Intent | API/source chính | Phân tích cần làm | Response bắt buộc |
|---|---|---|---|---|
| Vì sao doanh thu tăng nhưng lợi nhuận không tăng? | `root_cause_analysis` | daily/product profit, ads performance, returns | So revenue, gross/net margin, ads spend, COGS, refund/cancel. | Nêu 3 nguyên nhân chính và bằng chứng từng nguyên nhân. |
| Vì sao lead tăng nhưng đơn không tăng? | `root_cause_analysis` | lead funnel, conversations, pending orders, orders | So lead -> conversation -> quote/order, sales SLA và lead quality. | Tách lỗi ads/lead quality với lỗi sale follow-up. |
| Hôm nay có gì bất thường không? | `anomaly_detection_daily` | daily profit, ads alerts, cost by ad group, employee KPI | So với hôm qua/7d/30d, lọc delta lớn và impact tiền. | Có/không có bất thường, mức độ, owner/module. |
| Nếu chỉ xử lý 3 việc hôm nay thì là việc gì? | `priority_ranking` | finance actions, ads alerts, orders, ops | Xếp theo impact tiền và urgency. | Top 3 việc, lý do, next action. |
| Việc nào ảnh hưởng tiền nhiều nhất? | `priority_ranking` | finance, ads loss, receivables, late orders | Ước tính financial impact và confidence. | Việc số 1 trước, kèm số tiền nếu có. |
| Ai đang xử lý việc chậm nhất? | `owner_accountability_review` | employee KPI, conversations, ops actions, orders | Tính SLA/backlog/overdue theo owner. | Nêu metric, không quy trách nhiệm nếu thiếu dữ liệu. |
| Bộ phận nào đang kéo lùi kết quả? | `owner_accountability_review` | employee KPI, orders, lead funnel, ads | So KPI/throughput theo bộ phận. | Bộ phận, metric kéo lùi, hành động hỗ trợ. |
| Kênh nào mang lại lợi nhuận tốt nhất? | `channel_profitability_review` | ad-group performance, orders, lead funnel | Tính profit after ads theo kênh/source. | Bảng kênh và độ tin cậy attribution. |
| Sản phẩm nào bán nhiều nhưng lãi thấp? | `product_decision_review` | product-profit-report, returns, ads performance | Lọc order/revenue cao nhưng margin/net profit thấp. | Danh sách sản phẩm, lý do, đề xuất sửa offer/giá/ads. |
| Sản phẩm nào nên đẩy mạnh? | `product_decision_review` | product profit, stock/media readiness, ads profit | Chọn sản phẩm margin tốt, stock đủ, return thấp. | Danh sách ứng viên và điều kiện scale. |
| Sản phẩm nào nên dừng? | `product_decision_review` | product profit, returns, ads loss | Lọc sản phẩm lỗ, hoàn/hủy cao, stock/media/cash risk. | Đề xuất dừng nhập/dừng ads ở trạng thái draft. |
| Khách hàng nào có giá trị cao nhất? | `customer_value_analysis` | customers, orders, conversations | Tính revenue/profit/order count/recency. | Top khách theo giá trị, không lộ PII quá quyền. |
| Khách nào cần chăm sóc lại? | `customer_value_analysis` | orders, conversations, lead funnel | Lọc recency lâu, complaint, high value, abandoned intent. | Danh sách chăm sóc lại và lý do. |
| Tiền đang kẹt ở đâu? | `advanced_cashflow_scenario` | finance dashboard, receivables/payables, orders, inventory proxy | Tách cash, receivables, inventory, order chưa thu, committed cash. | Vị trí tiền kẹt, số tiền nếu có, việc gỡ. |
| Nếu tăng ads thêm 1 triệu/ngày thì dòng tiền có chịu được không? | `ads_budget_cashflow_gate` | budget preview, forecast, optimal spend, ads profit | Chạy cash gate với proposed increase. | `allow/hold/block`, freeCash, lowPoint, cần duyệt. |
| Tháng này có đạt mục tiêu không? | `target_gap_analysis` | MTD actual, target config | So actual với target và tốc độ hiện tại. | Đạt/khó đạt/chưa đủ target data, gap. |
| Cần bao nhiêu đơn/ngày để đạt mục tiêu? | `target_gap_analysis` | MTD actual, target, product/order AOV | Tính required orders/day hoặc revenue/day. | Công thức và con số cần mỗi ngày nếu đủ target. |
| Tuần này so với tuần trước tốt lên hay xấu đi? | `period_comparison` | daily profit history, ads/orders/sales | Tính delta revenue, profit, spend, orders, conversion. | Kết luận theo từng metric, không gộp chung. |
| Sau khi chỉnh ads hôm qua kết quả thế nào? | `ai_recommendation_review` | ai evaluations/plans, ad performance before/after | So before/after và execution log. | Kết quả, đã/chưa thực hiện, dữ liệu thiếu. |
| Hôm qua AI đề xuất gì và đã làm được gì? | `ai_recommendation_review` | ai recommendations, approvals, executor audit | Gom đề xuất, trạng thái approval/execution, outcome. | Danh sách đề xuất, status, không nói đã làm nếu thiếu audit. |

## 5. Các điểm thiếu API/dữ liệu cần ghi rõ trong câu trả lời

- Target doanh thu/lợi nhuận tháng chưa có API/config chuẩn trong AI snapshot. Nếu hỏi phần trăm mục tiêu, AI chỉ trả được khi target có trong context.
- Lead module độc lập chưa đầy đủ; lead đang suy từ ai-marketing, chat-message, pending-order và order.
- Inventory realtime theo SKU chưa nằm trong AI snapshot chuẩn; câu hỏi tồn kho cần thêm source inventory nếu muốn kết luận chắc.
- Campaign/creative entity chưa đầy đủ; campaign có thể suy từ `AdGroup.campaignId`, creative lấy từ `ai-marketing`.
- Approval queue tập trung chưa tách riêng; AI đang gom từ financial actions, ai-marketing plans/evaluations và ops suggestions.
- Bank reconciliation/payment approval chưa là một API thống nhất; CFO answer phải phân biệt tiền thật, doanh thu kế toán và proxy.
- Webhook health chưa có endpoint health chuyên biệt; hiện có thể suy từ events/log nếu có.

## 6. Guardrail bắt buộc

- Không hiển thị full JWT, API key, Meta/Google/TikTok token.
- Không tự tạo/xóa user, đổi role, tạo batch thanh toán, rút owner, trả nợ, apply ngân sách ads, pause/kill campaign nếu chưa có approval rõ.
- Không nói đã gọi khách/gửi tin nhắn/giao task nếu chưa có executor thành công.
- Với dữ liệu thiếu hoặc `dataQuality=bad`, AI phải nói “chưa đủ dữ liệu để kết luận chắc” và nêu module/API cần bổ sung.
- Với ads scale, cashflow gate luôn đứng trước ROI.
- Với sale/lead, không quy lỗi ads nếu sales SLA đang vi phạm nặng.
