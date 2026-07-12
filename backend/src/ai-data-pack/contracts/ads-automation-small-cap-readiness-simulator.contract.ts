import type {
  AdsAutomationDecisionFoundationSnapshotResponse,
} from './ads-automation-decision-foundation-snapshot.contract';
import type {
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationLossLimitPolicyResponse,
} from './ads-automation-loss-limit-policy.contract';
import type {
  AdsAutomationProductionReadinessBridgeResponse,
} from './ads-automation-production-readiness-bridge.contract';
import type {
  AdsAutomationProviderAccountReadinessResponse,
} from './ads-automation-provider-account-readiness.contract';

export type AdsAutomationSmallCapReadinessFixtureMode =
  | 'htx_ads_small_cap_readiness_demo'
  | 'custom_local_payload';

export type AdsAutomationSmallCapReadinessStatus =
  | 'blocked_monitor_only'
  | 'ready_for_human_approval_dry_run'
  | 'blocked_no_budget_action';

export type AdsAutomationSmallCapReadinessStageKey =
  | 'decision_foundation'
  | 'draft_preview'
  | 'small_cap_budget'
  | 'loss_limit_policy'
  | 'provider_account_readiness'
  | 'approval_gate'
  | 'validate_only_gate'
  | 'execution_preflight'
  | 'production_bridge';

export type AdsAutomationSmallCapReadinessStageStatus =
  | 'ready'
  | 'pending'
  | 'blocked'
  | 'monitor_only';

export interface AdsAutomationSmallCapReadinessSimulatorInput {
  reportDate?: string;
  now?: string | Date;
  fixtureMode?: AdsAutomationSmallCapReadinessFixtureMode;
  maxSmallCapIncreaseVnd?: number;
  maxSmallCapIncreasePercent?: number;
  foundationSnapshot: AdsAutomationDecisionFoundationSnapshotResponse;
  draftPreview: AdsAutomationDecisionDraftPreviewResponse;
  lossLimitPolicy?: AdsAutomationLossLimitPolicyResponse | null;
  providerAccountReadiness?: AdsAutomationProviderAccountReadinessResponse | null;
  productionReadinessBridge?: AdsAutomationProductionReadinessBridgeResponse | null;
}

export interface AdsAutomationSmallCapReadinessSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
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
  campaignBudgetId_no_fallback: true;
  approval_required_for_all_drafts: true;
  future_provider_validateOnly_required_before_execution: true;
  future_live_execution_allowed: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationSmallCapBudgetCandidate {
  draft_id: string;
  source_decision_id: string;
  accountId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  productId: string | null;
  currentDailyBudgetVnd: number | null;
  requestedDailyBudgetVnd: number | null;
  requestedIncreaseVnd: number;
  maxSmallCapIncreaseVnd: number;
  maxSmallCapIncreasePercent: number;
  capByPercentVnd: number | null;
  simulatedCappedIncreaseVnd: number;
  simulatedCappedDailyBudgetVnd: number | null;
  approvedIncreaseVnd: 0;
  blockedIncreaseVnd: number;
  campaignBudgetIdNoFallback: true;
  status:
    | 'eligible_for_small_cap_simulation'
    | 'blocked_missing_campaignBudgetId'
    | 'blocked_missing_budget_numbers';
  blockers: string[];
}

export interface AdsAutomationSmallCapReadinessStage {
  stage: AdsAutomationSmallCapReadinessStageKey;
  status: AdsAutomationSmallCapReadinessStageStatus;
  blockers: string[];
  evidence: string[];
  next_required_action: string;
}

export interface AdsAutomationSmallCapReadinessSourceDigest {
  foundation_snapshot_schema_version:
    AdsAutomationDecisionFoundationSnapshotResponse['schemaVersion'];
  draft_preview_schema_version:
    AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];
  loss_limit_policy_schema_version:
    AdsAutomationLossLimitPolicyResponse['schemaVersion'] | null;
  provider_account_readiness_schema_version:
    AdsAutomationProviderAccountReadinessResponse['schemaVersion'] | null;
  production_readiness_bridge_schema_version:
    AdsAutomationProductionReadinessBridgeResponse['schemaVersion'] | null;
  source_snapshot_date: string;
  draft_preview_source: AdsAutomationDecisionDraftPreviewResponse['source'];
  decision_snapshot_reused: true;
  read_model_snapshot_preserved: true;
  draft_preview_reused: true;
}

export interface AdsAutomationSmallCapReadinessSummary {
  status: AdsAutomationSmallCapReadinessStatus;
  fixture_mode: AdsAutomationSmallCapReadinessFixtureMode;
  reportDate: string;
  provider_action_drafts: number;
  update_budget_drafts: number;
  eligible_small_cap_candidates: number;
  blocked_small_cap_candidates: number;
  requested_increase_vnd: number;
  simulated_capped_increase_vnd: number;
  approved_increase_vnd: 0;
  blocked_increase_vnd: number;
  scale_up_execution_mode: 'monitor_only' | 'pending_validation';
  local_dry_run_only: true;
  small_cap_live_test_allowed: false;
  provider_validateOnly_required_before_future_execution: true;
  human_approval_required_before_future_execution: true;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | 'resolve_small_cap_readiness_blockers'
    | 'review_human_approval_dry_run_packet';
}

export interface AdsAutomationSmallCapReadinessSimulatorResponse {
  schemaVersion: 'ads_automation_small_cap_readiness_simulator.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationSmallCapReadinessSafety;
  summary: AdsAutomationSmallCapReadinessSummary;
  sourceDigest: AdsAutomationSmallCapReadinessSourceDigest;
  budgetCandidates: AdsAutomationSmallCapBudgetCandidate[];
  stages: AdsAutomationSmallCapReadinessStage[];
  readinessBlockers: string[];
  cashflowAndLossLimitBlockers: string[];
  providerReadinessBlockers: string[];
  allowedSafeActions: Array<'monitor_only' | 'pause_campaign' | 'pause_ad_group' | 'reduce_campaign_budget'>;
  reviewedDrafts: Pick<
    AdsAutomationDecisionDraftPreview,
    | 'draft_id'
    | 'action_type'
    | 'action_family'
    | 'provider'
    | 'resource_type'
    | 'status'
    | 'execution_allowed_now'
    | 'validate_only_required'
    | 'provider_api_called'
    | 'google_ads_api_called'
    | 'live_ads_execution_used'
    | 'missing_data_blockers'
    | 'blockers'
  >[];
  markdownPreview: string;
}
