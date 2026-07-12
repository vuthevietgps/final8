import { AdsAutomationApprovalPreflightReviewExportService } from "./ads-automation-approval-preflight-review-export.service";
import { ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE } from "./ads-automation-approval-preflight-review-export.fixture";
import {
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import type { AdsAutomationApprovalPreflightGateFamilyKey } from "./contracts/ads-automation-approval-preflight-review-export.contract";

const cloneFixture = (): any =>
  JSON.parse(
    JSON.stringify(ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE),
  );

const findAction = (response: any, actionType: string): any => {
  const action = response.actionReviews.find(
    (candidate: any) => candidate.action_type === actionType,
  );
  expect(action).toBeDefined();
  return action;
};

const findPayloadItem = (items: any[], actionType: string): any => {
  const item = items.find(
    (candidate: any) => candidate.action_type === actionType,
  );
  expect(item).toBeDefined();
  return item;
};

const SUPPORTED_MVP_ACTIONS = [
  "update_campaign_budget",
  "pause_campaign",
  "pause_ad_group",
  "monitor_only",
];
const REQUIRED_GATE_FAMILIES = [
  ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
];
const MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION = [
  ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
];

const markScaleLocallyReadyExceptProduction = (payload: any): any => {
  const scaleApproval = findPayloadItem(
    payload.pendingApprovals,
    "update_campaign_budget",
  );
  const pauseApproval = findPayloadItem(
    payload.pendingApprovals,
    "pause_campaign",
  );
  const scalePlan = findPayloadItem(
    payload.validateOnlyLane.validationPlans,
    "update_campaign_budget",
  );
  const scalePreflight = findPayloadItem(
    payload.executionPreflightDryRun.executionRecords,
    "update_campaign_budget",
  );
  const sourceSummary = payload.sourceReadinessReviewExport.summary;

  sourceSummary.export_status = "ready_for_review";
  sourceSummary.campaignBudgetId_missing_rows = 0;
  sourceSummary.cashflow_first_scale_mode = "pending_validation";
  sourceSummary.platform_campaign_count = 1;
  sourceSummary.platform_ad_group_count = 1;
  sourceSummary.platform_campaignBudget_count = 1;
  sourceSummary.platform_campaignBudgetId_missing_rows = 0;
  sourceSummary.platform_unmapped_ad_group_count = 0;
  sourceSummary.platform_blocked_product_count = 0;
  sourceSummary.platform_blocked_supplier_count = 0;
  sourceSummary.platform_entity_blocking_reason_count = 0;
  payload.sourceReadinessReviewExport.platformEntityCoverage = {
    ...payload.sourceReadinessReviewExport.platformEntityCoverage,
    campaigns: {
      campaignIds: ["1001"],
      coveredCampaignCount: 1,
      missingCampaignIdRows: 0,
      blockers: [],
      coveredForDecision: true,
    },
    adGroups: {
      adGroupIds: ["2001"],
      coveredAdGroupCount: 1,
      missingAdGroupIdRows: 0,
      blockers: [],
      coveredForDecision: true,
    },
    campaignBudgets: {
      campaignBudgetIds: ["3001"],
      coveredCampaignBudgetCount: 1,
      missingCampaignBudgetIdRows: 0,
      campaignBudgetId_required: true,
      campaignBudgetId_no_fallback: true,
      campaignBudgetId_fallback_used: false,
      blockers: [],
      coveredForDecision: true,
    },
    productMapping: {
      mappedProductIds: ["P_SCALE"],
      mappedAdGroupIds: ["2001"],
      unmappedAdGroupIds: [],
      sourceReady: true,
      blockers: [],
      coveredForDecision: true,
    },
    inventoryProfit: {
      profitableProductIds: ["P_SCALE"],
      blockedProductIds: [],
      sourceReady: true,
      blockers: [],
      coveredForDecision: true,
    },
    supplierContext: {
      safeSupplierIds: ["SUP_SAFE"],
      blockedSupplierIds: [],
      supplierChoiceSafe: true,
      sourceReady: true,
      blockers: [],
      coveredForDecision: true,
    },
    freshnessCoverage: {
      latestSuccessfulSyncAt: "2026-07-04T06:45:00.000Z",
      latestRecordDate: "2026-07-04",
      blockingReasons: [],
    },
  };
  payload.sourceReadinessReviewExport.blockerReview.sourceBlockers = [];
  payload.sourceReadinessReviewExport.blockerReview.readonlyImportBlockers = [];
  payload.sourceReadinessReviewExport.blockerReview.readModelBlockers = [];
  payload.sourceReadinessReviewExport.blockerReview.productAllocationBlockers =
    [];
  payload.sourceReadinessReviewExport.blockerReview.supplierSafetyBlockers = [];
  payload.sourceReadinessReviewExport.blockerReview.cashflowFirstBlockers = [];
  payload.sourceReadinessReviewExport.blockerReview.globalBlockers = [];
  payload.sourceReadinessReviewExport.managerCandidateReview.scaleUpCandidates[0] =
    {
      ...payload.sourceReadinessReviewExport.managerCandidateReview
        .scaleUpCandidates[0],
      status: "candidate",
      effectiveStatus: "candidate_for_review",
      campaignBudgetId: "3001",
      blockers: [],
      missingFields: [],
    };

  scaleApproval.status = "approved";
  scaleApproval.productId = "P_SCALE";
  scaleApproval.supplierId = "SUP_SAFE";
  scaleApproval.typedPayload.campaignBudgetId = "3001";
  scaleApproval.typedPayload.campaignBudgetResourceName =
    "customers/1234567890/campaignBudgets/3001";
  scaleApproval.blockers = [];
  scaleApproval.missing_data_blockers = [];
  scaleApproval.idempotency_key =
    "ads-draft:2026-07-04:update_campaign_budget:2001";
  scaleApproval.sourceSyncDecisionEvidence = JSON.parse(
    JSON.stringify(pauseApproval.sourceSyncDecisionEvidence),
  );
  scaleApproval.sourceSyncDecisionGates = {
    canGenerateActionDraft: true,
    canRecommendAdsScale: true,
    canUseGoogleAdsDataClaim: true,
  };
  scaleApproval.source_evidence_references[0].evidence_metrics = {
    grossMarginVnd: 3200000,
    contributionProfitVnd: 2100000,
    netProfitAfterAdsVnd: 1300000,
  };

  scalePlan.campaignBudgetId = "3001";
  scalePlan.campaignBudgetResourceName =
    "customers/1234567890/campaignBudgets/3001";
  scalePlan.requested_change = scaleApproval.typedPayload;
  scalePlan.status = "validate_only_passed";
  scalePlan.providerValidationStatus = "provider_validate_passed";
  scalePlan.providerRequestId = "REQ-VALIDATE-SCALE-DEMO";
  scalePlan.providerValidatedAt = "2026-07-04T07:41:00.000Z";
  scalePlan.blockers = [];
  scalePlan.approval_can_be_considered_executable = true;
  scalePlan.next_required_action = "continue_human_approval_flow";

  scalePreflight.idempotency_key =
    "ads-execution-preflight:update-campaign-budget:REQ-SCALE-DEMO";
  scalePreflight.approval_status = "approved";
  scalePreflight.approval_decision_audit_id =
    "ADSAUDIT-approval-preflight-demo-scale-approve";
  scalePreflight.approval_decision_audit_persisted = true;
  scalePreflight.source_readiness_safe = true;
  scalePreflight.kill_switch_active = false;
  scalePreflight.kill_switch_reason = null;
  scalePreflight.validateOnly_status = "validate_only_passed";
  scalePreflight.policy_decision_id =
    "ADSPOLICY-approval-preflight-demo-scale-budget";
  scalePreflight.policy_decision_evidence_persisted = true;
  scalePreflight.policy_allowed = true;
  scalePreflight.google_ads_production_enabled = false;
  scalePreflight.preflight_status = "blocked_before_future_live_execution";
  scalePreflight.identifiers.campaignBudgetId = "3001";
  scalePreflight.identifiers.campaignBudgetResourceName =
    "customers/1234567890/campaignBudgets/3001";
  scalePreflight.requested_change = scaleApproval.typedPayload;
  scalePreflight.blockers = ["GOOGLE_ADS_PRODUCTION_ENABLED"];
  scalePreflight.source_pending_approval = scaleApproval;

  payload.approvalDecisionAuditRecords.push({
    ...payload.approvalDecisionAuditRecords[0],
    audit_id: "ADSAUDIT-approval-preflight-demo-scale-approve",
    idempotency_key: "ads-decision-audit:scale-budget:approve:REQ-SCALE-DEMO",
    approval_id: scaleApproval.approval_id,
    source_draft_id: scaleApproval.source_draft_id,
    source_decision_id: scaleApproval.source_decision_id,
    action_type: "update_campaign_budget",
    resource_type: "campaign_budget",
    entity_type: "ad_group",
    entity_id: "2001",
    previous_status: "pending_approval",
    proposed_status: "approved",
    reason:
      "Approve locally ready budget update for production-flag gate regression.",
    requestId: "REQ-SCALE-DEMO",
    pending_approval_snapshot: scaleApproval,
  });

  return payload;
};

describe("AdsAutomationApprovalPreflightReviewExportService", () => {
  let service: AdsAutomationApprovalPreflightReviewExportService;

  beforeEach(() => {
    service = new AdsAutomationApprovalPreflightReviewExportService();
  });

  it("builds a local-only review bundle with every scale gate blocked and safety actions still visible", () => {
    const response = service.build(
      ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE,
    );

    expect(response.schemaVersion).toBe(
      "ads_automation_approval_preflight_review_export.v1",
    );
    expect(response.exportMode).toBe("local_demo_fixture");
    expect(response.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        report_only: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        future_live_execution_allowed: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
        campaignBudgetId_no_fallback: true,
        erp_only_future_validator_approver_executor: true,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        export_status: "blocked_before_future_execution",
        source_readiness_export_status: "needs_attention",
        validateOnly_plans_received: 2,
        validateOnly_passed: 1,
        validateOnly_pending_or_blocked: 1,
        pending_approvals_received: 2,
        execution_preflight_records_received: 2,
        approval_decision_audit_records_received: 1,
        idempotency_duplicate_keys: 0,
        action_reviews: 3,
        scale_candidates_reviewed: 1,
        scale_candidates_blocked: 1,
        safety_actions_visible: 2,
        monitor_only_actions_visible: 1,
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 1,
        out_of_scope_non_provider_actions: 0,
        platform_entity_blocker_count: 13,
        scale_candidates_blocked_by_platform_entity_coverage: 1,
        execution_readiness_contract_present: true,
        execution_readiness_required_gate_families: 11,
        execution_readiness_blocked_gate_families: 11,
        execution_readiness_scale_candidate_blocked_by_all_gate_families: true,
        executable_now: 0,
        future_live_execution_allowed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(response.sourceDigest).toEqual(
      expect.objectContaining({
        duplicate_idempotency_keys: [],
        campaignBudgetId_no_fallback: true,
        execution_readiness_contract_schema_version:
          "ads_automation_execution_preflight_readiness_contract.v1",
        execution_readiness_supported_mvp_actions: [
          "update_campaign_budget",
          "pause_campaign",
          "pause_ad_group",
          "monitor_only",
        ],
        execution_readiness_required_gate_families: [
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ],
        platformEntityCoverageBlockers: expect.arrayContaining([
          "platform_entity.campaigns.campaignId_missing_rows",
          "platform_entity.adGroups.adGroupId_missing_rows",
          "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
          "platform_entity.productMapping.product_mapping_unmapped_ad_groups",
          "platform_entity.inventoryProfit.inventory_profit_not_ready_for_ads_automation_decision",
          "platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision",
          "platform_entity.freshnessCoverage.freshness_stale",
        ]),
      }),
    );
    expect(response.sourceDecisionAnswerReview).toBe(
      ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE
        .sourceReadinessReviewExport.decisionAnswerReview,
    );
    expect(response.sourceDigest.sourceDecisionAnswerReview).toBe(
      response.sourceDecisionAnswerReview,
    );
    expect(response.executionReadinessContractReview).toEqual(
      expect.objectContaining({
        contract_present: true,
        source_schema_version:
          "ads_automation_execution_preflight_readiness_contract.v1",
        supported_mvp_actions: [
          "update_campaign_budget",
          "pause_campaign",
          "pause_ad_group",
          "monitor_only",
        ],
        required_gate_families: [
          "future_execution_action_scope",
          "approval_status",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ],
        missing_must_have_items: [],
        action_type_coverage: expect.arrayContaining([
          expect.objectContaining({
            action_type: "update_campaign_budget",
            records_checked: 1,
            records_blocked: 1,
            scale_candidate: true,
            safety_action: false,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_campaign",
            records_checked: 1,
            records_blocked: 1,
            validateOnly_passed_records: 1,
            scale_candidate: false,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_ad_group",
            records_checked: 0,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "monitor_only",
            records_checked: 0,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
        ]),
        missing_mvp_action_coverage: [],
        records_checked: 2,
        blocked_gate_families: 11,
        required_pre_live_gates_passed_records: 0,
        required_pre_live_gates_blocked_records: 2,
        scale_candidate_blocked_by_all_gate_families: true,
        pause_safety_records_visible: 1,
        monitor_only_safety_records_visible: 1,
        safety_action_records_visible: 2,
        executable_now_actions: 0,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        review_status: "contract_visible_blocked_before_live",
      }),
    );
    expect(
      response.executionReadinessContractReview
        .must_have_before_future_live_execution,
    ).toEqual(
      expect.arrayContaining([
        "approved_action_present",
        "validateOnly_status_passed",
        "campaignBudgetId_present_for_update_campaign_budget",
        "GOOGLE_ADS_PRODUCTION_ENABLED_true",
        "live_executor_path_implemented_later",
      ]),
    );
    expect(response.markdownPreview).toContain(
      "action_type_coverage=update_campaign_budget:checked=1:blocked=1:pre_live_passed=0:validateOnly_passed=0:safety=false:execution_allowed_now=false",
    );
    expect(response.markdownPreview).toContain(
      "missing_mvp_action_coverage=none",
    );
    expect(response.sourceDecisionAnswerReview).toEqual(
      expect.objectContaining({
        may_increase_ads: false,
        max_increase_vnd: 0,
        scale_up_execution_mode: "monitor_only",
        ad_groups_to_increase: [],
        products_can_receive_budget: [],
        supplier_choice_safe: false,
        safe_supplier_choices: [],
        product_kill_or_stop_review_needed: false,
        campaign_or_ad_group_pause_recommended: true,
        blocking_reasons: expect.arrayContaining([
          "source_readiness_review_not_ready",
          "campaignBudgetId_missing_no_fallback",
        ]),
        execution_allowed_now: false,
      }),
    );
    expect(
      response.sourceDecisionAnswerReview.blocked_product_budget_candidates,
    ).toEqual([
      expect.objectContaining({
        entityId: "P_SCALE_BLOCKED",
        blockers: expect.arrayContaining([
          "inventory_profit_not_ready_for_ads_automation_decision",
        ]),
      }),
    ]);
    expect(
      response.sourceDecisionAnswerReview.blocked_supplier_choices,
    ).toEqual([
      expect.objectContaining({
        entityId: "SUP_STALE",
        blockers: expect.arrayContaining([
          "supplier_safety_not_ready_for_ads_automation_decision",
        ]),
      }),
    ]);

    const blockedGateKeys = response.gateFamilyReview
      .filter((gate) => gate.status === "blocked")
      .map((gate) => gate.key);
    expect(blockedGateKeys).toEqual([
      "source_readiness",
      "campaignBudgetId",
      "finance_policy",
      "validateOnly",
      "approval",
      "audit_preflight",
      "idempotency",
      "kill_switch",
      "production_flag",
    ]);

    const scale = response.actionReviews.find(
      (action) => action.action_type === "update_campaign_budget",
    )!;
    expect(scale).toEqual(
      expect.objectContaining({
        status: "blocked",
        is_scale_candidate: true,
        is_safety_action: false,
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: null,
        productId: "P_SCALE_BLOCKED",
        supplierId: "SUP_STALE",
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        idempotency_duplicate: false,
        mvp_action_contract: expect.objectContaining({
          supported_mvp_action: true,
          action_scope: "provider_validateOnly_required",
          preflight_treatment: "eligible_for_future_provider_preflight",
          provider_validateOnly_required_before_future_execution: true,
          execution_allowed_now: false,
        }),
      }),
    );
    expect(scale.campaignBudgetId).not.toBe(scale.campaignId);
    expect(scale.campaignBudgetId).not.toBe(scale.adGroupId);
    expect(scale.gateStatuses).toEqual({
      source_readiness: "blocked",
      campaignBudgetId: "blocked",
      finance_policy: "blocked",
      validateOnly: "blocked",
      approval: "blocked",
      audit_preflight: "blocked",
      idempotency: "blocked",
      kill_switch: "blocked",
      production_flag: "blocked",
    });
    expect(scale.gateBlockers.source_readiness).toEqual(
      expect.arrayContaining([
        "source_readiness_review_not_ready",
        "source_readiness.source_sync_gate_blocked_action_draft",
        "source_sync_gate_blocked_action_draft",
        "source_sync_gate_blocked_ads_scale_recommendation",
        "source_sync_gate_blocked_google_ads_data_claim",
        "freshness_stale",
        "platform_entity.productMapping.product_mapping_unmapped_ad_groups",
        "platform_entity.productMapping.adGroupId_unmapped_for_action",
        "platform_entity.productMapping.source_not_ready",
        "platform_entity.freshnessCoverage.freshness_stale",
      ]),
    );
    expect(scale.gateBlockers.campaignBudgetId).toEqual(
      expect.arrayContaining([
        "campaignBudgetId_missing_no_fallback",
        "campaignBudgetId_missing_in_source_readiness_review",
        "campaignBudgetId",
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
      ]),
    );
    expect(scale.gateBlockers.finance_policy).toEqual(
      expect.arrayContaining([
        "policy_allowed",
        "policy_decision_missing",
        "cashflow_first_scale_mode_monitor_only",
        "approval.gross_margin_missing",
        "approval.contribution_profit_missing",
        "approval.daily_loss_limit_missing",
        "platform_entity.inventoryProfit.inventory_profit_not_ready_for_ads_automation_decision",
        "platform_entity.inventoryProfit.source_not_ready",
        "platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision",
        "platform_entity.supplierContext.source_not_ready",
      ]),
    );
    expect(scale.platform_entity_coverage_action_blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "campaignBudgetId",
          campaignId: "1001",
          adGroupId: "2001",
          campaignBudgetId: null,
          productId: "P_SCALE_BLOCKED",
          supplierId: "SUP_STALE",
          blocker:
            "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
        }),
        expect.objectContaining({
          scope: "productId",
          productId: "P_SCALE_BLOCKED",
          blocker: "platform_entity.inventoryProfit.product_blocked_for_action",
        }),
        expect.objectContaining({
          scope: "supplierId",
          supplierId: "SUP_STALE",
          blocker:
            "platform_entity.supplierContext.supplier_blocked_for_action",
        }),
        expect.objectContaining({
          scope: "freshness",
          campaignId: "1001",
          adGroupId: "2001",
          campaignBudgetId: null,
          productId: "P_SCALE_BLOCKED",
          supplierId: "SUP_STALE",
          blocker: "platform_entity.freshnessCoverage.freshness_stale",
        }),
      ]),
    );
    expect(scale.gateBlockers.validateOnly).toEqual(
      expect.arrayContaining([
        "validateOnly_not_passed:blocked_before_validate_only",
        "validateOnly.campaignBudgetId",
        "validateOnly.freshness_stale",
        "validateOnly_plan_found",
        "validateOnly_passed",
      ]),
    );
    expect(scale.gateBlockers.approval).toEqual(
      expect.arrayContaining([
        "approval_not_approved:pending_approval",
        "approved_action",
        "approval.gross_margin_missing",
        "approval.campaignBudgetId_missing_no_fallback",
      ]),
    );
    expect(scale.gateBlockers.audit_preflight).toEqual(
      expect.arrayContaining([
        "approval_decision_audit_missing",
        "approval_decision_audit_found",
        "execution_preflight_blocked",
        "future_live_execution_allowed_false_local_only",
        "live_path_not_implemented",
      ]),
    );
    expect(scale.gateBlockers.idempotency).toEqual(
      expect.arrayContaining([
        "idempotency_key_unsafe_or_missing",
        "idempotency_key_safe",
      ]),
    );
    expect(scale.gateBlockers.kill_switch).toEqual(
      expect.arrayContaining([
        "kill_switch_active",
        "kill_switch_off",
        "kill_switch.director_emergency_stop_active",
      ]),
    );
    expect(scale.gateBlockers.production_flag).toEqual(
      expect.arrayContaining([
        "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
        "GOOGLE_ADS_PRODUCTION_ENABLED",
      ]),
    );

    const pause = response.actionReviews.find(
      (action) => action.action_type === "pause_campaign",
    )!;
    expect(pause).toEqual(
      expect.objectContaining({
        status: "reviewable_safety_action",
        is_safety_action: true,
        approval_status: "approved",
        validateOnly_status: "validate_only_passed",
        policy_allowed: true,
        source_readiness_safe: true,
        kill_switch_active: false,
        google_ads_production_enabled: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(pause.gateStatuses).toEqual(
      expect.objectContaining({
        source_readiness: "passed",
        validateOnly: "passed",
        approval: "passed",
        audit_preflight: "blocked",
        idempotency: "passed",
        kill_switch: "passed",
        production_flag: "blocked",
      }),
    );
    expect(pause.gateBlockers.audit_preflight).toEqual([
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(pause.gateBlockers.production_flag).toEqual([
      "GOOGLE_ADS_PRODUCTION_ENABLED",
      "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
    ]);

    const monitorOnly = response.actionReviews.find(
      (action) => action.action_type === "monitor_only",
    )!;
    expect(monitorOnly).toEqual(
      expect.objectContaining({
        status: "monitor_only_visible",
        is_safety_action: true,
        blockers: [],
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        mvp_action_contract: expect.objectContaining({
          supported_mvp_action: true,
          action_scope: "monitor_only_safety_action",
          preflight_treatment: "visible_non_executable_safety_action",
          monitor_only_safety_action: true,
          visible_as_safety_action: true,
          provider_validateOnly_required_before_future_execution: false,
          execution_allowed_now: false,
        }),
      }),
    );
    for (const key of Object.keys(
      monitorOnly.gateStatuses,
    ) as AdsAutomationApprovalPreflightGateFamilyKey[]) {
      expect(monitorOnly.gateStatuses[key]).toBe("not_applicable");
    }
    expect(response.safetyActionReview).toEqual(
      expect.objectContaining({
        pause_or_reduce_actions_visible: 1,
        monitor_only_actions_visible: 1,
      }),
    );
    expect(response.mvpActionContractReview).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 1,
        out_of_scope_non_provider_actions: 0,
        supported_mvp_actions: 3,
        unsupported_mvp_actions: 0,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(response.mvpActionContractReview.action_contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "update_campaign_budget",
          mvp_action_contract: expect.objectContaining({
            action_scope: "provider_validateOnly_required",
            provider_validateOnly_required_before_future_execution: true,
          }),
          evidence: expect.arrayContaining([
            "provider_mvp_action_requires_future_erp_owned_provider_validateOnly=true",
          ]),
        }),
        expect.objectContaining({
          action_type: "monitor_only",
          source: "monitor_only_action",
          mvp_action_contract: expect.objectContaining({
            action_scope: "monitor_only_safety_action",
            preflight_treatment: "visible_non_executable_safety_action",
          }),
          evidence: expect.arrayContaining([
            "monitor_only_visible_non_executable_safety_action=true",
          ]),
        }),
      ]),
    );
    expect(response.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "mvp_action_contract",
          status: "ready_for_review",
          lines: expect.arrayContaining([
            expect.stringContaining("scope=provider_validateOnly_required"),
            expect.stringContaining("scope=monitor_only_safety_action"),
          ]),
        }),
        expect.objectContaining({
          section_id: "execution_readiness_contract",
          status: "ready_for_review",
          lines: expect.arrayContaining([
            "contract_present=true",
            expect.stringContaining(
              "supported_mvp_actions=update_campaign_budget, pause_campaign, pause_ad_group, monitor_only",
            ),
            expect.stringContaining(
              "must_have_before_future_live_execution=approved_action_present",
            ),
            "missing_must_have_items=none",
            "records_checked=2",
            "blocked_gate_families=11",
            "scale_candidate_blocked_by_all_gate_families=true",
            "execution_allowed_now=false",
            "production_ready=false",
          ]),
        }),
        expect.objectContaining({
          section_id: "platform_entity_coverage_gates",
          status: "attention",
          lines: expect.arrayContaining([
            expect.stringContaining("campaignBudgetIdMissingRows=1"),
            expect.stringContaining("platform_entity_blockers="),
            expect.stringContaining("action_scoped_platform_entity_blockers="),
            "scale_candidates_blocked_by_platform_entity_coverage=1",
          ]),
        }),
        expect.objectContaining({
          section_id: "source_decision_answers",
          status: "attention",
          lines: expect.arrayContaining([
            "may_increase_ads=false",
            "max_increase_vnd=0",
            "ad_groups_to_increase=none",
            "products_can_receive_budget=none",
            "blocked_product_budget_candidates=P_SCALE_BLOCKED",
            "safe_supplier_choices=none",
            "blocked_supplier_choices=SUP_STALE",
            "product_kill_or_stop_review_needed=false",
            "campaign_or_ad_group_pause_recommended=true",
            expect.stringContaining("blocking_reasons="),
          ]),
        }),
      ]),
    );
    expect(response.markdownPreview).toContain("may_increase_ads=false");
    expect(response.markdownPreview).toContain(
      "blocked_product_budget_candidates=P_SCALE_BLOCKED",
    );
    expect(response.markdownPreview).toContain("safe_supplier_choices=none");
    expect(response.markdownPreview).toContain(
      "campaign_or_ad_group_pause_recommended=true",
    );
    expect(response.markdownPreview).toContain(
      "MVP provider actions requiring future ERP validateOnly: 2",
    );
    expect(response.markdownPreview).toContain(
      "MVP monitor-only visible safety actions: 1",
    );
    expect(response.markdownPreview).toContain("MVP contract scopes:");
    expect(response.markdownPreview).toContain("Execution readiness contract:");
    expect(response.markdownPreview).toContain("contract_present=true");
    expect(response.markdownPreview).toContain(
      "supported_mvp_actions=update_campaign_budget, pause_campaign, pause_ad_group, monitor_only",
    );
    expect(response.markdownPreview).toContain(
      "scale_candidate_blocked_by_all_gate_families=true",
    );
    expect(response.markdownPreview).toContain("missing_must_have_items=none");
    expect(response.markdownPreview).toContain("Platform entity blockers:");
    expect(response.markdownPreview).toContain(
      "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
    );
    expect(response.markdownPreview).toContain(
      "Scale candidates blocked by platform entity coverage: 1",
    );
    expect(response.markdownPreview).toContain(
      "Live execution remains blocked",
    );
  });

  it("renders per-entity approval-preflight rows for scale, pause or kill, product allocation, and supplier safety review", () => {
    const response = service.build(
      ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE,
    );

    expect(response.platformEntityCoverageReview).toEqual(
      expect.objectContaining({
        campaignMetricRollups: expect.arrayContaining([
          expect.stringContaining("Campaign metric rollup: entityId=1001"),
        ]),
        adGroupMetricRollups: expect.arrayContaining([
          expect.stringContaining("Ad group metric rollup: entityId=2001"),
          expect.stringContaining("Ad group metric rollup: entityId=2002"),
        ]),
        campaignBudgetMetricRollups: expect.arrayContaining([
          expect.stringContaining(
            "Campaign budget metric rollup: entityId=3002",
          ),
        ]),
        productMappings: expect.arrayContaining([
          expect.stringContaining("Product mapping row: productId=P_BAD"),
        ]),
        productReadiness: expect.arrayContaining([
          expect.stringContaining("Product readiness row: productId=P_BAD"),
        ]),
        supplierReadiness: expect.arrayContaining([
          expect.stringContaining(
            "Supplier readiness row: supplierId=SUP_WEAK_1",
          ),
        ]),
      }),
    );
    expect(response.platformEntityCoverageReview!.adGroupMetricRollups).toEqual(
      expect.arrayContaining([
        expect.stringContaining("linkedDecisionTypes=scale_amount"),
        expect.stringContaining(
          "linkedDecisionTypes=campaign_or_ad_group_pause",
        ),
      ]),
    );
    expect(response.platformEntityCoverageReview!.productReadiness).toEqual(
      expect.arrayContaining([
        expect.stringContaining("needsKillOrStopReview=true"),
        expect.stringContaining(
          "blockers=product_net_profit_not_positive, negative_product_economics",
        ),
      ]),
    );
    expect(response.platformEntityCoverageReview!.supplierReadiness).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "blockers=supplier_safety_not_ready_for_ads_automation_decision, supplier_lead_time_too_high",
        ),
      ]),
    );

    expect(response.renderedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section_id: "platform_entity_coverage_review",
          status: "attention",
          lines: expect.arrayContaining([
            expect.stringContaining("Ad group metric rollup: entityId=2001"),
            expect.stringContaining("Ad group metric rollup: entityId=2002"),
            expect.stringContaining("Product mapping row: productId=P_BAD"),
            expect.stringContaining("Product readiness row: productId=P_BAD"),
            expect.stringContaining(
              "Supplier readiness row: supplierId=SUP_WEAK_1",
            ),
          ]),
        }),
      ]),
    );
    expect(response.markdownPreview).toContain("Platform entity row review:");
    expect(response.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2001",
    );
    expect(response.markdownPreview).toContain(
      "Ad group metric rollup: entityId=2002",
    );
    expect(response.markdownPreview).toContain(
      "Product mapping row: productId=P_BAD",
    );
    expect(response.markdownPreview).toContain(
      "Product readiness row: productId=P_BAD",
    );
    expect(response.markdownPreview).toContain(
      "Supplier readiness row: supplierId=SUP_WEAK_1",
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
  });

  it("keeps a locally ready budget update blocked by the production flag without enabling execution", () => {
    const payload = markScaleLocallyReadyExceptProduction(cloneFixture());

    const response = service.build(payload);
    const scale = findAction(response, "update_campaign_budget");

    expect(scale).toEqual(
      expect.objectContaining({
        status: "blocked",
        campaignBudgetId: "3001",
        approval_status: "approved",
        validateOnly_status: "validate_only_passed",
        preflight_status: "blocked_before_future_live_execution",
        policy_allowed: true,
        source_readiness_safe: true,
        kill_switch_active: false,
        google_ads_production_enabled: false,
        idempotency_safe: true,
        idempotency_duplicate: false,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(scale.gateStatuses).toEqual({
      source_readiness: "passed",
      campaignBudgetId: "passed",
      finance_policy: "passed",
      validateOnly: "passed",
      approval: "passed",
      audit_preflight: "blocked",
      idempotency: "passed",
      kill_switch: "passed",
      production_flag: "blocked",
    });
    expect(scale.gateBlockers.audit_preflight).toEqual([
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(scale.gateBlockers.production_flag).toEqual([
      "GOOGLE_ADS_PRODUCTION_ENABLED",
      "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
    ]);
    expect(scale.blockers).toEqual([
      "GOOGLE_ADS_PRODUCTION_ENABLED",
      "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(response.summary).toEqual(
      expect.objectContaining({
        executable_now: 0,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        platform_entity_blocker_count: 0,
        scale_candidates_blocked_by_platform_entity_coverage: 0,
      }),
    );
  });

  it("keeps a locally ready provider action blocked even when production flag evidence is true", () => {
    const payload = markScaleLocallyReadyExceptProduction(cloneFixture());
    const scalePreflight = findPayloadItem(
      payload.executionPreflightDryRun.executionRecords,
      "update_campaign_budget",
    );
    scalePreflight.google_ads_production_enabled = true;
    scalePreflight.preflight_status = "future_live_gates_passed_local_only";
    scalePreflight.blockers = [];

    const response = service.build(payload);
    const scale = findAction(response, "update_campaign_budget");

    expect(scale).toEqual(
      expect.objectContaining({
        status: "blocked",
        google_ads_production_enabled: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(scale.gateStatuses).toEqual({
      source_readiness: "passed",
      campaignBudgetId: "passed",
      finance_policy: "passed",
      validateOnly: "passed",
      approval: "passed",
      audit_preflight: "blocked",
      idempotency: "passed",
      kill_switch: "passed",
      production_flag: "passed",
    });
    expect(scale.gateBlockers.audit_preflight).toEqual([
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(scale.blockers).toEqual([
      "future_live_execution_allowed_false_local_only",
      "live_path_not_implemented",
    ]);
    expect(response.summary).toEqual(
      expect.objectContaining({
        executable_now: 0,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
  });

  it("does not block a locally ready scale action with unrelated blocked product and supplier coverage", () => {
    const payload = markScaleLocallyReadyExceptProduction(cloneFixture());
    const scaleApproval = findPayloadItem(
      payload.pendingApprovals,
      "update_campaign_budget",
    );
    const scalePreflight = findPayloadItem(
      payload.executionPreflightDryRun.executionRecords,
      "update_campaign_budget",
    );

    scaleApproval.productId = "P_SCALE";
    scaleApproval.supplierId = "SUP_SAFE";
    scalePreflight.source_pending_approval = scaleApproval;
    payload.sourceReadinessReviewExport.platformEntityCoverage.inventoryProfit =
      {
        profitableProductIds: ["P_SCALE"],
        blockedProductIds: ["P_OTHER_BLOCKED"],
        sourceReady: true,
        blockers: ["product_net_profit_not_positive"],
        coveredForDecision: false,
      };
    payload.sourceReadinessReviewExport.platformEntityCoverage.supplierContext =
      {
        safeSupplierIds: ["SUP_SAFE"],
        blockedSupplierIds: ["SUP_OTHER_BLOCKED"],
        supplierChoiceSafe: false,
        sourceReady: true,
        blockers: ["supplier_safety_not_ready_for_ads_automation_decision"],
        coveredForDecision: false,
      };

    const response = service.build(payload);
    const scale = findAction(response, "update_campaign_budget");

    expect(response.sourceDigest.platformEntityCoverageBlockers).toEqual(
      expect.arrayContaining([
        "platform_entity.inventoryProfit.product_net_profit_not_positive",
        "platform_entity.inventoryProfit.not_covered_for_decision",
        "platform_entity.supplierContext.supplier_safety_not_ready_for_ads_automation_decision",
        "platform_entity.supplierContext.not_covered_for_decision",
      ]),
    );
    expect(scale).toEqual(
      expect.objectContaining({
        status: "blocked",
        productId: "P_SCALE",
        supplierId: "SUP_SAFE",
        platform_entity_coverage_action_blockers: [],
        blockers: [
          "GOOGLE_ADS_PRODUCTION_ENABLED",
          "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
          "future_live_execution_allowed_false_local_only",
          "live_path_not_implemented",
        ],
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        platform_entity_blocker_count: 4,
        scale_candidates_blocked_by_platform_entity_coverage: 0,
        executable_now: 0,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
  });

  it("renders non-MVP ERP-internal actions as out of scope for the validate-only contract", () => {
    const payload = cloneFixture();
    payload.validateOnlyLane.validationPlans.push({
      ...payload.validateOnlyLane.validationPlans[0],
      validation_id:
        "ADSPROVIDERVALIDATE-approval-preflight-demo-supplier-sourcing",
      pending_action_id:
        "ADSPENDINGACTION-approval-preflight-demo-supplier-sourcing",
      approval_id: "ADSAPPROVAL-approval-preflight-demo-supplier-sourcing",
      action_type: "supplier_sourcing",
      action_family: "internal_task",
      provider: "erp_internal",
      resource_type: "supplier",
      entity_type: "supplier",
      entity_id: "SUP_STALE",
      customerId: null,
      campaignId: null,
      adGroupId: null,
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
      requested_change: {
        productId: "P_SCALE_BLOCKED",
        supplierId: "SUP_STALE",
        task: "review_supplier_sourcing",
      },
      status: "skipped_non_provider_action",
      providerValidationStatus: "not_applicable",
      providerRequestId: null,
      providerValidatedAt: null,
      providerValidationErrors: [],
      blockers: [],
      approval_can_be_considered_executable: false,
      validate_only_required_before_execution: false,
      next_required_action: "not_applicable_non_provider_action",
      mvp_action_contract: {
        supported_mvp_action: false,
        action_scope: "out_of_scope_non_provider_action",
        preflight_treatment: "not_in_mvp_validateOnly_contract",
        provider_validateOnly_required_before_future_execution: false,
        monitor_only_safety_action: false,
        visible_as_safety_action: false,
        approval_required_before_execution: true,
        future_live_execution_allowed: false,
        executable_now: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      },
    });

    const response = service.build(payload);
    const supplier = findAction(response, "supplier_sourcing");

    expect(supplier).toEqual(
      expect.objectContaining({
        provider: "erp_internal",
        mvp_action_contract: expect.objectContaining({
          supported_mvp_action: false,
          action_scope: "out_of_scope_non_provider_action",
          preflight_treatment: "not_in_mvp_validateOnly_contract",
          provider_validateOnly_required_before_future_execution: false,
          execution_allowed_now: false,
        }),
        mvp_action_contract_evidence: expect.arrayContaining([
          "non_mvp_internal_action_out_of_scope=true",
        ]),
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    );
    expect(response.summary).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 1,
        out_of_scope_non_provider_actions: 1,
      }),
    );
    expect(response.mvpActionContractReview).toEqual(
      expect.objectContaining({
        provider_mvp_actions_requiring_validateOnly: 2,
        monitor_only_mvp_safety_actions: 1,
        out_of_scope_non_provider_actions: 1,
        unsupported_mvp_actions: 1,
      }),
    );
    expect(response.mvpActionContractReview.action_contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: "supplier_sourcing",
          mvp_action_contract: expect.objectContaining({
            action_scope: "out_of_scope_non_provider_action",
          }),
          evidence: expect.arrayContaining([
            "non_mvp_internal_action_out_of_scope=true",
          ]),
        }),
      ]),
    );
    expect(response.markdownPreview).toContain(
      "Non-MVP internal actions out of scope: 1",
    );
  });

  it("classifies focused validateOnly, approval, preflight, duplicate idempotency, and source-readiness blockers", () => {
    const fixtureResponse = service.build(cloneFixture());
    const fixtureScale = findAction(fixtureResponse, "update_campaign_budget");
    expect(fixtureScale.gateBlockers.campaignBudgetId).toEqual(
      expect.arrayContaining([
        "campaignBudgetId_missing_no_fallback",
        "campaignBudgetId_missing_in_source_readiness_review",
      ]),
    );
    expect(fixtureScale.gateBlockers.source_readiness).toEqual(
      expect.arrayContaining([
        "source_readiness_review_not_ready",
        "freshness_stale",
      ]),
    );
    expect(fixtureScale.gateBlockers.kill_switch).toEqual(
      expect.arrayContaining(["kill_switch_active"]),
    );

    const missingValidateOnlyPayload = cloneFixture();
    missingValidateOnlyPayload.validateOnlyLane.validationPlans =
      missingValidateOnlyPayload.validateOnlyLane.validationPlans.filter(
        (plan: any) => plan.action_type !== "update_campaign_budget",
      );
    const missingValidateOnlyScale = findAction(
      service.build(missingValidateOnlyPayload),
      "update_campaign_budget",
    );
    expect(missingValidateOnlyScale.gateBlockers.validateOnly).toEqual(
      expect.arrayContaining(["validateOnly_plan_missing"]),
    );
    expect(missingValidateOnlyScale.gateStatuses.validateOnly).toBe("blocked");

    const missingApprovalPayload = cloneFixture();
    missingApprovalPayload.pendingApprovals =
      missingApprovalPayload.pendingApprovals.filter(
        (approval: any) => approval.action_type !== "pause_campaign",
      );
    const missingApprovalPause = findAction(
      service.build(missingApprovalPayload),
      "pause_campaign",
    );
    expect(missingApprovalPause.gateBlockers.approval).toEqual(
      expect.arrayContaining(["approval_record_missing"]),
    );
    expect(missingApprovalPause.gateStatuses.approval).toBe("blocked");

    const missingPreflightPayload = cloneFixture();
    missingPreflightPayload.executionPreflightDryRun = null;
    const missingPreflightPause = findAction(
      service.build(missingPreflightPayload),
      "pause_campaign",
    );
    expect(missingPreflightPause.gateBlockers.audit_preflight).toEqual(
      expect.arrayContaining(["execution_preflight_missing"]),
    );
    expect(missingPreflightPause.gateStatuses.audit_preflight).toBe("blocked");

    const duplicateIdempotencyPayload = cloneFixture();
    const duplicateKey = "ads-execution-preflight:duplicate-local-review-key";
    duplicateIdempotencyPayload.executionPreflightDryRun.executionRecords =
      duplicateIdempotencyPayload.executionPreflightDryRun.executionRecords.map(
        (record: any) => ({
          ...record,
          idempotency_key: duplicateKey,
        }),
      );
    const duplicateResponse = service.build(duplicateIdempotencyPayload);
    expect(duplicateResponse.summary.idempotency_duplicate_keys).toBe(1);
    expect(duplicateResponse.sourceDigest.duplicate_idempotency_keys).toEqual([
      duplicateKey,
    ]);
    for (const actionType of ["update_campaign_budget", "pause_campaign"]) {
      const action = findAction(duplicateResponse, actionType);
      expect(action).toEqual(
        expect.objectContaining({
          idempotency_key: duplicateKey,
          idempotency_safe: true,
          idempotency_duplicate: true,
        }),
      );
      expect(action.gateBlockers.idempotency).toEqual(
        expect.arrayContaining(["idempotency_key_duplicate"]),
      );
      expect(action.gateStatuses.idempotency).toBe("blocked");
    }
  });

  it("marks missing and incomplete execution readiness action coverage as local review defects", () => {
    const cases = [
      {
        name: "missing contract",
        mutate: (payload: any) => {
          delete payload.executionPreflightDryRun.executionReadinessContract;
        },
        contractPresent: false,
        coveragePresent: false,
        missingCoverage: SUPPORTED_MVP_ACTIONS,
        defects: [
          "execution_readiness_contract_missing",
          "missing_mvp_action_coverage:update_campaign_budget",
          "missing_mvp_action_coverage:pause_campaign",
          "missing_mvp_action_coverage:pause_ad_group",
          "missing_mvp_action_coverage:monitor_only",
        ],
        reviewStatus: "contract_missing",
      },
      {
        name: "absent action_type_coverage",
        mutate: (payload: any) => {
          delete payload.executionPreflightDryRun.executionReadinessContract
            .action_type_coverage;
        },
        contractPresent: true,
        coveragePresent: false,
        missingCoverage: SUPPORTED_MVP_ACTIONS,
        defects: [
          "execution_readiness_contract_action_type_coverage_absent",
          "missing_mvp_action_coverage:update_campaign_budget",
          "missing_mvp_action_coverage:pause_campaign",
          "missing_mvp_action_coverage:pause_ad_group",
          "missing_mvp_action_coverage:monitor_only",
        ],
        reviewStatus: "contract_incomplete_local_review_defect",
      },
      {
        name: "one MVP action row missing",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.action_type_coverage =
            payload.executionPreflightDryRun.executionReadinessContract.action_type_coverage.filter(
              (row: any) => row.action_type !== "pause_ad_group",
            );
        },
        contractPresent: true,
        coveragePresent: true,
        missingCoverage: ["pause_ad_group"],
        defects: ["missing_mvp_action_coverage:pause_ad_group"],
        reviewStatus: "contract_incomplete_local_review_defect",
      },
    ];

    for (const testCase of cases) {
      const payload = cloneFixture();
      testCase.mutate(payload);

      const response = service.build(payload);
      const section = response.renderedSections.find(
        (candidate) => candidate.section_id === "execution_readiness_contract",
      );

      expect(response.summary).toEqual(
        expect.objectContaining({
          export_status: "blocked_before_future_execution",
          execution_readiness_contract_present: testCase.contractPresent,
          execution_readiness_action_type_coverage_present:
            testCase.coveragePresent,
          execution_readiness_missing_mvp_action_coverage:
            testCase.missingCoverage.length,
          missing_mvp_action_coverage: testCase.missingCoverage,
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceDigest).toEqual(
        expect.objectContaining({
          execution_readiness_missing_mvp_action_coverage:
            testCase.missingCoverage,
        }),
      );
      expect(response.executionReadinessContractReview).toEqual(
        expect.objectContaining({
          contract_present: testCase.contractPresent,
          action_type_coverage_present: testCase.coveragePresent,
          missing_mvp_action_coverage: testCase.missingCoverage,
          local_review_defect: true,
          review_status: testCase.reviewStatus,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.executionReadinessContractReview.local_review_defect_keys,
      ).toEqual(expect.arrayContaining(testCase.defects));
      expect(section).toEqual(
        expect.objectContaining({
          status: "attention",
          lines: expect.arrayContaining([
            `missing_mvp_action_coverage=${testCase.missingCoverage.join(
              ", ",
            )}`,
          ]),
        }),
      );
      expect(response.markdownPreview).toContain(
        `missing_mvp_action_coverage=${testCase.missingCoverage.join(", ")}`,
      );
      expect(response.markdownPreview).toContain(
        `local_review_defects=${testCase.defects[0]}`,
      );
      expect(JSON.stringify(response)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness supported MVP action drift as local review defects", () => {
    const cases = [
      {
        name: "missing supported_mvp_actions",
        mutate: (payload: any) => {
          delete payload.executionPreflightDryRun.executionReadinessContract
            .supported_mvp_actions;
        },
        supportedActions: [],
        present: false,
        exactMatch: false,
        missingSupportedActions: SUPPORTED_MVP_ACTIONS,
        unsupportedSupportedActions: [],
        orderMatchesExpected: false,
        defects: [
          "execution_readiness_contract_supported_mvp_actions_absent",
          "missing_supported_mvp_action:update_campaign_budget",
          "missing_supported_mvp_action:pause_campaign",
          "missing_supported_mvp_action:pause_ad_group",
          "missing_supported_mvp_action:monitor_only",
        ],
      },
      {
        name: "extra unsupported action",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.supported_mvp_actions =
            [...SUPPORTED_MVP_ACTIONS, "delete_campaign"];
        },
        supportedActions: [...SUPPORTED_MVP_ACTIONS, "delete_campaign"],
        present: true,
        exactMatch: false,
        missingSupportedActions: [],
        unsupportedSupportedActions: ["delete_campaign"],
        orderMatchesExpected: false,
        defects: ["unsupported_supported_mvp_action:delete_campaign"],
      },
      {
        name: "reordered MVP action list",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.supported_mvp_actions =
            [
              "pause_campaign",
              "update_campaign_budget",
              "pause_ad_group",
              "monitor_only",
            ];
        },
        supportedActions: [
          "pause_campaign",
          "update_campaign_budget",
          "pause_ad_group",
          "monitor_only",
        ],
        present: true,
        exactMatch: false,
        missingSupportedActions: [],
        unsupportedSupportedActions: [],
        orderMatchesExpected: false,
        defects: ["supported_mvp_actions_order_mismatch"],
      },
    ];

    for (const testCase of cases) {
      const payload = cloneFixture();
      testCase.mutate(payload);

      const response = service.build(payload);
      const section = response.renderedSections.find(
        (candidate) => candidate.section_id === "execution_readiness_contract",
      );

      expect(response.summary).toEqual(
        expect.objectContaining({
          export_status: "blocked_before_future_execution",
          execution_readiness_supported_mvp_actions_present: testCase.present,
          execution_readiness_supported_mvp_actions_exact_match:
            testCase.exactMatch,
          execution_readiness_missing_supported_mvp_actions:
            testCase.missingSupportedActions,
          execution_readiness_unsupported_supported_mvp_actions:
            testCase.unsupportedSupportedActions,
          execution_readiness_supported_mvp_actions_order_matches_expected:
            testCase.orderMatchesExpected,
          execution_readiness_missing_mvp_action_coverage: 0,
          missing_mvp_action_coverage: [],
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceDigest).toEqual(
        expect.objectContaining({
          execution_readiness_supported_mvp_actions: testCase.supportedActions,
          execution_readiness_expected_supported_mvp_actions:
            SUPPORTED_MVP_ACTIONS,
          execution_readiness_supported_mvp_action_defects:
            expect.arrayContaining(testCase.defects),
        }),
      );
      expect(response.executionReadinessContractReview).toEqual(
        expect.objectContaining({
          supported_mvp_actions: testCase.supportedActions,
          expected_supported_mvp_actions: SUPPORTED_MVP_ACTIONS,
          supported_mvp_actions_present: testCase.present,
          supported_mvp_actions_exact_match: testCase.exactMatch,
          missing_supported_mvp_actions: testCase.missingSupportedActions,
          unsupported_supported_mvp_actions:
            testCase.unsupportedSupportedActions,
          supported_mvp_actions_order_matches_expected:
            testCase.orderMatchesExpected,
          local_review_defect: true,
          review_status: "contract_incomplete_local_review_defect",
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.executionReadinessContractReview.local_review_defect_keys,
      ).toEqual(expect.arrayContaining(testCase.defects));
      expect(section).toEqual(
        expect.objectContaining({
          status: "attention",
          lines: expect.arrayContaining([
            `supported_mvp_actions=${testCase.supportedActions.length ? testCase.supportedActions.join(", ") : "none"}`,
            `supported_mvp_actions_exact_match=${testCase.exactMatch}`,
            `missing_supported_mvp_actions=${testCase.missingSupportedActions.length ? testCase.missingSupportedActions.join(", ") : "none"}`,
            `unsupported_supported_mvp_actions=${testCase.unsupportedSupportedActions.length ? testCase.unsupportedSupportedActions.join(", ") : "none"}`,
            `supported_mvp_actions_order_matches_expected=${testCase.orderMatchesExpected}`,
          ]),
        }),
      );
      expect(response.markdownPreview).toContain(
        `supported_mvp_actions_exact_match=${testCase.exactMatch}`,
      );
      expect(response.markdownPreview).toContain(
        `local_review_defects=${testCase.defects[0]}`,
      );
      expect(JSON.stringify(response)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness required gate family drift as local review defects", () => {
    const cases = [
      {
        name: "one required gate family missing",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.required_gate_families =
            payload.executionPreflightDryRun.executionReadinessContract.required_gate_families.filter(
              (family: string) => family !== "live_path",
            );
        },
        requiredGateFamilies: REQUIRED_GATE_FAMILIES.filter(
          (family) => family !== "live_path",
        ),
        present: true,
        exactMatch: false,
        missingRequiredGateFamilies: ["live_path"],
        unsupportedRequiredGateFamilies: [],
        orderMatchesExpected: false,
        defects: ["missing_required_gate_family:live_path"],
      },
      {
        name: "extra unsupported gate family",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.required_gate_families =
            [...REQUIRED_GATE_FAMILIES, "manager_override"];
        },
        requiredGateFamilies: [...REQUIRED_GATE_FAMILIES, "manager_override"],
        present: true,
        exactMatch: false,
        missingRequiredGateFamilies: [],
        unsupportedRequiredGateFamilies: ["manager_override"],
        orderMatchesExpected: false,
        defects: ["unsupported_required_gate_family:manager_override"],
      },
      {
        name: "reordered required gate family list",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.required_gate_families =
            [
              "approval_status",
              "future_execution_action_scope",
              "approval_decision_audit",
              "source_readiness",
              "validateOnly",
              "finance_policy",
              "kill_switch",
              "idempotency",
              "production_flag",
              "provider_identifiers",
              "live_path",
            ];
        },
        requiredGateFamilies: [
          "approval_status",
          "future_execution_action_scope",
          "approval_decision_audit",
          "source_readiness",
          "validateOnly",
          "finance_policy",
          "kill_switch",
          "idempotency",
          "production_flag",
          "provider_identifiers",
          "live_path",
        ],
        present: true,
        exactMatch: false,
        missingRequiredGateFamilies: [],
        unsupportedRequiredGateFamilies: [],
        orderMatchesExpected: false,
        defects: ["required_gate_families_order_mismatch"],
      },
    ];

    for (const testCase of cases) {
      const payload = cloneFixture();
      testCase.mutate(payload);

      const response = service.build(payload);
      const section = response.renderedSections.find(
        (candidate) => candidate.section_id === "execution_readiness_contract",
      );

      expect(response.summary).toEqual(
        expect.objectContaining({
          export_status: "blocked_before_future_execution",
          execution_readiness_required_gate_families:
            testCase.requiredGateFamilies.length,
          execution_readiness_required_gate_families_present: testCase.present,
          execution_readiness_required_gate_families_exact_match:
            testCase.exactMatch,
          execution_readiness_missing_required_gate_families:
            testCase.missingRequiredGateFamilies,
          execution_readiness_unsupported_required_gate_families:
            testCase.unsupportedRequiredGateFamilies,
          execution_readiness_required_gate_families_order_matches_expected:
            testCase.orderMatchesExpected,
          execution_readiness_missing_mvp_action_coverage: 0,
          missing_mvp_action_coverage: [],
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceDigest).toEqual(
        expect.objectContaining({
          execution_readiness_required_gate_families:
            testCase.requiredGateFamilies,
          execution_readiness_expected_required_gate_families:
            REQUIRED_GATE_FAMILIES,
          execution_readiness_required_gate_family_defects:
            expect.arrayContaining(testCase.defects),
        }),
      );
      expect(response.executionReadinessContractReview).toEqual(
        expect.objectContaining({
          required_gate_families: testCase.requiredGateFamilies,
          expected_required_gate_families: REQUIRED_GATE_FAMILIES,
          required_gate_families_present: testCase.present,
          required_gate_families_exact_match: testCase.exactMatch,
          missing_required_gate_families: testCase.missingRequiredGateFamilies,
          unsupported_required_gate_families:
            testCase.unsupportedRequiredGateFamilies,
          required_gate_families_order_matches_expected:
            testCase.orderMatchesExpected,
          local_review_defect: true,
          review_status: "contract_incomplete_local_review_defect",
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.executionReadinessContractReview.local_review_defect_keys,
      ).toEqual(expect.arrayContaining(testCase.defects));
      expect(section).toEqual(
        expect.objectContaining({
          status: "attention",
          lines: expect.arrayContaining([
            `required_gate_families=${testCase.requiredGateFamilies.join(
              ", ",
            )}`,
            `expected_required_gate_families=${REQUIRED_GATE_FAMILIES.join(
              ", ",
            )}`,
            `required_gate_families_exact_match=${testCase.exactMatch}`,
            `missing_required_gate_families=${testCase.missingRequiredGateFamilies.length ? testCase.missingRequiredGateFamilies.join(", ") : "none"}`,
            `unsupported_required_gate_families=${testCase.unsupportedRequiredGateFamilies.length ? testCase.unsupportedRequiredGateFamilies.join(", ") : "none"}`,
            `required_gate_families_order_matches_expected=${testCase.orderMatchesExpected}`,
          ]),
        }),
      );
      expect(response.markdownPreview).toContain(
        `required_gate_families_exact_match=${testCase.exactMatch}`,
      );
      expect(response.markdownPreview).toContain(testCase.defects[0]);
      expect(JSON.stringify(response)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness must-have prerequisite drift as local review defects", () => {
    const cases = [
      {
        name: "one must-have prerequisite missing",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.must_have_before_future_live_execution =
            payload.executionPreflightDryRun.executionReadinessContract.must_have_before_future_live_execution.filter(
              (item: string) => item !== "safe_idempotency_key",
            );
        },
        mustHaveItems: MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION.filter(
          (item) => item !== "safe_idempotency_key",
        ),
        present: true,
        exactMatch: false,
        missingMustHaveItems: ["safe_idempotency_key"],
        unsupportedMustHaveItems: [],
        orderMatchesExpected: false,
        defects: [
          "missing_must_have_before_future_live_execution:safe_idempotency_key",
        ],
      },
      {
        name: "extra unsupported must-have prerequisite",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.must_have_before_future_live_execution =
            [
              ...MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION,
              "provider_secret_loaded_from_vault",
            ];
        },
        mustHaveItems: [
          ...MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION,
          "provider_secret_loaded_from_vault",
        ],
        present: true,
        exactMatch: false,
        missingMustHaveItems: [],
        unsupportedMustHaveItems: ["provider_secret_loaded_from_vault"],
        orderMatchesExpected: false,
        defects: [
          "unsupported_must_have_before_future_live_execution:provider_secret_loaded_from_vault",
        ],
      },
      {
        name: "reordered must-have prerequisite list",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.must_have_before_future_live_execution =
            [
              "approval_decision_audit_persisted",
              "approved_action_present",
              "source_readiness_safe",
              "validateOnly_status_passed",
              "finance_policy_allowed",
              "kill_switch_off",
              "safe_idempotency_key",
              "campaignBudgetId_present_for_update_campaign_budget",
              "preflight_dry_run_record_persisted",
              "GOOGLE_ADS_PRODUCTION_ENABLED_true",
              "live_executor_path_implemented_later",
            ];
        },
        mustHaveItems: [
          "approval_decision_audit_persisted",
          "approved_action_present",
          "source_readiness_safe",
          "validateOnly_status_passed",
          "finance_policy_allowed",
          "kill_switch_off",
          "safe_idempotency_key",
          "campaignBudgetId_present_for_update_campaign_budget",
          "preflight_dry_run_record_persisted",
          "GOOGLE_ADS_PRODUCTION_ENABLED_true",
          "live_executor_path_implemented_later",
        ],
        present: true,
        exactMatch: false,
        missingMustHaveItems: [],
        unsupportedMustHaveItems: [],
        orderMatchesExpected: false,
        defects: ["must_have_before_future_live_execution_order_mismatch"],
      },
    ];

    for (const testCase of cases) {
      const payload = cloneFixture();
      testCase.mutate(payload);

      const response = service.build(payload);
      const section = response.renderedSections.find(
        (candidate) => candidate.section_id === "execution_readiness_contract",
      );

      expect(response.summary).toEqual(
        expect.objectContaining({
          export_status: "blocked_before_future_execution",
          execution_readiness_must_have_before_future_live_execution_present:
            testCase.present,
          execution_readiness_must_have_before_future_live_execution_exact_match:
            testCase.exactMatch,
          execution_readiness_missing_must_have_before_future_live_execution:
            testCase.missingMustHaveItems,
          execution_readiness_unsupported_must_have_before_future_live_execution:
            testCase.unsupportedMustHaveItems,
          execution_readiness_must_have_before_future_live_execution_order_matches_expected:
            testCase.orderMatchesExpected,
          execution_readiness_missing_mvp_action_coverage: 0,
          missing_mvp_action_coverage: [],
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceDigest).toEqual(
        expect.objectContaining({
          execution_readiness_must_have_before_future_live_execution:
            testCase.mustHaveItems,
          execution_readiness_expected_must_have_before_future_live_execution:
            MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION,
          execution_readiness_must_have_before_future_live_execution_defects:
            expect.arrayContaining(testCase.defects),
        }),
      );
      expect(response.executionReadinessContractReview).toEqual(
        expect.objectContaining({
          must_have_before_future_live_execution: testCase.mustHaveItems,
          expected_must_have_before_future_live_execution:
            MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION,
          must_have_before_future_live_execution_present: testCase.present,
          must_have_before_future_live_execution_exact_match:
            testCase.exactMatch,
          missing_must_have_before_future_live_execution:
            testCase.missingMustHaveItems,
          unsupported_must_have_before_future_live_execution:
            testCase.unsupportedMustHaveItems,
          must_have_before_future_live_execution_order_matches_expected:
            testCase.orderMatchesExpected,
          missing_must_have_items: testCase.missingMustHaveItems,
          local_review_defect: true,
          review_status: "contract_incomplete_local_review_defect",
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.executionReadinessContractReview.local_review_defect_keys,
      ).toEqual(expect.arrayContaining(testCase.defects));
      expect(section).toEqual(
        expect.objectContaining({
          status: "attention",
          lines: expect.arrayContaining([
            `must_have_before_future_live_execution=${testCase.mustHaveItems.join(
              ", ",
            )}`,
            `expected_must_have_before_future_live_execution=${MUST_HAVE_BEFORE_FUTURE_LIVE_EXECUTION.join(
              ", ",
            )}`,
            `must_have_before_future_live_execution_exact_match=${testCase.exactMatch}`,
            `missing_must_have_before_future_live_execution=${testCase.missingMustHaveItems.length ? testCase.missingMustHaveItems.join(", ") : "none"}`,
            `unsupported_must_have_before_future_live_execution=${testCase.unsupportedMustHaveItems.length ? testCase.unsupportedMustHaveItems.join(", ") : "none"}`,
            `must_have_before_future_live_execution_order_matches_expected=${testCase.orderMatchesExpected}`,
          ]),
        }),
      );
      expect(response.markdownPreview).toContain(
        `must_have_before_future_live_execution_exact_match=${testCase.exactMatch}`,
      );
      expect(response.markdownPreview).toContain(testCase.defects[0]);
      expect(JSON.stringify(response)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(response)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness non-execution guarantee drift as local review defects", () => {
    const cases = [
      {
        name: "missing non_execution_guarantee",
        mutate: (payload: any) => {
          delete payload.executionPreflightDryRun.executionReadinessContract
            .non_execution_guarantee;
        },
        present: false,
        exactMatch: false,
        defects: [
          "execution_readiness_contract_non_execution_guarantee_absent",
        ],
      },
      {
        name: "provider and Google execution flags true",
        mutate: (payload: any) => {
          Object.assign(
            payload.executionPreflightDryRun.executionReadinessContract
              .non_execution_guarantee,
            {
              provider_api_called: true,
              provider_api_used: true,
              google_ads_api_called: true,
              google_ads_api_used: true,
              validateOnly_called: true,
              live_ads_execution_used: true,
            },
          );
        },
        present: true,
        exactMatch: false,
        defects: [
          "non_execution_guarantee_provider_api_called_must_be_false",
          "non_execution_guarantee_provider_api_used_must_be_false",
          "non_execution_guarantee_google_ads_api_called_must_be_false",
          "non_execution_guarantee_google_ads_api_used_must_be_false",
          "non_execution_guarantee_validateOnly_called_must_be_false",
          "non_execution_guarantee_live_ads_execution_used_must_be_false",
        ],
      },
      {
        name: "executable actions nonzero",
        mutate: (payload: any) => {
          payload.executionPreflightDryRun.executionReadinessContract.non_execution_guarantee.executable_now_actions = 1;
        },
        present: true,
        exactMatch: false,
        defects: ["non_execution_guarantee_executable_now_actions_must_be_0"],
      },
      {
        name: "production and execution flags true",
        mutate: (payload: any) => {
          Object.assign(
            payload.executionPreflightDryRun.executionReadinessContract
              .non_execution_guarantee,
            {
              execution_allowed_now: true,
              production_ready: true,
            },
          );
        },
        present: true,
        exactMatch: false,
        defects: [
          "non_execution_guarantee_execution_allowed_now_must_be_false",
          "non_execution_guarantee_production_ready_must_be_false",
        ],
      },
    ];

    for (const testCase of cases) {
      const payload = cloneFixture();
      testCase.mutate(payload);

      const response = service.build(payload);
      const section = response.renderedSections.find(
        (candidate) => candidate.section_id === "execution_readiness_contract",
      );
      const sectionText = (section?.lines || []).join("\n");

      expect(response.summary).toEqual(
        expect.objectContaining({
          export_status: "blocked_before_future_execution",
          execution_readiness_non_execution_guarantee_present: testCase.present,
          execution_readiness_non_execution_guarantee_exact_match:
            testCase.exactMatch,
          execution_readiness_non_execution_guarantee_defects:
            expect.arrayContaining(testCase.defects),
          execution_readiness_missing_mvp_action_coverage: 0,
          missing_mvp_action_coverage: [],
          execution_readiness_local_review_defect: true,
          executable_now: 0,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(response.sourceDigest).toEqual(
        expect.objectContaining({
          execution_readiness_non_execution_guarantee_defects:
            expect.arrayContaining(testCase.defects),
        }),
      );
      expect(response.executionReadinessContractReview).toEqual(
        expect.objectContaining({
          non_execution_guarantee_present: testCase.present,
          non_execution_guarantee_exact_match: testCase.exactMatch,
          non_execution_guarantee_defects: expect.arrayContaining(
            testCase.defects,
          ),
          local_review_defect: true,
          review_status: "contract_incomplete_local_review_defect",
          executable_now_actions: 0,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(
        response.executionReadinessContractReview.local_review_defect_keys,
      ).toEqual(expect.arrayContaining(testCase.defects));
      expect(section).toEqual(
        expect.objectContaining({
          status: "attention",
          lines: expect.arrayContaining([
            `non_execution_guarantee_present=${testCase.present}`,
            `non_execution_guarantee_exact_match=${testCase.exactMatch}`,
          ]),
        }),
      );
      for (const defect of testCase.defects) {
        expect(sectionText).toContain(defect);
        expect(response.markdownPreview).toContain(defect);
      }
      expect(response.markdownPreview).toContain(
        `non_execution_guarantee_exact_match=${testCase.exactMatch}`,
      );
    }
  });

  it("rejects malformed source readiness and validate-only envelopes before rendering", () => {
    expect(() =>
      service.build({
        ...ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE,
        sourceReadinessReviewExport: {
          ...ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE.sourceReadinessReviewExport,
          schemaVersion: "wrong",
        } as any,
      }),
    ).toThrow(
      "sourceReadinessReviewExport must be ads_automation_source_readiness_review_export.v1",
    );

    expect(() =>
      service.build({
        ...ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE,
        validateOnlyLane: {
          ...ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE.validateOnlyLane,
          validationPlans: null,
        } as any,
      }),
    ).toThrow(
      "validateOnlyLane must be ads_automation_provider_validate_only_lane.v1",
    );
  });
});
