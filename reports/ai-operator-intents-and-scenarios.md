# Danh sách tình huống / intent hiện có của Trợ lý quản trị

Nguồn đọc chính:
- `backend/src/ai-operator/ai-operator.interfaces.ts`
- `backend/src/ai-operator/ai-operator.knowledge.ts`
- `backend/src/ai-operator/ai-operator.service.ts`

## 1. Intent hiện có

Hiện tại `AiOperatorIntent` có 13 intent:

| Intent | Ý nghĩa hiện tại | Ghi chú |
|---|---|---|
| `overview` | Tổng quan điều hành | Thường dùng cho giám đốc hoặc câu hỏi rộng. |
| `finance` | Tài chính, dòng tiền, vốn, owner fund | Load sâu financial-control, funds, loan, owner, chi phí. |
| `ads` | Quảng cáo, ROI, ngân sách, scale | Intent quảng cáo chung, dễ trả lời dạng cảnh báo/tổng hợp. |
| `ads_diagnostic_checklist` | Checklist chẩn đoán quảng cáo | Mới thêm để xử lý câu hỏi kiểu kiểm tra tài khoản, fanpage, sync, campaign/adset/ad, spend, lead, attribution, profit, lỗ/lãi, ngân sách. |
| `ad_group_profit_classification` | Phân loại nhóm quảng cáo lãi/lỗ/hòa vốn/chưa đủ dữ liệu | Dùng cho câu hỏi đếm và lập bảng nhóm quảng cáo theo spend, lead, đơn, doanh thu, lợi nhuận sau ads. |
| `orders` | Đơn hàng, tracking, giao hàng | Load order, return, sales support tùy câu hỏi. |
| `receivables` | Công nợ, thanh toán, statement, NCC/agent | Load finance + receivable depth. |
| `operations` | Vận hành, quản lý, việc nóng | Load ops-actions, orders, chat, pending orders, token/sync, ads entities. |
| `token` | OpenAI Config và token social/ads | Phân biệt OpenAI API key với ApiToken Meta/Google/TikTok. |
| `api` | Hỏi về ERP API / endpoint | Trả danh mục API và guardrail. |
| `sales` | Sale / đại lý / lead / chốt đơn | Load product, customer, pending order, chat, ads entities. |
| `supplier` | Nhà cung cấp | Load đơn, return, scope supplier. |
| `loose` | Không xác định rõ | Load rộng như overview. |

## 2. Cách nhận diện intent hiện tại

Thứ tự trong `resolveContextRoute()`:

1. Nếu người dùng truyền `scenarioId` hợp lệ: dùng workflow đó.
2. Nếu người dùng truyền `intent` hợp lệ: dùng intent đó.
3. Nếu câu hỏi khớp phân loại lãi/lỗ nhóm quảng cáo: dùng `ad_group_profit_classification`.
4. Nếu câu hỏi khớp checklist quảng cáo: dùng `ads_diagnostic_checklist`.
5. Nếu có `token`, `api key`, `openai`: dùng `token`.
6. Nếu có `endpoint`, `erp api`: dùng `api`.
7. Nếu khớp một `SCENARIO_WORKFLOWS`: dùng scenario tốt nhất.
8. Nếu không khớp: suy intent bằng keyword trong `intentFromTextOrRole()`.

Mapping keyword chính trong `intentFromTextOrRole()`:

| Keyword | Intent |
|---|---|
| `nhom quang cao`, `ad group`, `adset` + `bao nhieu`, `lai`, `lo`, `hoa von`, `chua du du lieu`, `doanh thu`, `loi nhuan` | `ad_group_profit_classification` |
| `ads`, `quang cao`, `roi`, `budget` | `ads` |
| `tai chinh`, `dong tien`, `cash`, `runway`, `von` | `finance` |
| `cong no`, `thanh toan`, `hoa hong`, `ncc` | `receivables` |
| `don`, `order`, `tracking`, `giao hang` | `orders` |
| `sale`, `agent` | `sales` |
| `supplier` | `supplier` |
| `manager`, `quan ly`, `van hanh` | `operations` |
| `director`, `giam doc` | `overview` |
| Không khớp | `loose` |

## 3. Role playbook hiện có

| Role | Tên | Mục tiêu chính | Module khuyến nghị |
|---|---|---|---|
| `director` | Giám đốc | Quyết định dòng tiền, scale/kill ads, rút owner, vốn, rủi ro và phân quyền. | financial-control, finance, owner-fund, ads-budget, ad-group-profit-report, supplier-payable, agent-receivable |
| `manager` | Quản lý | Điều phối vận hành ngày, theo dõi ads KPI, cảnh báo, đơn hàng, token, bàn giao. | ads-budget, employee-ads-kpi, ops-action, chat-message, fanpage, api-token, media |
| `sales` | Sale / Đại lý bán hàng | Tra cứu sản phẩm, báo giá, khách hàng, tạo đơn, theo dõi chốt đơn. | products, customers, quotes, test-order2, delivery-status, agent-receivable |
| `ads` | Nhân viên Ads | Theo dõi spend, ROI, lợi nhuận, alert, đề xuất scale/giảm/tắt nhóm quảng cáo. | ad-account, ad-group, advertising-cost, ad-group-profit-report, employee-ads-kpi, ads-alerts, media |
| `accountant` | Kế toán / CFO persona | Đối soát NCC, hoa hồng đại lý, chi phí, lương, khoản vay, dòng tiền thật. | supplier-payable, agent-receivable, labor-cost1, other-cost, finance, financial-control |
| `supplier` | Nhà cung cấp | Cập nhật trạng thái xử lý/giao hàng trong phạm vi supplier và theo dõi đối soát. | test-order2, delivery-status, production-status, supplier-payable |

## 4. Scenario workflow hiện có

Hiện có 29 workflow:

| ID | Role | Tình huống | API đủ? | Chế độ | Cần duyệt | Read/Write |
|---|---|---|---|---|---|---|
| `DIR-001` | director | Tổng quan điều hành đầu ngày | sufficient | read_only | Không | 8/0 |
| `DIR-002` | director | Duyệt scale, giảm hoặc tạm dừng ads | sufficient | approval_required | Có | 10/7 |
| `DIR-003` | director | Rút owner hoặc giữ lại vốn | sufficient | approval_required | Có | 8/4 |
| `DIR-004` | director, accountant | Xử lý căng dòng tiền 7-14 ngày | partial | approval_required | Có | 8/4 |
| `DIR-005` | director | Quản trị user, role và mở module | partial | approval_required | Có | 3/3 |
| `MGR-001` | manager | Gom việc nóng trong ngày | partial | approval_required | Có | 8/3 |
| `MGR-002` | manager | Phân công nhân viên Ads | sufficient | approval_required | Có | 6/3 |
| `MGR-003` | manager | Theo dõi fanpage, hội thoại và pending order | partial | approval_required | Có | 5/4 |
| `MGR-004` | manager | Bàn giao cuối ngày | partial | manual_handoff | Không | 6/1 |
| `SALES-001` | sales, agent | Tạo đơn từ hội thoại hoặc lead | partial | approval_required | Có | 7/3 |
| `SALES-002` | sales, agent | Tra cứu sản phẩm, giá và media để chốt đơn | sufficient | approval_required | Có | 7/2 |
| `SALES-003` | sales, agent | Theo dõi đơn chậm hoặc cần bổ sung thông tin | sufficient | approval_required | Có | 6/4 |
| `SALES-004` | sales, agent | Hỏi hoa hồng và công nợ đại lý | partial | approval_required | Có | 5/2 |
| `ADS-001` | ads, manager | Sync chi phí ads và kiểm tra sức khỏe token | sufficient | approval_required | Có | 5/6 |
| `ADS-002` | ads, manager | Xử lý ROI thấp hoặc ads đốt tiền | sufficient | approval_required | Có | 6/6 |
| `ADS-003` | ads, manager | Đề xuất scale nhóm quảng cáo tốt | sufficient | approval_required | Có | 9/6 |
| `ADS-004` | ads | Tạo/import/discover ad group | sufficient | approval_required | Có | 6/5 |
| `ADS-005` | ads, manager | Kiểm tra creative/media trước khi scale | sufficient | approval_required | Có | 8/5 |
| `ACC-001` | accountant | Đối soát và thanh toán NCC | sufficient | approval_required | Có | 6/5 |
| `ACC-002` | accountant | Thanh toán hoa hồng đại lý | partial | approval_required | Có | 6/4 |
| `ACC-003` | accountant, director | Quản lý chi phí, lương và cash-out sắp đến hạn | partial | approval_required | Có | 6/3 |
| `ACC-004` | accountant, director | Quản lý khoản vay và lịch trả nợ | sufficient | approval_required | Có | 6/4 |
| `ACC-005` | accountant, director | Đối soát báo cáo lợi nhuận sản phẩm/ads | partial | approval_required | Có | 6/3 |
| `ACC-006` | accountant, director | Kiểm tra chứng từ thanh toán | partial | manual_handoff | Có | 6/2 |
| `ACC-007` | accountant, director | Soát double payment, overpay và reopen bất thường | partial | read_only | Không | 6/0 |
| `SUP-001` | supplier | Xem đơn cần sản xuất/giao hàng | partial | approval_required | Có | 4/2 |
| `SUP-002` | supplier | Cập nhật tracking và trạng thái giao hàng | partial | approval_required | Có | 3/2 |
| `SUP-003` | supplier | Đối soát COD và statement NCC | partial | read_only | Không | 5/0 |
| `SUP-004` | supplier | Xử lý hàng hoàn/khiếu nại vận hành | partial | approval_required | Có | 5/3 |

## 5. Ghi chú thiết kế sau khi bổ sung intent

- Đã có intent riêng `ad_group_profit_classification` cho câu hỏi: “Có bao nhiêu nhóm quảng cáo, nhóm nào lãi/lỗ/chưa đủ dữ liệu?”.
- Intent này được ưu tiên trước `ads_diagnostic_checklist` và `ads` chung để câu hỏi định lượng không bị trả lời như cảnh báo quản trị.
- Response contract của intent mới là bảng nhóm quảng cáo gồm spend, lead, đơn, doanh thu, lợi nhuận sau ads, trạng thái và lý do.
- Intent `ads` vẫn giữ vai trò quảng cáo tổng quan: ROI, budget, sync, token, KPI, creative, scale, alert.
- `ads_diagnostic_checklist` tiếp tục xử lý checklist rộng 10 mục, không thay thế workflow phân loại lãi/lỗ từng nhóm quảng cáo.
