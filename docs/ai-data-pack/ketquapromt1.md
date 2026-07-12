# Kết quả Prompt 1 - BA-to-ERP Traceability & Gap Analysis

Ngày kiểm tra: 2026-06-13  
Phạm vi: đọc tài liệu, source code, schema, service, controller, test và sample export; không sửa source code, không migration, không gọi provider, không thay đổi dữ liệu.

## 1. Executive Summary

- ERP đã khớp tốt với **baseline Phase 2 read-only export**: 7 endpoint đã HTTP 200, Director Pack đủ 25/25 sheet, Marketer Pack đủ 14/14 sheet, Data Quality/Mapping/Decision History có contract và guardrail.
- ERP **chưa khớp end-to-end với BA Master mở rộng**. BA đề xuất 62 sheet mới từ `25_business_model_context` đến `86_incentive_alignment_review`; hiện chưa sheet nào được đưa vào Director Pack. Nhiều nguồn dữ liệu có thể tái sử dụng nhưng mapping, freshness, source-of-truth và permission chưa đủ.
- Không có domain BA nào nên coi là hoàn chỉnh end-to-end. Finance, dropship settlement, ads, supplier/agent và payroll có nền tảng mạnh nhưng vẫn chỉ `partial`.
- Phần có thể code đầu tiên chỉ là **PR-2.2: P0 Export Fixes compile repair + verification/acceptance hardening**. Current working-tree source đã chứa candidate fix cho cả 5 lỗi 2.2, nhưng sample artifact ngày 2026-06-12 vẫn thể hiện lỗi cũ; focused test và backend build ngày 2026-06-13 đều đang fail compile.
- Phần cần technical spec trước: pre-export sync/export job, source-of-truth registry, freshness thresholds, partial export behavior, section-level RBAC, cash ownership, tier-2 payout policy và product-market identity.
- Schema-only V1 phù hợp cho: business model context, cash ownership reconciliation, product market opportunity, supplier offer/allocation, referral attribution, growth bottleneck, employee integrity, source-of-truth registry, system health và decision learning.
- V2 migration cần cho durable order-lead-customer-attribution, referral graph, delivery/status history, supplier settlement semantics, product market/test lifecycle, SLA/capacity, attendance/activity/payroll audit và export/sync job lifecycle.
- Chưa được export chi tiết employee/payroll, customer PII, supplier/agent commission hoặc manual adjustments qua Director Pack nếu chưa có section-level RBAC và export audit. Hiện `ai-data-pack.director.read` còn cấp cho `investor`.
- Chưa được code OpenAI key, upload normalization, generic action import/dry-run hoặc live execution.
- Cần ChatGPT Web Pro Extended và giám đốc phản biện báo cáo này trước khi chuyển sang bất kỳ phase code nào ngoài PR-2.2.

## 2. Current ERP Baseline

### Read-only export layer

Module tái sử dụng chính:

- `backend/src/ai-data-pack/`: Director/Marketer Pack, Data Quality, Mapping, Decision History, JSON/XLSX, redaction.
- `backend/src/finance/`: `FinancialControlService`, loan/disbursement/repayment, cashflow snapshot.
- `backend/src/test-order2/`: order, supplier/agent payment, estimated/realized profit, payment aging.
- `backend/src/supplier-payable/`: supplier receivable/settlement logic dù tên legacy là payable.
- `backend/src/agent-receivable/`: tier-2/agent payable logic dù tên legacy là receivable.
- `backend/src/google-ads/`: read-only sync, sync run, export, approval/validateOnly/execution logs.
- `backend/src/advertising-cost/`: Google/Meta/TikTok cost sync and health.
- `backend/src/ai-marketing/`: lead funnel and fragmented decision/evaluation history.
- `backend/src/labor-cost1/`, `salary-config/`, `session-log/`: work/payroll/session evidence.
- `backend/src/return-request/`, `return-report/`: return records and aggregate reports.

### Phase 2.1 acceptance

- 7/7 export endpoint trả HTTP 200.
- Director XLSX đủ 25 sheet; Marketer XLSX đủ 14 sheet.
- Secret/PII scan sample: 0 finding.
- Sample DB ngày `2026-06-12`: 0 order trong ngày, 0 advertising cost, 0 marketing lead, 0 Google Ads sync run/daily metric.
- Decision gates đúng trạng thái an toàn: `can_generate_action_draft=true`; import, dry-run, live, scale, strong LTV đều bị khóa khi dữ liệu yếu.

### 25 Director sheet hiện tại

`00_README` đến `24_field_aliases` đều đã có contract. Có dữ liệu usable cho static rules, finance hiện tại, financing, alerts, quality và mapping. Marketing, product/service performance, unit economics, funnel/team, decision options và external market còn rỗng/schema-only trên sample.

### Lỗi 2.2 và trạng thái source hiện tại

| Lỗi sample 2026-06-12 | Evidence sample | Evidence current source | Kết luận |
|---|---|---|---|
| Empty XLSX mất quality metadata | Sample chỉ còn `status=empty` | `XlsxExporterService.toRows()` hiện thêm `qualityColumns()` khi `data=[]` | Candidate fixed, cần test + regenerate |
| `generated_by` thành ObjectId buffer | Sample JSON có `generated_by.buffer` | Metadata hiện dùng `generated_by_user_id/role/display` và `safeString()` | Candidate fixed, cần contract acceptance |
| Checksum không deterministic | Sample metadata checksum thay đổi | `JsonExporterService.normalizeContent()` bỏ timestamp/runtime fields | Candidate fixed, cần two-run test |
| Finance quality quá lạc quan | Sample financial context là `ok/yes` dù debt schedule thiếu | `FinanceDataQuery` có `quality_dimensions` cash/debt/loan/forecast/overall | Candidate fixed, cần sample có thiếu debt |
| Không phân biệt trạng thái giá trị | Sample chủ yếu `missing` | Contract hiện có `DataState` và metric `value_state` | Partial candidate fix; cần coverage toàn section |

### Current compile/test blocker

Verification ngày `2026-06-13`:

```text
cd backend
npm test -- --runInBand ai-data-pack
```

Kết quả: fail trước khi chạy test. Test code còn gọi `FinanceDataQuery.get()` thiếu `reportDate`, và khởi tạo `DataQualityReportService`/`MappingReportService` thiếu `JsonExporterService`.

```text
cd backend
npm run build
```

Kết quả: fail với 8 TypeScript errors. Nguyên nhân chính là generic constraint của `JsonExporterService.attachChecksums<T extends { metadata: Record<string, unknown> }>` không chấp nhận `AiDataPackMetadata`, làm Director/Marketer/DataQuality/Mapping return types không compile.

Vì vậy current source chỉ là candidate, chưa được coi là implementation đạt.

## 3. BA Domain Inventory

| Domain | Business purpose | Current support | Existing evidence | V1 option | V2 migration | Security concern | Priority | Recommended phase |
|---|---|---|---|---|---|---|---|---|
| `strategy_goals` | Mục tiêu, giới hạn, protected/test policy | partial | `SystemSettings` allowlist, finance/ad-group configs | alias then schema-only | yes | Director policy visibility/audit | P1 | PR-2.6/spec |
| `finance_capital` | Cash, debt, loans, test/ads capital | partial | FinancialControl, LoanContract, LoanRepayment, CashflowEntry | implement aggregation | unclear | finance-only details | P0 | PR-2.2 then 2.3 |
| `dropship_settlement_cash_ownership` | Tách GMV, supplier cash, tier-1/tier-2 commission | partial | TestOrder2 payment fields, SupplierPayable, AgentStatement | alias + schema-only + aggregation | yes | supplier/commission confidentiality | P0 | PR-2.6 |
| `ads_growth_acquisition` | Ads-to-lead/order/profit decisions | partial | Google V2, AdGroup, AdvertisingCost, MarketingLead | implement existing chain | yes | provider credentials/action permission | P0 | PR-2.3/2.4 |
| `sale_funnel_script` | Sale funnel and script improvement | partial | MarketingLead status/SLA/lostReason | funnel aggregation; script schema-only | yes | employee performance visibility | P1 | PR-2.10/spec |
| `operations_sla` | Capacity, SLA, workflow bottleneck | partial | order status counts only | schema-only | yes | staff workload privacy | P1 | later spec |
| `supplier_agent_network` | Supplier pool, tier hierarchy, allocation | partial | SupplierQuote, supplierId, agentId, statements | alias + aggregation | yes | commercial terms | P0 | PR-2.7 |
| `people_performance_payroll_integrity` | Fair scorecards and work-payroll reconciliation | partial | LaborCost1, LaborStatement, SalaryConfig, SessionLog | aggregate/redacted schema-only | yes | highest RBAC risk | P1 | PR-2.10 |
| `customer_experience_brand_trust` | Returns, complaints, reviews, support quality | partial | ReturnRequest, ReturnReport, ChatMessage, Customer | aggregate only | yes | customer PII | P1 | PR-2.8 |
| `risk_compliance_security` | Contracts, access, export audit, secret/PII controls | partial | JWT/RBAC, redaction, token audit | schema-only + security spec | yes | export audit absent | P0 | PR-2.3A/security |
| `data_quality_source_of_truth_system_health` | Know what data is trustworthy/fresh | partial | DQ/Mapping, Google sync run, health endpoint | implement registry schema-only first | yes | operational error leakage | P0 | PR-2.3A/B |
| `decision_learning_scenario_planning` | Learn from decisions and simulate | partial | fragmented Google/AI/Ops history; finance scenario | alias + schema-only | yes | approval/audit history | P2 | later |
| `product_discovery_testing_partner_health` | Find/test markets and replace weak suppliers | partial | Product, ProductCategory, SupplierQuote, supplier health aggregates | schema-only + cautious aggregation | yes | supplier terms | P1 | PR-2.7 |
| `referral_lag_adjusted_ads` | Adjust ads by referrals, returns and cash lag | partial | Messenger ad referral events; order/payment/return timestamps | lag aggregation; referral schema-only | yes | customer graph/PII | P1 | PR-2.8/2.9 |

## 4. Requirement-to-Code Mapping

| Requirement ID | BA section / business goal | Required data | Existing ERP support | Support | Main risk | Recommended path | Test required |
|---|---|---|---|---|---|---|---|
| G1-CASH | G1 protect cash | bank/free/committed cash, debt, supplier/tier2 obligations | FinancialControl, finance, supplier/agent summaries | partial | cash ownership semantics | aggregate after policy confirmation | canonical cash + debt fixtures |
| G2-PROFIT | G2 profitable growth | GMV, expected/received commission, estimated/realized profit | TestOrder2 + settlement modules | partial | GMV/revenue meaning | dropship alias contract | estimated vs realized tests |
| G3-ADS | G3 allocate ads | campaign/ad-group, cost, lead/order/profit, freshness | Google V2, AdGroup, AdvertisingCost, MarketingLead | partial | weak attribution | improve mapping/freshness first | mapping/freshness gate tests |
| G4-MARKET | G4 product market | demand, lead quality, close rate, market score | product + lead/order proxies | missing | product market conflated with supplier | schema-only V1 | empty/schema contract |
| G5-SUPPLIER | G5 supplier pool | quotes, settlement, return, SLA, capacity | SupplierQuote, SupplierPayable, TestOrder2 | partial | terminology and missing SLA | cautious aggregation | supplier pool fixture |
| G6-SALES | G6 sale/script | status, response SLA, lost reason, script/offer | MarketingLead partial | partial | no script version/activity history | funnel aggregation; scripts schema-only | low-sample rule |
| G7-OPS | G7 operations/SLA | status history, cycle time, capacity/staff | current status counts only | missing | cannot infer capacity | schema-only until model exists | unavailable/blocked rule |
| G8-PEOPLE | G8 employee/payroll | work, attendance, activity, payroll, commission | labor/payroll/session partial | partial | missing attendance/activity + RBAC | aggregate/redacted schema-only | permission + reconciliation fixtures |
| G9-CX | G9 customer trust | return/refund/complaint/referral | ReturnRequest/Report, ChatMessage, Customer | partial | PII and weak reason taxonomy | aggregate/redacted | PII/redaction tests |
| G10-COMPLIANCE | G10 compliance/security | contracts, tax, audit, permissions | auth/redaction/token audit only | partial | no export audit/contract source | security spec/schema-only | role matrix tests |
| G11-DQ | G11 source of truth | sync run, freshness, mapping, health | DQ/Mapping + Google run | partial | max `updatedAt` is not sync proof | source registry/export job spec | stale/unsupported cases |
| G12-LEARN | G12 decision learning | decision/evaluation/rollback/scenario | Google/AI/Ops fragmented | partial | no unified cross-domain history | alias/schema-only | source provenance tests |
| DROP-01 | §9 order money flow | order/supplier/tier1/tier2/cost/profit | TestOrder2 fields | partial | no explicit customer-paid-to/cash status | alias + schema-only | order money flow fixture |
| SETTLE-01 | §9 supplier settlement | expected/confirmed/received/overdue | SupplierPayable + statements + payment ops | partial | `SupplierPayable` name is semantically reversed | alias registry + aggregation | settlement aging tests |
| TIER2-01 | §9 tier2 payable | agent hierarchy, condition, due/paid | AgentStatement/TestOrder2 agent fields | partial | agent may not always mean tier2; policy unclear | mark unclear until director confirms | conditional/committed tests |
| CASHOWN-01 | §9 cash ownership | owner/location/allowed use/real vs expected | scattered finance/settlement data | missing | unsafe ads/payroll decisions | schema-only first | policy fixture |
| RET-01 | §12 return/refund | reason, supplier/product/ad group rates | ReturnRequest + ReturnReport | partial | free-text reason and status regex | normalize in V2; aggregate V1 | taxonomy/unknown reason tests |
| REF-01 | §15 customer referral | referrer/referred graph and original ads | no durable customer referral model | missing | duplicate attribution/PII | schema-only only | no-double-count tests later |
| LAG-01 | §16 fulfillment/cash lag | lifecycle timestamps and payment timestamps | partial TestOrder2/payment/return data | partial | supplier-confirm/delivered/customer-paid timestamps incomplete | cautious aggregation | missing timestamp states |
| PREEXPORT-01 | §21 pre-export sync | export job, sync run, snapshot, freshness gates | no export job; Google sync run only | missing | GET must remain read-only | technical spec then PR-2.3B | idempotency/concurrency tests |
| ACTION-01 | §25 action safety | draft/approval/validateOnly/policy/log | Google V2 strong; generic path fragmented | partial | bypass through legacy path | keep draft-only; defer generic import/live | safety invariant tests |
| SECURITY-01 | §4/§27/§28 | section RBAC, PII, export audit | broad pack permissions + redaction | partial | investor can read Director Pack | section-level permission spec | role/field-level tests |

## 5. BA Field Mapping

| BA field/group | ERP model/field | Meaning | Mapping type | Confidence | V1 handling | V2 recommendation |
|---|---|---|---|---|---|---|
| `cash_available`, `bank_balance` | FinancialControl `bankBalance` | canonical real bank cash | direct | high | implement | keep provenance |
| `free_cash`, `committed_cash`, `survival_buffer` | FinancialControl metrics | spendable/survival context | direct/derived | medium | implement cautious | policy/version audit |
| `expected_cash_inflow` | approved-not-disbursed LoanContract | expected, not real cash | derived | medium | separate bucket | normalized loan status |
| debt service 30d/90d | LoanRepayment via `getDebtCashflowSummary()` | future obligations | derived | medium-low | warning if schedule incomplete | durable schedule contract |
| GMV/order value | TestOrder2 deposit+COD+manual payment | order value proxy | derived | medium | label proxy | explicit GMV field |
| supplier collected amount | `codCollectedBySupplier`, COD context | supplier-held cash | direct/alias | medium | never add to cash | settlement ledger |
| commission expected | supplier quote/commission calculations | expected tier-1 income | derived | medium-low | cautious | explicit expected/confirmed/received |
| commission received | SupplierPayable `amountPaid/payments`, order `supplierPaidAmount` | received tier-1 commission | alias | medium | alias with source | normalized receivable ledger |
| tier2 payable/paid | AgentStatement + order agent commission/payment | company obligation to agent | alias | medium-low | mark policy unclear | explicit hierarchy/condition |
| supplier settlement aging | SupplierPayable dueDate/balance + service aging | overdue receivable | derived | medium | implement | normalized settlement cycle |
| supplier pool | SupplierQuote productId/supplierId/price/fees | multiple supplier offers | direct/alias | medium-high | aggregate | offer status/capacity/SLA |
| product market | Product/ProductCategory + lead/order proxies | market opportunity | unclear | low | schema-only | dedicated market/test model |
| product variant | Product | sellable item | alias | medium | keep alias | migrate if taxonomy rejected |
| service group | ProductCategory | ads analysis group | alias | medium | keep alias | migrate if taxonomy rejected |
| campaign/ad group | Google schemas + legacy AdGroup | ads entities | direct/alias | medium-high | implement | durable cross-platform identity |
| campaign/ad group to service | AdGroup `productCategoryId/selectedProducts`; Google internal IDs | ads-to-product mapping | alias | medium-low | quality-gated | durable mapping model |
| lead funnel | MarketingLead status/SLA/lostReason/orderId | lead lifecycle | direct/partial | medium | aggregate | status/assignment/activity history |
| sales script/version | none found | script performance | missing | low | schema-only | dedicated versioned script/offer |
| operation SLA/capacity | current order status counts | workload proxy only | unclear | low | unavailable/schema-only | SLA/capacity/status history |
| return/refund | ReturnRequest reason/items + ReturnReport | returns and aggregate rates | direct/derived | medium | aggregate/redacted | normalized reason/status |
| delivery lag | order date/status/tracking/payment timestamps | lifecycle lag | partial/derived | low-medium | cautious | event/status history |
| customer referral | none durable; Messenger referral is mainly ad/link referral | customer-to-customer value | missing | low | schema-only | referral graph |
| attendance/work | LaborCost1 work sessions; SalaryConfig attendance tiers | work evidence, not true attendance | alias/unclear | low | aggregate only | attendance/shift models |
| payroll | LaborStatement payments/balances | payroll obligation/payment | direct | high | finance/admin-only aggregate | audit/manual adjustments |
| employee activity | SessionLog and fragmented lead/order/chat events | activity evidence | partial | low | schema-only | unified activity log |
| commission-order match | AgentStatement/TestOrder2 | employee/agent commission link | partial | medium | aggregate | durable commission item |
| data quality/mapping | DataQualityReport/MappingReport | trust gates | direct | high | keep/extend | registry + lineage |
| source freshness | Google sync runs; otherwise max `lastSyncAt/updatedAt` or null | freshness proof | partial | medium-low | disclose source type | SyncRun per source |

## 6. Sheet/Section Readiness

### Current Director 25 sheets

| Sheet | Current status | Recommendation | Priority / phase |
|---|---|---|---|
| `00_README` | found | keep | P0 / PR-2.2 verify |
| `01_metadata` | found; sample actor/checksum defect | keep + verify candidate fix | P0 / PR-2.2 |
| `02_chatgpt_web_reading_rules` | found | keep | P0 |
| `03_chatgpt_web_research_rules` | found | keep | P0 |
| `04_director_manual_inputs` | alias/schema-only | keep cautious; V2 model | P1 / PR-2.6 |
| `05_financial_context` | partial | keep + split quality | P0 / PR-2.2 |
| `06_financing_context` | partial | keep aliases; V2 status | P0 |
| `07_cashflow_scenarios` | partial/estimated | keep cautious | P1 |
| `08_business_summary` | partial | keep | P0 |
| `09_marketing_profitability` | partial/data absent sample | keep + fixture | P0 / PR-2.4 |
| `10_service_group_performance` | alias | keep | P0 |
| `11_product_variant_performance` | alias | keep | P0 |
| `12_unit_economics` | partial | keep | P0 |
| `13_ltv_summary` | weak | keep blocked | P1 / V2 mapping |
| `14_sales_funnel` | partial | keep cautious | P1 |
| `15_sales_team` | weak | keep aggregate only | P1 |
| `16_operation_capacity` | weak | keep unavailable/blocked | P1 / V2 |
| `17_decision_history` | partial | keep + unify later | P2 |
| `18_alerts` | partial | keep | P1 |
| `19_data_quality` | found | keep + extend | P0 |
| `20_mapping_report` | found | keep + extend | P0 |
| `21_decision_options` | schema-only | keep schema-only | P2 |
| `22_permission_risk_limits` | found static | keep + section RBAC spec | P0 |
| `23_external_market_summary` | schema-only | keep schema-only | P2 |
| `24_field_aliases` | found | keep + add settlement aliases | P0 |

### Marketer Pack 14 sheets

| Sheets | Current status | Recommendation |
|---|---|---|
| `00_README`-`03_chatgpt_web_research_rules` | found | keep |
| `04_accounts`-`09_daily_metrics` | Google-focused partial; sample empty | keep, fixture and freshness gate |
| `10_leads_by_source` | partial; sample empty | keep, improve mapping |
| `11_data_quality`, `12_mapping_report` | found | keep, extend with return/settlement/referral |
| `13_allowed_actions` | safe static contract | keep `monitor_only=true`, `live_execution=false` |

### Minimum new BA sheets

| Sheet | Current support | V1 recommendation | Migration | Priority / phase |
|---|---|---|---|---|
| `business_model_context` | missing | schema-only static, director-approved | no | P0 / PR-2.6 |
| `order_money_flow` | partial sources | alias + cautious aggregation | yes | P0 / PR-2.6 |
| `supplier_settlement` | partial strong sources | implement aggregation | yes | P0 / PR-2.6 |
| `tier1_commission_receivable` | partial strong sources | implement aggregation | yes | P0 / PR-2.6 |
| `tier2_commission_payable` | partial/unclear hierarchy | schema-only then aggregate | yes | P0 / PR-2.6 |
| `cash_ownership_reconciliation` | missing | schema-only | yes | P0 / PR-2.6 |
| `product_market_opportunities` | missing | schema-only | yes | P1 / PR-2.7 |
| `product_market_scorecard` | missing | schema-only | yes | P1 / PR-2.7 |
| `supplier_offer_pool` | partial | aggregate cautiously | yes | P1 / PR-2.7 |
| `product_supplier_comparison` | partial | aggregate | unclear | P1 / PR-2.7 |
| `supplier_allocation_matrix` | missing | schema-only | yes | P1 / PR-2.7 |
| `return_refund_quality` | partial | aggregate + quality | yes | P1 / PR-2.8 |
| `fulfillment_delivery_lag` | partial | cautious aggregation | yes | P1 / PR-2.8 |
| `return_adjusted_marketing_profitability` | partial | schema-only until mapping passes | yes | P1 / PR-2.8 |
| `customer_referral_attribution` | missing | schema-only | yes | P1 / PR-2.9 |
| `ad_group_referral_impact` | missing | schema-only | yes | P1 / PR-2.9 |
| `growth_bottleneck_diagnosis` | missing | schema-only | unclear | P2 |
| `growth_constraint_scorecard` | missing | schema-only | unclear | P2 |
| `employee_performance_scorecard` | partial but unsafe | aggregate/redacted schema-only | yes | P1 / PR-2.10 |
| `employee_data_integrity` | missing | schema-only, director-only | yes | P1 / PR-2.10 |
| `attendance_work_reconciliation` | missing | schema-only | yes | P1 / PR-2.10 |
| `payroll_work_reconciliation` | partial but unsafe | schema-only, finance/admin-only | yes | P1 / PR-2.10 |
| `sales_script_performance` | missing | schema-only | yes | P2 |
| `workflow_bottleneck_analysis` | missing | schema-only | yes | P2 |
| `source_of_truth_registry` | missing | schema-only first | yes | P0 / PR-2.3A/B |
| `system_health` | partial health endpoint | schema-only + aggregation | yes | P0 / PR-2.3B |
| `decision_learning_log` | partial fragmented | alias/schema-only | yes | P2 |

## 7. P0 Export Fixes Plan - PR-2.2

PR-2.2 must not add BA domain sheets. It must first restore compile/test health, then prove and close the five export defects.

| Fix | Current evidence | Likely files | Proposed approach | Test / acceptance | Risk |
|---|---|---|---|---|---|
| Restore build/test health | build fails 8 errors; focused tests fail compile | `export/json-exporter.service.ts`, affected contracts/services/specs | fix checksum helper typing without weakening runtime behavior; update stale test construction/calls | backend build and focused tests pass before sample regeneration | type workaround may hide contract errors |
| Empty XLSX retains quality | sample fails; current exporter has candidate fix | `export/xlsx-exporter.service.ts`, spec | verify empty row includes all quality columns | parse XLSX and assert warning/confidence/missing/use/data_state | SheetJS flatten regression |
| Actor metadata normalized | sample has buffer; current metadata has candidate fix | `data-pack-metadata.service.ts`, contracts, controller spec | accept string/null only; redact display/PII | ObjectId/string/null fixtures; no buffer/object | breaking metadata consumers |
| Deterministic content checksum | sample fails; current JSON exporter normalizes dynamic fields | `export/json-exporter.service.ts`, spec | separate content checksum from runtime checksum | same content/two times => same content checksum; changed data => changed checksum | excluding meaningful timestamp |
| Finance quality dimensions | sample too optimistic; current query split exists | `queries/finance-data.query.ts`, spec | assert cash/debt/loan/forecast/overall independently | missing debt schedule makes overall cautious, cash may remain ok | false block/false confidence |
| Value-state distinction | current contract/metrics partial | contracts, all queries, DQ service, XLSX | apply states consistently to all empty/zero/estimated/realized sections | fixtures for each required state and XLSX/JSON parity | inconsistent state semantics |

Acceptance commands proposed:

```text
cd backend
npm test -- --runInBand ai-data-pack
npm run build
```

Then regenerate all 7 sample exports for a fixed fixture twice and verify content checksums, sheet quality metadata, actor metadata and redaction.

## 8. Pre-export Sync & Freshness Gate Plan

### Current sync/freshness inventory

| Source | Current implementation | Freshness evidence | Gap |
|---|---|---|---|
| Google Ads full read-only | `GoogleAdsReadonlySyncService`, `GoogleAdsSyncRun` | durable run + per-record `lastSyncAt` | not orchestrated by Data Pack export job |
| Google/Meta/TikTok cost | advertising-cost sync services | health uses latest cost `updatedAt` | no durable common SyncRun; max updatedAt can be misleading |
| Zalo ads | no dedicated ads sync found | unsupported/not_configured | must report explicitly |
| CRM leads | webhook/AI marketing ingestion | max lead `updatedAt/leadCreatedAt` | no SyncRun or expected-source completeness |
| Orders/payments | ERP local writes; Google Sheet export sync | max order `updatedAt/orderDate` | Sheet sync is not source freshness proof |
| Finance | FinancialControl `calculatedAt`, snapshots, local records | calculation/snapshot timestamps | no unified source run/dependency freshness |
| Operations | current order status counts | currently null | no SLA/status-history freshness |
| Supplier settlement | local records/statements | max updatedAt possible | no source-specific sync/run |
| Return/refund | local records | max updatedAt possible | no source-specific sync/run |
| Employee/payroll | local labor/payroll/session records | max updatedAt possible | no attendance/activity source and no secure export policy |
| System health | `/health`, `/health/db` | request-time only | no automation/source health registry |

### Proposed design, no code in this phase

- Add versioned `ExportJob`, `SyncRun`, `DataPackSnapshot` and `SourceOfTruthRegistry` technical contracts.
- `GET` exports stay cached/read-only and never trigger provider sync.
- Future `POST /api/ai/data-pack/export-jobs` selects `official_export`, `partial_export` or `cached_export`.
- `sync_required`: fail/hold official export if any required source cannot be refreshed.
- `sync_if_stale`: attempt read-only sync for supported sources, then export with warnings for unsupported/failed sources.
- `export_cached`: no sync; mark unsuitable for real decisions.
- Use per-source idempotency key `(source, requested_range, mode)` and distributed lock with expiry.
- Persist run status, source-data timestamp, counts, errors, and decision usability.
- Never call provider mutation methods; orchestration allowlist includes read-only sync services only.

## 9. Security/Permission Review

| Data area | Current control | Gap | Required handling |
|---|---|---|---|
| Secrets | interceptor + recursive export redaction | working tree contains credential-like artifacts; broader secret lifecycle unresolved | never export/log plaintext; keep OpenAI phase blocked |
| Customer PII | Data Pack redacts names/phone/address/email/PSID | future referral/CX sheets could reintroduce PII | aggregate/redacted only; no raw customer graph in Executive Pack |
| Employee/payroll | Director has labor/salary permission | Director Pack is also readable by investor; no section-level permission | no detailed employee/payroll sheet until section RBAC; aggregate only |
| Supplier/agent commission | business modules use broad `purchase-costs`/`quotes` permissions | no dedicated finance/supplier-commercial permission | detailed values finance/admin/director only; aggregate for others |
| Export audit | actor metadata exists | no durable export audit/job record | add ExportJob/audit before sensitive exports |
| Manual adjustments/anomalies | fragmented or absent | no approval/audit chain | schema-only; never label fraud |
| Director Pack | director and investor permission | future sensitive sections make current permission unsafe | split pack or section permissions before expansion |

Explicit restrictions:

- Employee-level payroll, commission, attendance, anomaly and manual adjustment details: **do not export** before RBAC/export audit.
- Customer referral graph and raw complaints: **aggregate/redacted only**.
- Supplier contract terms, settlement disputes and commission details: **director/admin/finance-only**.
- Cash ownership and financing details: **director/admin/finance-only**; investor access requires explicit policy.

## 10. Implementation Roadmap

| PR | Scope / why now | Likely files | Tests / acceptance | Not included | Dependency |
|---|---|---|---|---|---|
| PR-2.2 | Verify/close five P0 export defects | current AI Data Pack exporter/metadata/query/contracts/specs | focused tests, build, regenerated samples | no new sheets/endpoints | director approves report |
| PR-2.3A | Pre-export sync/freshness and RBAC technical spec | docs only | review checklist | no implementation | PR-2.2 accepted |
| PR-2.3B | ExportJob/SyncRun/Snapshot/freshness implementation | new read-only orchestration modules | idempotency, concurrency, stale/unsupported, no-mutation tests | no provider mutation | approved 2.3A |
| PR-2.4 | Full staging fixture | fixture/scripts/tests | all domains populated, redaction scan | no production mutation | 2.2/2.3B |
| PR-2.5 | ChatGPT Web upload acceptance | docs/review artifacts | upload and cautious-analysis acceptance | no OpenAI API | 2.4 |
| PR-2.6 | Dropship business model + cash ownership | AI Data Pack contracts/queries only | money-flow/settlement quality fixtures | no payment mutation | policy answers |
| PR-2.7 | Product market + supplier pool | schema-only/aggregations | supplier pool/multi-supplier tests | no supplier allocation mutation | taxonomy approval |
| PR-2.8 | Return/refund + lag-adjusted ads | schema-only/aggregations | lag/missing timestamp/return mapping tests | no auto scale/pause | 2.4 |
| PR-2.9 | Referral attribution schema-only | contracts only | no-double-count and PII policy spec | no inferred allocation | referral policy |
| PR-2.10 | Employee integrity schema-only + RBAC | contracts/permissions/docs | role/aggregate/redaction tests | no ranking/fraud/payroll mutation | RBAC approval |

## 11. Questions for Director

1. Định nghĩa chính thức của `cash_available`, `free_cash`, `expected_cash_inflow` và cash ownership.
2. Max daily ads budget, max budget increase và max test loss theo ngày/test/product/supplier.
3. Khoản vay nào được phép dùng cho ads/test và giới hạn bao nhiêu?
4. Chính sách trả hoa hồng cấp 2: chỉ sau supplier paid hay theo cam kết riêng?
5. `agentId` hiện tại có luôn đồng nghĩa tier-2 agent không?
6. Supplier payout delay bao nhiêu ngày thì warning/block?
7. Return/refund threshold theo product/supplier/channel là bao nhiêu?
8. Referral attribution window và split khi vừa referral vừa click ads.
9. ProductCategory có phải taxonomy `service_group` chính thức không?
10. Ai được xem lương, hoa hồng, employee scorecard, anomaly và supplier terms?
11. Investor có được đọc toàn bộ Director Pack mở rộng không?
12. Action nào tuyệt đối không được AI đề xuất, ngoài danh sách forbidden hiện tại?
13. Official/partial/cached export yêu cầu source nào bắt buộc fresh?
14. Có chấp nhận schema-only V1 cho product market, referral, employee integrity và system health không?

## 12. Final Recommendation

- Có thể code tiếp, nhưng **chỉ PR-2.2** sau khi giám đốc và ChatGPT Web Pro Extended phản biện báo cáo này.
- PR-2.2 phải sửa compile/test blocker trước, sau đó mới verification/acceptance hardening; current source có candidate fixes nhưng chưa build được và sample artifact chưa chứng minh.
- Tuyệt đối chưa code: OpenAI key, upload normalization, generic action import/dry-run, live execution, provider mutation, employee detail export, customer referral detail export và automated payroll/supplier/ads decisions.
- Cần phản biện trước: cash ownership, tier-2 policy, source-of-truth/freshness thresholds, section RBAC, product-market identity và referral attribution.
- Chưa được chuyển Giai đoạn 3 OpenAI API key/upload normalization.
