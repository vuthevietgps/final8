export type AdsAutomationCategoryKey =
  | "scale_ads"
  | "scale_amount"
  | "target_ad_groups"
  | "product_budget_allocation"
  | "supplier_gate"
  | "product_kill_or_stop_review"
  | "campaign_or_ad_group_pause";

export type AdsAutomationDecisionStatus =
  | "scale_ready"
  | "safe"
  | "hold"
  | "blocked"
  | "needs_review"
  | "insufficient_data"
  | "no_candidates";

export type AdsAutomationRiskLevel = "low" | "medium" | "high";
export type AdsAutomationConfidence = "low" | "medium" | "high";

export interface AdsAutomationEvidenceWindow {
  from: string;
  to: string;
  days: number;
}

export interface AdsAutomationPolicyInput {
  availableAdsCashVnd?: number;
  cashflowGatePassed?: boolean;
  maxBudgetIncreasePercent?: number;
  mediumConfidenceIncreasePercent?: number;
  minOrdersForScale?: number;
  minDataQualityScore?: number;
  minSpendForPauseVnd?: number;
  maxReturnRatePercent?: number;
  minMarginPercent?: number;
  minStockAvailable?: number;
  minDaysOfCover?: number;
  maxSupplierLeadTimeDays?: number;
  maxSupplierLateDeliveryRatePercent?: number;
  maxSupplierReturnFaultRatePercent?: number;
  maxSupplierPaymentFreshnessDays?: number;
}

export interface AdsAutomationAdGroupInput {
  platform?: string;
  accountId?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  resourceName?: string;
  campaignBudgetId?: string;
  campaignBudgetResourceName?: string;
  currentStatus?: string;
  currentBudgetVnd?: number;
  spendVnd?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  conversionValueVnd?: number;
  orders?: number;
  revenueVnd?: number;
  grossProfitVnd?: number;
  netProfitAfterAdsVnd?: number;
  orderAdvertisingCostVnd?: number;
  spendSourceOfTruth?: "platform_spend" | string;
  spendReconciliationStatus?:
    | "matched"
    | "mismatch"
    | "missing_platform_spend"
    | "missing_order_attribution"
    | string;
  spendMismatchVnd?: number;
  spendMismatchPercent?: number;
  attributedOrderIds?: string[];
  excludedOrderIds?: string[];
  cancelledReturnedRefundedOrders?: number;
  returnRatePercent?: number;
  dataQualityScore?: number;
  labels?: string[];
  productIds?: string[];
  bottlenecksChecked?: boolean;
  evidenceWindow?: AdsAutomationEvidenceWindow;
}

export interface AdsAutomationProductInput {
  productId?: string;
  sku?: string;
  name?: string;
  netProfitVnd?: number;
  adAttributedNetProfitAfterAdsVnd?: number;
  marginPercent?: number;
  returnCancelRefundRatePercent?: number;
  stockAvailable?: number;
  reservedQuantity?: number;
  incomingQuantity?: number;
  daysOfCover?: number;
  mediaReady?: boolean;
  landingReady?: boolean;
  offerReady?: boolean;
  mappedAdGroupIds?: string[];
  supplierIds?: string[];
}

export interface AdsAutomationSupplierInput {
  productId?: string;
  supplierId?: string;
  supplierName?: string;
  quoteApproved?: boolean;
  currentQuoteVnd?: number;
  priorQuoteVnd?: number;
  marginAfterCostPercent?: number;
  leadTimeDays?: number;
  lateDeliveryRatePercent?: number;
  paymentFreshnessDays?: number;
  capacityStatus?: "available" | "constrained" | "blocked" | string;
  returnFaultRatePercent?: number;
}

export interface AdsAutomationDecisionSnapshotInput {
  snapshotDate?: string;
  evidenceWindow?: AdsAutomationEvidenceWindow;
  policy?: AdsAutomationPolicyInput;
  adGroups?: AdsAutomationAdGroupInput[];
  products?: AdsAutomationProductInput[];
  suppliers?: AdsAutomationSupplierInput[];
}

export interface AdsAutomationDecisionCategory {
  key: AdsAutomationCategoryKey;
  status: AdsAutomationDecisionStatus;
  candidate_count: number;
  missing_fields: string[];
  next_required_data: string[];
  blockers: string[];
}

export interface AdsAutomationDecisionItem {
  decision_id: string;
  decision_type: AdsAutomationCategoryKey;
  entity_type: "ad_group" | "campaign" | "product" | "supplier" | "policy";
  entity_id: string;
  platform: string | null;
  accountId: string | null;
  productId: string | null;
  supplierId: string | null;
  currentValue: Record<string, unknown> | null;
  proposedValue: Record<string, unknown> | null;
  evidence_window: AdsAutomationEvidenceWindow;
  evidence_metrics: Record<string, unknown>;
  data_quality_score: number;
  confidence: AdsAutomationConfidence;
  risk_level: AdsAutomationRiskLevel;
  status: AdsAutomationDecisionStatus;
  blockers: string[];
  missing_fields: string[];
  next_required_data: string[];
  approval_required: boolean;
  execution_allowed_now: false;
  idempotency_key: string | null;
  rollback_plan: string | null;
  rationale: string;
}

export interface AdsAutomationDecisionSnapshot {
  schemaVersion: "ads_automation_decision_snapshot.v1";
  generatedAt: string;
  snapshotDate: string;
  safety: {
    read_only: true;
    provider_api_used: false;
    google_ads_api_used: false;
    live_ads_execution_used: false;
    erp_mutation_used: false;
    payment_mutation_used: false;
    production_ready: false;
    approval_required_for_future_actions: true;
  };
  summary: {
    categories: number;
    decisions: number;
    scale_candidates: number;
    pause_candidates: number;
    product_scale_candidates: number;
    supplier_safe_candidates: number;
    insufficient_data_decisions: number;
  };
  categories: Record<AdsAutomationCategoryKey, AdsAutomationDecisionCategory>;
  decisions: AdsAutomationDecisionItem[];
}
