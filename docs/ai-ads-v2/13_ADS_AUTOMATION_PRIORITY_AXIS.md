# 13 - Ads Automation Priority Axis

Status: forced priority override
Date: 2026-07-04
Owner: ERP / AI Ads V2

This file locks the next implementation direction. Work on AI Ads V2 must now prioritize the decision foundation required for future ads automation through platform APIs.

This does not allow live ads execution by itself. It changes the order of work so the system can answer the business questions first, create safe action drafts second, and only later allow provider API execution through ERP guardrails.

## 0. Manager Account Control-Plane Direction

The production direction is manager-account first:

- Google Ads is controlled through a configured MCC credential.
- Meta/Facebook ads are controlled through a configured Business Manager credential.
- TikTok ads are controlled through a configured Business Center credential.
- Each manager credential is stored only as an ERP secret/vault reference, never as plaintext in code, logs, tests, prompts, API responses, or review artifacts.
- From those manager credentials, ERP later discovers and controls only authorized child ad accounts, campaigns, ad groups, ads, and campaign budgets.
- Codex, ChatGPT Web, runner jobs, and operator tasks never receive or call with real provider tokens. They only see redacted metadata, fixture data, and ERP API surfaces.
- ERP remains the only system that can later read real credential material from the secret store, call provider validateOnly, approve/execute actions, and call provider APIs.

The BA target is a single ERP control plane that maps:

```text
Provider manager credential
  -> child ad accounts
  -> campaigns
  -> ad groups
  -> campaignBudgetId / budget resource
  -> ERP product / supplier / order / profit / cashflow evidence
  -> pending actions
  -> approval / validateOnly / preflight / audit / rollback
```

This direction must be implemented locally first with demo fixtures and redacted secret references. Real MCC/BM/BC token/API onboarding is a later human-admin ERP/secret-store step after the local safety gates pass.

## 0.5. Ads Automation Control Center Direction

After manager-account readiness exists, the next priority is to make `/ads-settings` the unified Ads Automation Control Center.

The UI direction is:

- `/ads-settings` is the primary product surface for MCC/BM/BC governance.
- `/api-tokens` remains backward compatible but becomes a technical/sub-surface of `/ads-settings`.
- ad accounts, ad groups, and advertising costs remain operational data modules because they are imported or refreshed daily after credential activation.
- token/API activation must only enable read-only import by default; it must not enable live execution.
- the control center must show manager accounts, redacted credential metadata, child ad accounts, import schedule, mapping health, approval gates, kill switch, production flag, idempotency, audit, and rollback readiness together.

The next auto-code slice is:

```text
ERP_JOB_000116 - ADS_AUTOMATION_CONTROL_CENTER_UI_FOUNDATION_LOCAL_ONLY
```

The slice must update BA/UI direction first, then implement a local-only UI foundation using existing backend surfaces. It must not call Google Ads, Meta, TikTok, or any live provider API.

## 1. Priority Questions

The system must prioritize these questions in this order:

1. Should ads be increased?
2. How much should ads be increased?
3. Which ad groups should receive the increase?
4. Which products should receive more budget?
5. Which suppliers are safe to support the product scale?
6. Should any product be killed, paused for ads, or stopped for import?
7. Should any campaign or ad group be paused?

These questions are now the required foundation for ads automation. A feature that does not improve one of these answers is lower priority unless it is a safety, security, sync, or approval prerequisite.

## 2. Decision Scope

| Question | MVP decision level | Initial output | Execution boundary |
|---|---|---|---|
| Should ads increase? | ad group | scale_ready, hold, blocked | draft only until approval |
| How much increase? | ad group budget | proposedBudget, increasePercent | capped and staged |
| Which ad groups? | ad group ranking | scaleCandidates | no direct provider call |
| Which products? | product x ad group | productScaleCandidates | advisory until supplier gate passes |
| Which supplier? | product x supplier | supplierFitScore, risk flags | advisory first |
| Kill product? | product decision | stop_ads, stop_import, supplier_sourcing, no_action | no product delete action |
| Pause campaign? | campaign/ad group | pause_campaign or pause_ad_group draft | ERP validateOnly + approval required |

## 3. Required Data Contract

The automation decision API must not produce strong actions unless these inputs are available and fresh.

### Ads and ad group inputs

- platform, accountId, campaignId, adGroupId, resourceName.
- managerAccountType: google_ads_mcc, meta_business_manager, or tiktok_business_center.
- managerAccountId, managerAccountName, and manager secret reference handle.
- child ad account id/name/status and parent manager relationship.
- provider permission scopes required for read/import, validateOnly, approval preflight, and supported MVP execution.
- current status and last synced status.
- current budget and verified campaignBudgetId or campaignBudgetResourceName.
- spend, clicks, impressions, leads, orders, revenue, gross profit, net profit after ads.
- rolling windows: 1 day, 3 days, 7 days, 14 days, 30 days.
- previous action history and before/after evaluation.
- protected labels such as NO_AUTO, BRAND_PROTECTED, MANUAL_OVERRIDE.

### Product inputs

- productId, SKU, product name.
- orders, revenue, gross profit, net profit, margin.
- ad-attributed orders and ad-attributed net profit after ads.
- return/cancel/refund rate.
- stock availability, reserved quantity, incoming quantity, days of cover.
- media/landing/offer readiness.
- mapped ad groups and campaigns that spend for the product.

### Supplier inputs

- productId, supplierId, current quote, prior quote, quote approval status.
- cost trend and margin impact.
- delivery lead time, late delivery rate, return/cancel fault signals.
- supplier capacity or inventory constraints where available.
- settlement/payment freshness and payout delay.
- supplier health score and data quality score.

### Finance and policy inputs

- available ads cash.
- cashflow gate and forecast low point.
- max budget increase percent.
- max daily budget per account/campaign/ad group.
- max test loss per day and per product.
- required approval policy.
- production execution flags.

## 4. Forced Phase Order

### P0 - Safety and Sync Prerequisites

Must be complete before any live automation:

- No plaintext secrets.
- MCC/BM/BC credentials must be handled only through ERP secret/vault references.
- Manager account hierarchy must be known before child account/campaign/ad group control is eligible.
- Child ad account, campaign, ad group, and campaignBudgetId mapping must be verified from ERP sync/read models.
- No direct Codex to provider API execution.
- Google Ads production execution disabled by default.
- Provider execution disabled by default.
- Dry-run enabled by default.
- campaignBudgetId must come from synced budget data, never from campaignId or adGroupId.
- New Search campaigns and newly created ad groups/ads/keywords are PAUSED.
- Execution requires approved action, provider validateOnly passed, explicit execution confirmation, production flag, and policy pass.

### P1 - Automation Decision Foundation

Build a read-only decision endpoint or service that returns:

- manager account and child ad account readiness.
- scaleReadiness by ad group.
- proposed increase amount by ad group.
- scale candidate ranking.
- pause candidate ranking.
- product budget candidate ranking.
- supplier fit/risk ranking.
- product kill/stop/import/ads decision candidates.
- blockers and missing data.
- evidence references and data quality score.

The result must be read-only and cannot call provider APIs.

### P1.5 - Manager Account Control Plane

Before any real provider import, validateOnly, or execution branch, ERP must have a local and test-backed control-plane model:

- manager account registry for Google Ads MCC, Meta Business Manager, and TikTok Business Center.
- redacted secret reference handle for each manager account.
- child ad account discovery/readiness status.
- campaign/ad group hierarchy under each child account.
- campaignBudgetId evidence for budget actions, with no campaignId/adGroupId fallback.
- permission scope readiness by operation: read/import, validateOnly, budget update, pause campaign, pause ad group.
- ERP mapping status to product, supplier, order, profit, stock, refund, and cashflow evidence.
- blockers that downgrade scale actions to monitor_only when manager scope, child account mapping, data freshness, approval, validateOnly readiness, preflight, kill switch, or finance/supplier/product gates are missing.

This phase still does not store or use real provider tokens in Codex. It only proves how ERP will safely control all authorized accounts and ad groups inside MCC/BM/BC after real credentials are entered through ERP secret storage.

### P1.6 - Ads Automation Control Center UI

Before moving to real credential onboarding or live execution, ERP must expose one operator-facing control center:

- `/ads-settings` shows MCC/BM/BC manager-account readiness.
- `/ads-settings` embeds or links credential/token management as a first-class tab.
- `/ads-settings` shows child ad account readiness under each manager account.
- `/ads-settings` shows import schedule/readiness for daily read-only exports into ad accounts, ad groups, and advertising costs.
- `/ads-settings` shows mapping health from provider entities to product, supplier, order, profit, stock, refund, and cashflow evidence.
- `/ads-settings` shows safety gates: approval, validateOnly, kill switch, production flag, loss limits, idempotency, and rollback readiness.
- `/api-tokens` stays compatible for existing technical workflows.

This phase is still local-only. It may use fixture/demo/readiness data and existing ERP endpoints. It must not ask Codex/operator for real MCC/BM/BC tokens.

### P1.7 - Evidence, Finance, and Ads Gate Foundation

Before adding more UI or action-generation breadth, ERP must make the evidence layer explicit:

- Data mapping: ad group -> product -> order -> profit -> inventory -> supplier.
- Finance control: cashflow, loss limit, daily budget, monthly budget.
- Ads gate: validateOnly, approval, kill switch, audit, production flag.

The next local-only job is:

```text
ERP_JOB_000117 - ADS_AUTOMATION_EVIDENCE_FINANCE_GATE_FOUNDATION_LOCAL_ONLY
```

Expected output:

- one read-only `AdsAutomationEvidenceSnapshot`.
- per-ad-group readiness status: scale_ready, hold, monitor_only, blocked, needs_mapping.
- blockers for missing product mapping, stale order/profit/stock/supplier data, missing campaignBudgetId, cashflow risk, loss limit, kill switch, production flag, validateOnly, approval, and audit readiness.
- no live execution and no provider API calls.

See `15_ERP_EVIDENCE_FINANCE_ADS_GATE_AXIS.md`.

### P2 - Action Draft Layer

Convert eligible decisions into pending action drafts:

- update_campaign_budget.
- pause_campaign.
- pause_ad_group.
- monitor_only.
- internal task: supplier_sourcing.
- internal task: product_offer_fix.
- internal task: stop_import_review.

All drafts must require approval. Product kill must not map to product delete. It may map only to pause ads, stop import review, or supplier sourcing.

### P3 - Validate-Only and Approval

ERP must validate every provider action:

- schema validation.
- business guardrail validation.
- provider validateOnly where supported.
- budget cap validation.
- landing page allowlist validation.
- synced entity existence validation.
- before-state snapshot.

Only passed actions may be approved.

### P4 - Limited Live Execution

Only after P1-P3 are stable:

- allow narrowly scoped approved actions.
- start with pause/reduce/update budget only.
- keep create campaign PAUSED only.
- no auto-enable.
- no delete.
- no Performance Max, Shopping, Display, YouTube in MVP.
- require post-execution sync and 3/7 day evaluation.

## 5. Decision Gates

### Increase ads gate

An ad group can be a scale candidate only when:

- net profit after ads is positive.
- minimum orders are reached.
- attribution/data quality is high enough.
- cashflow gate allows scale.
- product gate is not blocked.
- supplier gate is not blocked.
- current budget and campaignBudgetId are verified.
- no protected/manual override label blocks it.

### Increase amount gate

Budget increase must be staged:

- default max increase: 20 percent.
- learning or medium confidence increase: 10 to 15 percent.
- high risk or low data quality: no increase.
- product/supplier uncertainty: no increase or monitor_only.

### Product allocation gate

A product can receive more budget only when:

- product net profit and margin are positive.
- ad-attributed profit is positive or test thesis is explicitly approved.
- return/cancel rate is below threshold.
- stock or fulfillment capacity is not blocked.
- at least one supplier has acceptable fit.
- product is mapped to ad groups with enough attribution confidence.

### Supplier selection gate

A supplier can support scale only when:

- current quote is approved or reviewable.
- cost keeps product economics positive.
- lead time and delivery risk are acceptable.
- settlement/payment data is fresh enough.
- return/cancel fault signal is not high.

If supplier data is weak, output supplier_sourcing or needs_review, not scale.

### Product kill gate

Do not kill a product because one supplier is weak.

A kill/stop decision requires:

- weak market signal or consistently negative economics.
- evidence across more than one supplier or proof no supplier can make economics positive.
- return/cancel/refund issue not solvable by supplier, offer, landing, or sale process.
- approved internal review.

Allowed MVP outputs:

- stop_ads_review.
- stop_import_review.
- supplier_sourcing.
- offer_fix.
- monitor_only.

Disallowed MVP outputs:

- delete_product.
- auto-hide product from all systems.
- provider delete campaign/ad group/ad.

### Pause campaign/ad group gate

Pause can be drafted when:

- spend is meaningful.
- no valid orders or negative net profit after ads.
- data quality is sufficient.
- sale/landing/tracking bottlenecks have been checked.
- entity is not protected.
- rollback plan exists.

Pause execution still requires ERP provider validateOnly where available, approval, production flag, and policy pass.

## 6. Additional Prerequisites For Future Platform API Automation

The next backlog must add or verify:

1. Single automation decision snapshot per day with immutable version.
2. Manager account control-plane registry for Google Ads MCC, Meta BM, and TikTok BC.
3. Child ad account, campaign, ad group, and campaignBudgetId hierarchy/readiness.
4. Entity mapping health dashboard: manager account, child ad account, campaign, ad group, product, supplier, landing page.
5. Data freshness dashboard for ads cost, orders, profit, inventory, supplier quotes, settlements.
6. Policy registry for scale caps, kill thresholds, pause thresholds, supplier/product gates.
7. Approval queue that groups actions by risk and money impact.
8. Idempotency keys and duplicate prevention.
9. Before/after snapshots for every executable action.
10. Rollback or resume plan for pause and budget changes.
11. Provider adapter capability matrix by platform and manager account type.
12. Dry-run and validate-only audit logs.
13. Post-action evaluation after 3 and 7 days.
14. Watcher/runner pointer audit so Codex local review stays tied to the right Drive root and runner job.
15. Ads Automation Control Center UI in `/ads-settings`, with `/api-tokens` folded into the ads governance flow.
16. ERP evidence snapshot that joins ad group, product, order, profit, stock, supplier, finance controls, and ads gates before UI/action expansion.

## 7. Current Integration Links

Keep the existing Drive root:

```text
https://drive.google.com/drive/folders/1wZ7zulU7IQJlqF05Y0qOk2N8Sy5RY39m
```

Use the following ChatGPT Web review conversations for the watcher/runner:

```text
primary: https://chatgpt.com/c/6a488458-bc88-83ec-9496-009f031f3c68
fallback: https://chatgpt.com/c/6a488468-d5f0-83ec-ab8b-14661585d6d2
```

If the active ChatGPT Web conversation changes again, update both:

- runner registry / project config.
- Codex to ChatGPT Web pointer target.

## 8. Acceptance Checklist

This priority axis is accepted only when:

- The system can rank scale, hold, reduce, and pause candidates by ad group.
- The system can model MCC/BM/BC as manager credentials that control authorized child ad accounts and nested campaign/ad group entities through ERP only.
- The system can prove no real provider token or plaintext secret is exposed outside ERP secret storage.
- The system can explain proposed budget amount and cap.
- The system can map ad group spend to product candidates.
- The system can block product scale on supplier, stock, return, or cash risk.
- The system can output product stop/kill candidates without deleting products.
- The system can draft pause campaign/ad group actions without live execution.
- The runner/watcher config points to the current Drive root and ChatGPT Web review URLs.
- Tests or static verification commands are recorded for every implementation phase.
- `/ads-settings` is the main control-plane UI for MCC/BM/BC manager accounts, credentials, child accounts, import readiness, mapping health, approval gates, and audit/rollback evidence.
- The system exposes a read-only evidence snapshot before drafting scale/pause actions.
- The system blocks scale when mapping, finance, supplier/stock, campaignBudgetId, validateOnly, approval, production flag, kill switch, or audit evidence is missing.
