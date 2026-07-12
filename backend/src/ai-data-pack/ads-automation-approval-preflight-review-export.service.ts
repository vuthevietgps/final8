import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  AdsAutomationApprovalPreflightActionReview,
  AdsAutomationApprovalPreflightExecutionReadinessContractReview,
  AdsAutomationApprovalPreflightGateBlockers,
  AdsAutomationApprovalPreflightGateFamilyKey,
  AdsAutomationApprovalPreflightGateFamilyReview,
  AdsAutomationApprovalPreflightGateStatuses,
  AdsAutomationApprovalPreflightMonitorOnlyActionInput,
  AdsAutomationApprovalPreflightPlatformEntityCoverageReview,
  AdsAutomationApprovalPreflightReviewExportInput,
  AdsAutomationApprovalPreflightReviewExportResponse,
  AdsAutomationApprovalPreflightReviewExportMode,
  AdsAutomationApprovalPreflightReviewSection,
  AdsAutomationApprovalPreflightReviewStatus,
} from "./contracts/ads-automation-approval-preflight-review-export.contract";
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
} from "./contracts/ads-automation-decision-draft-preview.contract";
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from "./contracts/ads-automation-decision-draft-approval.contract";
import type {
  AdsAutomationExecutionPreflightDryRunRecord,
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
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyMvpActionContract,
  AdsAutomationProviderValidateOnlyMvpActionContractReview,
} from "./contracts/ads-automation-provider-validate-only.contract";
import type {
  AdsAutomationPendingErpActionIdentifiers,
  AdsAutomationPlatformEntityCoverageActionBlocker,
} from "./contracts/ads-automation-pending-erp-action.contract";
import type {
  AdsAutomationReadonlyDecisionReadinessAnswers,
  AdsAutomationReadonlyDecisionReadinessCandidate,
  AdsAutomationReadonlyInventoryProfitCoverageRow,
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformMetricEntityCoverageRow,
  AdsAutomationReadonlyProductMappingCoverageRow,
  AdsAutomationReadonlySupplierSafetyCoverageRow,
} from "./contracts/ads-automation-readonly-platform-import-readiness.contract";

const GATE_FAMILIES: AdsAutomationApprovalPreflightGateFamilyKey[] = [
  "source_readiness",
  "campaignBudgetId",
  "finance_policy",
  "validateOnly",
  "approval",
  "audit_preflight",
  "idempotency",
  "kill_switch",
  "production_flag",
];

const PROVIDER_ACTIONS: AdsAutomationDecisionDraftActionType[] = [
  "update_campaign_budget",
  "pause_campaign",
  "pause_ad_group",
];

interface ActionSeed {
  approval?: AdsAutomationDecisionDraftPendingApprovalRecord;
  validationPlan?: AdsAutomationProviderValidateOnlyActionPlan;
  preflightRecord?: AdsAutomationExecutionPreflightDryRunRecord;
  approvalAudit?: AdsAutomationDecisionDraftApprovalDecisionAuditRecord;
  monitorOnlyAction?: AdsAutomationApprovalPreflightMonitorOnlyActionInput;
}

@Injectable()
export class AdsAutomationApprovalPreflightReviewExportService {
  build(
    input: AdsAutomationApprovalPreflightReviewExportInput,
  ): AdsAutomationApprovalPreflightReviewExportResponse {
    this.assertPayload(input);

    const generatedAt = this.dateTime(
      input.now || new Date(),
      "now",
    ).toISOString();
    const exportMode = input.exportMode || "local_payload";
    const reportDate = this.reportDate(input);
    const platformEntityCoverage =
      input.sourceReadinessReviewExport.platformEntityCoverage || null;
    const platformEntityCoverageBlockers = this.platformEntityCoverageBlockers(
      platformEntityCoverage,
    );
    const platformEntityCoverageReview = this.platformEntityCoverageReview(
      platformEntityCoverage,
    );
    const actionSeeds = this.actionSeeds(input);
    const duplicateIdempotencyKeys = this.duplicateIdempotencyKeys(actionSeeds);
    const actionReviews = actionSeeds.map((seed) =>
      this.actionReview(
        seed,
        input.sourceReadinessReviewExport,
        platformEntityCoverage,
        duplicateIdempotencyKeys,
      ),
    );
    const gateFamilyReview = this.gateFamilyReview(actionReviews);
    const safetyActions = actionReviews.filter(
      (action) => action.is_safety_action,
    );
    const scaleCandidates = actionReviews.filter(
      (action) => action.is_scale_candidate,
    );
    const sourceDecisionAnswerReview = this.sourceDecisionAnswerReview(
      input.sourceReadinessReviewExport,
    );
    const mvpActionContractReview = this.mvpActionContractReview(actionReviews);
    const executionReadinessContractReview =
      this.executionReadinessContractReview(
        input.executionPreflightDryRun?.executionReadinessContract || null,
      );
    const exportStatus = this.exportStatus(
      actionReviews,
      gateFamilyReview,
      executionReadinessContractReview,
    );
    const renderedSections = this.renderedSections({
      exportStatus,
      gateFamilyReview,
      actionReviews,
      safetyActions,
      platformEntityCoverage,
      platformEntityCoverageBlockers,
      platformEntityCoverageReview,
      sourceDecisionAnswerReview,
      mvpActionContractReview,
      executionReadinessContractReview,
    });

    return {
      schemaVersion: "ads_automation_approval_preflight_review_export.v1",
      generatedAt,
      exportMode,
      query: {
        reportDate,
        ...(input.fixtureName ? { fixture: input.fixtureName } : {}),
      },
      safety: this.safety(),
      summary: {
        export_status: exportStatus,
        export_mode: exportMode,
        reportDate,
        source_readiness_export_status:
          input.sourceReadinessReviewExport.summary.export_status,
        validateOnly_plans_received:
          input.validateOnlyLane.validationPlans.length,
        validateOnly_passed: input.validateOnlyLane.validationPlans.filter(
          (plan) => plan.status === "validate_only_passed",
        ).length,
        validateOnly_pending_or_blocked:
          input.validateOnlyLane.validationPlans.filter(
            (plan) => plan.status !== "validate_only_passed",
          ).length,
        pending_approvals_received: (input.pendingApprovals || []).length,
        execution_preflight_records_received:
          input.executionPreflightDryRun?.executionRecords.length || 0,
        approval_decision_audit_records_received: (
          input.approvalDecisionAuditRecords || []
        ).length,
        idempotency_duplicate_keys: duplicateIdempotencyKeys.length,
        action_reviews: actionReviews.length,
        scale_candidates_reviewed: scaleCandidates.length,
        scale_candidates_blocked: scaleCandidates.filter(
          (action) => action.status === "blocked",
        ).length,
        safety_actions_visible: safetyActions.length,
        monitor_only_actions_visible: safetyActions.filter(
          (action) => action.action_type === "monitor_only",
        ).length,
        provider_mvp_actions_requiring_validateOnly:
          mvpActionContractReview.provider_mvp_actions_requiring_validateOnly,
        monitor_only_mvp_safety_actions:
          mvpActionContractReview.monitor_only_mvp_safety_actions,
        out_of_scope_non_provider_actions:
          mvpActionContractReview.out_of_scope_non_provider_actions,
        platform_entity_blocker_count: platformEntityCoverageBlockers.length,
        scale_candidates_blocked_by_platform_entity_coverage:
          actionReviews.filter(
            (action) =>
              action.is_scale_candidate &&
              action.blockers.some((blocker) =>
                blocker.startsWith("platform_entity."),
              ),
          ).length,
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
        execution_readiness_missing_mvp_action_coverage:
          executionReadinessContractReview.missing_mvp_action_coverage.length,
        missing_mvp_action_coverage:
          executionReadinessContractReview.missing_mvp_action_coverage,
        execution_readiness_local_review_defect:
          executionReadinessContractReview.local_review_defect,
        gate_families_blocked: gateFamilyReview.filter(
          (gate) => gate.status === "blocked",
        ).length,
        executable_now: 0,
        future_live_execution_allowed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action:
          exportStatus === "empty"
            ? "provide_approval_preflight_evidence"
            : exportStatus === "blocked_before_future_execution"
              ? "fix_preflight_gate_blockers_before_future_execution"
              : "inspect_approval_preflight_review_export",
      },
      sourceDigest: {
        source_readiness_schema_version:
          input.sourceReadinessReviewExport.schemaVersion,
        validateOnly_lane_schema_version: input.validateOnlyLane.schemaVersion,
        execution_preflight_schema_version:
          input.executionPreflightDryRun?.schemaVersion || null,
        approval_ids: this.unique([
          ...(input.pendingApprovals || []).map(
            (approval) => approval.approval_id,
          ),
          ...input.validateOnlyLane.validationPlans.map(
            (plan) => plan.approval_id,
          ),
          ...(input.executionPreflightDryRun?.executionRecords || []).map(
            (record) => record.approval_id,
          ),
        ]),
        pending_action_ids: this.unique(
          input.validateOnlyLane.validationPlans.map(
            (plan) => plan.pending_action_id,
          ),
        ),
        validateOnly_validation_ids: this.unique(
          input.validateOnlyLane.validationPlans.map(
            (plan) => plan.validation_id,
          ),
        ),
        execution_record_ids: this.unique(
          (input.executionPreflightDryRun?.executionRecords || []).map(
            (record) => record.execution_record_id,
          ),
        ),
        approval_decision_audit_ids: this.unique(
          (input.approvalDecisionAuditRecords || []).map(
            (audit) => audit.audit_id,
          ),
        ),
        policy_decision_ids: this.unique(
          (input.executionPreflightDryRun?.executionRecords || []).map(
            (record) => record.policy_decision_id || "",
          ),
        ),
        duplicate_idempotency_keys: duplicateIdempotencyKeys,
        campaignBudgetId_no_fallback: true,
        execution_readiness_contract_schema_version:
          executionReadinessContractReview.source_schema_version,
        execution_readiness_supported_mvp_actions:
          executionReadinessContractReview.supported_mvp_actions,
        execution_readiness_expected_supported_mvp_actions:
          executionReadinessContractReview.expected_supported_mvp_actions,
        execution_readiness_supported_mvp_action_defects:
          this.supportedMvpActionDefects(
            executionReadinessContractReview.local_review_defect_keys,
          ),
        execution_readiness_required_gate_families:
          executionReadinessContractReview.required_gate_families,
        execution_readiness_expected_required_gate_families:
          executionReadinessContractReview.expected_required_gate_families,
        execution_readiness_required_gate_family_defects:
          this.requiredGateFamilyDefects(
            executionReadinessContractReview.local_review_defect_keys,
          ),
        execution_readiness_must_have_before_future_live_execution:
          executionReadinessContractReview.must_have_before_future_live_execution,
        execution_readiness_expected_must_have_before_future_live_execution:
          executionReadinessContractReview.expected_must_have_before_future_live_execution,
        execution_readiness_must_have_before_future_live_execution_defects:
          this.mustHaveBeforeFutureLiveExecutionDefects(
            executionReadinessContractReview.local_review_defect_keys,
          ),
        execution_readiness_non_execution_guarantee_defects:
          this.nonExecutionGuaranteeDefects(
            executionReadinessContractReview.local_review_defect_keys,
          ),
        execution_readiness_missing_mvp_action_coverage:
          executionReadinessContractReview.missing_mvp_action_coverage,
        platformEntityCoverageBlockers,
        sourceDecisionAnswerReview,
      },
      sourceDecisionAnswerReview,
      gateFamilyReview,
      actionReviews,
      safetyActionReview: {
        pause_or_reduce_actions_visible: safetyActions.filter(
          (action) =>
            action.action_type === "pause_campaign" ||
            action.action_type === "pause_ad_group",
        ).length,
        monitor_only_actions_visible: safetyActions.filter(
          (action) => action.action_type === "monitor_only",
        ).length,
        actions: safetyActions,
      },
      mvpActionContractReview,
      platformEntityCoverageReview,
      executionReadinessContractReview,
      renderedSections,
      markdownPreview: this.markdownPreview({
        reportDate,
        exportStatus,
        gateFamilyReview,
        actionReviews,
        safetyActions,
        platformEntityCoverage,
        platformEntityCoverageBlockers,
        platformEntityCoverageReview,
        sourceDecisionAnswerReview,
        mvpActionContractReview,
        executionReadinessContractReview,
      }),
      sourceReadinessReviewExport: input.sourceReadinessReviewExport,
      validateOnlyLane: input.validateOnlyLane,
      executionPreflightDryRun: input.executionPreflightDryRun || null,
    };
  }

  private assertPayload(
    input: AdsAutomationApprovalPreflightReviewExportInput,
  ): void {
    if (!input || typeof input !== "object") {
      throw new BadRequestException(
        "approval preflight review payload is required",
      );
    }
    if (
      !input.sourceReadinessReviewExport ||
      input.sourceReadinessReviewExport.schemaVersion !==
        "ads_automation_source_readiness_review_export.v1"
    ) {
      throw new BadRequestException(
        "sourceReadinessReviewExport must be ads_automation_source_readiness_review_export.v1",
      );
    }
    if (
      !input.validateOnlyLane ||
      input.validateOnlyLane.schemaVersion !==
        "ads_automation_provider_validate_only_lane.v1" ||
      !Array.isArray(input.validateOnlyLane.validationPlans)
    ) {
      throw new BadRequestException(
        "validateOnlyLane must be ads_automation_provider_validate_only_lane.v1",
      );
    }
    if (
      input.pendingApprovals !== undefined &&
      !Array.isArray(input.pendingApprovals)
    ) {
      throw new BadRequestException("pendingApprovals must be an array");
    }
    if (
      input.approvalDecisionAuditRecords !== undefined &&
      !Array.isArray(input.approvalDecisionAuditRecords)
    ) {
      throw new BadRequestException(
        "approvalDecisionAuditRecords must be an array",
      );
    }
    if (
      input.executionPreflightDryRun &&
      input.executionPreflightDryRun.schemaVersion !==
        "ads_automation_execution_preflight_dry_run.v1"
    ) {
      throw new BadRequestException(
        "executionPreflightDryRun must be ads_automation_execution_preflight_dry_run.v1",
      );
    }
    if (
      input.monitorOnlyActions !== undefined &&
      !Array.isArray(input.monitorOnlyActions)
    ) {
      throw new BadRequestException("monitorOnlyActions must be an array");
    }
  }

  private reportDate(
    input: AdsAutomationApprovalPreflightReviewExportInput,
  ): string {
    const value =
      input.reportDate || input.sourceReadinessReviewExport.query.reportDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
      throw new BadRequestException("reportDate must use YYYY-MM-DD");
    }
    return String(value);
  }

  private actionSeeds(
    input: AdsAutomationApprovalPreflightReviewExportInput,
  ): ActionSeed[] {
    const seedsByKey = new Map<string, ActionSeed>();
    const merge = (key: string | null, patch: ActionSeed) => {
      const normalizedKey = this.text(key) || this.fallbackSeedKey(patch);
      const current = seedsByKey.get(normalizedKey) || {};
      seedsByKey.set(normalizedKey, { ...current, ...patch });
    };

    for (const approval of input.pendingApprovals || []) {
      merge(approval.approval_id, { approval });
    }
    for (const validationPlan of input.validateOnlyLane.validationPlans) {
      merge(validationPlan.approval_id || validationPlan.pending_action_id, {
        validationPlan,
      });
    }
    for (const preflightRecord of input.executionPreflightDryRun
      ?.executionRecords || []) {
      merge(preflightRecord.approval_id, { preflightRecord });
    }
    for (const approvalAudit of input.approvalDecisionAuditRecords || []) {
      merge(approvalAudit.approval_id, { approvalAudit });
    }
    for (const monitorOnlyAction of input.monitorOnlyActions || []) {
      merge(monitorOnlyAction.approval_id || monitorOnlyAction.action_id, {
        monitorOnlyAction,
      });
    }

    return [...seedsByKey.values()];
  }

  private fallbackSeedKey(seed: ActionSeed): string {
    return [
      seed.approval?.approval_id,
      seed.validationPlan?.approval_id,
      seed.validationPlan?.pending_action_id,
      seed.preflightRecord?.approval_id,
      seed.preflightRecord?.execution_record_id,
      seed.approvalAudit?.approval_id,
      seed.monitorOnlyAction?.action_id,
      "unknown-action",
    ]
      .map((value) => this.text(value))
      .find(Boolean)!;
  }

  private actionReview(
    seed: ActionSeed,
    sourceReadiness: AdsAutomationApprovalPreflightReviewExportInput["sourceReadinessReviewExport"],
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
    duplicateIdempotencyKeys: string[],
  ): AdsAutomationApprovalPreflightActionReview {
    const actionType = this.actionType(seed);
    const actionFamily = this.actionFamily(seed);
    const provider = this.provider(seed);
    const approvalId = this.text(
      seed.approval?.approval_id ||
        seed.validationPlan?.approval_id ||
        seed.preflightRecord?.approval_id ||
        seed.approvalAudit?.approval_id ||
        seed.monitorOnlyAction?.approval_id,
    );
    const pendingActionId = this.text(seed.validationPlan?.pending_action_id);
    const preflightRecord = seed.preflightRecord || null;
    const validationPlan = seed.validationPlan || null;
    const pendingApproval = seed.approval || null;
    const isProviderAction = PROVIDER_ACTIONS.includes(actionType);
    const isScaleCandidate = actionType === "update_campaign_budget";
    const isSafetyAction =
      actionType === "pause_campaign" ||
      actionType === "pause_ad_group" ||
      actionType === "monitor_only";
    const campaignBudgetId = this.campaignBudgetId(seed, actionType);
    const identifiers = this.actionIdentifiers(seed, campaignBudgetId);
    const platformEntityCoverageActionBlockers = isScaleCandidate
      ? this.platformEntityCoverageActionBlockers(
          platformEntityCoverage,
          identifiers,
        )
      : [];
    const idempotencyKey = this.idempotencyKey(seed);
    const gateBlockers = this.gateBlockers({
      seed,
      sourceReadiness,
      platformEntityCoverageActionBlockers,
      actionType,
      isProviderAction,
      isScaleCandidate,
      campaignBudgetId,
      idempotencyKey,
      duplicateIdempotencyKeys,
    });
    const gateStatuses = this.gateStatuses(gateBlockers, actionType);
    const blockers = this.unique(
      GATE_FAMILIES.flatMap((family) => gateBlockers[family]),
    );
    const status = this.actionStatus({
      actionType,
      isSafetyAction,
      blockers,
    });
    const mvpActionContract = this.mvpActionContract(
      seed,
      actionType,
      isProviderAction,
    );

    return {
      action_id:
        approvalId ||
        pendingActionId ||
        this.text(preflightRecord?.execution_record_id) ||
        this.text(seed.monitorOnlyAction?.action_id) ||
        "unknown-action",
      approval_id: approvalId,
      pending_action_id: pendingActionId,
      action_type: actionType,
      action_family: actionFamily,
      provider,
      entity_id: this.text(
        pendingApproval?.entity_id ||
          validationPlan?.entity_id ||
          preflightRecord?.entity_id ||
          seed.monitorOnlyAction?.entity_id,
      ),
      accountId: this.text(
        pendingApproval?.accountId ||
          preflightRecord?.accountId ||
          validationPlan?.customerId ||
          seed.monitorOnlyAction?.accountId,
      ),
      campaignId: this.text(identifiers.campaignId),
      adGroupId: this.text(identifiers.adGroupId),
      campaignBudgetId,
      productId: identifiers.productId,
      supplierId: identifiers.supplierId,
      is_scale_candidate: isScaleCandidate,
      is_safety_action: isSafetyAction,
      status,
      gateStatuses,
      gateBlockers,
      platform_entity_coverage_action_blockers: this.cloneJson(
        platformEntityCoverageActionBlockers,
      ),
      blockers,
      mvp_action_contract: mvpActionContract,
      mvp_action_contract_evidence:
        this.mvpActionContractEvidence(mvpActionContract),
      evidenceIds: {
        approval_id: approvalId,
        pending_action_id: pendingActionId,
        validation_id: this.text(validationPlan?.validation_id),
        execution_record_id: this.text(preflightRecord?.execution_record_id),
        approval_decision_audit_id: this.text(seed.approvalAudit?.audit_id),
        policy_decision_id: this.text(preflightRecord?.policy_decision_id),
      },
      rollback_plan: this.rollbackPlan(seed),
      idempotency_key: idempotencyKey,
      idempotency_safe: this.safeIdempotencyKey(idempotencyKey),
      idempotency_duplicate: Boolean(
        idempotencyKey && duplicateIdempotencyKeys.includes(idempotencyKey),
      ),
      approval_status:
        pendingApproval?.status || preflightRecord?.approval_status || null,
      validateOnly_status:
        validationPlan?.status || preflightRecord?.validateOnly_status || null,
      preflight_status: preflightRecord?.preflight_status || null,
      policy_allowed: preflightRecord ? preflightRecord.policy_allowed : null,
      source_readiness_safe: preflightRecord
        ? preflightRecord.source_readiness_safe
        : null,
      kill_switch_active: preflightRecord
        ? preflightRecord.kill_switch_active
        : null,
      google_ads_production_enabled: preflightRecord
        ? preflightRecord.google_ads_production_enabled
        : null,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private gateBlockers(input: {
    seed: ActionSeed;
    sourceReadiness: AdsAutomationApprovalPreflightReviewExportInput["sourceReadinessReviewExport"];
    platformEntityCoverageActionBlockers: AdsAutomationPlatformEntityCoverageActionBlocker[];
    actionType: AdsAutomationDecisionDraftActionType;
    isProviderAction: boolean;
    isScaleCandidate: boolean;
    campaignBudgetId: string | null;
    idempotencyKey: string | null;
    duplicateIdempotencyKeys: string[];
  }): AdsAutomationApprovalPreflightGateBlockers {
    const blockers = this.emptyGateBlockers();
    const approval = input.seed.approval || null;
    const plan = input.seed.validationPlan || null;
    const preflight = input.seed.preflightRecord || null;
    const platformEntityCoverageBlockers = this.unique(
      input.platformEntityCoverageActionBlockers.map(
        (blocker) => blocker.blocker,
      ),
    );

    if (input.actionType === "monitor_only") {
      return blockers;
    }

    blockers.source_readiness.push(
      ...this.sourceReadinessBlockers(approval, input.actionType),
      ...this.preflightBlockers(preflight, "source_readiness"),
    );
    if (input.isScaleCandidate) {
      blockers.source_readiness.push(
        ...this.platformSourceReadinessBlockers(platformEntityCoverageBlockers),
      );
    }
    if (
      input.isScaleCandidate &&
      input.sourceReadiness.summary.export_status !== "ready_for_review"
    ) {
      blockers.source_readiness.push("source_readiness_review_not_ready");
    }

    if (input.isScaleCandidate) {
      if (!input.campaignBudgetId) {
        blockers.campaignBudgetId.push("campaignBudgetId_missing_no_fallback");
      }
      if (input.sourceReadiness.summary.campaignBudgetId_missing_rows > 0) {
        blockers.campaignBudgetId.push(
          "campaignBudgetId_missing_in_source_readiness_review",
        );
      }
      blockers.campaignBudgetId.push(
        ...this.platformCampaignBudgetBlockers(platformEntityCoverageBlockers),
      );
    }
    blockers.campaignBudgetId.push(
      ...this.preflightBlockers(preflight, "campaignBudgetId"),
    );

    blockers.finance_policy.push(
      ...this.preflightBlockers(preflight, "policy"),
      ...this.financeBlockers(approval),
    );
    if (input.isScaleCandidate) {
      blockers.finance_policy.push(
        ...this.platformFinancePolicyBlockers(platformEntityCoverageBlockers),
      );
    }
    if (preflight && preflight.policy_allowed !== true) {
      blockers.finance_policy.push("policy_allowed");
    }
    if (!preflight && input.isProviderAction) {
      blockers.finance_policy.push("policy_decision_missing");
    }
    if (
      input.isScaleCandidate &&
      input.sourceReadiness.summary.cashflow_first_scale_mode === "monitor_only"
    ) {
      blockers.finance_policy.push("cashflow_first_scale_mode_monitor_only");
    }

    if (input.isProviderAction) {
      if (!plan) {
        blockers.validateOnly.push("validateOnly_plan_missing");
      } else if (
        plan.status !== "validate_only_passed" ||
        plan.providerValidationStatus !== "provider_validate_passed" ||
        plan.approval_can_be_considered_executable !== true
      ) {
        blockers.validateOnly.push(`validateOnly_not_passed:${plan.status}`);
      }
      blockers.validateOnly.push(
        ...this.arrayText(plan?.blockers).map(
          (blocker) => `validateOnly.${blocker}`,
        ),
        ...this.preflightBlockers(preflight, "validateOnly"),
      );
    }

    if (input.isProviderAction) {
      if (!approval) {
        blockers.approval.push("approval_record_missing");
      } else if (approval.status !== "approved") {
        blockers.approval.push(`approval_not_approved:${approval.status}`);
      }
      blockers.approval.push(
        ...this.arrayText(approval?.blockers).map(
          (blocker) => `approval.${blocker}`,
        ),
        ...this.arrayText(approval?.missing_data_blockers).map(
          (blocker) => `approval.${blocker}`,
        ),
        ...this.preflightBlockers(preflight, "approved_action"),
        ...this.preflightBlockers(preflight, "approval_has_no_blockers"),
      );
    }

    if (input.isProviderAction) {
      if (!input.seed.approvalAudit) {
        blockers.audit_preflight.push("approval_decision_audit_missing");
      }
      if (!preflight) {
        blockers.audit_preflight.push("execution_preflight_missing");
      } else if (
        preflight.preflight_status === "blocked_before_future_live_execution" &&
        !this.preflightBlockedOnlyByProductionFlag(preflight)
      ) {
        blockers.audit_preflight.push("execution_preflight_blocked");
      }
      blockers.audit_preflight.push(
        ...this.closedExecutionPathBlockers(preflight),
        ...this.preflightBlockers(preflight, "approval_decision_audit"),
      );
    }

    if (input.isProviderAction) {
      if (!this.safeIdempotencyKey(input.idempotencyKey)) {
        blockers.idempotency.push("idempotency_key_unsafe_or_missing");
      }
      if (
        input.idempotencyKey &&
        input.duplicateIdempotencyKeys.includes(input.idempotencyKey)
      ) {
        blockers.idempotency.push("idempotency_key_duplicate");
      }
      blockers.idempotency.push(
        ...this.preflightBlockers(preflight, "idempotency"),
      );
    }

    if (preflight?.kill_switch_active === true) {
      blockers.kill_switch.push("kill_switch_active");
    }
    blockers.kill_switch.push(
      ...this.preflightBlockers(preflight, "kill_switch"),
    );

    if (input.isProviderAction) {
      if (!preflight || preflight.google_ads_production_enabled !== true) {
        blockers.production_flag.push(
          "GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent",
        );
      }
      blockers.production_flag.push(
        ...this.preflightBlockers(preflight, "GOOGLE_ADS_PRODUCTION_ENABLED"),
      );
    }

    for (const family of GATE_FAMILIES) {
      blockers[family] = this.unique(blockers[family]);
    }

    return blockers;
  }

  private gateStatuses(
    blockers: AdsAutomationApprovalPreflightGateBlockers,
    actionType: AdsAutomationDecisionDraftActionType,
  ): AdsAutomationApprovalPreflightGateStatuses {
    return GATE_FAMILIES.reduce((acc, family) => {
      acc[family] =
        actionType === "monitor_only"
          ? "not_applicable"
          : blockers[family].length
            ? "blocked"
            : "passed";
      return acc;
    }, {} as AdsAutomationApprovalPreflightGateStatuses);
  }

  private gateFamilyReview(
    actionReviews: AdsAutomationApprovalPreflightActionReview[],
  ): AdsAutomationApprovalPreflightGateFamilyReview[] {
    return GATE_FAMILIES.map((family) => {
      const relevantActions = actionReviews.filter(
        (action) => action.gateStatuses[family] !== "not_applicable",
      );
      const blockedActions = relevantActions.filter(
        (action) => action.gateStatuses[family] === "blocked",
      );

      return {
        key: family,
        status: blockedActions.length
          ? "blocked"
          : relevantActions.length
            ? "passed"
            : "not_applicable",
        blocked_action_count: blockedActions.length,
        passed_action_count: relevantActions.filter(
          (action) => action.gateStatuses[family] === "passed",
        ).length,
        blockers: this.unique(
          blockedActions.flatMap((action) => action.gateBlockers[family]),
        ),
        evidence_record_ids: this.unique(
          blockedActions.flatMap((action) => [
            action.evidenceIds.approval_id || "",
            action.evidenceIds.validation_id || "",
            action.evidenceIds.execution_record_id || "",
            action.evidenceIds.approval_decision_audit_id || "",
          ]),
        ),
      };
    });
  }

  private mvpActionContractReview(
    actionReviews: AdsAutomationApprovalPreflightActionReview[],
  ): AdsAutomationProviderValidateOnlyMvpActionContractReview {
    const actionContracts = actionReviews.map((action) => ({
      source:
        action.action_type === "monitor_only" && !action.pending_action_id
          ? ("monitor_only_action" as const)
          : ("validateOnly_lane" as const),
      action_id: action.action_id,
      pending_action_id: action.pending_action_id,
      approval_id: action.approval_id,
      action_type: action.action_type,
      provider: action.provider,
      mvp_action_contract: action.mvp_action_contract,
      evidence: [...action.mvp_action_contract_evidence],
    }));

    return {
      provider_mvp_actions_requiring_validateOnly: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "provider_validateOnly_required",
      ).length,
      monitor_only_mvp_safety_actions: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "monitor_only_safety_action",
      ).length,
      out_of_scope_non_provider_actions: actionContracts.filter(
        (item) =>
          item.mvp_action_contract.action_scope ===
          "out_of_scope_non_provider_action",
      ).length,
      supported_mvp_actions: actionContracts.filter(
        (item) => item.mvp_action_contract.supported_mvp_action,
      ).length,
      unsupported_mvp_actions: actionContracts.filter(
        (item) => !item.mvp_action_contract.supported_mvp_action,
      ).length,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      action_contracts: actionContracts,
    };
  }

  private renderedSections(input: {
    exportStatus: AdsAutomationApprovalPreflightReviewStatus;
    gateFamilyReview: AdsAutomationApprovalPreflightGateFamilyReview[];
    actionReviews: AdsAutomationApprovalPreflightActionReview[];
    safetyActions: AdsAutomationApprovalPreflightActionReview[];
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage | null;
    platformEntityCoverageBlockers: string[];
    platformEntityCoverageReview: AdsAutomationApprovalPreflightPlatformEntityCoverageReview | null;
    sourceDecisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
    mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
    executionReadinessContractReview: AdsAutomationApprovalPreflightExecutionReadinessContractReview;
  }): AdsAutomationApprovalPreflightReviewSection[] {
    const blockedScale = input.actionReviews.filter(
      (action) => action.is_scale_candidate && action.status === "blocked",
    );
    const platformEntityCoverageReviewLines = input.platformEntityCoverageReview
      ? this.platformEntityCoverageReviewLines(
          input.platformEntityCoverageReview,
        )
      : [];

    return [
      {
        section_id: "gate_summary",
        title: "Gate Summary",
        status: input.gateFamilyReview.some((gate) => gate.status === "blocked")
          ? "attention"
          : input.actionReviews.length
            ? "passed"
            : "empty",
        lines: input.gateFamilyReview.map((gate) =>
          [
            `${gate.key}: ${gate.status}`,
            `blocked_actions=${gate.blocked_action_count}`,
            `blockers=${this.joinOrNone(gate.blockers)}`,
          ].join(", "),
        ),
        evidence_record_ids: this.unique(
          input.gateFamilyReview.flatMap((gate) => gate.evidence_record_ids),
        ),
      },
      {
        section_id: "platform_entity_coverage_gates",
        title: "Platform Entity Coverage Gates",
        status: input.platformEntityCoverageBlockers.length
          ? "attention"
          : input.platformEntityCoverage
            ? "passed"
            : "empty",
        lines: input.platformEntityCoverage
          ? [
              [
                `campaigns=${input.platformEntityCoverage.campaigns.coveredCampaignCount}`,
                `adGroups=${input.platformEntityCoverage.adGroups.coveredAdGroupCount}`,
                `campaignBudgetIdMissingRows=${input.platformEntityCoverage.campaignBudgets.missingCampaignBudgetIdRows}`,
              ].join(", "),
              [
                `mappedProducts=${this.joinOrNone(input.platformEntityCoverage.productMapping.mappedProductIds)}`,
                `unmappedAdGroups=${this.joinOrNone(input.platformEntityCoverage.productMapping.unmappedAdGroupIds)}`,
                `inventorySourceReady=${input.platformEntityCoverage.inventoryProfit.sourceReady}`,
                `supplierSourceReady=${input.platformEntityCoverage.supplierContext.sourceReady}`,
              ].join(", "),
              `platform_entity_blockers=${this.joinOrNone(input.platformEntityCoverageBlockers)}`,
              `action_scoped_platform_entity_blockers=${this.joinOrNone(
                input.actionReviews.flatMap((action) =>
                  action.platform_entity_coverage_action_blockers.map(
                    (blocker) =>
                      `${action.action_id}:${blocker.scope}:${blocker.blocker}`,
                  ),
                ),
              )}`,
              `scale_candidates_blocked_by_platform_entity_coverage=${
                input.actionReviews.filter(
                  (action) =>
                    action.is_scale_candidate &&
                    action.blockers.some((blocker) =>
                      blocker.startsWith("platform_entity."),
                    ),
                ).length
              }`,
            ]
          : ["No platform entity coverage evidence was provided."],
        evidence_record_ids: input.platformEntityCoverage
          ? this.unique([
              ...input.platformEntityCoverage.campaigns.campaignIds,
              ...input.platformEntityCoverage.adGroups.adGroupIds,
              ...input.platformEntityCoverage.campaignBudgets.campaignBudgetIds,
              ...input.platformEntityCoverage.productMapping.mappedProductIds,
              ...input.platformEntityCoverage.productMapping.unmappedAdGroupIds,
              ...input.platformEntityCoverage.inventoryProfit.blockedProductIds,
              ...input.platformEntityCoverage.supplierContext
                .blockedSupplierIds,
            ])
          : [],
      },
      {
        section_id: "platform_entity_coverage_review",
        title: "Platform Entity Coverage Review",
        status: platformEntityCoverageReviewLines.length
          ? input.platformEntityCoverageBlockers.length
            ? "attention"
            : "ready_for_review"
          : "empty",
        lines: platformEntityCoverageReviewLines.length
          ? platformEntityCoverageReviewLines
          : ["No per-entity platform coverage rows were provided."],
        evidence_record_ids: input.platformEntityCoverage
          ? this.unique([
              ...input.platformEntityCoverage.campaigns.campaignIds,
              ...input.platformEntityCoverage.adGroups.adGroupIds,
              ...input.platformEntityCoverage.campaignBudgets.campaignBudgetIds,
              ...input.platformEntityCoverage.productMapping.mappedProductIds,
              ...input.platformEntityCoverage.productMapping.unmappedAdGroupIds,
              ...input.platformEntityCoverage.inventoryProfit
                .profitableProductIds,
              ...input.platformEntityCoverage.inventoryProfit.blockedProductIds,
              ...input.platformEntityCoverage.supplierContext.safeSupplierIds,
              ...input.platformEntityCoverage.supplierContext
                .blockedSupplierIds,
            ])
          : [],
      },
      {
        section_id: "execution_readiness_contract",
        title: "Execution Readiness Contract",
        status: input.executionReadinessContractReview.local_review_defect
          ? "attention"
          : input.executionReadinessContractReview.contract_present
            ? input.executionReadinessContractReview.missing_must_have_items
                .length
              ? "attention"
              : "ready_for_review"
            : "empty",
        lines: this.executionReadinessContractLines(
          input.executionReadinessContractReview,
        ),
        evidence_record_ids: [],
      },
      {
        section_id: "mvp_action_contract",
        title: "MVP Action Contract",
        status: input.mvpActionContractReview.action_contracts.length
          ? "ready_for_review"
          : "empty",
        lines: input.mvpActionContractReview.action_contracts.length
          ? input.mvpActionContractReview.action_contracts.map((item) =>
              [
                `${item.action_type}: ${item.action_id}`,
                `scope=${item.mvp_action_contract.action_scope}`,
                `preflight_treatment=${item.mvp_action_contract.preflight_treatment}`,
                `future_erp_provider_validateOnly_required=${item.mvp_action_contract.provider_validateOnly_required_before_future_execution}`,
                `visible_as_safety_action=${item.mvp_action_contract.visible_as_safety_action}`,
                `execution_allowed_now=${item.mvp_action_contract.execution_allowed_now}`,
              ].join(", "),
            )
          : ["No MVP action contract evidence was provided."],
        evidence_record_ids: this.unique(
          input.mvpActionContractReview.action_contracts.flatMap((item) => [
            item.approval_id || "",
            item.pending_action_id || "",
          ]),
        ),
      },
      {
        section_id: "source_decision_answers",
        title: "Source Decision Answers",
        status: input.sourceDecisionAnswerReview.blocking_reasons.length
          ? "attention"
          : input.sourceDecisionAnswerReview.may_increase_ads ||
              input.sourceDecisionAnswerReview
                .campaign_or_ad_group_pause_recommended ||
              input.sourceDecisionAnswerReview
                .product_kill_or_stop_review_needed
            ? "ready_for_review"
            : "empty",
        lines: this.decisionAnswerLines(input.sourceDecisionAnswerReview),
        evidence_record_ids: this.unique(
          [
            ...input.sourceDecisionAnswerReview.ad_groups_to_increase,
            ...input.sourceDecisionAnswerReview.products_can_receive_budget,
            ...input.sourceDecisionAnswerReview
              .blocked_product_budget_candidates,
            ...input.sourceDecisionAnswerReview.safe_supplier_choices,
            ...input.sourceDecisionAnswerReview.blocked_supplier_choices,
            ...input.sourceDecisionAnswerReview.product_kill_or_stop_review,
            ...input.sourceDecisionAnswerReview.campaign_or_ad_group_pause,
          ].map((candidate) => candidate.entityId),
        ),
      },
      {
        section_id: "blocked_scale_candidates",
        title: "Blocked Scale Candidates",
        status: blockedScale.length ? "attention" : "empty",
        lines: blockedScale.length
          ? blockedScale.map((action) =>
              [
                `${action.action_id}: blocked`,
                `campaignBudgetId=${action.campaignBudgetId || "missing"}`,
                `blockers=${this.joinOrNone(action.blockers)}`,
              ].join(", "),
            )
          : ["No blocked scale candidate was provided."],
        evidence_record_ids: blockedScale.map(
          (action) => action.evidenceIds.approval_id || action.action_id,
        ),
      },
      {
        section_id: "safety_actions",
        title: "Safety Actions",
        status: input.safetyActions.length ? "ready_for_review" : "empty",
        lines: input.safetyActions.length
          ? input.safetyActions.map((action) =>
              [
                `${action.action_type}: ${action.action_id}`,
                `status=${action.status}`,
                `blockers=${this.joinOrNone(action.blockers)}`,
              ].join(", "),
            )
          : ["No pause, reduce, or monitor-only safety action was provided."],
        evidence_record_ids: input.safetyActions.map(
          (action) => action.evidenceIds.approval_id || action.action_id,
        ),
      },
      {
        section_id: "audit_idempotency",
        title: "Audit And Idempotency",
        status: input.actionReviews.some(
          (action) =>
            action.gateStatuses.audit_preflight === "blocked" ||
            action.gateStatuses.idempotency === "blocked",
        )
          ? "attention"
          : input.actionReviews.length
            ? "passed"
            : "empty",
        lines: input.actionReviews.map((action) =>
          [
            `${action.action_id}`,
            `audit=${action.evidenceIds.approval_decision_audit_id || "missing"}`,
            `preflight=${action.evidenceIds.execution_record_id || "missing"}`,
            `idempotency_safe=${action.idempotency_safe}`,
            `idempotency_duplicate=${action.idempotency_duplicate}`,
          ].join(", "),
        ),
        evidence_record_ids: this.unique(
          input.actionReviews.flatMap((action) => [
            action.evidenceIds.approval_decision_audit_id || "",
            action.evidenceIds.execution_record_id || "",
          ]),
        ),
      },
      {
        section_id: "closed_execution_flags",
        title: "Closed Execution Flags",
        status: "passed",
        lines: [
          `export_status=${input.exportStatus}`,
          "provider_api_called=false",
          "google_ads_api_called=false",
          "validateOnly_called=false",
          "live_ads_execution_used=false",
          "future_live_execution_allowed=false",
          "execution_allowed_now=false",
          "production_ready=false",
        ],
        evidence_record_ids: [],
      },
    ];
  }

  private markdownPreview(input: {
    reportDate: string;
    exportStatus: AdsAutomationApprovalPreflightReviewStatus;
    gateFamilyReview: AdsAutomationApprovalPreflightGateFamilyReview[];
    actionReviews: AdsAutomationApprovalPreflightActionReview[];
    safetyActions: AdsAutomationApprovalPreflightActionReview[];
    platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage | null;
    platformEntityCoverageBlockers: string[];
    platformEntityCoverageReview: AdsAutomationApprovalPreflightPlatformEntityCoverageReview | null;
    sourceDecisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
    mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
    executionReadinessContractReview: AdsAutomationApprovalPreflightExecutionReadinessContractReview;
  }): string {
    const scaleBlockedByPlatformEntityCoverage = input.actionReviews.filter(
      (action) =>
        action.is_scale_candidate &&
        action.blockers.some((blocker) =>
          blocker.startsWith("platform_entity."),
        ),
    ).length;
    const platformEntityCoverageReviewLines = input.platformEntityCoverageReview
      ? this.platformEntityCoverageReviewLines(
          input.platformEntityCoverageReview,
        )
      : [];

    return [
      "# Ads Automation Approval Preflight Review Export",
      `Report date: ${input.reportDate}`,
      `Export status: ${input.exportStatus}`,
      `Action reviews: ${input.actionReviews.length}`,
      `Scale candidates blocked: ${input.actionReviews.filter((action) => action.is_scale_candidate && action.status === "blocked").length}`,
      `Safety actions visible: ${input.safetyActions.length}`,
      `Gate families blocked: ${
        input.gateFamilyReview
          .filter((gate) => gate.status === "blocked")
          .map((gate) => gate.key)
          .join(", ") || "none"
      }`,
      `Monitor-only actions: ${input.safetyActions.filter((action) => action.action_type === "monitor_only").length}`,
      `MVP provider actions requiring future ERP validateOnly: ${input.mvpActionContractReview.provider_mvp_actions_requiring_validateOnly}`,
      `MVP monitor-only visible safety actions: ${input.mvpActionContractReview.monitor_only_mvp_safety_actions}`,
      `Non-MVP internal actions out of scope: ${input.mvpActionContractReview.out_of_scope_non_provider_actions}`,
      `MVP contract scopes: ${this.joinOrNone(input.mvpActionContractReview.action_contracts.map((item) => `${item.action_type}=${item.mvp_action_contract.action_scope}`))}`,
      `Platform entity coverage present: ${Boolean(input.platformEntityCoverage)}`,
      `Platform entity blockers: ${this.joinOrNone(input.platformEntityCoverageBlockers)}`,
      `Action-scoped platform entity blockers: ${this.joinOrNone(
        input.actionReviews.flatMap((action) =>
          action.platform_entity_coverage_action_blockers.map(
            (blocker) =>
              `${action.action_id}:${blocker.scope}:${blocker.blocker}`,
          ),
        ),
      )}`,
      `Scale candidates blocked by platform entity coverage: ${scaleBlockedByPlatformEntityCoverage}`,
      "Platform entity row review:",
      ...(platformEntityCoverageReviewLines.length
        ? platformEntityCoverageReviewLines.map((line) => `- ${line}`)
        : ["- none"]),
      "Execution readiness contract:",
      ...this.executionReadinessContractLines(
        input.executionReadinessContractReview,
      ).map((line) => `- ${line}`),
      ...this.decisionAnswerLines(input.sourceDecisionAnswerReview),
      "Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false",
      "Live execution remains blocked; this export is review/read-model evidence only.",
    ].join("\n");
  }

  private executionReadinessContractReview(
    contract: AdsAutomationExecutionPreflightReadinessContract | null,
  ): AdsAutomationApprovalPreflightExecutionReadinessContractReview {
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
    const localReviewDefectKeys = this.executionReadinessLocalReviewDefectKeys(
      contract,
      actionTypeCoverage,
      supportedMvpActions,
      requiredGateFamilies,
      mustHaveBeforeFutureLiveExecution,
      nonExecutionGuaranteeDefects,
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

  private executionReadinessContractLines(
    review: AdsAutomationApprovalPreflightExecutionReadinessContractReview,
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

    defects.push(
      ...this.missingMvpActionCoverage(coverage).map(
        (actionType) => `missing_mvp_action_coverage:${actionType}`,
      ),
    );

    return this.unique(defects);
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

  private supportedMvpActionDefects(defects: string[]): string[] {
    return defects.filter(
      (defect) =>
        defect ===
          "execution_readiness_contract_supported_mvp_actions_absent" ||
        defect === "supported_mvp_actions_order_mismatch" ||
        defect.startsWith("missing_supported_mvp_action:") ||
        defect.startsWith("unsupported_supported_mvp_action:"),
    );
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

  private requiredGateFamilyDefects(defects: string[]): string[] {
    return defects.filter(
      (defect) =>
        defect ===
          "execution_readiness_contract_required_gate_families_absent" ||
        defect === "required_gate_families_order_mismatch" ||
        defect.startsWith("missing_required_gate_family:") ||
        defect.startsWith("unsupported_required_gate_family:"),
    );
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

  private mustHaveBeforeFutureLiveExecutionDefects(
    defects: string[],
  ): string[] {
    return defects.filter(
      (defect) =>
        defect ===
          "execution_readiness_contract_must_have_before_future_live_execution_absent" ||
        defect === "must_have_before_future_live_execution_order_mismatch" ||
        defect.startsWith("missing_must_have_before_future_live_execution:") ||
        defect.startsWith(
          "unsupported_must_have_before_future_live_execution:",
        ),
    );
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

  private nonExecutionGuaranteeDefects(defects: string[]): string[] {
    return defects.filter(
      (defect) =>
        defect ===
          "execution_readiness_contract_non_execution_guarantee_absent" ||
        defect.startsWith("non_execution_guarantee_"),
    );
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

  private exportStatus(
    actionReviews: AdsAutomationApprovalPreflightActionReview[],
    gates: AdsAutomationApprovalPreflightGateFamilyReview[],
    executionReadinessContractReview: AdsAutomationApprovalPreflightExecutionReadinessContractReview,
  ): AdsAutomationApprovalPreflightReviewStatus {
    if (executionReadinessContractReview.local_review_defect) {
      return "blocked_before_future_execution";
    }
    if (!actionReviews.length) return "empty";
    if (gates.some((gate) => gate.status === "blocked")) {
      return "blocked_before_future_execution";
    }
    return "ready_for_future_preflight_review";
  }

  private actionStatus(input: {
    actionType: AdsAutomationDecisionDraftActionType;
    isSafetyAction: boolean;
    blockers: string[];
  }): AdsAutomationApprovalPreflightActionReview["status"] {
    if (input.actionType === "monitor_only") return "monitor_only_visible";
    if (input.isSafetyAction) return "reviewable_safety_action";
    if (input.blockers.length) return "blocked";
    return "local_gates_passed_but_live_blocked";
  }

  private mvpActionContract(
    seed: ActionSeed,
    actionType: AdsAutomationDecisionDraftActionType,
    isProviderAction: boolean,
  ): AdsAutomationProviderValidateOnlyMvpActionContract {
    if (seed.validationPlan?.mvp_action_contract) {
      return seed.validationPlan.mvp_action_contract;
    }

    const monitorOnly = actionType === "monitor_only";
    const supportedMvpAction = isProviderAction || monitorOnly;

    return {
      supported_mvp_action: supportedMvpAction,
      action_scope: isProviderAction
        ? "provider_validateOnly_required"
        : monitorOnly
          ? "monitor_only_safety_action"
          : "out_of_scope_non_provider_action",
      preflight_treatment: isProviderAction
        ? "eligible_for_future_provider_preflight"
        : monitorOnly
          ? "visible_non_executable_safety_action"
          : "not_in_mvp_validateOnly_contract",
      provider_validateOnly_required_before_future_execution: isProviderAction,
      monitor_only_safety_action: monitorOnly,
      visible_as_safety_action: monitorOnly,
      approval_required_before_execution: true,
      future_live_execution_allowed: false,
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    };
  }

  private mvpActionContractEvidence(
    contract: AdsAutomationProviderValidateOnlyMvpActionContract,
  ): string[] {
    const evidence = [
      `action_scope=${contract.action_scope}`,
      `preflight_treatment=${contract.preflight_treatment}`,
      "provider_api_called=false",
      "google_ads_api_called=false",
      "validateOnly_called=false",
      "execution_allowed_now=false",
    ];

    if (contract.action_scope === "provider_validateOnly_required") {
      evidence.push(
        "provider_mvp_action_requires_future_erp_owned_provider_validateOnly=true",
      );
    }
    if (contract.action_scope === "monitor_only_safety_action") {
      evidence.push("monitor_only_visible_non_executable_safety_action=true");
    }
    if (contract.action_scope === "out_of_scope_non_provider_action") {
      evidence.push("non_mvp_internal_action_out_of_scope=true");
    }

    return evidence;
  }

  private actionType(seed: ActionSeed): AdsAutomationDecisionDraftActionType {
    return (
      seed.monitorOnlyAction?.action_type ||
      seed.approval?.action_type ||
      seed.validationPlan?.action_type ||
      seed.preflightRecord?.action_type ||
      "monitor_only"
    );
  }

  private actionFamily(seed: ActionSeed): AdsAutomationDecisionDraftFamily {
    return (
      seed.monitorOnlyAction?.action_family ||
      seed.approval?.action_family ||
      seed.validationPlan?.action_family ||
      seed.preflightRecord?.action_family ||
      "monitoring"
    );
  }

  private provider(seed: ActionSeed): "google" | "erp_internal" | "none" {
    return (
      seed.approval?.provider ||
      seed.validationPlan?.provider ||
      seed.preflightRecord?.provider ||
      "none"
    );
  }

  private campaignBudgetId(
    seed: ActionSeed,
    actionType: AdsAutomationDecisionDraftActionType,
  ): string | null {
    const approvalPayload = seed.approval?.typedPayload || {};
    if (actionType === "update_campaign_budget" && seed.approval) {
      return this.text(approvalPayload.campaignBudgetId);
    }

    return this.text(
      approvalPayload.campaignBudgetId ||
        seed.validationPlan?.campaignBudgetId ||
        seed.preflightRecord?.identifiers.campaignBudgetId,
    );
  }

  private actionIdentifiers(
    seed: ActionSeed,
    campaignBudgetId: string | null,
  ): AdsAutomationPendingErpActionIdentifiers {
    const approvalPayload = seed.approval?.typedPayload || {};
    return {
      customerId: this.text(
        approvalPayload.customerId ||
          seed.validationPlan?.customerId ||
          seed.preflightRecord?.identifiers.customerId ||
          seed.monitorOnlyAction?.accountId,
      ),
      campaignId: this.text(
        approvalPayload.campaignId ||
          seed.validationPlan?.campaignId ||
          seed.preflightRecord?.identifiers.campaignId,
      ),
      adGroupId: this.text(
        approvalPayload.adGroupId ||
          seed.validationPlan?.adGroupId ||
          seed.preflightRecord?.identifiers.adGroupId,
      ),
      campaignBudgetId,
      campaignBudgetResourceName: this.text(
        approvalPayload.campaignBudgetResourceName ||
          seed.validationPlan?.campaignBudgetResourceName ||
          seed.preflightRecord?.identifiers.campaignBudgetResourceName,
      ),
      productId: this.text(
        seed.approval?.productId ||
          seed.validationPlan?.source_pending_action?.productId ||
          seed.preflightRecord?.source_pending_approval?.productId ||
          seed.monitorOnlyAction?.productId,
      ),
      supplierId: this.text(
        seed.approval?.supplierId ||
          seed.validationPlan?.source_pending_action?.supplierId ||
          seed.preflightRecord?.source_pending_approval?.supplierId ||
          seed.monitorOnlyAction?.supplierId,
      ),
    };
  }

  private platformEntityCoverageReview(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): AdsAutomationApprovalPreflightPlatformEntityCoverageReview | null {
    if (!coverage) return null;

    return {
      campaignMetricRollups: this.metricRollupLines(
        "Campaign metric rollup",
        coverage.campaigns.metricRollups || [],
      ),
      adGroupMetricRollups: this.metricRollupLines(
        "Ad group metric rollup",
        coverage.adGroups.metricRollups || [],
      ),
      campaignBudgetMetricRollups: this.metricRollupLines(
        "Campaign budget metric rollup",
        coverage.campaignBudgets.metricRollups || [],
      ),
      productMappings: (coverage.productMapping.productMappings || []).map(
        (row) => this.productMappingLine(row),
      ),
      productReadiness: (coverage.inventoryProfit.productReadiness || []).map(
        (row) => this.productReadinessLine(row),
      ),
      supplierReadiness: (coverage.supplierContext.supplierReadiness || []).map(
        (row) => this.supplierReadinessLine(row),
      ),
    };
  }

  private platformEntityCoverageReviewLines(
    review: AdsAutomationApprovalPreflightPlatformEntityCoverageReview,
  ): string[] {
    return [
      ...review.campaignMetricRollups,
      ...review.adGroupMetricRollups,
      ...review.campaignBudgetMetricRollups,
      ...review.productMappings,
      ...review.productReadiness,
      ...review.supplierReadiness,
    ];
  }

  private metricRollupLines(
    label: string,
    rows: AdsAutomationReadonlyPlatformMetricEntityCoverageRow[],
  ): string[] {
    return rows.map((row) =>
      [
        `${label}: entityId=${row.entityId}`,
        `campaignIds=${this.joinOrNone(row.campaignIds || [])}`,
        `adGroupIds=${this.joinOrNone(row.adGroupIds || [])}`,
        `campaignBudgetIds=${this.joinOrNone(row.campaignBudgetIds || [])}`,
        `mappedProductIds=${this.joinOrNone(row.mappedProductIds || [])}`,
        `supplierIds=${this.joinOrNone(row.supplierIds || [])}`,
        `dates=${this.joinOrNone(row.dates || [])}`,
        `reportDateCovered=${row.reportDateCovered}`,
        `rows=${row.rows}`,
        `readyRows=${row.readyRows}`,
        `spendVnd=${row.spendVnd}`,
        `costVnd=${row.costVnd}`,
        `clicks=${row.clicks}`,
        `impressions=${row.impressions}`,
        `conversions=${row.conversions}`,
        `conversionValueVnd=${row.conversionValueVnd}`,
        `linkedDecisionTypes=${this.joinOrNone(row.linkedDecisionTypes || [])}`,
        `linkedDecisionEffectiveStatuses=${this.joinOrNone(row.linkedDecisionEffectiveStatuses || [])}`,
        `blockers=${this.joinOrNone(row.blockers || [])}`,
        `coveredForDecision=${row.coveredForDecision}`,
      ].join(", "),
    );
  }

  private productMappingLine(
    row: AdsAutomationReadonlyProductMappingCoverageRow,
  ): string {
    return [
      `Product mapping row: productId=${row.productId}`,
      `mappedAdGroupIds=${this.joinOrNone(row.mappedAdGroupIds || [])}`,
      `campaignBudgetIds=${this.joinOrNone(row.campaignBudgetIds || [])}`,
      `supplierIds=${this.joinOrNone(row.supplierIds || [])}`,
      `blockers=${this.joinOrNone(row.blockers || [])}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private productReadinessLine(
    row: AdsAutomationReadonlyInventoryProfitCoverageRow,
  ): string {
    return [
      `Product readiness row: productId=${row.productId}`,
      `netProfitVnd=${this.nullable(row.netProfitVnd)}`,
      `adAttributedNetProfitAfterAdsVnd=${this.nullable(row.adAttributedNetProfitAfterAdsVnd)}`,
      `marginPercent=${this.nullable(row.marginPercent)}`,
      `stockAvailable=${this.nullable(row.stockAvailable)}`,
      `daysOfCover=${this.nullable(row.daysOfCover)}`,
      `canReceiveBudget=${row.canReceiveBudget}`,
      `needsKillOrStopReview=${row.needsKillOrStopReview}`,
      `blockers=${this.joinOrNone(row.blockers || [])}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private supplierReadinessLine(
    row: AdsAutomationReadonlySupplierSafetyCoverageRow,
  ): string {
    return [
      `Supplier readiness row: supplierId=${row.supplierId}`,
      `productId=${row.productId || "none"}`,
      `quoteApproved=${this.nullable(row.quoteApproved)}`,
      `marginAfterCostPercent=${this.nullable(row.marginAfterCostPercent)}`,
      `leadTimeDays=${this.nullable(row.leadTimeDays)}`,
      `lateDeliveryRatePercent=${this.nullable(row.lateDeliveryRatePercent)}`,
      `paymentFreshnessDays=${this.nullable(row.paymentFreshnessDays)}`,
      `capacityStatus=${row.capacityStatus || "none"}`,
      `returnFaultRatePercent=${this.nullable(row.returnFaultRatePercent)}`,
      `safeForBudgetAllocation=${row.safeForBudgetAllocation}`,
      `blockers=${this.joinOrNone(row.blockers || [])}`,
      `coveredForDecision=${row.coveredForDecision}`,
    ].join(", ");
  }

  private platformEntityCoverageActionBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
    identifiers: AdsAutomationPendingErpActionIdentifiers,
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    if (!coverage) return [];
    const blockers: AdsAutomationPlatformEntityCoverageActionBlocker[] = [];
    const add = (
      family: AdsAutomationPlatformEntityCoverageActionBlocker["family"],
      scope: AdsAutomationPlatformEntityCoverageActionBlocker["scope"],
      values: string[],
    ) => {
      for (const blocker of this.unique(values)) {
        blockers.push({
          blocker,
          family,
          scope,
          campaignId: identifiers.campaignId,
          adGroupId: identifiers.adGroupId,
          campaignBudgetId: identifiers.campaignBudgetId,
          productId: identifiers.productId,
          supplierId: identifiers.supplierId,
        });
      }
    };

    if (
      identifiers.campaignId &&
      !coverage.campaigns.campaignIds.includes(identifiers.campaignId)
    ) {
      add("campaigns", "campaignId", [
        ...this.prefixedPlatformBlockers(
          "campaigns",
          coverage.campaigns.blockers,
        ),
        "platform_entity.campaigns.campaignId_not_covered_for_action",
      ]);
    }

    if (
      identifiers.adGroupId &&
      !coverage.adGroups.adGroupIds.includes(identifiers.adGroupId)
    ) {
      add("adGroups", "adGroupId", [
        ...this.prefixedPlatformBlockers(
          "adGroups",
          coverage.adGroups.blockers,
        ),
        "platform_entity.adGroups.adGroupId_not_covered_for_action",
      ]);
    }

    if (!identifiers.campaignBudgetId) {
      add("campaignBudgets", "campaignBudgetId", [
        "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
      ]);
    } else if (
      !coverage.campaignBudgets.campaignBudgetIds.includes(
        identifiers.campaignBudgetId,
      )
    ) {
      add("campaignBudgets", "campaignBudgetId", [
        ...this.prefixedPlatformBlockers(
          "campaignBudgets",
          coverage.campaignBudgets.blockers,
        ),
        "platform_entity.campaignBudgets.campaignBudgetId_not_covered_for_action",
      ]);
    }

    const productMappingBlockers: string[] = [];
    if (
      identifiers.adGroupId &&
      coverage.productMapping.unmappedAdGroupIds.includes(identifiers.adGroupId)
    ) {
      productMappingBlockers.push(
        ...this.prefixedPlatformBlockers(
          "productMapping",
          coverage.productMapping.blockers,
        ),
        "platform_entity.productMapping.adGroupId_unmapped_for_action",
      );
    }
    if (
      identifiers.productId &&
      !coverage.productMapping.mappedProductIds.includes(identifiers.productId)
    ) {
      productMappingBlockers.push(
        "platform_entity.productMapping.productId_not_mapped_for_action",
      );
    }
    if (productMappingBlockers.length && !coverage.productMapping.sourceReady) {
      productMappingBlockers.push(
        "platform_entity.productMapping.source_not_ready",
      );
    }
    if (
      productMappingBlockers.length &&
      !coverage.productMapping.coveredForDecision
    ) {
      productMappingBlockers.push(
        "platform_entity.productMapping.not_covered_for_decision",
      );
    }
    add("productMapping", "productId", productMappingBlockers);

    const inventoryBlockers: string[] = [];
    if (
      identifiers.productId &&
      coverage.inventoryProfit.blockedProductIds.includes(identifiers.productId)
    ) {
      inventoryBlockers.push(
        ...this.prefixedPlatformBlockers(
          "inventoryProfit",
          coverage.inventoryProfit.blockers,
        ),
        "platform_entity.inventoryProfit.product_blocked_for_action",
      );
    }
    if (
      identifiers.productId &&
      !coverage.inventoryProfit.profitableProductIds.includes(
        identifiers.productId,
      ) &&
      !coverage.inventoryProfit.coveredForDecision
    ) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.product_profit_not_covered_for_action",
      );
    }
    if (inventoryBlockers.length && !coverage.inventoryProfit.sourceReady) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.source_not_ready",
      );
    }
    if (
      inventoryBlockers.length &&
      !coverage.inventoryProfit.coveredForDecision
    ) {
      inventoryBlockers.push(
        "platform_entity.inventoryProfit.not_covered_for_decision",
      );
    }
    add("inventoryProfit", "productId", inventoryBlockers);

    const supplierBlockers: string[] = [];
    if (
      identifiers.supplierId &&
      coverage.supplierContext.blockedSupplierIds.includes(
        identifiers.supplierId,
      )
    ) {
      supplierBlockers.push(
        ...this.prefixedPlatformBlockers(
          "supplierContext",
          coverage.supplierContext.blockers,
        ),
        "platform_entity.supplierContext.supplier_blocked_for_action",
      );
    }
    if (
      identifiers.supplierId &&
      !coverage.supplierContext.safeSupplierIds.includes(
        identifiers.supplierId,
      ) &&
      !coverage.supplierContext.coveredForDecision
    ) {
      supplierBlockers.push(
        "platform_entity.supplierContext.supplier_not_safe_for_action",
      );
    }
    if (supplierBlockers.length && !coverage.supplierContext.sourceReady) {
      supplierBlockers.push("platform_entity.supplierContext.source_not_ready");
    }
    if (
      supplierBlockers.length &&
      !coverage.supplierContext.coveredForDecision
    ) {
      supplierBlockers.push(
        "platform_entity.supplierContext.not_covered_for_decision",
      );
    }
    add("supplierContext", "supplierId", supplierBlockers);

    add(
      "freshnessCoverage",
      "freshness",
      coverage.freshnessCoverage.blockingReasons.map(
        (blocker) => `platform_entity.freshnessCoverage.${blocker}`,
      ),
    );

    return this.dedupePlatformActionBlockers(blockers);
  }

  private prefixedPlatformBlockers(
    family: AdsAutomationPlatformEntityCoverageActionBlocker["family"],
    blockers: string[],
  ): string[] {
    return blockers.map((blocker) => `platform_entity.${family}.${blocker}`);
  }

  private dedupePlatformActionBlockers(
    blockers: AdsAutomationPlatformEntityCoverageActionBlocker[],
  ): AdsAutomationPlatformEntityCoverageActionBlocker[] {
    const seen = new Set<string>();
    return blockers.filter((blocker) => {
      const key = [
        blocker.blocker,
        blocker.scope,
        blocker.campaignId,
        blocker.adGroupId,
        blocker.campaignBudgetId,
        blocker.productId,
        blocker.supplierId,
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private platformEntityCoverageBlockers(
    coverage: AdsAutomationReadonlyPlatformEntityCoverage | null,
  ): string[] {
    if (!coverage) return [];

    return this.unique([
      ...coverage.campaigns.blockers.map(
        (blocker) => `platform_entity.campaigns.${blocker}`,
      ),
      ...coverage.adGroups.blockers.map(
        (blocker) => `platform_entity.adGroups.${blocker}`,
      ),
      ...coverage.campaignBudgets.blockers.map(
        (blocker) => `platform_entity.campaignBudgets.${blocker}`,
      ),
      ...coverage.productMapping.blockers.map(
        (blocker) => `platform_entity.productMapping.${blocker}`,
      ),
      ...coverage.inventoryProfit.blockers.map(
        (blocker) => `platform_entity.inventoryProfit.${blocker}`,
      ),
      ...coverage.supplierContext.blockers.map(
        (blocker) => `platform_entity.supplierContext.${blocker}`,
      ),
      ...coverage.freshnessCoverage.blockingReasons.map(
        (blocker) => `platform_entity.freshnessCoverage.${blocker}`,
      ),
      ...(coverage.campaigns.missingCampaignIdRows
        ? ["platform_entity.campaigns.campaignId_missing_rows"]
        : []),
      ...(coverage.adGroups.missingAdGroupIdRows
        ? ["platform_entity.adGroups.adGroupId_missing_rows"]
        : []),
      ...(coverage.campaignBudgets.missingCampaignBudgetIdRows
        ? [
            "platform_entity.campaignBudgets.campaignBudgetId_missing_no_fallback",
          ]
        : []),
      ...(coverage.productMapping.sourceReady
        ? []
        : ["platform_entity.productMapping.source_not_ready"]),
      ...(coverage.productMapping.coveredForDecision
        ? []
        : ["platform_entity.productMapping.not_covered_for_decision"]),
      ...(coverage.inventoryProfit.sourceReady
        ? []
        : ["platform_entity.inventoryProfit.source_not_ready"]),
      ...(coverage.inventoryProfit.coveredForDecision
        ? []
        : ["platform_entity.inventoryProfit.not_covered_for_decision"]),
      ...(coverage.supplierContext.sourceReady
        ? []
        : ["platform_entity.supplierContext.source_not_ready"]),
      ...(coverage.supplierContext.coveredForDecision
        ? []
        : ["platform_entity.supplierContext.not_covered_for_decision"]),
    ]);
  }

  private platformSourceReadinessBlockers(blockers: string[]): string[] {
    return blockers.filter(
      (blocker) =>
        blocker.startsWith("platform_entity.campaigns.") ||
        blocker.startsWith("platform_entity.adGroups.") ||
        blocker.startsWith("platform_entity.productMapping.") ||
        blocker.startsWith("platform_entity.freshnessCoverage."),
    );
  }

  private platformCampaignBudgetBlockers(blockers: string[]): string[] {
    return blockers.filter((blocker) =>
      blocker.startsWith("platform_entity.campaignBudgets."),
    );
  }

  private platformFinancePolicyBlockers(blockers: string[]): string[] {
    return blockers.filter(
      (blocker) =>
        blocker.startsWith("platform_entity.inventoryProfit.") ||
        blocker.startsWith("platform_entity.supplierContext.") ||
        blocker === "platform_entity.productMapping.not_covered_for_decision",
    );
  }

  private sourceReadinessBlockers(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
    actionType: AdsAutomationDecisionDraftActionType,
  ): string[] {
    if (!approval) return [];
    const blockers: string[] = [];
    if (approval.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      blockers.push("source_sync_gate_blocked_action_draft");
    }
    if (
      actionType === "update_campaign_budget" &&
      approval.sourceSyncDecisionGates?.canRecommendAdsScale === false
    ) {
      blockers.push("source_sync_gate_blocked_ads_scale_recommendation");
    }
    if (approval.sourceSyncDecisionGates?.canUseGoogleAdsDataClaim === false) {
      blockers.push("source_sync_gate_blocked_google_ads_data_claim");
    }
    for (const evidence of approval.sourceSyncDecisionEvidence || []) {
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      blockers.push(
        `${evidence.sourceKey}_not_ready_for_ads_automation_decision`,
      );
      blockers.push(...this.arrayText(evidence.blockingReasons));
      if (evidence.blockingReason)
        blockers.push(String(evidence.blockingReason));
    }
    return this.unique(blockers);
  }

  private financeBlockers(
    approval: AdsAutomationDecisionDraftPendingApprovalRecord | null,
  ): string[] {
    const values = [
      ...this.arrayText(approval?.blockers),
      ...this.arrayText(approval?.missing_data_blockers),
    ];
    return values
      .filter((blocker) =>
        /cashflow|finance|gross_margin|contribution|loss|daily_cap|monthly_cap|profit/i.test(
          blocker,
        ),
      )
      .map((blocker) => `approval.${blocker}`);
  }

  private preflightBlockers(
    preflight: AdsAutomationExecutionPreflightDryRunRecord | null,
    pattern: string,
  ): string[] {
    if (!preflight) return [];
    return this.arrayText(preflight.blockers).filter((blocker) =>
      blocker.includes(pattern),
    );
  }

  private closedExecutionPathBlockers(
    preflight: AdsAutomationExecutionPreflightDryRunRecord | null,
  ): string[] {
    if (!preflight) return [];
    const blockers: string[] = [];

    if (preflight.future_live_execution_allowed === false) {
      blockers.push("future_live_execution_allowed_false_local_only");
    }
    if (preflight.execution_allowed_now !== false) {
      blockers.push("execution_allowed_now_not_closed");
    }
    if (preflight.provider_api_called !== false) {
      blockers.push("provider_api_called_not_closed");
    }
    if (preflight.google_ads_api_called !== false) {
      blockers.push("google_ads_api_called_not_closed");
    }
    if (preflight.validateOnly_called !== false) {
      blockers.push("validateOnly_called_not_closed");
    }
    if (preflight.live_ads_execution_used !== false) {
      blockers.push("live_ads_execution_used_not_closed");
    }
    if (preflight.live_path_implemented === false) {
      blockers.push("live_path_not_implemented");
    }

    return blockers;
  }

  private preflightBlockedOnlyByProductionFlag(
    preflight: AdsAutomationExecutionPreflightDryRunRecord,
  ): boolean {
    const blockers = this.arrayText(preflight.blockers);
    return (
      blockers.length > 0 &&
      blockers.every((blocker) =>
        blocker.includes("GOOGLE_ADS_PRODUCTION_ENABLED"),
      )
    );
  }

  private rollbackPlan(seed: ActionSeed): string | null {
    return (
      this.text(seed.monitorOnlyAction?.rollback_plan) ||
      this.text(
        seed.approval?.source_evidence_references
          ?.map((reference) => reference.rollback_plan)
          .find((value) => this.text(value)),
      )
    );
  }

  private idempotencyKey(seed: ActionSeed): string | null {
    return this.text(
      seed.preflightRecord?.idempotency_key ||
        seed.approval?.idempotency_key ||
        seed.approvalAudit?.idempotency_key ||
        seed.monitorOnlyAction?.idempotency_key,
    );
  }

  private duplicateIdempotencyKeys(seeds: ActionSeed[]): string[] {
    const counts = new Map<string, number>();
    for (const seed of seeds) {
      const key = this.idempotencyKey(seed);
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
      .sort();
  }

  private safety(): AdsAutomationApprovalPreflightReviewExportResponse["safety"] {
    return {
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      fixture_or_payload_only: true,
      source_readiness_review_reused: true,
      validateOnly_lane_reused: true,
      approval_queue_read_model_reused: true,
      execution_preflight_evidence_reused: true,
      repository_write_used: false,
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
      approval_required_for_all_provider_actions: true,
      future_provider_validateOnly_required_before_execution: true,
      future_live_execution_allowed: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    };
  }

  private sourceDecisionAnswerReview(
    sourceReadiness: AdsAutomationApprovalPreflightReviewExportInput["sourceReadinessReviewExport"],
  ): AdsAutomationReadonlyDecisionReadinessAnswers {
    return (
      sourceReadiness.decisionAnswerReview ||
      sourceReadiness.readonlyImportReadiness?.decisionReadiness?.answers ||
      this.emptyDecisionAnswers()
    );
  }

  private emptyDecisionAnswers(): AdsAutomationReadonlyDecisionReadinessAnswers {
    return {
      may_increase_ads: false,
      max_increase_vnd: 0,
      scale_up_execution_mode: "monitor_only",
      ad_groups_to_increase: [],
      target_ad_groups: [],
      products_can_receive_budget: [],
      blocked_product_budget_candidates: [],
      supplier_choice_safe: false,
      safe_supplier_choices: [],
      blocked_supplier_choices: [],
      product_kill_or_stop_review_needed: false,
      product_kill_or_stop_review: [],
      campaign_or_ad_group_pause_recommended: false,
      campaign_or_ad_group_pause: [],
      blocking_reasons: ["source_decision_answers_missing"],
      execution_allowed_now: false,
    };
  }

  private decisionAnswerLines(
    answers: AdsAutomationReadonlyDecisionReadinessAnswers,
  ): string[] {
    return [
      `may_increase_ads=${answers.may_increase_ads}`,
      `max_increase_vnd=${answers.max_increase_vnd}`,
      `ad_groups_to_increase=${this.candidateIds(answers.ad_groups_to_increase)}`,
      `products_can_receive_budget=${this.candidateIds(answers.products_can_receive_budget)}`,
      `blocked_product_budget_candidates=${this.candidateIds(answers.blocked_product_budget_candidates)}`,
      `safe_supplier_choices=${this.candidateIds(answers.safe_supplier_choices)}`,
      `blocked_supplier_choices=${this.candidateIds(answers.blocked_supplier_choices)}`,
      `product_kill_or_stop_review_needed=${answers.product_kill_or_stop_review_needed}`,
      `campaign_or_ad_group_pause_recommended=${answers.campaign_or_ad_group_pause_recommended}`,
      `blocking_reasons=${this.joinOrNone(answers.blocking_reasons)}`,
      "execution_allowed_now=false",
    ];
  }

  private candidateIds(
    candidates: AdsAutomationReadonlyDecisionReadinessCandidate[],
  ): string {
    return this.joinOrNone(candidates.map((candidate) => candidate.entityId));
  }

  private emptyGateBlockers(): AdsAutomationApprovalPreflightGateBlockers {
    return GATE_FAMILIES.reduce((acc, family) => {
      acc[family] = [];
      return acc;
    }, {} as AdsAutomationApprovalPreflightGateBlockers);
  }

  private safeIdempotencyKey(value: unknown): boolean {
    const text = this.text(value);
    return Boolean(text && text.length <= 240 && /^[a-z0-9._:-]+$/i.test(text));
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
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

  private unique(values: unknown[]): string[] {
    return [
      ...new Set(
        values
          .map((value) => this.text(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ].sort();
  }

  private joinOrNone(values: string[]): string {
    return values.length ? values.join(", ") : "none";
  }

  private nullable(
    value: string | number | boolean | null | undefined,
  ): string {
    return value === null || value === undefined ? "none" : String(value);
  }
}
