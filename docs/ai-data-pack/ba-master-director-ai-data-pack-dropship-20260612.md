# BA MASTER — Director AI Data Pack cho ERP dropshipping nội địa / đại lý cấp 1

**Ngày lập:** 2026-06-12  
**Phiên bản:** BA Master v1.0  
**Mục tiêu:** Chốt yêu cầu nghiệp vụ trước khi giao Codex code tiếp.  
**Nguyên tắc:** BA trước, code sau. Codex không tự nghĩ business logic; Codex chỉ triển khai business logic đã được khóa.

---

## 0. Căn cứ và phạm vi tổng hợp

Tài liệu này tổng hợp từ hai nhóm nguồn:

1. **Kết quả kiểm tra hiện trạng ERP do Codex thực hiện**:
   - `erp-ai-data-pack-readiness-audit-20260612.md`
   - `current-erp-clarification-audit-20260612.md`
   - `phase-2-read-only-export-implementation-20260612.md`
   - `phase-2.1-sample-export-acceptance-20260612.md`
   - `sample-export-verification-20260612.md`
   - Các file sample export JSON/XLSX ngày 2026-06-12.

2. **Các nội dung nghiệp vụ đã trao đổi**:
   - Mục tiêu giám đốc.
   - Director Data Pack cho ChatGPT Web.
   - Dropshipping nội địa / đại lý cấp 1 không nhập hàng.
   - Nhà cung cấp thu tiền, đối soát hoa hồng, trả hoa hồng cho đại lý cấp 1.
   - Đại lý cấp 1 trả hoa hồng cho đại lý cấp 2.
   - Tìm kiếm sản phẩm, thử nghiệm sản phẩm, phân bổ vốn test.
   - Nhiều supplier có thể cung cấp cùng một sản phẩm/dịch vụ.
   - Referral attribution: khách hàng giới thiệu ảnh hưởng ngược đến nhóm quảng cáo.
   - Độ trễ giao hàng / nhận tiền / đối soát ảnh hưởng đến hàng hoàn và hiệu quả ads.
   - Chẩn đoán nghẽn tăng trưởng do vốn, ads, sale, vận hành, nhà cung cấp, nhân sự, quy trình, dữ liệu.
   - Xếp hạng nhân viên, bổ sung nhân sự, coaching, cải tiến kịch bản sale.
   - Đối soát dữ liệu nhân sự: điểm danh, phiên làm việc, lương, hoa hồng, activity log.
   - Data quality, mapping quality, freshness, pre-export sync.
   - Action draft an toàn, không live execution.

### Phạm vi tài liệu này

**In scope:**

- Business requirements cho Director AI Data Pack.
- Business requirements cho Marketer Data Pack.
- Data Quality Report.
- Mapping Report.
- Pre-export sync & freshness gate.
- Dropship settlement & cash ownership.
- Product market testing, supplier pool, return/refund, partner health.
- Referral attribution và lag-adjusted ads performance.
- Growth bottleneck diagnosis.
- Employee scorecard, staffing, training, process improvement.
- Employee data integrity và work-payroll reconciliation.
- ChatGPT Web reading/research rules.
- Action draft rules.
- Data-size strategy.
- Traceability matrix.
- Backlog code sau khi BA được duyệt.

**Out of scope hiện tại:**

- Không code mới.
- Không migration.
- Không thêm OpenAI API key.
- Không upload normalization.
- Không import action file.
- Không dry-run action file chung.
- Không live execution.
- Không mutation ads/provider.
- Không tự động phạt/cắt lương/kết luận gian lận.

---

## 1. Hiện trạng ERP theo kết quả audit/nghiệm thu

### 1.1. Điểm đã có

ERP hiện đã có nền tảng để xuất AI Data Pack ở mức read-only:

- Đã tạo module `backend/src/ai-data-pack/`.
- Có Director Data Pack.
- Có Marketer Data Pack Google-focused V1.
- Có Data Quality Report.
- Có Mapping Report.
- Có Decision History export.
- Có JSON và XLSX nhiều sheet.
- Có metadata, source, freshness, confidence, quality flags.
- Có ChatGPT Web reading rules và research rules.
- Có permission guard và secret/PII redaction.
- Giai đoạn 2.1 đã gọi thành công 7 endpoint bằng user director trên local DB.
- Director XLSX có đủ 25 sheet từ `00_README` đến `24_field_aliases`.
- Secret/PII scan trong sample: 0 phát hiện.

### 1.2. Điểm cần hiểu đúng

DB nghiệm thu hiện là demo/local, nên dữ liệu rỗng không đồng nghĩa ERP xuất sai. Kết luận đúng là:

```text
ERP đã xuất đủ khung/schema và endpoint hoạt động.
DB demo chưa đủ dữ liệu để nghiệm thu chất lượng phân tích kinh doanh thực tế.
```

Các phần rỗng trong sample 2026-06-12 gồm:

- marketing profitability
- service/product performance
- unit economics
- sales funnel/team
- decision history
- decision options
- external market summary
- Marketer Pack Google metrics

### 1.3. Các lỗi kỹ thuật cần sửa trước khi dùng hằng ngày

P0 ở Giai đoạn 2.2:

1. XLSX sheet rỗng mất quality metadata, hiện chỉ còn `status=empty`.
2. `generated_by` đang serialize thành ObjectId buffer thay vì string/null đã redact.
3. Metadata checksum chưa deterministic do timestamp động.
4. Finance quality đang hơi lạc quan dù thiếu debt schedule 30/90 ngày.
5. Cần phân biệt rõ `zero_value`, `missing`, `not_synced`, `not_configured`, `no_records_for_report_date`, `weak_mapping`, `estimated`, `realized`.

### 1.4. Các điểm chưa được phép làm

Chưa được chuyển sang Giai đoạn 3 vì:

- OpenAI API key chưa an toàn để nhúng.
- Upload normalization chưa có artifact lifecycle/review workflow.
- Action import/dry-run/live execution chưa được bật.
- Generic controlled execution đa nền tảng chưa đủ an toàn.
- Data quality/mapping chưa đủ để quyết định mạnh.

---

## 2. Tư duy hệ thống

### 2.1. ERP là source of truth, ChatGPT Web là analyst

ERP có nhiệm vụ:

```text
sync/read data → validate freshness → calculate quality/mapping → snapshot → export Data Pack
```

ChatGPT Web có nhiệm vụ:

```text
đọc Data Pack → kiểm tra chất lượng dữ liệu → phân tích phản biện → đưa action draft
```

ERP không được thực thi action từ ChatGPT Web ở giai đoạn này.

### 2.2. File hành động của ChatGPT Web chỉ là draft

Các output của ChatGPT Web chỉ được coi là:

```text
action_draft
recommendation
investigation_request
monitoring_task
needs_director_approval
```

Không phải:

```text
executable_action
provider_mutation
live_ads_change
payroll_change
supplier_penalty
```

### 2.3. Code là bước cuối

Thứ tự chuẩn:

```text
Business goal
→ Director decision
→ Required evidence
→ Required data
→ Freshness/quality/mapping gate
→ ChatGPT output
→ Action draft rule
→ Acceptance criteria
→ Code
```

Không code theo kiểu:

```text
Có API gì thì code API đó trước rồi mới hỏi dùng để làm gì.
```

---

## 3. Mô hình kinh doanh chuẩn cần phản ánh

### 3.1. Mô hình dropshipping nội địa / đại lý cấp 1 không nhập hàng

Luồng tiền/nghiệp vụ:

```text
Khách hàng mua sản phẩm/dịch vụ
→ Nhà cung cấp thu tiền từ khách
→ Nhà cung cấp xác nhận/đối soát hoa hồng
→ Nhà cung cấp trả hoa hồng cho đại lý cấp 1
→ Đại lý cấp 1 trả hoa hồng cho đại lý cấp 2 nếu có
→ Đại lý cấp 1 chịu chi phí ads, sale, vận hành, hoàn/hủy/lỗi nếu có
```

### 3.2. Các loại tiền phải tách rõ

Không được gộp các khái niệm sau:

```text
GMV / order_value
supplier_collected_amount
expected_supplier_commission
confirmed_supplier_commission
received_supplier_commission
tier2_commission_payable
tier2_commission_paid
ads_cost_allocated
sale_cost_allocated
operation_cost_allocated
estimated_net_profit
realized_net_profit
cash_available
expected_cash_inflow
committed_cash_out
conditional_liability
```

Quy tắc:

```text
GMV không phải cash_available của đại lý cấp 1.
supplier_collected_amount không phải tiền của đại lý cấp 1.
expected_supplier_commission không phải realized cash.
confirmed_supplier_commission là receivable.
received_supplier_commission mới là tiền/thu nhập đã thực nhận.
tier2_commission_payable phải tách conditional vs committed.
```

### 3.3. Công thức lợi nhuận đại lý cấp 1

```text
tier1_estimated_net_profit =
  expected_supplier_commission
  - ads_cost_allocated
  - expected_tier2_commission
  - sale_cost_allocated
  - operation_cost_allocated
  - refund_error_risk_cost
```

```text
tier1_realized_net_profit =
  received_supplier_commission
  - tier2_commission_paid
  - realized_ads_cost
  - realized_sale_cost
  - realized_operation_cost
  - realized_refund_error_cost
```

### 3.4. Sản phẩm có thị trường tốt là tài sản chính

Không được giả định:

```text
Product A = Supplier A
```

Mô hình đúng:

```text
Product market opportunity
→ nhiều supplier có thể cung cấp
→ so sánh supplier pool
→ phân bổ đơn cho supplier tốt nhất
```

Rule:

```text
Không kill product chỉ vì một supplier yếu.
Nếu market tốt nhưng supplier yếu, action đúng là tìm supplier khác, giảm allocation supplier yếu, hoặc test supplier thay thế.
Chỉ kill product khi market signal yếu hoặc economics không thể dương với nhiều supplier.
```

---

## 4. Vai trò người dùng

| Role | Mục tiêu | Quyền ở giai đoạn hiện tại |
|---|---|---|
| Giám đốc | Quyết định tăng trưởng, vốn, nhân sự, ads, sản phẩm, supplier | Đọc Data Pack, duyệt action draft, chưa live execution chung |
| Marketer | Phân tích ads, campaign, search term, creative, lead quality | Monitor, đề xuất, không live mutation từ file ChatGPT |
| Sale | Xử lý lead, chốt đơn, cập nhật trạng thái/lost reason | Nhận task/action draft, không tự sửa dữ liệu tài chính |
| Vận hành | Xử lý đơn/hồ sơ, SLA, backlog | Nhận task/action draft |
| Tài chính/Kế toán | Cashflow, công nợ, lương, hoa hồng, đối soát | Xác nhận dữ liệu, chưa tự động thanh toán từ AI |
| Admin kỹ thuật | Quản lý quyền, export, sync, security | Không lộ secret/PII |
| ChatGPT Web | Analyst, phản biện, tạo action draft | Không thực thi |
| ERP | Source of truth, validator, exporter | Không tự live execution trong giai đoạn này |

---

## 5. Cây mục tiêu giám đốc

### G1. Bảo vệ dòng tiền

Giám đốc cần trả lời:

- Tiền thật đang có là bao nhiêu?
- Tiền nào đang ở supplier?
- Hoa hồng nào phải thu?
- Hoa hồng nào đã nhận?
- Có đủ tiền trả cấp 2, lương, nợ, ads không?
- Có được dùng tiền vay để chạy ads không?

Dữ liệu bắt buộc:

```text
cash_available
bank_balance
free_cash
survival_buffer
committed_cash
expected_cash_inflow
required_cash_outflow
supplier_commission_receivable
supplier_commission_received
tier2_commission_payable
debt_service_30d/90d
loan_status
ads_fund_remaining
max_test_loss
```

### G2. Tăng trưởng có lợi nhuận

Cần trả lời:

- Doanh thu tăng có đi kèm lợi nhuận thật không?
- Campaign nào lời thật?
- Sản phẩm nào GMV cao nhưng tiền chưa về?
- Sản phẩm nào lead rẻ nhưng hoàn cao?

Dữ liệu:

```text
GMV
expected_commission
confirmed_commission
received_commission
ads_cost
tier2_commission
return_adjusted_profit
cash_received_profit
estimated_net_profit
realized_net_profit
```

### G3. Phân bổ ngân sách ads đúng chỗ

Cần trả lời:

- Nên tăng/giữ/giảm nhóm ads nào?
- Có được scale theo campaign/service_group không?
- Ads nào có referral lift tốt?
- Ads nào có return/cash lag xấu?

Dữ liệu:

```text
campaign/ad_group metrics
lead quality
order/profit mapping
return rate by ad group
cash lag by ad group
referral impact
campaign_service_mapping_rate
attribution_confidence
ads_freshness
```

### G4. Ưu tiên product market opportunity

Cần trả lời:

- Sản phẩm/dịch vụ nào có thị trường tốt?
- Product nào nên test?
- Product nào nên scale?
- Product nào không kill dù supplier hiện tại yếu?

Dữ liệu:

```text
market demand signal
lead volume
qualified lead rate
close rate
competitor signal
customer questions
product_market_score
supplier_offer_pool
```

### G5. Quản trị supplier pool và allocation

Cần trả lời:

- Supplier nào tốt nhất cho từng product?
- Supplier nào trả tiền chậm?
- Supplier nào có hoàn/hủy cao?
- Có nên chia allocation 70/30, 50/50?

Dữ liệu:

```text
supplier_offer_pool
supplier_health_score
supplier_payout_delay
return/refund rate
complaint rate
commission received rate
settlement quality
capacity/stock/SLA
```

### G6. Kiểm tra sale và kịch bản sale

Cần trả lời:

- Lead có được gọi nhanh không?
- Sale nào xử lý tốt?
- Sale nào cần coaching?
- Kịch bản nào chốt tốt?
- Khách mất ở bước nào/lý do nào?

Dữ liệu:

```text
lead stages
first response time
call logs
quote rate
close rate
lost reason
script_version
offer_version
followup_count
profit per lead
```

### G7. Kiểm soát vận hành và SLA

Cần trả lời:

- Có nhận thêm đơn được không?
- SLA nào đang vỡ?
- Nghẽn ở supplier, hồ sơ, khách hàng, vận hành hay tài chính?

Dữ liệu:

```text
open_orders
new_orders
completed_orders
overdue_orders
stage cycle time
capacity baseline
staff availability
supplier confirmation lag
delivery lag
```

### G8. Quản trị nhân sự, năng lực, lương/hoa hồng

Cần trả lời:

- Có cần tuyển thêm người không?
- Nên đào tạo ai?
- Nên sửa quy trình hay tuyển thêm?
- Có mâu thuẫn điểm danh/làm việc/lương/hoa hồng không?

Dữ liệu:

```text
attendance
work sessions
activity logs
call logs
task logs
payroll items
commission items
employee workload
role-based performance scorecard
```

### G9. Trải nghiệm khách hàng và thương hiệu

Cần trả lời:

- Khách phàn nàn gì?
- Hoàn/hủy do sản phẩm, supplier, sale, ads hay giao hàng?
- Nhóm khách nào giới thiệu tốt?

Dữ liệu:

```text
customer feedback
complaints
refund reasons
return reasons
referral mapping
NPS/review nếu có
support tickets
```

### G10. Rủi ro pháp lý, thuế, hợp đồng, bảo mật

Cần trả lời:

- Supplier/đại lý có hợp đồng không?
- Chứng từ/thuế/hoa hồng có rõ không?
- Dữ liệu PII/secret có an toàn không?
- Ai đã export file, ai được xem file?

Dữ liệu:

```text
contract status
invoice/tax status
credential audit
export audit
permission logs
PII exposure check
```

### G11. Source of truth, data quality, system health

Cần trả lời:

- Dữ liệu nào là thật?
- Nguồn nào stale?
- Sync nào lỗi?
- Mapping nào đứt?
- Có thể tin dữ liệu không?

Dữ liệu:

```text
data_source_registry
freshness per source
sync runs
mapping report
data quality metrics
system health
automation health
```

### G12. Học từ quyết định cũ và mô phỏng kịch bản

Cần trả lời:

- Quyết định trước có đúng không?
- Test nào thành công/thất bại?
- Nếu tăng ads/tuyển người/đổi supplier thì tác động thế nào?

Dữ liệu:

```text
decision history
experiment results
rollback lessons
scenario simulation
profit sensitivity
cashflow scenarios
```

---

## 6. Ma trận quyết định giám đốc

| Decision ID | Quyết định | Dữ liệu bắt buộc | Gate bắt buộc | Nếu dữ liệu yếu |
|---|---|---|---|---|
| D01 | Có tăng ads không | finance, ads, profit, mapping, freshness | finance fresh, ads fresh, mapping đủ | monitor/investigate |
| D02 | Tăng ads bao nhiêu | free cash, ads fund, debt, max budget | finance cautious/ok | không đưa số cụ thể |
| D03 | Dồn tiền vào product nào | product market score, profit, supplier pool | market/economics/supplier confidence | research_more/test_small |
| D04 | Chọn supplier nào | supplier health, payout, return, SLA | supplier data fresh | supplier_sourcing |
| D05 | Có kill product không | market signal, many supplier economics | không kill vì 1 supplier yếu | tìm supplier mới |
| D06 | Có dừng campaign không | CPA, profit, return, referral, protected list | sample size, approval | hold/investigate |
| D07 | Sale có nghẽn không | call logs, stages, lead quality | activity log đủ | không kết luận mạnh |
| D08 | Cần tuyển thêm người không | workload, SLA, capacity, forecast | capacity model đủ | request capacity data |
| D09 | Cần sửa script sale không | lost reason, script version, conversion | sample size đủ | test script nhỏ |
| D10 | Có trả hoa hồng cấp 2 không | supplier paid/confirmed, tier2 payable | cash ownership rõ | needs finance review |
| D11 | Có bất thường nhân sự không | attendance/work/payroll/commission logs | data integrity rule | investigate, không kết luận fraud |
| D12 | Có tạo action draft không | quality/mapping/permission | can_generate_action_draft=true | chỉ request/investigate/hold |
| D13 | Có import/dry-run/live không | schema, approval, dry-run, validateOnly | giai đoạn sau | false ở hiện tại |

---

## 7. Director Data Pack structure

### 7.1. 25 sheet hiện tại

```text
00_README
01_metadata
02_chatgpt_web_reading_rules
03_chatgpt_web_research_rules
04_director_manual_inputs
05_financial_context
06_financing_context
07_cashflow_scenarios
08_business_summary
09_marketing_profitability
10_service_group_performance
11_product_variant_performance
12_unit_economics
13_ltv_summary
14_sales_funnel
15_sales_team
16_operation_capacity
17_decision_history
18_alerts
19_data_quality
20_mapping_report
21_decision_options
22_permission_risk_limits
23_external_market_summary
24_field_aliases
```

### 7.2. Sheet cần bổ sung cho mô hình dropship/đại lý

```text
25_business_model_context
26_order_money_flow
27_supplier_settlement
28_tier1_commission_receivable
29_tier2_commission_payable
30_agent_hierarchy_performance
31_supplier_performance
32_settlement_aging
33_dropship_unit_economics
34_cash_ownership_reconciliation
```

### 7.3. Sheet cần bổ sung cho product market / supplier pool / test

```text
35_product_market_opportunities
36_product_market_scorecard
37_supplier_offer_pool
38_product_supplier_comparison
39_supplier_allocation_matrix
40_supplier_replacement_candidates
41_market_good_but_supplier_weak
42_product_test_portfolio
43_test_budget_allocation
44_product_test_scorecard
45_return_refund_quality
46_early_warning_signals
47_supplier_partner_health
48_test_decision_log
49_scale_kill_rules
50_product_research_backlog
```

### 7.4. Sheet cần bổ sung cho referral và lag-adjusted ads

```text
51_customer_referral_attribution
52_ad_group_referral_impact
53_referral_network_value
54_fulfillment_delivery_lag
55_cash_collection_settlement_lag
56_return_rate_by_ad_group_product_supplier
57_return_adjusted_marketing_profitability
58_lag_impact_analysis
```

### 7.5. Sheet cần bổ sung cho nghẽn tăng trưởng, nhân sự, quy trình

```text
59_growth_bottleneck_diagnosis
60_growth_constraint_scorecard
61_employee_performance_scorecard
62_employee_capacity_plan
63_staffing_recommendation
64_sales_process_diagnostics
65_sales_script_performance
66_training_coaching_plan
67_workflow_bottleneck_analysis
68_resource_capacity_model
```

### 7.6. Sheet cần bổ sung cho data integrity nhân sự

```text
69_employee_data_integrity
70_attendance_work_reconciliation
71_payroll_work_reconciliation
72_commission_reconciliation
73_employee_anomaly_alerts
74_manual_adjustment_audit
```

### 7.7. Sheet chiến lược, khách hàng, tuân thủ, hệ thống

```text
75_strategic_context
76_monthly_quarterly_targets
77_customer_experience_summary
78_complaint_and_refund_analysis
79_legal_compliance_summary
80_security_access_audit
81_system_health
82_source_of_truth_registry
83_data_lineage_conflict_report
84_decision_learning_log
85_scenario_simulation
86_incentive_alignment_review
```

---

## 8. Business model context

### `25_business_model_context`

Mục tiêu: nói rõ mô hình để ChatGPT Web không hiểu nhầm doanh thu/cash.

Fields:

```text
business_model_id
business_model_name
model_type = domestic_dropship_tier1_agency
inventory_model = no_inventory
cash_collection_party = supplier
revenue_recognition_method = commission_only
commission_recognition_method = supplier_settlement
tier2_payout_method
risk_note
```

Rule:

```text
ChatGPT Web phải đọc sheet này trước khi phân tích finance/profit/ads.
```

---

## 9. Dropship settlement & cash ownership

### `26_order_money_flow`

Fields:

```text
order_id
order_date
supplier_id
tier1_agent_id
tier2_agent_id
service_group_id
product_variant_id
order_status
payment_status
gmv_order_value
customer_paid_to
supplier_collected_amount
tier1_commission_rate
tier1_commission_expected
tier1_commission_confirmed
tier1_commission_received
tier2_commission_rate
tier2_commission_payable
tier2_commission_paid
ads_cost_allocated
other_cost_allocated
tier1_estimated_net_profit
tier1_realized_net_profit
settlement_status
cash_status
```

### `27_supplier_settlement`

```text
supplier_id
period
orders_count
gmv
supplier_collected_amount
commission_expected
commission_confirmed
commission_paid_to_tier1
commission_unpaid
commission_overdue
settlement_cycle_days
last_settlement_date
next_expected_settlement_date
dispute_amount
settlement_quality
```

### `28_tier1_commission_receivable`

```text
receivable_id
supplier_id
order_id
amount_expected
amount_confirmed
amount_received
due_date
days_overdue
status
risk_level
```

### `29_tier2_commission_payable`

```text
payable_id
tier2_agent_id
order_id
commission_amount
payment_condition
pay_after_supplier_paid
due_date
paid_amount
unpaid_amount
status
days_overdue
conditional_or_committed
```

### `34_cash_ownership_reconciliation`

```text
money_bucket
amount
owner
cash_location
can_use_for_ads
can_use_for_payroll
is_real_cash
is_expected_cash
risk_note
```

Rule:

```text
Không cộng tiền supplier thu vào cash_available.
Không dùng commission expected như tiền thật.
Nếu tier2 payable conditional thì không xử lý giống committed cash out, trừ khi chính sách giám đốc yêu cầu.
```

---

## 10. Product market, supplier pool, test portfolio

### 10.1. Product market opportunity tách khỏi supplier

Core rule:

```text
Product market fit và supplier performance là hai lớp khác nhau.
Sản phẩm có thị trường tốt là tài sản chính.
Supplier là phương án thực thi có thể thay thế/tối ưu.
```

### 10.2. Product testing lifecycle

```text
discovered
screening
approved_for_test
testing
test_paused
test_failed
scale_candidate
scaling
core_product
watchlist
sunset_candidate
stopped
```

### 10.3. Product test unit

Một test là tổ hợp:

```text
product_variant
service_group
supplier
offer
price/commission
creative
landing/form/inbox
campaign/ad_group
sale_script
tier2_agent nếu có
```

### 10.4. Product market scorecard

Fields:

```text
product_market_id
product_name
lead_volume_score
lead_quality_score
close_rate_score
profit_potential_score
repeat_or_cross_sell_potential
competition_level
market_confidence
market_score
decision
```

Decision:

```text
research_more
test_small
continue_test
scale_candidate
do_not_test
```

### 10.5. Supplier offer pool

Fields:

```text
product_market_id
supplier_id
supplier_name
offer_status
commission_rate
payout_cycle_days
estimated_margin
capacity
processing_sla
return_rate
refund_rate
complaint_rate
settlement_quality
supplier_health_score
recommendation
```

### 10.6. Supplier allocation matrix

```text
product_market_id
supplier_id
current_allocation_percent
recommended_allocation_percent
reason
risk
confidence
```

Rule:

```text
Nếu market tốt nhưng supplier yếu → supplier_sourcing / supplier_reallocation, không kill product.
Nếu supplier pool đủ mạnh + economics tốt + data fresh → scale candidate.
```

---

## 11. Test budget allocation

### Mục tiêu

Quản trị vốn test như portfolio đầu tư, không test tùy hứng.

Fields:

```text
period
total_test_budget
used_test_budget
remaining_test_budget
cash_source
allowed_loss
test_budget_by_product
test_budget_by_supplier
test_budget_by_channel
risk_level
director_approval_required
```

Rules:

```text
Không dùng khoản vay proposed cho test.
Không vượt max_test_loss.
Không cấp thêm test budget nếu finance stale/weak.
Không tăng test budget cho supplier payout overdue/stale.
Nếu data quality weak → monitor/investigate.
```

Suggested allocation:

```text
50% test product/dịch vụ mới
30% test creative/offer cho sản phẩm đang bán
10% test supplier mới
10% dự phòng cơ hội nhanh
```

---

## 12. Return/refund/hàng hoàn

### 12.1. Metrics

```text
delivered_orders
returned_orders
refund_orders
cancelled_orders
return_rate
refund_rate
cancel_rate
complaint_rate
return_reason
supplier_fault_rate
sale_expectation_mismatch_rate
wrong_customer_fit_rate
shipping_delay_rate
```

### 12.2. Return reason enum

```text
product_quality
wrong_expectation
supplier_delay
price_issue
customer_changed_mind
wrong_customer_fit
sale_misrepresentation
shipping_issue
other
```

### 12.3. Root cause rule

```text
product_quality → xem lại supplier/product
wrong_expectation → sửa ads/script/landing
supplier_delay → cảnh báo supplier
wrong_customer_fit → sửa targeting
sale_misrepresentation → coaching sale
```

---

## 13. Early warning signals

Signals:

```text
spend_no_lead
lead_no_order
high_invalid_lead_rate
cpa_spike
profit_drop
return_rate_spike
refund_rate_spike
complaint_spike
supplier_payout_delay_spike
commission_not_received
order_no_commission
mapping_drop
ads_data_stale
```

Each signal must include:

```text
signal_id
signal_type
affected_entity_type
affected_entity_id
period
severity
evidence
threshold
current_value
baseline_value
trend
confidence
recommended_action
```

---

## 14. Supplier/partner health

Supplier health score:

```text
25% payout_timeliness
20% fulfillment_quality
15% return_refund_rate
15% complaint_rate
10% dispute_reconciliation_accuracy
10% communication_responsiveness
5% capacity_stock_reliability
```

Recommended actions:

```text
increase_allocation
hold
reduce_allocation
collect_receivable
negotiate_terms
pause_new_tests
replace_supplier
needs_review
```

Rule:

```text
Supplier payout delay cao thì không scale mạnh dù ROAS tốt.
Supplier return/refund cao thì watchlist.
Supplier dispute cao thì đối soát trước khi test thêm.
```

---

## 15. Referral attribution

### 15.1. Ý nghĩa

Một ad group có thể tạo khách hàng gốc. Khách hàng đó có thể giới thiệu khách mới. Vì vậy hiệu quả thật của ad group gồm:

```text
direct_value + referral_assisted_value
```

### 15.2. `customer_referral_attribution`

Fields:

```text
referral_id
referrer_customer_id
referrer_original_source
referrer_original_campaign_id
referrer_original_ad_group_id
referred_customer_id
referred_order_id
referral_date
referral_lag_days
referred_order_status
referred_gmv
referred_commission_expected
referred_commission_received
referred_net_profit
referral_confidence
attribution_method
duplicate_attribution_risk
```

### 15.3. `ad_group_referral_impact`

```text
campaign_id
ad_group_id
direct_orders
direct_profit_after_ads
referrer_customers
referred_customers
referred_orders
referral_order_rate
referral_profit
referral_assisted_profit
total_profit_with_referral
referral_lift_percent
confidence
recommendation
```

Rules:

```text
Không phân bổ referral value cho ad group nếu không nối được referrer về original campaign/ad_group.
Nếu khách vừa referral vừa click ads thì không cộng 100% cho cả hai.
Ad group CPA cao nhưng referral lift cao có thể không nên cắt sớm.
```

---

## 16. Delivery / cash lag feedback vào hiệu quả ads

### 16.1. Ý nghĩa

Hiệu quả quảng cáo phải được điều chỉnh theo:

```text
delivery lag
supplier confirmation lag
cash collection lag
supplier commission settlement lag
tier2 payout lag
return/refund impact
```

### 16.2. `fulfillment_delivery_lag`

Fields:

```text
order_id
campaign_id
ad_group_id
service_group_id
product_variant_id
supplier_id
order_created_at
supplier_confirmed_at
picked_up_at
delivered_at
customer_paid_at
supplier_settled_at
tier1_commission_received_at
tier2_commission_paid_at
time_to_supplier_confirm_hours
time_to_delivery_days
time_to_customer_payment_days
time_to_supplier_settlement_days
time_to_commission_received_days
delivery_status
cash_status
return_status
return_reason
lag_warning
```

### 16.3. Return-adjusted ads performance

```text
expected_profit_after_ads
return_adjusted_profit_after_ads
cash_received_profit_after_ads
settlement_adjusted_profit_after_ads
quality_adjusted_roas
```

Rules:

```text
CPA tốt nhưng return_rate cao → không scale, investigate.
Order tốt nhưng cash/commission lag cao → không scale mạnh.
Delivery lag cao làm return tăng → root cause có thể là supplier/fulfillment, không kết luận ads xấu ngay.
Referral lift cao → không cắt ad group chỉ vì direct CPA cao.
```

---

## 17. Growth bottleneck diagnosis

Taxonomy:

```text
capital_bottleneck
ads_efficiency_bottleneck
market_demand_bottleneck
sales_capacity_bottleneck
sales_skill_bottleneck
operation_capacity_bottleneck
supplier_settlement_bottleneck
process_workflow_bottleneck
data_quality_bottleneck
```

Fields:

```text
bottleneck_id
bottleneck_type
severity
evidence
affected_area
affected_metric
root_cause_hypothesis
confidence
recommended_unlock_action
requires_director_approval
can_create_action_draft
```

Output lý tưởng:

```text
Tăng trưởng nghẽn do sale capacity, không phải ads.
Hoặc: nghẽn do supplier settlement, không phải product market.
Hoặc: nghẽn do data quality, chưa đủ để quyết định scale.
```

---

## 18. Employee scorecard, staffing, coaching

### 18.1. Nguyên tắc công bằng

```text
Chỉ xếp hạng trong cùng vai trò.
Điều chỉnh theo lead_quality, workload, service_mix, complexity.
Có confidence.
Thiếu dữ liệu thì không xếp hạng mạnh.
Không dùng dữ liệu cá nhân nhạy cảm.
Output là quản trị: coach, train, reassign, hire, monitor.
```

### 18.2. Sale scorecard

```text
assigned_leads
response_sla
contact_rate
quote_rate
close_rate
profit_per_lead
lost_reason
crm_data_hygiene
lead_quality_adjusted_score
```

### 18.3. Operation scorecard

```text
orders_handled
completed_on_time
overdue_count
cycle_time
rework_error_rate
complexity_adjusted_workload
documentation_quality
```

### 18.4. Marketer scorecard

```text
profit_after_ads
qualified_lead_rate
CPA_order
mapping_data_hygiene
test_discipline
learning_from_decision_history
```

### 18.5. Staffing rules

```text
Nếu workload forecast > effective capacity và SLA breach toàn team → đề xuất bổ sung nhân sự.
Nếu chỉ một số nhân viên kém hơn khi cùng lead quality/workload → coaching/training.
Nếu rớt ở cùng một stage trên toàn team → sửa quy trình/kịch bản sale.
Nếu thiếu activity log → request_missing_data, không xếp hạng mạnh.
```

---

## 19. Employee data integrity & work-payroll reconciliation

### 19.1. Không gọi thẳng là gian lận

Hệ thống chỉ kết luận:

```text
data_integrity_anomaly
suspicious_record
needs_human_review
```

Không tự kết luận:

```text
confirmed_fraud
```

### 19.2. Tình huống cần phát hiện hằng ngày

```text
Có hoạt động làm việc nhưng không điểm danh.
Có điểm danh nhưng không hoạt động công việc.
Có phiên làm việc nhưng không ghi nhận công/lương.
Có lương nhưng không có điểm danh/phiên làm việc/bằng chứng.
Có hoa hồng nhưng không nối được lead/order/profit.
Nhân viên xử lý đơn nhưng không có activity log.
Sửa dữ liệu sau kỳ chốt.
Manual adjustment thiếu người duyệt.
Tài khoản hoạt động ngoài ca.
```

### 19.3. Data required

```text
employees
roles
shift_schedule
attendance_sessions
work_sessions
activity_logs
call_logs
lead_activity
order_activity
task_logs
payroll_items
commission_items
leave_requests
remote_work_approvals
manual_adjustments
approval_logs
audit_logs
```

### 19.4. Data quality metrics

```text
attendance_work_match_rate
work_payroll_match_rate
payroll_attendance_match_rate
commission_order_match_rate
employee_activity_log_completion_rate
manual_adjustment_review_rate
post_period_edit_count
employee_integrity_anomaly_count
```

Rules:

```text
Nếu attendance_work_match_rate < 90% → không xếp hạng nhân viên mạnh.
Nếu payroll_attendance_match_rate < 95% → không kết luận chi phí lương chính xác.
Nếu commission_order_match_rate < 95% → không dùng hoa hồng để xếp hạng mạnh.
```

---

## 20. Sales process and script improvement

Data:

```text
sales_stage
script_version
offer_version
objection_type
lost_reason
followup_count
time_to_quote
quote_to_deposit_rate
quote_to_won_rate
sample_size
profit_per_script
```

Rules:

```text
Không kết luận script thắng/thua nếu sample_size thấp.
price_too_high cao → cải tiến value proposition/script xử lý giá.
slow_response cao → SLA/automation/phân lead.
competitor cao → nghiên cứu offer đối thủ.
quoted nhiều nhưng won thấp → xem báo giá/ưu đãi/chốt cọc.
```

---

## 21. Pre-export sync & freshness gate

### 21.1. Quy trình đúng khi bấm xuất

```text
User bấm xuất
→ tạo export job
→ kiểm tra nguồn dữ liệu stale không
→ chạy read-only sync nếu cần
→ tính lại Data Quality/Mapping/Reports
→ freshness gate
→ snapshot
→ export JSON/XLSX
```

### 21.2. Không dùng GET để sync

GET endpoint hiện tại chỉ nên export cached/read-only.

Nên thêm sau BA:

```text
POST /api/ai/data-pack/export-jobs
GET /api/ai/data-pack/export-jobs/:job_id
GET /api/ai/data-pack/export-jobs/:job_id/download
```

### 21.3. Export modes

```text
official_export / sync_required
partial_export / sync_if_stale
cached_export
```

Rules:

```text
official_export yêu cầu freshness đạt ngưỡng.
partial_export cho phép xuất kèm warning.
cached_export chỉ dùng test, không dùng quyết định thật.
```

### 21.4. Sources cần freshness

```text
google_ads
meta_ads
tiktok_ads
zalo_ads
crm_leads
orders/payments
finance/debt/cashflow
operations
product_mapping
supplier_settlement
return/refund
employee attendance/work/payroll
system/automation health
```

Each source:

```text
last_successful_sync_at
last_source_data_at
freshness_minutes
freshness_status
sync_status
records_inserted
records_updated
error
can_use_for_decision
```

---

## 22. Data Quality Gates

### 22.1. Existing gates

```text
lead_source_mapping_rate < 90% → cảnh báo
order_profit_completion_rate < 80% → không kết luận profit mạnh
campaign_service_mapping_rate < 80% → không scale/live
order_service_mapping_rate < 90% → cảnh báo
order_customer_mapping_rate < 90% → không dùng LTV mạnh
ads_data_freshness_hours quá ngưỡng → khóa quyết định ads mạnh
attribution_confidence < 0.8 → khóa scale/live
```

### 22.2. New gates for dropship/settlement

```text
supplier_commission_received_mapping_rate < 90% → không kết luận cash-adjusted profit mạnh
supplier_settlement_freshness stale → không scale supplier/product mạnh
tier2_payable_mapping_rate < 95% → không kết luận nghĩa vụ hoa hồng chắc chắn
cash_ownership_completion_rate < 95% → không dùng cash để quyết định mạnh
```

### 22.3. New gates for product/refund/referral

```text
return_reason_completion_rate < 80% → không kết luận nguyên nhân hoàn
order_delivery_status_completion_rate < 90% → không kết luận delivery lag mạnh
referral_mapping_rate < 80% → không phân bổ referral value mạnh
commission_received_mapping_rate < 90% → không kết luận cash-received ads performance mạnh
```

### 22.4. New gates for employee integrity

```text
attendance_work_match_rate < 90% → không xếp hạng nhân viên mạnh
payroll_attendance_match_rate < 95% → không kết luận chi phí lương chắc chắn
commission_order_match_rate < 95% → không dùng hoa hồng để xếp hạng mạnh
employee_activity_log_completion_rate thấp → chỉ request_missing_data
```

---

## 23. Mapping Report cần bao phủ

### 23.1. Existing chain

```text
ads platform
→ ads account
→ campaign
→ ad group/ad set
→ ad/creative
→ keyword/search term
→ UTM/landing
→ lead
→ sale
→ customer
→ order
→ service_group
→ product_variant
→ revenue
→ gross profit
→ net profit
```

### 23.2. Dropship chain

```text
order
→ supplier
→ supplier collected cash
→ commission expected
→ commission confirmed
→ commission received
→ tier2 payable
→ tier2 paid
→ tier1 realized net profit
```

### 23.3. Product/supplier pool chain

```text
product_market_opportunity
→ product_variant
→ supplier_offer_pool
→ supplier_allocation
→ supplier_performance
→ product_supplier_profit
```

### 23.4. Referral chain

```text
customer
→ referred_customer
→ referrer_original_campaign/ad_group
→ referred_order
→ referral_value
→ ad_group_referral_impact
```

### 23.5. Lag/return chain

```text
order
→ supplier confirmation
→ delivery status
→ cash/commission received
→ return/refund status
→ return reason
→ adjusted ads performance
```

### 23.6. People/integrity chain

```text
employee
→ attendance
→ work session
→ activity log
→ task/order/lead result
→ payroll
→ commission
→ anomaly alert
```

---

## 24. ChatGPT Web output spec

ChatGPT Web phải trả lời bằng tiếng Việt, tối thiểu gồm:

```text
1. Tóm tắt điều hành.
2. Chất lượng dữ liệu và các phần không đủ kết luận.
3. Mode hôm nay: monitor / cautious / blocked / controlled_growth / protect_cashflow.
4. Growth bottleneck chính và phụ.
5. Có nên tăng/giữ/giảm ads không.
6. Sản phẩm có market tốt.
7. Supplier pool và supplier allocation.
8. Product testing portfolio: scale/hold/kill/investigate.
9. Test budget còn lại và phân bổ đề xuất.
10. Return/refund/hàng hoàn và nguyên nhân.
11. Referral impact lên campaign/ad group.
12. Delivery/cash lag ảnh hưởng ads/profit.
13. Sale bottleneck và script/process issue.
14. Operation/SLA bottleneck.
15. Employee scorecard/staffing/coaching nếu dữ liệu đủ.
16. Employee data integrity anomalies nếu có.
17. Supplier settlement/cash ownership risk.
18. Việc cần giám đốc duyệt.
19. Việc giao marketer/sale/vận hành/tài chính/admin.
20. Việc không được làm hôm nay.
21. Action draft an toàn.
```

---

## 25. Action draft rules

### 25.1. Action draft được phép

```text
monitor_only
request_missing_data
investigate
hold
needs_director_approval
suggest_budget_change
suggest_negative_keyword
suggest_service_priority
suggest_supplier_sourcing
suggest_supplier_reallocation
suggest_product_test
suggest_kill_test
suggest_scale_lightly
suggest_sale_followup
suggest_sale_script_review
suggest_training
suggest_staffing_review
suggest_operation_check
review_attendance
review_payroll
review_commission
collect_supplier_receivable
request_return_reason_review
```

### 25.2. Action executable bị cấm hiện tại

```text
change_ads_budget_live
pause_campaign_live
create_campaign_live
send_customer_message_auto
change_order_status_auto
record_payment_auto
pay_supplier_auto
pay_tier2_agent_auto
change_commission_policy_auto
change_price_auto
auto_cut_salary
auto_penalize_employee
auto_accuse_fraud
auto_refund_decision
execute_provider_mutation
```

### 25.3. Điều kiện tương lai để executable action

Chỉ xem xét ở giai đoạn sau nếu có:

```text
schema validation
permission
quality gate
mapping gate
approval
dry-run
provider validateOnly nếu có
execution confirmation
rollback plan
execution log
post-sync
evaluation 1/3/7 ngày
```

---

## 26. Data size strategy

Không xuất tất cả raw data vào một file giám đốc.

### 26.1. Executive Pack

Mục tiêu: nhỏ, dùng hằng ngày.

```text
< 5MB mục tiêu
summary
finance
settlement
ads summary
product market summary
supplier health summary
people/process summary
data quality
mapping quality
alerts
action draft rules
```

### 26.2. Drilldown Pack

Dùng khi cần điều tra.

```text
campaign/ad group detail
product/supplier detail
return/refund detail
sales funnel detail
employee detail
settlement aging
```

### 26.3. Exception Pack

Chỉ chứa bất thường:

```text
supplier overdue
return spike
ads spend no order
product profit negative
commission overdue
employee integrity anomaly
stale sync
missing mapping
```

### 26.4. Raw Evidence Pack

Chỉ xuất khi cần:

```text
raw_orders.csv
raw_leads.csv
raw_ads_metrics.csv
raw_supplier_settlements.csv
raw_payroll_commissions.csv
```

Rule:

```text
Nếu row_count/file_size lớn → tách file theo domain/date range.
Không upload raw lớn mặc định lên ChatGPT Web.
Luôn có manifest.
```

---

## 27. Source of truth and conflict resolution

Mỗi metric phải có source of truth.

Ví dụ:

```text
cash_available → bank/FinancialControl canonical
expected_commission → supplier/order settlement source
received_commission → bank/cashflow/settlement receipt
ads cost → provider sync / ad cost source
order status → ERP order source
return/refund → ERP/refund/support source
payroll → payroll source
attendance → attendance source
```

Nếu nguồn xung đột:

```text
ERP order completed nhưng supplier chưa xác nhận → settlement not confirmed.
Supplier báo đã trả nhưng bank chưa ghi nhận → cash not received.
Sale báo khách đã cọc nhưng payment chưa có → payment pending.
```

ChatGPT Web phải ghi conflict, không chọn bừa.

---

## 28. Acceptance criteria BA

### 28.1. Business acceptance

BA đạt nếu:

```text
Liệt kê đủ mục tiêu giám đốc.
Liệt kê đủ quyết định cần ra.
Liệt kê dữ liệu cần có cho từng quyết định.
Có rule cho dữ liệu rỗng/0/null/âm.
Có freshness rule.
Có quality/mapping gate.
Có ChatGPT output spec.
Có action draft allowed/forbidden.
Có traceability từ mục tiêu đến data/sheet/API/code backlog.
```

### 28.2. Export acceptance

```text
Data Pack đủ schema.
Rỗng/null có reason.
Mọi section có quality metadata.
Metadata có freshness.
Decision gate đúng.
Không lộ secret/PII.
Checksum deterministic cho content.
```

### 28.3. ChatGPT Web acceptance

```text
Không bịa số liệu.
Không kết luận mạnh khi data yếu.
Phân biệt estimated/realized.
Phân biệt expected/confirmed/received cash.
Không dùng GMV như cash.
Không kill product vì 1 supplier yếu.
Không scale ads khi freshness/mapping yếu.
Action draft không vượt quyền.
```

---

## 29. Backlog code sau khi BA được duyệt

### P0 — Export fixes

```text
XLSX empty sheet giữ quality metadata.
generated_by string/null.
data_content_checksum deterministic.
finance quality split cash vs debt schedule.
zero/missing/not_synced/not_configured/no_records distinction.
```

### P0 — BA-driven schema expansion

```text
business_model_context
cash_ownership_reconciliation
supplier_settlement
commission receivable/payable
product_market_opportunities
supplier_offer_pool
return/refund quality
referral attribution
lag-adjusted ads performance
growth bottleneck diagnosis
employee data integrity
```

### P0 — Pre-export sync & freshness gate

```text
POST export job
read-only sync if stale
freshness metadata
snapshot
partial/official/cached modes
source stale blocking rules
```

### P1 — Staging fixture full

```text
order + lead + ads + supplier + returns + referral + employee + payroll sample
fixture_full Data Pack
ChatGPT Web upload test
```

### P1 — Data Quality/Mapping Erweiterung

```text
settlement quality
return/refund quality
referral mapping
lag mapping
employee integrity metrics
```

### P2 — OpenAI key and upload normalization

Chỉ sau khi security P0 xử lý.

### P3 — Action import + validate + dry-run

Schema/action draft normalization, no live.

### P4 — Controlled execution

Chỉ sau approval, dry-run, validateOnly, rollback, logs, post-sync.

---

## 30. Câu hỏi cần giám đốc xác nhận trước khi code tiếp

1. Định nghĩa chính thức `cash_available`, `free_cash`, `expected_cash_inflow`.
2. Quỹ dự phòng tối thiểu và số tháng sống còn mục tiêu.
3. Max daily ads budget.
4. Max budget increase percent.
5. Max test loss per day/test/product/supplier.
6. Khoản vay nào được phép dùng cho ads/test.
7. Campaign/service/product nào protected.
8. Product market nào là ưu tiên chiến lược.
9. Supplier payout delay tối đa chấp nhận được.
10. Return/refund rate ngưỡng cảnh báo theo product/supplier.
11. Chính sách trả hoa hồng cấp 2: trả sau supplier paid hay trả theo cam kết riêng.
12. Referral attribution window là bao nhiêu ngày.
13. Attribution split khi khách vừa referral vừa click ads.
14. Khi dữ liệu ads stale bao lâu thì block scale.
15. Khi dữ liệu finance stale bao lâu thì block budget increase.
16. Ai được duyệt action draft.
17. Action nào tuyệt đối không cho AI đề xuất.
18. Chính sách export dữ liệu có PII.
19. Chính sách dữ liệu nhân sự/lương/hoa hồng ai được xem.
20. Có muốn ChatGPT Web nghiên cứu web về đối thủ/pháp lý/thị trường không.

---

## 31. Prompt gợi ý giao Codex sau khi BA được duyệt

```text
Đọc file BA Master Director AI Data Pack.
Không tự suy diễn nghiệp vụ ngoài BA.
Chỉ triển khai các hạng mục đã được đánh dấu P0 và được giám đốc duyệt.
Trước khi code, lập implementation plan mapping từng requirement BA → file/module/test.
Không thêm OpenAI key, upload normalization, action import, dry-run, live execution nếu không có lệnh riêng.
Mọi endpoint/export phải giữ read-only, quality metadata, source, freshness, confidence, redaction và decision gate.
```

---

## 32. Kết luận

Tài liệu BA này xác định mục tiêu hệ thống không chỉ là “xuất dữ liệu cho ChatGPT Web”, mà là xây dựng một **hệ thống radar giám đốc**:

```text
Phát hiện nghẽn tăng trưởng.
Phát hiện rủi ro vốn/dòng tiền.
Phát hiện ads tốt/xấu sau khi điều chỉnh referral, return, cash lag.
Phát hiện product có thị trường tốt nhưng supplier yếu.
Phát hiện supplier/đối tác cần giảm allocation hoặc thay thế.
Phát hiện sale/process/script cần cải tiến.
Phát hiện cần tuyển thêm người hay đào tạo.
Phát hiện dữ liệu nhân sự/lương/hoa hồng mâu thuẫn.
Phát hiện dữ liệu yếu/stale/mapping đứt.
Đề xuất action draft an toàn.
Không tự thực thi live.
```

**Nguyên tắc cuối:**

```text
BA là bản đồ.
Data Pack là radar.
ChatGPT Web là analyst.
ERP là source of truth và safety gate.
Codex chỉ là người thi công sau khi bản đồ đã khóa.
```
