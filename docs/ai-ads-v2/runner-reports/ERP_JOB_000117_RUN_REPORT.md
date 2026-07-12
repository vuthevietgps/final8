# ERP_JOB_000117 Run Report

Status: completed for 117A/117B local-only coding slice

Run date: 2026-07-07

## Scope

Implemented:

```text
117A. Backend DTO/read-model for AdsAutomationEvidenceSnapshot.
117B. Focused rule tests for mapping, finance, and ads gate blockers.
```

Not implemented in this run:

```text
117C. /ads-settings UI integration.
117D. Full runner UI automation.
```

## Files Changed

```text
backend/src/ads-automation-evidence/dto/ads-automation-evidence.dto.ts
backend/src/ads-automation-evidence/ads-automation-evidence.rules.ts
backend/src/ads-automation-evidence/ads-automation-evidence.service.ts
backend/src/ads-automation-evidence/ads-automation-evidence.controller.ts
backend/src/ads-automation-evidence/ads-automation-evidence.module.ts
backend/src/ads-automation-evidence/ads-automation-evidence.rules.spec.ts
backend/src/app.module.ts
docs/ai-ads-v2/15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md
docs/ai-ads-v2/runner-handoffs/ERP_JOB_000117_ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY.md
```

## Endpoint

```text
GET /api/ads-automation/evidence/snapshot
```

This endpoint is protected by existing JWT/RBAC guards and requires `google-ads.read`.

## Verification Commands

```text
npm test -- ads-automation-evidence.rules.spec.ts --runInBand
npm run build
rg -n "GoogleAdsApi|mutate|axios|fetch\(|googleapis|refreshToken|clientSecret|developerToken|accessToken|campaignId \|\||adGroupId \|\||campaignBudgetId \|\|" backend/src/ads-automation-evidence
```

## Verification Result

```text
Focused tests: PASS, 7/7.
Backend build: PASS.
Safety grep: PASS, no matches after cleanup.
Backend dev server: running on port 3000.
Route mapped: /api/ads-automation/evidence/snapshot.
```

## Safety Confirmation

```text
provider_api_called: false
google_ads_api_called: false
live_execution_used: false
real_credentials_required: false
GOOGLE_ADS_PRODUCTION_ENABLED: false
AI_MARKETING_PROVIDER_EXECUTION_ENABLED: false
AI_MARKETING_DRY_RUN: true
campaignBudgetId fallback from campaignId/adGroupId: not used
```

## Residual Risks

```text
- Snapshot joins are conservative and read-only; some modules may produce hold/blocked until real mapping data is populated.
- /ads-settings has not yet consumed the new snapshot endpoint.
- Demo DB has duplicate advertising-cost rows that trigger an existing index alignment warning at startup; backend still starts.
```
