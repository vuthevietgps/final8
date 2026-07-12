import type {
  AdsAutomationFinalGoNoGoGateResponse,
} from './ads-automation-final-go-no-go-gate.contract';
import type {
  AdsAutomationCredentialVaultOnboardingResponse,
} from './ads-automation-credential-vault-onboarding.contract';

export type AdsAutomationProductionReadinessBridgeStatus =
  | 'LOCAL_READINESS_BRIDGE_PASS'
  | 'BLOCKED';

export type AdsAutomationProductionReadinessBridgeProvider =
  | 'google_ads'
  | 'meta_ads'
  | 'tiktok_ads';

export type AdsAutomationProductionReadinessBridgeProviderAccountKind =
  | 'google_ads_mcc'
  | 'meta_business_manager'
  | 'tiktok_business_center';

export type AdsAutomationProductionReadinessBridgeEnvironment =
  | 'future_production_metadata_only'
  | 'local_demo';

export type AdsAutomationProductionReadinessBridgeConfigState =
  | 'metadata_ready_redacted'
  | 'not_configured'
  | 'blocked';

export type AdsAutomationProductionReadinessBridgeStorageBackend =
  | 'erp_secret_store_reference_placeholder'
  | 'not_configured';

export type AdsAutomationProductionReadinessBridgeOwnerRole =
  | 'director'
  | 'manager'
  | 'ads_operator'
  | 'system_admin';

export type AdsAutomationProductionReadinessBridgeGateKey =
  | 'readonly_import'
  | 'provider_validateOnly'
  | 'approval'
  | 'execution_preflight'
  | 'live_execution';

export type AdsAutomationProductionReadinessBridgeGateStatus =
  | 'blocked_until_erp_secret_store_credentials'
  | 'blocked_until_erp_provider_validateOnly'
  | 'blocked_until_human_approval_ui_and_policy'
  | 'blocked_until_preflight_evidence'
  | 'blocked_until_separate_small_cap_live_test';

export interface AdsAutomationProductionReadinessBridgeProviderMetadataInput {
  provider: AdsAutomationProductionReadinessBridgeProvider;
  provider_account_kind:
    AdsAutomationProductionReadinessBridgeProviderAccountKind;
  account_identifier?: string | null;
  customer_id?: string | null;
  login_customer_id?: string | null;
  manager_customer_id?: string | null;
  business_manager_id?: string | null;
  business_center_id?: string | null;
  display_name?: string | null;
  environment?: AdsAutomationProductionReadinessBridgeEnvironment;
  oauth_app_config_readiness_state?:
    AdsAutomationProductionReadinessBridgeConfigState;
  required_scopes?: string[];
  storage_backend_type?:
    AdsAutomationProductionReadinessBridgeStorageBackend;
  secret_reference_handle?: string | null;
  owner_role?: AdsAutomationProductionReadinessBridgeOwnerRole;
  last_checked_at?: string | null;
  readiness_blockers?: string[];
}

export interface AdsAutomationProductionReadinessBridgeInput {
  reportDate?: string;
  now?: string | Date;
  fixtureMode?:
    | 'htx_ads_production_readiness_bridge_demo'
    | 'custom_local_payload';
  providerMetadata?: AdsAutomationProductionReadinessBridgeProviderMetadataInput[];
  finalGoNoGoGateResponse?: AdsAutomationFinalGoNoGoGateResponse;
  credentialVaultOnboardingResponse?:
    AdsAutomationCredentialVaultOnboardingResponse;
}

export interface AdsAutomationProductionReadinessBridgeGate {
  key: AdsAutomationProductionReadinessBridgeGateKey;
  status: AdsAutomationProductionReadinessBridgeGateStatus;
  can_proceed: false;
  blockers: string[];
  next_required_action: string;
}

export interface AdsAutomationProductionReadinessBridgeProviderReadiness {
  sequence: 1 | 2 | 3;
  provider: AdsAutomationProductionReadinessBridgeProvider;
  provider_account_kind:
    AdsAutomationProductionReadinessBridgeProviderAccountKind;
  account_identifier: string | null;
  customer_id: string | null;
  login_customer_id: string | null;
  manager_customer_id: string | null;
  business_manager_id: string | null;
  business_center_id: string | null;
  display_name: string | null;
  environment: AdsAutomationProductionReadinessBridgeEnvironment;
  oauth_app_config_readiness_state:
    AdsAutomationProductionReadinessBridgeConfigState;
  required_scopes: string[];
  storage_backend_type: AdsAutomationProductionReadinessBridgeStorageBackend;
  secret_reference_handle: string | null;
  owner_role: AdsAutomationProductionReadinessBridgeOwnerRole | null;
  last_checked_at: string | null;
  metadata_only: true;
  redacted_handle_only: true;
  forbidden_fields_detected: string[];
  real_credential_material_present: false;
  readiness_blockers: string[];
  gates: Record<
    AdsAutomationProductionReadinessBridgeGateKey,
    AdsAutomationProductionReadinessBridgeGate
  >;
  can_proceed_to_readonly_import: false;
  can_proceed_to_provider_validateOnly: false;
  can_proceed_to_approval: false;
  can_proceed_to_execution_preflight: false;
  can_proceed_to_live_execution: false;
  execution_allowed_now: false;
  production_ready: false;
}

export interface AdsAutomationProductionReadinessBridgeSafetyGate {
  key:
    | 'gross_margin'
    | 'contribution_profit'
    | 'cash_conversion'
    | 'stock_coverage'
    | 'supplier_reliability'
    | 'fulfillment_capacity'
    | 'return_refund_risk'
    | 'data_freshness'
    | 'daily_loss_limit'
    | 'monthly_loss_limit';
  state: 'uncertain_blocks_scale' | 'local_demo_safe_but_live_blocked';
  scale_action_mode: 'monitor_only_or_blocked';
  evidence: string;
}

export interface AdsAutomationProductionReadinessBridgeSafety {
  read_only: true;
  dry_run: true;
  local_only: true;
  report_only: true;
  credential_metadata_only: true;
  plaintext_secrets_added: false;
  real_credential_material_present: false;
  provider_api_used: false;
  provider_api_called: false;
  google_ads_api_used: false;
  google_ads_api_called: false;
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
  GOOGLE_ADS_PRODUCTION_ENABLED: false;
  execution_allowed_now: false;
  production_ready: false;
  erp_only_future_validator_approver_executor: true;
}

export interface AdsAutomationProductionReadinessBridgeResponse {
  schemaVersion: 'ads_automation_production_readiness_bridge.v1';
  generatedAt: string;
  reportDate: string;
  fixtureMode: AdsAutomationProductionReadinessBridgeInput['fixtureMode'];
  status: AdsAutomationProductionReadinessBridgeStatus;
  production_ready: false;
  execution_allowed_now: false;
  real_credential_material_present: false;
  safety: AdsAutomationProductionReadinessBridgeSafety;
  expectedProviderOrder:
    AdsAutomationProductionReadinessBridgeProviderAccountKind[];
  forbiddenCredentialFields: string[];
  providers: AdsAutomationProductionReadinessBridgeProviderReadiness[];
  providerOrderValid: boolean;
  bridgeBlockers: string[];
  blockersForRealProduction: string[];
  next_human_steps: string[];
  demoReadiness: {
    final_go_no_go_gate_ready: boolean;
    credential_vault_onboarding_ready_demo: boolean;
    credential_vault_database_ready_demo: boolean;
    credential_vault_endpoint_added: true;
    approval_ui_ready_demo: boolean;
    approval_ui_surface: 'existing_ai_marketing_approval_queue';
    execution_worker_simulation_ready_demo: boolean;
    execution_worker_evidence:
      | 'dry_run_preflight_idempotency_kill_switch_evidence_present'
      | 'missing';
    frontend_bridge_panel_added: false;
    frontend_gap:
      | 'existing_approval_queue_can_display_pending_actions_bridge_panel_deferred';
  };
  localFoundationEvidence: {
    finalGoNoGoSchemaVersion:
      AdsAutomationFinalGoNoGoGateResponse['schemaVersion'];
    finalGoNoGoDecision:
      AdsAutomationFinalGoNoGoGateResponse['summary']['decision'];
    finalGoNoGoLocalGatePassed: boolean;
    safe_pending_actions: number;
    unsafe_pending_actions: number;
    safe_alert_rollback_records: number;
    unsafe_alert_rollback_records: number;
  };
  credentialVaultOnboarding: {
    schemaVersion: AdsAutomationCredentialVaultOnboardingResponse['schemaVersion'];
    status: AdsAutomationCredentialVaultOnboardingResponse['status'];
    providerOrderValid: boolean;
    providers_ready_for_local_demo: number;
    credential_onboarding_layer_demo_ready: boolean;
    database_readiness_layer_demo_ready: boolean;
    db_schema_status: AdsAutomationCredentialVaultOnboardingResponse['databaseReadiness']['status'];
    db_blockers: string[];
    future_db_blockers: string[];
  };
  businessSafetyGates:
    AdsAutomationProductionReadinessBridgeSafetyGate[];
  scale_action_mode: 'monitor_only_or_blocked';
  next_recommendation:
    | 'STOP_AFTER_PRODUCTION_READINESS_BRIDGE'
    | 'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE';
  next_codex_prompt: null | 'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE';
  markdownPreview: string;
}
