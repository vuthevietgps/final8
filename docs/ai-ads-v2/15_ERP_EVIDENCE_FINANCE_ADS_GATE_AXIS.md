# 15 - ERP Evidence, Finance, and Ads Gate Axis

Status: BA/truc approved for the next local-only auto-coding slice

Effective date: 2026-07-07

Next job:

```text
ERP_JOB_000117 - ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY
```

## 1. BA Direction

The next correct step is not to add many more screens. The ERP must first make three control layers reliable:

```text
1. Data mapping:
   ad group -> product -> order -> profit -> inventory -> supplier.

2. Financial control:
   cashflow, loss limit, daily budget, monthly budget.

3. Ads gate:
   validateOnly, approval, kill switch, audit, production flag.
```

The business goal is to let the owner answer ads automation questions with ERP evidence before any action is drafted or executed:

```text
- Should this ad group scale, hold, reduce, pause, or only monitor?
- How much budget is allowed today and this month?
- Which product economics justify more spend?
- Is stock or supplier capacity blocking scale?
- Is the loss limit already hit?
- Is the account/campaign/ad group safe for ERP-controlled execution?
- Which exact gate blocks live execution?
```

This document is the authoritative axis for the next auto-coding job. It must be applied before expanding broad UI or live provider execution.

## 2. Current ERP Baseline To Reuse

The current ERP already has enough foundation to build a read-only evidence layer. The next job must reuse existing modules and avoid duplicate domain models.

### Backend Modules

| Area | Existing module/file family | Reuse purpose |
|---|---|---|
| Ads entity mapping | `backend/src/ad-group`, `backend/src/google-ads/schemas/google-ads-ad-group.schema.ts` | Provider ad group and ERP ad group identity, mapping status, automation candidate identity |
| Ads cost | `backend/src/advertising-cost`, `backend/src/google-ads/schemas/google-ads-daily-metric.schema.ts` | Spend, cost freshness, daily/monthly ads cost evidence |
| Profit report | `backend/src/ad-group-profit-report`, `backend/src/finance/ad-group-daily-report.service.ts` | Ad group profit, performance classification, net profit evidence |
| Product | `backend/src/product` | Product identity, cost basis, product status, product-level scale eligibility |
| Orders | `backend/src/test-order2`, `backend/src/order-update`, `backend/src/order-sheet-sync`, `backend/src/order-status`, `backend/src/pending-order` | Order count, revenue, cancellation/return signal, fulfillment evidence |
| Inventory | `backend/src/inventory` | Stock, stock movement, stock risk, fulfillment capacity |
| Supplier | `backend/src/supplier-quote`, `backend/src/supplier-payable` | Supplier quote, supplier cost, payable/settlement status, supplier risk |
| Finance control | `backend/src/finance`, `backend/src/cashflow-control`, `backend/src/owner-fund` | Cashflow, available funds, budget buckets, loss limit, capital allocation |
| Ads manager/account | `backend/src/ads-manager-account`, `backend/src/api-token` | MCC/BM/BC readiness, child account readiness, redacted secret metadata only |
| Ads gate/execution | `backend/src/google-ads`, `backend/src/ai-marketing`, `backend/src/emergency-action` | Action plan, approval policy, provider validateOnly, execution log, kill switch/audit |

### Frontend Surfaces

| Surface | Current purpose | Next use |
|---|---|---|
| `/ads-settings` | Ads governance and credential readiness control center | Main read-only display for evidence, mapping health, finance gates, ads gates |
| `/ad-groups` and ad group reports | Operational ad group views | Link back to evidence details, not duplicate logic |
| `/costs/advertising` | Ads cost input/sync | Spend evidence and freshness reference |
| `/finance/financial-control` | Financial control | Cashflow and budget evidence reference |
| Product/order/supplier pages | Operational ERP data | Evidence drilldown targets |

## 3. Target Operating Model

The ERP should produce one read-only evidence snapshot that joins business data and ads governance data.

```text
provider manager account
  -> child ad account
  -> campaign
  -> ad group
  -> ERP ad group mapping
  -> product candidate(s)
  -> order and revenue evidence
  -> profit evidence
  -> stock/inventory evidence
  -> supplier quote/payable evidence
  -> cashflow and budget gates
  -> ads execution gates
```

The snapshot does not execute anything. It only explains:

```text
- status: scale_ready, hold, monitor_only, blocked, needs_mapping.
- recommended action family: scale, reduce, pause_review, supplier_sourcing, offer_fix, stop_import_review, monitor_only.
- money impact: spend, revenue, gross profit, net profit after ads, loss exposure.
- blockers: missing mapping, stale data, stock risk, supplier risk, cashflow risk, gate risk.
- evidence references: source module, source entity id, freshness, confidence.
```

## 4. Layer A - Data Mapping

### Required Mapping Chain

An ad group is automation-ready only when the ERP can trace it through this chain:

```text
adGroupId
  -> provider/platform identity
  -> child ad account
  -> campaign and campaignBudgetId evidence
  -> ERP ad group record
  -> product mapping
  -> order evidence
  -> product/ad group profit evidence
  -> stock or inventory evidence
  -> supplier quote/payable evidence
```

### Minimum Fields

Every ad group evidence item should expose:

```text
adGroup:
  platform
  managerAccountId
  childAccountId
  campaignId
  campaignBudgetId
  adGroupId
  erpAdGroupId
  name
  status

mapping:
  productIds[]
  mappingStatus: mapped | partial | missing | conflict
  mappingConfidence: high | medium | low
  missingLinks[]
  dataFreshnessBySource[]

commerce:
  orders
  revenue
  cancellations
  returns
  grossProfit
  netProfitAfterAds
  marginPercent

inventory:
  stockOnHand
  stockRisk: ok | low | out_of_stock | unknown
  fulfillmentRisk

supplier:
  supplierIds[]
  quoteStatus
  payableStatus
  supplierRisk: ok | review | blocked | unknown
```

### Mapping Rules

1. If product mapping is missing, status must be `needs_mapping`.
2. If multiple conflicting products are mapped with weak confidence, status must be `blocked`.
3. If order/profit/inventory/supplier data is stale, status must not be `scale_ready`.
4. If campaignBudgetId is missing for budget actions, budget scale must be blocked. Never fall back to campaignId or adGroupId.
5. Weak supplier evidence may create `supplier_sourcing`, but must not delete or kill the product.

## 5. Layer B - Financial Control

### Required Controls

The ERP must decide budget movement from financial evidence, not ads metrics alone:

```text
- available cashflow.
- ad loss limit.
- daily budget cap.
- monthly budget cap.
- account/campaign/ad group/product budget cap.
- net profit after ads.
- stock and supplier capital requirement.
```

### Finance Gate Status

```text
allow_scale:
  cashflow is available, loss limit not hit, daily/monthly caps allow the change.

cap_only:
  entity is healthy, but scale amount is reduced by budget/cashflow cap.

hold:
  economics are not bad, but confidence or freshness is not enough.

block:
  loss limit, negative net profit, unavailable cash, or budget cap blocks action.

unknown:
  finance data is missing or stale.
```

### Budget Control Rules

1. Budget increase must be capped by the strictest of daily cap, monthly cap, loss limit, product cap, account/campaign/ad group cap, and available cashflow.
2. If net profit after ads is negative and spend is meaningful, the system may draft `pause_review` or `reduce_review`, not live execution.
3. If stock/supplier needs cash before scaling, the scale decision must include capital impact.
4. Finance control must default to block or hold when data is missing.
5. Production execution remains disabled unless `GOOGLE_ADS_PRODUCTION_ENABLED=true` and all policy gates pass.

## 6. Layer C - Ads Gate

Ads gates must be explicit and auditable. A proposed action is executable only after all gates pass in order:

```text
1. kill switch is not active.
2. production flag allows live execution.
3. action type is allowed by MVP policy.
4. entity mapping is complete enough.
5. finance gate allows the money impact.
6. provider validateOnly passed.
7. human approval exists.
8. idempotency key is unique.
9. before-state snapshot exists.
10. audit log can be written.
```

For this job, the implementation target is read-only gate visibility. It must not execute provider mutations.

### MVP Disallowed Actions

```text
- Performance Max.
- Shopping.
- Display.
- YouTube.
- delete campaign.
- delete ad group.
- delete ad.
- auto-publish.
- auto-enable new campaign.
```

New Google Search campaigns, when implemented in a later phase, must always be created as `PAUSED`.

## 7. Standard Snapshot Contract

The next implementation should create a DTO/read-model equivalent to this shape. Field names may follow local code style, but the semantic contract should stay stable.

```ts
export type AdsAutomationReadinessStatus =
  | 'scale_ready'
  | 'hold'
  | 'monitor_only'
  | 'blocked'
  | 'needs_mapping';

export interface AdsAutomationEvidenceSnapshot {
  snapshotId: string;
  generatedAt: string;
  environment: 'local' | 'demo' | 'staging' | 'production';
  productionEnabled: boolean;
  killSwitchActive: boolean;
  summary: {
    totalAdGroups: number;
    scaleReady: number;
    hold: number;
    monitorOnly: number;
    blocked: number;
    needsMapping: number;
  };
  adGroups: AdsAutomationAdGroupEvidence[];
  globalBlockers: AdsAutomationBlocker[];
}

export interface AdsAutomationAdGroupEvidence {
  platform: 'google_ads' | 'meta_ads' | 'tiktok_ads' | 'unknown';
  managerAccountId?: string;
  childAccountId?: string;
  campaignId?: string;
  campaignBudgetId?: string;
  adGroupId: string;
  erpAdGroupId?: string;
  productIds: string[];
  readinessStatus: AdsAutomationReadinessStatus;
  recommendedActionFamily:
    | 'scale'
    | 'reduce_review'
    | 'pause_review'
    | 'supplier_sourcing'
    | 'offer_fix'
    | 'stop_import_review'
    | 'monitor_only';
  mappingHealth: AdsAutomationMappingHealth;
  commerceEvidence: AdsAutomationCommerceEvidence;
  inventoryEvidence: AdsAutomationInventoryEvidence;
  supplierEvidence: AdsAutomationSupplierEvidence;
  financeGate: AdsAutomationFinanceGate;
  adsGate: AdsAutomationGateEvidence;
  blockers: AdsAutomationBlocker[];
  evidenceRefs: AdsAutomationEvidenceRef[];
}
```

## 8. Next Auto-Coding Slice

### ERP_JOB_000117A - Backend Read Model

Implement a local-only backend service and DTOs that aggregate existing ERP evidence. The service must not call Google Ads API or any provider API.

Expected output:

```text
- DTO/read-model for AdsAutomationEvidenceSnapshot.
- service method that builds a snapshot from existing collections/services.
- safe fallback behavior when a module has no data.
- blocked/needs_mapping status when required evidence is absent.
```

### ERP_JOB_000117B - Tests And Fixtures

Add focused tests around gate behavior:

```text
- missing product mapping -> needs_mapping.
- missing campaignBudgetId blocks budget scale.
- negative net profit or loss limit hit -> blocked or pause_review.
- stale stock/supplier/cashflow data -> hold or blocked.
- production flag false -> ads gate not executable.
- kill switch active -> all live actions blocked.
```

### ERP_JOB_000117C - `/ads-settings` Read-Only Integration

Only after backend DTO/tests pass, `/ads-settings` may show a compact read-only section:

```text
- mapping health summary.
- finance gate summary.
- ads gate summary.
- top blockers.
- link targets to existing ERP pages.
```

Do not add many new screens. The UI should consume the snapshot and point operators to existing ERP modules.

### ERP_JOB_000117D - Runner Verification Report

The runner must record:

```text
- files changed.
- commands run.
- tests passed/failed.
- safety grep for provider calls and secret leakage.
- confirmation that no .env or real credentials were committed.
- remaining risks.
```

## 9. Acceptance Criteria

This axis is accepted only when:

```text
- ERP can show why each ad group is scale_ready, hold, monitor_only, blocked, or needs_mapping.
- ERP can trace ad group -> product -> order -> profit -> inventory -> supplier when data exists.
- Missing mapping, stale data, missing campaignBudgetId, bad cashflow, loss limit, kill switch, production flag, or missing validateOnly/approval are visible blockers.
- Budget scale is capped by financial controls, not ads metrics alone.
- The implementation is local/demo safe by default.
- No real token, API secret, MCC, BM, or BC credential is required for the job.
- No provider API is called from Codex/operator tasks.
- No live execution path is opened.
- Tests or clear verification commands are recorded.
```

## 10. Stop Conditions

Codex UI review, Codex CLI, and runner must stop and report instead of proceeding if a task requires:

```text
- entering real MCC/BM/BC/API credentials into Codex.
- printing secrets, tokens, refresh tokens, API secrets, or developer tokens.
- calling Google Ads API directly from Codex/operator.
- enabling production execution.
- creating Performance Max, Shopping, Display, or YouTube campaigns.
- deleting provider campaigns, ad groups, ads, products, or ERP business records.
- using campaignId or adGroupId as campaignBudgetId fallback.
```

## 11. Auto-Coding Handoff

Use this sequence:

```text
1. Codex UI review:
   read this document and inspect current ERP modules before coding.

2. Truc documentation:
   keep this file as the source of truth; update 00, 09, and 13 only to point to this axis.

3. Codex CLI code generation:
   implement 117A, then 117B, then 117C only if backend evidence is stable.

4. Runner coordination:
   run verification commands, attach report, and keep all work local/demo/redacted.
```

Runner handoff file:

```text
docs/ai-ads-v2/runner-handoffs/ERP_JOB_000117_ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY.md
```
