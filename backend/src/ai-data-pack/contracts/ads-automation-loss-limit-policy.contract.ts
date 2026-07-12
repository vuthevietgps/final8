export type AdsAutomationLossLimitPolicyActionType =
  | 'update_campaign_budget'
  | 'pause_campaign'
  | 'pause_ad_group'
  | 'monitor_only';

export type AdsAutomationLossLimitPolicyActionMode =
  | 'scale_up'
  | 'reduce_or_pause'
  | 'monitor_only';

export type AdsAutomationLossLimitPolicyStatus =
  | 'ready_for_local_review'
  | 'blocked';

export type AdsAutomationLossLimitPolicyScopeType =
  | 'campaign'
  | 'ad_group'
  | 'product';

export interface AdsAutomationLossLimitPolicyApprovalInput {
  approvalRequired?: boolean;
  approvalId?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  status?: 'approved' | 'pending' | 'rejected' | null;
}

export interface AdsAutomationLossLimitPolicyActionInput {
  actionType: AdsAutomationLossLimitPolicyActionType;
  customerId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  campaignBudgetResourceName?: string | null;
  productId?: string | null;
  currentDailyBudgetVnd?: number | null;
  requestedDailyBudgetVnd?: number | null;
}

export interface AdsAutomationLossLimitPolicyGlobalLimitsInput {
  dailyLossLimitVnd: number;
  currentDailyLossVnd: number;
  projectedDailyLossAfterActionVnd: number;
  monthToDateLossLimitVnd: number;
  currentMonthToDateLossVnd: number;
  projectedMonthToDateLossAfterActionVnd: number;
  emergencyStopEnabled?: boolean;
  killSwitchEnabled?: boolean;
  killSwitchReason?: string | null;
}

export interface AdsAutomationLossLimitPolicySpendCapInput {
  scopeType: AdsAutomationLossLimitPolicyScopeType;
  scopeId: string;
  campaignBudgetId?: string | null;
  currentDailyBudgetVnd: number;
  requestedDailyBudgetVnd: number;
  maxDailyBudgetVnd: number;
  maxIncreasePercent: number;
  currentMonthSpendVnd?: number | null;
  monthlySpendCapVnd?: number | null;
}

export interface AdsAutomationLossLimitPolicyEconomicsInput {
  productId?: string | null;
  adGroupId?: string | null;
  grossMarginPercent: number;
  minGrossMarginPercent: number;
  contributionProfitVnd: number;
  minContributionProfitVnd: number;
  cashConversionDays: number;
  maxCashConversionDays: number;
  workingCapitalAvailableVnd: number;
  minWorkingCapitalRequiredVnd: number;
  stockCoverageSafe?: boolean;
  supplierReliabilitySafe?: boolean;
  fulfillmentCapacitySafe?: boolean;
  returnRefundRiskSafe?: boolean;
  dataFreshnessSafe?: boolean;
}

export interface AdsAutomationLossLimitPolicyInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: 'htx_ads_loss_policy_demo' | 'custom_local_payload';
  action: AdsAutomationLossLimitPolicyActionInput;
  approval?: AdsAutomationLossLimitPolicyApprovalInput;
  globalLimits: AdsAutomationLossLimitPolicyGlobalLimitsInput;
  spendCaps: AdsAutomationLossLimitPolicySpendCapInput[];
  economics: AdsAutomationLossLimitPolicyEconomicsInput[];
}

export interface AdsAutomationLossLimitPolicySafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  persistence_used: false;
  durable_storage_used: false;
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
  approval_required_for_all_actions: true;
  campaignBudgetId_no_fallback: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
}

export type AdsAutomationLossLimitPolicyCheckKey =
  | 'human_approval_present'
  | 'campaignBudgetId_present'
  | 'emergency_stop_clear'
  | 'daily_loss_limit_safe'
  | 'monthly_loss_limit_safe'
  | 'spend_caps_safe'
  | 'gross_margin_safe'
  | 'contribution_profit_positive'
  | 'cash_conversion_working_capital_safe'
  | 'stock_coverage_safe'
  | 'supplier_reliability_safe'
  | 'fulfillment_capacity_safe'
  | 'return_refund_risk_safe'
  | 'data_freshness_safe';

export interface AdsAutomationLossLimitPolicyCheck {
  key: AdsAutomationLossLimitPolicyCheckKey;
  passed: boolean;
  blockers: string[];
  evidence: string;
}

export interface AdsAutomationLossLimitPolicySpendCapDecision {
  scopeType: AdsAutomationLossLimitPolicyScopeType;
  scopeId: string;
  campaignBudgetId: string | null;
  currentDailyBudgetVnd: number;
  requestedDailyBudgetVnd: number;
  maxDailyBudgetVnd: number;
  maxIncreasePercent: number;
  increasePercent: number;
  currentMonthSpendVnd: number | null;
  monthlySpendCapVnd: number | null;
  status: 'safe' | 'blocked';
  blockers: string[];
}

export interface AdsAutomationLossLimitPolicyEconomicsDecision {
  productId: string | null;
  adGroupId: string | null;
  grossMarginPercent: number;
  minGrossMarginPercent: number;
  contributionProfitVnd: number;
  minContributionProfitVnd: number;
  cashConversionDays: number;
  maxCashConversionDays: number;
  workingCapitalAvailableVnd: number;
  minWorkingCapitalRequiredVnd: number;
  status: 'safe' | 'blocked';
  blockers: string[];
}

export interface AdsAutomationLossLimitPolicySummary {
  status: AdsAutomationLossLimitPolicyStatus;
  fixture_mode: 'htx_ads_loss_policy_demo' | 'custom_local_payload';
  requested_action_type: AdsAutomationLossLimitPolicyActionType;
  requested_action_mode: AdsAutomationLossLimitPolicyActionMode;
  policy_allowed_for_requested_action: boolean;
  all_safe_for_increase: boolean;
  scale_up_execution_mode: 'monitor_only' | 'pending_validation';
  human_approval_required: true;
  human_approval_present: boolean;
  emergency_stop_active: boolean;
  daily_loss_limit_safe: boolean;
  monthly_loss_limit_safe: boolean;
  spend_caps_safe: boolean;
  gross_margin_safe: boolean;
  contribution_profit_safe: boolean;
  cash_conversion_working_capital_safe: boolean;
  stock_coverage_safe: boolean;
  supplier_reliability_safe: boolean;
  fulfillment_capacity_safe: boolean;
  return_refund_risk_safe: boolean;
  data_freshness_safe: boolean;
  campaignBudgetId_missing: boolean;
  safe_reduction_or_pause_available: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | 'resolve_loss_limit_policy_blockers'
    | 'review_local_loss_limit_policy_evidence';
}

export interface AdsAutomationLossLimitPolicyResponse {
  schemaVersion: 'ads_automation_loss_limit_policy.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationLossLimitPolicySafety;
  summary: AdsAutomationLossLimitPolicySummary;
  action: Required<AdsAutomationLossLimitPolicyActionInput>;
  approval: Required<AdsAutomationLossLimitPolicyApprovalInput>;
  checks: AdsAutomationLossLimitPolicyCheck[];
  spendCapDecisions: AdsAutomationLossLimitPolicySpendCapDecision[];
  economicsDecisions: AdsAutomationLossLimitPolicyEconomicsDecision[];
  scaleBlockers: string[];
  requestedActionBlockers: string[];
  safeActionsAvailable: Array<'pause_campaign' | 'pause_ad_group' | 'reduce_campaign_budget' | 'monitor_only'>;
  markdownPreview: string;
}
