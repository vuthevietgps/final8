# AI Operator Current State Report

Generated: 2026-06-10

## Scope

This report audits the current AI Operator backend and records the V2 upgrade applied from the technical document. The implementation keeps the current module as the foundation and adds deterministic registries/rules before any live action executor is expanded.

## Existing AI Operator Endpoints

All endpoints are under `GET/POST/PATCH /api/ai-operator/*` and guarded by `ai-assistant` permission.

- `GET /api/ai-operator/knowledge`
- `GET /api/ai-operator/token-management`
- `POST /api/ai-operator/sessions`
- `GET /api/ai-operator/sessions`
- `GET /api/ai-operator/sessions/:sessionId`
- `PATCH /api/ai-operator/sessions/:sessionId`
- `PATCH /api/ai-operator/sessions/:sessionId/review`
- `POST /api/ai-operator/messages/:messageId/feedback`
- `GET /api/ai-operator/analytics/summary`
- `GET /api/ai-operator/workflow-quality`
- `GET /api/ai-operator/snapshot`
- `GET /api/ai-operator/context`
- `GET /api/ai-operator/recommendations`
- `POST /api/ai-operator/chat`

## V2 Endpoints Added

- `GET /api/ai-operator/v2/registries`
- `GET /api/ai-operator/v2/metrics`
- `GET /api/ai-operator/v2/decision-rules`
- `POST /api/ai-operator/v2/decisions/evaluate`

These endpoints expose metadata and deterministic decision evaluation only. They do not execute live provider, finance, payment, or task actions.

## Current Architecture

Current module:

- `ai-operator.controller.ts`: API surface for knowledge, sessions, analytics, context, recommendations, chat, and V2 metadata.
- `ai-operator.service.ts`: routing, source loading, permission checks, context compaction, OpenAI/fallback rendering, session persistence, analytics, workflow quality.
- `ai-operator.knowledge.ts`: API catalog, role playbooks, scenario workflows and guardrails.
- `ai-operator.interfaces.ts`: operator snapshot, routing, auth, token policy and agent trace contracts.
- `ai-operator.v2-registry.ts`: newly added V2 business metrics, decision rules, response contracts, token budgets, SLA rules, data quality and decision evaluation.

The main technical debt remains that `ai-operator.service.ts` is still large. The V2 registry was split out as the first step toward the 5-layer architecture in the technical document.

## Workflow Registry

Current count: 35 scenario workflows.

V2 workflows added:

- `CFO-002` Ads budget cashflow gate
- `MKT-004` Marketing funnel health
- `MKT-005` Creative fatigue review
- `MKT-006` Offer performance review
- `OPS-003` Create sales SLA tasks from AI issue

All added workflows map their read APIs to existing source loaders so `workflow-quality` remains 9+ and does not show unmapped read APIs.

## Intent Coverage

Existing stable intents kept:

- `overview`
- `finance`
- `ads`
- `ad_group_profit_classification`
- `ads_diagnostic_checklist`
- `orders`
- `receivables`
- `operations`
- `token`
- `api`
- `sales`
- `supplier`
- `loose`

V2 intent families added:

- Director: `director_daily_overview`, `director_weekly_priority`, `business_risk_ranking`, `decision_waiting_approval`, `company_kpi_scorecard`
- CFO: `free_cash_summary`, `cashflow_forecast`, `ads_budget_cashflow_gate`, `owner_withdrawal_readiness`, `supplier_payment_priority`, `receivables_collection_priority`, `double_payment_risk`, `tax_cash_reserve_check`, `unit_economics`
- Marketing: `marketing_funnel_health`, `creative_fatigue_review`, `offer_performance_review`, `channel_mix_review`, `ads_scale_readiness`, `ads_kill_or_pause_recommendation`, `lead_quality_by_campaign`, `attribution_quality_check`
- Sales/Ops: `lead_followup_health`, `sales_conversion_by_user`, `lead_quality_by_source`, `lost_reason_summary`, `sales_sla_violation`, `sales_sla_task_creation`, `quote_readiness`
- Fulfillment: `late_order_diagnostic`, `fulfillment_bottleneck`, `tracking_issue_check`, `cancel_refund_risk`, `supplier_delay_risk`
- Integration: `token_health_check`, `fanpage_permission_check`, `platform_sync_health`, `openai_config_health`, `webhook_failure_diagnostic`

## OpenAI Call Sites

AI Operator calls OpenAI only in `tryAskOpenAI()` through `https://api.openai.com/v1/responses`.

Guardrails currently enforced:

- `tokenPolicy.mode === 'no_ai'` skips OpenAI.
- Blocked route skips OpenAI.
- Missing or placeholder OpenAI API key falls back to deterministic renderer.
- Model input is compacted by token policy before sending.
- Response contract addendum is appended if AI omits data/risk/approval sections.

## Token Policy

Existing modes:

- `no_ai`
- `small_ai`
- `analysis_ai`
- `deep_ai`

Added mode:

- `schema_ai`

New V2 workflow budgets are available in `GET /api/ai-operator/v2/registries`. Current chat still returns natural language; `schema_ai` is registered for internal structured decision output and future action-draft generation.

## Data Quality

Before this upgrade, the module had `assistantQuality`. V2 now adds `dataQuality` to compact scenario context:

- `score`
- `status`: `good | usable | weak | bad`
- `missingFields`
- `staleSources`
- `syncIssues`
- `attributionIssues`
- `warningMessages`

Rule added:

- If `dataQuality.status = bad`, AI must not make a firm business conclusion and should prioritize fixing missing/sync/attribution data.

## Decision Rules

V2 deterministic decision rules added:

- `ads_scale_readiness_rule`
- `owner_withdrawal_readiness_rule`
- `creative_fatigue_rule`
- `sales_sla_escalation_rule`

Rules return:

- pass/needs_review/blocked status
- failed conditions
- missing metrics
- management issues with severity score
- recommended actions
- approval requirement

## Response Contracts

V2 response contracts added:

- `executiveSummary`
- `cfoDecision`
- `marketingOptimization`
- `actionApproval`

`responseContractForIntent()` now returns V2 contract IDs for matching V2 intents while preserving old special contracts such as `adGroupProfitTable` and `adsDiagnosticChecklist`.

## Permission And Approval State

Current permission model:

- Controller requires `ai-assistant`.
- Route authorization checks source-level required permissions.
- If all required sources are denied, the route is blocked and a permission-denied answer is returned.

Current approval model:

- AI Operator remains read-only.
- Existing recommendations mark `requiresApproval`.
- Ops/marketing modules already have approval-only plans in places.
- V2 workflow result now returns approval metadata, but no live action executor was added in this pass.

## Raw Data And Token Risk

Current controls:

- `applyTokenPolicyToContext()` limits raw rows.
- `includeRawRowsLimit` is intent-specific.
- `no_ai` intents do not call OpenAI.
- V2 data quality and decision support are compact objects and are included in the model input only after token limiting.

Remaining risk:

- The service still builds broad snapshots for overview/loose routes.
- More extraction into Business Data Layer and Workflow Runner would reduce blast radius and token pressure further.

## Upgrade Applied In This Pass

- Added V2 registry file for metrics, decision rules, contracts, token budgets, SLA rules and deterministic evaluator.
- Extended AI Operator intent and token mode types.
- Added V2 registry/evaluate endpoints.
- Added V2 dataQuality, decisionSupport and workflowResult to every compact scenario context.
- Added routing for CFO cashflow gate, marketing funnel health, creative fatigue, offer performance and sales SLA task creation.
- Added V2 fallback renderers for CFO, marketing optimization and action approval/task draft style answers.
- Added V2 workflows to knowledge registry while keeping workflow-quality at 9+.
- Added regression tests for routing, deterministic decision evaluation and V2 context enrichment.

## Verification

- `npm test -- --runInBand ai-operator.service.spec.ts`: passed, 11/11 tests.
- `npm run build`: passed.

## Next Recommended Sprint

1. Split `ai-operator.service.ts` into routing, business data, decision, rendering and action layers.
2. Add real top-level APIs from the technical document, starting with:
   - `GET /api/finance/free-cash-summary`
   - `GET /api/finance/cashflow-forecast`
   - `GET /api/finance/unit-economics`
   - `GET /api/finance/ads-budget-cashflow-gate`
3. Add action draft, approval request, executor and audit log services before enabling any live write action.
4. Add after-action review and playbook learning log as suggestion-only first.
5. Add token usage and route-debug dashboards backed by persisted logs instead of log lines only.
