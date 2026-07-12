import type { AdsAutomationDecisionSnapshot } from './ads-automation-decision.contract';
import type { AdsAutomationDecisionDraftPreviewResponse } from './ads-automation-decision-draft-preview.contract';
import type { AdsAutomationDecisionReadModelQueryResult } from './ads-automation-decision-read-model-query.contract';
import type { AdsAutomationPendingErpActionNormalizationResponse } from './ads-automation-pending-erp-action.contract';
import type { AdsAutomationProviderValidateOnlyLaneResponse } from './ads-automation-provider-validate-only.contract';
import type { AdsAutomationReadonlyPlatformImportReadinessResponse } from './ads-automation-readonly-platform-import-readiness.contract';

export type AdsAutomationGoogleAdsMockImportCashflowMode =
  | 'safe'
  | 'unsafe';

export type AdsAutomationGoogleAdsMockImportSourceTrust =
  | 'fixture_verified'
  | 'erp_local_verified';

export interface AdsAutomationGoogleAdsMockImportMetricRowInput {
  accountId: string;
  customerId: string;
  loginCustomerId?: string | null;
  accountName?: string | null;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  adGroupId: string;
  adGroupName: string;
  adGroupStatus: string;
  adId?: string | null;
  adName?: string | null;
  adStatus?: string | null;
  campaignBudgetId?: string | null;
  campaignBudgetResourceName?: string | null;
  campaignBudgetAmountVnd: number;
  costVnd: number;
  spendVnd?: number;
  clicks: number;
  impressions: number;
  conversions: number;
  orders: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitAfterAdsVnd: number;
  returnRatePercent: number;
  dataQualityScore: number;
  reportDate: string;
  lastSuccessfulSyncAt: string;
  importRunId: string;
  sourceTrustLevel: AdsAutomationGoogleAdsMockImportSourceTrust;
  mappedProductIds: string[];
}

export interface AdsAutomationGoogleAdsMockImportProductInput {
  productId: string;
  sku: string;
  name: string;
  netProfitVnd: number;
  adAttributedNetProfitAfterAdsVnd: number;
  marginPercent: number;
  returnCancelRefundRatePercent: number;
  stockAvailable: number;
  reservedQuantity: number;
  incomingQuantity: number;
  daysOfCover: number;
  mediaReady: boolean;
  landingReady: boolean;
  offerReady: boolean;
  mappedAdGroupIds: string[];
  supplierIds: string[];
  fulfillmentCapacityStatus: 'available' | 'constrained' | 'blocked';
  cashConversionStatus: 'safe' | 'unsafe' | 'unknown';
}

export interface AdsAutomationGoogleAdsMockImportSupplierInput {
  productId: string;
  supplierId: string;
  supplierName: string;
  quoteApproved: boolean;
  currentQuoteVnd: number;
  priorQuoteVnd: number;
  marginAfterCostPercent: number;
  leadTimeDays: number;
  lateDeliveryRatePercent: number;
  paymentFreshnessDays: number;
  capacityStatus: 'available' | 'constrained' | 'blocked';
  returnFaultRatePercent: number;
}

export interface AdsAutomationGoogleAdsMockImportOrderProfitInput {
  orderId: string;
  productId: string;
  supplierId: string;
  adGroupId: string;
  quantity: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitVnd: number;
  cashCollectedVnd: number;
  cashConversionDays: number;
  refundRiskPercent: number;
}

export interface AdsAutomationGoogleAdsMockImportPolicyInput {
  availableAdsCashVnd: number;
  cashflowGatePassed: boolean;
  maxBudgetIncreasePercent: number;
  mediumConfidenceIncreasePercent: number;
  minOrdersForScale: number;
  minDataQualityScore: number;
  minSpendForPauseVnd: number;
  maxReturnRatePercent: number;
  minMarginPercent: number;
  minStockAvailable: number;
  minDaysOfCover: number;
  maxSupplierLeadTimeDays: number;
  maxSupplierLateDeliveryRatePercent: number;
  maxSupplierReturnFaultRatePercent: number;
  maxSupplierPaymentFreshnessDays: number;
}

export interface AdsAutomationGoogleAdsMockImportDemoInput {
  reportDate: string;
  now: string;
  importRunId: string;
  cashflowMode: AdsAutomationGoogleAdsMockImportCashflowMode;
  accountId: string;
  customerId: string;
  loginCustomerId: string;
  accountName: string;
  sourceTrustLevel: AdsAutomationGoogleAdsMockImportSourceTrust;
  googleAdsRows: AdsAutomationGoogleAdsMockImportMetricRowInput[];
  products: AdsAutomationGoogleAdsMockImportProductInput[];
  suppliers: AdsAutomationGoogleAdsMockImportSupplierInput[];
  orderProfitRows: AdsAutomationGoogleAdsMockImportOrderProfitInput[];
  policy: AdsAutomationGoogleAdsMockImportPolicyInput;
}

export interface AdsAutomationGoogleAdsMockImportNormalizedRow {
  platform: 'google_ads';
  accountId: string;
  customerId: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  adGroupId: string;
  adGroupName: string;
  adGroupStatus: string;
  adId: string | null;
  adName: string | null;
  adStatus: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  campaignBudgetAmountVnd: number;
  costVnd: number;
  spendVnd: number;
  clicks: number;
  impressions: number;
  conversions: number;
  orders: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitAfterAdsVnd: number;
  returnRatePercent: number;
  dataQualityScore: number;
  reportDate: string;
  freshnessStatus: 'fresh' | 'stale';
  coverageStatus: 'covered' | 'missing';
  lastSuccessfulSyncAt: string;
  importRunId: string;
  sourceTrustLevel: AdsAutomationGoogleAdsMockImportSourceTrust;
  mappedProductIds: string[];
  blockers: string[];
  canUseForAdsAutomationDecision: boolean;
}

export interface AdsAutomationGoogleAdsMockImportErpMappingEvidence {
  productId: string;
  supplierIds: string[];
  mappedAdGroupIds: string[];
  orderCount: number;
  revenueVnd: number;
  grossProfitVnd: number;
  netProfitVnd: number;
  contributionProfitVnd: number;
  cashCollectedVnd: number;
  cashConversionStatus: 'safe' | 'unsafe' | 'unknown';
  stockAvailable: number;
  daysOfCover: number;
  fulfillmentCapacityStatus: 'available' | 'constrained' | 'blocked';
  returnCancelRefundRatePercent: number;
}

export interface AdsAutomationGoogleAdsMockImportApprovalEvidence {
  pending_action_id: string;
  approval_id: string;
  action_type: string;
  approval_status: 'pending_approval_required' | 'approved_demo_local_only';
  validation_status: string;
  preflight_status: 'recorded_local_only_blocked_future_live' | 'not_applicable_non_provider_action';
  audit_correlation_id: string;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  adId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  productId: string | null;
  supplierId: string | null;
  requested_change: Record<string, unknown>;
  reason: string;
  blockers: string[];
  source_freshness: Array<{
    sourceKey: string;
    freshnessStatus: string | null;
    coverageStatus: string | null;
    canUseForAdsAutomationDecision: boolean;
  }>;
  idempotency_key: string;
  rollback_plan: string | null;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationGoogleAdsMockImportDryRunAuditRecord {
  execution_record_id: string;
  audit_correlation_id: string;
  approval_id: string;
  pending_action_id: string;
  action_type: string;
  validation_status: string;
  preflight_status: 'recorded_local_only_blocked_future_live' | 'not_applicable_non_provider_action';
  dry_run_record_status: 'recorded_local_only';
  approval_status: 'approved_demo_local_only' | 'pending_approval_required';
  identifiers: {
    customerId: string | null;
    campaignId: string | null;
    adGroupId: string | null;
    adId: string | null;
    campaignBudgetId: string | null;
    campaignBudgetResourceName: string | null;
  };
  requested_change: Record<string, unknown>;
  blockers: string[];
  idempotency_key: string;
  campaignBudgetId_fallback_used: false;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
}

export interface AdsAutomationGoogleAdsMockImportAlertRollbackEvidence {
  alert_id: string;
  severity: 'info' | 'warning' | 'critical';
  pending_action_id: string;
  action_type: string;
  trigger_signals: string[];
  rollback_plan: string;
  safe_action_preserved: 'monitor_only' | 'pause_ad_group' | 'pause_campaign' | 'stop_import_review';
  execution_allowed_now: false;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate {
  candidate_id: string;
  draft_id: string | null;
  pending_action_id: string | null;
  approval_id: string | null;
  action_type: string;
  candidate_status: 'pending_action_created' | 'blocked_before_pending_action';
  provider_validateOnly_readiness:
    | 'passed_mock_validateOnly'
    | 'ready_for_future_validateOnly'
    | 'blocked_before_validateOnly'
    | 'not_applicable_non_provider_action';
  validateOnly_plan_status: string | null;
  validateOnly_request_status: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  productId: string | null;
  supplierId: string | null;
  blockers: string[];
  blocked_source_keys: string[];
  read_model_blockers: string[];
  source_freshness: Array<{
    sourceKey: string;
    freshnessStatus: string | null;
    coverageStatus: string | null;
    canUseForAdsAutomationDecision: boolean;
    blockingReasons: string[];
  }>;
  campaignBudgetId_fallback_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
}

export interface AdsAutomationGoogleAdsMockImportValidateOnlyPreflight {
  status: 'ready_for_future_validateOnly_planning' | 'blocked_before_validateOnly';
  pending_action_candidate_status: 'pending_actions_created' | 'blocked_before_pending_action';
  source: 'erp_mock_import_read_model';
  candidate_count: number;
  pending_action_count: number;
  blocked_candidate_count: number;
  blocked_source_keys: string[];
  blockers: string[];
  candidates: AdsAutomationGoogleAdsMockImportValidateOnlyPreflightCandidate[];
  campaignBudgetId_fallback_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
}

export interface AdsAutomationGoogleAdsMockImportDemoResponse {
  schemaVersion: 'ads_automation_google_ads_mock_import_demo.v1';
  generatedAt: string;
  reportDate: string;
  importRunId: string;
  cashflowMode: AdsAutomationGoogleAdsMockImportCashflowMode;
  safety: {
    read_only: true;
    dry_run: true;
    local_fixture_only: true;
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
    campaignBudgetId_no_fallback: true;
    future_live_execution_allowed: false;
    execution_allowed_now: false;
    GOOGLE_ADS_PRODUCTION_ENABLED: false;
    production_ready: false;
    erp_only_future_validator_approver_executor: true;
  };
  summary: {
    normalized_google_ads_rows: number;
    rows_ready_for_decision: number;
    pending_actions_created: number;
    update_budget_actions: number;
    monitor_only_actions: number;
    pause_actions: number;
    stop_import_review_actions: number;
    supplier_or_product_blocker_actions: number;
    approval_evidence_records: number;
    dry_run_audit_records: number;
    alert_rollback_records: number;
    scale_up_execution_mode: 'pending_validation' | 'monitor_only';
    provider_api_called: false;
    google_ads_api_called: false;
    validateOnly_called: false;
    live_ads_execution_used: false;
    execution_allowed_now: false;
    production_ready: false;
  };
  importReadiness: AdsAutomationReadonlyPlatformImportReadinessResponse;
  normalizedImportRows: AdsAutomationGoogleAdsMockImportNormalizedRow[];
  erpMappingEvidence: AdsAutomationGoogleAdsMockImportErpMappingEvidence[];
  decisionReadModel: AdsAutomationDecisionReadModelQueryResult;
  decisionSnapshot: AdsAutomationDecisionSnapshot;
  draftPreview: AdsAutomationDecisionDraftPreviewResponse;
  pendingActionNormalization: AdsAutomationPendingErpActionNormalizationResponse;
  validateOnlyLane: AdsAutomationProviderValidateOnlyLaneResponse;
  validateOnlyPreflight: AdsAutomationGoogleAdsMockImportValidateOnlyPreflight;
  approvalEvidence: AdsAutomationGoogleAdsMockImportApprovalEvidence[];
  dryRunExecutionAuditRecords: AdsAutomationGoogleAdsMockImportDryRunAuditRecord[];
  alertRollbackEvidence: AdsAutomationGoogleAdsMockImportAlertRollbackEvidence[];
}
