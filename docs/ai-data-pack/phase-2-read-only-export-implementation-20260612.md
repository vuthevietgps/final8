# Bao cao trien khai Giai doan 2 - AI Data Pack Read-only Export Layer

Ngay bao cao: 2026-06-12

## 1. Pham vi da trien khai

Da tao read-only export layer tai `backend/src/ai-data-pack/` cho:

- Director Data Pack.
- Marketer Data Pack Google-focused V1.
- Data Quality Report.
- Mapping Report.
- Decision History export.
- JSON deterministic export va XLSX nhieu sheet.
- Metadata, source, freshness, confidence, quality flags.
- ChatGPT Web reading rules va research rules.
- Secret/PII redaction va permission guard.

Khong them OpenAI integration, upload normalization, action import, general action dry-run, live execution, migration, hoac ads mutation API.

## 2. File da them/sua

### Them module AI Data Pack

- `backend/src/ai-data-pack/ai-data-pack.module.ts`
- `backend/src/ai-data-pack/ai-data-pack.controller.ts`
- `backend/src/ai-data-pack/director-data-pack.service.ts`
- `backend/src/ai-data-pack/marketer-data-pack.service.ts`
- `backend/src/ai-data-pack/data-quality-report.service.ts`
- `backend/src/ai-data-pack/mapping-report.service.ts`
- `backend/src/ai-data-pack/decision-history-export.service.ts`
- `backend/src/ai-data-pack/data-pack-metadata.service.ts`
- `backend/src/ai-data-pack/export/json-exporter.service.ts`
- `backend/src/ai-data-pack/export/xlsx-exporter.service.ts`
- `backend/src/ai-data-pack/contracts/*.ts`
- `backend/src/ai-data-pack/queries/*.ts`
- `backend/src/ai-data-pack/aliases/erp-field-alias.registry.ts`
- `backend/src/ai-data-pack/rules/*.ts`
- `backend/src/ai-data-pack/utils/*.ts`
- `backend/src/ai-data-pack/ai-data-pack.service.spec.ts`
- `backend/src/ai-data-pack/ai-data-pack.controller.spec.ts`

### Sua tich hop

- `backend/src/app.module.ts`: dang ky `AiDataPackModule`.
- `backend/src/auth/role-permissions.ts`: them cac quyen read-only cho Director, Manager va Investor theo pham vi.

## 3. Endpoint da tao

- `GET /api/ai/director/data-pack?date=YYYY-MM-DD&format=json|xlsx`
- `GET /api/ai/marketer/data-pack?date=YYYY-MM-DD&format=json|xlsx`
- `GET /api/ai/data-quality/report?date=YYYY-MM-DD&format=json|xlsx`
- `GET /api/ai/mapping/report?date=YYYY-MM-DD&format=json|xlsx`
- `GET /api/ai/decision-history?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|xlsx`

Tat ca endpoint:

- Bat buoc JWT va permission.
- Chi doc du lieu.
- Validate ngay theo `YYYY-MM-DD`.
- Chi chap nhan `json` hoac `xlsx`.
- Di qua secret redaction interceptor.

## 4. Director Data Pack

Xuat du 25 section/sheet bat buoc, tu `00_README` den `24_field_aliases`.

### Section doc tu nguon ERP hien huu

- `01_metadata`
- `02_chatgpt_web_reading_rules`
- `03_chatgpt_web_research_rules`
- `04_director_manual_inputs`: chi doc allowlist business setting an toan; co the rong.
- `05_financial_context`
- `06_financing_context`
- `07_cashflow_scenarios`
- `08_business_summary`
- `09_marketing_profitability`
- `10_service_group_performance`
- `11_product_variant_performance`
- `12_unit_economics`
- `13_ltv_summary`: chi dem record, khong tu tao LTV.
- `14_sales_funnel`
- `15_sales_team`
- `16_operation_capacity`: chi co status counts, khong ket luan capacity con lai.
- `17_decision_history`
- `18_alerts`
- `19_data_quality`
- `20_mapping_report`
- `22_permission_risk_limits`
- `24_field_aliases`

### Section schema-only/khong du du lieu

- `21_decision_options`: khong tu tao phuong an quyet dinh.
- `23_external_market_summary`: khong co research web trong giai doan nay.
- `13_ltv_summary`: gia tri LTV khong kha dung vi thieu quan he customer-order ben vung.
- `16_operation_capacity`: khong co capacity baseline, SLA, status history va staff availability.
- `04_director_manual_inputs`: rong neu khong co key nam trong allowlist.

Moi section thieu/yeu van xuat quality metadata, warning, missing fields va `can_use_for_decision`.

## 5. Marketer Data Pack Google-focused V1

Xuat cac sheet:

- Account, campaign, ad group, keyword, ad creative va daily metrics.
- Leads by source.
- Data quality va mapping report.
- Reading/research rules.
- Allowed actions chi cho phep `monitor_only`; `live_execution=false`.

Du lieu ngoai Google va chuoi attribution day du van duoc danh dau partial/weak thay vi suy doan.

## 6. Finance canonical source

Nguon uu tien:

- `FinancialControlService.getFullMetrics(false)`.
- Cashflow/disbursement thuc te trong ERP.
- `FinanceService.getDebtCashflowSummary(30)` va `(90)`.
- `loancontracts` voi projection read-only.

Quy tac:

- `cash_available = bankBalance`.
- Proposed loan khong cong vao cash.
- Approved-not-disbursed loan chi vao `expected_cash_inflow`.
- Debt service 30/90 ngay duoc xuat va gan quality flags khi summary co alert.
- Khong dung `computeAvailableFunds()`, `getCollectedRevenueToday()` hoac `getLoanRoomAvailable()` lam canonical.
- Khong dung mock/random source.

Luu y: contract cu cua `getDebtCashflowSummary(windowDays)` dat ten output la `due14d`/`totalDebtDue14d`, nhung implementation tinh theo `windowDays` truyen vao. Export giu nguyen source contract va gan nhan 30/90 theo tham so goi.

## 7. Data Quality Report

Da tinh/xuat 11 chi so:

- `lead_source_mapping_rate`
- `lead_campaign_mapping_rate`
- `order_lead_mapping_rate`
- `order_service_mapping_rate`
- `order_customer_mapping_rate`
- `order_profit_completion_rate`
- `campaign_service_mapping_rate`
- `ads_sync_success_rate`
- `ads_data_freshness_hours`
- `attribution_confidence`
- `estimated_vs_realized_profit_rate`

Decision gate luon giu:

- `can_import_action_file=false`
- `can_dry_run=false`
- `can_execute_live=false`

## 8. Mapping Report

Da xuat cac doan noi trong chuoi attribution va loi nhuan, gom:

- Ads platform -> ads account -> campaign -> ad group -> ad/creative.
- Ad/creative -> keyword/search term -> UTM/landing page -> lead.
- Lead -> sale/customer/order.
- Sale -> customer.
- Customer -> order.
- Order -> product variant; product variant -> service group.
- Ad group -> service group.
- Product variant -> revenue -> gross profit -> net profit.

Moi doan co mapping rate, confidence, missing count, broken reason, impact va priority.

### Cac doan du kien con dut/yeu tren ERP hien tai

- Ad/creative -> keyword/search term.
- Keyword/search term -> UTM/landing page.
- UTM/landing page -> lead.
- Lead/ad group/campaign attribution co the partial.
- Lead/sale -> customer chua ben vung.
- Customer <-> order dang thieu durable relation.
- Ad group -> service group la optional/partial.
- Cost allocation va realized net profit chua luon hoan tat.
- Attribution confidence bi cap thap khi thieu account/resource/mapping/freshness.

## 9. Assumption va alias V1

- `ProductCategory = service_group`.
- `Product = product_variant`.
- Ads phan tich theo service group neu mapping ton tai.
- Order/revenue/profit tong hop theo product variant.
- `SystemSettings` chi la alias tam cho director manual input va chi doc allowlist key nghiep vu.
- LTV khong duoc ket luan manh neu thieu durable customer-order mapping.
- Operation capacity khong duoc suy ra tu status counts.

## 10. Security

- Projection truy van gioi han field can xuat.
- Director manual inputs dung allowlist, khong doc toan bo `system_settings`.
- Redact secret/API key/token/credential va PII khong can thiet.
- JSON deterministic de tao checksum on dinh.
- Khong log secret va khong tao OpenAI config moi.

## 11. Test va ket qua

Da chay:

```text
npm run build
```

Ket qua: dat.

```text
npm test -- --runInBand ai-data-pack
```

Ket qua: 2/2 test suites dat, 12/12 tests dat.

```text
npm test -- --runInBand ai-data-pack openai-config ai-marketing ops-action google-ads api-token ad-group/ad-group.auto-control.service.spec.ts
```

Ket qua: 21/21 test suites dat, 116/116 tests dat.

Test bao phu:

- Director/Data Quality/Mapping JSON contract.
- XLSX sheet structure.
- Finance canonical source va loan status rules.
- Khong tham chieu mock/random hoac ba ham finance bi cam.
- Service group/product variant aliases.
- Mapping confidence.
- Secret/PII redaction.
- Endpoint permissions va input validation.
- Deterministic JSON/checksum.

Chua chay integration/E2E voi database production, nen bao cao nay khong khang dinh du lieu production hien co day du.

## 12. Viec de lai cho giai doan sau

- OpenAI API key/integration.
- Upload normalization.
- Import action file.
- General action-file dry-run.
- Live execution va ads mutation.
- External market/web research ingestion.
- Automatic decision/action generation.
- Migration schema V2.

## 13. Migration de xuat cho V2

Chua tao migration trong giai doan nay. De xuat can danh gia:

- Dedicated, approved va versioned `director_manual_inputs`/business policy model.
- Durable `order_attribution_links` va `customer_order_links`.
- Lead activity/status/assignment history.
- Capacity baseline, SLA va staff availability model.
- Chuan hoa `service_groups`/`product_variants` neu alias ProductCategory/Product khong du.
- Durable UTM, landing page va search-term attribution.
- Unified alerts va realized cost/profit completion status.

