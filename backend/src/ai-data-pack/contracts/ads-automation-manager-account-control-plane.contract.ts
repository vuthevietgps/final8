export type AdsAutomationManagerProvider =
  | 'google_ads'
  | 'meta_ads'
  | 'tiktok_ads';

export type AdsAutomationManagerAccountType =
  | 'google_ads_mcc'
  | 'meta_business_manager'
  | 'tiktok_business_center';

export type AdsAutomationManagerControlPlaneFixtureMode =
  | 'htx_ads_manager_account_control_plane_demo'
  | 'custom_local_payload';

export type AdsAutomationManagerCredentialStatus =
  | 'ready'
  | 'missing'
  | 'expired'
  | 'revoked'
  | 'plaintext_rejected';

export type AdsAutomationManagerPermissionScope =
  | 'ads.readonly'
  | 'ads.validate_only'
  | 'ads.manage_budgets'
  | 'ads.pause'
  | 'business_management'
  | 'ads_management'
  | 'advertiser.read'
  | 'campaign.read'
  | 'campaign.write';

export type AdsAutomationManagerSyncStatus =
  | 'fresh'
  | 'stale'
  | 'missing'
  | 'blocked';

export type AdsAutomationManagerMappingStatus =
  | 'mapped'
  | 'missing'
  | 'stale'
  | 'blocked';

export type AdsAutomationManagerChannel =
  | 'search'
  | 'social_feed'
  | 'short_video'
  | 'unknown';

export type AdsAutomationManagerMvpAction =
  | 'update_campaign_budget'
  | 'pause_campaign'
  | 'pause_ad_group'
  | 'monitor_only'
  | 'supplier_sourcing'
  | 'product_offer_fix'
  | 'stop_import_review';

export type AdsAutomationManagerActionApprovalStatus =
  | 'approved'
  | 'pending'
  | 'missing'
  | 'rejected';

export type AdsAutomationManagerReadinessStatus =
  | 'ready_for_future_erp_validateOnly_contract'
  | 'ready_monitor_only'
  | 'blocked_before_provider_boundary';

export type AdsAutomationManagerGateKey =
  | 'manager_credential_readiness'
  | 'child_account_eligibility'
  | 'campaign_ad_group_mapping'
  | 'required_scopes'
  | 'campaignBudgetId_evidence'
  | 'approval'
  | 'validateOnly_readiness'
  | 'execution_preflight'
  | 'idempotency'
  | 'kill_switch'
  | 'cashflow_first_safety';

export interface AdsAutomationManagerCredentialMetadataInput {
  credentialReferenceId?: string | null;
  secret_reference_handle?: string | null;
  credentialStatus?: AdsAutomationManagerCredentialStatus;
  grantedScopes?: AdsAutomationManagerPermissionScope[];
  plaintextCredentialFieldNames?: string[];
  lastCheckedAt?: string | Date | null;
}

export interface AdsAutomationManagerCampaignBudgetEvidenceInput {
  campaignBudgetId?: string | null;
  campaignBudgetResourceName?: string | null;
  evidenceSource?: 'mock_fixture' | 'erp_read_model' | 'missing' | string | null;
  lastVerifiedAt?: string | Date | null;
}

export interface AdsAutomationManagerAdGroupInput {
  adGroupId?: string | null;
  adGroupName?: string | null;
  erpProductId?: string | null;
  erpProductName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  erpProductMappingStatus?: AdsAutomationManagerMappingStatus;
  supplierMappingStatus?: AdsAutomationManagerMappingStatus;
  profitMappingStatus?: AdsAutomationManagerMappingStatus;
  stockMappingStatus?: AdsAutomationManagerMappingStatus;
}

export interface AdsAutomationManagerCampaignInput {
  campaignId?: string | null;
  campaignName?: string | null;
  channel?: AdsAutomationManagerChannel | string | null;
  status?: string | null;
  campaignBudgetEvidence?: AdsAutomationManagerCampaignBudgetEvidenceInput | null;
  erpProductMappingStatus?: AdsAutomationManagerMappingStatus;
  supplierMappingStatus?: AdsAutomationManagerMappingStatus;
  orderProfitMappingStatus?: AdsAutomationManagerMappingStatus;
  cashflowMappingStatus?: AdsAutomationManagerMappingStatus;
  adGroups?: AdsAutomationManagerAdGroupInput[];
}

export interface AdsAutomationManagerChildAccountInput {
  childAccountId?: string | null;
  childAccountName?: string | null;
  erpAccountMappingId?: string | null;
  authorizedUnderManager?: boolean;
  approvedForReadOnlyImport?: boolean;
  approvedForFutureProviderActions?: boolean;
  active?: boolean;
  syncStatus?: AdsAutomationManagerSyncStatus;
  lastSyncAt?: string | Date | null;
  campaigns?: AdsAutomationManagerCampaignInput[];
}

export interface AdsAutomationManagerAccountInput {
  provider: AdsAutomationManagerProvider;
  managerAccountType: AdsAutomationManagerAccountType;
  managerAccountId?: string | null;
  managerAccountName?: string | null;
  credentialMetadata?: AdsAutomationManagerCredentialMetadataInput | null;
  requiredScopes?: AdsAutomationManagerPermissionScope[];
  childAccounts?: AdsAutomationManagerChildAccountInput[];
}

export interface AdsAutomationManagerBusinessSafetyInput {
  cashflowSafe?: boolean;
  grossMarginSafe?: boolean;
  contributionProfitSafe?: boolean;
  stockCoverageSafe?: boolean;
  supplierReliabilitySafe?: boolean;
  fulfillmentCapacitySafe?: boolean;
  refundRiskSafe?: boolean;
  dataFreshnessSafe?: boolean;
  dailyLossLimitSafe?: boolean;
  monthlyLossLimitSafe?: boolean;
}

export interface AdsAutomationManagerPendingActionInput {
  actionId: string;
  actionType: AdsAutomationManagerMvpAction | string;
  provider: AdsAutomationManagerProvider;
  managerAccountId?: string | null;
  childAccountId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  currentDailyBudgetVnd?: number | null;
  requestedDailyBudgetVnd?: number | null;
  approvalId?: string | null;
  approvalStatus?: AdsAutomationManagerActionApprovalStatus;
  validateOnlyReadiness?: 'ready' | 'missing' | 'failed' | 'not_required';
  preflightReadiness?: 'ready' | 'missing' | 'failed';
  auditEvidenceId?: string | null;
  rollbackPlanId?: string | null;
  idempotencyKey?: string | null;
  killSwitchArmed?: boolean;
  businessSafety?: AdsAutomationManagerBusinessSafetyInput | null;
  channel?: AdsAutomationManagerChannel | string | null;
}

export interface AdsAutomationManagerAccountControlPlaneInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: AdsAutomationManagerControlPlaneFixtureMode;
  managerAccounts: AdsAutomationManagerAccountInput[];
  pendingActions: AdsAutomationManagerPendingActionInput[];
}

export interface AdsAutomationManagerCredentialReadiness {
  status: AdsAutomationManagerCredentialStatus;
  credentialReferenceId: string | null;
  secret_reference_handle: string | null;
  grantedScopes: AdsAutomationManagerPermissionScope[];
  missingScopes: AdsAutomationManagerPermissionScope[];
  plaintextCredentialFieldCount: number;
  metadataOnly: true;
  redacted_handle_only: true;
  real_credential_material_present: false;
  lastCheckedAt: string | null;
}

export interface AdsAutomationManagerCampaignBudgetEvidence {
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  evidenceSource: string | null;
  lastVerifiedAt: string | null;
  campaignBudgetIdNoFallback: true;
}

export interface AdsAutomationManagerAdGroupReadiness {
  adGroupId: string | null;
  adGroupName: string | null;
  erpProductId: string | null;
  erpProductName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  erpProductMappingStatus: AdsAutomationManagerMappingStatus;
  supplierMappingStatus: AdsAutomationManagerMappingStatus;
  profitMappingStatus: AdsAutomationManagerMappingStatus;
  stockMappingStatus: AdsAutomationManagerMappingStatus;
  controlEligible: boolean;
  blockers: string[];
}

export interface AdsAutomationManagerCampaignReadiness {
  campaignId: string | null;
  campaignName: string | null;
  channel: AdsAutomationManagerChannel;
  status: string | null;
  campaignBudgetEvidence: AdsAutomationManagerCampaignBudgetEvidence;
  erpProductMappingStatus: AdsAutomationManagerMappingStatus;
  supplierMappingStatus: AdsAutomationManagerMappingStatus;
  orderProfitMappingStatus: AdsAutomationManagerMappingStatus;
  cashflowMappingStatus: AdsAutomationManagerMappingStatus;
  adGroups: AdsAutomationManagerAdGroupReadiness[];
  controlEligible: boolean;
  blockers: string[];
}

export interface AdsAutomationManagerChildAccountReadiness {
  childAccountId: string | null;
  childAccountName: string | null;
  erpAccountMappingId: string | null;
  authorizedUnderManager: boolean;
  approvedForReadOnlyImport: boolean;
  approvedForFutureProviderActions: boolean;
  active: boolean;
  syncStatus: AdsAutomationManagerSyncStatus;
  lastSyncAt: string | null;
  campaigns: AdsAutomationManagerCampaignReadiness[];
  canDiscoverReadViaManagerCredential: boolean;
  canUseForFutureValidateOnly: boolean;
  canUseForFutureExecution: false;
  execution_allowed_now: false;
  blockers: string[];
}

export interface AdsAutomationManagerReadiness {
  provider: AdsAutomationManagerProvider;
  managerAccountType: AdsAutomationManagerAccountType;
  managerAccountId: string | null;
  managerAccountName: string | null;
  credentialReadiness: AdsAutomationManagerCredentialReadiness;
  requiredScopes: AdsAutomationManagerPermissionScope[];
  childAccounts: AdsAutomationManagerChildAccountReadiness[];
  controlFlow: AdsAutomationManagerControlFlowStep[];
  canDiscoverAuthorizedChildren: boolean;
  canUseForFutureValidateOnly: boolean;
  canUseForFutureExecution: false;
  execution_allowed_now: false;
  production_ready: false;
  blockers: string[];
  warnings: string[];
}

export interface AdsAutomationManagerControlFlowStep {
  step:
    | 'manager_credential_metadata'
    | 'discover_authorized_child_accounts'
    | 'read_campaigns_and_ad_groups'
    | 'map_erp_product_supplier_profit_cashflow'
    | 'draft_pending_actions'
    | 'human_approval'
    | 'provider_validateOnly'
    | 'execution_preflight'
    | 'future_erp_provider_execution';
  actor: 'erp_only';
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  status: 'contract_only' | 'blocked_until_future_erp_step';
  note: string;
}

export interface AdsAutomationManagerActionGate {
  key: AdsAutomationManagerGateKey;
  status: 'ready' | 'blocked' | 'not_required';
  blockers: string[];
}

export interface AdsAutomationManagerPendingActionReadiness {
  actionId: string;
  actionType: string;
  provider: AdsAutomationManagerProvider;
  managerAccountId: string | null;
  childAccountId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  currentDailyBudgetVnd: number | null;
  requestedDailyBudgetVnd: number | null;
  status: AdsAutomationManagerReadinessStatus;
  providerApiRequired: boolean;
  validateOnlyRequiredBeforeExecution: boolean;
  allowedMvpAction: boolean;
  campaignBudgetIdNoFallback: true;
  monitorOnlyDowngradeRequired: boolean;
  approval_can_be_considered_executable: false;
  execution_allowed_now: false;
  production_ready: false;
  gates: AdsAutomationManagerActionGate[];
  blockers: string[];
  warnings: string[];
  next_required_action:
    | 'review_future_erp_validateOnly_contract'
    | 'resolve_manager_control_plane_blockers'
    | 'use_monitor_only_safety_action';
}

export interface AdsAutomationManagerAdapterBoundary {
  provider: AdsAutomationManagerProvider;
  managerAccountType: AdsAutomationManagerAccountType;
  boundaryMode: 'erp_owned_contract_only';
  discoveryImportMode: 'mock_fixture_only';
  validateOnlyMode: 'future_erp_adapter_required';
  executionMode: 'future_erp_adapter_required';
  supportedMvpActions: AdsAutomationManagerMvpAction[];
  blockedCapabilities: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
}

export interface AdsAutomationManagerAccountControlPlaneSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  manager_credential_metadata_only: true;
  plaintext_secrets_added: false;
  plaintext_credentials_stored: false;
  real_credential_material_present: false;
  provider_api_used: false;
  provider_api_called: false;
  google_ads_api_used: false;
  google_ads_api_called: false;
  meta_api_used: false;
  meta_api_called: false;
  tiktok_api_used: false;
  tiktok_api_called: false;
  validateOnly_called: false;
  validate_only_provider_call_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  order_mutation_used: false;
  inventory_mutation_used: false;
  campaignBudgetId_no_fallback: true;
  approval_required_for_all_drafts: true;
  future_provider_validateOnly_required_before_execution: true;
  erp_only_future_validator_approver_executor: true;
  future_live_execution_allowed: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsAutomationManagerAccountControlPlaneSummary {
  status: 'ready_for_future_erp_validateOnly_contract' | 'blocked';
  fixture_mode: AdsAutomationManagerControlPlaneFixtureMode;
  manager_account_count: number;
  child_account_count: number;
  campaign_count: number;
  ad_group_count: number;
  pending_action_count: number;
  ready_manager_count: number;
  blocked_manager_count: number;
  ready_child_account_count: number;
  blocked_child_account_count: number;
  ready_pending_action_count: number;
  blocked_pending_action_count: number;
  monitor_only_action_count: number;
  missing_scope_count: number;
  missing_campaignBudgetId_count: number;
  plaintext_credential_metadata_rejected_count: number;
  provider_api_called: false;
  google_ads_api_called: false;
  meta_api_called: false;
  tiktok_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  scale_up_execution_mode: 'pending_validation' | 'monitor_only';
  next_required_action:
    | 'review_future_manager_control_plane_contract'
    | 'resolve_manager_control_plane_blockers';
}

export interface AdsAutomationManagerAccountControlPlaneResponse {
  schemaVersion: 'ads_automation_manager_account_control_plane.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationManagerAccountControlPlaneSafety;
  summary: AdsAutomationManagerAccountControlPlaneSummary;
  futureControlIntent: {
    erp_only_future_caller: true;
    manager_credential_controls_only_authorized_children: true;
    provider_discovery_import_validate_execute_adapter_boundary_only: true;
    real_tokens_required_later_in_erp_secret_store: true;
    codex_runner_must_not_receive_credentials: true;
    execution_allowed_now: false;
    production_ready: false;
  };
  adapterBoundaries: AdsAutomationManagerAdapterBoundary[];
  managerAccounts: AdsAutomationManagerReadiness[];
  pendingActions: AdsAutomationManagerPendingActionReadiness[];
  blockers: string[];
  warnings: string[];
  markdownPreview: string;
}
