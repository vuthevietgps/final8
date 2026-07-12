# ERP_JOB_000117 - Ads Automation Evidence, Finance, Gate Foundation

Status: ready for local-only auto-coding intake

Source axis:

```text
docs/ai-ads-v2/15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md
```

## Objective

Build the first reliable ERP evidence layer for ads automation:

```text
ad group -> product -> order -> profit -> inventory -> supplier
        -> cashflow/loss/budget controls
        -> ads validateOnly/approval/kill switch/audit/production gates
```

This job is not a live execution job. It is a read-only foundation job.

## Non-Negotiable Safety Rules

```text
- Codex/operator must not call Google Ads API directly.
- No real MCC/BM/BC/token/API secret is needed or requested.
- No plaintext secret in code, logs, test output, API responses, or docs.
- Do not commit .env or real credentials.
- Do not enable GOOGLE_ADS_PRODUCTION_ENABLED.
- Do not open live execution.
- Do not use campaignId or adGroupId as campaignBudgetId fallback.
- Do not implement Performance Max, Shopping, Display, YouTube, delete, or auto-publish.
```

## Existing ERP Modules To Inspect First

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
frontend/src/app/features/ads-settings
frontend/src/app/features/finance/financial-control
frontend/src/app/features/product
frontend/src/app/features/test-order2
frontend/src/app/features/supplier-quote
frontend/src/app/features/supplier-payable
```

## Implementation Phases

### 117A - Backend DTO And Read Model

Create a local-only `AdsAutomationEvidenceSnapshot` DTO/read-model and service using existing modules or Mongoose models.

Acceptance:

```text
- missing product mapping returns needs_mapping.
- missing campaignBudgetId blocks budget scale.
- missing/stale order, profit, inventory, supplier, or finance data prevents scale_ready.
- production flag false appears as a non-executable ads gate.
- kill switch active blocks all live-capable actions.
```

### 117B - Focused Backend Tests

Add tests for the blocker matrix:

```text
- mapping missing.
- campaignBudgetId missing.
- loss limit hit.
- cashflow unavailable.
- stock/supplier stale or blocked.
- provider validateOnly missing.
- approval missing.
- production flag false.
- kill switch active.
```

### 117C - Minimal `/ads-settings` Read-Only Surface

Only after 117A/117B pass, add a compact read-only section to `/ads-settings`:

```text
- mapping health.
- finance gate.
- ads gate.
- top blockers.
- links to existing ERP pages.
```

Do not create a large new UI flow in this job.

### 117D - Runner Report

Record verification output:

```text
- git diff summary.
- tests/commands run.
- safety grep results.
- unresolved risks.
- confirmation that no real credentials were added.
```

## Suggested Verification Commands

Use actual package scripts when available. If scripts differ, record the discovered scripts and chosen commands.

```text
rg -n "GoogleAdsApi|mutate|validateOnly|GOOGLE_ADS_PRODUCTION_ENABLED|campaignBudgetId|refreshToken|clientSecret" backend/src
cd backend && npm test -- --runInBand
cd frontend && npm test -- --watch=false --browsers=ChromeHeadless
cd frontend && npm run build
```

For docs-only intake, verify links:

```text
rg -n "ERP_JOB_000117|15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS" docs/ai-ads-v2
```

## Codex UI Review Prompt

```text
Review ERP_JOB_000117 against the current ERP codebase.
Do not code yet.
List reused modules, proposed DTO/service placement, test plan, and risks.
Confirm no direct provider call, no real credential handling, and no live execution.
```

## Codex CLI Coding Prompt

```text
Implement ERP_JOB_000117A and ERP_JOB_000117B only.
Read docs/ai-ads-v2/15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md first.
Reuse existing ERP modules.
Create a local-only read-model for AdsAutomationEvidenceSnapshot.
Add focused tests for mapping, finance, and ads gate blockers.
Do not touch live execution, real credentials, or provider API calls.
Report files changed, tests run, and remaining risks.
```

## Runner Pointers

Drive root:

```text
https://drive.google.com/drive/folders/1wZ7zulU7IQJlqF05Y0qOk2N8Sy5RY39m
```

ChatGPT Web review:

```text
primary: https://chatgpt.com/c/6a488458-bc88-83ec-9496-009f031f3c68
fallback: https://chatgpt.com/c/6a488468-d5f0-83ec-ab8b-14661585d6d2
```

## Stop Conditions

Stop the runner and report if implementation requires:

```text
- real MCC/BM/BC/API credentials.
- live Google Ads/Meta/TikTok calls.
- production execution flag changes.
- secret printing.
- delete actions.
- campaignBudgetId fallback from campaignId/adGroupId.
```
