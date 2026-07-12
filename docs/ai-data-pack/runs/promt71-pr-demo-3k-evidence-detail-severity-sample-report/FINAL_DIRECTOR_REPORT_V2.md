# Báo cáo Giám đốc V2 - Operational Risk Evidence Detail & Severity

## 1. Ghi chú mở đầu

Bản này là report template dựa trên contract đã implement; chưa phải report sinh từ exported enriched JSON.

Nguồn lập báo cáo:

- Prompt69: đã implement read-only evidence detail, drilldown rows và severity scoring MVP.
- Prompt70: đã closeout Prompt69 với trạng thái accepted, có ghi chú nhỏ về naming status.
- Director path dùng để QA: `sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings`.

Không dùng dữ liệu production. Không đọc MongoDB local/server/production. Không gọi provider, Google Ads, Facebook Ads, OpenAI/ChatGPT Web API. Không mở action/import/approval/dry-run/live execution. Không thực hiện business mutation.

Điểm khác so với report cũ:

- Có evidence detail: báo cáo không chỉ nói "có rủi ro", mà chỉ rõ trường nào chứng minh.
- Có severity scoring: mỗi finding có điểm, nhãn và lý do ưu tiên review.
- Có drilldown refs: reviewer biết phải kiểm tra collection/id nào.
- Có raw/checkable values: khi có exported JSON thật, các giá trị gốc sẽ hiển thị từ `evidence_rows[].raw_values_used`.

Vì chưa có rendered enriched rows trong packet Prompt69/70, toàn bộ giá trị bên dưới dùng placeholder dạng `{{...}}`. Đây là vị trí dữ liệu thật sẽ được đổ vào khi có export enriched JSON.

## 2. Executive Summary

| Nhóm vấn đề | Finding | Mức độ | Điểm | Vì sao đáng chú ý | Chủ sở hữu review |
|---|---|---|---:|---|---|
| Tồn kho / bán chạy | `low_inventory_best_seller` | `{{severity_display_label: Rất tốt/Tốt/Bình thường/Chú ý/Nghiêm trọng}}` | `{{severity_score}}` | `{{severity_reason}}` | `{{recommended_manual_owner}}` |
| Giá vốn / giá bán | `supplier_cost_up` | `{{severity_display_label: Rất tốt/Tốt/Bình thường/Chú ý/Nghiêm trọng}}` | `{{severity_score}}` | `{{severity_reason}}` | `{{recommended_manual_owner}}` |
| Công nợ đại lý | `overdue_dealer_receivables` | `{{severity_display_label: Rất tốt/Tốt/Bình thường/Chú ý/Nghiêm trọng}}` | `{{severity_score}}` | `{{severity_reason}}` | `{{recommended_manual_owner}}` |
| Nhân công / overtime | `labor_overtime_high` | `{{severity_display_label: Rất tốt/Tốt/Bình thường/Chú ý/Nghiêm trọng}}` | `{{severity_score}}` | `{{severity_reason}}` | `{{recommended_manual_owner}}` |
| Nhà cung cấp / độ tin cậy | `slow_supplier_good_cost` | `{{severity_display_label: Rất tốt/Tốt/Bình thường/Chú ý/Nghiêm trọng}}` | `{{severity_score}}` | `{{severity_reason}}` | `{{recommended_manual_owner}}` |

## 3. Cách đọc mức độ

- Rất tốt: khỏe, không có rủi ro đáng kể.
- Tốt: có điểm cần theo dõi nhẹ.
- Bình thường: trạng thái bình thường hoặc tín hiệu lẫn lộn.
- Chú ý: cần người phụ trách xem.
- Nghiêm trọng: cần review sớm vì bằng chứng mạnh và tác động có thể lớn.

Mức độ không phải lệnh thực thi. Mức độ chỉ giúp ưu tiên review thủ công.

Trường cần xem:

- `severity_score`: điểm ưu tiên review từ 0 đến 100.
- `severity_label`: mã máy đọc được, ví dụ `CHU_Y`.
- `severity_display_label`: nhãn cho người đọc, ví dụ `Chú ý`.
- `severity_reason`: lý do tổng hợp từ threshold breach, sample size, freshness, data quality, impact và directness.
- `severity_cap_reason`: lý do bị giới hạn điểm nếu dữ liệu còn yếu hoặc chỉ là derived candidate.

## 4. Five Enriched Finding Cards

### Card 1 - Tồn kho thấp ở sản phẩm bán chạy

Tên cảnh báo: Sản phẩm bán chạy có tồn kho thấp.

Canonical key: `low_inventory_best_seller`

Mức độ / điểm:

- Mức độ: `{{row.severity_display_label}}`
- Điểm: `{{row.severity_score}}`
- Lý do chấm mức độ: `{{row.severity_reason}}`
- Lý do giới hạn điểm nếu có: `{{row.severity_cap_reason}}`

Vấn đề kinh doanh:

Sản phẩm có tốc độ bán tốt nhưng tồn kho khả dụng hoặc số ngày cover có thể thấp hơn ngưỡng. Rủi ro là thiếu hàng, lỡ doanh thu, hoặc đặt hàng vội khi chưa xác nhận reserved/incoming stock.

Bằng chứng chính:

- `{{row.evidence_summary}}`
- Entity chính: `{{row.top_evidence_entities}}`
- Số dòng evidence: `{{row.evidence_row_count}}`, sample limit: `{{row.evidence_sample_limit}}`

Dữ liệu thô / giá trị kiểm tra:

Chưa có raw rendered values trong Prompt69/70 packet. Khi có export enriched JSON, phần này lấy từ:

```text
evidence_rows[0].raw_values_used["inventorysummaries.onHand"]
evidence_rows[0].raw_values_used["products.minStock"]
evidence_rows[0].raw_values_used["ordertest2.quantity"]
evidence_rows[0].raw_values_used["ordertest2.orderDate"]
evidence_rows[0].raw_values_used["purchaseorders.items.quantity"]
evidence_rows[0].raw_values_used["purchaseorders.items.quantityReceived"]
```

So sánh ngưỡng:

```text
metric_name: {{row.evidence_threshold_comparison.metric_name}}
metric_value: {{row.evidence_threshold_comparison.metric_value}}
threshold_value: {{row.evidence_threshold_comparison.threshold_value}}
threshold_source_key: {{row.evidence_threshold_comparison.threshold_source_key}}
comparison_result: {{row.evidence_threshold_comparison.comparison_result}}
```

Các bước tính chính:

- `{{row.evidence_calculation_steps[0].step_key}}`: `{{row.evidence_calculation_steps[0].description}}`
- `{{row.evidence_calculation_steps[1].step_key}}`: `{{row.evidence_calculation_steps[1].description}}`

Dữ liệu còn yếu / thiếu:

```text
{{row.evidence_missing_fields_summary}}
```

Dòng drilldown để kiểm tra:

Chưa có drilldown rendered rows trong Prompt69/70 packet. Khi có export enriched JSON, reviewer dùng:

```text
{{row.evidence_drilldown_refs[0].drilldown_ref}}
{{row.evidence_rows[0].source_collection}}:{{row.evidence_rows[0].source_row_id}}
```

Chủ sở hữu review: `{{row.recommended_manual_owner}}`

Câu hỏi review thủ công: `{{row.manual_review_question}}`

Hành động bị chặn:

```text
{{row.blocked_actions_summary}}
```

### Card 2 - Giá vốn nhà cung cấp tăng nhưng giá bán chưa cập nhật

Tên cảnh báo: Giá vốn nhà cung cấp tăng nhanh hơn giá bán đại lý.

Canonical key: `supplier_cost_up`

Mức độ / điểm:

- Mức độ: `{{row.severity_display_label}}`
- Điểm: `{{row.severity_score}}`
- Lý do chấm mức độ: `{{row.severity_reason}}`
- Lý do giới hạn điểm nếu có: `{{row.severity_cap_reason}}`

Vấn đề kinh doanh:

Chi phí mua vào có thể tăng vượt ngưỡng trong khi giá bán chưa phản ánh thay đổi. Rủi ro là biên lợi nhuận bị giảm, nhưng không được tự động đổi giá nếu chưa có workflow phê duyệt.

Bằng chứng chính:

- `{{row.evidence_summary}}`
- Entity chính: `{{row.top_evidence_entities}}`
- Source modules/collections: `supplierquotes`, `quotes`, `products`

Dữ liệu thô / giá trị kiểm tra:

Chưa có raw rendered values trong Prompt69/70 packet. Khi có export enriched JSON, phần này lấy từ:

```text
evidence_rows[0].raw_values_used["supplierquotes.price"]
evidence_rows[0].raw_values_used["supplierquotes.effectiveAt"]
evidence_rows[0].raw_values_used["supplierquotes.status"]
evidence_rows[1].raw_values_used["quotes.unitPrice"]
evidence_rows[1].raw_values_used["quotes.validFrom"]
evidence_rows[2].raw_values_used["products.importPrice"]
evidence_rows[2].raw_values_used["products.suppliers.appliedPrice"]
```

So sánh ngưỡng:

```text
metric_name: {{row.evidence_threshold_comparison.metric_name}}
metric_value: {{row.evidence_threshold_comparison.metric_value}}
threshold_value: {{row.evidence_threshold_comparison.threshold_value}}
threshold_source_key: {{row.evidence_threshold_comparison.threshold_source_key}}
comparison_operator: {{row.evidence_threshold_comparison.comparison_operator}}
comparison_result: {{row.evidence_threshold_comparison.comparison_result}}
```

Các bước tính chính:

- `cost_increase_percent`: so sánh supplier quote hiện tại với supplier quote trước đó cùng product/supplier.
- `dealer_price_lag`: kiểm tra giá bán đại lý mới nhất có cũ hơn ngày hiệu lực giá vốn mới hay không.

Dữ liệu còn yếu / thiếu:

```text
{{row.evidence_missing_fields_summary}}
```

Dòng drilldown để kiểm tra:

```text
{{row.evidence_drilldown_refs[0].drilldown_ref}}
{{row.evidence_drilldown_refs[1].drilldown_ref}}
{{row.evidence_drilldown_refs[2].drilldown_ref}}
```

Chủ sở hữu review: `{{row.recommended_manual_owner}}`

Câu hỏi review thủ công: `{{row.manual_review_question}}`

Hành động bị chặn:

```text
{{row.blocked_actions_summary}}
```

### Card 3 - Công nợ đại lý quá hạn

Tên cảnh báo: Công nợ / settlement đại lý có dấu hiệu quá hạn.

Canonical key: `overdue_dealer_receivables`

Mức độ / điểm:

- Mức độ: `{{row.severity_display_label}}`
- Điểm: `{{row.severity_score}}`
- Lý do chấm mức độ: `{{row.severity_reason}}`
- Lý do giới hạn điểm nếu có: `{{row.severity_cap_reason}}`

Vấn đề kinh doanh:

Đại lý hoặc agent có khoản settlement quá hạn theo ngày due date. Rủi ro là áp lực dòng tiền hoặc follow-up chậm, nhưng dữ liệu agent receivable/payable cần xác nhận lại semantics trước khi hành động.

Bằng chứng chính:

- `{{row.evidence_summary}}`
- Entity chính: `{{row.top_evidence_entities}}`
- Source modules/collections: `ordertest2`, `agentstatements`, `users`

Dữ liệu thô / giá trị kiểm tra:

Chưa có raw rendered values trong Prompt69/70 packet. Khi có export enriched JSON, phần này lấy từ:

```text
evidence_rows[0].raw_values_used["ordertest2.agentPaymentDueDate"]
evidence_rows[0].raw_values_used["ordertest2.agentPaidAmount"]
evidence_rows[0].raw_values_used["ordertest2.agentCommissionFinal"]
evidence_rows[1].raw_values_used["agentstatements.payments.paidAt"]
evidence_rows[1].raw_values_used["agentstatements.payments.amount"]
evidence_rows[2].raw_values_used["users.managerId"]
```

So sánh ngưỡng:

```text
metric_name: {{row.evidence_threshold_comparison.metric_name}}
metric_value: {{row.evidence_threshold_comparison.metric_value}}
threshold_value: {{row.evidence_threshold_comparison.threshold_value}}
threshold_source_key: {{row.evidence_threshold_comparison.threshold_source_key}}
comparison_operator: {{row.evidence_threshold_comparison.comparison_operator}}
comparison_result: {{row.evidence_threshold_comparison.comparison_result}}
```

Các bước tính chính:

- `days_overdue`: số ngày giữa report date và `agentPaymentDueDate`.
- `overdue_balance`: số dư settlement dương còn pending.

Dữ liệu còn yếu / thiếu:

```text
{{row.evidence_missing_fields_summary}}
```

Dòng drilldown để kiểm tra:

```text
{{row.evidence_drilldown_refs[0].drilldown_ref}}
{{row.evidence_rows[0].source_collection}}:{{row.evidence_rows[0].source_row_id}}
```

Chủ sở hữu review: `{{row.recommended_manual_owner}}`

Câu hỏi review thủ công: `{{row.manual_review_question}}`

Hành động bị chặn:

```text
{{row.blocked_actions_summary}}
```

### Card 4 - Overtime tăng cao hơn tăng trưởng doanh thu

Tên cảnh báo: Overtime tăng nhanh hơn workload/revenue.

Canonical key: `labor_overtime_high`

Mức độ / điểm:

- Mức độ: `{{row.severity_display_label}}`
- Điểm: `{{row.severity_score}}`
- Lý do chấm mức độ: `{{row.severity_reason}}`
- Lý do giới hạn điểm nếu có: `{{row.severity_cap_reason}}`

Vấn đề kinh doanh:

Chi phí hoặc giờ overtime tăng nhanh hơn doanh thu/workload. Rủi ro là năng suất thấp hoặc phân bổ nhân sự chưa tốt, nhưng không được tự động đổi lịch, payroll hoặc timesheet.

Bằng chứng chính:

- `{{row.evidence_summary}}`
- Entity chính: `{{row.top_evidence_entities}}`
- Source modules/collections: `laborcost1`, `laborstatements`, `ordertest2`, `users`

Dữ liệu thô / giá trị kiểm tra:

Chưa có raw rendered values trong Prompt69/70 packet. Khi có export enriched JSON, phần này lấy từ:

```text
evidence_rows[0].raw_values_used["laborcost1.userId"]
evidence_rows[0].raw_values_used["laborcost1.date"]
evidence_rows[0].raw_values_used["laborcost1.workHours"]
evidence_rows[0].raw_values_used["laborcost1.cost"]
evidence_rows[2].raw_values_used["ordertest2.depositAmount"]
evidence_rows[2].raw_values_used["ordertest2.codAmount"]
evidence_rows[2].raw_values_used["ordertest2.manualPayment"]
```

So sánh ngưỡng:

```text
metric_name: {{row.evidence_threshold_comparison.metric_name}}
metric_value: {{row.evidence_threshold_comparison.metric_value}}
threshold_value: {{row.evidence_threshold_comparison.threshold_value}}
threshold_source_key: {{row.evidence_threshold_comparison.threshold_source_key}}
comparison_operator: {{row.evidence_threshold_comparison.comparison_operator}}
comparison_result: {{row.evidence_threshold_comparison.comparison_result}}
```

Các bước tính chính:

- `overtime_growth_percent`: so sánh overtime candidate hiện tại với kỳ trước.
- `revenue_growth_percent`: so sánh revenue candidate hiện tại với kỳ trước.
- Emit khi overtime growth vượt revenue growth.

Dữ liệu còn yếu / thiếu:

```text
{{row.evidence_missing_fields_summary}}
```

Dòng drilldown để kiểm tra:

```text
{{row.evidence_drilldown_refs[0].drilldown_ref}}
{{row.evidence_drilldown_refs[1].drilldown_ref}}
{{row.evidence_drilldown_refs[2].drilldown_ref}}
```

Chủ sở hữu review: `{{row.recommended_manual_owner}}`

Câu hỏi review thủ công: `{{row.manual_review_question}}`

Hành động bị chặn:

```text
{{row.blocked_actions_summary}}
```

### Card 5 - Nhà cung cấp giá tốt nhưng giao chậm

Tên cảnh báo: Nhà cung cấp có giá tốt nhưng độ tin cậy giao hàng yếu.

Canonical key: `slow_supplier_good_cost`

Mức độ / điểm:

- Mức độ: `{{row.severity_display_label}}`
- Điểm: `{{row.severity_score}}`
- Lý do chấm mức độ: `{{row.severity_reason}}`
- Lý do giới hạn điểm nếu có: `{{row.severity_cap_reason}}`

Vấn đề kinh doanh:

Nhà cung cấp có giá thấp hơn peer median nhưng có tín hiệu giao chậm hoặc lead time vượt ngưỡng. Rủi ro là quyết định mua chỉ nhìn giá rẻ mà bỏ qua độ tin cậy vận hành.

Bằng chứng chính:

- `{{row.evidence_summary}}`
- Entity chính: `{{row.top_evidence_entities}}`
- Source modules/collections: `supplierquotes`, `purchaseorders`, `products`, `inventorysummaries`, `users`

Dữ liệu thô / giá trị kiểm tra:

Chưa có raw rendered values trong Prompt69/70 packet. Khi có export enriched JSON, phần này lấy từ:

```text
evidence_rows[0].raw_values_used["supplierquotes.price"]
evidence_rows[0].raw_values_used["supplierquotes.currency"]
evidence_rows[1].raw_values_used["purchaseorders.expectedDeliveryDate"]
evidence_rows[1].raw_values_used["purchaseorders.receivedDate"]
evidence_rows[1].raw_values_used["purchaseorders.items.quantityReceived"]
evidence_rows[2].raw_values_used["products.estimatedDeliveryDays"]
evidence_rows[3].raw_values_used["inventorysummaries.avgCost"]
```

So sánh ngưỡng:

```text
metric_name: {{row.evidence_threshold_comparison.metric_name}}
metric_value: {{row.evidence_threshold_comparison.metric_value}}
threshold_value: {{row.evidence_threshold_comparison.threshold_value}}
threshold_source_key: {{row.evidence_threshold_comparison.threshold_source_key}}
comparison_operator: {{row.evidence_threshold_comparison.comparison_operator}}
comparison_result: {{row.evidence_threshold_comparison.comparison_result}}
```

Các bước tính chính:

- `cost_advantage_percent`: so sánh supplier quote hiện tại với median cùng product/currency của peer suppliers.
- `delivery_delay`: tính delay từ `receivedDate - expectedDeliveryDate`.
- Emit khi vừa có cost advantage vừa có delayed PO hoặc lead time vượt ngưỡng.

Dữ liệu còn yếu / thiếu:

```text
{{row.evidence_missing_fields_summary}}
```

Dòng drilldown để kiểm tra:

```text
{{row.evidence_drilldown_refs[0].drilldown_ref}}
{{row.evidence_drilldown_refs[1].drilldown_ref}}
{{row.evidence_rows[1].source_collection}}:{{row.evidence_rows[1].source_row_id}}
```

Chủ sở hữu review: `{{row.recommended_manual_owner}}`

Câu hỏi review thủ công: `{{row.manual_review_question}}`

Hành động bị chặn:

```text
{{row.blocked_actions_summary}}
```

## 5. Báo cáo mới giảm việc phải đi kiểm tra lại như thế nào?

Báo cáo cũ thường chỉ nói có vấn đề, khiến BA/Director phải tự tìm lại record nguồn. Báo cáo V2 giảm việc đó bằng cách:

- Raw values được đưa vào `evidence_rows[].raw_values_used`, để reviewer thấy giá trị gốc được dùng.
- Source row refs được đưa vào `evidence_drilldown_refs` và `evidence_rows[].drilldown_ref`, để biết collection/id cần kiểm tra.
- Threshold comparison được tách riêng trong `evidence_threshold_comparison`, để biết metric nào đang so với ngưỡng nào.
- Calculation steps nằm trong `evidence_calculation_steps`, để biết số liệu được tính từ trường nào.
- Missing/weak fields nằm trong `evidence_missing_fields` và summary, để tránh overclaim.
- Severity score giải thích ưu tiên review qua `severity_reason`, không biến cảnh báo thành lệnh thực thi.

## 6. QA Appendix

Canonical Director path:

```text
sections["16_operation_capacity"].data.operation_capacity.operational_risk_findings
```

Canonical finding keys:

```text
low_inventory_best_seller
supplier_cost_up
overdue_dealer_receivables
labor_overtime_high
slow_supplier_good_cost
```

Evidence fields expected:

```text
evidence_summary
evidence_rows
evidence_row_count
evidence_sample_limit
evidence_entities
evidence_time_window
evidence_direct_fields
evidence_derived_fields
evidence_calculation_steps
evidence_threshold_comparison
evidence_source_freshness
evidence_missing_fields
evidence_verification_fields
evidence_drilldown_refs
recommended_manual_owner
manual_review_question
blocked_actions_summary
top_evidence_entities
evidence_missing_fields_summary
evidence_drilldown_refs_summary
```

Severity fields expected:

```text
severity_score
severity_label
severity_display_label
severity_reason
severity_components
severity_cap_reason
```

Prompt69 verification summary:

```text
5 suites passed
61 tests passed
backend build passed
changed-scope static scan clean
```

Residual limitations:

- Severity scoring is a deterministic MVP rubric, not a trained model.
- Drilldown refs are local collection/id strings, not frontend links.
- Evidence detail uses already-loaded arrays only.
- Missing/weak fields are conservative to prevent overclaiming.

No-action boundary:

- Không tạo Action Draft Schema.
- Không import action.
- Không mở approval workflow.
- Không gọi provider.
- Không dry-run/live execution.
- Không mutation DB hoặc business process.

## 7. Next recommendation

Recommended next safe step:

```text
Prompt72 / PR-DEMO-3L — evidence_detail_severity_sample_report_readability_review_no_action
```

Purpose:

- Cho người dùng review xem báo cáo mới đã bớt chung chung và dễ kiểm tra hơn chưa.
- Vẫn không production DB/action/provider/mutation.

Không mở Action Draft Schema ở bước tiếp theo.
