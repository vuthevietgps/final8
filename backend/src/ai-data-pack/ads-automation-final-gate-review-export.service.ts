import { BadRequestException, Injectable } from "@nestjs/common";
import { ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE } from "./ads-automation-final-gate-review-export.fixture";
import { AdsAutomationFinalGoNoGoGateService } from "./ads-automation-final-go-no-go-gate.service";
import { AdsAutomationProductionReadinessBridgeService } from "./ads-automation-production-readiness-bridge.service";
import type {
  AdsAutomationFinalGateReviewExecutionEvidence,
  AdsAutomationFinalGateReviewExecutionReadinessContractReview,
  AdsAutomationFinalGateReviewExportInput,
  AdsAutomationFinalGateReviewExportResponse,
  AdsAutomationFinalGateReviewExportStatus,
  AdsAutomationFinalGateReviewApiReadinessGapReview,
  AdsAutomationFinalGateReviewGateFamilyReview,
  AdsAutomationFinalGateReviewProductionBridgeReview,
} from "./contracts/ads-automation-final-gate-review-export.contract";
import type {
  AdsAutomationExecutionPreflightBlockerCoverage,
  AdsAutomationExecutionPreflightActionType,
  AdsAutomationExecutionPreflightActionTypeCoverage,
  AdsAutomationExecutionPreflightGateFamilyKey,
  AdsAutomationExecutionPreflightReadinessContract,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import {
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import type {
  AdsAutomationProductionReadinessBridgeInput,
  AdsAutomationProductionReadinessBridgeResponse,
} from "./contracts/ads-automation-production-readiness-bridge.contract";

@Injectable()
export class AdsAutomationFinalGateReviewExportService {
  constructor(
    private readonly finalGoNoGoGate: AdsAutomationFinalGoNoGoGateService,
    private readonly productionReadinessBridge: AdsAutomationProductionReadinessBridgeService,
  ) {}

  async build(
    input: AdsAutomationFinalGateReviewExportInput = ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE,
  ): Promise<AdsAutomationFinalGateReviewExportResponse> {
    const fixture = ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE;
    const body = input || {};
    const generatedAt = this.dateTime(
      body.now ?? fixture.now ?? new Date(),
      "now",
    ).toISOString();
    const executionPreflightResponse =
      body.executionPreflightResponse ?? fixture.executionPreflightResponse;
    const finalGate = body.finalGoNoGoGateResponse
      ? this.cloneJson(body.finalGoNoGoGateResponse)
      : await this.finalGoNoGoGate.build({ executionPreflightResponse });
    const reportDate = this.isoDate(
      body.reportDate ?? finalGate.reportDate ?? fixture.reportDate,
      "reportDate",
    );
    const productionBridge = body.productionReadinessBridgeResponse
      ? this.cloneJson(body.productionReadinessBridgeResponse)
      : await this.productionReadinessBridge.build(
          this.productionBridgeInput({
            input:
              body.productionReadinessBridgeInput ??
              fixture.productionReadinessBridgeInput,
            reportDate,
            generatedAt,
            finalGate,
          }),
        );
    const executionEvidence = this.executionEvidenceReview(finalGate);
    const productionBridgeReview =
      this.productionBridgeReview(productionBridge);
    const apiReadinessGapReview = this.apiReadinessGapReview(
      body.apiReadinessGapReport || null,
    );
    const executionReadinessContractReview =
      this.executionReadinessContractReview(
        executionPreflightResponse?.executionReadinessContract ?? null,
      );
    const localReviewBlockers = this.unique([
      ...finalGate.localDefects,
      ...apiReadinessGapReview.local_review_defect_keys,
      ...executionReadinessContractReview.local_review_defect_keys,
      ...productionBridge.bridgeBlockers,
    ]);
    const liveReadinessBlockers = this.unique([
      ...executionEvidence.final_live_blockers,
      ...productionBridge.blockersForRealProduction,
      ...productionBridgeReview.provider_gate_blockers,
    ]);
    const status: AdsAutomationFinalGateReviewExportStatus =
      localReviewBlockers.length
        ? "blocked_local_gate_defect"
        : "ready_for_manager_review_blocked_before_live";
    const gateFamilyReview = this.gateFamilyReview(finalGate);

    return {
      schemaVersion: "ads_automation_final_gate_review_export.v1",
      generatedAt,
      reportDate,
      safety: this.safety(
        Boolean(executionPreflightResponse),
        apiReadinessGapReview.gap_report_present,
      ),
      summary: {
        status,
        fixture_mode:
          body.fixtureMode ?? fixture.fixtureMode ?? "custom_local_payload",
        reportDate,
        final_go_no_go_decision: finalGate.summary.decision,
        final_go_no_go_local_gate_passed: finalGate.summary.local_gate_passed,
        production_bridge_status: productionBridge.status,
        production_bridge_blockers: productionBridge.bridgeBlockers.length,
        required_gate_families: executionEvidence.required_gate_families.length,
        blocked_gate_families: executionEvidence.blocked_gate_families.length,
        missing_required_gate_families:
          executionEvidence.missing_required_gate_family_evidence.length,
        final_live_blockers: executionEvidence.final_live_blockers.length,
        api_readiness_gap_report_present:
          apiReadinessGapReview.gap_report_present,
        api_readiness_gap_status: apiReadinessGapReview.api_gap_status,
        api_readiness_source_blocker_count:
          apiReadinessGapReview.source_blockers.length,
        api_readiness_required_source_blocked_count:
          apiReadinessGapReview.required_source_blocked_count,
        api_readiness_required_source_report_date_blocked_count:
          apiReadinessGapReview.required_source_report_date_blocked_count,
        api_readiness_campaignBudgetId_missing_rows:
          apiReadinessGapReview.platform_campaignBudgetId_missing_rows,
        api_readiness_product_inventory_profit_blocker_count:
          apiReadinessGapReview.product_inventory_profit_blockers.length,
        api_readiness_supplier_safety_blocker_count:
          apiReadinessGapReview.supplier_safety_blockers.length,
        api_readiness_final_go_no_go_stage_status:
          apiReadinessGapReview.final_go_no_go_stage_status,
        api_readiness_final_go_no_go_stage_blocker_count:
          apiReadinessGapReview.final_go_no_go_stage_blockers.length,
        execution_records_checked: executionEvidence.execution_records_checked,
        blocked_execution_records: executionEvidence.blocked_execution_records,
        scale_candidate_blocker_families:
          executionEvidence.scale_candidate_blocker_families.length,
        pause_safety_records_visible:
          executionEvidence.pause_safety_records_visible,
        monitor_only_safety_records_visible:
          executionEvidence.monitor_only_safety_records_visible,
        safety_action_records_visible:
          executionEvidence.safety_action_records_visible,
        execution_readiness_contract_present:
          executionReadinessContractReview.contract_present,
        execution_readiness_action_type_coverage_present:
          executionReadinessContractReview.action_type_coverage_present,
        execution_readiness_required_gate_families:
          executionReadinessContractReview.required_gate_families.length,
        execution_readiness_blocked_gate_families:
          executionReadinessContractReview.blocked_gate_families,
        execution_readiness_scale_candidate_blocked_by_all_gate_families:
          executionReadinessContractReview.scale_candidate_blocked_by_all_gate_families,
        execution_readiness_supported_mvp_actions_present:
          executionReadinessContractReview.supported_mvp_actions_present,
        execution_readiness_supported_mvp_actions_exact_match:
          executionReadinessContractReview.supported_mvp_actions_exact_match,
        execution_readiness_missing_supported_mvp_actions:
          executionReadinessContractReview.missing_supported_mvp_actions,
        execution_readiness_unsupported_supported_mvp_actions:
          executionReadinessContractReview.unsupported_supported_mvp_actions,
        execution_readiness_supported_mvp_actions_order_matches_expected:
          executionReadinessContractReview.supported_mvp_actions_order_matches_expected,
        execution_readiness_required_gate_families_present:
          executionReadinessContractReview.required_gate_families_present,
        execution_readiness_required_gate_families_exact_match:
          executionReadinessContractReview.required_gate_families_exact_match,
        execution_readiness_missing_required_gate_families:
          executionReadinessContractReview.missing_required_gate_families,
        execution_readiness_unsupported_required_gate_families:
          executionReadinessContractReview.unsupported_required_gate_families,
        execution_readiness_required_gate_families_order_matches_expected:
          executionReadinessContractReview.required_gate_families_order_matches_expected,
        execution_readiness_must_have_before_future_live_execution_present:
          executionReadinessContractReview.must_have_before_future_live_execution_present,
        execution_readiness_must_have_before_future_live_execution_exact_match:
          executionReadinessContractReview.must_have_before_future_live_execution_exact_match,
        execution_readiness_missing_must_have_before_future_live_execution:
          executionReadinessContractReview.missing_must_have_before_future_live_execution,
        execution_readiness_unsupported_must_have_before_future_live_execution:
          executionReadinessContractReview.unsupported_must_have_before_future_live_execution,
        execution_readiness_must_have_before_future_live_execution_order_matches_expected:
          executionReadinessContractReview.must_have_before_future_live_execution_order_matches_expected,
        execution_readiness_non_execution_guarantee_present:
          executionReadinessContractReview.non_execution_guarantee_present,
        execution_readiness_non_execution_guarantee_exact_match:
          executionReadinessContractReview.non_execution_guarantee_exact_match,
        execution_readiness_non_execution_guarantee_defects:
          executionReadinessContractReview.non_execution_guarantee_defects,
        execution_readiness_coverage_integrity_exact_match:
          executionReadinessContractReview.coverage_integrity_exact_match,
        execution_readiness_coverage_integrity_defects:
          executionReadinessContractReview.coverage_integrity_defects,
        execution_readiness_missing_mvp_action_coverage:
          executionReadinessContractReview.missing_mvp_action_coverage.length,
        missing_mvp_action_coverage:
          executionReadinessContractReview.missing_mvp_action_coverage,
        execution_readiness_local_review_defect:
          executionReadinessContractReview.local_review_defect,
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
        next_required_action:
          status === "ready_for_manager_review_blocked_before_live"
            ? "inspect_final_gate_review_export"
            : "fix_local_final_gate_review_defects",
      },
      gateFamilyReview,
      executionEvidenceReview: executionEvidence,
      productionBridgeReview,
      apiReadinessGapReview,
      executionReadinessContractReview,
      localReviewBlockers,
      liveReadinessBlockers,
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        executionEvidence,
        productionBridge,
        apiReadinessGapReview,
        executionReadinessContractReview,
        localReviewBlockers,
        liveReadinessBlockers,
      }),
      finalGoNoGoGate: finalGate,
      productionReadinessBridge: productionBridge,
    };
  }

  private productionBridgeInput(input: {
    input?: AdsAutomationProductionReadinessBridgeInput;
    reportDate: string;
    generatedAt: string;
    finalGate: AdsAutomationFinalGateReviewExportResponse["finalGoNoGoGate"];
  }): AdsAutomationProductionReadinessBridgeInput {
    const source = input.input || {};
    return {
      ...source,
      reportDate: source.reportDate ?? input.reportDate,
      now: source.now ?? input.generatedAt,
      finalGoNoGoGateResponse:
        source.finalGoNoGoGateResponse ?? input.finalGate,
    };
  }

  private executionEvidenceReview(
    finalGate: AdsAutomationFinalGateReviewExportResponse["finalGoNoGoGate"],
  ): AdsAutomationFinalGateReviewExecutionEvidence {
    const evidence = finalGate.executionGateEvidence;
    return {
      evidence_source: evidence.evidence_source,
      final_live_execution_status: evidence.final_live_execution_status,
      required_gate_families: [...evidence.required_gate_families],
      blocked_gate_families: [...evidence.blocked_gate_families],
      missing_required_gate_family_evidence: [
        ...evidence.missing_required_gate_family_evidence,
      ],
      execution_records_checked: evidence.execution_records_checked,
      blocked_execution_records: evidence.blocked_execution_records,
      executable_now_actions: 0,
      validateOnly_missing_or_blocked_records:
        evidence.validateOnly_missing_or_blocked_records,
      validateOnly_passed_records: evidence.validateOnly_passed_records,
      approval_missing_or_blocked_records:
        evidence.approval_missing_or_blocked_records,
      approval_audit_missing_or_blocked_records:
        evidence.approval_audit_missing_or_blocked_records,
      source_readiness_blocked_records:
        evidence.source_readiness_blocked_records,
      finance_policy_blocked_records: evidence.finance_policy_blocked_records,
      kill_switch_blocked_records: evidence.kill_switch_blocked_records,
      idempotency_blocked_records: evidence.idempotency_blocked_records,
      campaignBudgetId_blocked_records:
        evidence.campaignBudgetId_blocked_records,
      production_flag_blocked_records: evidence.production_flag_blocked_records,
      live_path_blocked_records: evidence.live_path_blocked_records,
      scale_candidate_blocker_families: [
        ...evidence.scale_candidate_blocker_families,
      ],
      pause_safety_records_visible: evidence.pause_safety_records_visible,
      monitor_only_safety_records_visible:
        evidence.monitor_only_safety_records_visible,
      safety_action_records_visible: evidence.safety_action_records_visible,
      final_live_blockers: [...evidence.final_live_blockers],
      blockerCoverage: this.blockerCoverage(evidence),
    };
  }

  private blockerCoverage(
    evidence: AdsAutomationFinalGateReviewExportResponse["finalGoNoGoGate"]["executionGateEvidence"],
  ): AdsAutomationExecutionPreflightBlockerCoverage {
    return {
      required_gate_families: [...evidence.required_gate_families],
      blocked_gate_families: [...evidence.blocked_gate_families],
      missing_required_gate_family_evidence: [
        ...evidence.missing_required_gate_family_evidence,
      ],
      scale_candidate_blocker_families: [
        ...evidence.scale_candidate_blocker_families,
      ],
      scale_candidate_blocked_by_all_gate_families:
        evidence.scale_candidate_blocker_families.length ===
        evidence.required_gate_families.length,
      validateOnly_missing_or_blocked_records:
        evidence.validateOnly_missing_or_blocked_records,
      validateOnly_passed_records: evidence.validateOnly_passed_records,
      approval_missing_or_blocked_records:
        evidence.approval_missing_or_blocked_records,
      approval_audit_missing_or_blocked_records:
        evidence.approval_audit_missing_or_blocked_records,
      source_readiness_blocked_records:
        evidence.source_readiness_blocked_records,
      finance_policy_blocked_records: evidence.finance_policy_blocked_records,
      kill_switch_blocked_records: evidence.kill_switch_blocked_records,
      idempotency_blocked_records: evidence.idempotency_blocked_records,
      campaignBudgetId_blocked_records:
        evidence.campaignBudgetId_blocked_records,
      production_flag_blocked_records: evidence.production_flag_blocked_records,
      live_path_blocked_records: evidence.live_path_blocked_records,
      pause_safety_records_visible: evidence.pause_safety_records_visible,
      monitor_only_safety_records_visible:
        evidence.monitor_only_safety_records_visible,
      safety_action_records_visible: evidence.safety_action_records_visible,
      executable_now_actions: 0,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    };
  }

  private gateFamilyReview(
    finalGate: AdsAutomationFinalGateReviewExportResponse["finalGoNoGoGate"],
  ): AdsAutomationFinalGateReviewGateFamilyReview[] {
    const evidence = finalGate.executionGateEvidence;
    const scaleCandidateFamilies = new Set(
      evidence.scale_candidate_blocker_families,
    );
    const missingFamilies = new Set(
      evidence.missing_required_gate_family_evidence,
    );

    return evidence.gate_family_statuses.map((family) => ({
      key: family.key,
      status: family.status,
      records_checked: family.records_checked,
      records_blocked: family.records_blocked,
      blocked_approval_ids: [...family.blocked_approval_ids],
      blocker_keys: [...family.blocker_keys],
      scale_candidate_blocker_family: scaleCandidateFamilies.has(family.key),
      review_status: missingFamilies.has(family.key)
        ? "missing_required_evidence"
        : family.status === "blocked"
          ? "blocked_before_live"
          : "passed_local_only_needs_blocker",
    }));
  }

  private productionBridgeReview(
    bridge: AdsAutomationProductionReadinessBridgeResponse,
  ): AdsAutomationFinalGateReviewProductionBridgeReview {
    return {
      schemaVersion: bridge.schemaVersion,
      status: bridge.status,
      providerOrderValid: bridge.providerOrderValid,
      bridgeBlockers: [...bridge.bridgeBlockers],
      blockersForRealProduction: [...bridge.blockersForRealProduction],
      provider_gate_blockers: this.unique(
        bridge.providers.flatMap((provider) =>
          Object.values(provider.gates).flatMap((gate) => gate.blockers),
        ),
      ),
      business_safety_gates_uncertain: bridge.businessSafetyGates.filter(
        (gate) => gate.state === "uncertain_blocks_scale",
      ).length,
      scale_action_mode: bridge.scale_action_mode,
      demoReadiness: this.cloneJson(bridge.demoReadiness),
    };
  }

  private apiReadinessGapReview(
    report: AdsAutomationFinalGateReviewExportInput["apiReadinessGapReport"],
  ): AdsAutomationFinalGateReviewApiReadinessGapReview {
    if (!report) {
      return {
        schemaVersion: "ads_automation_final_gate_api_readiness_gap_review.v1",
        gap_report_present: false,
        source_schema_version: null,
        api_gap_status: "missing",
        source_readiness_review_export_consumed: false,
        source_readiness_review_export_status: null,
        source_readiness_review_export_mode: null,
        required_source_count: 0,
        required_source_ready_count: 0,
        required_source_blocked_count: 0,
        required_source_report_date_covered_count: 0,
        required_source_report_date_blocked_count: 0,
        missing_required_source_evidence: [],
        source_coverage_blocking_reasons: [],
        source_blockers: [],
        source_readiness_review_blockers: [],
        platform_entity_coverage_blockers: [],
        platform_entity_coverage_action_blockers: [],
        campaignBudgetId_blockers: [],
        product_inventory_profit_blockers: [],
        supplier_safety_blockers: [],
        platform_campaignBudgetId_missing_rows: 0,
        platform_blocked_product_count: 0,
        platform_blocked_supplier_count: 0,
        platform_supplier_choice_safe: null,
        validateOnly_lane_created: false,
        provider_validateOnly_plans: 0,
        provider_validateOnly_passed: 0,
        final_go_no_go_stage_status: "missing",
        final_go_no_go_stage_blockers: [],
        final_go_no_go_stage_evidence: [],
        final_go_no_go_stage_next_required_action: null,
        local_review_defect: false,
        local_review_defect_keys: [],
        review_status: "api_gap_missing",
      };
    }

    const summary = report.summary || ({} as any);
    const stages = Array.isArray(report.stages) ? report.stages : [];
    const finalGoNoGoStage = stages.find(
      (stage) => stage.stage === "final_go_no_go_readiness",
    );
    const sourceBlockers = this.arrayText(report.sourceBlockers);
    const finalStageBlockers = this.arrayText(finalGoNoGoStage?.blockers);
    const platformEntityCoverageBlockers = this.arrayText(
      report.platformEntityCoverageBlockers,
    );
    const platformEntityCoverageActionBlockers =
      this.platformEntityCoverageActionBlockerLines(report);
    const allApiBlockers = this.unique([
      ...sourceBlockers,
      ...finalStageBlockers,
      ...platformEntityCoverageBlockers,
      ...platformEntityCoverageActionBlockers,
    ]);
    const sourceReadinessReviewBlockers = this.unique(
      allApiBlockers.filter((blocker) =>
        blocker.startsWith("source_readiness_review."),
      ),
    );
    const campaignBudgetIdBlockers = this.matchBlockers(allApiBlockers, [
      "campaignBudgetId",
      "campaign_budget",
      "campaignBudgets",
    ]);
    const productInventoryProfitBlockers = this.matchBlockers(allApiBlockers, [
      "product",
      "inventory",
      "profit",
      "productMapping",
      "inventoryProfit",
    ]);
    const supplierSafetyBlockers = this.matchBlockers(allApiBlockers, [
      "supplier",
      "supplierContext",
    ]);
    const localReviewDefectKeys = this.apiReadinessLocalReviewDefectKeys({
      sourceReadinessReviewBlockers,
      campaignBudgetIdBlockers,
      productInventoryProfitBlockers,
      supplierSafetyBlockers,
      requiredSourceBlockedCount: this.safeNumber(
        summary.required_source_blocked_count,
      ),
      requiredSourceReportDateBlockedCount: this.safeNumber(
        summary.required_source_report_date_blocked_count,
      ),
      finalStageBlockers,
    });

    return {
      schemaVersion: "ads_automation_final_gate_api_readiness_gap_review.v1",
      gap_report_present: true,
      source_schema_version: report.schemaVersion || null,
      api_gap_status: summary.status || "missing",
      source_readiness_review_export_consumed: Boolean(
        summary.source_readiness_review_export_consumed,
      ),
      source_readiness_review_export_status:
        summary.source_readiness_review_export_status || null,
      source_readiness_review_export_mode:
        summary.source_readiness_review_export_mode || null,
      required_source_count: this.safeNumber(summary.required_source_count),
      required_source_ready_count: this.safeNumber(
        summary.required_source_ready_count,
      ),
      required_source_blocked_count: this.safeNumber(
        summary.required_source_blocked_count,
      ),
      required_source_report_date_covered_count: this.safeNumber(
        summary.required_source_report_date_covered_count,
      ),
      required_source_report_date_blocked_count: this.safeNumber(
        summary.required_source_report_date_blocked_count,
      ),
      missing_required_source_evidence: this.arrayText(
        summary.missing_required_source_evidence,
      ),
      source_coverage_blocking_reasons: this.arrayText(
        summary.source_coverage_blocking_reasons,
      ),
      source_blockers: sourceBlockers,
      source_readiness_review_blockers: sourceReadinessReviewBlockers,
      platform_entity_coverage_blockers: platformEntityCoverageBlockers,
      platform_entity_coverage_action_blockers:
        platformEntityCoverageActionBlockers,
      campaignBudgetId_blockers: campaignBudgetIdBlockers,
      product_inventory_profit_blockers: productInventoryProfitBlockers,
      supplier_safety_blockers: supplierSafetyBlockers,
      platform_campaignBudgetId_missing_rows: this.safeNumber(
        summary.platform_campaignBudgetId_missing_rows,
      ),
      platform_blocked_product_count: this.safeNumber(
        summary.platform_blocked_product_count,
      ),
      platform_blocked_supplier_count: this.safeNumber(
        summary.platform_blocked_supplier_count,
      ),
      platform_supplier_choice_safe:
        typeof summary.platform_supplier_choice_safe === "boolean"
          ? summary.platform_supplier_choice_safe
          : null,
      validateOnly_lane_created: Boolean(report.validateOnlyLane?.created),
      provider_validateOnly_plans: this.safeNumber(
        summary.provider_validateOnly_plans,
      ),
      provider_validateOnly_passed: this.safeNumber(
        summary.provider_validateOnly_passed,
      ),
      final_go_no_go_stage_status: finalGoNoGoStage?.status || "missing",
      final_go_no_go_stage_blockers: finalStageBlockers,
      final_go_no_go_stage_evidence: this.arrayText(finalGoNoGoStage?.evidence),
      final_go_no_go_stage_next_required_action:
        this.text(finalGoNoGoStage?.next_required_action) || null,
      local_review_defect: localReviewDefectKeys.length > 0,
      local_review_defect_keys: localReviewDefectKeys,
      review_status: localReviewDefectKeys.length
        ? "api_gap_blocked_before_final_go_no_go"
        : "api_gap_visible_no_source_blockers",
    };
  }

  private apiReadinessLocalReviewDefectKeys(input: {
    sourceReadinessReviewBlockers: string[];
    campaignBudgetIdBlockers: string[];
    productInventoryProfitBlockers: string[];
    supplierSafetyBlockers: string[];
    requiredSourceBlockedCount: number;
    requiredSourceReportDateBlockedCount: number;
    finalStageBlockers: string[];
  }): string[] {
    const sourceRelatedFinalStageBlockers = input.finalStageBlockers.filter(
      (blocker) => this.apiReadinessSourceRelatedBlocker(blocker),
    );
    const sourceDefects = this.unique([
      ...(input.requiredSourceBlockedCount > 0
        ? ["api_readiness_gap.required_sources_blocked"]
        : []),
      ...(input.requiredSourceReportDateBlockedCount > 0
        ? ["api_readiness_gap.required_sources_report_date_not_covered"]
        : []),
      ...input.sourceReadinessReviewBlockers.map(
        (blocker) => `api_readiness_gap.${blocker}`,
      ),
      ...input.campaignBudgetIdBlockers.map(
        (blocker) => `api_readiness_gap.${blocker}`,
      ),
      ...input.productInventoryProfitBlockers.map(
        (blocker) => `api_readiness_gap.${blocker}`,
      ),
      ...input.supplierSafetyBlockers.map(
        (blocker) => `api_readiness_gap.${blocker}`,
      ),
      ...sourceRelatedFinalStageBlockers.map(
        (blocker) => `api_readiness_gap.final_go_no_go_stage.${blocker}`,
      ),
    ]);

    return sourceDefects.length
      ? this.unique([
          "api_readiness_gap.source_readiness_blocked",
          ...sourceDefects,
        ])
      : [];
  }

  private apiReadinessSourceRelatedBlocker(blocker: string): boolean {
    return (
      blocker.startsWith("source_readiness_review.") ||
      /campaignBudgetId|campaign_budget|campaignBudgets|platform_entity|product|inventory|profit|supplier/i.test(
        blocker,
      )
    );
  }

  private platformEntityCoverageActionBlockerLines(
    report: NonNullable<
      AdsAutomationFinalGateReviewExportInput["apiReadinessGapReport"]
    >,
  ): string[] {
    const blockers = (
      report.pendingActionNormalization as
        | { platformEntityCoverageActionBlockersApplied?: unknown }
        | undefined
    )?.platformEntityCoverageActionBlockersApplied;

    if (!Array.isArray(blockers)) return [];

    return this.unique(
      blockers
        .map((blocker) =>
          typeof blocker === "string"
            ? blocker
            : this.text((blocker as { blocker?: unknown })?.blocker),
        )
        .filter((blocker): blocker is string => Boolean(blocker)),
    );
  }

  private matchBlockers(values: string[], needles: string[]): string[] {
    const normalizedNeedles = needles.map((needle) => needle.toLowerCase());
    return this.unique(
      values.filter((value) => {
        const normalizedValue = value.toLowerCase();
        return normalizedNeedles.some((needle) =>
          normalizedValue.includes(needle),
        );
      }),
    );
  }

  private executionReadinessContractReview(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
  ): AdsAutomationFinalGateReviewExecutionReadinessContractReview {
    if (!contract) {
      return {
        schemaVersion: "ads_automation_execution_readiness_contract_review.v1",
        contract_present: false,
        action_type_coverage_present: false,
        source_schema_version: null,
        supported_mvp_actions: [],
        expected_supported_mvp_actions: this.expectedSupportedMvpActions(),
        supported_mvp_actions_present: false,
        supported_mvp_actions_exact_match: false,
        missing_supported_mvp_actions: this.expectedSupportedMvpActions(),
        unsupported_supported_mvp_actions: [],
        supported_mvp_actions_order_matches_expected: false,
        required_gate_families: [],
        expected_required_gate_families: this.expectedRequiredGateFamilies(),
        required_gate_families_present: false,
        required_gate_families_exact_match: false,
        missing_required_gate_families: this.expectedRequiredGateFamilies(),
        unsupported_required_gate_families: [],
        required_gate_families_order_matches_expected: false,
        must_have_before_future_live_execution: [],
        expected_must_have_before_future_live_execution:
          this.expectedMustHaveBeforeFutureLiveExecution(),
        must_have_before_future_live_execution_present: false,
        must_have_before_future_live_execution_exact_match: false,
        missing_must_have_before_future_live_execution:
          this.expectedMustHaveBeforeFutureLiveExecution(),
        unsupported_must_have_before_future_live_execution: [],
        must_have_before_future_live_execution_order_matches_expected: false,
        non_execution_guarantee_present: false,
        non_execution_guarantee_exact_match: false,
        non_execution_guarantee_defects:
          this.executionReadinessNonExecutionGuaranteeDefectKeys(null),
        coverage_integrity_exact_match: false,
        coverage_integrity_defects: [],
        missing_must_have_items:
          this.expectedMustHaveBeforeFutureLiveExecution(),
        action_type_coverage: [],
        missing_mvp_action_coverage: [
          ...ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
        ],
        records_checked: 0,
        blocked_gate_families: 0,
        required_pre_live_gates_passed_records: 0,
        required_pre_live_gates_blocked_records: 0,
        scale_candidate_blocked_by_all_gate_families: false,
        pause_safety_records_visible: 0,
        monitor_only_safety_records_visible: 0,
        safety_action_records_visible: 0,
        executable_now_actions: 0,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        local_review_defect: true,
        local_review_defect_keys: this.executionReadinessLocalReviewDefectKeys(
          null,
          [],
          [],
          [],
          [],
        ),
        review_status: "contract_missing",
      };
    }

    const actionTypeCoverage =
      this.executionReadinessActionTypeCoverage(contract);
    const supportedMvpActions =
      this.executionReadinessSupportedMvpActions(contract);
    const requiredGateFamilies =
      this.executionReadinessRequiredGateFamilies(contract);
    const mustHaveBeforeFutureLiveExecution =
      this.executionReadinessMustHaveBeforeFutureLiveExecution(contract);
    const missingMvpActionCoverage =
      this.missingMvpActionCoverage(actionTypeCoverage);
    const nonExecutionGuaranteeDefects =
      this.executionReadinessNonExecutionGuaranteeDefectKeys(contract);
    const coverageIntegrityDefects =
      this.executionReadinessCoverageIntegrityDefectKeys(
        contract,
        actionTypeCoverage,
      );
    const localReviewDefectKeys = this.executionReadinessLocalReviewDefectKeys(
      contract,
      actionTypeCoverage,
      supportedMvpActions,
      requiredGateFamilies,
      mustHaveBeforeFutureLiveExecution,
      nonExecutionGuaranteeDefects,
      coverageIntegrityDefects,
    );

    return {
      schemaVersion: "ads_automation_execution_readiness_contract_review.v1",
      contract_present: true,
      action_type_coverage_present: Array.isArray(
        contract.action_type_coverage,
      ),
      source_schema_version: contract.schemaVersion,
      supported_mvp_actions: supportedMvpActions,
      expected_supported_mvp_actions: this.expectedSupportedMvpActions(),
      supported_mvp_actions_present: this.supportedMvpActionsPresent(contract),
      supported_mvp_actions_exact_match:
        this.supportedMvpActionsExactMatch(supportedMvpActions),
      missing_supported_mvp_actions:
        this.missingSupportedMvpActions(supportedMvpActions),
      unsupported_supported_mvp_actions:
        this.unsupportedSupportedMvpActions(supportedMvpActions),
      supported_mvp_actions_order_matches_expected:
        this.supportedMvpActionsOrderMatchesExpected(supportedMvpActions),
      required_gate_families: requiredGateFamilies,
      expected_required_gate_families: this.expectedRequiredGateFamilies(),
      required_gate_families_present:
        this.requiredGateFamiliesPresent(contract),
      required_gate_families_exact_match:
        this.requiredGateFamiliesExactMatch(requiredGateFamilies),
      missing_required_gate_families:
        this.missingRequiredGateFamilies(requiredGateFamilies),
      unsupported_required_gate_families:
        this.unsupportedRequiredGateFamilies(requiredGateFamilies),
      required_gate_families_order_matches_expected:
        this.requiredGateFamiliesOrderMatchesExpected(requiredGateFamilies),
      must_have_before_future_live_execution: mustHaveBeforeFutureLiveExecution,
      expected_must_have_before_future_live_execution:
        this.expectedMustHaveBeforeFutureLiveExecution(),
      must_have_before_future_live_execution_present:
        this.mustHaveBeforeFutureLiveExecutionPresent(contract),
      must_have_before_future_live_execution_exact_match:
        this.mustHaveBeforeFutureLiveExecutionExactMatch(
          mustHaveBeforeFutureLiveExecution,
        ),
      missing_must_have_before_future_live_execution:
        this.missingMustHaveBeforeFutureLiveExecution(
          mustHaveBeforeFutureLiveExecution,
        ),
      unsupported_must_have_before_future_live_execution:
        this.unsupportedMustHaveBeforeFutureLiveExecution(
          mustHaveBeforeFutureLiveExecution,
        ),
      must_have_before_future_live_execution_order_matches_expected:
        this.mustHaveBeforeFutureLiveExecutionOrderMatchesExpected(
          mustHaveBeforeFutureLiveExecution,
        ),
      non_execution_guarantee_present:
        this.nonExecutionGuaranteePresent(contract),
      non_execution_guarantee_exact_match:
        nonExecutionGuaranteeDefects.length === 0,
      non_execution_guarantee_defects: nonExecutionGuaranteeDefects,
      coverage_integrity_exact_match: coverageIntegrityDefects.length === 0,
      coverage_integrity_defects: coverageIntegrityDefects,
      missing_must_have_items:
        this.expectedMustHaveBeforeFutureLiveExecution().filter(
          (item) => !mustHaveBeforeFutureLiveExecution.includes(item),
        ),
      action_type_coverage: actionTypeCoverage,
      missing_mvp_action_coverage: missingMvpActionCoverage,
      records_checked: contract.gate_coverage.records_checked,
      blocked_gate_families:
        contract.gate_coverage.blocked_gate_families.length,
      required_pre_live_gates_passed_records:
        contract.gate_coverage.required_pre_live_gates_passed_records,
      required_pre_live_gates_blocked_records:
        contract.gate_coverage.required_pre_live_gates_blocked_records,
      scale_candidate_blocked_by_all_gate_families:
        contract.gate_coverage.scale_candidate_blocked_by_all_gate_families,
      pause_safety_records_visible:
        contract.safety_action_visibility.pause_safety_records_visible,
      monitor_only_safety_records_visible:
        contract.safety_action_visibility.monitor_only_safety_records_visible,
      safety_action_records_visible:
        contract.safety_action_visibility.safety_action_records_visible,
      executable_now_actions: 0,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      local_review_defect: localReviewDefectKeys.length > 0,
      local_review_defect_keys: localReviewDefectKeys,
      review_status: localReviewDefectKeys.length
        ? "contract_incomplete_local_review_defect"
        : "contract_visible_blocked_before_live",
    };
  }

  private safety(
    executionPreflightEvidenceReused: boolean,
    apiReadinessGapReportReused: boolean,
  ): AdsAutomationFinalGateReviewExportResponse["safety"] {
    return {
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      fixture_or_payload_only: true,
      final_go_no_go_gate_reused: true,
      execution_preflight_evidence_reused: executionPreflightEvidenceReused,
      production_readiness_bridge_reused: true,
      api_readiness_gap_report_reused: apiReadinessGapReportReused,
      persistence_used: false,
      durable_storage_used: false,
      erp_local_persistence_used: false,
      provider_persistence_used: false,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      campaignBudgetId_no_fallback: true,
      approval_required_for_all_actions: true,
      future_live_execution_allowed: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    };
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationFinalGateReviewExportStatus;
    executionEvidence: AdsAutomationFinalGateReviewExecutionEvidence;
    productionBridge: AdsAutomationProductionReadinessBridgeResponse;
    apiReadinessGapReview: AdsAutomationFinalGateReviewApiReadinessGapReview;
    executionReadinessContractReview: AdsAutomationFinalGateReviewExecutionReadinessContractReview;
    localReviewBlockers: string[];
    liveReadinessBlockers: string[];
  }): string {
    return [
      "# Ads Automation Final Gate Review Export",
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Final live execution status: ${input.executionEvidence.final_live_execution_status}`,
      `Gate families blocked: ${input.executionEvidence.blocked_gate_families.length}/${input.executionEvidence.required_gate_families.length}`,
      `Scale candidate blocked by all gate families: ${input.executionEvidence.blockerCoverage.scale_candidate_blocked_by_all_gate_families}`,
      `Execution records blocked: ${input.executionEvidence.blocked_execution_records}/${input.executionEvidence.execution_records_checked}`,
      `Safety actions visible: pause=${input.executionEvidence.pause_safety_records_visible}, monitor_only=${input.executionEvidence.monitor_only_safety_records_visible}`,
      "Execution readiness contract:",
      ...this.executionReadinessContractLines(
        input.executionReadinessContractReview,
      ).map((line) => `- ${line}`),
      "API readiness gap review:",
      ...this.apiReadinessGapReviewLines(input.apiReadinessGapReview).map(
        (line) => `- ${line}`,
      ),
      `Production bridge: ${input.productionBridge.status}`,
      `Local blockers: ${this.joinOrNone(input.localReviewBlockers)}`,
      `Live readiness blockers: ${this.joinOrNone(input.liveReadinessBlockers)}`,
      "Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false",
      "Live execution remains blocked until ERP-owned credentials, provider validateOnly, human approval UI, preflight/idempotency/kill switch evidence, production flag, and small-cap live-test approval exist.",
    ].join("\n");
  }

  private executionReadinessContractLines(
    review: AdsAutomationFinalGateReviewExecutionReadinessContractReview,
  ): string[] {
    return [
      `contract_present=${review.contract_present}`,
      `action_type_coverage_present=${review.action_type_coverage_present}`,
      `supported_mvp_actions=${this.joinOrNone(review.supported_mvp_actions)}`,
      `expected_supported_mvp_actions=${this.joinOrNone(
        review.expected_supported_mvp_actions,
      )}`,
      `supported_mvp_actions_present=${review.supported_mvp_actions_present}`,
      `supported_mvp_actions_exact_match=${review.supported_mvp_actions_exact_match}`,
      `missing_supported_mvp_actions=${this.joinOrNone(
        review.missing_supported_mvp_actions,
      )}`,
      `unsupported_supported_mvp_actions=${this.joinOrNone(
        review.unsupported_supported_mvp_actions,
      )}`,
      `supported_mvp_actions_order_matches_expected=${review.supported_mvp_actions_order_matches_expected}`,
      `required_gate_families=${this.joinOrNone(review.required_gate_families)}`,
      `expected_required_gate_families=${this.joinOrNone(
        review.expected_required_gate_families,
      )}`,
      `required_gate_families_present=${review.required_gate_families_present}`,
      `required_gate_families_exact_match=${review.required_gate_families_exact_match}`,
      `missing_required_gate_families=${this.joinOrNone(
        review.missing_required_gate_families,
      )}`,
      `unsupported_required_gate_families=${this.joinOrNone(
        review.unsupported_required_gate_families,
      )}`,
      `required_gate_families_order_matches_expected=${review.required_gate_families_order_matches_expected}`,
      `must_have_before_future_live_execution=${this.joinOrNone(
        review.must_have_before_future_live_execution,
      )}`,
      `expected_must_have_before_future_live_execution=${this.joinOrNone(
        review.expected_must_have_before_future_live_execution,
      )}`,
      `must_have_before_future_live_execution_present=${review.must_have_before_future_live_execution_present}`,
      `must_have_before_future_live_execution_exact_match=${review.must_have_before_future_live_execution_exact_match}`,
      `missing_must_have_before_future_live_execution=${this.joinOrNone(
        review.missing_must_have_before_future_live_execution,
      )}`,
      `unsupported_must_have_before_future_live_execution=${this.joinOrNone(
        review.unsupported_must_have_before_future_live_execution,
      )}`,
      `must_have_before_future_live_execution_order_matches_expected=${review.must_have_before_future_live_execution_order_matches_expected}`,
      `non_execution_guarantee_present=${review.non_execution_guarantee_present}`,
      `non_execution_guarantee_exact_match=${review.non_execution_guarantee_exact_match}`,
      `non_execution_guarantee_defects=${this.joinOrNone(
        review.non_execution_guarantee_defects,
      )}`,
      `coverage_integrity_exact_match=${review.coverage_integrity_exact_match}`,
      `coverage_integrity_defects=${this.joinOrNone(
        review.coverage_integrity_defects,
      )}`,
      `missing_must_have_items=${this.joinOrNone(
        review.missing_must_have_items,
      )}`,
      `action_type_coverage=${this.joinOrNone(
        this.actionTypeCoverageLines(review.action_type_coverage),
      )}`,
      `missing_mvp_action_coverage=${this.joinOrNone(
        review.missing_mvp_action_coverage,
      )}`,
      `local_review_defects=${this.joinOrNone(review.local_review_defect_keys)}`,
      `records_checked=${review.records_checked}`,
      `blocked_gate_families=${review.blocked_gate_families}`,
      `required_pre_live_gates_passed_records=${review.required_pre_live_gates_passed_records}`,
      `required_pre_live_gates_blocked_records=${review.required_pre_live_gates_blocked_records}`,
      `scale_candidate_blocked_by_all_gate_families=${review.scale_candidate_blocked_by_all_gate_families}`,
      `safety_actions_visible=pause:${review.pause_safety_records_visible}, monitor_only:${review.monitor_only_safety_records_visible}`,
      `provider_api_called=${review.provider_api_called}`,
      `google_ads_api_called=${review.google_ads_api_called}`,
      `validateOnly_called=${review.validateOnly_called}`,
      `live_ads_execution_used=${review.live_ads_execution_used}`,
      `execution_allowed_now=${review.execution_allowed_now}`,
      `production_ready=${review.production_ready}`,
    ];
  }

  private apiReadinessGapReviewLines(
    review: AdsAutomationFinalGateReviewApiReadinessGapReview,
  ): string[] {
    return [
      `gap_report_present=${review.gap_report_present}`,
      `api_gap_status=${review.api_gap_status}`,
      `source_readiness_review_export_consumed=${review.source_readiness_review_export_consumed}`,
      `source_readiness_review_export_status=${review.source_readiness_review_export_status || "none"}`,
      `required_sources=${review.required_source_ready_count}/${review.required_source_count}`,
      `required_sources_blocked=${review.required_source_blocked_count}`,
      `required_sources_report_date_blocked=${review.required_source_report_date_blocked_count}`,
      `missing_required_source_evidence=${this.joinOrNone(
        review.missing_required_source_evidence,
      )}`,
      `source_coverage_blocking_reasons=${this.joinOrNone(
        review.source_coverage_blocking_reasons,
      )}`,
      `source_readiness_review_blockers=${this.joinOrNone(
        review.source_readiness_review_blockers,
      )}`,
      `campaignBudgetId_missing_rows=${review.platform_campaignBudgetId_missing_rows}`,
      `campaignBudgetId_blockers=${this.joinOrNone(
        review.campaignBudgetId_blockers,
      )}`,
      `product_inventory_profit_blockers=${this.joinOrNone(
        review.product_inventory_profit_blockers,
      )}`,
      `supplier_safety_blockers=${this.joinOrNone(
        review.supplier_safety_blockers,
      )}`,
      `platform_entity_coverage_blockers=${this.joinOrNone(
        review.platform_entity_coverage_blockers,
      )}`,
      `validateOnly_lane_created=${review.validateOnly_lane_created}`,
      `provider_validateOnly_plans=${review.provider_validateOnly_plans}`,
      `final_go_no_go_stage_status=${review.final_go_no_go_stage_status}`,
      `final_go_no_go_stage_blockers=${this.joinOrNone(
        review.final_go_no_go_stage_blockers,
      )}`,
      `local_review_defect=${review.local_review_defect}`,
      `local_review_defects=${this.joinOrNone(review.local_review_defect_keys)}`,
    ];
  }

  private executionReadinessActionTypeCoverage(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): AdsAutomationExecutionPreflightActionTypeCoverage[] {
    return Array.isArray(contract.action_type_coverage)
      ? contract.action_type_coverage.map((item) => ({ ...item }))
      : [];
  }

  private executionReadinessSupportedMvpActions(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): AdsAutomationExecutionPreflightReadinessContract["supported_mvp_actions"] {
    const supportedMvpActions = (
      contract as { supported_mvp_actions?: unknown }
    ).supported_mvp_actions;
    return Array.isArray(supportedMvpActions)
      ? (supportedMvpActions.map((actionType) =>
          String(actionType),
        ) as AdsAutomationExecutionPreflightReadinessContract["supported_mvp_actions"])
      : [];
  }

  private expectedSupportedMvpActions(): AdsAutomationExecutionPreflightActionType[] {
    return [...ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS];
  }

  private supportedMvpActionsPresent(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): boolean {
    return Array.isArray(
      (contract as { supported_mvp_actions?: unknown }).supported_mvp_actions,
    );
  }

  private supportedMvpActionsExactMatch(
    declaredActions: readonly string[],
  ): boolean {
    return this.supportedMvpActionsOrderMatchesExpected(declaredActions);
  }

  private supportedMvpActionsOrderMatchesExpected(
    declaredActions: readonly string[],
  ): boolean {
    return (
      declaredActions.length ===
        ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.length &&
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.every(
        (expectedAction, index) => declaredActions[index] === expectedAction,
      )
    );
  }

  private missingSupportedMvpActions(
    declaredActions: readonly string[],
  ): AdsAutomationExecutionPreflightActionType[] {
    const declared = new Set(declaredActions);
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.filter(
      (actionType) => !declared.has(actionType),
    );
  }

  private unsupportedSupportedMvpActions(
    declaredActions: readonly string[],
  ): string[] {
    const supported = new Set<string>(
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
    );
    return this.unique(
      declaredActions.filter((actionType) => !supported.has(actionType)),
    );
  }

  private executionReadinessRequiredGateFamilies(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): AdsAutomationExecutionPreflightReadinessContract["required_gate_families"] {
    const requiredGateFamilies = (
      contract as { required_gate_families?: unknown }
    ).required_gate_families;
    return Array.isArray(requiredGateFamilies)
      ? (requiredGateFamilies.map((family) =>
          String(family),
        ) as AdsAutomationExecutionPreflightReadinessContract["required_gate_families"])
      : [];
  }

  private expectedRequiredGateFamilies(): AdsAutomationExecutionPreflightGateFamilyKey[] {
    return [...ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES];
  }

  private requiredGateFamiliesPresent(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): boolean {
    return Array.isArray(
      (contract as { required_gate_families?: unknown }).required_gate_families,
    );
  }

  private requiredGateFamiliesExactMatch(
    declaredFamilies: readonly string[],
  ): boolean {
    return this.requiredGateFamiliesOrderMatchesExpected(declaredFamilies);
  }

  private requiredGateFamiliesOrderMatchesExpected(
    declaredFamilies: readonly string[],
  ): boolean {
    return (
      declaredFamilies.length ===
        ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES.length &&
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES.every(
        (expectedFamily, index) => declaredFamilies[index] === expectedFamily,
      )
    );
  }

  private missingRequiredGateFamilies(
    declaredFamilies: readonly string[],
  ): AdsAutomationExecutionPreflightGateFamilyKey[] {
    const declared = new Set(declaredFamilies);
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES.filter(
      (family) => !declared.has(family),
    );
  }

  private unsupportedRequiredGateFamilies(
    declaredFamilies: readonly string[],
  ): string[] {
    const supported = new Set<string>(
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_REQUIRED_GATE_FAMILIES,
    );
    return this.unique(
      declaredFamilies.filter((family) => !supported.has(family)),
    );
  }

  private executionReadinessMustHaveBeforeFutureLiveExecution(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): string[] {
    const mustHave = (
      contract as { must_have_before_future_live_execution?: unknown }
    ).must_have_before_future_live_execution;
    return Array.isArray(mustHave) ? mustHave.map((item) => String(item)) : [];
  }

  private expectedMustHaveBeforeFutureLiveExecution(): string[] {
    return [...ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE];
  }

  private mustHaveBeforeFutureLiveExecutionPresent(
    contract: AdsAutomationExecutionPreflightReadinessContract,
  ): boolean {
    return Array.isArray(
      (contract as { must_have_before_future_live_execution?: unknown })
        .must_have_before_future_live_execution,
    );
  }

  private mustHaveBeforeFutureLiveExecutionExactMatch(
    declaredItems: readonly string[],
  ): boolean {
    return this.mustHaveBeforeFutureLiveExecutionOrderMatchesExpected(
      declaredItems,
    );
  }

  private mustHaveBeforeFutureLiveExecutionOrderMatchesExpected(
    declaredItems: readonly string[],
  ): boolean {
    return (
      declaredItems.length ===
        ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE.length &&
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE.every(
        (expectedItem, index) => declaredItems[index] === expectedItem,
      )
    );
  }

  private missingMustHaveBeforeFutureLiveExecution(
    declaredItems: readonly string[],
  ): string[] {
    const declared = new Set(declaredItems);
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE.filter(
      (item) => !declared.has(item),
    );
  }

  private unsupportedMustHaveBeforeFutureLiveExecution(
    declaredItems: readonly string[],
  ): string[] {
    const supported = new Set<string>(
      ADS_AUTOMATION_EXECUTION_PREFLIGHT_MUST_HAVE_BEFORE_FUTURE_LIVE,
    );
    return this.unique(declaredItems.filter((item) => !supported.has(item)));
  }

  private missingMvpActionCoverage(
    coverage: AdsAutomationExecutionPreflightActionTypeCoverage[],
  ): (typeof ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS)[number][] {
    const coveredActionTypes = new Set(
      coverage.map((item) => item.action_type),
    );
    return ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.filter(
      (actionType) => !coveredActionTypes.has(actionType),
    );
  }

  private executionReadinessLocalReviewDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
    coverage: AdsAutomationExecutionPreflightActionTypeCoverage[],
    supportedMvpActions: readonly string[],
    requiredGateFamilies: readonly string[],
    mustHaveBeforeFutureLiveExecution: readonly string[],
    nonExecutionGuaranteeDefects: readonly string[] = this.executionReadinessNonExecutionGuaranteeDefectKeys(
      contract,
    ),
    coverageIntegrityDefects: readonly string[] = this.executionReadinessCoverageIntegrityDefectKeys(
      contract,
      coverage,
    ),
  ): string[] {
    const defects: string[] = [];
    if (!contract) {
      defects.push("execution_readiness_contract_missing");
    } else if (!Array.isArray(contract.action_type_coverage)) {
      defects.push("execution_readiness_contract_action_type_coverage_absent");
    }

    defects.push(
      ...this.supportedMvpActionDefectKeys(contract, supportedMvpActions),
    );
    defects.push(
      ...this.requiredGateFamilyDefectKeys(contract, requiredGateFamilies),
    );
    defects.push(
      ...this.mustHaveBeforeFutureLiveExecutionDefectKeys(
        contract,
        mustHaveBeforeFutureLiveExecution,
      ),
    );
    defects.push(...nonExecutionGuaranteeDefects);
    defects.push(...coverageIntegrityDefects);

    defects.push(
      ...this.missingMvpActionCoverage(coverage).map(
        (actionType) => `missing_mvp_action_coverage:${actionType}`,
      ),
    );

    return this.unique(defects);
  }

  private executionReadinessCoverageIntegrityDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
    coverage: AdsAutomationExecutionPreflightActionTypeCoverage[],
  ): string[] {
    if (!contract) return [];
    if (this.missingMvpActionCoverage(coverage).length) return [];

    const gateCoverage = (
      contract as {
        gate_coverage?: Record<string, unknown>;
      }
    ).gate_coverage;
    const safetyVisibility = (
      contract as {
        safety_action_visibility?: Record<string, unknown>;
      }
    ).safety_action_visibility;
    const defects: string[] = [];

    if (!gateCoverage || typeof gateCoverage !== "object") {
      return ["execution_readiness_contract_gate_coverage_absent"];
    }
    if (!safetyVisibility || typeof safetyVisibility !== "object") {
      defects.push(
        "execution_readiness_contract_safety_action_visibility_absent",
      );
    }

    const recordsChecked = this.numericField(
      gateCoverage.records_checked,
      "gate_coverage_records_checked_invalid",
      defects,
    );
    const preLivePassed = this.numericField(
      gateCoverage.required_pre_live_gates_passed_records,
      "gate_coverage_required_pre_live_gates_passed_records_invalid",
      defects,
    );
    const preLiveBlocked = this.numericField(
      gateCoverage.required_pre_live_gates_blocked_records,
      "gate_coverage_required_pre_live_gates_blocked_records_invalid",
      defects,
    );
    const livePathBlocked = this.numericField(
      gateCoverage.live_path_blocked_records,
      "gate_coverage_live_path_blocked_records_invalid",
      defects,
    );
    const productionFlagBlocked = this.numericField(
      gateCoverage.production_flag_blocked_records,
      "gate_coverage_production_flag_blocked_records_invalid",
      defects,
    );
    const actionRecordsChecked = coverage.reduce(
      (sum, item) => sum + this.safeNumber(item.records_checked),
      0,
    );
    const pauseSafetyRecords = coverage
      .filter(
        (item) =>
          item.action_type === "pause_campaign" ||
          item.action_type === "pause_ad_group",
      )
      .reduce((sum, item) => sum + this.safeNumber(item.records_checked), 0);
    const monitorOnlyRecords = coverage
      .filter((item) => item.action_type === "monitor_only")
      .reduce((sum, item) => sum + this.safeNumber(item.records_checked), 0);
    const expectedSafetyRecords = pauseSafetyRecords + monitorOnlyRecords;
    const blockedGateFamilies = Array.isArray(
      gateCoverage.blocked_gate_families,
    )
      ? gateCoverage.blocked_gate_families.map((family) => String(family))
      : [];

    if (Number.isFinite(recordsChecked) && recordsChecked <= 0) {
      defects.push("gate_coverage_records_missing");
    }
    if (
      Number.isFinite(recordsChecked) &&
      actionRecordsChecked !== recordsChecked
    ) {
      defects.push("gate_coverage_records_checked_mismatch");
    }
    if (
      Number.isFinite(recordsChecked) &&
      Number.isFinite(preLivePassed) &&
      Number.isFinite(preLiveBlocked) &&
      preLivePassed + preLiveBlocked !== recordsChecked
    ) {
      defects.push("gate_coverage_pre_live_records_total_mismatch");
    }
    if (
      Number.isFinite(recordsChecked) &&
      Number.isFinite(livePathBlocked) &&
      livePathBlocked !== recordsChecked
    ) {
      defects.push("gate_coverage_live_path_blocked_records_mismatch");
    }
    if (Number.isFinite(productionFlagBlocked) && productionFlagBlocked <= 0) {
      defects.push("gate_coverage_production_flag_blocker_missing");
    }
    if (
      !this.sameStringList(
        blockedGateFamilies,
        this.expectedRequiredGateFamilies(),
      )
    ) {
      defects.push("gate_coverage_blocked_gate_families_not_exact");
    }
    if (gateCoverage.scale_candidate_blocked_by_all_gate_families !== true) {
      defects.push(
        "gate_coverage_scale_candidate_not_blocked_by_all_gate_families",
      );
    }

    defects.push(
      ...this.actionTypeCoverageIntegrityDefects(coverage),
      ...this.safetyActionVisibilityDefects(
        safetyVisibility,
        pauseSafetyRecords,
        monitorOnlyRecords,
        expectedSafetyRecords,
      ),
    );

    return this.unique(defects);
  }

  private actionTypeCoverageIntegrityDefects(
    coverage: AdsAutomationExecutionPreflightActionTypeCoverage[],
  ): string[] {
    const defects: string[] = [];
    for (const item of coverage) {
      const actionType = item.action_type;
      const recordsChecked = this.safeNumber(item.records_checked);
      const recordsBlocked = this.safeNumber(item.records_blocked);
      const preLivePassed = this.safeNumber(
        item.required_pre_live_gates_passed_records,
      );
      const preLiveBlocked = this.safeNumber(
        item.required_pre_live_gates_blocked_records,
      );

      if (recordsBlocked > recordsChecked) {
        defects.push(
          `action_type_coverage_records_blocked_exceeds_checked:${actionType}`,
        );
      }
      if (preLivePassed + preLiveBlocked !== recordsChecked) {
        defects.push(
          `action_type_coverage_pre_live_records_total_mismatch:${actionType}`,
        );
      }
      if (item.executable_now_actions !== 0) {
        defects.push(
          `action_type_coverage_executable_now_nonzero:${actionType}`,
        );
      }
      if (item.execution_allowed_now !== false) {
        defects.push(
          `action_type_coverage_execution_allowed_now_open:${actionType}`,
        );
      }
      if (item.production_ready !== false) {
        defects.push(
          `action_type_coverage_production_ready_open:${actionType}`,
        );
      }
      if (actionType === "update_campaign_budget" && recordsChecked < 1) {
        defects.push("action_type_coverage_scale_candidate_missing");
      }
    }

    return defects;
  }

  private safetyActionVisibilityDefects(
    safetyVisibility: Record<string, unknown> | undefined,
    pauseSafetyRecords: number,
    monitorOnlyRecords: number,
    expectedSafetyRecords: number,
  ): string[] {
    if (!safetyVisibility || typeof safetyVisibility !== "object") {
      return [];
    }

    const defects: string[] = [];
    if (
      this.safeNumber(safetyVisibility.pause_safety_records_visible) !==
      pauseSafetyRecords
    ) {
      defects.push("safety_action_visibility_pause_count_mismatch");
    }
    if (
      this.safeNumber(safetyVisibility.monitor_only_safety_records_visible) !==
      monitorOnlyRecords
    ) {
      defects.push("safety_action_visibility_monitor_only_count_mismatch");
    }
    if (
      this.safeNumber(safetyVisibility.safety_action_records_visible) !==
      expectedSafetyRecords
    ) {
      defects.push("safety_action_visibility_total_count_mismatch");
    }

    return defects;
  }

  private supportedMvpActionDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
    supportedMvpActions: readonly string[],
  ): string[] {
    const defects: string[] = [];
    const present =
      Boolean(contract) &&
      Array.isArray(
        (contract as { supported_mvp_actions?: unknown }).supported_mvp_actions,
      );

    if (!present) {
      defects.push("execution_readiness_contract_supported_mvp_actions_absent");
    }

    defects.push(
      ...this.missingSupportedMvpActions(supportedMvpActions).map(
        (actionType) => `missing_supported_mvp_action:${actionType}`,
      ),
    );
    defects.push(
      ...this.unsupportedSupportedMvpActions(supportedMvpActions).map(
        (actionType) => `unsupported_supported_mvp_action:${actionType}`,
      ),
    );

    if (
      present &&
      this.missingSupportedMvpActions(supportedMvpActions).length === 0 &&
      this.unsupportedSupportedMvpActions(supportedMvpActions).length === 0 &&
      !this.supportedMvpActionsOrderMatchesExpected(supportedMvpActions)
    ) {
      defects.push("supported_mvp_actions_order_mismatch");
    }

    return this.unique(defects);
  }

  private requiredGateFamilyDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
    requiredGateFamilies: readonly string[],
  ): string[] {
    const defects: string[] = [];
    const present =
      Boolean(contract) &&
      Array.isArray(
        (contract as { required_gate_families?: unknown })
          .required_gate_families,
      );

    if (!present) {
      defects.push(
        "execution_readiness_contract_required_gate_families_absent",
      );
    }

    defects.push(
      ...this.missingRequiredGateFamilies(requiredGateFamilies).map(
        (family) => `missing_required_gate_family:${family}`,
      ),
    );
    defects.push(
      ...this.unsupportedRequiredGateFamilies(requiredGateFamilies).map(
        (family) => `unsupported_required_gate_family:${family}`,
      ),
    );

    if (
      present &&
      this.missingRequiredGateFamilies(requiredGateFamilies).length === 0 &&
      this.unsupportedRequiredGateFamilies(requiredGateFamilies).length === 0 &&
      !this.requiredGateFamiliesOrderMatchesExpected(requiredGateFamilies)
    ) {
      defects.push("required_gate_families_order_mismatch");
    }

    return this.unique(defects);
  }

  private mustHaveBeforeFutureLiveExecutionDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
    mustHaveBeforeFutureLiveExecution: readonly string[],
  ): string[] {
    const defects: string[] = [];
    const present =
      Boolean(contract) &&
      Array.isArray(
        (contract as { must_have_before_future_live_execution?: unknown })
          .must_have_before_future_live_execution,
      );

    if (!present) {
      defects.push(
        "execution_readiness_contract_must_have_before_future_live_execution_absent",
      );
    }

    defects.push(
      ...this.missingMustHaveBeforeFutureLiveExecution(
        mustHaveBeforeFutureLiveExecution,
      ).map((item) => `missing_must_have_before_future_live_execution:${item}`),
    );
    defects.push(
      ...this.unsupportedMustHaveBeforeFutureLiveExecution(
        mustHaveBeforeFutureLiveExecution,
      ).map(
        (item) => `unsupported_must_have_before_future_live_execution:${item}`,
      ),
    );

    if (
      present &&
      this.missingMustHaveBeforeFutureLiveExecution(
        mustHaveBeforeFutureLiveExecution,
      ).length === 0 &&
      this.unsupportedMustHaveBeforeFutureLiveExecution(
        mustHaveBeforeFutureLiveExecution,
      ).length === 0 &&
      !this.mustHaveBeforeFutureLiveExecutionOrderMatchesExpected(
        mustHaveBeforeFutureLiveExecution,
      )
    ) {
      defects.push("must_have_before_future_live_execution_order_mismatch");
    }

    return this.unique(defects);
  }

  private nonExecutionGuaranteePresent(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
  ): boolean {
    return Boolean(this.nonExecutionGuarantee(contract));
  }

  private executionReadinessNonExecutionGuaranteeDefectKeys(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
  ): string[] {
    const guarantee = this.nonExecutionGuarantee(contract);
    if (!guarantee) {
      return ["execution_readiness_contract_non_execution_guarantee_absent"];
    }

    const expectations = [
      {
        field: "executable_now_actions",
        expected: 0,
        mismatchDefect:
          "non_execution_guarantee_executable_now_actions_must_be_0",
      },
      {
        field: "provider_api_called",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_provider_api_called_must_be_false",
      },
      {
        field: "provider_api_used",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_provider_api_used_must_be_false",
      },
      {
        field: "google_ads_api_called",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_google_ads_api_called_must_be_false",
      },
      {
        field: "google_ads_api_used",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_google_ads_api_used_must_be_false",
      },
      {
        field: "validateOnly_called",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_validateOnly_called_must_be_false",
      },
      {
        field: "live_ads_execution_used",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_live_ads_execution_used_must_be_false",
      },
      {
        field: "execution_allowed_now",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_execution_allowed_now_must_be_false",
      },
      {
        field: "production_ready",
        expected: false,
        mismatchDefect:
          "non_execution_guarantee_production_ready_must_be_false",
      },
    ] as const;

    const defects = expectations.flatMap((expectation) => {
      if (!Object.prototype.hasOwnProperty.call(guarantee, expectation.field)) {
        return [`non_execution_guarantee_${expectation.field}_missing`];
      }
      return guarantee[expectation.field] === expectation.expected
        ? []
        : [expectation.mismatchDefect];
    });

    return this.unique(defects);
  }

  private nonExecutionGuarantee(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
  ): Record<string, unknown> | null {
    const guarantee = (contract as { non_execution_guarantee?: unknown } | null)
      ?.non_execution_guarantee;
    return guarantee &&
      typeof guarantee === "object" &&
      !Array.isArray(guarantee)
      ? (guarantee as Record<string, unknown>)
      : null;
  }

  private actionTypeCoverageLines(
    coverage: AdsAutomationExecutionPreflightActionTypeCoverage[],
  ): string[] {
    return coverage.map((item) =>
      [
        item.action_type,
        `checked=${item.records_checked}`,
        `blocked=${item.records_blocked}`,
        `pre_live_passed=${item.required_pre_live_gates_passed_records}`,
        `validateOnly_passed=${item.validateOnly_passed_records}`,
        `safety=${item.safety_action}`,
        "execution_allowed_now=false",
      ].join(":"),
    );
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return normalized.length ? normalized.join(", ") : "none";
  }

  private numericField(
    value: unknown,
    defectKey: string,
    defects: string[],
  ): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < 0) {
      defects.push(defectKey);
      return Number.NaN;
    }
    return numberValue;
  }

  private safeNumber(value: unknown): number {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized : null;
  }

  private sameStringList(
    left: readonly string[],
    right: readonly string[],
  ): boolean {
    return (
      left.length === right.length &&
      right.every((value, index) => left[index] === value)
    );
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
