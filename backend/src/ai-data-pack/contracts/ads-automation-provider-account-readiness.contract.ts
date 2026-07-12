export type AdsAutomationProviderPlatform =
  | 'google_ads'
  | 'facebook_ads'
  | 'tiktok_ads';

export type AdsAutomationProviderAccountReadinessFixtureMode =
  | 'htx_ads_provider_account_readiness_demo'
  | 'custom_local_payload';

export type AdsAutomationProviderMvpAction =
  | 'update_campaign_budget'
  | 'pause_campaign'
  | 'pause_ad_group'
  | 'monitor_only';

export type AdsAutomationProviderPermissionScope =
  | 'ads.readonly'
  | 'ads.validate_only'
  | 'ads.manage_budgets'
  | 'ads.pause';

export type AdsAutomationProviderChannel =
  | 'search'
  | 'performance_max'
  | 'shopping'
  | 'display'
  | 'youtube'
  | 'unknown';

export type AdsAutomationProviderCredentialStatus =
  | 'ready'
  | 'missing'
  | 'expired'
  | 'revoked'
  | 'plaintext_rejected';

export type AdsAutomationProviderAdapterMode =
  | 'contract_only'
  | 'not_registered';

export type AdsAutomationProviderActionReadinessStatus =
  | 'ready_for_future_validate_only'
  | 'ready_monitor_only'
  | 'blocked_before_provider_boundary';

export type AdsAutomationProviderAccountReadinessStatus =
  | 'ready_for_local_validate_only'
  | 'blocked';

export interface AdsAutomationProviderCredentialMetadataInput {
  credentialReferenceId?: string | null;
  redactedCredentialReference?: string | null;
  oauthConnectionStatus?: AdsAutomationProviderCredentialStatus;
  grantedScopes?: AdsAutomationProviderPermissionScope[];
  plaintextCredentialFieldNames?: string[];
}

export interface AdsAutomationProviderAccountInput {
  platform: AdsAutomationProviderPlatform;
  accountId?: string | null;
  customerId?: string | null;
  loginCustomerId?: string | null;
  managerCustomerId?: string | null;
  erpAccountMappingId?: string | null;
  accountName?: string | null;
  adapterRegistered?: boolean;
  adapterMode?: AdsAutomationProviderAdapterMode;
  isActive?: boolean;
  approvedForProviderActions?: boolean;
  approvedForReadOnlyImport?: boolean;
  googleAdsProductionEnabled?: boolean;
  credentialMetadata?: AdsAutomationProviderCredentialMetadataInput | null;
}

export interface AdsAutomationProviderRequestedActionInput {
  actionId: string;
  sourcePendingActionId?: string | null;
  approvalId?: string | null;
  platform: AdsAutomationProviderPlatform;
  channel?: AdsAutomationProviderChannel | string | null;
  actionType: AdsAutomationProviderMvpAction | string;
  accountId?: string | null;
  customerId?: string | null;
  campaignId?: string | null;
  adGroupId?: string | null;
  campaignBudgetId?: string | null;
  campaignBudgetResourceName?: string | null;
  currentDailyBudgetVnd?: number | null;
  requestedDailyBudgetVnd?: number | null;
  targetStatus?: string | null;
}

export interface AdsAutomationProviderAccountReadinessInput {
  reportDate: string;
  now?: string | Date;
  fixtureMode?: AdsAutomationProviderAccountReadinessFixtureMode;
  accounts: AdsAutomationProviderAccountInput[];
  requestedActions: AdsAutomationProviderRequestedActionInput[];
}

export interface AdsAutomationProviderAdapterCapability {
  actionType: AdsAutomationProviderMvpAction;
  supported: boolean;
  providerApiRequired: boolean;
  requiresValidateOnlyBeforeExecution: boolean;
  requiredScopes: AdsAutomationProviderPermissionScope[];
  supportedChannels: AdsAutomationProviderChannel[];
}

export interface AdsAutomationProviderAdapterRegistryEntry {
  platform: AdsAutomationProviderPlatform;
  provider: 'google' | 'facebook' | 'tiktok';
  adapterKey: string;
  adapterMode: AdsAutomationProviderAdapterMode;
  boundaryMode: 'erp_owned_contract_only';
  registered: boolean;
  capabilityMap: AdsAutomationProviderAdapterCapability[];
  unsupportedChannels: AdsAutomationProviderChannel[];
  unsupportedActionsBlockedByDefault: string[];
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
}

export interface AdsAutomationProviderCredentialReadiness {
  status: AdsAutomationProviderCredentialStatus;
  credentialReferenceId: string | null;
  redactedCredentialReference: string | null;
  oauthConnectionStatus: AdsAutomationProviderCredentialStatus;
  grantedScopes: AdsAutomationProviderPermissionScope[];
  missingScopes: AdsAutomationProviderPermissionScope[];
  plaintextCredentialFieldCount: number;
  metadataOnly: true;
}

export interface AdsAutomationProviderAccountReadinessRecord {
  platform: AdsAutomationProviderPlatform;
  accountId: string | null;
  customerId: string | null;
  loginCustomerId: string | null;
  managerCustomerId: string | null;
  erpAccountMappingId: string | null;
  accountName: string | null;
  adapterRegistered: boolean;
  adapterMode: AdsAutomationProviderAdapterMode;
  isActive: boolean;
  approvedForProviderActions: boolean;
  approvedForReadOnlyImport: boolean;
  credentialReadiness: AdsAutomationProviderCredentialReadiness;
  requiredScopes: AdsAutomationProviderPermissionScope[];
  blockers: string[];
  warnings: string[];
  canUseForReadOnlyImport: boolean;
  canUseForFutureValidateOnly: boolean;
  canUseForFutureLiveExecution: false;
  execution_allowed_now: false;
}

export interface AdsAutomationProviderRequestedActionReadiness {
  actionId: string;
  sourcePendingActionId: string | null;
  approvalId: string | null;
  platform: AdsAutomationProviderPlatform;
  channel: AdsAutomationProviderChannel;
  actionType: string;
  accountId: string | null;
  customerId: string | null;
  campaignId: string | null;
  adGroupId: string | null;
  campaignBudgetId: string | null;
  campaignBudgetResourceName: string | null;
  budgetDirection: 'increase' | 'reduce' | 'unchanged' | 'not_applicable';
  status: AdsAutomationProviderActionReadinessStatus;
  requiredScopes: AdsAutomationProviderPermissionScope[];
  missingScopes: AdsAutomationProviderPermissionScope[];
  blockers: string[];
  warnings: string[];
  providerApiRequired: boolean;
  validateOnlyRequiredBeforeExecution: boolean;
  monitorOnlyDowngradeRequired: boolean;
  safetyActionCandidateAvailable: boolean;
  campaignBudgetIdNoFallback: true;
  approval_can_be_considered_executable: false;
  execution_allowed_now: false;
  next_required_action:
    | 'review_future_validate_only_contract'
    | 'monitor_only_until_provider_readiness_resolved'
    | 'resolve_provider_account_readiness'
    | 'use_monitor_only_safety_action';
}

export interface AdsAutomationProviderSafetyActionAvailability {
  actionType: 'pause_campaign' | 'pause_ad_group' | 'monitor_only';
  availableAsSafetyCandidate: true;
  providerReadinessRequiredBeforeProviderExecution: boolean;
  execution_allowed_now: false;
  note: string;
}

export interface AdsAutomationProviderAccountReadinessSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  fixture_or_payload_only: true;
  adapter_registry_contract_only: true;
  credential_metadata_only: true;
  plaintext_credentials_stored: false;
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
  approval_required_for_all_provider_actions: true;
  future_live_execution_allowed: false;
  execution_allowed_now: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  production_ready: false;
}

export interface AdsAutomationProviderAccountReadinessSummary {
  status: AdsAutomationProviderAccountReadinessStatus;
  fixture_mode: AdsAutomationProviderAccountReadinessFixtureMode;
  adapter_count: number;
  registered_adapter_count: number;
  account_count: number;
  ready_account_count: number;
  blocked_account_count: number;
  requested_action_count: number;
  provider_actions_requested: number;
  provider_actions_ready_for_future_validate_only: number;
  provider_actions_blocked_before_boundary: number;
  monitor_only_actions_ready: number;
  unsupported_action_count: number;
  unsupported_channel_count: number;
  missing_scope_count: number;
  missing_account_mapping_count: number;
  plaintext_credential_metadata_rejected_count: number;
  campaignBudgetId_missing_actions: number;
  monitor_only_downgrade_count: number;
  safety_actions_available: number;
  scale_up_execution_mode: 'monitor_only' | 'pending_validation';
  future_validate_only_contract_ready: boolean;
  provider_api_called: false;
  google_ads_api_called: false;
  live_ads_execution_used: false;
  execution_allowed_now: false;
  production_ready: false;
  next_required_action:
    | 'resolve_provider_account_readiness'
    | 'review_local_provider_account_readiness';
}

export interface AdsAutomationProviderAccountReadinessResponse {
  schemaVersion: 'ads_automation_provider_account_readiness.v1';
  generatedAt: string;
  reportDate: string;
  safety: AdsAutomationProviderAccountReadinessSafety;
  summary: AdsAutomationProviderAccountReadinessSummary;
  adapterRegistry: AdsAutomationProviderAdapterRegistryEntry[];
  accounts: AdsAutomationProviderAccountReadinessRecord[];
  requestedActions: AdsAutomationProviderRequestedActionReadiness[];
  safetyActionAvailability: AdsAutomationProviderSafetyActionAvailability[];
  blockers: string[];
  warnings: string[];
  markdownPreview: string;
}
