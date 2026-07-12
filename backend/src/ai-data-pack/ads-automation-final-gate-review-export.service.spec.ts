import { AdsAutomationCredentialVaultOnboardingService } from "./ads-automation-credential-vault-onboarding.service";
import { ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE } from "./ads-automation-final-gate-review-export.fixture";
import { AdsAutomationFinalGateReviewExportService } from "./ads-automation-final-gate-review-export.service";
import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationFinalGoNoGoGateService } from "./ads-automation-final-go-no-go-gate.service";
import { AdsAutomationFoundationAcceptanceMatrixService } from "./ads-automation-foundation-acceptance-matrix.service";
import { AdsAutomationGoogleAdsDryRunReconciliationService } from "./ads-automation-google-ads-dry-run-reconciliation.service";
import { AdsAutomationGoogleAdsMockImportDemoService } from "./ads-automation-google-ads-mock-import-demo.service";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationProductionReadinessBridgeService } from "./ads-automation-production-readiness-bridge.service";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import {
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import type { AdsAutomationApiReadinessGapReportResponse } from "./contracts/ads-automation-api-readiness-gap-report.contract";
import type { AdsAutomationFinalGateReviewExportInput } from "./contracts/ads-automation-final-gate-review-export.contract";

function buildMockImportService(): AdsAutomationGoogleAdsMockImportDemoService {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  return new AdsAutomationGoogleAdsMockImportDemoService(
    new AdsAutomationReadonlyPlatformImportReadinessService(),
    new AdsAutomationDecisionReadModelQueryService(adapter),
    new AdsAutomationDecisionService(),
    new AdsAutomationDecisionDraftPreviewService(),
    new AdsAutomationPendingErpActionNormalizerService(),
    new AdsAutomationProviderValidateOnlyPlannerService(),
  );
}

function buildFinalGateService(): AdsAutomationFinalGoNoGoGateService {
  const mockImport = buildMockImportService();
  return new AdsAutomationFinalGoNoGoGateService(
    new AdsAutomationFoundationAcceptanceMatrixService(
      mockImport,
      new AdsAutomationGoogleAdsDryRunReconciliationService(mockImport),
    ),
  );
}

function buildService(): AdsAutomationFinalGateReviewExportService {
  const finalGate = buildFinalGateService();
  const productionBridge = new AdsAutomationProductionReadinessBridgeService(
    finalGate,
    new AdsAutomationCredentialVaultOnboardingService({} as any),
  );
  return new AdsAutomationFinalGateReviewExportService(
    finalGate,
    productionBridge,
  );
}

function fixture(
  overrides: Partial<AdsAutomationFinalGateReviewExportInput> = {},
): AdsAutomationFinalGateReviewExportInput {
  return {
    ...JSON.parse(
      JSON.stringify(ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE),
    ),
    ...overrides,
  };
}

function apiReadinessGapReport(
  overrides: Partial<AdsAutomationApiReadinessGapReportResponse> = {},
): AdsAutomationApiReadinessGapReportResponse {
  return {
    schemaVersion: "ads_automation_api_readiness_gap_report.v1",
    generatedAt: "2026-07-06T07:18:00.000Z",
    reportDate: "2026-07-06",
    summary: {
      status: "blocked",
      source_readiness_review_export_consumed: true,
      source_readiness_review_export_mode: "erp_source_import_readiness",
      source_readiness_review_export_status: "needs_attention",
      required_source_count: 5,
      required_source_ready_count: 2,
      required_source_blocked_count: 3,
      required_source_report_date_covered_count: 2,
      required_source_report_date_blocked_count: 3,
      missing_required_source_evidence: [
        "advertising_costs",
        "supplier_safety",
      ],
      source_coverage_blocking_reasons: ["freshness_stale", "coverage_missing"],
      platform_campaignBudgetId_missing_rows: 1,
      platform_blocked_product_count: 1,
      platform_blocked_supplier_count: 1,
      platform_supplier_choice_safe: false,
      provider_validateOnly_plans: 0,
      provider_validateOnly_passed: 0,
    },
    stages: [
      {
        stage: "final_go_no_go_readiness",
        status: "blocked",
        blockers: [
          "source_readiness_review.required_sources_blocked",
          "source_readiness_review.campaignBudgetId_missing_no_fallback",
          "source_readiness_review.product_allocation_blockers",
          "source_readiness_review.supplier_safety_blockers",
          "production_ready_false",
          "execution_allowed_now_false",
        ],
        evidence: [
          "source_readiness_review_export_consumed=true",
          "source_readiness_review_blockers=4",
          "required_sources_blocked=3",
          "execution_allowed_now=false",
          "production_ready=false",
        ],
        next_required_action:
          "resolve_source_readiness_review_blockers_before_go_no_go",
      },
    ],
    sourceBlockers: [
      "source_readiness_review.required_sources_blocked",
      "source_readiness_review.required_sources_report_date_not_covered",
      "source_readiness_review.campaignBudgetId_missing_no_fallback",
      "source_readiness_review.product_inventory_profit.low_margin",
      "source_readiness_review.supplier_safety.supplier_payment_stale",
    ],
    platformEntityCoverageBlockers: [
      "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
      "platform_entity.inventoryProfit.source_not_ready",
      "platform_entity.supplierContext.source_not_ready",
    ],
    pendingActionNormalization: {
      platformEntityCoverageActionBlockersApplied: [
        {
          blocker:
            "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
        },
      ],
    },
    validateOnlyLane: {
      created: false,
      schemaVersion: null,
      summary: null,
    },
    ...overrides,
  } as AdsAutomationApiReadinessGapReportResponse;
}

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

describe("AdsAutomationFinalGateReviewExportService", () => {
  it("builds a manager-readable final gate export with every execution blocker family visible", async () => {
    const result = await buildService().build(fixture());

    expect(result.schemaVersion).toBe(
      "ads_automation_final_gate_review_export.v1",
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "ready_for_manager_review_blocked_before_live",
        fixture_mode: "htx_ads_final_gate_review_demo",
        final_go_no_go_decision: "GO_LOCAL_DEMO_USE_STOP_CODEX_FOUNDATION_LOOP",
        final_go_no_go_local_gate_passed: true,
        production_bridge_status: "LOCAL_READINESS_BRIDGE_PASS",
        production_bridge_blockers: 0,
        required_gate_families: 11,
        blocked_gate_families: 11,
        missing_required_gate_families: 0,
        execution_records_checked: 3,
        blocked_execution_records: 3,
        scale_candidate_blocker_families: 11,
        pause_safety_records_visible: 1,
        monitor_only_safety_records_visible: 1,
        safety_action_records_visible: 2,
        execution_readiness_contract_present: true,
        execution_readiness_required_gate_families: 11,
        execution_readiness_blocked_gate_families: 11,
        execution_readiness_scale_candidate_blocked_by_all_gate_families: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        live_execution_blocked: true,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        execution_preflight_evidence_reused: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        campaignBudgetId_no_fallback: true,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.executionEvidenceReview).toEqual(
      expect.objectContaining({
        evidence_source: "execution_preflight_response",
        validateOnly_missing_or_blocked_records: 1,
        validateOnly_passed_records: 1,
        approval_missing_or_blocked_records: 1,
        approval_audit_missing_or_blocked_records: 1,
        source_readiness_blocked_records: 1,
        finance_policy_blocked_records: 1,
        kill_switch_blocked_records: 1,
        idempotency_blocked_records: 1,
        campaignBudgetId_blocked_records: 1,
        production_flag_blocked_records: 3,
        live_path_blocked_records: 3,
        blockerCoverage: expect.objectContaining({
          scale_candidate_blocked_by_all_gate_families: true,
          validateOnly_missing_or_blocked_records: 1,
          validateOnly_passed_records: 1,
          approval_missing_or_blocked_records: 1,
          approval_audit_missing_or_blocked_records: 1,
          source_readiness_blocked_records: 1,
          finance_policy_blocked_records: 1,
          kill_switch_blocked_records: 1,
          idempotency_blocked_records: 1,
          campaignBudgetId_blocked_records: 1,
          production_flag_blocked_records: 3,
          live_path_blocked_records: 3,
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
        }),
      }),
    );
    expect(result.gateFamilyReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "validateOnly",
          status: "blocked",
          review_status: "blocked_before_live",
          scale_candidate_blocker_family: true,
          blocker_keys: ["validateOnly_missing"],
        }),
        expect.objectContaining({
          key: "provider_identifiers",
          status: "blocked",
          blocker_keys: ["campaignBudgetId"],
        }),
        expect.objectContaining({
          key: "live_path",
          records_blocked: 3,
          blocker_keys: ["live_path_not_implemented"],
        }),
      ]),
    );
    expect(result.productionBridgeReview).toEqual(
      expect.objectContaining({
        status: "LOCAL_READINESS_BRIDGE_PASS",
        providerOrderValid: true,
        bridgeBlockers: [],
        business_safety_gates_uncertain: 8,
        scale_action_mode: "monitor_only_or_blocked",
      }),
    );
    expect(result.executionReadinessContractReview).toEqual(
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
            records_checked: 0,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "pause_ad_group",
            records_checked: 1,
            records_blocked: 1,
            validateOnly_passed_records: 1,
            scale_candidate: false,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
          expect.objectContaining({
            action_type: "monitor_only",
            records_checked: 1,
            records_blocked: 1,
            validateOnly_missing_or_blocked_records: 1,
            scale_candidate: false,
            safety_action: true,
            execution_allowed_now: false,
            production_ready: false,
          }),
        ]),
        missing_mvp_action_coverage: [],
        records_checked: 3,
        blocked_gate_families: 11,
        required_pre_live_gates_passed_records: 0,
        required_pre_live_gates_blocked_records: 3,
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
      result.executionReadinessContractReview
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
    expect(result.localReviewBlockers).toEqual([]);
    expect(result.liveReadinessBlockers).toEqual(
      expect.arrayContaining([
        "GOOGLE_ADS_PRODUCTION_ENABLED",
        "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
        "live_path_not_implemented",
        "real_provider_credentials_missing",
        "small_cap_live_test_not_approved",
      ]),
    );
    expect(result.markdownPreview).toContain("provider_api_called=false");
    expect(result.markdownPreview).toContain(
      "Scale candidate blocked by all gate families: true",
    );
    expect(result.markdownPreview).toContain("Execution readiness contract:");
    expect(result.markdownPreview).toContain("contract_present=true");
    expect(result.markdownPreview).toContain(
      "supported_mvp_actions=update_campaign_budget, pause_campaign, pause_ad_group, monitor_only",
    );
    expect(result.markdownPreview).toContain(
      "must_have_before_future_live_execution=approved_action_present",
    );
    expect(result.markdownPreview).toContain("missing_must_have_items=none");
    expect(result.markdownPreview).toContain(
      "action_type_coverage=update_campaign_budget:checked=1:blocked=1:pre_live_passed=0:validateOnly_passed=0:safety=false:execution_allowed_now=false",
    );
    expect(result.markdownPreview).toContain(
      "missing_mvp_action_coverage=none",
    );
    expect(result.markdownPreview).toContain("execution_allowed_now=false");
  });

  it("carries API-readiness source blockers into the final gate review export", async () => {
    const result = await buildService().build(
      fixture({
        apiReadinessGapReport: apiReadinessGapReport(),
      }),
    );
    const serialized = JSON.stringify(result);

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked_local_gate_defect",
        api_readiness_gap_report_present: true,
        api_readiness_gap_status: "blocked",
        api_readiness_source_blocker_count: 5,
        api_readiness_required_source_blocked_count: 3,
        api_readiness_required_source_report_date_blocked_count: 3,
        api_readiness_campaignBudgetId_missing_rows: 1,
        api_readiness_product_inventory_profit_blocker_count: 4,
        api_readiness_supplier_safety_blocker_count: 3,
        api_readiness_final_go_no_go_stage_status: "blocked",
        api_readiness_final_go_no_go_stage_blocker_count: 6,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        api_readiness_gap_report_reused: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.apiReadinessGapReview).toEqual(
      expect.objectContaining({
        gap_report_present: true,
        source_readiness_review_export_consumed: true,
        required_source_blocked_count: 3,
        required_source_report_date_blocked_count: 3,
        platform_campaignBudgetId_missing_rows: 1,
        final_go_no_go_stage_status: "blocked",
        local_review_defect: true,
        review_status: "api_gap_blocked_before_final_go_no_go",
      }),
    );
    expect(
      result.apiReadinessGapReview.source_readiness_review_blockers,
    ).toEqual(
      expect.arrayContaining([
        "source_readiness_review.required_sources_blocked",
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "source_readiness_review.product_inventory_profit.low_margin",
        "source_readiness_review.supplier_safety.supplier_payment_stale",
      ]),
    );
    expect(result.apiReadinessGapReview.campaignBudgetId_blockers).toEqual(
      expect.arrayContaining([
        "source_readiness_review.campaignBudgetId_missing_no_fallback",
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
      ]),
    );
    expect(
      result.apiReadinessGapReview.product_inventory_profit_blockers,
    ).toEqual(
      expect.arrayContaining([
        "source_readiness_review.product_inventory_profit.low_margin",
        "platform_entity.inventoryProfit.source_not_ready",
      ]),
    );
    expect(result.apiReadinessGapReview.supplier_safety_blockers).toEqual(
      expect.arrayContaining([
        "source_readiness_review.supplier_safety.supplier_payment_stale",
        "platform_entity.supplierContext.source_not_ready",
      ]),
    );
    expect(result.localReviewBlockers).toEqual(
      expect.arrayContaining([
        "api_readiness_gap.source_readiness_blocked",
        "api_readiness_gap.source_readiness_review.required_sources_blocked",
        "api_readiness_gap.source_readiness_review.campaignBudgetId_missing_no_fallback",
        "api_readiness_gap.source_readiness_review.product_inventory_profit.low_margin",
        "api_readiness_gap.source_readiness_review.supplier_safety.supplier_payment_stale",
      ]),
    );
    expect(result.markdownPreview).toContain("API readiness gap review:");
    expect(result.markdownPreview).toContain(
      "source_readiness_review_blockers=source_readiness_review.campaignBudgetId_missing_no_fallback",
    );
    expect(result.markdownPreview).toContain("campaignBudgetId_missing_rows=1");
    expect(result.markdownPreview).toContain(
      "product_inventory_profit_blockers=",
    );
    expect(result.markdownPreview).toContain("supplier_safety_blockers=");
    expect(result.markdownPreview).toContain(
      "final_go_no_go_stage_status=blocked",
    );
    expect(serialized).not.toContain('"production_ready":true');
    expect(serialized).not.toContain('"execution_allowed_now":true');
    expect(serialized).not.toContain('"provider_api_called":true');
    expect(serialized).not.toContain('"google_ads_api_called":true');
    expect(serialized).not.toContain('"validateOnly_called":true');
    expect(serialized).not.toContain('"live_ads_execution_used":true');
  });

  it("marks the review blocked when required preflight evidence and safety actions are missing", async () => {
    const brokenPreflight = JSON.parse(
      JSON.stringify(fixture().executionPreflightResponse),
    );
    brokenPreflight.gateFamilyEvidence =
      brokenPreflight.gateFamilyEvidence.filter(
        (family: any) => family.key !== "live_path",
      );
    brokenPreflight.executionRecords = brokenPreflight.executionRecords
      .filter((record: any) => record.action_type === "update_campaign_budget")
      .map((record: any) => ({
        ...record,
        blockers: record.blockers.filter(
          (blocker: string) => blocker !== "live_path_not_implemented",
        ),
      }));

    const result = await buildService().build(
      fixture({
        executionPreflightResponse: brokenPreflight,
      }),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked_local_gate_defect",
        final_go_no_go_decision: "NO_GO_FIX_LOCAL_FOUNDATION_GAPS",
        final_go_no_go_local_gate_passed: false,
        production_bridge_status: "BLOCKED",
        missing_required_gate_families: 1,
        safety_action_records_visible: 0,
        next_required_action: "fix_local_final_gate_review_defects",
      }),
    );
    expect(result.localReviewBlockers).toEqual(
      expect.arrayContaining([
        "execution_preflight_required_gate_family_evidence_missing",
        "execution_preflight_safety_actions_not_visible",
        "execution_preflight_live_path_blocker_missing",
        "final_go_no_go_gate_not_ready",
      ]),
    );
    expect(result.gateFamilyReview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "live_path",
          review_status: "missing_required_evidence",
        }),
      ]),
    );
  });

  it("marks missing and incomplete execution readiness action coverage as final-gate local defects", async () => {
    const cases = [
      {
        name: "missing contract",
        mutate: (preflight: any) => {
          delete preflight.executionReadinessContract;
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
        mutate: (preflight: any) => {
          delete preflight.executionReadinessContract.action_type_coverage;
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.action_type_coverage =
            preflight.executionReadinessContract.action_type_coverage.filter(
              (row: any) => row.action_type !== "monitor_only",
            );
        },
        contractPresent: true,
        coveragePresent: true,
        missingCoverage: ["monitor_only"],
        defects: ["missing_mvp_action_coverage:monitor_only"],
        reviewStatus: "contract_incomplete_local_review_defect",
      },
    ];

    for (const testCase of cases) {
      const preflight = JSON.parse(
        JSON.stringify(fixture().executionPreflightResponse),
      );
      testCase.mutate(preflight);

      const result = await buildService().build(
        fixture({
          executionPreflightResponse: preflight,
        }),
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked_local_gate_defect",
          execution_readiness_contract_present: testCase.contractPresent,
          execution_readiness_action_type_coverage_present:
            testCase.coveragePresent,
          execution_readiness_missing_mvp_action_coverage:
            testCase.missingCoverage.length,
          missing_mvp_action_coverage: testCase.missingCoverage,
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          validate_only_provider_call_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(result.executionReadinessContractReview).toEqual(
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
      expect(result.localReviewBlockers).toEqual(
        expect.arrayContaining(testCase.defects),
      );
      expect(result.markdownPreview).toContain(
        `missing_mvp_action_coverage=${testCase.missingCoverage.join(", ")}`,
      );
      expect(result.markdownPreview).toContain(
        `local_review_defects=${testCase.defects[0]}`,
      );
      expect(JSON.stringify(result)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness supported MVP action drift as final-gate local defects", async () => {
    const cases = [
      {
        name: "missing supported_mvp_actions",
        mutate: (preflight: any) => {
          delete preflight.executionReadinessContract.supported_mvp_actions;
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.supported_mvp_actions = [
            ...SUPPORTED_MVP_ACTIONS,
            "delete_campaign",
          ];
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.supported_mvp_actions = [
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
      const preflight = JSON.parse(
        JSON.stringify(fixture().executionPreflightResponse),
      );
      testCase.mutate(preflight);

      const result = await buildService().build(
        fixture({
          executionPreflightResponse: preflight,
        }),
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked_local_gate_defect",
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
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          validate_only_provider_call_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(result.executionReadinessContractReview).toEqual(
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
      expect(result.localReviewBlockers).toEqual(
        expect.arrayContaining(testCase.defects),
      );
      expect(result.markdownPreview).toContain(
        `supported_mvp_actions_exact_match=${testCase.exactMatch}`,
      );
      expect(result.markdownPreview).toContain(
        `missing_supported_mvp_actions=${testCase.missingSupportedActions.length ? testCase.missingSupportedActions.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(
        `unsupported_supported_mvp_actions=${testCase.unsupportedSupportedActions.length ? testCase.unsupportedSupportedActions.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(
        `local_review_defects=${testCase.defects[0]}`,
      );
      expect(JSON.stringify(result)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness required gate family drift as final-gate local defects", async () => {
    const cases = [
      {
        name: "one required gate family missing",
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.required_gate_families =
            preflight.executionReadinessContract.required_gate_families.filter(
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.required_gate_families = [
            ...REQUIRED_GATE_FAMILIES,
            "manager_override",
          ];
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.required_gate_families = [
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
      const preflight = JSON.parse(
        JSON.stringify(fixture().executionPreflightResponse),
      );
      testCase.mutate(preflight);

      const result = await buildService().build(
        fixture({
          executionPreflightResponse: preflight,
        }),
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked_local_gate_defect",
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
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          validate_only_provider_call_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(result.executionReadinessContractReview).toEqual(
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
      expect(result.localReviewBlockers).toEqual(
        expect.arrayContaining(testCase.defects),
      );
      expect(result.markdownPreview).toContain(
        `required_gate_families_exact_match=${testCase.exactMatch}`,
      );
      expect(result.markdownPreview).toContain(
        `missing_required_gate_families=${testCase.missingRequiredGateFamilies.length ? testCase.missingRequiredGateFamilies.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(
        `unsupported_required_gate_families=${testCase.unsupportedRequiredGateFamilies.length ? testCase.unsupportedRequiredGateFamilies.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(testCase.defects[0]);
      expect(JSON.stringify(result)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness must-have prerequisite drift as final-gate local defects", async () => {
    const cases = [
      {
        name: "one must-have prerequisite missing",
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.must_have_before_future_live_execution =
            preflight.executionReadinessContract.must_have_before_future_live_execution.filter(
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.must_have_before_future_live_execution =
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.must_have_before_future_live_execution =
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
      const preflight = JSON.parse(
        JSON.stringify(fixture().executionPreflightResponse),
      );
      testCase.mutate(preflight);

      const result = await buildService().build(
        fixture({
          executionPreflightResponse: preflight,
        }),
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked_local_gate_defect",
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
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          validate_only_provider_call_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(result.executionReadinessContractReview).toEqual(
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
      expect(result.localReviewBlockers).toEqual(
        expect.arrayContaining(testCase.defects),
      );
      expect(result.markdownPreview).toContain(
        `must_have_before_future_live_execution_exact_match=${testCase.exactMatch}`,
      );
      expect(result.markdownPreview).toContain(
        `missing_must_have_before_future_live_execution=${testCase.missingMustHaveItems.length ? testCase.missingMustHaveItems.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(
        `unsupported_must_have_before_future_live_execution=${testCase.unsupportedMustHaveItems.length ? testCase.unsupportedMustHaveItems.join(", ") : "none"}`,
      );
      expect(result.markdownPreview).toContain(testCase.defects[0]);
      expect(JSON.stringify(result)).not.toContain(
        '"provider_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"google_ads_api_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"validateOnly_called":true',
      );
      expect(JSON.stringify(result)).not.toContain(
        '"live_ads_execution_used":true',
      );
    }
  });

  it("marks execution readiness non-execution guarantee drift as final-gate local defects", async () => {
    const cases = [
      {
        name: "missing non_execution_guarantee",
        mutate: (preflight: any) => {
          delete preflight.executionReadinessContract.non_execution_guarantee;
        },
        present: false,
        exactMatch: false,
        defects: [
          "execution_readiness_contract_non_execution_guarantee_absent",
        ],
      },
      {
        name: "provider and Google execution flags true",
        mutate: (preflight: any) => {
          Object.assign(
            preflight.executionReadinessContract.non_execution_guarantee,
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
        mutate: (preflight: any) => {
          preflight.executionReadinessContract.non_execution_guarantee.executable_now_actions = 2;
        },
        present: true,
        exactMatch: false,
        defects: ["non_execution_guarantee_executable_now_actions_must_be_0"],
      },
      {
        name: "production and execution flags true",
        mutate: (preflight: any) => {
          Object.assign(
            preflight.executionReadinessContract.non_execution_guarantee,
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
      const preflight = JSON.parse(
        JSON.stringify(fixture().executionPreflightResponse),
      );
      testCase.mutate(preflight);

      const result = await buildService().build(
        fixture({
          executionPreflightResponse: preflight,
        }),
      );

      expect(result.summary).toEqual(
        expect.objectContaining({
          status: "blocked_local_gate_defect",
          execution_readiness_non_execution_guarantee_present: testCase.present,
          execution_readiness_non_execution_guarantee_exact_match:
            testCase.exactMatch,
          execution_readiness_non_execution_guarantee_defects:
            expect.arrayContaining(testCase.defects),
          execution_readiness_missing_mvp_action_coverage: 0,
          missing_mvp_action_coverage: [],
          execution_readiness_local_review_defect: true,
          provider_api_called: false,
          provider_api_used: false,
          google_ads_api_called: false,
          google_ads_api_used: false,
          validateOnly_called: false,
          validate_only_provider_call_used: false,
          live_ads_execution_used: false,
          execution_allowed_now: false,
          production_ready: false,
        }),
      );
      expect(result.executionReadinessContractReview).toEqual(
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
      expect(result.localReviewBlockers).toEqual(
        expect.arrayContaining(testCase.defects),
      );
      expect(result.markdownPreview).toContain(
        `non_execution_guarantee_exact_match=${testCase.exactMatch}`,
      );
      for (const defect of testCase.defects) {
        expect(result.markdownPreview).toContain(defect);
      }
    }
  });

  it("marks execution readiness coverage integrity drift as final-gate local defects", async () => {
    const preflight = JSON.parse(
      JSON.stringify(fixture().executionPreflightResponse),
    );
    preflight.executionReadinessContract.gate_coverage.records_checked = 4;
    preflight.executionReadinessContract.gate_coverage.scale_candidate_blocked_by_all_gate_families = false;
    preflight.executionReadinessContract.gate_coverage.production_flag_blocked_records = 0;
    preflight.executionReadinessContract.safety_action_visibility.monitor_only_safety_records_visible = 0;
    preflight.executionReadinessContract.safety_action_visibility.safety_action_records_visible = 1;
    const monitorCoverage =
      preflight.executionReadinessContract.action_type_coverage.find(
        (row: any) => row.action_type === "monitor_only",
      );
    monitorCoverage.required_pre_live_gates_blocked_records = 0;

    const result = await buildService().build(
      fixture({
        executionPreflightResponse: preflight,
      }),
    );

    const expectedDefects = [
      "action_type_coverage_pre_live_records_total_mismatch:monitor_only",
      "gate_coverage_records_checked_mismatch",
      "gate_coverage_pre_live_records_total_mismatch",
      "gate_coverage_production_flag_blocker_missing",
      "gate_coverage_scale_candidate_not_blocked_by_all_gate_families",
      "safety_action_visibility_monitor_only_count_mismatch",
      "safety_action_visibility_total_count_mismatch",
    ];

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked_local_gate_defect",
        execution_readiness_coverage_integrity_exact_match: false,
        execution_readiness_coverage_integrity_defects:
          expect.arrayContaining(expectedDefects),
        execution_readiness_local_review_defect: true,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.executionReadinessContractReview).toEqual(
      expect.objectContaining({
        coverage_integrity_exact_match: false,
        coverage_integrity_defects: expect.arrayContaining(expectedDefects),
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
    expect(result.localReviewBlockers).toEqual(
      expect.arrayContaining(expectedDefects),
    );
    expect(result.markdownPreview).toContain(
      "coverage_integrity_exact_match=false",
    );
    expect(result.markdownPreview).toContain(
      "gate_coverage_records_checked_mismatch",
    );
    expect(JSON.stringify(result)).not.toContain('"provider_api_called":true');
    expect(JSON.stringify(result)).not.toContain(
      '"google_ads_api_called":true',
    );
    expect(JSON.stringify(result)).not.toContain('"validateOnly_called":true');
    expect(JSON.stringify(result)).not.toContain(
      '"live_ads_execution_used":true',
    );
  });

  it("keeps production and provider execution flags closed in the serialized export", async () => {
    const result = await buildService().build(fixture());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('"production_ready":true');
    expect(serialized).not.toContain('"execution_allowed_now":true');
    expect(serialized).not.toContain('"provider_api_called":true');
    expect(serialized).not.toContain('"provider_api_used":true');
    expect(serialized).not.toContain('"google_ads_api_called":true');
    expect(serialized).not.toContain('"google_ads_api_used":true');
    expect(serialized).not.toContain('"validateOnly_called":true');
    expect(serialized).not.toContain('"live_ads_execution_used":true');
  });
});
