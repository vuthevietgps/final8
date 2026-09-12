# Danh sách ERP API hiện có trong AI Operator catalog

Nguồn đọc chính: `backend/src/ai-operator/ai-operator.knowledge.ts`, biến `ERP_API_CATALOG`.

Lưu ý: đây là catalog mà Trợ lý quản trị dùng để hiểu nghiệp vụ/API. Nó không nhất thiết là toàn bộ route thực tế trong backend.

## 1. Auth, User, RBAC

Mục đích: Đăng nhập, xác thực token, quản lý người dùng, vai trò và quyền truy cập ERP.

Read endpoints:
- `GET /api/users`
- `POST /api/auth/validate-token`
- `GET /api/session-logs/me`

Write endpoints:
- `POST /api/auth/login`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

AI use cases:
- Giải thích user nào có quyền vào module nào.
- Kiểm tra role/permission trước khi đề xuất thao tác quản trị.
- Tổng hợp nhân sự đang thiếu quyền để vận hành module.

Guardrails:
- Không tự động tạo/xóa user hoặc đổi role nếu chưa có xác nhận rõ của director.
- Không bao giờ hiển thị JWT, password hoặc secret trong câu trả lời.

## 2. Order, Status, Fulfillment

Mục đích: Quản lý đơn hàng, trạng thái sản xuất, giao hàng, cập nhật tracking và đồng bộ sheet.

Read endpoints:
- `GET /api/test-order2`
- `GET /api/order-status`
- `GET /api/production-status`
- `GET /api/delivery-status`
- `GET /api/order-sheet-sync/status`
- `GET /api/order-sheet-sync/agents-suppliers`

Write endpoints:
- `POST /api/test-order2`
- `PATCH /api/test-order2/:id`
- `POST /api/order-update/excel`
- `POST /api/order-sheet-sync/agents/all`
- `POST /api/order-sheet-sync/suppliers/all`

AI use cases:
- Tóm tắt đơn mới, đơn trễ, đơn lỗi tracking và đơn cần đối soát.
- Gợi ý việc cần làm theo trạng thái đơn hàng.
- Giải thích luồng từ đơn hàng sang công nợ NCC/hoa hồng đại lý.

Guardrails:
- Không đổi supplier, agent, giá tiền hoặc trạng thái thanh toán nếu không có ID đơn và xác nhận.
- Với supplier user, chỉ đề xuất thao tác trong phạm vi đơn của supplier đó.

## 3. Product, Customer, Quote

Mục đích: Quản lý sản phẩm, nhóm sản phẩm, khách hàng, báo giá đại lý và báo giá NCC.

Read endpoints:
- `GET /api/products`
- `GET /api/product-category`
- `GET /api/customers`
- `GET /api/quotes`
- `GET /api/supplier-quotes`

Write endpoints:
- `POST /api/products`
- `PATCH /api/products/:id`
- `MISSING POST /api/customers`
- `POST /api/quotes`
- `POST /api/supplier-quotes`

AI use cases:
- Tra cứu sản phẩm/báo giá khi sale hoặc đại lý cần chốt đơn.
- Phát hiện sản phẩm thiếu giá, thiếu media hoặc chưa có báo giá NCC.
- Tổng hợp sản phẩm có lợi nhuận/thua lỗ theo dữ liệu báo cáo.

Guardrails:
- Không tự sửa giá bán/giá NCC nếu chưa có người duyệt.
- Nếu dữ liệu giá bị thiếu, nói rõ module nào cần cập nhật.

## 4. Ads, KPI, Alerts

Mục đích: Quản lý tài khoản quảng cáo, nhóm quảng cáo, chi phí ads, KPI nhân viên ads và cảnh báo ROI.

Read endpoints:
- `GET /api/ad-accounts`
- `GET /api/ad-groups`
- `GET /api/ads/ad-groups/profit-classification?days=7`
- `GET /api/advertising-cost/stats/summary`
- `GET /api/ad-group-profit-report/performance`
- `GET /api/ad-group-profit-report/optimal-spend`
- `GET /api/employee-ads-kpi`
- `GET /api/ads-alerts`
- `GET /api/ai-marketing/overview`
- `GET /api/ai-marketing/leads/funnel`
- `GET /api/ai-marketing/creatives/performance`
- `GET /api/ai-marketing/creatives`
- `GET /api/ai-marketing/plans`
- `GET /api/ai-marketing/actions/evaluations`

Write endpoints:
- `POST /api/advertising-cost/upload-facebook-excel`
- `POST /api/advertising-cost/fetch/facebook`
- `POST /api/employee-ads-kpi/assign`
- `POST /api/ai-marketing/leads/sync`
- `POST /api/ai-marketing/creatives`
- `PATCH /api/ai-marketing/creatives/:creativeId`
- `POST /api/ai-marketing/plans/generate`
- `PATCH /api/ai-marketing/plans/:planId/items/:itemId/approve`
- `POST /api/ai-marketing/plans/:planId/apply`
- `POST /api/emergency-actions/bulk-sync`

AI use cases:
- Đếm và phân loại nhóm quảng cáo theo lãi, lỗ, hòa vốn và chưa đủ dữ liệu.
- Chỉ ra nhóm ads đang lỗ, nhóm có thể scale và nhóm cần tạm dừng.
- Tóm tắt KPI nhân viên ads để manager phân công việc.
- Giải thích vì sao đề xuất tăng/giảm ngân sách dựa trên ROI, lợi nhuận và cashflow.
- Theo dõi creative nào tạo lead/khách/lãi thật để lập creative test trước khi scale.

Guardrails:
- Mọi đề xuất scale/kill ads phải xét cashflow và survival floor trước ROI.
- Không apply ngân sách thật nếu chưa có phê duyệt và giới hạn thay đổi.

## 5. Finance, Cashflow, Capital, Owner Fund

Mục đích: Theo dõi bank balance, free cash, committed cash, forecast, vốn khả dụng, phân bổ vốn, khoản vay và quỹ owner.

Read endpoints:
- `GET /api/financial-control/dashboard`
- `GET /api/finance/available-funds/current`
- `GET /api/finance/cashflow-health`
- `GET /api/capital-allocation/compute`
- `GET /api/budget-allocation/status`
- `GET /api/finance/loans`
- `GET /api/owner-fund/fund-summary`

Write endpoints:
- `POST /api/finance/available-funds/capture`
- `POST /api/capital-allocation/snapshots`
- `POST /api/budget-allocation/auto`
- `POST /api/finance/loans`
- `POST /api/finance/loans/:id/repayments`
- `POST /api/owner-fund/withdrawals`

AI use cases:
- Tóm tắt sức khỏe dòng tiền hôm nay cho giám đốc.
- Gợi ý ngân sách ads an toàn dựa trên free cash và survival floor.
- Cảnh báo rút owner, trả nợ, chi ads khi dòng tiền căng.

Guardrails:
- Phân biệt tiền thật đã vào/ra với doanh thu/chi phí kế toán.
- Rút owner, trả nợ, auto budget là thao tác rủi ro cao, luôn cần xác nhận.

## 6. Supplier Payable, Agent Payment

Mục đích: Đối soát NCC thu COD, thanh toán NCC, tính hoa hồng đại lý và xử lý công nợ/clawback.

Read endpoints:
- `GET /api/supplier-payables/statements`
- `GET /api/supplier-payables/summary/cashflow`
- `GET /api/test-order2/payment-pending/supplier`
- `GET /api/test-order2/payment-pending/agent`
- `GET /api/agent-receivables/summary`
- `GET /api/agent-payables/summary/cashflow`

Write endpoints:
- `POST /api/supplier-payables/statements`
- `POST /api/supplier-payables/statements/:id/payments`
- `PATCH /api/supplier-payables/statements/:id/close`
- `POST /api/test-order2/supplier-payment-batch`
- `POST /api/test-order2/agent-payment-batch/atomic`

AI use cases:
- Tổng hợp khoản NCC quá hạn, đại lý cần thanh toán và batch đang trễ.
- Giải thích vì sao một đơn được/không được đưa vào batch thanh toán.
- Cảnh báo batch lớn cần duyệt trước khi tạo.

Guardrails:
- Không tạo batch thanh toán nếu chưa có danh sách ID, tổng tiền, chu kỳ và người duyệt.
- Với hoa hồng âm/hoàn sau trả, cần nói rõ rủi ro clawback.

## 7. AI, Chat, Token, Integration

Mục đích: Quản lý OpenAI config, hội thoại, fanpage, token Meta/Google/TikTok và sync platform.

Read endpoints:
- `GET /api/openai-configs`
- `GET /api/chat-messages/conversations/list/all`
- `GET /api/fanpages`
- `GET /api/api-tokens`
- `GET /api/api-tokens/settings`

Write endpoints:
- `POST /api/openai-configs`
- `PATCH /api/openai-configs/:id`
- `POST /api/openai-configs/test-key`
- `POST /api/api-tokens`
- `POST /api/api-tokens/:id/validate`
- `POST /api/api-tokens/:id/rotate`
- `POST /api/api-tokens/sync/from-fanpages`

AI use cases:
- Hướng dẫn cấu hình AI API token và prompt đúng cho chatbot.
- Kiểm tra token ads hết hạn, sync lỗi và đề xuất rotate.
- Tổng hợp hội thoại/pending order để manager biết điểm nghẽn.

Guardrails:
- Không hiển thị đầy đủ API key/token trong UI, log hoặc câu trả lời AI.
- Rotate token và sync diện rộng cần xác nhận platform, phạm vi và thời điểm.

## 8. Nhận xét nhanh về API catalog hiện có

- Catalog đã có API chuyên cho báo cáo “phân loại nhóm quảng cáo lãi/lỗ/chưa đủ dữ liệu”: `GET /api/ads/ad-groups/profit-classification?days=7`.
- Endpoint này trả thẳng bảng phân loại theo nhóm quảng cáo, gồm tổng nhóm, số nhóm lãi/lỗ/hòa vốn/chưa đủ dữ liệu và chất lượng dữ liệu.
- Vẫn có endpoint hiệu suất ads chi tiết: `GET /api/ad-group-profit-report/performance`.
- Vẫn có endpoint optimal spend: `GET /api/ad-group-profit-report/optimal-spend`.
- Vẫn có endpoint chi phí ads summary: `GET /api/advertising-cost/stats/summary`.
