import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionStatus,
} from "./ads-automation-decision.contract";
import type {
  AdsAutomationPlatformSourceStatus,
  AdsAutomationPlatformSourceSyncStatusResponse,
} from "./ads-automation-platform-source-sync-status.contract";
import type {
  AdsAutomationReadonlyDecisionCandidateEffectiveStatus,
  AdsAutomationReadonlyDecisionReadinessAnswers,
  AdsAutomationReadonlyPlatformEntityCoverage,
  AdsAutomationReadonlyPlatformImportReadinessResponse,
} from "./ads-automation-readonly-platform-import-readiness.contract";

export type AdsAutomationSourceReadinessReviewExportMode =
  | "local_payload"
  | "local_demo_fixture"
  | "erp_source_import_readiness";

export type AdsAutomationSourceReadinessReviewExportStatus =
  | "ready_for_review"
  | "needs_attention"
  | "empty";

export type AdsAutomationSourceReadinessCoverageBucket =
  | "fresh"
  | "stale"
  | "missing"
  | "unknown";

export interface AdsAutomationSourceReadinessReviewExportInput {
  reportDate?: string;
  now?: string | Date;
  exportMode?: AdsAutomationSourceReadinessReviewExportMode;
  fixtureName?: string | null;
  sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse;
  readonlyImportReadiness: AdsAutomationReadonlyPlatformImportReadinessResponse;
}

export interface AdsAutomationSourceReadinessReviewSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  source_sync_status_reused: true;
  readonly_import_readiness_reused: true;
  decision_read_model_evidence_reused: true;
  repository_write_used: false;
  persistence_used: false;
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
  campaignBudgetId_required: true;
  campaignBudgetId_no_fallback: true;
  campaignBudgetId_fallback_used: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsAutomationSourceReadinessReviewSummary {
  export_status: AdsAutomationSourceReadinessReviewExportStatus;
  export_mode: AdsAutomationSourceReadinessReviewExportMode;
  reportDate: string;
  source_sync_status: AdsAutomationPlatformSourceSyncStatusResponse["summary"]["status"];
  readonly_import_status: AdsAutomationReadonlyPlatformImportReadinessResponse["summary"]["status"];
  source_count: number;
  fresh_source_count: number;
  stale_source_count: number;
  missing_source_count: number;
  blocked_source_count: number;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_covered_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  latest_successful_sync_at: string | null;
  latest_record_date: string | null;
  total_spend_vnd: number;
  total_clicks: number;
  total_impressions: number;
  total_conversions: number;
  total_conversion_value_vnd: number;
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
  platform_supplier_choice_safe: boolean;
  platform_latest_successful_sync_at: string | null;
  platform_latest_record_date: string | null;
  platform_entity_blocking_reason_count: number;
  campaignBudgetId_missing_rows: number;
  campaignBudgetId_required: true;
  campaignBudgetId_no_fallback: true;
  campaignBudgetId_fallback_used: false;
  scale_up_candidate_count: number;
  scale_up_candidates_blocked: number;
  pause_candidate_count: number;
  product_kill_candidate_count: number;
  product_allocation_blocker_count: number;
  supplier_safety_blocker_count: number;
  cashflow_first_scale_mode: "monitor_only" | "pending_validation";
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | "inspect_source_readiness_review_export"
    | "resolve_source_readiness_blockers"
    | "provide_source_readiness_evidence";
}

export interface AdsAutomationSourceReadinessSourceCoverageReview {
  sourceKey: string;
  provider: string | null;
  platform: string | null;
  sourceStatus: AdsAutomationPlatformSourceStatus | "unknown";
  coverageBucket: AdsAutomationSourceReadinessCoverageBucket;
  freshnessStatus: string;
  coverageStatus: string;
  reportDate: string;
  reportDateRecordCount: number | null;
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  latestSuccessfulSyncOrReadModelWatermark: string | null;
  blockingReasons: string[];
  affectedDecisionCategories: AdsAutomationCategoryKey[];
  canUseForAdsAutomationDecision: boolean;
}

export interface AdsAutomationSourceReadinessMetricRollup {
  key: string;
  accountId: string | null;
  customerId: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  rows: number;
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd: number;
  campaignBudgetIdMissingRows: number;
}

export interface AdsAutomationSourceReadinessConversionMetricsReview {
  rows: number;
  readyRows: number;
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd: number;
  campaignBudgetIdMissingRows: number;
  byAccount: AdsAutomationSourceReadinessMetricRollup[];
  byAdGroup: AdsAutomationSourceReadinessMetricRollup[];
}

export interface AdsAutomationSourceReadinessCampaignBudgetEvidence {
  campaignBudgetId_required: true;
  no_fallback_from_campaignId_or_adGroupId: true;
  fallback_used: false;
  missing_row_count: number;
  missing_rows: AdsAutomationSourceReadinessMetricRollup[];
  rule: string;
}

export interface AdsAutomationSourceReadinessCandidateReview {
  decisionType: AdsAutomationCategoryKey;
  entityType: "ad_group" | "campaign" | "product" | "supplier" | "policy";
  entityId: string;
  platform: string | null;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  status: AdsAutomationDecisionStatus;
  effectiveStatus: AdsAutomationReadonlyDecisionCandidateEffectiveStatus;
  proposedAction: string | null;
  campaignBudgetId: string | null;
  currentBudgetVnd: number | null;
  proposedBudgetVnd: number | null;
  increaseVnd: number | null;
  conversions: number | null;
  conversionValueVnd: number | null;
  blockers: string[];
  missingFields: string[];
  approval_required: true;
  execution_allowed_now: false;
}

export interface AdsAutomationSourceReadinessManagerCandidateReview {
  scaleUpCandidates: AdsAutomationSourceReadinessCandidateReview[];
  pauseCandidates: AdsAutomationSourceReadinessCandidateReview[];
  productKillCandidates: AdsAutomationSourceReadinessCandidateReview[];
  productAllocationCandidates: AdsAutomationSourceReadinessCandidateReview[];
  supplierSafetyCandidates: AdsAutomationSourceReadinessCandidateReview[];
}

export interface AdsAutomationSourceReadinessBlockerReview {
  sourceBlockers: string[];
  readonlyImportBlockers: string[];
  readModelBlockers: string[];
  productAllocationBlockers: string[];
  supplierSafetyBlockers: string[];
  cashflowFirstBlockers: string[];
  globalBlockers: string[];
}

export interface AdsAutomationSourceReadinessReviewRouteExample {
  label: string;
  method: "POST";
  path: string;
  purpose: string;
  provider_api_called: false;
  erp_mutation_used: false;
}

export interface AdsAutomationSourceReadinessReviewSection {
  section_id:
    | "source_coverage"
    | "platform_entity_coverage"
    | "conversion_metrics"
    | "campaign_budget_join"
    | "manager_candidates"
    | "decision_answers"
    | "blockers"
    | "safety_gates";
  title: string;
  status: "ready_for_review" | "attention" | "passed" | "empty";
  lines: string[];
  evidence_record_ids: string[];
}

export interface AdsAutomationSourceReadinessReviewExportResponse {
  schemaVersion: "ads_automation_source_readiness_review_export.v1";
  generatedAt: string;
  exportMode: AdsAutomationSourceReadinessReviewExportMode;
  query: {
    reportDate: string;
    fixture?: string;
  };
  safety: AdsAutomationSourceReadinessReviewSafety;
  summary: AdsAutomationSourceReadinessReviewSummary;
  sourceCoverage: AdsAutomationSourceReadinessSourceCoverageReview[];
  platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage;
  conversionMetrics: AdsAutomationSourceReadinessConversionMetricsReview;
  campaignBudgetEvidence: AdsAutomationSourceReadinessCampaignBudgetEvidence;
  managerCandidateReview: AdsAutomationSourceReadinessManagerCandidateReview;
  decisionAnswerReview: AdsAutomationReadonlyDecisionReadinessAnswers;
  blockerReview: AdsAutomationSourceReadinessBlockerReview;
  routeExamples: AdsAutomationSourceReadinessReviewRouteExample[];
  renderedSections: AdsAutomationSourceReadinessReviewSection[];
  markdownPreview: string;
  sourceSyncStatus: AdsAutomationPlatformSourceSyncStatusResponse;
  readonlyImportReadiness: AdsAutomationReadonlyPlatformImportReadinessResponse;
}
