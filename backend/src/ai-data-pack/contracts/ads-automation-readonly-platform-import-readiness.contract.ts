import type { AdsAutomationPlatformSourceSyncStatusResponse } from "./ads-automation-platform-source-sync-status.contract";
import type { AdsAutomationLossLimitPolicyResponse } from "./ads-automation-loss-limit-policy.contract";
import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionStatus,
} from "./ads-automation-decision.contract";
import type {
  AdsAutomationDecisionMissingFieldEvidence,
  AdsAutomationDecisionSourceAdapterInput,
  AdsAutomationDecisionSourceEvidence,
} from "./ads-automation-decision-source-adapter.contract";
import type { SourceSyncDecisionEvidence } from "../source-sync/source-sync-result.types";

export type AdsAutomationReadonlyPlatform = "google_ads";

export type AdsAutomationReadonlySourceTrustLevel =
  | "provider_verified"
  | "erp_local_verified"
  | "fixture_verified"
  | "unknown";

export type AdsAutomationReadonlyImportCadence = "hourly" | "daily" | "manual";

export type AdsAutomationReadonlyImportRetryStatus =
  | "idle"
  | "retry_scheduled"
  | "blocked"
  | "exhausted";

export type AdsAutomationReadonlyImportReadinessStatus =
  | "ready_for_local_decision_review"
  | "blocked";

export interface AdsAutomationReadonlyImportWindow {
  from: string;
  to: string;
  timezone: string;
  cadence: AdsAutomationReadonlyImportCadence;
  maxRangeDays: number;
}

export interface AdsAutomationReadonlyImportRetryState {
  status: AdsAutomationReadonlyImportRetryStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string | null;
  backoffMs?: number | null;
  lastFailureCategory?: string | null;
}

export interface AdsAutomationReadonlyImportAccountInput {
  platform: AdsAutomationReadonlyPlatform;
  accountId?: string | null;
  customerId?: string | null;
  loginCustomerId?: string | null;
  accountName?: string | null;
  isActive?: boolean;
  approvedForReadOnlyImport?: boolean;
  configuredForReadOnlyImport?: boolean;
  googleAdsProductionEnabled?: boolean;
  sourceTrustLevel?: AdsAutomationReadonlySourceTrustLevel;
  importWindow: AdsAutomationReadonlyImportWindow;
  lastSuccessfulSyncAt?: string | null;
  latestMetricDate?: string | null;
  failureReason?: string | null;
  retryState?: AdsAutomationReadonlyImportRetryState;
  freshnessMaxAgeMinutes?: number | null;
}

export interface AdsAutomationReadonlyMetricRowInput {
  platform: AdsAutomationReadonlyPlatform;
  accountId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  date: string;
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd?: number | null;
}

export interface AdsAutomationReadonlyDecisionSafetyInput {
  grossMarginSafe?: boolean;
  contributionProfitPositive?: boolean;
  cashConversionWorkingCapitalSafe?: boolean;
  stockCoverageSafe?: boolean;
  supplierReliabilitySafe?: boolean;
  fulfillmentCapacitySafe?: boolean;
  returnRefundRiskSafe?: boolean;
  dataFreshnessSafe?: boolean;
  dailyLossLimitSafe?: boolean;
  monthlyLossLimitSafe?: boolean;
}

export interface AdsAutomationReadonlyPlatformImportReadinessInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: "htx_ads_readiness_demo" | "custom_local_payload";
  accounts: AdsAutomationReadonlyImportAccountInput[];
  metricRows: AdsAutomationReadonlyMetricRowInput[];
  decisionReadModel?: AdsAutomationDecisionSourceAdapterInput | null;
  sourceSyncStatus?: AdsAutomationPlatformSourceSyncStatusResponse;
  decisionSafety?: AdsAutomationReadonlyDecisionSafetyInput;
  lossLimitPolicy?: AdsAutomationLossLimitPolicyResponse | null;
}

export interface AdsAutomationReadonlyPlatformImportReadinessSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
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
  campaignBudgetId_no_fallback: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
}

export interface AdsAutomationReadonlyMetricCoverageSummary {
  rows: number;
  coveredDates: string[];
  missingDates: string[];
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd: number;
  campaignBudgetIdMissingRows: number;
}

export interface AdsAutomationReadonlyImportAccountReadiness {
  platform: AdsAutomationReadonlyPlatform;
  accountId: string | null;
  customerId: string | null;
  loginCustomerId: string | null;
  accountName: string | null;
  status: AdsAutomationReadonlyImportReadinessStatus;
  sourceTrustLevel: AdsAutomationReadonlySourceTrustLevel;
  importWindow: AdsAutomationReadonlyImportWindow;
  freshness: {
    status: "fresh" | "stale" | "missing";
    maxAgeMinutes: number | null;
    ageMinutes: number | null;
    staleByMinutes: number | null;
    lastSuccessfulSyncAt: string | null;
    latestMetricDate: string | null;
  };
  coverage: {
    status: "covered" | "partial" | "missing";
    reportDate: string;
    expectedDates: string[];
    coveredDates: string[];
    missingDates: string[];
  };
  metricCoverage: AdsAutomationReadonlyMetricCoverageSummary;
  retryBackoffState: Required<AdsAutomationReadonlyImportRetryState>;
  failureReason: string | null;
  blockers: string[];
  warnings: string[];
  canUseForReadOnlyImport: boolean;
  canUseForAdsAutomationDecision: boolean;
  canRecommendAdsScale: false;
  execution_allowed_now: false;
}

export interface AdsAutomationReadonlyMetricReadinessRow {
  platform: AdsAutomationReadonlyPlatform;
  accountId: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  date: string;
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd: number;
  blockers: string[];
  canUseForAdsAutomationDecision: boolean;
}

export interface AdsAutomationReadonlyPlatformMetricEntityCoverageRow {
  entityId: string;
  accountIds: string[];
  customerIds: string[];
  campaignIds: string[];
  adGroupIds: string[];
  campaignBudgetIds: string[];
  mappedProductIds: string[];
  supplierIds: string[];
  dates: string[];
  reportDateCovered: boolean;
  rows: number;
  readyRows: number;
  spendVnd: number;
  costVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValueVnd: number;
  linkedDecisionTypes: AdsAutomationCategoryKey[];
  linkedDecisionEffectiveStatuses: AdsAutomationReadonlyDecisionCandidateEffectiveStatus[];
  blockers: string[];
  coveredForDecision: boolean;
}

export interface AdsAutomationReadonlyProductMappingCoverageRow {
  productId: string;
  mappedAdGroupIds: string[];
  campaignBudgetIds: string[];
  supplierIds: string[];
  blockers: string[];
  coveredForDecision: boolean;
}

export interface AdsAutomationReadonlyInventoryProfitCoverageRow {
  productId: string;
  netProfitVnd: number | null;
  adAttributedNetProfitAfterAdsVnd: number | null;
  marginPercent: number | null;
  stockAvailable: number | null;
  daysOfCover: number | null;
  canReceiveBudget: boolean;
  needsKillOrStopReview: boolean;
  blockers: string[];
  coveredForDecision: boolean;
}

export interface AdsAutomationReadonlySupplierSafetyCoverageRow {
  supplierId: string;
  productId: string | null;
  quoteApproved: boolean | null;
  marginAfterCostPercent: number | null;
  leadTimeDays: number | null;
  lateDeliveryRatePercent: number | null;
  paymentFreshnessDays: number | null;
  capacityStatus: string | null;
  returnFaultRatePercent: number | null;
  safeForBudgetAllocation: boolean;
  blockers: string[];
  coveredForDecision: boolean;
}

export interface AdsAutomationReadonlyPlatformEntityCoverage {
  metrics: {
    rows: number;
    readyRows: number;
    spendVnd: number;
    costVnd: number;
    clicks: number;
    impressions: number;
    conversions: number;
    conversionValueVnd: number;
  };
  campaigns: {
    campaignIds: string[];
    readModelCampaignIds: string[];
    missingReadModelCampaignIds: string[];
    coveredCampaignCount: number;
    missingCampaignIdRows: number;
    metricRollups: AdsAutomationReadonlyPlatformMetricEntityCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  adGroups: {
    adGroupIds: string[];
    readModelAdGroupIds: string[];
    missingReadModelAdGroupIds: string[];
    coveredAdGroupCount: number;
    missingAdGroupIdRows: number;
    metricRollups: AdsAutomationReadonlyPlatformMetricEntityCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  campaignBudgets: {
    campaignBudgetIds: string[];
    readModelCampaignBudgetIds: string[];
    missingReadModelCampaignBudgetIds: string[];
    coveredCampaignBudgetCount: number;
    missingCampaignBudgetIdRows: number;
    campaignBudgetId_required: true;
    campaignBudgetId_no_fallback: true;
    campaignBudgetId_fallback_used: false;
    metricRollups: AdsAutomationReadonlyPlatformMetricEntityCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  productMapping: {
    mappedProductIds: string[];
    mappedAdGroupIds: string[];
    unmappedAdGroupIds: string[];
    sourceReady: boolean;
    productMappings: AdsAutomationReadonlyProductMappingCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  inventoryProfit: {
    profitableProductIds: string[];
    blockedProductIds: string[];
    missingMappedProductIds: string[];
    sourceReady: boolean;
    productReadiness: AdsAutomationReadonlyInventoryProfitCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  supplierContext: {
    safeSupplierIds: string[];
    blockedSupplierIds: string[];
    missingMappedSupplierIds: string[];
    supplierChoiceSafe: boolean;
    sourceReady: boolean;
    supplierReadiness: AdsAutomationReadonlySupplierSafetyCoverageRow[];
    blockers: string[];
    coveredForDecision: boolean;
  };
  freshnessCoverage: {
    latestSuccessfulSyncAt: string | null;
    latestRecordDate: string | null;
    blockingReasons: string[];
  };
}

export interface AdsAutomationReadonlyCashflowFirstGateCheck {
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
  blocker: string | null;
}

export interface AdsAutomationReadonlyPlatformImportReadinessSummary {
  status: AdsAutomationReadonlyImportReadinessStatus;
  fixture_mode: "htx_ads_readiness_demo" | "custom_local_payload";
  account_count: number;
  ready_account_count: number;
  blocked_account_count: number;
  metric_row_count: number;
  metric_rows_ready: number;
  required_source_count: number;
  required_source_ready_count: number;
  required_source_blocked_count: number;
  required_source_report_date_covered_count: number;
  required_source_report_date_blocked_count: number;
  missing_required_source_evidence: string[];
  source_coverage_blocking_reasons: string[];
  stale_or_missing_imports: string[];
  missing_account_mapping: string[];
  retry_blocked_accounts: string[];
  campaignBudgetId_missing_rows: number;
  source_sync_blocker_count: number;
  cashflow_first_scale_all_safe: boolean;
  scale_up_execution_mode: "monitor_only" | "pending_validation";
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | "resolve_readonly_import_readiness_blockers"
    | "review_local_readonly_import_evidence";
}

export interface AdsAutomationReadonlyDecisionReadinessSourceBlocker {
  sourceKey: SourceSyncDecisionEvidence["sourceKey"] | string;
  blockedCategories: AdsAutomationCategoryKey[];
  blockingReasons: string[];
}

export interface AdsAutomationReadonlyDecisionReadinessCategoryGate {
  key: AdsAutomationCategoryKey;
  snapshotStatus: AdsAutomationDecisionStatus | "no_candidates";
  canGenerateActionDraft: boolean;
  sourceBlockers: string[];
  readonlyImportBlockers: string[];
  readModelBlockers: string[];
  cashflowBlockers: string[];
}

export interface AdsAutomationReadonlySourceImportCoverage {
  sourceKey: SourceSyncDecisionEvidence["sourceKey"] | string;
  reportDate: string;
  expectedReportDate: string;
  reportDateMatches: boolean;
  freshnessStatus:
    | NonNullable<SourceSyncDecisionEvidence["freshnessStatus"]>
    | "unknown";
  coverageStatus:
    | NonNullable<SourceSyncDecisionEvidence["coverageStatus"]>
    | "unknown";
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  latestRecordDateCoversReportDate: boolean;
  blockingReason: string | null;
  blockingReasons: string[];
  affectedDecisionCategories: AdsAutomationCategoryKey[];
  canUseForAdsAutomationDecision: boolean;
}

export type AdsAutomationReadonlyDecisionCandidateEffectiveStatus =
  | "candidate_for_review"
  | "blocked"
  | "monitor_only";

export interface AdsAutomationReadonlyDecisionReadinessCandidate {
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
  blockers: string[];
  missingFields: string[];
  approval_required: true;
  execution_allowed_now: false;
}

export interface AdsAutomationReadonlyDecisionReadinessAnswers {
  may_increase_ads: boolean;
  max_increase_vnd: number;
  scale_up_execution_mode: "monitor_only" | "pending_validation";
  ad_groups_to_increase: AdsAutomationReadonlyDecisionReadinessCandidate[];
  target_ad_groups: AdsAutomationReadonlyDecisionReadinessCandidate[];
  products_can_receive_budget: AdsAutomationReadonlyDecisionReadinessCandidate[];
  blocked_product_budget_candidates: AdsAutomationReadonlyDecisionReadinessCandidate[];
  supplier_choice_safe: boolean;
  safe_supplier_choices: AdsAutomationReadonlyDecisionReadinessCandidate[];
  blocked_supplier_choices: AdsAutomationReadonlyDecisionReadinessCandidate[];
  product_kill_or_stop_review_needed: boolean;
  product_kill_or_stop_review: AdsAutomationReadonlyDecisionReadinessCandidate[];
  campaign_or_ad_group_pause_recommended: boolean;
  campaign_or_ad_group_pause: AdsAutomationReadonlyDecisionReadinessCandidate[];
  blocking_reasons: string[];
  execution_allowed_now: false;
}

export interface AdsAutomationReadonlyDecisionReadiness {
  status: AdsAutomationReadonlyImportReadinessStatus;
  source_gate_status: "ready" | "blocked";
  readonly_import_status: "ready" | "blocked";
  read_model_status: "ready" | "blocked" | "missing";
  source_gate_blockers: string[];
  readonly_import_blockers: string[];
  read_model_blockers: string[];
  cashflow_blockers: string[];
  required_source_evidence: SourceSyncDecisionEvidence[];
  sourceImportCoverage: AdsAutomationReadonlySourceImportCoverage[];
  source_to_decision_blockers: AdsAutomationReadonlyDecisionReadinessSourceBlocker[];
  decision_categories: AdsAutomationReadonlyDecisionReadinessCategoryGate[];
  action_generation_allowed_for_review: boolean;
  can_generate_action_draft: boolean;
  can_increase_ads: boolean;
  max_increase_vnd: number;
  scale_up_execution_mode: "monitor_only" | "pending_validation";
  execution_allowed_now: false;
  answers: AdsAutomationReadonlyDecisionReadinessAnswers;
  candidates: {
    adGroupsToIncrease: AdsAutomationReadonlyDecisionReadinessCandidate[];
    targetAdGroups: AdsAutomationReadonlyDecisionReadinessCandidate[];
    productsEligibleForBudget: AdsAutomationReadonlyDecisionReadinessCandidate[];
    supplierChoices: AdsAutomationReadonlyDecisionReadinessCandidate[];
    productKillOrStopReview: AdsAutomationReadonlyDecisionReadinessCandidate[];
    campaignOrAdGroupPause: AdsAutomationReadonlyDecisionReadinessCandidate[];
  };
  readModelEvidence: {
    sourceEvidence: AdsAutomationDecisionSourceEvidence[];
    missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[];
  };
}

export interface AdsAutomationReadonlyPlatformImportReadinessResponse {
  schemaVersion: "ads_automation_readonly_platform_import_readiness.v1";
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationReadonlyPlatformImportReadinessSafety;
  summary: AdsAutomationReadonlyPlatformImportReadinessSummary;
  sourceSyncSummary: Pick<
    AdsAutomationPlatformSourceSyncStatusResponse["summary"],
    | "status"
    | "blocked_sources"
    | "stale_sources"
    | "missing_config_sources"
    | "missing_coverage_sources"
    | "not_synced_sources"
  > | null;
  sourceImportCoverage: AdsAutomationReadonlySourceImportCoverage[];
  platformEntityCoverage: AdsAutomationReadonlyPlatformEntityCoverage;
  accounts: AdsAutomationReadonlyImportAccountReadiness[];
  metricRows: AdsAutomationReadonlyMetricReadinessRow[];
  cashflowFirstGate: {
    all_safe: boolean;
    checks: AdsAutomationReadonlyCashflowFirstGateCheck[];
    blockers: string[];
    scale_up_execution_mode: "monitor_only" | "pending_validation";
    can_recommend_scale_from_import_readiness: boolean;
    execution_allowed_now: false;
  };
  decisionReadiness: AdsAutomationReadonlyDecisionReadiness;
  lossLimitPolicy: Pick<
    AdsAutomationLossLimitPolicyResponse,
    "schemaVersion" | "summary" | "scaleBlockers"
  > | null;
  blockers: string[];
  warnings: string[];
  markdownPreview: string;
}
