# 09 — Codex Developer Implementation Plan

## Forced Priority Override — Ads Automation Foundation

Effective date: 2026-07-04

Before adding broad new implementation phases, prioritize the foundation required to answer these automation questions:

```text
1. Should ads increase?
2. How much should ads increase?
3. Which ad groups should receive the increase?
4. Which products should receive more budget?
5. Which suppliers can safely support product scale?
6. Should a product be stopped for ads/import without deleting the product?
7. Should a campaign or ad group be paused?
```

This override adds a required decision-foundation lane before live-capable execution work:

```text
P1. Read-only automation decision snapshot.
P2. Scale/pause candidate ranking by ad group.
P3. Product allocation and supplier fit gates.
P4. Pending ERP action drafts only.
P5. ERP validation + provider validateOnly.
P6. Approval + tightly limited execution.
P7. Post-action evaluation.
```

Live ads execution is still forbidden unless all original V2 guardrails pass:

```text
- provider validateOnly passed;
- action approved;
- explicit execution confirmation present;
- explicit production execution enable gate is deliberately turned on by a future human-controlled deployment, never by Codex dry-run jobs;
- AI_MARKETING_PROVIDER_EXECUTION_ENABLED=true where relevant;
- policy allows execution;
- dry-run is not forcing validateOnly-only mode.
```

See `13_ADS_AUTOMATION_PRIORITY_AXIS.md` for the complete gate list.

## Evidence / Finance / Ads Gate Foundation Override

Effective date: 2026-07-07

The next auto-coding slice must strengthen ERP evidence before adding broad UI or live-capable execution:

```text
ERP_JOB_000117 - ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY
```

Authoritative BA/truc:

```text
docs/ai-ads-v2/15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md
```

Required implementation order:

```text
117A. Backend read-model and DTO for AdsAutomationEvidenceSnapshot.
117B. Focused backend tests for mapping, finance, and ads gate blockers.
117C. Compact read-only /ads-settings integration only after backend tests pass.
117D. Runner verification report with safety checks.
```

Reuse existing ERP modules:

```text
backend/src/ad-group
backend/src/ad-group-profit-report
backend/src/advertising-cost
backend/src/google-ads
backend/src/product
backend/src/test-order2
backend/src/order-update
backend/src/order-sheet-sync
backend/src/order-status
backend/src/pending-order
backend/src/inventory
backend/src/supplier-quote
backend/src/supplier-payable
backend/src/finance
backend/src/cashflow-control
backend/src/owner-fund
backend/src/ads-manager-account
backend/src/api-token
backend/src/ai-marketing
backend/src/emergency-action
```

The job must remain local/demo safe. It must not require real MCC/BM/BC credentials, must not call provider APIs directly from Codex/operator tasks, and must not open a live execution path.

## Phase 0 — Hardening

Mục tiêu: chặn rủi ro tiền và secret trước khi làm live mutate.

Tasks:

```text
0.1 Không lưu plaintext token.
0.2 Bắt buộc API_TOKEN_SECRET ở production.
0.3 Tách RBAC google-ads.*.
0.4 Xóa fallback campaignBudgetId || campaignId || adGroupId.
0.5 Enforce VND/timezone.
0.6 Tắt hoặc đưa auto-pause vào approval policy.
0.7 Thêm idempotency service.
```

## Phase 1 — Export cho ChatGPT Web

Tasks:

```text
1.1 Tạo POST /api/google-ads/operator/export-live-analysis.
1.2 Tạo ads_live_export.zip đầy đủ cấu trúc.
1.3 Sinh expert_analysis_prompt.md.
1.4 Sinh decision_rules.json.
1.5 Sinh data_quality_report.json.
1.6 Sinh operator_readme.md.
1.7 Tạo verify export endpoint.
```

## Phase 2 — Read-only metadata sync

Tasks:

```text
2.1 Tạo collection google_ads_campaigns.
2.2 Tạo collection google_ads_ad_groups.
2.3 Tạo collection google_ads_keywords.
2.4 Tạo collection google_ads_ads.
2.5 Tạo collection google_ads_daily_metrics.
2.6 Sync account/campaign/budget/ad group/keyword/RSA.
2.7 Sửa metrics Google: conversions, allConversions, conversionValue, costPerConversion.
```

## Phase 3 — Import action plan

Tasks:

```text
3.1 Nhận ads_execution_plan.zip.
3.2 Validate zip an toàn.
3.3 Validate manifest/action_plan schema.
3.4 Tạo pending actions.
3.5 Không execute live.
3.6 Lưu original file để audit.
```

## Phase 4 — Provider validateOnly

Tasks:

```text
4.1 ERP dựng Google operations từ typedPayload.
4.2 Gọi validateOnly=true.
4.3 Lưu providerValidationStatus.
4.4 Lưu providerValidationErrors.
4.5 Chỉ action passed mới cho approve.
```

## Phase 5 — Approval + execution

Tasks:

```text
5.1 API approve/reject từng action.
5.2 Lưu approvalText từ Codex.
5.3 Execution worker.
5.4 Google mutate cho:
    - create campaign budget
    - create Search campaign PAUSED
    - create ad group
    - create keyword
    - create RSA
    - update campaign budget
    - pause/resume campaign
    - pause/resume ad group
5.5 Idempotency.
5.6 Execution log.
5.7 Re-sync sau execution.
```

## Phase 6 — Evaluation

Tasks:

```text
6.1 Đánh giá action sau 3 ngày.
6.2 Đánh giá action sau 7 ngày.
6.3 So sánh before/after spend/revenue/netProfit/CPA/conversions.
6.4 Xuất dữ liệu vòng sau cho ChatGPT Web.
```
