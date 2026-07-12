import type { AdsAutomationDecisionFoundationReadModelSnapshotResponse } from "./ads-automation-decision-foundation-snapshot.contract";
import type { AdsAutomationDecisionDraftPreviewResponse } from "./ads-automation-decision-draft-preview.contract";
import type {
  AdsAutomationPendingErpActionNormalizationResponse,
  AdsAutomationPlatformEntityCoverageActionBlocker,
} from "./ads-automation-pending-erp-action.contract";
import type {
  AdsAutomationProviderValidateOnlyLaneResponse,
  AdsAutomationProviderValidateOnlyMvpActionContractReview,
  AdsAutomationProviderValidateOnlyMockResult,
} from "./ads-automation-provider-validate-only.contract";
import type { AdsAutomationLossLimitPolicyResponse } from "./ads-automation-loss-limit-policy.contract";
import type { AdsAutomationProviderAccountReadinessResponse } from "./ads-automation-provider-account-readiness.contract";
import type {
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformImportReadinessResponse,
} from "./ads-automation-readonly-platform-import-readiness.contract";
import type { AdsAutomationSourceReadinessReviewExportResponse } from "./ads-automation-source-readiness-review-export.contract";
import type { SourceSyncDecisionEvidence } from "../source-sync/source-sync-result.types";

export type AdsAutomationApiReadinessGapReportStatus =
  | "blocked"
  | "ready_for_local_review";

export type AdsAutomationApiReadinessGapReportStageKey =
  | "source_import_readiness"
  | "decision_inputs"
  | "pending_actions"
  | "validate_only"
  | "provider_account_readiness"
  | "approval_gate"
  | "execution_preflight"
  | "final_go_no_go_readiness"
  | "dry_run_audit";

export type AdsAutomationApiReadinessGapReportStageStatus =
  | "ready"
  | "blocked"
  | "pending"
  | "monitor_only";

export interface AdsAutomationApiReadinessGapReportInput {
  reportDate: string;
  foundationSnapshot: AdsAutomationDecisionFoundationReadModelSnapshotResponse;
  draftPreview: AdsAutomationDecisionDraftPreviewResponse;
  mockedProviderResults?: AdsAutomationProviderValidateOnlyMockResult[];
  lossLimitPolicy?: AdsAutomationLossLimitPolicyResponse | null;
  providerAccountReadiness?: AdsAutomationProviderAccountReadinessResponse | null;
  readonlyImportReadiness?: AdsAutomationReadonlyPlatformImportReadinessResponse | null;
  sourceReadinessReviewExport?: AdsAutomationSourceReadinessReviewExportResponse | null;
}

export interface AdsAutomationApiReadinessGapReportSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  provider_api_used: false;
  google_ads_api_called: false;
  google_ads_api_used: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  direct_google_ads_api_call: false;
  provider_mutation_used: false;
  raw_provider_request_included: false;
  operation_builder_called: false;
  live_path_implemented: false;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
  approval_required_for_all_actions: true;
  campaignBudgetId_no_fallback: true;
}

export interface AdsAutomationApiReadinessGapReportSummary {
  status: AdsAutomationApiReadinessGapReportStatus;
  reportDate: string;
  source_blocker_count: number;
  decision_input_blocker_count: number;
  source_readiness_review_export_consumed: boolean;
  source_readiness_review_export_mode:
    | AdsAutomationSourceReadinessReviewExportResponse["exportMode"]
    | null;
  source_readiness_review_export_status:
    | AdsAutomationSourceReadinessReviewExportResponse["summary"]["export_status"]
    | null;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_covered_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  source_readiness_validateOnly_blocker_count: number;
  source_readiness_final_go_no_go_blocker_count: number;
  platform_entity_coverage_present: boolean;
  platform_metric_row_count: number;
  platform_metric_ready_row_count: number;
  platform_campaign_count: number;
  platform_ad_group_count: number;
  platform_campaignBudget_count: number;
  platform_campaignBudgetId_missing_rows: number;
  platform_mapped_product_count: number;
  platform_mapped_ad_group_count: number;
  platform_unmapped_ad_group_count: number;
  platform_profitable_product_count: number;
  platform_blocked_product_count: number;
  platform_safe_supplier_count: number;
  platform_blocked_supplier_count: number;
  platform_supplier_choice_safe: boolean | null;
  platform_latest_successful_sync_at: string | null;
  platform_latest_record_date: string | null;
  platform_entity_blocker_count: number;
  pending_actions_created: number;
  provider_validateOnly_plans: number;
  provider_validateOnly_passed: number;
  provider_validateOnly_pending: number;
  provider_account_readiness_status:
    | AdsAutomationProviderAccountReadinessResponse["summary"]["status"]
    | "missing";
  provider_actions_ready_for_future_validate_only: number;
  provider_actions_blocked_before_boundary: number;
  provider_account_readiness_blocker_count: number;
  provider_mvp_actions_requiring_validateOnly: number;
  monitor_only_mvp_safety_actions: number;
  out_of_scope_non_provider_actions: number;
  approval_can_be_considered_executable: number;
  cashflow_first_scale_all_safe: boolean;
  scale_up_mode: "monitor_only" | "pending_validation";
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  production_ready: false;
  provider_api_used: false;
  google_ads_api_used: false;
  live_ads_execution_used: false;
  next_required_action:
    | "resolve_api_readiness_gaps"
    | "review_local_api_readiness_report";
}

export interface AdsAutomationApiReadinessGapReportStage {
  stage: AdsAutomationApiReadinessGapReportStageKey;
  status: AdsAutomationApiReadinessGapReportStageStatus;
  blockers: string[];
  evidence: string[];
  next_required_action: string;
}

export interface AdsAutomationCashflowFirstSafetyCheck {
  key:
    | "gross_margin_safe"
    | "contribution_profit_positive"
    | "cash_conversion_working_capital_safe"
    | "stock_coverage_safe"
    | "supplier_reliability_safe"
    | "fulfillment_capacity_safe"
    | "return_refund_risk_safe"
    | "data_freshness_safe"
    | "spend_caps_safe"
    | "emergency_stop_clear"
    | "daily_loss_limit_safe"
    | "monthly_loss_limit_safe";
  passed: boolean;
  blockers: string[];
  evidence: string;
}

export interface AdsAutomationBaControlAnswers {
  increase_ads: "no_monitor_only" | "yes_pending_validation";
  increase_amount_vnd: number;
  blocked_increase_amount_vnd: number;
  target_ad_groups: Array<{
    adGroupId: string;
    campaignBudgetId: string | null;
    status: string;
    blockers: string[];
  }>;
  products_to_receive_budget: Array<{
    productId: string | null;
    status: string;
    blockers: string[];
  }>;
  products_blocked_from_budget: Array<{
    productId: string | null;
    status: string;
    blockers: string[];
  }>;
  supplier_safety: Array<{
    productId: string | null;
    supplierId: string | null;
    status: string;
    blockers: string[];
  }>;
  product_kill_or_stop_import_review: Array<{
    productId: string | null;
    status: string;
    blockers: string[];
  }>;
  campaign_or_ad_group_pause: Array<{
    campaignId: string | null;
    adGroupId: string | null;
    status: string;
    blockers: string[];
  }>;
  scale_up_execution_mode: "monitor_only" | "pending_validation";
  execution_allowed_now: false;
}

export interface AdsAutomationApiSourceImportCoverage {
  sourceKey: SourceSyncDecisionEvidence["sourceKey"] | string;
  reportDate: string;
  freshnessStatus: string;
  coverageStatus: string;
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  blockingReason: string | null;
  blockingReasons: string[];
  canUseForAdsAutomationDecision: boolean;
}

export interface AdsAutomationApiReadinessPrerequisite {
  key:
    | "oauth_account_readiness"
    | "readonly_import_scheduler"
    | "provider_validateOnly_adapter"
    | "approval_policy"
    | "production_flag"
    | "idempotency"
    | "rollback"
    | "monitoring"
    | "rate_limits"
    | "spend_caps"
    | "loss_limits";
  status:
    | "missing"
    | "partial"
    | "contract_only"
    | "blocked_by_default"
    | "required_not_executed_by_report";
  required_before_live: true;
  blocker: string;
}

export interface AdsAutomationApiPlatformEntityCoverageReview {
  campaignMetricRollups: string[];
  adGroupMetricRollups: string[];
  campaignBudgetMetricRollups: string[];
  productMappings: string[];
  productReadiness: string[];
  supplierReadiness: string[];
}

export interface AdsAutomationApiReadinessGapReportResponse {
  schemaVersion: "ads_automation_api_readiness_gap_report.v1";
  generatedAt: string;
  reportDate: string;
  sourceFoundationSchemaVersion: AdsAutomationDecisionFoundationReadModelSnapshotResponse["schemaVersion"];
  sourceDraftPreviewSchemaVersion: AdsAutomationDecisionDraftPreviewResponse["schemaVersion"];
  safety: AdsAutomationApiReadinessGapReportSafety;
  summary: AdsAutomationApiReadinessGapReportSummary;
  stages: AdsAutomationApiReadinessGapReportStage[];
  cashflowFirstSafety: {
    all_safe: boolean;
    checks: AdsAutomationCashflowFirstSafetyCheck[];
    blockers: string[];
  };
  lossLimitPolicy: Pick<
    AdsAutomationLossLimitPolicyResponse,
    "schemaVersion" | "summary" | "scaleBlockers"
  > | null;
  baControlAnswers: AdsAutomationBaControlAnswers;
  sourceImportCoverage: AdsAutomationApiSourceImportCoverage[];
  platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage | null;
  platformEntityCoverageReview: AdsAutomationApiPlatformEntityCoverageReview | null;
  platformEntityCoverageBlockers: string[];
  remainingApiPrerequisites: AdsAutomationApiReadinessPrerequisite[];
  sourceBlockers: string[];
  decisionInputBlockers: string[];
  pendingActionNormalization: {
    schemaVersion:
      | AdsAutomationPendingErpActionNormalizationResponse["schemaVersion"]
      | null;
    created: boolean;
    error: string | null;
    summary:
      | AdsAutomationPendingErpActionNormalizationResponse["summary"]
      | null;
    platformEntityCoverageBlockersApplied: string[];
    platformEntityCoverageActionBlockersApplied: AdsAutomationPlatformEntityCoverageActionBlocker[];
    scaleCandidatesBlockedByPlatformEntityCoverage: number;
  };
  validateOnlyLane: {
    schemaVersion:
      | AdsAutomationProviderValidateOnlyLaneResponse["schemaVersion"]
      | null;
    created: boolean;
    summary: AdsAutomationProviderValidateOnlyLaneResponse["summary"] | null;
  };
  providerAccountReadiness: Pick<
    AdsAutomationProviderAccountReadinessResponse,
    "schemaVersion" | "summary" | "safety" | "blockers"
  > | null;
  mvpActionContractReview: AdsAutomationProviderValidateOnlyMvpActionContractReview;
  markdownPreview: string;
}
