import type {
  AdsAutomationDecisionDraftEvidenceReference,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './ads-automation-decision-draft-preview.contract';
import type { SourceSyncDecisionEvidence, SourceSyncDecisionGates } from '../source-sync/source-sync-result.types';

export const ADS_AUTOMATION_PENDING_ERP_ACTION_ALLOWLIST = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
  'monitor_only',
  'supplier_sourcing',
  'product_offer_fix',
  'stop_import_review',
] as const;

export type AdsAutomationPendingErpActionType =
  (typeof ADS_AUTOMATION_PENDING_ERP_ACTION_ALLOWLIST)[number];

export type AdsAutomationPendingErpActionStatus = 'pending_validation';

export type AdsAutomationPendingErpActionReviewDisposition =
  | 'pending_provider_validation'
  | 'blocked_by_platform_entity_coverage'
  | 'monitor_only_visible'
  | 'pending_internal_review';

export type AdsAutomationPlatformEntityCoverageActionBlockerFamily =
  | 'campaigns'
  | 'adGroups'
  | 'campaignBudgets'
  | 'productMapping'
  | 'inventoryProfit'
  | 'supplierContext'
  | 'freshnessCoverage';

export type AdsAutomationPlatformEntityCoverageActionBlockerScope =
  | 'campaignId'
  | 'adGroupId'
  | 'campaignBudgetId'
  | 'productId'
  | 'supplierId'
  | 'freshness';

export interface AdsAutomationPlatformEntityCoverageActionBlocker {
  blocker: string;
  family: AdsAutomationPlatformEntityCoverageActionBlockerFamily;
  scope: AdsAutomationPlatformEntityCoverageActionBlockerScope;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  productId: string | null;
  supplierId: string | null;
}

export interface AdsAutomationPendingErpActionNormalizationOptions {
  platformEntityCoverageBlockers?: string[];
  platformEntityCoverageActionBlockers?: AdsAutomationPlatformEntityCoverageActionBlocker[];
}

export interface AdsAutomationPendingErpActionIdentifiers {
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  productId: string | null;
  supplierId: string | null;
}

export interface AdsAutomationPendingErpActionSafetyFlags {
  approval_required: true;
  execution_allowed_now: false;
  validate_only_required: boolean;
  future_provider_validateOnly_required: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  production_ready: false;
}

export interface AdsAutomationPendingErpActionEvidence {
  rationale: string;
  source_evidence_references: AdsAutomationDecisionDraftEvidenceReference[];
  blockers: string[];
  missing_data_blockers: string[];
}

export interface AdsAutomationPendingErpActionSourceReadiness {
  sourceKey: string;
  reportDate: string | null;
  freshnessStatus: string | null;
  coverageStatus: string | null;
  lastSuccessfulSyncAt: string | null;
  latestRecordDate: string | null;
  canUseForAdsAutomationDecision: boolean;
  blockingReason: string | null;
  blockingReasons: string[];
}

export interface AdsAutomationPendingErpActionSourceGate {
  canRecommendAdsScale: boolean | null;
  canGenerateActionDraft: boolean | null;
  canUseGoogleAdsDataClaim: boolean | null;
  canImportActionFile: false;
  canDryRun: false;
  canExecuteLive: false;
}

export interface AdsAutomationPendingErpActionDecisionAnswer {
  decision_type: AdsAutomationDecisionDraftPreview['source_decision_type'];
  increase_ads: 'yes' | 'no' | 'not_applicable';
  increase_amount_vnd: number | null;
  target_ad_group_ids: string[];
  products_to_receive_budget: string[];
  supplier_choice_safety: 'safe' | 'needs_sourcing' | 'blocked' | 'not_applicable';
  product_kill_or_stop_import_review:
    | 'stop_import_review_required'
    | 'offer_fix_required'
    | 'not_applicable';
  campaign_or_ad_group_pause:
    | 'pause_campaign'
    | 'pause_ad_group'
    | 'monitor_only'
    | 'not_applicable';
  summary: string;
}

export interface AdsAutomationPendingErpActionRecord {
  pending_action_id: string;
  status: AdsAutomationPendingErpActionStatus;
  action_type: AdsAutomationPendingErpActionType;
  approval_id: string;
  source_schema_version: AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];
  source_preview_generatedAt: string;
  source_draft_id: string;
  source_decision_id: string;
  source_decision_type: AdsAutomationDecisionDraftPreview['source_decision_type'];
  action_family: AdsAutomationDecisionDraftFamily;
  provider: AdsAutomationDecisionDraftPreview['provider'];
  resource_type: AdsAutomationDecisionDraftPreview['resource_type'];
  entity_type: AdsAutomationDecisionDraftPreview['entity_type'];
  entity_id: string;
  accountId: string | null;
  platform: string | null;
  productId: string | null;
  supplierId: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  identifiers: AdsAutomationPendingErpActionIdentifiers;
  requested_change: Record<string, unknown>;
  reason: string;
  evidence: AdsAutomationPendingErpActionEvidence;
  source_readiness: AdsAutomationPendingErpActionSourceReadiness[];
  source_gate: AdsAutomationPendingErpActionSourceGate;
  platform_entity_coverage_blockers: string[];
  platform_entity_coverage_action_blockers: AdsAutomationPlatformEntityCoverageActionBlocker[];
  risk_blockers: string[];
  decision_answer: AdsAutomationPendingErpActionDecisionAnswer;
  review_disposition: AdsAutomationPendingErpActionReviewDisposition;
  safety_flags: AdsAutomationPendingErpActionSafetyFlags;
  idempotency_key: string;
  createdAt: string;
}

export interface AdsAutomationPendingErpActionNormalizationSafety {
  read_only: true;
  dry_run: true;
  in_memory_only: true;
  persistence_used: false;
  durable_storage_used: false;
  erp_local_persistence_used: false;
  provider_persistence_used: false;
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
  approval_required_for_all_actions: true;
  execution_allowed_now: false;
}

export interface AdsAutomationPendingErpActionNormalizationSummary {
  drafts_received: number;
  pending_actions_created: number;
  provider_action_records: number;
  internal_task_records: number;
  monitoring_records: number;
  platform_entity_blocker_count: number;
  scale_candidates_blocked_by_platform_entity_coverage: number;
}

export interface AdsAutomationPendingErpDecisionAnswers {
  increase_ads: 'yes_pending_validation' | 'no_budget_increase_pending';
  increase_amount_vnd: number;
  target_ad_group_ids: string[];
  products_to_receive_budget: string[];
  supplier_choice_safety: Array<{
    productId: string | null;
    supplierId: string | null;
    status: AdsAutomationPendingErpActionDecisionAnswer['supplier_choice_safety'];
    pending_action_id: string;
    blockers: string[];
  }>;
  product_kill_or_stop_import_review: Array<{
    productId: string | null;
    status: AdsAutomationPendingErpActionDecisionAnswer['product_kill_or_stop_import_review'];
    pending_action_id: string;
    blockers: string[];
  }>;
  campaign_or_ad_group_pause: Array<{
    campaignId: string | null;
    adGroupId: string | null;
    status: AdsAutomationPendingErpActionDecisionAnswer['campaign_or_ad_group_pause'];
    pending_action_id: string;
    blockers: string[];
  }>;
}

export interface AdsAutomationPendingErpActionNormalizationResponse {
  schemaVersion: 'ads_automation_pending_erp_action_normalization.v1';
  generatedAt: string;
  sourcePreviewSchemaVersion: AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];
  sourceSyncDecisionEvidence: SourceSyncDecisionEvidence[];
  sourceSyncDecisionGates: Partial<SourceSyncDecisionGates> | null;
  safety: AdsAutomationPendingErpActionNormalizationSafety;
  summary: AdsAutomationPendingErpActionNormalizationSummary;
  decisionAnswers: AdsAutomationPendingErpDecisionAnswers;
  pendingActions: AdsAutomationPendingErpActionRecord[];
}
