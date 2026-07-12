# V2 — Codex Operator → ERP Export → ChatGPT Web → ERP Execute

## Mục tiêu

Tách tài liệu V2 thành các phần nhỏ để Codex và marketer dễ dùng.

Luồng chính:

```text
Người dùng chỉ thao tác với Codex
        ↓
Codex gọi ERP API tải dữ liệu ads xuống
        ↓
Người dùng upload file ads_live_export.zip lên ChatGPT Web
        ↓
ChatGPT Web phân tích theo trình tự chuyên gia
        ↓
Người dùng duyệt ý tưởng trong ChatGPT Web
        ↓
ChatGPT Web trả ads_execution_plan.zip
        ↓
Người dùng đưa file cho Codex
        ↓
Codex import/validate/approve/execute thông qua ERP API
        ↓
ERP gọi Google Ads API
        ↓
ERP ghi log, sync lại, đánh giá sau 3/7 ngày
```

## Bộ tài liệu đã tách

| File | Dành cho | Mục đích |
|---|---|---|
| `01_SYSTEM_OVERVIEW.md` | Chủ hệ thống, developer, marketer | Giải thích kiến trúc tổng thể và vai trò từng bên |
| `02_MARKETER_SOP.md` | Marketer | Quy trình làm việc hằng ngày bằng Codex + ChatGPT Web |
| `03_CODEX_OPERATOR_COMMANDS.md` | Codex Operator | Prompt/lệnh chuẩn để export, import, validate, approve, execute |
| `04_ERP_EXPORT_DATA_CONTRACT.md` | Backend/Codex Developer | Chuẩn file `ads_live_export.zip` tải xuống từ ERP |
| `05_EXPERT_ANALYSIS_PROMPT.md` | ChatGPT Web/ERP Export | Prompt chuyên gia phải nhúng vào file export |
| `06_CHATGPT_OUTPUT_CONTRACT.md` | ChatGPT Web/ERP Import | Chuẩn file `ads_execution_plan.zip` ChatGPT Web trả lại |
| `07_ERP_API_CONTRACT.md` | Backend/Codex Developer | API ERP cho Codex Operator gọi |
| `08_GOOGLE_ADS_EXECUTION_GUARDRAILS.md` | Backend/Codex Developer | Các luật chặn rủi ro trước khi gọi Google Ads API |
| `09_CODEX_DEVELOPER_IMPLEMENTATION_PLAN.md` | Codex Developer | Các phase triển khai code trong ERP |
| `10_TESTING_ACCEPTANCE_CRITERIA.md` | QA/Developer | Test plan và tiêu chí nghiệm thu |
| `11_MARKETER_REVIEW_CHECKLIST.md` | Marketer/Manager | Checklist duyệt ý tưởng, keyword, RSA, ngân sách, landing page |
| `12_SECURITY_AND_SECRET_HANDLING.md` | Backend/DevOps | Bảo mật OAuth/developer token/secret |
| `13_ADS_AUTOMATION_PRIORITY_AXIS.md` | Owner/BA/Developer | Forced priority axis for ads automation decision foundation |
| `14_ADS_AUTOMATION_CONTROL_CENTER_PLAN.md` | Owner/BA/Frontend/Backend | BA plan to upgrade `/ads-settings` into the Ads Automation Control Center |
| `15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md` | Owner/BA/Codex/Runner | BA và trục chuẩn cho mapping dữ liệu, control tài chính, ads gate |

## Forced priority override - 2026-07-04

Before expanding secondary AI Ads V2 work, prioritize the decision foundation in `13_ADS_AUTOMATION_PRIORITY_AXIS.md`:

```text
1. Should ads increase?
2. How much should ads increase?
3. Which ad groups should receive the increase?
4. Which products should receive more budget?
5. Which suppliers are safe to support scale?
6. Should a product be stopped for ads/import, without product delete?
7. Should a campaign or ad group be paused?
```

This override does not permit live provider execution. It only forces the implementation order toward read-only decision snapshots, pending action drafts, ERP validation, approval, provider validateOnly, and then limited execution in later gated phases.

## Control center override - 2026-07-06

After the manager-account control-plane slice, the next UI/product slice must consolidate ads automation governance in `/ads-settings`:

```text
/ads-settings
  -> MCC / BM / BC manager accounts
  -> redacted credential/token vault metadata
  -> authorized child ad accounts
  -> import schedule and freshness
  -> account/campaign/ad group/product/supplier/profit mapping health
  -> approval, validateOnly, kill switch, production flag, idempotency gates
  -> audit, rollback, and incident evidence
```

`/api-tokens` may remain as a technical route, but product navigation should treat token management as part of `/ads-settings`.

See `14_ADS_AUTOMATION_CONTROL_CENTER_PLAN.md`.

## Evidence / finance / ads gate override - 2026-07-07

Before adding more screens or live-capable branches, prioritize the three ERP control layers in `15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md`:

```text
1. Mapping dữ liệu:
   ad group -> sản phẩm -> đơn hàng -> lợi nhuận -> tồn kho -> supplier.

2. Control tài chính:
   cashflow, loss limit, ngân sách ngày/tháng.

3. Ads gate:
   validateOnly, approval, kill switch, audit, production flag.
```

Next auto-coding job:

```text
ERP_JOB_000117 - ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY
```

This override keeps `/ads-settings` as the control center, but the first deliverable is a backend evidence/readiness snapshot and tests. UI additions must be compact, read-only, and consume ERP evidence. This override does not permit real credentials, direct provider calls, or live execution.

## Quy tắc thiết kế bất biến

1. Codex không gọi trực tiếp Google Ads API.
2. ChatGPT Web không gọi ERP hoặc Google Ads API.
3. ERP là cổng kiểm soát duy nhất: validate, approve, execute, log.
4. Google Ads API chỉ nhận lệnh từ ERP backend/worker.
5. `action_plan.json` là nguồn dữ liệu chuẩn duy nhất để ERP import.
6. Không execute raw payload do ChatGPT Web tạo.
7. Campaign mới luôn tạo ở trạng thái `PAUSED`.
8. Mọi create/update/pause/resume phải `approvalRequired=true`.
9. ERP phải chạy provider `validateOnly` trước khi approve/execute.
10. Mọi action phải có `idempotencyKey`.
