export type AdsAutomationCredentialVaultProvider =
  | 'google_ads_mcc'
  | 'meta_business_manager'
  | 'tiktok_business_center';

export type AdsAutomationCredentialVaultProviderPlatform =
  | 'google_ads'
  | 'meta_ads'
  | 'tiktok_ads';

export type AdsAutomationCredentialVaultStatus =
  | 'LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY'
  | 'BLOCKED';

export type AdsAutomationCredentialProfileStatus =
  | 'metadata_profile_ready'
  | 'metadata_profile_missing'
  | 'blocked_unknown_provider'
  | 'blocked_forbidden_metadata';

export type AdsAutomationSecretStorageStatus =
  | 'local_encryption_probe_ready'
  | 'secret_reference_placeholder_ready'
  | 'blocked_missing_profile_metadata';

export type AdsAutomationCredentialVaultDbSchemaStatus =
  | 'local_contract_ready'
  | 'local_contract_ready_with_future_blockers'
  | 'blocked_missing_required_collection';

export type AdsAutomationCredentialVaultAuditAction =
  | 'create'
  | 'rotate'
  | 'validate_readiness';

export interface AdsAutomationCredentialVaultProviderProfileInput {
  provider: AdsAutomationCredentialVaultProvider;
  profile_id?: string | null;
  account_identifier?: string | null;
  customer_id?: string | null;
  login_customer_id?: string | null;
  manager_customer_id?: string | null;
  business_manager_id?: string | null;
  business_center_id?: string | null;
  display_name?: string | null;
  owner_user_id?: string | null;
  owner_role?: 'director' | 'manager' | 'ads_operator' | 'system_admin' | null;
  metadata?: Record<string, unknown> | null;
  secretMaterial?: Record<string, unknown> | null;
  requested_action?: AdsAutomationCredentialVaultAuditAction;
}

export interface AdsAutomationCredentialVaultOnboardingInput {
  reportDate?: string;
  now?: string | Date;
  fixtureMode?:
    | 'htx_ads_credential_vault_onboarding_demo'
    | 'custom_local_payload';
  providerProfiles?: AdsAutomationCredentialVaultProviderProfileInput[];
  includeLocalEncryptionProbe?: boolean;
}

export interface AdsAutomationCredentialVaultSecretStorageEvidence {
  adapter: 'api_token_service_contract';
  api_token_service_available: boolean;
  api_token_crypto_util_used: true;
  api_token_storage_fields: ['tokenEnc', 'tokenHash', 'providerConfigEnc'];
  decrypt_method_exposed_by_endpoint: false;
  secret_material_input_accepted_for_encryption_probe: boolean;
  plaintext_secret_returned: false;
  encrypted_payload_returned: false;
  encrypted_payload_plaintext_free: boolean | null;
  secret_reference_handle: string | null;
}

export interface AdsAutomationCredentialVaultAuditIntent {
  action: AdsAutomationCredentialVaultAuditAction;
  provider: AdsAutomationCredentialVaultProvider;
  audit_collection: 'api_token_audits';
  metadata_only: true;
  should_persist_in_real_erp: true;
  persisted_in_local_demo: false;
  plaintext_secret_logged: false;
}

export interface AdsAutomationCredentialVaultProviderReadiness {
  sequence: 1 | 2 | 3;
  provider: AdsAutomationCredentialVaultProvider;
  platform: AdsAutomationCredentialVaultProviderPlatform;
  credential_profile_status: AdsAutomationCredentialProfileStatus;
  secret_storage_status: AdsAutomationSecretStorageStatus;
  db_schema_status: AdsAutomationCredentialVaultDbSchemaStatus;
  read_only_import_allowed: false;
  validate_only_allowed: false;
  approval_allowed: false;
  execution_preflight_allowed: false;
  live_execution_allowed: false;
  execution_allowed_now: false;
  production_ready: false;
  profile_id: string;
  account_identifier: string | null;
  customer_id: string | null;
  login_customer_id: string | null;
  manager_customer_id: string | null;
  business_manager_id: string | null;
  business_center_id: string | null;
  display_name: string | null;
  owner_user_id: string | null;
  owner_role: string | null;
  redacted_metadata: Record<string, unknown>;
  secret_reference_handle: string | null;
  secret_storage_evidence: AdsAutomationCredentialVaultSecretStorageEvidence;
  audit_intents: AdsAutomationCredentialVaultAuditIntent[];
  blockers: string[];
}

export interface AdsAutomationCredentialVaultDbIndexExpectation {
  name: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  present_in_schema: boolean;
  purpose: string;
}

export interface AdsAutomationCredentialVaultDbCollectionReadiness {
  collection: string;
  model: string;
  purpose: string;
  status: AdsAutomationCredentialVaultDbSchemaStatus;
  owner_fields: string[];
  idempotency_fields: string[];
  required_indexes: AdsAutomationCredentialVaultDbIndexExpectation[];
  db_blockers: string[];
}

export interface AdsAutomationCredentialVaultDatabaseReadiness {
  status: AdsAutomationCredentialVaultDbSchemaStatus;
  collections: AdsAutomationCredentialVaultDbCollectionReadiness[];
  db_blockers: string[];
  future_db_blockers: string[];
}

export interface AdsAutomationCredentialVaultSafety {
  local_only: true;
  dry_run: true;
  fixture_or_payload_only: true;
  plaintext_secrets_added: false;
  plaintext_secret_returned: false;
  encrypted_payload_returned: false;
  real_credential_material_present: false;
  provider_api_used: false;
  provider_api_called: false;
  google_ads_api_used: false;
  google_ads_api_called: false;
  validateOnly_called: false;
  live_ads_execution_used: false;
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationCredentialVaultOnboardingResponse {
  schemaVersion: 'ads_automation_credential_vault_onboarding.v1';
  generatedAt: string;
  reportDate: string;
  fixtureMode: AdsAutomationCredentialVaultOnboardingInput['fixtureMode'];
  status: AdsAutomationCredentialVaultStatus;
  expectedProviderOrder: AdsAutomationCredentialVaultProvider[];
  providerOrderValid: boolean;
  forbiddenCredentialMetadataFields: string[];
  providers: AdsAutomationCredentialVaultProviderReadiness[];
  databaseReadiness: AdsAutomationCredentialVaultDatabaseReadiness;
  summary: {
    credential_onboarding_layer_demo_ready: boolean;
    database_readiness_layer_demo_ready: boolean;
    providers_ready_for_local_demo: number;
    provider_count: number;
    read_only_import_allowed: false;
    validate_only_allowed: false;
    approval_allowed: false;
    execution_preflight_allowed: false;
    live_execution_allowed: false;
    execution_allowed_now: false;
    production_ready: false;
  };
  safety: AdsAutomationCredentialVaultSafety;
  bridgeIntegration: {
    bridge_can_report_credential_layer_demo_ready: boolean;
    production_readiness_bridge_should_remain_blocked_for_live: true;
    production_ready: false;
    execution_allowed_now: false;
  };
  blockers: string[];
  blockersForRealProduction: string[];
  markdownPreview: string;
}
